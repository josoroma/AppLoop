import { z } from "zod";

export const DEFAULT_THEME_ID = "luma-indigo-emerald";
export const CUSTOM_THEME_ID = "custom-project-theme";

export const REQUIRED_THEME_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--radius",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

const projectThemeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  preview: z.object({
    primary: z.string().min(1),
    secondary: z.string().min(1),
    accent: z.string().min(1),
    background: z.string().min(1),
  }),
  css: z.string().min(1),
  source: z.enum(["built-in", "custom"]),
  createdAt: z.string().optional(),
  light: z.record(z.string(), z.string()),
  dark: z.record(z.string(), z.string()),
});

export type ProjectTheme = z.infer<typeof projectThemeSchema>;

type ThemeSeed = Omit<ProjectTheme, "css" | "source">;

const canonicalLight = {
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.145 0 0)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.145 0 0)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.145 0 0)",
  "--primary": "oklch(0.488 0.243 264.376)",
  "--primary-foreground": "oklch(0.97 0.014 254.604)",
  "--secondary": "oklch(0.967 0.001 286.375)",
  "--secondary-foreground": "oklch(0.21 0.006 285.885)",
  "--muted": "oklch(0.97 0 0)",
  "--muted-foreground": "oklch(0.556 0 0)",
  "--accent": "oklch(0.97 0 0)",
  "--accent-foreground": "oklch(0.205 0 0)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--border": "oklch(0.922 0 0)",
  "--input": "oklch(0.922 0 0)",
  "--ring": "oklch(0.708 0 0)",
  "--chart-1": "oklch(0.845 0.143 164.978)",
  "--chart-2": "oklch(0.696 0.17 162.48)",
  "--chart-3": "oklch(0.596 0.145 163.225)",
  "--chart-4": "oklch(0.508 0.118 165.612)",
  "--chart-5": "oklch(0.432 0.095 166.913)",
  "--radius": "0.625rem",
  "--sidebar": "oklch(0.985 0 0)",
  "--sidebar-foreground": "oklch(0.145 0 0)",
  "--sidebar-primary": "oklch(0.546 0.245 262.881)",
  "--sidebar-primary-foreground": "oklch(0.97 0.014 254.604)",
  "--sidebar-accent": "oklch(0.97 0 0)",
  "--sidebar-accent-foreground": "oklch(0.205 0 0)",
  "--sidebar-border": "oklch(0.922 0 0)",
  "--sidebar-ring": "oklch(0.708 0 0)",
};

const canonicalDark = {
  "--background": "oklch(0.145 0 0)",
  "--foreground": "oklch(0.985 0 0)",
  "--card": "oklch(0.205 0 0)",
  "--card-foreground": "oklch(0.985 0 0)",
  "--popover": "oklch(0.205 0 0)",
  "--popover-foreground": "oklch(0.985 0 0)",
  "--primary": "oklch(0.424 0.199 265.638)",
  "--primary-foreground": "oklch(0.97 0.014 254.604)",
  "--secondary": "oklch(0.274 0.006 286.033)",
  "--secondary-foreground": "oklch(0.985 0 0)",
  "--muted": "oklch(0.269 0 0)",
  "--muted-foreground": "oklch(0.708 0 0)",
  "--accent": "oklch(0.269 0 0)",
  "--accent-foreground": "oklch(0.985 0 0)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--border": "oklch(1 0 0 / 10%)",
  "--input": "oklch(1 0 0 / 15%)",
  "--ring": "oklch(0.556 0 0)",
  "--chart-1": "oklch(0.845 0.143 164.978)",
  "--chart-2": "oklch(0.696 0.17 162.48)",
  "--chart-3": "oklch(0.596 0.145 163.225)",
  "--chart-4": "oklch(0.508 0.118 165.612)",
  "--chart-5": "oklch(0.432 0.095 166.913)",
  "--radius": "0.625rem",
  "--sidebar": "oklch(0.205 0 0)",
  "--sidebar-foreground": "oklch(0.985 0 0)",
  "--sidebar-primary": "oklch(0.623 0.214 259.815)",
  "--sidebar-primary-foreground": "oklch(0.97 0.014 254.604)",
  "--sidebar-accent": "oklch(0.269 0 0)",
  "--sidebar-accent-foreground": "oklch(0.985 0 0)",
  "--sidebar-border": "oklch(1 0 0 / 10%)",
  "--sidebar-ring": "oklch(0.556 0 0)",
};

