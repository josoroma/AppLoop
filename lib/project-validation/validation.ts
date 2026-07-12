import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectSettings } from "@/lib/db/schema";
import { applyProjectFileChanges, type ProjectFileChange } from "@/lib/project-files/operations";
import { assertProjectCommandAllowed, createAllowedCommandEnvironment, resolveCommandTimeout } from "@/lib/security/commands";
import { assertInsideRoot } from "@/lib/security/paths";

export type ValidationCheck = "format" | "typecheck" | "lint" | "runtime" | "visual-smoke";
export type ValidationStatus = "passed" | "failed" | "skipped";

export type ValidationCommand = {
  check: ValidationCheck;
  bin: string;
  args: string[];
  cwd: string;
};

export type ValidationCommandResult = {
  command: ValidationCommand;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ValidationStatusEvent = {
  type: "command-started" | "command-passed" | "command-failed" | "repair-started" | "repair-exhausted" | "preview-ready";
  check: ValidationCheck;
  command?: string;
  route?: string;
  attempt?: number;
  detail?: string;
};

export type ValidationDiagnostic = {
  check: ValidationCheck;
  filePath?: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationCheckResult = {
  check: ValidationCheck;
  status: ValidationStatus;
  command?: string;
  validationCommand?: ValidationCommand;
  diagnostics: ValidationDiagnostic[];
  detail?: string;
};

export type ValidationSummary = {
  status: ValidationStatus;
  checks: ValidationCheckResult[];
  events: ValidationStatusEvent[];
  previewReadyRoute: string | null;
};

export type ValidationCommandRunner = (command: ValidationCommand) => Promise<ValidationCommandResult>;

export type RuntimeHealthFetcher = (url: string) => Promise<{ status: number; html: string }>;

export type RepairAttempt = {
  description: string;
  changes: ProjectFileChange[];
};

export type RepairStrategy = (failure: ValidationCheckResult, attempt: number) => Promise<RepairAttempt | null>;

export type GeneratedProjectValidationInput = {
  workspacePath: string;
  validationDepth: ProjectSettings["validationDepth"];
  changedFiles?: string[];
  targetRoute?: string;
  previewUrl?: string;
  maxRepairAttempts?: number;
  commandRunner?: ValidationCommandRunner;
  fetcher?: RuntimeHealthFetcher;
  repairStrategy?: RepairStrategy;
};

const DEFAULT_MAX_REPAIR_ATTEMPTS = 3;
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".json", ".md", ".mjs"]);

export async function validateGeneratedProject(input: GeneratedProjectValidationInput): Promise<ValidationSummary> {
  const workspacePath = assertInsideRoot(input.workspacePath, input.workspacePath);
  const commandRunner = input.commandRunner ?? runValidationCommand;
  const fetcher = input.fetcher ?? fetchRuntimeHealth;
  const targetRoute = normalizeRoute(input.targetRoute ?? "/");
  const events: ValidationStatusEvent[] = [];
  const checks: ValidationCheckResult[] = [];
  const commands = await createValidationCommands(workspacePath, input.validationDepth, input.changedFiles ?? []);

  for (const command of commands) {
    const result = await runCommandCheck(command, commandRunner, events);
    const repairedResult = result.status === "failed" ? await repairFailedCheck(workspacePath, result, commandRunner, input.repairStrategy, input.maxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS, events) : result;

    checks.push(repairedResult);
  }

  if (input.previewUrl) {
    const runtimeResult = await checkRuntimeRoute(input.previewUrl, targetRoute, fetcher, events);

    checks.push(runtimeResult);

    if (runtimeResult.status === "passed" && input.validationDepth !== "quick") {
      checks.push(await checkVisualSmoke(input.previewUrl, targetRoute, fetcher));
    }
  }

  return {
    status: checks.every((check) => check.status === "passed" || check.status === "skipped") ? "passed" : "failed",
    checks,
    events,
    previewReadyRoute: checks.some((check) => check.check === "runtime" && check.status === "passed") ? targetRoute : null,
  };
}

