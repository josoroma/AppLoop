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
- The root `<body>` element must carry the template classname: `template-default` for `generated-nextjs-default` or `template-admin-luma` for `generated-nextjs-admin-luma`. Never remove or rename this classname — it identifies the template source in inspect mode and disambiguates overlapping semantic classnames between templates.
- Repeated elements (e.g. cards rendered via `.map()`) must have both a shared base classname (for grouping, e.g. `metric-card summary-card`) AND a unique per-instance descriptive classname (for precise inspect-mode identification, e.g. `metric-revenue`, `metric-active-users`). Without the unique classname, all instances appear identical in inspect mode and the user cannot target a specific one.
  - **Write the unique classname LAST** in the className string: `metric-card summary-card metric-revenue`. The `createSelectionPayload` in `inspector-provider.tsx` picks the LAST classname as `preferredSelector`, which is the key used for multi-select toggling. If two elements share the same last classname, they collide and multi-select breaks.
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
- [ ] Repeated boundaries use unique `data-builder-id` metadata AND unique per-instance descriptive classnames.
- [ ] Relative imports do not traverse more than one parent.
- [ ] Route modules expose only expected Next.js route exports.
- [ ] Route-specific modules use approved route filenames or route-local `components/` folders.
- [ ] Schemas and actions follow the generated templates and validate structured input.

## Async Form Handler Pitfall (React Synthetic Events)

When an `onSubmit` handler is `async`, React's synthetic events are nulled after any `await`. `event.currentTarget` becomes `null`, causing `Cannot read properties of null (reading 'reset')`.

**Fix**: Capture the form reference BEFORE the first `await`:

```typescript
// CORRECT
onSubmit={async (event) => {
  event.preventDefault();
  const form = event.currentTarget; // ← capture before await
  // ... any async calls
  form.reset();
}}

// WRONG — event.currentTarget is null after await
onSubmit={async (event) => {
  event.preventDefault();
  const hash = await createFileSnapshot(projectId);
  event.currentTarget.reset(); // ← null at this point
}}
```

This applies to any form handler that calls a server action, `fetch`, or any async operation where the form needs to be accessed afterward.

## Portal Rendering with SSR Guard

When rendering to `document.body` via `createPortal`, the call fails during server-side rendering because `document` is not defined.

**Fix**: Gate with a client-side hydration check:

```typescript
const [isClient, setIsClient] = useState(false);

useEffect(() => {
  setIsClient(true);
}, []);

// Only render portal after client mount
{isClient && createPortal(<Overlay />, document.body)}
```

This pattern is required for: inspector overlays, dropdown menus rendered at body level, tooltips, and session history panels that must escape overflow-hidden parent containers.

## CSS Grid Sticky-Bottom Form in Resizable Panels

When a chat panel has a conversation area + sticky-bottom textarea inside a `react-resizable-panels` `<Panel>`, the conventional `flex h-full flex-col` layout fails because `h-full` requires a definite parent height, which the Panel's `flex-basis` percentage does not provide.

**Fix**: Use `position: relative` on the Panel and `absolute inset-0` on the section, then CSS Grid for the internal layout:

```tsx
<Panel className="relative">
  <section className="absolute inset-0 grid grid-rows-[auto_1fr_auto]">
    <div>header</div>                          {/* row 1: auto */}
    <div className="overflow-y-auto">conv</div> {/* row 2: 1fr, scrolls */}
    <form>textarea + buttons</form>             {/* row 3: auto, pinned */}
  </section>
</Panel>
```

The `overflow-y-auto` on the middle row handles vertical scrolling; add `overflow-x-hidden` to suppress horizontal scrollbars from long unbroken text.

## Template Propagation

**See also**: [`references/chat-checkpoints.md`](references/chat-checkpoints.md) for the git-backed checkpoint and session history system.

