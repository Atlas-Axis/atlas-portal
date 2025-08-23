import type { NextConfig } from 'next';
import { Header } from 'next/dist/lib/load-custom-routes';

const nextConfig: NextConfig = {
  // Allow embedding in Notion
  headers: async (): Promise<Header[]> => [
    {
      source: '/embed/:path*',
      headers: [
        {
          key: 'Content-Type',
          value: 'text/html; charset=utf-8',
        },
        {
          key: 'Content-Security-Policy',
          value:
            "frame-ancestors 'self' https://notion.so https://*.notion.so https://notion.site https://*.notion.site;",
        },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

export default nextConfig;
