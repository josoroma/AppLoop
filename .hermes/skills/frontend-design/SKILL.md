---
name: frontend-design
description: "Use when generating or revising AppLoop project UI: define hierarchy, responsive behavior, component map, accessibility, shadcn composition, and semantic class names."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [frontend, design, responsive, accessibility, shadcn, semantic-classes]
    related_skills: [theme-system, generated-app-standards, visual-selector]
---

# Frontend Design

## Overview

Use this skill for generated app interfaces that need to feel coherent, production-oriented, and specific to the user's brief. The output should be implementable by the Next.js implementer without another design pass.

## When to Use

- The user asks for a new page, dashboard, tool, workflow, or visual redesign.
- A selected boundary needs UI structure before code changes.
- A generated component needs responsive behavior or visual states defined.

Do not use this skill for pure data-model, API, dependency, or runtime-only changes.

## Layout Hierarchy

- Start from the primary user workflow, not from decorative sections.
- Define the page regions in reading order: shell, navigation, primary work area, secondary panels, repeated items, and action surfaces.
- Give every meaningful region a stable semantic class name such as `dashboard-header`, `task-grid`, or `empty-state-actions`.
- Avoid generic placeholder composition: do not specify filler cards, lorem ipsum sections, or marketing blocks unless the brief asks for a marketing page.
- Keep tool and dashboard screens dense enough for repeated use while preserving scan paths.

## Responsive Rules

- Define mobile, tablet, and desktop behavior for every major region.
- Preserve action reachability on small screens; move actions into drawers, menus, or sticky toolbars only when needed.
- Use stable dimensions for fixed-format controls so hover states, loading labels, and counters do not shift layout.
- Do not rely on viewport-scaled text; use explicit type steps and wrapping rules.

## Accessibility Rules

- Every interactive control needs an accessible name and keyboard-reachable focus state.
- Form fields need labels, validation messages, and clear error ownership.
- Color must not be the only signal for state.
- Loading, empty, success, warning, and error states must be described when the surface can enter them.

## shadcn Composition Rules

- Prefer shadcn-compatible primitives for dialogs, menus, tabs, forms, popovers, tooltips, tables, and command palettes.
- Do not nest cards inside cards; reserve cards for repeated records, modal surfaces, or framed tools.
- Use icon buttons for compact tool actions and text buttons for primary commands.
- For card action bars with multiple actions, give every action/form/button a flexible bounded width (`min-w-0`, `w-full`, grid/flex tracks) and wrap button labels in truncating or wrapping spans. Long disabled helper labels such as “Built-in templates cannot be deleted” must stay inside their own button and never overlap neighboring actions; add a `title` tooltip if truncating.
- Keep component responsibilities clear: shells arrange regions, feature components own data presentation, and primitives own interaction semantics.

## Fullscreen Modal And Scrollbar Patterns

Use this pattern when a modal or drawer is a primary workflow surface, such as project creation or settings with long card grids:

- Make the dialog truly fullscreen with viewport sizing (`h-dvh w-dvw max-w-none`), no rounded/windowed shell, and no outer clipping that hides content.
- Use CSS Grid for structure: header row (`auto`), scrollable content row (`1fr`), and optional pinned action footer (`auto`). This keeps titles and actions reachable while long forms scroll.
- Put vertical scrolling on the inner content region, not the page, with `min-h-0 overflow-y-scroll` so the grid child can shrink and scroll.
- When the user explicitly asks for a visible scrollbar, do not rely on macOS/Chromium overlay scrollbars. Add a named scroll area class plus CSS (`scrollbar-gutter: stable`, `scrollbar-width`, `scrollbar-color`, and `::-webkit-scrollbar` track/thumb rules). If native scrollbars are still hidden until interaction, add a subtle persistent right-side rail/background so the scroll affordance is visible.
- For fullscreen modals with selectable cards, increase card padding/min-height and use wider responsive grids (`md:grid-cols-2`, `xl:grid-cols-3`) so the fullscreen layout uses available space instead of looking like a centered small dialog.

## Output Contract

Produce:
- Layout hierarchy with named regions.
- Component map with responsibilities.
- Responsive behavior for each region.
- Visual states that must be implemented.
- Semantic class names for inspectable boundaries. Repeated elements (lists, grids, card sets) need both a shared base classname for grouping AND a unique per-instance descriptive classname so inspect mode can distinguish individual items. E.g. `metric-card summary-card metric-revenue` — not just `metric-card summary-card`. **Write the unique classname LAST** — the `createSelectionPayload` function in the inspector picks the last classname as `preferredSelector`, which is used for multi-select toggling. If two elements share the same last classname, they collide and cannot be distinguished. Document the base classname and each unique instance name.
- Which template the design targets (`template-default`, `template-admin-luma`, `template-ai-engineer-cv`, `template-deep-research-paper`, or `template-luminous-rings`), so generated code uses the correct root classname on `<body>`.
- For **any dark-gradient container** (sidebar, header, card, hero), nested text/icon/button colors must be explicit hardcoded values (`oklch(...)` or `color-mix(in oklch, white N%, ...)`) — never bare theme tokens like `var(--muted-foreground)`, which blend into dark surfaces. See `generated-app-standards` → Dark Container Nested Contrast for the full pattern.
- For AppLoop specialty template visual identity, see `references/template-visual-identities.md`: AI Engineer CV should remain dark v0/SaaS-hero inspired, Deep Research Paper should remain a light scientific research document, Luminous Rings should show colored blue/pink/purple/white laser rings spinning in concentric circles on a dark background, and Vestaboard should feel like a physical split-flap chassis with chaotic multi-wave letter scrambles on message change (not a calm final-text crossfade). Implementation detail lives in `generated-app-standards` → `references/vestaboard-template.md`.