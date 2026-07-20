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
        "luma-cv-indigo",
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

  it("accepts editable custom theme CSS with comments and markdown fences", () => {
    const baseTheme = getProjectTheme("luma-indigo-emerald")!;
    const theme = createCustomTheme(`
      \`\`\`css
      /* User note: keep these defaults unless you want to change the palette. */
      ${baseTheme.css}
      \`\`\`
    `);

    expect(theme.light["--primary"]).toBe("oklch(0.488 0.243 264.376)");
    expect(theme.dark["--primary"]).toBe("oklch(0.424 0.199 265.638)");
  });

  it("ignores legacy shadcn tokens that AppLoop does not consume", () => {
    const baseTheme = getProjectTheme("luma-indigo-emerald")!;
    const theme = createCustomTheme(
      baseTheme.css.replace(
        "--destructive: oklch(0.577 0.245 27.325);",
        "--destructive: oklch(0.577 0.245 27.325);\n  --destructive-foreground: oklch(0.985 0 0);",
      ),
    );

    expect(theme.light["--destructive"]).toBe("oklch(0.577 0.245 27.325)");
    expect(theme.light["--destructive-foreground"]).toBeUndefined();
  });

  it("fills missing dark-mode tokens from the light token block", () => {
    const baseTheme = getProjectTheme("luma-indigo-emerald")!;
    const radiusDeclaration = "  --radius: 0.625rem;\n";
    const firstRadiusIndex = baseTheme.css.indexOf(radiusDeclaration);
    const secondRadiusIndex = baseTheme.css.indexOf(radiusDeclaration, firstRadiusIndex + 1);
    const cssWithoutDarkRadius = `${baseTheme.css.slice(0, secondRadiusIndex)}${baseTheme.css.slice(secondRadiusIndex + radiusDeclaration.length)}`;
    const theme = createCustomTheme(cssWithoutDarkRadius);

    expect(theme.light["--radius"]).toBe("0.625rem");
    expect(theme.dark["--radius"]).toBe("0.625rem");
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