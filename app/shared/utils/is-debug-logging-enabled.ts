export const DEBUG_LOGGING = (): boolean => {
  const value = process.env.DEBUG_LOGGING;
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  // Support common truthy values: 1, true
  return normalized === '1' || normalized === 'true';
};