export async function createValidationCommands(workspacePath: string, validationDepth: ProjectSettings["validationDepth"], changedFiles: string[] = []) {
  const packageManager = await detectPackageManager(workspacePath);
  const commands: ValidationCommand[] = [];
  const formattableFiles = changedFiles.filter((filePath) => SOURCE_FILE_EXTENSIONS.has(path.extname(filePath))).map((filePath) => assertWorkspaceRelativeFile(workspacePath, filePath));

  if (formattableFiles.length > 0 && validationDepth !== "quick") {
    commands.push({ check: "format", bin: packageManager, args: createPackageManagerArgs(packageManager, "exec", ["prettier", "--write", ...formattableFiles]), cwd: workspacePath });
  }

  commands.push({ check: "typecheck", bin: packageManager, args: createPackageManagerArgs(packageManager, "run", ["typecheck"]), cwd: workspacePath });

  if (validationDepth !== "quick") {
    commands.push({ check: "lint", bin: packageManager, args: createPackageManagerArgs(packageManager, "run", ["lint"]), cwd: workspacePath });
  }

  return commands;
}

export function parseTypeScriptDiagnostics(output: string): ValidationDiagnostic[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      check: "typecheck",
      filePath: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4],
      message: match[5],
      severity: "error",
    }));
}

export function parseLintDiagnostics(output: string): ValidationDiagnostic[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.*?)\s{2,}(\S+)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      check: "lint",
      line: Number(match[1]),
      column: Number(match[2]),
      code: match[5],
      message: match[4].trim(),
      severity: match[3] as "error" | "warning",
    }));
}

export function detectPreviewSmokeFailure(html: string): ValidationDiagnostic | null {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;

  if (/nextjs-portal|__nextjs_error__|Build Error|Runtime Error/i.test(html)) {
    return { check: "visual-smoke", message: "Preview contains a Next.js error overlay.", severity: "error" };
  }

  if (body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim().length === 0) {
    return { check: "visual-smoke", message: "Preview body is blank.", severity: "error" };
  }

  if (!/data-builder-id=|class="[^"]*(app-shell|page-shell)|<main\b/i.test(html)) {
    return { check: "visual-smoke", message: "Preview has no visible application root.", severity: "error" };
  }

  return null;
}

async function runCommandCheck(command: ValidationCommand, commandRunner: ValidationCommandRunner, events: ValidationStatusEvent[]): Promise<ValidationCheckResult> {
  const commandText = stringifyCommand(command);

  events.push({ type: "command-started", check: command.check, command: commandText });

  const result = await commandRunner(command);
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const diagnostics = command.check === "typecheck" ? parseTypeScriptDiagnostics(output) : command.check === "lint" ? parseLintDiagnostics(output) : [];

  if (result.exitCode === 0) {
    events.push({ type: "command-passed", check: command.check, command: commandText });

    return { check: command.check, status: "passed", command: commandText, validationCommand: command, diagnostics };
  }

  events.push({ type: "command-failed", check: command.check, command: commandText, detail: output.slice(0, 1000) });

  return {
    check: command.check,
    status: "failed",
    command: commandText,
    validationCommand: command,
    diagnostics: diagnostics.length > 0 ? diagnostics : [{ check: command.check, message: output || `${commandText} failed.`, severity: "error" }],
  };
}

