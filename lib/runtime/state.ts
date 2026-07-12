export type RuntimeStatus = "stopped" | "starting" | "running" | "failed";

export type RuntimeDescriptor = {
  projectId: string;
  port: number;
  status: RuntimeStatus;
  pid: number | null;
  previewUrl: string | null;
  logPath: string | null;
  startedAt: Date | null;
  exitCode: number | null;
  exitSignal: string | null;
  updatedAt: Date;
};

export function createStoppedRuntime(projectId: string, port: number): RuntimeDescriptor {
  return {
    projectId,
    port,
    status: "stopped",
    pid: null,
    previewUrl: null,
    logPath: null,
    startedAt: null,
    exitCode: null,
    exitSignal: null,
    updatedAt: new Date(),
  };
}

export function mapExitToRuntimeStatus(expectedExit: boolean): RuntimeStatus {
  return expectedExit ? "stopped" : "failed";
}