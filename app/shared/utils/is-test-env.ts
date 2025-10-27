/**
 * Detects if the code is running in a test environment
 * @returns true if running in tests, false otherwise
 */
export function isTestEnv(): boolean {
  return (
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    // @vitest-environment jsdom sets this
    typeof process.env.VITEST === 'string' ||
    // Vitest also sets this
    !!process.env.VITEST
  );
}