export const BUILT_IN_PROJECT_THEMES = [
  defineBuiltInTheme({
    id: "luma-blue-violet",
    name: "Luma Blue Violet",
    description: "Default app template tokens with blue actions and violet dark-mode depth.",
    preview: {
      primary: "oklch(0.488 0.243 264.376)",
      secondary: "oklch(0.967 0.001 286.375)",
      accent: "oklch(0.845 0.143 164.978)",
      background: "oklch(1 0 0)",
    },
    light: canonicalLight,
    dark: canonicalDark,
  }),
  defineBuiltInTheme({
    id: "luma-admin-amber",
    name: "Luma Admin Amber",
    description: "Dark admin template tokens with amber actions and slate command surfaces.",
    preview: {
      primary: "oklch(0.555 0.163 48.998)",
      secondary: "oklch(0.967 0.001 286.375)",
      accent: "oklch(0.879 0.169 91.605)",
      background: "oklch(1 0 0)",
    },
    light: {
      ...canonicalLight,
      "--primary": "oklch(0.555 0.163 48.998)",
      "--primary-foreground": "oklch(0.987 0.022 95.277)",
      "--chart-1": "oklch(0.879 0.169 91.605)",
      "--chart-2": "oklch(0.769 0.188 70.08)",
      "--chart-3": "oklch(0.666 0.179 58.318)",
      "--chart-4": "oklch(0.555 0.163 48.998)",
      "--chart-5": "oklch(0.473 0.137 46.201)",
      "--sidebar-primary": "oklch(0.666 0.179 58.318)",
      "--sidebar-primary-foreground": "oklch(0.987 0.022 95.277)",
    },
    dark: {
      ...canonicalDark,
      "--primary": "oklch(0.473 0.137 46.201)",
      "--primary-foreground": "oklch(0.987 0.022 95.277)",
      "--chart-1": "oklch(0.879 0.169 91.605)",
      "--chart-2": "oklch(0.769 0.188 70.08)",
      "--chart-3": "oklch(0.666 0.179 58.318)",
      "--chart-4": "oklch(0.555 0.163 48.998)",
      "--chart-5": "oklch(0.473 0.137 46.201)",
      "--sidebar-primary": "oklch(0.769 0.188 70.08)",
      "--sidebar-primary-foreground": "oklch(0.279 0.077 45.635)",
    },
  }),
  defineBuiltInTheme({
    id: "luma-indigo-emerald",
    name: "Luma Indigo Emerald",
    description: "Canonical shadcn/Luma tokens with indigo actions and emerald data accents.",
    preview: {
      primary: "oklch(0.488 0.243 264.376)",
      secondary: "oklch(0.967 0.001 286.375)",
      accent: "oklch(0.845 0.143 164.978)",
      background: "oklch(1 0 0)",
    },
    light: canonicalLight,
    dark: canonicalDark,
  }),
  createVariantTheme("luma-violet-cyan", "Luma Violet Cyan", "A vivid product theme with violet controls and cyan chart accents.", "oklch(0.52 0.24 302)", "oklch(0.62 0.22 302)", [190, 205, 220, 235, 250], 285),
  createVariantTheme("luma-amber-slate", "Luma Amber Slate", "A calm operations theme with amber actions and slate surfaces.", "oklch(0.64 0.18 66)", "oklch(0.74 0.16 66)", [62, 72, 82, 215, 225], 250),
  createVariantTheme("luma-rose-zinc", "Luma Rose Zinc", "A focused editorial theme with rose controls and neutral zinc structure.", "oklch(0.58 0.22 20)", "oklch(0.66 0.19 20)", [18, 28, 340, 355, 12], 270),
  createVariantTheme("luma-teal-blue", "Luma Teal Blue", "A crisp data-app theme with teal actions and blue supporting charts.", "oklch(0.55 0.16 180)", "oklch(0.65 0.14 180)", [178, 190, 204, 218, 232], 230),
  createVariantTheme("luma-orange-stone", "Luma Orange Stone", "A warm workflow theme with orange actions and sturdy stone neutrals.", "oklch(0.61 0.19 42)", "oklch(0.7 0.17 42)", [38, 48, 58, 28, 18], 70),
] as const satisfies ProjectTheme[];

