# User Flow: Presentations (Marp)

This is the end-to-end path for creating, editing, styling, visually arranging, and reseeding AppLoop presentations as plain Marp Markdown decks.

Primary surfaces:

- Listing: `http://localhost:3001/presentations`
- Create page: `http://localhost:3001/presentations/new`
- Builder: `http://localhost:3001/presentations/[presentationId]`

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Create a presentation](#2-create-a-presentation)
3. [Edit and preview](#3-edit-and-preview)
4. [APIs and files](#4-apis-and-files)
5. [Hermes presentation mode](#5-hermes-presentation-mode)
6. [Database](#6-database)
7. [Reset and seed](#7-reset-and-seed)
8. [Failure modes](#8-failure-modes)

---

## 1. Mental model

| Concept | Path / owner |
| --- | --- |
| Built-in blueprint | `presentations-templates/simple-3-slides/` |
| User workspace | `.apploop/presentations/<slug>/` |
| Source of truth | `deck.md` (optional `theme.css`) |
| Preview | `@marp-team/marp-core` HTML iframe (no 3100 ports) |
| Chat | `/api/presentations/chat` + `presentation-edit` Hermes bundle |

Presentations are **not** Next.js projects. There is no runtime PID/port for decks, and preview reloads are cache-busted Marp renders rather than `next dev` restarts.

---

## 2. Create a presentation

1. Open `/presentations`
2. Click **New presentation** → `/presentations/new`
3. Enter a name and keep **Simple 3 Slides**
4. Submit — AppLoop:
   - allocates a unique slug
   - copies the blueprint into `.apploop/presentations/<slug>/`
   - inserts `presentations` + `presentation_conversations` rows
   - redirects to `/presentations/[id]`

Create is **local only** (no Hermes on create).

---

## 3. Edit and preview

The builder shell has three working surfaces:

1. **Chat** — Hermes `presentation-edit` prompt, edits Marp Markdown only
2. **Markdown editor** — manual `deck.md` save via server action
3. **Marp preview** — `/api/presentations/[id]/preview?_t=N`, with filmstrip navigation

After Hermes finishes streaming, preview cache-busts with `_t`.

The active slide is mirrored into the URL as `?slide=N` so reloads and drag/drop keep the same slide. Filmstrip controls can clone and delete slides, and slide-level **BG** / **TXT** color controls preview immediately, persist into slide style metadata, and participate in undo/redo.

Inspect mode is free-positioned by default. Dragging with the mouse or moving with arrow keys changes only the selected element position; it does not swap, reflow, or resize neighboring elements, and overlap is allowed. Position and dimensions persist through the presentation style save path so reloads keep the element where the user dropped it.

SVG shapes and icons inserted from the toolbar are editable deck elements. The selectable target is the owning `<svg>` wrapper so selection width/height, drag, arrow movement, layers, and delete use the visible shape/icon box. SVG paint properties (`fill`, `stroke`, `strokeWidth`, opacity, line caps/joins) apply to the marked inner primitive carrying `data-apploop-shape`, while wrapper size/position persists on the `<svg>` itself.

Inspect mode treats lists and tables as whole logical elements. Clicking into a list item for text editing disables drag for that list item; pressing Enter creates another list item and moves text focus there. Table padding and border styles are scoped to `th,td` cells in preview and persisted CSS; changing table padding does not invent or overwrite a table border. List/table option changes are local style operations, not full iframe reloads.

Delete selected removes the selected element boundary. For SVG shapes/icons, delete removes the selected SVG wrapper by `data-apploop-shape` without deleting adjacent headings, paragraphs, cards, or flow text.

Starter decks stay at **3 slides** unless the user asks for more.

---

## 4. APIs and files

### Routes

- `GET /presentations`
- `GET /presentations/new`
- `GET /presentations/[presentationId]`
- `GET /api/presentations/[presentationId]/preview`
- `POST /api/presentations/chat`

### Domain

- `lib/presentations/templates.ts`
- `lib/presentations/files.ts`
- `lib/presentations/service.ts`
- `lib/presentations/repository.ts`
- `lib/presentations/actions.ts`
- `lib/presentations/inspect-editor-assets.ts`
- `lib/presentations/inspect-styles.ts`
- `lib/presentations/marp-utils.ts`
- `lib/presentations/marp.ts`
- `lib/presentations/store.ts`

### UI

- `components/presentations/presentation-create-form.tsx`
- `components/presentations/presentation-builder-shell.tsx`

---

## 5. Hermes presentation mode

Bundle assembly: `createPresentationAgentBundle()` in `lib/hermes/agents.ts`

Assets:

| Kind | Path |
| --- | --- |
| Agent | `.hermes/agents/presentation-builder.md` |
| Bundle | `.hermes/bundles/marp-builder/BUNDLE.md` |
| Skill | `.hermes/skills/marp-presentations/SKILL.md` |
| Command | `.hermes/commands/presentation-build.md` |
| Hook | `.hermes/hooks/presentation-scope-guard/HOOK.md` |

Gateway instructions for presentation runs are issued by `createGatewayInstructions()` in `lib/hermes/client.ts` when `mode === "presentation-edit"`.

Hard rules in the edit prompt:

- writable root = presentation workspace only
- source of truth = `deck.md`
- valid Marp front matter
- no npm / Next scaffolding / project-template edits
- Simple 3 slides stays at 3 slides unless user expands

---

## 6. Database

Migration: `lib/db/migrations/0010_presentations.sql`

Tables:

- `presentations`
- `presentation_conversations`
- `presentation_messages`

Env: `PRESENTATIONS_ROOT` default `.apploop/presentations`

---

## 7. Reset and seed

`make seed` treats presentations as first-class local state:

1. `make apploop-reset` deletes `.apploop/projects`, `.apploop/presentations`, runtime logs, and `.apploop` database files, while preserving committed `templates/` and `presentations-templates/` sources.
2. `make apploop-seed` runs migrations, installs project-template dependencies, seeds demo projects from `BUILT_IN_PROJECT_TEMPLATES`, and seeds demo presentations from `BUILT_IN_PRESENTATION_TEMPLATES`.
3. `scripts/seed-presentations.mts` uses `PresentationService.createPresentation()` plus `createPresentationWorkspace()`, the same service/filesystem boundary as the UI create flow, and skips active presentations with the same name.

Current built-in presentation seed:

| id | Name | Workspace source |
| --- | --- | --- |
| `simple-3-slides` | Simple 3 Slides | `presentations-templates/simple-3-slides/` |

Do not run reset targets casually against active local decks; `.apploop/presentations/` is local-only generated state.

---

## 8. Failure modes

- Preview 404: presentation missing/deleted
- Preview 500: invalid Marp markdown or unreadable file
- Chat 404: no active conversation
- Shape/icon disappears after drag: verify the selected target is the SVG wrapper, not an inner `path`/`rect`; run `npm test -- tests/presentation-marp.test.ts tests/presentation-inspect-styles.test.ts` after changes to inspect persistence.
- Delete selected leaves a shape/icon behind: verify `removeMarpSlideElement()` handles `tag: "svg"` targets with `data-apploop-shape`.
- Delete errors: workspace rename/trash failure surfaces `?deleteError=`
- Missing deck after DB reset: run `make apploop-reset && make apploop-seed` so DB rows and presentation folders are recreated together
