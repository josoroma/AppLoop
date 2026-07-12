---
name: generated-app-standards
description: "Use when Hermes writes generated Next.js app code: enforce formatting, named exports, component boundaries, route colocation, schema validation, and server action patterns."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [nextjs, generated-code, conventions, routes, components, schemas]
    related_skills: [frontend-design, theme-system, project-runtime]
---

# Generated App Standards

## Overview

Use this skill as the source of truth for generated-project code conventions. Apply these standards before editing and again during validation repair.

## When to Use

- Hermes creates or edits generated Next.js route modules, components, actions, schemas, or helpers.
- A validation failure indicates import, casing, export, or module-boundary drift.
- A generated project needs new files added consistently.

Do not use this skill to edit AppLoop builder source files.

## Formatting Rules

- Use TypeScript and strict-safe types.
- Format generated TypeScript with 2-space indentation, single quotes, trailing commas, and no semicolons.
- Use kebab-case filenames and directories.
- Use named exports for components, helpers, schemas, and actions.
- Keep imports sorted by platform, packages, aliases, then relative paths when touching a file.
- Avoid relative imports that traverse more than one parent directory; introduce a local barrel or colocated helper instead.
- Run `npm run format`, `npm run lint`, and `npm run typecheck` in the generated project when available.

## Export Rules

- Component files export one PascalCase named component.
- Component files prefer `export const ComponentName = ({ prop }: Props) => { ... }`.
- The PascalCase component export must match the kebab-case filename, for example `project-card.tsx` exports `ProjectCard`.
- Shared helper files export named functions or constants only.
- Route files export only the App Router symbols expected by Next.js.
- Do not add default component exports unless a framework route convention requires one.

## Component Rules

- Keep components focused on one UI responsibility.
- Put reusable UI under colocated `components/` folders for the route or feature that owns them.
- Put semantic class names on inspectable boundaries from the frontend design output.
- Use stable semantic class names such as `dashboard-header`, `dashboard-content`, `left-column`, `center-column`, `right-column`, `dashboard-footer`, `analytics-card`, `summary-card`, `primary-actions`, and `secondary-actions` on user-meaningful boundaries.
- Optional `data-builder-id` values must be kebab-case, unique in the rendered route, and describe the boundary rather than visual styling.
- Optional `data-builder-component` values should name the owning PascalCase component and stay out of business logic.
- Preserve semantic class names and builder metadata during refactors unless all source references are updated.
- Keep client components small and mark them with `"use client"` only when they use browser state, effects, refs, or event-only APIs.

## Route Colocation Rules

- Keep route-specific components, schemas, and actions near the route that owns them.
- Approved route module files are `actions.ts`, `schema.ts`, `hooks.ts`, `atoms.ts`, `types.ts`, `utils.ts`, and `constants.ts`.
- Move cross-route helpers into an explicit shared folder only after three real route call sites exist.
- Keep route modules readable: compose imported components instead of embedding large UI trees directly in route files.
- Route UI components live in a `components/` folder under the route or an approved shared component root.

## Schema And Action Patterns

- Validate all external input at IO boundaries.
- Keep Zod or schema definitions close to server actions and route handlers that consume them.
- Schemas use `export const PositionSchema = z.object({...})` plus `export type Position = z.infer<typeof PositionSchema>`.
- Server actions use exported async function declarations with verb-noun names such as `createPosition`.
- Return typed action results with explicit success and error states.
- Do not pass secrets, raw environment values, or server-only objects into client components.

## Verification Checklist

- [ ] Filenames are kebab-case.
- [ ] Components use named PascalCase exports.
- [ ] Important boundaries use stable semantic class names.
- [ ] Repeated boundaries use unique `data-builder-id` metadata when needed.
- [ ] Relative imports do not traverse more than one parent.
- [ ] Route modules expose only expected Next.js route exports.
- [ ] Route-specific modules use approved route filenames or route-local `components/` folders.
- [ ] Schemas and actions follow the generated templates and validate structured input.