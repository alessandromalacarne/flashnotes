const DISABLED_VALUES = new Set(['off', 'false', '0', 'no']);

export function workflowsEnabled(): boolean {
  const raw = process.env.QUICKDUMP_WORKFLOWS;
  if (raw == null || raw.trim() === '') {
    return true;
  }
  return !DISABLED_VALUES.has(raw.trim().toLowerCase());
}

export const isWorkflowsEnabled = workflowsEnabled;

export function isFeatureEnabled(name: string): boolean {
  if (name === 'workflows') return workflowsEnabled();
  return true;
}
