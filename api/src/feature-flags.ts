const DISABLED_VALUES = new Set(['off', 'false', '0', 'no']);

export function serverDbEnabled(): boolean {
  const raw = process.env.FLASHNOTES_SERVER_DB;
  if (raw == null || raw.trim() === '') {
    return true;
  }
  return !DISABLED_VALUES.has(raw.trim().toLowerCase());
}
