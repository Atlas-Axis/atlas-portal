/**
 * Detects if the code is running in a development environment
 * @returns true if running in development, false otherwise
 */
export function isDevEnv(): boolean {
  return process.env.NODE_ENV === 'development';
}
