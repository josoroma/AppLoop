import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createValidationCommands,
  detectPreviewSmokeFailure,
  parseLintDiagnostics,
  parseTypeScriptDiagnostics,
  validateGeneratedProject,
  type ValidationCommandRunner,
} from "@/lib/project-validation/validation";

describe("E13 validation and repair loop", () => {
  it("builds validation commands for changed generated files", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-validation-"));
    await fs.writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ scripts: { typecheck: "tsc --noEmit", lint: "eslint" } }));

    await expect(createValidationCommands(workspacePath, "standard", ["app/page.tsx", "README.md"])).resolves.toEqual([
      { check: "format", bin: "npm", args: ["exec", "--", "prettier", "--write", "app/page.tsx", "README.md"], cwd: workspacePath },
      { check: "typecheck", bin: "npm", args: ["run", "typecheck"], cwd: workspacePath },
      { check: "lint", bin: "npm", args: ["run", "lint"], cwd: workspacePath },
    ]);

    await expect(createValidationCommands(workspacePath, "quick", ["app/page.tsx"])).resolves.toEqual([
      { check: "typecheck", bin: "npm", args: ["run", "typecheck"], cwd: workspacePath },
    ]);
  });

  it("parses TypeScript and lint diagnostics", () => {
    expect(parseTypeScriptDiagnostics("app/page.tsx(4,12): error TS2322: Type 'number' is not assignable to type 'string'.")).toEqual([
      {
        check: "typecheck",
        filePath: "app/page.tsx",
        line: 4,
        column: 12,
        code: "TS2322",
        message: "Type 'number' is not assignable to type 'string'.",
        severity: "error",
      },
    ]);

    expect(parseLintDiagnostics("  7:5  warning  Unexpected console statement  no-console")).toEqual([
      {
        check: "lint",
        line: 7,
        column: 5,
        code: "no-console",
        message: "Unexpected console statement",
        severity: "warning",
      },
    ]);
  });

  it("streams command events and reports preview readiness", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-validation-pass-"));
    await fs.writeFile(path.join(workspacePath, "package.json"), "{}");
    const commandRunner: ValidationCommandRunner = async (command) => ({ command, exitCode: 0, stdout: "ok", stderr: "" });

    const summary = await validateGeneratedProject({
      workspacePath,
      validationDepth: "standard",
      changedFiles: ["app/page.tsx"],
      targetRoute: "/dashboard",
      previewUrl: "http://127.0.0.1:3100",
      commandRunner,
      fetcher: async () => ({ status: 200, html: '<html><body><main data-builder-id="dashboard-page">Ready</main></body></html>' }),
    });

    expect(summary.status).toBe("passed");
    expect(summary.previewReadyRoute).toBe("/dashboard");
    expect(summary.events.map((event) => event.type)).toContain("preview-ready");
  });

  it("detects failed checks and queues bounded repair attempts", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-validation-fail-"));
    await fs.mkdir(path.join(workspacePath, "app"));
    await fs.writeFile(path.join(workspacePath, "package.json"), "{}");
    await fs.writeFile(path.join(workspacePath, "app", "page.tsx"), "export default function Page() { return null }\n");
    let typecheckRuns = 0;
    const commandRunner: ValidationCommandRunner = async (command) => {
      typecheckRuns += command.check === "typecheck" ? 1 : 0;

      return command.check === "typecheck" && typecheckRuns === 1
        ? { command, exitCode: 1, stdout: "app/page.tsx(1,1): error TS1005: ';' expected.", stderr: "" }
        : { command, exitCode: 0, stdout: "", stderr: "" };
    };

    const summary = await validateGeneratedProject({
      workspacePath,
      validationDepth: "quick",
      commandRunner,
      repairStrategy: async () => ({
        description: "Restore valid page export",
        changes: [{ relativePath: "app/page.tsx", description: "Repair page", content: "export default function Page() { return <main /> }\n" }],
      }),
    });

    expect(summary.status).toBe("passed");
    expect(summary.checks[0]).toMatchObject({ check: "typecheck", status: "passed", detail: "Repair applied: Restore valid page export" });
    expect(summary.events.map((event) => event.type)).toContain("repair-started");
  });

  it("detects runtime and blank preview failures", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-validation-runtime-"));
    await fs.writeFile(path.join(workspacePath, "package.json"), "{}");
    const commandRunner: ValidationCommandRunner = async (command) => ({ command, exitCode: 0, stdout: "", stderr: "" });

    const summary = await validateGeneratedProject({
      workspacePath,
      validationDepth: "standard",
      previewUrl: "http://127.0.0.1:3100",
      targetRoute: "/missing",
      commandRunner,
      fetcher: async () => ({ status: 500, html: "server exploded" }),
    });

    expect(summary.status).toBe("failed");
    expect(summary.previewReadyRoute).toBeNull();
    expect(summary.checks.at(-1)?.diagnostics[0].message).toBe("Route /missing returned HTTP 500.");
    expect(detectPreviewSmokeFailure("<html><body></body></html>")).toMatchObject({ message: "Preview body is blank." });
    expect(detectPreviewSmokeFailure("<html><body><nextjs-portal></nextjs-portal></body></html>")).toMatchObject({ message: "Preview contains a Next.js error overlay." });
  });
});