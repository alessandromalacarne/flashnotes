const DISABLED_VALUES = new Set(['off', 'false', '0', 'no']);

export function workflowsEnabled(): boolean {
  const candidates = [
    import.meta.env.VITE_QUICKDUMP_WORKFLOWS,
    import.meta.env.VITE_WORKFLOWS_ENABLED,
    import.meta.env.VITE_WORKFLOWS,
  ];
  for (const raw of candidates) {
    if (raw == null || String(raw).trim() === '') continue;
    return !DISABLED_VALUES.has(String(raw).trim().toLowerCase());
  }
  return true;
}
