'use client';

import Error from 'next/error';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { Frown } from 'lucide-react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function GlobalError({ error }: { error: Error & { digest?: string; message?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className={`${inter.variable}`}>
        <div className="flex h-full min-h-dvh w-full flex-col items-center justify-center p-8">
          <Frown className="mb-4 h-16 w-16 text-red-600" />

          <h1 className="mb-4 text-2xl font-bold text-red-600">An error occurred</h1>

          {error.message && (
            <div className="mb-4 max-w-lg overflow-auto rounded bg-gray-100 p-3 text-sm text-red-600 dark:bg-zinc-800 dark:text-red-400">
              {error.message}
            </div>
          )}

          <p className="mb-4">
            We apologize for the inconvenience. We logged the error details and will investigate the issue.
          </p>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
