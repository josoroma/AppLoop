export type ActiveHermesRun = {
  runId: string;
  hermesRunId: string | null;
};

const activeRunsByProject = new Map<string, ActiveHermesRun>();

export function rememberActiveHermesRun(projectId: string, run: ActiveHermesRun) {
  activeRunsByProject.set(projectId, run);
}

export function getActiveHermesRun(projectId: string) {
  return activeRunsByProject.get(projectId) ?? null;
}

export function clearActiveHermesRun(projectId: string) {
  activeRunsByProject.delete(projectId);
}