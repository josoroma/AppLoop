import { describe, expect, it } from "vitest";
import type { ProjectOverview, ProjectRepository, RuntimePatch } from "@/lib/db/repository";
import type { ProjectRuntimeProvider, RuntimeStartRequest } from "@/lib/runtime/provider";
import { RuntimeService } from "@/lib/runtime/service";
import type { RuntimeDescriptor } from "@/lib/runtime/state";

function createRuntimeDescriptor(projectId: string, port: number, status: RuntimeDescriptor["status"] = "running"): RuntimeDescriptor {
  return {
    projectId,
    port,
    pid: status === "running" ? 1234 : null,
    status,
    previewUrl: `http://127.0.0.1:${port}`,
    logPath: null,
    startedAt: new Date(),
    exitCode: status === "failed" ? 1 : null,
    exitSignal: null,
    updatedAt: new Date(),
  };
}

function createRuntimeHarness() {
  const now = new Date();
  let runtime = {
    projectId: "project-1",
    port: 4100,
    pid: null,
    status: "stopped",
    previewUrl: "http://127.0.0.1:4100",
    logPath: null,
    startedAt: null,
    exitCode: null,
    exitSignal: null,
    createdAt: now,
    updatedAt: now,
  } as ProjectOverview["runtime"];
  const overview: ProjectOverview = {
    project: {
      id: "project-1",
      name: "Project",
      slug: "project",
      workspacePath: "/tmp/project",
      hermesSessionId: null,
      themeId: "luma-indigo-emerald",
      previewPort: 4100,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    conversation: null,
    runtime,
    theme: null,
    settings: null,
  };
  const repository = {
    findProjectOverviewById: async () => ({ ...overview, runtime }),
    listAllocatedPreviewPorts: async () => [4100],
    updateProjectPreviewPort: async (_projectId: string, port: number) => ({ ...overview.project, previewPort: port }),
    updateRuntime: async (projectId: string, patch: RuntimePatch) => {
      runtime = { ...runtime!, ...patch, projectId, updatedAt: new Date() };
      return runtime!;
    },
  } as unknown as ProjectRepository;
  const starts: RuntimeStartRequest[] = [];
  const stops: string[] = [];
  const provider = {
    start: async (request: RuntimeStartRequest) => {
      starts.push(request);
      return createRuntimeDescriptor(request.projectId, request.port);
    },
    stop: async (projectId: string) => {
      stops.push(projectId);
      return createRuntimeDescriptor(projectId, runtime?.port ?? 4100, "stopped");
    },
    restart: async (request: RuntimeStartRequest) => createRuntimeDescriptor(request.projectId, request.port),
    status: async () => null,
    logs: async () => [],
  } satisfies ProjectRuntimeProvider;

  return { repository, provider, starts, stops, get runtime() { return runtime; } };
}

describe("E17 runtime lifecycle integration", () => {
  it("starts, stops, restarts, and records crash state for fixture runtimes", async () => {
    const harness = createRuntimeHarness();
    const service = new RuntimeService(harness.repository, harness.provider, 5000, { start: 4100, end: 4102 });

    await expect(service.startProject("project-1")).resolves.toMatchObject({ status: "running", previewUrl: "http://127.0.0.1:4100" });
    expect(harness.starts).toHaveLength(1);

    await expect(service.stopProject("project-1")).resolves.toMatchObject({ status: "stopped", pid: null });
    expect(harness.stops).toEqual(["project-1"]);

    await service.restartProject("project-1");
    expect(harness.starts).toHaveLength(2);

    await service.markProjectRuntimeFailed("project-1", 1, null);
    expect(harness.runtime).toMatchObject({ status: "failed", exitCode: 1 });
  });
});