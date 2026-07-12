import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { appendRuntimeLog, clearRuntimeLogs, getRuntimeLogs } from "@/lib/runtime/logs";
import type { ProjectRuntimeProvider, RuntimeExitEvent, RuntimeStartRequest } from "@/lib/runtime/provider";
import type { RuntimeDescriptor } from "@/lib/runtime/state";
import { mapExitToRuntimeStatus } from "@/lib/runtime/state";
import { assertProjectCommandAllowed, createAllowedCommandEnvironment } from "@/lib/security/commands";

type PackageManager = "npm" | "pnpm";

type TrackedProcess = {
  process: ChildProcessWithoutNullStreams;
  descriptor: RuntimeDescriptor;
  expectedExit: boolean;
};

type NextDevLock = {
  pid: number;
  port?: number;
  appUrl?: string;
};

const execFileAsync = promisify(execFile);

export class LocalProcessRuntimeProvider implements ProjectRuntimeProvider {
  private readonly processes = new Map<string, TrackedProcess>();

  constructor(private readonly onUnexpectedExit?: (event: RuntimeExitEvent) => void | Promise<void>) {}

  async start(request: RuntimeStartRequest) {
    const existingProcess = this.processes.get(request.projectId);

    if (existingProcess && !existingProcess.process.killed && existingProcess.descriptor.status === "running") {
      return existingProcess.descriptor;
    }

    if (existingProcess && !existingProcess.process.killed) {
      existingProcess.expectedExit = true;
      terminateProcessTree(existingProcess.process);
      await waitForProcessExit(existingProcess.process, 5000);
      this.processes.delete(request.projectId);
    }

    clearRuntimeLogs(request.projectId);
    await assertGeneratedProjectWorkspace(request.workspacePath);
    await terminateWorkspaceNextDevServer(request.projectId, request.workspacePath);
    const logPath = getRuntimeLogPath(request.projectId);
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, "");

    const packageManager = await detectPackageManager(request.workspacePath);
    const command = createRuntimeCommand(packageManager, request.port);
    assertProjectCommandAllowed(command.bin, command.args);
    appendRuntimeLog(request.projectId, "lifecycle", `Starting ${command.bin} ${command.args.join(" ")}`);

    const childProcess = spawn(command.bin, command.args, {
      cwd: request.workspacePath,
      detached: process.platform !== "win32",
      env: {
        ...createAllowedCommandEnvironment(),
        HOSTNAME: "127.0.0.1",
        PORT: String(request.port),
      },
      stdio: "pipe",
    });

    const descriptor: RuntimeDescriptor = {
      projectId: request.projectId,
      port: request.port,
      status: "starting",
      pid: childProcess.pid ?? null,
      previewUrl: `http://127.0.0.1:${request.port}`,
      logPath,
      startedAt: new Date(),
      exitCode: null,
      exitSignal: null,
      updatedAt: new Date(),
    };

    const trackedProcess: TrackedProcess = { process: childProcess, descriptor, expectedExit: false };
    this.processes.set(request.projectId, trackedProcess);

    childProcess.stdout.on("data", (chunk: Buffer) => {
      this.captureLog(request.projectId, logPath, "stdout", chunk);
    });
    childProcess.stderr.on("data", (chunk: Buffer) => {
      this.captureLog(request.projectId, logPath, "stderr", chunk);
    });
    childProcess.once("exit", (exitCode, exitSignal) => {
      const status = mapExitToRuntimeStatus(trackedProcess.expectedExit);
      appendRuntimeLog(request.projectId, "lifecycle", `Runtime ${status} with code ${exitCode ?? "null"}.`);
      this.processes.delete(request.projectId);

      if (!trackedProcess.expectedExit) {
        void this.onUnexpectedExit?.({ projectId: request.projectId, exitCode, exitSignal });
      }
    });

    const ready = await waitForRuntimeReady(descriptor.previewUrl, request.timeoutMs);
    descriptor.status = ready ? "running" : "failed";
    descriptor.updatedAt = new Date();

    if (!ready) {
      appendRuntimeLog(request.projectId, "lifecycle", `Runtime did not become ready within ${request.timeoutMs}ms.`);
    }

