import { loadEnvConfig } from '@next/env';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';

export const isDevelopment = process.env.NODE_ENV !== 'production';

if (DEBUG_LOGGING()) {
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
}

export function loadEnv() {
  // Load environment variables
  const projectDir = process.cwd();
  loadEnvConfig(projectDir, isDevelopment, { info: () => {}, error: console.error });
}
