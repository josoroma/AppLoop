---
name: apploop-builder-create-flows
description: "Use when building or changing AppLoop builder create/list UX (/projects/new, /templates/new page routes not modals, post-create redirects, Templates New template CTA, Luma create shell), Makefile reset/seed runbooks, or the docs pack for architecture/user-flows/inspect-edit."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [apploop, builder, templates, projects, routes, luma, ux]
    related_skills: [frontend-design, generated-app-standards, theme-system]
---

# AppLoop Builder Create Flows

## Overview

AppLoop project and template **creation are full page routes**, not Dialog modals. Prefer page navigation + sticky footer actions over fullscreen dialogs for these primary workflows.

## When To Use

- User asks to change create project / create template UX
- Adding CTAs on `/projects` or `/templates` listings
- Wiring redirects after create completes
- Polishing Luma create-page layout
- Someone reintroduces a create modal — reject and keep page routes

## Routes And Components

| Flow | Route | Form component | Shell |
|------|-------|----------------|-------|
| New project | `/projects/new` | `components/projects/project-create-form.tsx` | `create-flow-shell.tsx` |
| New template | `/templates/new` | `components/projects/template-create-form.tsx` | `create-flow-shell.tsx` |

Shared pieces:

- Shell: `components/projects/create-flow-shell.tsx`
- Styles: `.luma-create-page`, `.luma-create-ambient`, `.luma-create-panel`, `.luma-create-input`, `.luma-select-card`, `.luma-create-footer`, `.luma-list-page` in `app/globals.css`
- Server actions: `lib/projects/actions.ts` → `createProjectAction`, `createCustomTemplateAction`
- Do **not** restore `project-create-dialog.tsx` unless the user explicitly asks for modals again

## Listing Headers

### `/templates` top actions (required)

1. `Projects` (outline) → `/projects`
2. **`New template` (primary)** → `/templates/new`

### `/projects` top actions

1. `Templates` (outline) → `/templates`
2. **`New project` (primary)** → `/projects/new`

Keep **New template** on the templates page header — not buried only under projects.

## Post-Create Redirects (required)

Success must land in the **builder edit surface**, not a listing-only state:

```text
createProjectAction
  → create workspace
  → redirect(`/projects/${project.project.id}`)

createCustomTemplateAction
  → createCustomTemplate(...)
  → openTemplateForEditing(repository, template.id)
  → redirect(`/projects/${projectId}`)
```

Template create must call `openTemplateForEditing` after the template is `ready`. That opens (or reuses) a builder project whose `workspace_path` is `templates/<id>/`.

## Create Template Form Fields

Only collect:

- name (required)
- description (optional)
- prompt (required)
- editable theme CSS (`:root` + `.dark`)

Do **not** expose start-from-template or default-theme pickers on the create-template page. Internally scaffold from `default` and apply `createCustomTheme(themeCss)`.

## Create Project Form Fields

- name
- template picker (built-ins + ready customs)
- theme picker (built-in Luma themes; swatches via `data-theme-id` CSS)

Theme cards still need `app/globals.css` swatch rules per theme id (see theme-system skill).

## Luma Create-Page Design Notes

- Ambient radial glows behind content (`.luma-create-ambient`)
- Glass panels: border + translucent card + blur + soft shadow
- Selectable cards: clear checked ring (`border-primary ring-2 ring-ring`)
- Sticky bottom action bar for primary submit
- Pending overlay with spinner while server action runs
- List pages get the same soft Luma background (`.luma-list-page`)

## Pitfalls

- **Modal regression**: fullscreen Dialog create was removed intentionally — recreate only on explicit user request.
- **Template create without edit open**: finishing Hermes authoring then only revalidating `/templates` leaves the user stranded — always `openTemplateForEditing` + redirect.
- **Missing New template on `/templates`**: users expect create next to the library, not only from projects.
- **Theme parser ignore list**: AI-authored CSS may include template-local vars like `--board`; those go in `IGNORED_CUSTOM_THEME_TOKENS` (`lib/themes/registry.ts`), not `REQUIRED_THEME_TOKENS`. See theme-system + `generated-app-standards` custom-template-authoring reference.
- **In-place template edit**: Edit opens exact `templates/<id>/`; do not clone on Edit (clone is a separate action).

## Verification

```bash
npm run typecheck
npx eslint app/projects/new/page.tsx app/templates/new/page.tsx \
  app/projects/page.tsx app/templates/page.tsx \
  components/projects/create-flow-shell.tsx \
  components/projects/project-create-form.tsx \
  components/projects/template-create-form.tsx \
  lib/projects/actions.ts --max-warnings 0
```

