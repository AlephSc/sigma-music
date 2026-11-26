import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sigma Music Jombang',
    short_name: 'Sigma Music',
    description: 'Rental Sound System, Lighting, Panggung, Tenda & Perlengkapan Acara di Jombang',
    start_url: '/',
    display: 'standalone',
    background_color: '#14121d',
    theme_color: '#8b5cf6',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
