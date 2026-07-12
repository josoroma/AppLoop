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
```

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