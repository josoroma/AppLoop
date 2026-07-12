import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getServerEnv } from "@/lib/env/server";
import { PREVIEW_CSP_STRATEGY, PREVIEW_IFRAME_SANDBOX } from "@/lib/preview/browser";
import { assertProjectCommandAllowed, createAllowedCommandEnvironment, reviewProjectCommand } from "@/lib/security/commands";
import { ProjectAccessError, requireProjectAccess } from "@/lib/security/authorization";
import { assertInsideRoot, assertRealPathInsideRoot } from "@/lib/security/paths";
import { scanTextForSecrets, scanWorkspaceForSecrets } from "@/lib/security/secrets";
import { createCustomTheme } from "@/lib/themes/registry";

function minimalThemeCss(extra = "") {
  const tokens = [
    "--background: oklch(1 0 0)",
    "--foreground: oklch(0.145 0 0)",
    "--card: oklch(1 0 0)",
    "--card-foreground: oklch(0.145 0 0)",
    "--popover: oklch(1 0 0)",
    "--popover-foreground: oklch(0.145 0 0)",
    "--primary: oklch(0.488 0.243 264.376)",
    "--primary-foreground: oklch(0.97 0.014 254.604)",
    "--secondary: oklch(0.967 0.001 286.375)",
    "--secondary-foreground: oklch(0.21 0.006 285.885)",
    "--muted: oklch(0.97 0 0)",
    "--muted-foreground: oklch(0.556 0 0)",
    "--accent: oklch(0.97 0 0)",
    "--accent-foreground: oklch(0.205 0 0)",
    "--destructive: oklch(0.577 0.245 27.325)",
    "--border: oklch(0.922 0 0)",
    "--input: oklch(0.922 0 0)",
    "--ring: oklch(0.708 0 0)",
    "--chart-1: oklch(0.845 0.143 164.978)",
    "--chart-2: oklch(0.696 0.17 162.48)",
    "--chart-3: oklch(0.596 0.145 163.225)",
    "--chart-4: oklch(0.508 0.118 165.612)",
    "--chart-5: oklch(0.432 0.095 166.913)",
    "--radius: 0.625rem",
    "--sidebar: oklch(0.985 0 0)",
    "--sidebar-foreground: oklch(0.145 0 0)",
    "--sidebar-primary: oklch(0.546 0.245 262.881)",
    "--sidebar-primary-foreground: oklch(0.97 0.014 254.604)",
    "--sidebar-accent: oklch(0.97 0 0)",
    "--sidebar-accent-foreground: oklch(0.205 0 0)",
    "--sidebar-border: oklch(0.922 0 0)",
    "--sidebar-ring: oklch(0.708 0 0)",
  ];

  return `:root { ${tokens.join("; ")}; ${extra} } .dark { ${tokens.join("; ")}; }`;
}

describe("E15 security and isolation", () => {
  it("blocks public Hermes environment variables and scans secrets", async () => {
    expect(() => getServerEnv({ NODE_ENV: "test", NEXT_PUBLIC_HERMES_API_KEY: "leak" })).toThrow("NEXT_PUBLIC_HERMES_API_KEY");
    expect(scanTextForSecrets("app/page.tsx", "const key = 'HERMES_API_KEY=secret'")).toEqual([
      { relativePath: "app/page.tsx", pattern: "hermes-api-key" },
    ]);

    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-security-"));
    await fs.mkdir(path.join(workspacePath, "app"));
    await fs.writeFile(path.join(workspacePath, "app", "page.tsx"), "Authorization: Bearer abc123");

    await expect(scanWorkspaceForSecrets(workspacePath)).resolves.toEqual([{ relativePath: "app/page.tsx", pattern: "bearer-token" }]);
  });

  it("enforces containment after normalization and realpath resolution", async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-root-"));
    const outsidePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-outside-"));
    const symlinkPath = path.join(rootPath, "escape");

    await fs.symlink(outsidePath, symlinkPath);

    expect(() => assertInsideRoot(rootPath, path.join(rootPath, "..", "other"))).toThrow("projects root");
    expect(() => assertInsideRoot(rootPath, "/dev/null")).toThrow("Special filesystem");
    await expect(assertRealPathInsideRoot(rootPath, symlinkPath)).rejects.toThrow("Resolved target path");
  });

  it("reviews dangerous commands and strips command environments", () => {
    expect(reviewProjectCommand("npm", ["run", "lint"])).toMatchObject({ allowed: true });
    expect(() => assertProjectCommandAllowed("rm", ["-rf", "/"])).toThrow("denied pattern");
    expect(createAllowedCommandEnvironment({ PATH: "/bin", HERMES_API_KEY: "secret", NODE_ENV: "test" })).toEqual({ PATH: "/bin", NODE_ENV: "test" });
  });

  it("documents iframe and preview origin isolation policy", () => {
    expect(PREVIEW_IFRAME_SANDBOX).toContain("allow-scripts");
    expect(PREVIEW_IFRAME_SANDBOX).not.toContain("allow-top-navigation");
    expect(PREVIEW_CSP_STRATEGY).toContain("separate origin");
  });

  it("sanitizes custom themes", () => {
    expect(() => createCustomTheme(`${minimalThemeCss()} @import url('https://evil.test/x.css')`)).toThrow("imports");
    expect(() => createCustomTheme(`body { color: red; } ${minimalThemeCss()}`)).toThrow("only include :root and .dark");
    expect(() => createCustomTheme(minimalThemeCss("color: red;"))).toThrow("token declarations");
    expect(createCustomTheme(minimalThemeCss()).id).toBe("custom-project-theme");
  });

  it("requires active project access without disclosing metadata", async () => {
    const repository = {
      findProjectOverviewById: async () => null,
    };

    await expect(requireProjectAccess(repository, "missing")).rejects.toEqual(new ProjectAccessError("Project access denied."));
  });
});