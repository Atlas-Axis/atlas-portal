/**
 * Format duration in milliseconds to human-readable string (e.g. "7m 17s", "2h 15m 1s")
 */
export function formatDuration(ms: number | undefined): string {
  if (ms == null) return '-';
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
