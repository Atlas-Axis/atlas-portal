'use client';

// import NextError from 'next/error';
import Error from 'next/error';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { Frown } from 'lucide-react';

// import { AxiomWebVitals } from 'next-axiom';

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
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <div className="flex h-full min-h-dvh w-full flex-col items-center justify-center p-8">
          <Frown className="mb-4 h-16 w-16 text-red-600" />

          <h1 className="mb-4 text-2xl font-bold text-red-600">An error occurred</h1>

          {error.message && (
            <div className="mb-4 max-w-lg overflow-auto rounded bg-gray-100 p-3 text-sm text-red-600">
              {error.message}
            </div>
          )}

          <p className="mb-4">
            We apologize for the inconvenience. We logged the error details and will investigate the issue.
          </p>
        </div>
        {/* <NextError statusCode={0} title={'😞'} /> */}
        <Analytics />
      </body>
    </html>
  );
}
