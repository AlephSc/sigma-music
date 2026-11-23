#!/usr/bin/env node
/**
 * P2 Home Server Sync Script (Cron-ready)
 * Pulls latest bookings and date_blocks from Cloudflare Worker `/v1/admin/sync`
 * and stores a timestamped JSON backup in `./backups/`.
 *
 * Usage:
 *   WORKER_URL=https://api.sigmamusic.my.id SYNC_API_KEY=... node scripts/sync-homeserver.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:8787').replace(/\/+$/, '');
const SYNC_API_KEY = process.env.SYNC_API_KEY || '';
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');

if (!SYNC_API_KEY) {
  console.error('Missing SYNC_API_KEY environment variable.');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${WORKER_URL}/v1/admin/sync`, {
    headers: { 'X-Sync-Key': SYNC_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Sync failed with HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const latestPath = path.join(BACKUP_DIR, 'latest-sync.json');
  const archivePath = path.join(BACKUP_DIR, `sync-${stamp}.json`);

  const formatted = JSON.stringify(data, null, 2);
  await fs.writeFile(latestPath, formatted, 'utf8');
  await fs.writeFile(archivePath, formatted, 'utf8');

  console.log(
    `Synced ${data.bookings?.length ?? 0} bookings & ${data.date_blocks?.length ?? 0} date blocks -> ${archivePath}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
