import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assistantMessageIdForRun, serializeAssistantMessageMetadata, toBuilderChatMessages } from "@/lib/chat/messages";
import type { Message, Runtime, Run } from "@/lib/db/schema";
import {
  createGitCommitPlan,
  createInterruptedRunPatch,
  createProjectSourceSnapshot,
  persistGitCommitRecord,
  persistProjectSnapshotRecord,
  reconcileRuntimeRecord,
  reconcileInterruptedRuns,
  restoreProjectSnapshot,
  selectSnapshotsForRetention,
} from "@/lib/project-recovery/recovery";

describe("E14 persistence and recovery", () => {
  it("hydrates persisted conversation messages with structured activity parts", () => {
    const messages = [
      { id: "user-1", role: "user", content: "Build a dashboard", metadataJson: null },
      {
        id: assistantMessageIdForRun("run-1"),
        role: "assistant",
        content: "Done",
        metadataJson: serializeAssistantMessageMetadata({
          runId: "run-1",
          hermesRunId: "hermes-1",
          activities: [{ kind: "file-change", title: "Edited app/page.tsx", detail: "app/page.tsx" }],
        }),
      },
    ] satisfies Pick<Message, "id" | "role" | "content" | "metadataJson">[];

    expect(toBuilderChatMessages(messages)).toMatchObject([
      { id: "user-1", parts: [{ type: "text", text: "Build a dashboard" }] },
      {
        id: "assistant-run-1",
        parts: [
          { type: "data-hermes-activity", data: { kind: "file-change", title: "Edited app/page.tsx" } },
          { type: "text", text: "Done" },
        ],
      },
    ]);
  });

  it("creates and restores project snapshots while excluding transient directories", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-recovery-"));
    const workspacePath = path.join(tempRoot, "workspace");
    const snapshotsRoot = path.join(tempRoot, "snapshots");

    await fs.mkdir(path.join(workspacePath, "app"), { recursive: true });
    await fs.mkdir(path.join(workspacePath, ".next"), { recursive: true });
    await fs.writeFile(path.join(workspacePath, "app", "page.tsx"), "before");
    await fs.writeFile(path.join(workspacePath, ".next", "trace"), "transient");

    const snapshot = await createProjectSourceSnapshot({ projectId: "project-1", runId: "run-1", workspacePath, snapshotsRoot });

    expect(snapshot.runId).toBe("run-1");
    expect(snapshot.manifest.files).toEqual(["app/page.tsx"]);

    await fs.writeFile(path.join(workspacePath, "app", "page.tsx"), "after");
    await fs.writeFile(path.join(workspacePath, "app", "extra.tsx"), "extra");
    await restoreProjectSnapshot(snapshot, workspacePath);

    await expect(fs.readFile(path.join(workspacePath, "app", "page.tsx"), "utf8")).resolves.toBe("before");
    await expect(fs.access(path.join(workspacePath, "app", "extra.tsx"))).rejects.toThrow();
    await expect(fs.readFile(path.join(workspacePath, ".next", "trace"), "utf8")).resolves.toBe("transient");
  });

  it("reconciles stale runtime records", async () => {
    const runtime = {
      projectId: "project-1",
      port: 3100,
      pid: 123,
      status: "running",
      previewUrl: "http://127.0.0.1:3100",
      logPath: null,
      startedAt: new Date(),
      exitCode: null,
      exitSignal: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Runtime;

    await expect(reconcileRuntimeRecord(runtime, { isPidAlive: async () => true, isPortInUse: async () => true })).resolves.toMatchObject({
      pid: 123,
      status: "running",
    });
    await expect(reconcileRuntimeRecord(runtime, { isPidAlive: async () => false, isPortInUse: async () => false })).resolves.toMatchObject({
      pid: null,
      status: "failed",
      exitSignal: "STALE",
    });
  });

  it("marks active runs interrupted with recovery actions", () => {
    const run = {
      id: "run-1",
      projectId: "project-1",
      conversationId: "conversation-1",
      hermesRunId: null,
      status: "running",
      startedAt: new Date(),
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Run;

    expect(createInterruptedRunPatch(run)).toMatchObject({
      runId: "run-1",
      status: "interrupted",
      recoveryActions: ["validate", "continue", "restore"],
    });
  });

  it("persists interrupted run and snapshot recovery records through repository adapters", async () => {
    const run = {
      id: "run-1",
      projectId: "project-1",
      conversationId: "conversation-1",
      hermesRunId: null,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Run;
    const updatedRuns: Array<Partial<Run>> = [];
    const repository = {
      listActiveRuns: async () => [run],
      updateRun: async (_runId: string, patch: Partial<Run>) => {
        updatedRuns.push(patch);

        return { ...run, ...patch };
      },
      createProjectSnapshot: async (snapshot: unknown) => {
        expect(snapshot).toMatchObject({ projectId: "project-1", runId: "run-1" });
      },
      createGitCommit: async (commit: unknown) => {
        expect(commit).toMatchObject({ projectId: "project-1", runId: "run-1", commitSha: "abc123" });
      },
    };

    await expect(reconcileInterruptedRuns(repository)).resolves.toHaveLength(1);
    expect(updatedRuns[0]).toMatchObject({ status: "interrupted" });
    await persistProjectSnapshotRecord(repository, {
      id: "snapshot-1",
      projectId: "project-1",
      runId: "run-1",
      label: null,
      snapshotPath: "/tmp/snapshot",
      manifest: { projectId: "project-1", runId: "run-1", files: ["app/page.tsx"], createdAt: "2026-01-01T00:00:00.000Z" },
    });
    await persistGitCommitRecord(repository, {
      id: "commit-1",
      projectId: "project-1",
      runId: "run-1",
      commitSha: "abc123",
      plan: createGitCommitPlan({ enabled: true, runId: "run-1", changedFiles: ["app/page.tsx"] })!,
    });
  });

  it("applies snapshot retention and optional Git safety", () => {
    const snapshots = [
      { id: "old", manifest: { createdAt: "2026-01-01T00:00:00.000Z" } },
      { id: "new", manifest: { createdAt: "2026-01-02T00:00:00.000Z" } },
    ] as Parameters<typeof selectSnapshotsForRetention>[0];

    expect(selectSnapshotsForRetention(snapshots, 1)).toEqual(["old"]);
    expect(createGitCommitPlan({ enabled: true, runId: "run-1", changedFiles: ["app/page.tsx"] })).toMatchObject({
      message: "chore(apploop): generated changes for run-1",
      metadata: { runId: "run-1", changedFiles: ["app/page.tsx"] },
    });
    expect(() => createGitCommitPlan({ enabled: true, runId: "run-1", changedFiles: [".env.local"] })).toThrow("secret-bearing");
  });
});