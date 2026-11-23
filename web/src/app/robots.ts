import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sigmamusic.my.id';
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/jadwal'],
      disallow: ['/admin'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