**Critical pitfall — template mismatch**: Each generated project was created from exactly one template (default or admin-luma). When syncing template files to a generated project, you MUST use the CORRECT template source. Copying the wrong template's `layout.tsx` (e.g. default's `SiteHeader` into an admin-luma project that uses `AdminShell`) causes a missing-module compilation error. The Next.js dev server then hangs in a retry loop, making the preview completely unresponsive (curl times out, but `lsof` shows the port is listening — the process is stuck, not dead).

**Before syncing, check which template the project uses:**
```bash
# Check the body classname in the generated project's layout
grep "template-" .apploop/projects/<slug>/app/layout.tsx
# Returns: template-default → use templates/generated-nextjs-default/
# Returns: template-admin-luma → use templates/generated-nextjs-admin-luma/
```

**When the server is stuck after a wrong template sync:**
1. Fix the generated project file to use the correct template components.
2. Kill the stuck Next.js process: `kill $(lsof -ti:<port>)`
3. The AppLoop runtime will auto-restart the preview on a new port.

**Template dependencies**: Template files are independent Next.js projects with their own `package.json`. The standard template deps (`react`, `next`, `tailwind-merge`, etc.) don't require special tsconfig handling in the builder since the builder never imports from templates as modules — templates are only referenced as filesystem paths for copying. If you add a dependency to a template, the builder's `tsc` may fail; exclude `templates/` from `tsconfig.json` temporarily and remove the exclude once the dependency is removed.

## Next.js Dev Server File Watching

Generated projects use Next.js 16 with Turbopack. File changes written by external tools (Hermes prompts, the builder's file operations) may not be detected by Turbopack's native file system watcher (FSEvents/inotify). The symptom: `globals.css` is modified on disk, but the compiled CSS bundle hash never changes, even after a dev server restart. Only deleting `.next/` forces a recompile.

**Fix**: Add `CHOKIDAR_USEPOLLING=true` to the `dev` script in the template's `package.json`:

```json
"scripts": {
  "dev": "CHOKIDAR_USEPOLLING=true next dev"
}
```

This forces polling (1s interval) instead of native OS events, reliable across all filesystems and external write sources. New projects get this automatically; existing projects need the script updated or recreation.

**Verification**: After an edit, check the CSS hash changed: `curl -s http://127.0.0.1:<port>/ | grep -o 'href="[^"]*\\.css[^"]*"'`. Stale hash → clear `.next/` and restart.

## Preview Reload After Code Changes

Even with polling enabled, the preview iframe may show stale content after a Hermes response due to browser caching or iframe lifecycle quirks. The builder forces a reload: when `chat.status` transitions from `"streaming"` to `"ready"`, a `previewReloadKey` counter in `builder-shell.tsx` increments, changing the `PreviewFrame` component's `key` prop to `${projectId}-${previewReloadKey}`. React unmounts and remounts the iframe, serving fresh content from the Next.js dev server.

This is the primary mechanism for making CSS/JS changes visible after Hermes prompts — it is lighter than a full runtime restart and works regardless of whether Turbopack's file watcher detected the change. If the preview still shows stale content after a prompt, verify `previewReloadKey` is incrementing by checking the preview element `key` attribute in React DevTools.

## Generated CSS Contrast (Dark Mode)

The admin-luma template uses a dark gradient background with a sticky header. In dark mode, the original header CSS used `color-mix(in oklch, var(--sidebar) 88%, transparent)` which is nearly identical to the background, making the header invisible. Similarly, the theme-toggle button border used `var(--border)` which is 10% white — nearly invisible on dark backgrounds.

**When editing CSS for a generated admin-luma project**, ensure these elements remain visible:

- **Admin header**: Use `color-mix(in oklch, var(--sidebar) 92%, var(--background))` for the background (slightly lighter than the shell gradient) and `color-mix(in oklch, var(--sidebar-foreground) 12%, transparent)` for the border-bottom (subtle but visible).
- **Theme toggle**: Use `color-mix(in oklch, var(--sidebar-foreground) 15%, transparent)` for the border instead of `var(--border)` to ensure visibility in both light and dark modes. Keep `min-width: 7rem` and `font-size: 0.8125rem` to accommodate the "☀️ Light" / "🌙 Dark" labels.