export function listProjectThemes() {
  return BUILT_IN_PROJECT_THEMES;
}

export function getProjectTheme(themeId: string) {
  return BUILT_IN_PROJECT_THEMES.find((theme) => theme.id === themeId) ?? null;
}

export function assertProjectTheme(themeId: string) {
  const theme = getProjectTheme(themeId);

  if (!theme) {
    throw new Error(`Unknown project theme: ${themeId}`);
  }

  return theme;
}

export function createCustomTheme(css: string, createdAt = new Date().toISOString()): ProjectTheme {
  const { light, dark } = parseThemeCss(css);
  const theme = projectThemeSchema.parse({
    id: CUSTOM_THEME_ID,
    name: "Custom Project Theme",
    description: "User-provided shadcn-compatible light and dark token set.",
    preview: {
      primary: light["--primary"],
      secondary: light["--secondary"],
      accent: light["--accent"],
      background: light["--background"],
    },
    css: serializeThemeCss(light, dark),
    source: "custom",
    createdAt,
    light,
    dark,
  });

  validateThemeTokens(theme);

  return theme;
}

export function resolveProjectTheme(themeId: string, tokenJson?: string | null) {
  if (themeId === CUSTOM_THEME_ID && tokenJson) {
    return projectThemeSchema.parse(JSON.parse(tokenJson));
  }

  return assertProjectTheme(themeId);
}

export function serializeThemeForStorage(theme: ProjectTheme) {
  return JSON.stringify(theme);
}

export function buildGeneratedAppStylesheet(theme: ProjectTheme) {
  return `${theme.css}\n\n${generatedAppBaseCss}`;
}

