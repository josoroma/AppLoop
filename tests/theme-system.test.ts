import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { projectSettingsInputSchema } from "@/lib/projects/service";
import { applyThemeToWorkspace } from "@/lib/themes/apply";
import {
  BUILT_IN_PROJECT_THEMES,
  createCustomTheme,
  DEFAULT_THEME_ID,
  getProjectTheme,
  REQUIRED_THEME_TOKENS,
} from "@/lib/themes/registry";

describe("E10 shadcn/Luma theme system", () => {
  it("registers explicit built-in Luma themes", () => {
    expect(BUILT_IN_PROJECT_THEMES.map((theme) => theme.id)).toMatchInlineSnapshot(`
      [
        "luma-blue-violet",
        "luma-admin-amber",
        "luma-indigo-emerald",
        "luma-violet-cyan",
        "luma-amber-slate",
        "luma-rose-zinc",
        "luma-teal-blue",
        "luma-orange-stone",
      ]
    `);
    expect(DEFAULT_THEME_ID).toBe("luma-indigo-emerald");
  });

  it("includes the canonical Luma Indigo Emerald token set", () => {
    const theme = getProjectTheme("luma-indigo-emerald")!;

    expect(theme.css).toContain("--primary: oklch(0.488 0.243 264.376);");
    expect(theme.css).toContain("--radius: 0.625rem;");
    expect(theme.css).toContain(".dark {");
    expect(REQUIRED_THEME_TOKENS.every((token) => theme.light[token] && theme.dark[token])).toBe(true);
  });

  it("validates selected theme ids in project settings", () => {
    expect(
      projectSettingsInputSchema.parse({
        projectId: "project-1",
        packageInstallPolicy: "ask",
        validationDepth: "standard",
        autoStartPreview: true,
        defaultRoute: "/dashboard",
        themeId: DEFAULT_THEME_ID,
      }).themeId,
    ).toBe(DEFAULT_THEME_ID);
    expect(() =>
      projectSettingsInputSchema.parse({
        projectId: "project-1",
        packageInstallPolicy: "ask",
        validationDepth: "standard",
        autoStartPreview: true,
        defaultRoute: "/dashboard",
        themeId: "unknown-theme",
      }),
    ).toThrow("Unknown project theme");
  });

  it("rejects unsafe custom theme CSS", () => {
    expect(() => createCustomTheme(":root { --background: red; } .dark { --background: black; }")).toThrow("missing required tokens");
    expect(() => createCustomTheme('@import "https://example.test/theme.css";')).toThrow("imports");
    expect(() => createCustomTheme(":root { --background: red; } body { color: red; }")).toThrow("only include :root and .dark");
  });

  it("applies theme tokens to generated app globals", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-theme-"));
    await fs.mkdir(path.join(workspacePath, "app"));

    await applyThemeToWorkspace(workspacePath, getProjectTheme("luma-teal-blue")!);

    const css = await fs.readFile(path.join(workspacePath, "app", "globals.css"), "utf8");

    expect(css).toContain("--primary: oklch(0.55 0.16 180);");
    expect(css).toContain(".hero-section");
    expect(css).not.toContain("#faf9f5");
  });

  it("overrides theme tokens without removing template-specific CSS", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-theme-preserve-"));
    await fs.mkdir(path.join(workspacePath, "app"));
    await fs.writeFile(
      path.join(workspacePath, "app", "globals.css"),
      `@import "tailwindcss";

:root {
  --primary: old;
}

.dark {
  --primary: old-dark;
}

.admin-shell {
  min-height: 100vh;
}
`,
    );

    await applyThemeToWorkspace(workspacePath, getProjectTheme("luma-admin-amber")!);

    const css = await fs.readFile(path.join(workspacePath, "app", "globals.css"), "utf8");

    expect(css).toContain("--primary: oklch(0.555 0.163 48.998);");
    expect(css).toContain(".admin-shell");
    expect(css).not.toContain("--primary: old;");
  });
});