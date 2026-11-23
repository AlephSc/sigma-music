import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ChatWidget } from '@/components/ChatWidget';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sigmamusic.my.id';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Sigma Music Jombang — Rental Sound System & Perlengkapan Acara',
  description:
    'Sigma Music Jombang: sewa sound system, lighting, panggung, tenda, dekorasi, kursi, meja, alat makan, dan fotografer untuk acara pernikahan, hajatan, dan event. Hubungi WhatsApp 0858-1668-6900.',
  keywords: [
    'rental sound system jombang',
    'sewa speaker jombang',
    'sewa lighting panggung jombang',
    'rental tenda kursi jombang',
    'sewa alat pesta jombang',
    'sewa panggung jombang',
    'dekorasi pernikahan jombang',
    'sigma music jombang',
  ],
  authors: [{ name: 'Sigma Music' }],
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Sigma Music Jombang',
    url: SITE_URL,
    title: 'Sigma Music: Rental Sound System & Perlengkapan Pesta Jombang',
    description:
      'Sewa sound system, lighting, panggung, tenda, dekorasi, kursi, meja, alat makan, dan fotografer. Melayani Jombang dan sekitarnya. WhatsApp 0858-1668-6900.',
    locale: 'id_ID',
    images: [
      {
        url: '/assets/hero.webp',
        width: 1280,
        height: 854,
        alt: 'Lampu panggung menyapu kerumunan saat acara malam, rental Sigma Music Jombang',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sigma Music: Rental Sound System & Perlengkapan Pesta Jombang',
    description:
      'Sewa sound system, lighting, panggung, tenda, dekorasi, kursi, meja, alat makan, dan fotografer. Jombang. WhatsApp 0858-1668-6900.',
    images: ['/assets/hero.webp'],
  },
};

export const viewport: Viewport = {
  themeColor: '#14121d',
};

const themeInitScript = `
  try {
    const saved = localStorage.getItem('sigma-theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`dark ${jakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
