import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectRepository } from "@/lib/db/repository";
import type { Runtime, Run } from "@/lib/db/schema";
import { assertInsideRoot } from "@/lib/security/paths";

export type ProjectSnapshotManifest = {
  projectId: string;
  runId: string | null;
  files: string[];
  createdAt: string;
};

export type ProjectSnapshotRecord = {
  id: string;
  projectId: string;
  runId: string | null;
  label: string | null;
  snapshotPath: string;
  manifest: ProjectSnapshotManifest;
};

export type RuntimeReconciliationPatch = {
  pid: number | null;
  status: Runtime["status"];
  exitCode: number | null;
  exitSignal: string | null;
};

export type GitCommitPlan = {
  message: string;
  commands: string[][];
  metadata: {
    runId: string;
    changedFiles: string[];
  };
};

export type RecoveryAction = "validate" | "continue" | "restore";

const TRANSIENT_SNAPSHOT_SEGMENTS = new Set([".next", ".turbo", "node_modules", "out", "dist", "logs"]);
const SECRET_FILE_NAMES = new Set([".env", ".env.local", ".env.production", ".npmrc"]);

export async function createProjectSourceSnapshot(input: {
  projectId: string;
  workspacePath: string;
  snapshotsRoot: string;
  runId?: string | null;
  label?: string | null;
}) {
  const snapshotId = randomUUID();
  const snapshotPath = assertInsideRoot(input.snapshotsRoot, path.join(input.snapshotsRoot, input.projectId, snapshotId));
  const sourcePath = path.join(snapshotPath, "source");
  const files = await listSnapshotFiles(input.workspacePath);

  await fs.mkdir(sourcePath, { recursive: true });

  for (const relativePath of files) {
    const sourceFile = assertInsideRoot(input.workspacePath, path.join(input.workspacePath, relativePath));
    const destinationFile = path.join(sourcePath, relativePath);

    await fs.mkdir(path.dirname(destinationFile), { recursive: true });
    await fs.copyFile(sourceFile, destinationFile);
  }

  const manifest: ProjectSnapshotManifest = {
    projectId: input.projectId,
    runId: input.runId ?? null,
    files,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(snapshotPath, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return {
    id: snapshotId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    label: input.label ?? null,
    snapshotPath,
    manifest,
  } satisfies ProjectSnapshotRecord;
}

export async function restoreProjectSnapshot(snapshot: ProjectSnapshotRecord, workspacePath: string) {
  const sourcePath = path.join(snapshot.snapshotPath, "source");

  await removeRestorableWorkspaceEntries(workspacePath);

  for (const relativePath of snapshot.manifest.files) {
    const sourceFile = assertInsideRoot(sourcePath, path.join(sourcePath, relativePath));
    const destinationFile = assertInsideRoot(workspacePath, path.join(workspacePath, relativePath));

    await fs.mkdir(path.dirname(destinationFile), { recursive: true });
    await fs.copyFile(sourceFile, destinationFile);
  }
}

export function selectSnapshotsForRetention(snapshots: ProjectSnapshotRecord[], retentionLimit: number) {
  if (retentionLimit <= 0) {
    return snapshots.map((snapshot) => snapshot.id);
  }

  return [...snapshots]
    .sort((left, right) => right.manifest.createdAt.localeCompare(left.manifest.createdAt))
    .slice(retentionLimit)
    .map((snapshot) => snapshot.id);
}

export async function reconcileRuntimeRecord(
  runtime: Runtime,
  options: {
    isPidAlive?: (pid: number) => boolean | Promise<boolean>;
    isPortInUse?: (port: number) => boolean | Promise<boolean>;
  } = {},
): Promise<RuntimeReconciliationPatch> {
  if (runtime.status !== "running" && runtime.status !== "starting") {
    return { pid: runtime.pid, status: runtime.status, exitCode: runtime.exitCode, exitSignal: runtime.exitSignal };
  }

  const pidAlive = runtime.pid ? await (options.isPidAlive ?? isProcessAlive)(runtime.pid) : false;
  const portInUse = await (options.isPortInUse ?? defaultPortInUse)(runtime.port);

  if (pidAlive && portInUse) {
    return { pid: runtime.pid, status: "running", exitCode: null, exitSignal: null };
  }

  return { pid: null, status: "failed", exitCode: null, exitSignal: "STALE" };
}

export function createInterruptedRunPatch(run: Run) {
  if (run.status !== "queued" && run.status !== "running") {
    return null;
  }

  return {
    runId: run.id,
    status: "interrupted" as const,
    finishedAt: new Date(),
    recoveryActions: ["validate", "continue", "restore"] satisfies RecoveryAction[],
  };
}

export async function reconcileInterruptedRuns(repository: Pick<ProjectRepository, "listActiveRuns" | "updateRun">) {
  const activeRuns = await repository.listActiveRuns();
  const interruptedRuns = [];

  for (const run of activeRuns) {
    const patch = createInterruptedRunPatch(run);

    if (!patch) {
      continue;
    }

    interruptedRuns.push(await repository.updateRun(patch.runId, { status: patch.status, finishedAt: patch.finishedAt }));
  }

  return interruptedRuns;
}

export async function persistProjectSnapshotRecord(repository: Pick<ProjectRepository, "createProjectSnapshot">, snapshot: ProjectSnapshotRecord) {
  await repository.createProjectSnapshot({
    id: snapshot.id,
    projectId: snapshot.projectId,
    runId: snapshot.runId,
    label: snapshot.label,
    snapshotPath: snapshot.snapshotPath,
    manifestJson: JSON.stringify(snapshot.manifest),
  });
}

export async function persistGitCommitRecord(
  repository: Pick<ProjectRepository, "createGitCommit">,
  input: { id: string; projectId: string; runId: string | null; commitSha: string; plan: GitCommitPlan },
) {
  await repository.createGitCommit({
    id: input.id,
    projectId: input.projectId,
    runId: input.runId,
    commitSha: input.commitSha,
    message: input.plan.message,
    changedFilesJson: JSON.stringify(input.plan.metadata.changedFiles),
  });
}

export function createGitCommitPlan(input: { enabled: boolean; runId: string; changedFiles: string[] }) {
  if (!input.enabled || input.changedFiles.length === 0) {
    return null;
  }

  const secretFile = input.changedFiles.find(isSecretBearingPath);

  if (secretFile) {
    throw new Error(`Refusing to commit secret-bearing file: ${secretFile}`);
  }

  const message = `chore(apploop): generated changes for ${input.runId}`;

  return {
    message,
    commands: [["git", "add", ...input.changedFiles], ["git", "commit", "-m", message, "-m", `AppLoop-Run-Id: ${input.runId}`]],
    metadata: {
      runId: input.runId,
      changedFiles: input.changedFiles,
    },
  } satisfies GitCommitPlan;
}

async function listSnapshotFiles(workspacePath: string, directory = workspacePath): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      const relativePath = path.relative(workspacePath, entryPath);

      if (shouldExcludeSnapshotPath(relativePath)) {
        return [];
      }

      if (entry.isDirectory()) {
        return listSnapshotFiles(workspacePath, entryPath);
      }

      return [relativePath.split(path.sep).join(path.posix.sep)];
    }),
  );

  return files.flat().sort();
}

async function removeRestorableWorkspaceEntries(workspacePath: string) {
  const entries = await fs.readdir(workspacePath, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (TRANSIENT_SNAPSHOT_SEGMENTS.has(entry.name)) {
        return;
      }

      await fs.rm(path.join(workspacePath, entry.name), { force: true, recursive: true });
    }),
  );
}

function shouldExcludeSnapshotPath(relativePath: string) {
  return relativePath.split(path.sep).some((segment) => TRANSIENT_SNAPSHOT_SEGMENTS.has(segment));
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function defaultPortInUse(port: number) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, { cache: "no-store" });

    return response.status < 500;
  } catch {
    return false;
  }
}

function isSecretBearingPath(relativePath: string) {
  return relativePath.split(path.posix.sep).some((segment) => SECRET_FILE_NAMES.has(segment) || segment.endsWith(".pem") || segment.endsWith(".key"));
}