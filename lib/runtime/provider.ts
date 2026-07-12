import type { RuntimeLogEntry } from "@/lib/runtime/logs";
import type { RuntimeDescriptor } from "@/lib/runtime/state";

export type RuntimeStartRequest = {
  projectId: string;
  workspacePath: string;
  port: number;
  timeoutMs: number;
};

export type RuntimeExitEvent = {
  projectId: string;
  exitCode: number | null;
  exitSignal: string | null;
};

export interface ProjectRuntimeProvider {
  start(request: RuntimeStartRequest): Promise<RuntimeDescriptor>;
  stop(projectId: string): Promise<RuntimeDescriptor>;
  restart(request: RuntimeStartRequest): Promise<RuntimeDescriptor>;
  status(projectId: string): Promise<RuntimeDescriptor | null>;
  logs(projectId: string): Promise<RuntimeLogEntry[]>;
}