Confirm routes resolve and actions still redirect into `/projects/[projectId]`.

## Latency mental model

| Flow | Wait is mostly | Hermes during create? | Success land |
|------|----------------|------------------------|--------------|
| Create project | FS copy + SQLite bundle | **No** (chat later) | `/projects/:id` |
| Create template | Gateway one-shot authoring | **Yes** `runProjectOnce` | `/projects/:id` after `openTemplateForEditing` |
| Inspect send | Streaming chat | **Yes** `streamProjectRun` | Same builder sheet |

Do not promise multi-minute waits for create project; do expect longer waits for create template.

## Ops: reset / seed

Prefer soft reseed after dirty local state:

```bash
make seed                 # apploop-reset + migrate + template npm install + seed demos
make hermes-gateway
make dev
```

Nuclear (also drops root `node_modules`): `make reset && make install && make apploop-seed`.

Detail: [`references/makefile-reset-and-seed.md`](references/makefile-reset-and-seed.md) and `docs/README-RESET.html`.

**Catalog gap:** `apploop-template-seed` installs **every** `templates/*/package.json` (including vestaboard/lumacv). Demo projects from `scripts/seed-projects.mts` only cover `BUILT_IN_PROJECT_TEMPLATES` — register new built-ins there or they will not appear as seeded cards on `/projects`.

## Inspect / edit / restore

Same builder surface for projects and template-edit workspaces. Full walkthrough:
[`references/inspect-edit-and-docs.md`](references/inspect-edit-and-docs.md) and `docs/README-USER-FLOW-EDIT-PROJECT-OR-TEMPLATE.md`.

## Documentation pack

When the product flow or architecture changes, update the matching doc in:
[`references/architecture-and-user-flow-docs.md`](references/architecture-and-user-flow-docs.md)

Primary pack:

- `docs/README-ARCHITECTURE-DOCUMENTATION.html` — UI / DB / gateway planes
- `docs/README-HERMES.html` — `.apploop` tree + `.hermes/{agents,bundles,skills,hooks,commands}` + when UI hits the gateway
- `docs/README-RESET.html` — Makefile run/reset/seed
- `docs/README-USER-FLOW-*.md` — create project/template + inspect-edit

**Flow markdown conventions:** TOC at top; always cover actions/APIs, DB tables (query vs mutate), main implementing files; latency callouts for local create vs gateway template authoring.

**Architecture HTML conventions (Luma dark):** self-contained CSS (no build), shadcn/`oklch` indigo tokens, diagrams OK.

**Pitfall — KPI / card title overflow in architecture HTML:** long monospace strings like `.hermes/{agents,bundles,…}` or `createProjectAgentBundle()` bleed into neighbor cards if grid children can grow past track width. Always:

1. `.grid-N { grid-template-columns: repeat(N, minmax(0, 1fr)); }` — the `minmax(0, …)` is required
2. card/KPI: `min-width: 0; overflow: hidden`
3. titles: `overflow-wrap: anywhere; word-break: break-word; line-height: 1.25; font-size: clamp(...)`
4. Prefer shortened titles (e.g. `.hermes/ agents · bundles · skills · hooks · commands`) over unbreakable brace lists
5. Inside titles, style `code { white-space: normal; overflow-wrap: anywhere }`

Verified fix after user “content overlaps” report on `README-HERMES.html` hero KPIs. Condensed recipe also in [`references/docs-html-kpi-overflow.md`](references/docs-html-kpi-overflow.md).

## Create-template prompt packs

When the user wants a prompt *to run through* Create Template UI, deliver a paste pack (name / short description / long authoring prompt). Details: [`references/create-template-prompt-pack.md`](references/create-template-prompt-pack.md).

## Product docs / SPECS / ship

Root `SPECS.md` + README Product Hunt/YouTube + authority order + push-to-main notes: [`references/product-docs-and-main-ship.md`](references/product-docs-and-main-ship.md).

## Immersive neon field specialty

Square-framed horizontal neon fabric / R3F + bloom + spring pointer ref store: [`references/immersive-neon-field.md`](references/immersive-neon-field.md).

## Related detail

- Template-authoring internals: generated-app-standards `references/custom-template-authoring.md` (may lag if protected)
- Prefer also patching `generated-app-standards` / `theme-system` when unlocked — they currently reject autonomous curator writes
- `.apploop` vs `.hermes` coupling + agentBundle: hermes-gateway skill + `docs/README-HERMES.html`
- Prefer **this** skill for builder UI route/redirect/CTA/ops/docs decisions