---
name: theme-system
description: "Use when applying, previewing, or migrating AppLoop Luma/shadcn themes: registry lookup, light/dark tokens, semantic token preservation, preview, and rollback."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [themes, luma, shadcn, tokens, css, preview]
    related_skills: [frontend-design, generated-app-standards]
---

# Theme System

## Overview

Use this skill when a generated project needs to apply or migrate a selectable Luma/shadcn token set. The goal is consistent semantic tokens, not arbitrary one-off colors.

## When to Use

- A project selects a theme such as `luma-indigo-emerald`.
- Hermes changes global CSS variables, Tailwind theme usage, or shadcn token references.
- A theme preview or rollback is required.

Do not use this skill for unrelated component spacing, copywriting, or runtime fixes.

## Theme Registry Format

Each theme entry must define:
- `id`: stable kebab-case id.
- `name`: human-readable label.
- `description`: short user-facing description.
- `preview`: `primary`, `secondary`, `accent`, and `background` swatches.
- `css`: full generated stylesheet token block.
- `source`: `built-in` or `custom`.
- `light`: semantic token map for light mode.
- `dark`: semantic token map for dark mode.

Built-in ids:

```text
luma-indigo-emerald
luma-violet-cyan
luma-amber-slate
luma-rose-zinc
luma-teal-blue
luma-orange-stone
luma-blue-violet
luma-admin-amber
luma-cv-indigo
```

## Registering a Custom Template Palette

When a template needs its own distinct color palette, register a new built-in theme in `lib/themes/registry.ts` using `defineBuiltInTheme()` with light/dark token overrides, then point the template at it in `lib/projects/templates.ts`.

```typescript
// 1. In lib/themes/registry.ts, add to BUILT_IN_PROJECT_THEMES:
defineBuiltInTheme({
  id: "luma-cv-indigo",
  name: "Luma CV Indigo",
  description: "Dark violet-indigo sidebar with warm amber accent.",
  preview: {
    primary: "oklch(0.52 0.28 275)",
    secondary: "oklch(0.967 0.001 286.375)",
    accent: "oklch(0.76 0.18 82)",
    background: "oklch(1 0 0)",
  },
  light: {
    ...canonicalLight,
    "--primary": "oklch(0.52 0.28 275)",
    "--sidebar-primary": "oklch(0.52 0.28 275)",
    "--chart-1": "oklch(0.52 0.28 275)",
  },
  dark: {
    ...canonicalDark,
    "--background": "oklch(0.06 0 0)",
    "--sidebar": "oklch(0.09 0.005 265)",
    "--sidebar-foreground": "oklch(0.98 0 0)",
    "--sidebar-primary": "oklch(0.56 0.26 278)",
    "--primary": "oklch(0.52 0.26 278)",
    "--accent": "oklch(0.74 0.18 82)",
    "--radius": "0.75rem",
  },
}),

// 2. In lib/projects/templates.ts, point the template at the new id:
{
  id: "generated-nextjs-ai-engineer-cv",
  defaultThemeId: "luma-cv-indigo",
}
```

The new theme appears in the Create Project modal's theme grid. Override only the tokens that differ from `canonicalLight`/`canonicalDark` — everything else inherits.

### Preview Swatch CSS Pitfall

The Create Project modal renders theme palette swatches using hardcoded CSS rules in `app/globals.css` keyed by `data-theme-id`. **Every new theme id MUST have corresponding CSS rules** or its swatches appear blank/black:

```css
/* app/globals.css — add one 4-line block per new theme id */
.theme-card-preview[data-theme-id="luma-cv-indigo"] .theme-preview-primary { background: oklch(0.52 0.28 275); }
.theme-card-preview[data-theme-id="luma-cv-indigo"] .theme-preview-secondary { background: oklch(0.967 0.001 286.375); }
.theme-card-preview[data-theme-id="luma-cv-indigo"] .theme-preview-accent { background: oklch(0.82 0.18 78); }
.theme-card-preview[data-theme-id="luma-cv-indigo"] .theme-preview-background { background: oklch(1 0 0); }
```

Critical rules:
- `preview.secondary` and `preview.background` must use **light-mode values** — never near-black tokens from dark mode. A `background: "#09090b"` or `secondary: "oklch(0.16 0.04 265)"` renders as a dark rectangle indistinguishable from the card border.
- `preview.background` should match `oklch(1 0 0)` for consistency with all other themes.
- Sync the preview values in `lib/themes/registry.ts` with the CSS swatch values — they are linked but maintained separately.

## Token Requirements

- Provide light and dark values for background, foreground, muted, border, primary, secondary, accent, destructive, ring, card, popover, and chart tokens.
- Include sidebar tokens, five differentiated chart tokens, and `--radius`.
- Preserve semantic token names already used by components.
- Avoid hard-coded color utilities in component markup unless there is a specific non-theme reason.
- Keep arbitrary color values out of generated components; add a semantic token instead.
- Custom themes may only include `:root` and `.dark` blocks and must not include imports, URLs, remote assets, or arbitrary selectors.

## Semantic CSS Usage

- Use semantic variables such as `var(--background)`, `var(--foreground)`, `var(--card)`, `var(--card-foreground)`, `var(--border)`, `var(--primary)`, and `var(--ring)`.
- Prefer semantic utility classes when Tailwind/shadcn is present: `bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, and `text-primary-foreground`.
- Data visualization may use `--chart-1` through `--chart-5`; document any additional hard-coded palette values.

## Application Workflow

1. Resolve the selected theme id from server-provided project context.
2. Locate the generated project's token file.
3. Apply the full light and dark token set atomically.
4. Update only semantic token references required by the change; do not rewrite unrelated project content.
5. Run validation and preview checks.

## Preview Workflow

- Start or reuse the project runtime.
- Open the default route or theme preview route.
- Verify contrast, focus rings, hover states, empty states, and modal/menu surfaces.
- Report any token that could not be previewed.

## Rollback Behavior

- Capture the previous token file before applying a theme.
- If validation fails because of the theme change, restore the previous token file first.
- If rollback fails, stop and report the affected file and validation command.