'use client';

// import NextError from 'next/error';
import { Inter } from 'next/font/google';
import { useEffect, useState } from 'react';
// import * as Sentry from '@sentry/nextjs';
// import { Analytics } from '@vercel/analytics/react';
import { Frown } from 'lucide-react';

// import { AxiomWebVitals } from 'next-axiom';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [errorLogId, setErrorLogId] = useState<string | null>(null);
  useEffect(() => {
    console.error(error);
    // TODO: Add Sentry error logging
    // const sentryErrorLogId = Sentry.captureException(error);
    // setErrorLogId(sentryErrorLogId);
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
            <pre className="mb-4 max-w-full overflow-auto rounded bg-gray-100 p-3 text-sm text-red-600">
              {error.message}
            </pre>
          )}

          <p className="mb-4">
            We apologize for the inconvenience. We logged the error details and will investigate the issue.
          </p>

          {errorLogId && (
            <p className="mt-4 text-sm text-gray-300">
              Error ID: <span className="font-mono">{errorLogId}</span>
            </p>
          )}
        </div>
        {/* <NextError statusCode={0} title={'😞'} /> */}
        {/* <Analytics />
        <AxiomWebVitals />; */}
      </body>
    </html>
  );
}
