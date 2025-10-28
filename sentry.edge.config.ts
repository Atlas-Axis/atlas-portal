// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs';
import { isTestEnv } from '@/app/shared/utils/is-test-env';

Sentry.init({
  enabled: !isTestEnv(),
  dsn: 'https://58d2ff1993700956d0aa17025448f50d@o4510261328347136.ingest.us.sentry.io/4510261329985536',
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,
});