export function validateThemeTokens(theme: ProjectTheme) {
  const missingLight = REQUIRED_THEME_TOKENS.filter((token) => !theme.light[token]);
  const missingDark = REQUIRED_THEME_TOKENS.filter((token) => !theme.dark[token]);
  const chartValues = new Set(["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map((token) => theme.light[token]));

  if (missingLight.length > 0 || missingDark.length > 0) {
    throw new Error(`Theme ${theme.id} is missing required tokens: ${[...missingLight, ...missingDark].join(", ")}`);
  }

  if (chartValues.size < 5) {
    throw new Error(`Theme ${theme.id} must define differentiated chart tokens.`);
  }
}

function defineBuiltInTheme(seed: ThemeSeed): ProjectTheme {
  const theme = projectThemeSchema.parse({ ...seed, css: serializeThemeCss(seed.light, seed.dark), source: "built-in" });

  validateThemeTokens(theme);

  return theme;
}

function createVariantTheme(id: string, name: string, description: string, primary: string, darkPrimary: string, chartHue: number[], surfaceHue: number) {
  return defineBuiltInTheme({
    id,
    name,
    description,
    preview: {
      primary,
      secondary: `oklch(0.967 0.012 ${surfaceHue})`,
      accent: `oklch(0.9 0.09 ${chartHue[0]})`,
      background: "oklch(1 0 0)",
    },
    light: {
      ...canonicalLight,
      "--primary": primary,
      "--primary-foreground": "oklch(0.985 0 0)",
      "--secondary": `oklch(0.967 0.012 ${surfaceHue})`,
      "--accent": `oklch(0.97 0.025 ${chartHue[0]})`,
      "--ring": primary,
      "--chart-1": `oklch(0.82 0.13 ${chartHue[0]})`,
      "--chart-2": `oklch(0.7 0.15 ${chartHue[1]})`,
      "--chart-3": `oklch(0.6 0.14 ${chartHue[2]})`,
      "--chart-4": `oklch(0.52 0.12 ${chartHue[3]})`,
      "--chart-5": `oklch(0.44 0.1 ${chartHue[4]})`,
      "--sidebar-primary": primary,
      "--sidebar-primary-foreground": "oklch(0.985 0 0)",
      "--sidebar-accent": `oklch(0.97 0.025 ${chartHue[0]})`,
      "--sidebar-ring": primary,
    },
    dark: {
      ...canonicalDark,
      "--primary": darkPrimary,
      "--primary-foreground": "oklch(0.985 0 0)",
      "--ring": darkPrimary,
      "--chart-1": `oklch(0.82 0.13 ${chartHue[0]})`,
      "--chart-2": `oklch(0.7 0.15 ${chartHue[1]})`,
      "--chart-3": `oklch(0.6 0.14 ${chartHue[2]})`,
      "--chart-4": `oklch(0.52 0.12 ${chartHue[3]})`,
      "--chart-5": `oklch(0.44 0.1 ${chartHue[4]})`,
      "--sidebar-primary": darkPrimary,
      "--sidebar-primary-foreground": "oklch(0.985 0 0)",
      "--sidebar-ring": darkPrimary,
    },
  });
}

function parseThemeCss(css: string) {
  if (css.length > 16000) {
    throw new Error("Custom themes must be 16KB or smaller.");
  }

  if (/@import|url\(|https?:\/\//i.test(css)) {
    throw new Error("Custom themes cannot include imports, URLs, or remote assets.");
  }

  const selectors = Array.from(css.matchAll(/([^{}]+)\{/g)).map((match) => match[1].trim());
  const invalidSelector = selectors.find((selector) => selector !== ":root" && selector !== ".dark");

  if (invalidSelector) {
    throw new Error(`Custom themes can only include :root and .dark selectors. Found ${invalidSelector}.`);
  }

  const light = parseTokenBlock(css, ":root");
  const dark = parseTokenBlock(css, ".dark");
  const missingLight = REQUIRED_THEME_TOKENS.filter((token) => !light[token]);
  const missingDark = REQUIRED_THEME_TOKENS.filter((token) => !dark[token]);

  if (missingLight.length > 0 || missingDark.length > 0) {
    throw new Error(`Custom theme is missing required tokens: ${[...missingLight, ...missingDark].join(", ")}`);
  }

  return { light, dark };
}

function parseTokenBlock(css: string, selector: ":root" | ".dark") {
  const match = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\}`));

  if (!match) {
    throw new Error(`Custom theme must include a ${selector} block.`);
  }

  const declarations = match[1].split(";").map((declaration) => declaration.trim()).filter(Boolean);
  const tokens = Object.fromEntries(
    declarations.map((declaration) => {
      const tokenMatch = declaration.match(/^(--[a-z0-9-]+)\s*:\s*([^{}]+)$/);

      if (!tokenMatch) {
        throw new Error("Custom themes can only include CSS token declarations.");
      }

      if (!REQUIRED_THEME_TOKENS.includes(tokenMatch[1] as (typeof REQUIRED_THEME_TOKENS)[number])) {
        throw new Error(`Custom themes cannot define unsupported token ${tokenMatch[1]}.`);
      }

      return [tokenMatch[1], tokenMatch[2].trim()];
    }),
  );

  return tokens;
}

function serializeThemeCss(light: Record<string, string>, dark: Record<string, string>) {
  return `${serializeTokenBlock(":root", light)}\n\n${serializeTokenBlock(".dark", dark)}`;
}

function serializeTokenBlock(selector: ":root" | ".dark", tokens: Record<string, string>) {
  return `${selector} {\n${REQUIRED_THEME_TOKENS.map((token) => `  ${token}: ${tokens[token]};`).join("\n")}\n}`;
}

const generatedAppBaseCss = `* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: "Avenir Next", "Helvetica Neue", sans-serif;
}

.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, color-mix(in oklch, var(--primary) 18%, transparent), transparent 34rem),
    linear-gradient(135deg, var(--background), var(--secondary));
}

.page-shell {
  display: grid;
  place-items: center;
  padding: 2rem;
}

.hero-section {
  max-width: 42rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--card) 88%, transparent);
  color: var(--card-foreground);
  padding: clamp(2rem, 8vw, 5rem);
  box-shadow: 0 24px 70px color-mix(in oklch, var(--foreground) 10%, transparent);
}

.hero-section p {
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-section h1 {
  margin: 0.75rem 0 0;
  font-size: clamp(2.5rem, 8vw, 5rem);
  letter-spacing: 0;
  line-height: 0.95;
}
`;