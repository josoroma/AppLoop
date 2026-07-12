import type { ProjectOverview, ProjectRepository } from "@/lib/db/repository";
import type { Runtime } from "@/lib/db/schema";
import { DEFAULT_PREVIEW_PORT_RANGE, type PreviewPortRange } from "@/lib/runtime/ports";
import { findAvailablePreviewPort, isPortAvailable } from "@/lib/runtime/port-probe";
import type { ProjectRuntimeProvider } from "@/lib/runtime/provider";
import { reconcileRuntimeRecord } from "@/lib/project-recovery/recovery";
import { categorizeFailure, createCorrelationId, getDurationMs, recordStructuredEvent, startDurationTimer } from "@/lib/observability/events";

export class RuntimeService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly provider: ProjectRuntimeProvider,
    private readonly timeoutMs: number,
    private readonly previewPortRange: PreviewPortRange = DEFAULT_PREVIEW_PORT_RANGE,
  ) {}

  async startProject(projectId: string) {
    const correlationId = createCorrelationId("runtime-start");
    const startedTimer = startDurationTimer();
    const overview = await this.requireRunnableProject(projectId);
    const port = await this.resolveRuntimePort(overview);
    const previewUrl = `http://127.0.0.1:${port}`;
    const startedAt = new Date();

    await this.repository.updateProjectPreviewPort(projectId, port);
    await this.repository.updateRuntime(projectId, {
      port,
      pid: null,
      status: "starting",
      previewUrl,
      startedAt,
      exitCode: null,
      exitSignal: null,
    });
    recordStructuredEvent({ correlationId, projectId, source: "runtime", action: "start", status: "started", detail: { port } });

    try {
      const descriptor = await this.provider.start({
        projectId,
        workspacePath: overview.project.workspacePath,
        port,
        timeoutMs: this.timeoutMs,
      });
      recordStructuredEvent({
        correlationId,
        projectId,
        source: "runtime",
        action: "start",
        status: descriptor.status === "running" ? "succeeded" : "failed",
        durationMs: getDurationMs(startedTimer),
        detail: { port: descriptor.port, pid: descriptor.pid, previewUrl: descriptor.previewUrl },
      });

      return this.repository.updateRuntime(projectId, {
        port: descriptor.port,
        pid: descriptor.status === "running" ? descriptor.pid : null,
        status: descriptor.status,
        previewUrl: descriptor.previewUrl,
        logPath: descriptor.logPath,
        startedAt: descriptor.startedAt,
        exitCode: descriptor.exitCode,
        exitSignal: descriptor.exitSignal,
      });
    } catch (error) {
      recordStructuredEvent({
        correlationId,
        projectId,
        source: "runtime",
        action: "start",
        status: "failed",
        durationMs: getDurationMs(startedTimer),
        failureCategory: categorizeFailure(error),
      });
      throw error;
    }
  }

  async stopProject(projectId: string) {
    const correlationId = createCorrelationId("runtime-stop");
    const startedTimer = startDurationTimer();
    await this.provider.stop(projectId);
    recordStructuredEvent({ correlationId, projectId, source: "runtime", action: "stop", status: "succeeded", durationMs: getDurationMs(startedTimer) });

    return this.repository.updateRuntime(projectId, {
      pid: null,
      status: "stopped",
      exitCode: null,
      exitSignal: null,
    });
  }

  async restartProject(projectId: string) {
    recordStructuredEvent({ correlationId: createCorrelationId("runtime-restart"), projectId, source: "runtime", action: "restart", status: "started" });
    await this.stopProject(projectId);
    return this.startProject(projectId);
  }

  async getProjectRuntime(projectId: string) {
    const overview = await this.repository.findProjectOverviewById(projectId);

    return overview?.runtime ?? null;
  }

  getProjectLogs(projectId: string) {
    return this.provider.logs(projectId);
  }

  async markProjectRuntimeFailed(projectId: string, exitCode: number | null, exitSignal: string | null) {
    recordStructuredEvent({
      correlationId: `runtime:${projectId}`,
      projectId,
      source: "runtime",
      action: "exit",
      status: "failed",
      failureCategory: exitSignal ? "signal" : "exit-code",
      detail: { exitCode, exitSignal },
    });
    await this.repository.updateRuntime(projectId, {
      pid: null,
      status: "failed",
      exitCode,
      exitSignal,
    });
  }

  async reconcileStoredRuntimes() {
    const overviews = await this.repository.listProjectOverviews("active");
    const reconciled = [];

    for (const overview of overviews) {
      if (!overview.runtime) {
        continue;
      }

      const patch = await reconcileRuntimeRecord(overview.runtime);

      if (patch.status !== overview.runtime.status || patch.pid !== overview.runtime.pid) {
        reconciled.push(await this.repository.updateRuntime(overview.project.id, patch));
      }
    }

    return reconciled;
  }

  private async requireRunnableProject(projectId: string) {
    const overview = await this.repository.findProjectOverviewById(projectId);

    if (!overview || overview.project.status !== "active") {
      throw new Error("Active project not found.");
    }

    return overview;
  }

  private async resolveRuntimePort(overview: ProjectOverview) {
    const currentPort = overview.runtime?.port ?? overview.project.previewPort;

    if (await isPortAvailable(currentPort)) {
      return currentPort;
    }

    const usedPorts = (await this.repository.listAllocatedPreviewPorts()).filter((port) => port !== currentPort);

    return findAvailablePreviewPort(usedPorts, this.previewPortRange);
  }
}

export function runtimeStatusLabel(runtime: Runtime | null) {
  return runtime?.status ?? "stopped";
}