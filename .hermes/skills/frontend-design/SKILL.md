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
- Keep component responsibilities clear: shells arrange regions, feature components own data presentation, and primitives own interaction semantics.

## Output Contract

Produce:
- Layout hierarchy with named regions.
- Component map with responsibilities.
- Responsive behavior for each region.
- Visual states that must be implemented.
- Semantic class names for inspectable boundaries.