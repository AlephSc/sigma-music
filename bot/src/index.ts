import 'dotenv/config';
import http from 'node:http';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import {
  calculateTypingDelayMs,
  MessageGuard,
  OutboundQueue,
  randomBetween,
  sleep,
  verifyWebhookSignature,
} from './safety.js';

const OWNER_WA_NUMBER = (process.env.OWNER_WA_NUMBER || '6285816686900').replace(/\D/g, '');
const OWNER_JID = `${OWNER_WA_NUMBER}@s.whatsapp.net`;
const WORKER_URL = (process.env.WORKER_URL || 'https://sigma-music-worker.alephsc25.workers.dev').replace(/\/+$/, '');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const BOT_PORT = Number(process.env.BOT_PORT || 3099);
const ENABLE_PUBLIC_AI_REPLY = process.env.ENABLE_PUBLIC_AI_REPLY === 'true';

const MIN_REPLY_DELAY_MS = Number(process.env.MIN_REPLY_DELAY_MS || 1800);
const MAX_REPLY_DELAY_MS = Number(process.env.MAX_REPLY_DELAY_MS || 4200);
const OUTBOUND_JITTER_MIN_MS = Number(process.env.OUTBOUND_JITTER_MIN_MS || 2200);
const OUTBOUND_JITTER_MAX_MS = Number(process.env.OUTBOUND_JITTER_MAX_MS || 5000);

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const outboundQueue = new OutboundQueue(OUTBOUND_JITTER_MIN_MS, OUTBOUND_JITTER_MAX_MS);
const messageGuard = new MessageGuard(5000);
const sessionByJid = new Map<string, string>();

let activeSock: WASocket | null = null;
let reconnectAttempt = 0;

function extractText(msg: {
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null } | null;
}): string {
  return (msg.conversation || msg.extendedTextMessage?.text || '').trim();
}

async function sendHumanLikeReply(sock: WASocket, jid: string, text: string) {
  await outboundQueue.enqueue(async () => {
    await sock.presenceSubscribe(jid).catch(() => {});
    await sock.sendPresenceUpdate('composing', jid).catch(() => {});
    await sleep(calculateTypingDelayMs(text, MIN_REPLY_DELAY_MS, MAX_REPLY_DELAY_MS));
    await sock.sendMessage(jid, { text });
    await sock.sendPresenceUpdate('paused', jid).catch(() => {});
  });
}