    return descriptor;
  }

  async stop(projectId: string) {
    const trackedProcess = this.processes.get(projectId);

    if (!trackedProcess) {
      return createStoppedDescriptor(projectId);
    }

    trackedProcess.expectedExit = true;
    terminateProcessTree(trackedProcess.process);
    await waitForProcessExit(trackedProcess.process, 5000);
    this.processes.delete(projectId);

    const stoppedDescriptor: RuntimeDescriptor = {
      ...trackedProcess.descriptor,
      status: "stopped",
      pid: null,
      exitCode: null,
      exitSignal: null,
      updatedAt: new Date(),
    };

    return stoppedDescriptor;
  }

  async restart(request: RuntimeStartRequest) {
    await this.stop(request.projectId);
    return this.start(request);
  }

  async status(projectId: string) {
    return this.processes.get(projectId)?.descriptor ?? null;
  }

  async logs(projectId: string) {
    return getRuntimeLogs(projectId);
  }

  private captureLog(projectId: string, logPath: string, stream: "stdout" | "stderr", chunk: Buffer) {
    const message = chunk.toString("utf8");
    appendRuntimeLog(projectId, stream, message);
    void fs.appendFile(logPath, message);
  }
}

export function createRuntimeCommand(packageManager: PackageManager, port: number) {
  if (packageManager === "pnpm") {
    return {
      bin: "pnpm",
      args: ["dev", "--hostname", "127.0.0.1", "--port", String(port)],
    };
  }

  return {
    bin: "npm",
    args: ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  };
}

async function detectPackageManager(workspacePath: string): Promise<PackageManager> {
  if (await pathExists(path.join(workspacePath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  return "npm";
}

async function assertGeneratedProjectWorkspace(workspacePath: string) {
  if (!(await pathExists(path.join(workspacePath, "package.json")))) {
    throw new Error("Generated project workspace is missing package.json.");
  }
}

async function terminateWorkspaceNextDevServer(projectId: string, workspacePath: string) {
  const lockPath = path.join(workspacePath, ".next", "dev", "lock");
  const lock = await readNextDevLock(lockPath);

  if (!lock) {
    return;
  }

  if (!(await isProcessRunning(lock.pid))) {
    await removeFile(lockPath);
    return;
  }

  if (!(await isLikelyNextDevProcess(lock.pid))) {
    appendRuntimeLog(projectId, "lifecycle", `Ignored Next dev lock for unrelated pid ${lock.pid}.`);
    return;
  }

  appendRuntimeLog(projectId, "lifecycle", `Stopping stale Next dev server pid ${lock.pid}${lock.port ? ` on port ${lock.port}` : ""}.`);
  await terminatePid(lock.pid, 5000);
  await removeFile(lockPath);
}

async function readNextDevLock(lockPath: string): Promise<NextDevLock | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(lockPath, "utf8")) as Partial<NextDevLock>;

    if (typeof parsed.pid === "number" && Number.isInteger(parsed.pid) && parsed.pid > 0) {
      return {
        pid: parsed.pid,
        port: typeof parsed.port === "number" ? parsed.port : undefined,
        appUrl: typeof parsed.appUrl === "string" ? parsed.appUrl : undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function isLikelyNextDevProcess(pid: number) {
  if (process.platform === "win32") {
    return true;
  }

  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    return /next-server|next\s+dev|next\/dist\/bin\/next/.test(stdout);
  } catch {
    return false;
  }
}

async function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminatePid(pid: number, timeoutMs: number) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  await waitForPidExit(pid, timeoutMs);

  if (await isProcessRunning(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return;
    }

    await waitForPidExit(pid, 1000);
  }
}

async function waitForPidExit(pid: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isProcessRunning(pid))) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function removeFile(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    return;
  }
}

async function waitForRuntimeReady(previewUrl: string | null, timeoutMs: number) {
  if (!previewUrl) {
    return false;
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(previewUrl, { cache: "no-store" });

      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return false;
}

function terminateProcessTree(childProcess: ChildProcessWithoutNullStreams) {
  if (!childProcess.pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      childProcess.kill("SIGTERM");
    } else {
      process.kill(-childProcess.pid, "SIGTERM");
    }
  } catch {
    childProcess.kill("SIGTERM");
  }
}

function waitForProcessExit(childProcess: ChildProcessWithoutNullStreams, timeoutMs: number) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      childProcess.kill("SIGKILL");
      resolve();
    }, timeoutMs);

    childProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function createStoppedDescriptor(projectId: string): RuntimeDescriptor {
  return {
    projectId,
    port: 0,
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

function getRuntimeLogPath(projectId: string) {
  return path.join(process.cwd(), ".apploop", "runtime-logs", `${projectId}.log`);
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}