async function repairFailedCheck(
  workspacePath: string,
  failure: ValidationCheckResult,
  commandRunner: ValidationCommandRunner,
  repairStrategy: RepairStrategy | undefined,
  maxRepairAttempts: number,
  events: ValidationStatusEvent[],
) : Promise<ValidationCheckResult> {
  if (!repairStrategy || maxRepairAttempts <= 0 || !failure.validationCommand) {
    return failure;
  }

  let currentFailure = failure;

  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    events.push({ type: "repair-started", check: currentFailure.check, attempt });
    const repair = await repairStrategy(currentFailure, attempt);

    if (!repair) {
      break;
    }

    await applyProjectFileChanges(workspacePath, repair.changes);
    const repairedResult = await runCommandCheck(failure.validationCommand, commandRunner, events);

    if (repairedResult.status === "passed") {
      return { ...repairedResult, detail: `Repair applied: ${repair.description}` };
    }

    currentFailure = repairedResult;
  }

  events.push({ type: "repair-exhausted", check: currentFailure.check, attempt: maxRepairAttempts });

  return currentFailure;
}

async function checkRuntimeRoute(previewUrl: string, route: string, fetcher: RuntimeHealthFetcher, events: ValidationStatusEvent[]): Promise<ValidationCheckResult> {
  const targetUrl = new URL(route, previewUrl).toString();
  const response = await fetcher(targetUrl);

  if (response.status >= 200 && response.status < 500) {
    events.push({ type: "preview-ready", check: "runtime", route });

    return { check: "runtime", status: "passed", diagnostics: [], detail: `Route ${route} responded with ${response.status}.` };
  }

  return {
    check: "runtime",
    status: "failed",
    diagnostics: [{ check: "runtime", message: `Route ${route} returned HTTP ${response.status}.`, severity: "error" }],
    detail: response.html.slice(0, 1000),
  };
}

async function checkVisualSmoke(previewUrl: string, route: string, fetcher: RuntimeHealthFetcher): Promise<ValidationCheckResult> {
  const response = await fetcher(new URL(route, previewUrl).toString());
  const failure = detectPreviewSmokeFailure(response.html);

  return failure ? { check: "visual-smoke", status: "failed", diagnostics: [failure] } : { check: "visual-smoke", status: "passed", diagnostics: [] };
}

export function runValidationCommand(command: ValidationCommand): Promise<ValidationCommandResult> {
  return new Promise((resolve) => {
    assertProjectCommandAllowed(command.bin, command.args);
    const childProcess = spawn(command.bin, command.args, { cwd: command.cwd, env: createAllowedCommandEnvironment(), stdio: "pipe" });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      childProcess.kill("SIGTERM");
      resolve({ command, exitCode: 124, stdout: Buffer.concat(stdout).toString("utf8"), stderr: "Command timed out." });
    }, resolveCommandTimeout(undefined));

    childProcess.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    childProcess.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    childProcess.once("exit", (exitCode) => {
      clearTimeout(timeout);
      resolve({
        command,
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    childProcess.once("error", (error) => {
      clearTimeout(timeout);
      resolve({ command, exitCode: 1, stdout: "", stderr: error.message });
    });
  });
}

async function fetchRuntimeHealth(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  return { status: response.status, html: await response.text() };
}

async function detectPackageManager(workspacePath: string) {
  try {
    await fs.access(path.join(workspacePath, "pnpm-lock.yaml"));
    return "pnpm";
  } catch {
    return "npm";
  }
}

function createPackageManagerArgs(packageManager: "npm" | "pnpm", mode: "run" | "exec", args: string[]) {
  if (packageManager === "pnpm") {
    return mode === "run" ? args : ["exec", ...args];
  }

  return mode === "run" ? ["run", ...args] : ["exec", "--", ...args];
}

function assertWorkspaceRelativeFile(workspacePath: string, relativePath: string) {
  if (path.isAbsolute(relativePath)) {
    throw new Error("Changed files must be workspace-relative.");
  }

  assertInsideRoot(workspacePath, path.join(workspacePath, relativePath));

  return relativePath;
}

function normalizeRoute(route: string) {
  const normalized = route.startsWith("/") ? route : `/${route}`;

  return normalized.replace(/\/+$/, "") || "/";
}

function stringifyCommand(command: ValidationCommand) {
  return [command.bin, ...command.args].join(" ");
}