async function handleOwnerCommand(sock: WASocket, jid: string, text: string) {
  if (text === '!help') {
    await sendHumanLikeReply(
      sock,
      jid,
      'Perintah Admin Sigma Music:\n• !cek YYYY-MM-DD — cek status ketersediaan tanggal\n• !status — cek status bot & antrean'
    );
    return;
  }

  if (text === '!status') {
    await sendHumanLikeReply(
      sock,
      jid,
      `Bot aktif.\n• Auto-reply publik: ${ENABLE_PUBLIC_AI_REPLY ? 'AKTIF' : 'NONAKTIF (mode notifikasi owner saja)'}\n• Antrean kirim: ${outboundQueue.size}`
    );
    return;
  }

  const match = /^!cek\s+(\d{4}-\d{2}-\d{2})$/.exec(text);
  if (match) {
    const dateStr = match[1];
    const month = dateStr.slice(0, 7);
    try {
      const res = await fetch(`${WORKER_URL}/v1/availability?month=${encodeURIComponent(month)}`);
      const data = (await res.json()) as { days?: Array<{ date: string; status: string; count: number }> };
      const day = data.days?.find((d) => d.date === dateStr);
      const reply = day
        ? `Status ${dateStr}: *${day.status}* (jumlah agenda/pending: ${day.count})`
        : `Data untuk ${dateStr} tidak ditemukan.`;
      await sendHumanLikeReply(sock, jid, reply);
    } catch {
      await sendHumanLikeReply(sock, jid, 'Gagal mengecek jadwal ke server Worker.');
    }
  }
}

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false, // Prevents stealing online presence from your main phone
    syncFullHistory: false, // Keeps reconnect lightweight & avoids history flood
    generateHighQualityLinkPreview: false,
  });

  activeSock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info('Scan QR code di WhatsApp > Perangkat Tertaut:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      reconnectAttempt = 0;
      logger.info({ owner: OWNER_JID }, 'WhatsApp Bot terhubung!');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode, shouldReconnect }, 'Koneksi WhatsApp terputus');
      activeSock = null;

      if (shouldReconnect) {
        reconnectAttempt += 1;
        const backoffMs = Math.min(60_000, 3000 * 2 ** Math.min(reconnectAttempt, 4));
        setTimeout(() => {
          connectWhatsApp().catch((err) => logger.error(err, 'Gagal reconnect WhatsApp'));
        }, backoffMs);
      } else {
        logger.error('Sesi WhatsApp loggedOut. Hapus folder auth_info/ dan scan QR ulang.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      const jid = msg.key.remoteJid || '';
      const ts = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp || 0);

      if (
        !messageGuard.shouldProcess({
          jid,
          messageId: msg.key.id,
          timestampSec: ts,
          fromMe: Boolean(msg.key.fromMe),
        })
      ) {
        continue;
      }

      if (!msg.message) continue;
      const text = extractText(msg.message);
      if (!text) continue;

      if (jid === OWNER_JID && text.startsWith('!')) {
        await handleOwnerCommand(sock, jid, text);
        continue;
      }

      if (!ENABLE_PUBLIC_AI_REPLY) {
        continue;
      }

      // Natural read delay before replying to customer DM
      await sleep(randomBetween(700, 1600));
      await sock.readMessages([msg.key]).catch(() => {});

      try {
        const res = await fetch(`${WORKER_URL}/v1/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionByJid.get(jid),
            message: text.slice(0, 1000),
          }),
        });
        const data = (await res.json()) as { session_id?: string; reply?: string };
        if (data.session_id) sessionByJid.set(jid, data.session_id);
        if (data.reply) {
          await sendHumanLikeReply(sock, jid, data.reply);
        }
      } catch (err) {
        logger.error(err, 'Gagal meneruskan pesan ke Worker /v1/chat');
      }
    }
  });
}

function startWebhookServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          whatsapp: activeSock ? 'connected' : 'disconnected',
          queue: outboundQueue.size,
        })
      );
      return;
    }

    if (req.method === 'POST' && req.url === '/webhook/booking') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', async () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const sig = req.headers['x-sigma-signature'];
        const sigStr = Array.isArray(sig) ? sig[0] : sig;

        if (!verifyWebhookSignature(rawBody, sigStr, WEBHOOK_SECRET)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        try {
          const payload = JSON.parse(rawBody) as {
            event?: string;
            event_date?: string;
            package?: string;
            customer_name?: string;
            customer_phone?: string;
            customer_address?: string | null;
            notes?: string | null;
          };

          if (activeSock && payload.event === 'booking.created') {
            const msgText = [
              '*[Booking Baru - Sigma Music]*',
              `Tanggal: ${payload.event_date}`,
              `Paket: ${payload.package}`,
              `Nama: ${payload.customer_name}`,
              `WA: +${payload.customer_phone}`,
              `Alamat: ${payload.customer_address || '-'}`,
              `Catatan: ${payload.notes || '-'}`,
              '',
              `Chat langsung: https://wa.me/${payload.customer_phone}`,
            ].join('\n');

            // Only notify OWNER_JID — never cold-message customer from bot!
            outboundQueue
              .enqueue(async () => {
                if (activeSock) {
                  await activeSock.sendMessage(OWNER_JID, { text: msgText });
                }
              })
              .catch((err) => logger.error(err, 'Gagal kirim notifikasi ke owner'));
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(BOT_PORT, () => {
    logger.info({ port: BOT_PORT }, 'Webhook server siap menerima event dari Cloudflare Worker');
  });
}

startWebhookServer();
connectWhatsApp().catch((err) => {
  logger.error(err, 'Inisialisasi WhatsApp gagal');
  process.exit(1);
});
