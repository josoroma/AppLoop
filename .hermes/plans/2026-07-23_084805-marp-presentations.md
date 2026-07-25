# Marp Presentations in AppLoop — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after user approval.

**Goal:** Add a third first-class surface — **Presentations** — that reuses the projects/templates inventory + builder UX, but authors and previews Marp Markdown decks instead of generated Next.js apps.

**Architecture:** Presentations are a new domain parallel to projects:
- Built-in blueprint lives at `presentations-templates/simple-3-slides/` (plain Marp Markdown, ≤3 slides).
- User decks live under `.apploop/presentations/<slug>/`.
- Inventory + create pages mirror `/projects` and `/templates` patterns.
- Builder reuses chat + split layout, but the **right pane is a Marp preview** (not a Next runtime iframe on ports 3100–3199).
- Source of truth is Markdown (`deck.md`); Hermes edits the markdown (and optional theme CSS), not a full app scaffold.
- AppLoop owns records, paths, persistence; Marp renders preview; Hermes owns generative markdown edits via a slim presentation agent bundle.

**Tech Stack:**
- Existing Next.js builder UI (`CreateFlowShell`, inventory pages, `BuilderShell` patterns)
- SQLite + Drizzle (`presentations` table)
- `@marp-team/marp-core` (server-side HTML render) and/or `@marp-team/marp-cli` for export later
- Client preview: sandboxed iframe fed by `/api/presentations/[id]/preview`
- Optional later: `@marp-team/marpit` theme CSS, PDF/PPTX export via marp-cli

**Out of scope for v1 (YAGNI):**
- Custom presentation templates authored via Hermes (create-template equivalent)
- Inspect / visual selector on slide HTML
- Live preview runtime ports / Next project clone
- Multi-file multi-section decks, speaker notes UI polish, PDF export, collab
- Full reuse of project runtime lifecycle (`lib/runtime/*`)

---

## Current context / assumptions

| Surface | Path | Workspace | Preview |
| --- | --- | --- | --- |
| Projects | `/projects`, `/projects/new`, `/projects/[id]` | `.apploop/projects/<slug>` (or `templates/<id>` for template-edit) | Next dev server `3100–3199` |
| Templates | `/templates`, `/templates/new` | `templates/<id>` | Opened as template-edit project → same builder |
| **Presentations (new)** | `/presentations`, `/presentations/new`, `/presentations/[id]` | `.apploop/presentations/<slug>` | Marp-rendered HTML iframe (no port) |

Observations from code:
- Inventory headers live in `app/projects/page.tsx` / `app/templates/page.tsx` with cross-links.
- Create flows are **pages**, not modals (`CreateFlowShell` + form components).
- Chat is wired to `projectId` via `/api/chat` and Hermes agent bundles in `lib/hermes/agents.ts`.
- Ownership boundary: AppLoop owns DB/paths/runtime; Hermes owns generative edits; browser never holds secrets or authoritative FS writes.

Assumption (see open questions): v1 treats presentations as **Markdown-first decks**, not Next.js apps that embed Marp.

---

## Product shape (v1)

### User flow

1. `/presentations` — list decks (name, slug, updated, template source).
2. **New presentation** → `/presentations/new` — name + pick built-in template (only `simple-3-slides` at start).
3. Local create only (like create-project): clone template → DB row → redirect `/presentations/[id]`.
4. Builder shell:
   - Left: Hermes chat (presentation mode prompt: “edit `deck.md` only…”)
   - Right: Marp slides preview + slide chrome (prev/next) optional
   - Center/simple editor option: optional YOLO v1 = chat-only; recommended v1.1 = markdown textarea or load `deck.md` in a monospaced editor pane
5. Save path: Hermes writes `deck.md`; preview API re-reads file and re-renders (cache-bust query like projects).

### Built-in template (`presentations-templates/simple-3-slides/`)

File layout:

```text
presentations-templates/simple-3-slides/
  deck.md                 # Marp source, max 3 slides
  theme.css               # optional minimal Marp theme (black/white), may be empty stub
  README.md               # one-line purpose for humans/agents
```

`deck.md` sketch (≤3 slides):

```markdown
---
marp: true
theme: default
paginate: true
size: 16:9
---

# Provoke curiosity.

A short Marp starter for AppLoop Presentations.

---

## What this is

- Plain Markdown slides via [Marp](https://marp.app/)
- Edited in AppLoop like a project
- Preview rendered live — no Next.js app runtime

---

## Next

- Chat to refine copy and hierarchy
- Keep it short: three slides is enough to start
```

Hard rule in template + agent skill: **do not exceed 3 slides** for this built-in starter (agents may expand only if user asks later; registry copy should still say “3-slide starter”).

---

## Domain model

### Filesystem

- Blueprint root: `presentations-templates/<templateId>/` (repo-tracked)
- Workspace root: `.apploop/presentations/<slug>/` (local-only, gitignored alongside projects)
- Canonical source file: `deck.md` (always)
- Optional: `theme.css` referenced from front matter or Marp `style:` / custom theme registration

### Database

New table `presentations` (Drizzle in `lib/db/schema.ts` + migration):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | uuid |
| `name` | text | display |
| `slug` | text unique | folder name |
| `workspace_path` | text | absolute/rel under presentations root |
| `template_id` | text | e.g. `simple-3-slides` |
| `source_file` | text | default `deck.md` |
| `hermes_session_id` | text nullable | same pattern as projects |
| `active_conversation_id` | text nullable | reuse conversations if we attach conversation → presentation_id **or** reuse projects table — **prefer separate FK path** |
| `status` | enum active/archived/deleted | |
| timestamps | | |

**Chat reuse strategy (recommended for v1):**  
Do **not** overload `projects` for presentations. Either:
- **A (preferred):** Extend conversations with optional `presentationId` XOR keep `projectId` by creating a thin *adapter* presentation service that stores chat on a flagship conversation table new column; migrations already cascade on `project_id`.  
- **B (pragmatic bootstrap):** Store presentations **as a soft kind of project** with `kind: presentation` — couples runtime assumptions badly.  
- **C (minimal coupling):** Presentation edit reuses current chat APIs by registering a synthetic/minimal project row — hidden cost.

**Plan recommendation: A** — `conversations.presentationId` nullable + check that exactly one of projectId/presentationId set; message/run tables keep conversation_id.  
If that migration is too heavy, **v1 shortcut:** maintain presentation-specific conversations table clone is worse; instead pass `presentationId` to a dedicated `/api/presentations/chat` that mirrors `/api/chat` with filesystem allow-root = presentation workspace only.

### Ports / runtime

Presentations **do not** allocate preview ports. No `runtimes` row. Preview is request/response HTML.

---

## UI map

| Route | Component | Behavior |
| --- | --- | --- |
| `/presentations` | inventory page | List + New + cross-links to Projects/Templates |
| `/presentations/new` | `PresentationCreateForm` + `CreateFlowShell` | name + template radio (1 built-in) |
| `/presentations/[presentationId]` | `PresentationBuilderShell` | chat + Marp preview (+ optional md editor) |
| `/api/presentations/[id]/preview` | route handler | read `deck.md`, render with `@marp-team/marp-core`, return HTML document with CSP for iframe |
| `/api/presentations/chat` (or extend `/api/chat`) | gateway | same AI SDK stream, presentation agent mode |

Nav: add Presentations link on projects + templates headers; add to home if present.

---

## Preview pipeline

1. Server loads workspace via path containment (`lib/security/paths.ts` style helpers for presentations root).
2. `new Marp({ html: true, ... })` with optional custom theme CSS.
3. Escape-hatch disable raw HTML if we want safer decks; Marp default allows limited HTML — prefer **html: false** for v1 unless template needs SVG.
4. Return full HTML document:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>/* marp css */</style>
  </head>
  <body>
    <!-- marp html -->
    <script>/* optional simple keyboard nav inside iframe */</script>
  </body>
</html>
```

5. Builder iframe `src={/api/presentations/[id]/preview?_t=${reloadKey}}` after Hermes turns / manual refresh.
6. Sandbox: `sandbox="allow-scripts"` only if Marp needs JS for paging; prefer CSS multi-section + AppLoop outer controls that postMessage `next|prev` if needed.

### Alternative considered: marp-cli watch server

Rejected for v1 — spawns processes like project runtime, multiplies lifecycle bugs. Core library HTML puts AppLoop back in control.

---

## Hermes integration

New agent mode: `presentation-edit`.

**Bundle additions** (under `.hermes/` and assembly in `lib/hermes/agents.ts`):
- Agent brief: edit only `deck.md` (+ optional `theme.css`); keep Marp front matter; respect 3-slide starter unless user expands; no npm/next ritual.
- Skill stub: `marp-presentations` (front matter keys, `---` slide separators, theme tokens, don’t break Marp).
- Hooks/security: path allowlist under presentation workspace; ban package install.
- Chat composition: no visual selection JSON for v1 (or disable inspect toggle in presentation shell).

`/api/chat` branch **or** dedicated route:
- Resolve presentation by id
- Assemble presentation agent bundle
- `workspacePath` = presentation dir
- Stream same as project-edit

Do **not** start/stop runtimes on open/close.

---

## Security

- Treat presentation ids, workspace paths, session ids as untrusted.
- Contain FS reads/writes under `.apploop/presentations` and `presentations-templates`.
- Preview HTML must not include builder secrets; no env bleed.
- Iframe sandbox; consider CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;`.
- No browser writes to markdown except through server actions / Hermes.

---

## Step-by-step plan

### Task 1: Domain types + built-in template registry

**Objective:** Mirror `lib/projects/templates.ts` for presentations.

**Files:**
- Create: `lib/presentations/templates.ts`
- Create: `presentations-templates/simple-3-slides/deck.md`
- Create: `presentations-templates/simple-3-slides/theme.css` (minimal or empty with comment)
- Create: `presentations-templates/simple-3-slides/README.md`
- Modify: `.gitignore` if needed so `.apploop/presentations/` ignored (if not covered by `.apploop/`)

**Content for registry:**

```ts
export const DEFAULT_PRESENTATION_TEMPLATE_ID = "simple-3-slides";

export const BUILT_IN_PRESENTATION_TEMPLATES = [
  {
    id: DEFAULT_PRESENTATION_TEMPLATE_ID,
    name: "Simple 3 Slides",
    description: "Minimal 16:9 Marp starter — title, body, next steps.",
    templatePath: "simple-3-slides",
    sourceFile: "deck.md",
  },
] as const;
```

**Verify:** unit test list/assert template exists.

---

### Task 2: Schema + repository + service

**Objective:** Persist presentations without passwording onto projects runtime.

**Files:**
- Modify: `lib/db/schema.ts` — add `presentations` table
- Create: `lib/db/migrations/00xx_presentations.sql` (+ journal) via `npm run db:generate` / migrate
- Create: `lib/presentations/repository.ts`
- Create: `lib/presentations/service.ts` — create/list/get/delete/archive, slugify name
- Create: `lib/presentations/store.ts` — singleton like projects
- Create: `lib/presentations/files.ts` — clone template → workspace, path helpers using `lib/security/paths.ts`
- Create: `lib/presentations/env-or-constants` — `PRESENTATIONS_ROOT = path.join(PROJECTS_ROOT_PARENT, 'presentations')` or `.apploop/presentations`

**Create path algorithm:**
1. Validate name
2. Allocate unique slug
3. Copy `presentations-templates/<id>/*` → `.apploop/presentations/<slug>/`
4. Insert DB row, status active
5. Return id for redirect

**Tests:** `tests/presentation-*.test.ts` for clone, slug uniqueness, path containment.

---

### Task 3: Server actions + preview API

**Objective:** Create/delete + Marp HTML preview.

**Files:**
- Create: `lib/presentations/actions.ts` — `createPresentationAction`, `deletePresentationAction`, `openPresentationAction` (touch timestamps only)
- Create: `app/api/presentations/[presentationId]/preview/route.ts`
- Browse: add `@marp-team/marp-core` (and `markdown-it` peer if required) to root `package.json` — **builder** dependency, not template node_modules

**Preview route pseudocode:**

```ts
const presentation = await service.require(id);
const deckPath = contain(presentation.workspacePath, presentation.sourceFile);
const markdown = await fs.readFile(deckPath, "utf8");
const marp = new Marp({ html: false });
// optionally marp.themeSet.add(themeCss)
const { html, css } = marp.render(markdown);
return new Response(wrapDocument(html, css), {
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "...",
    "Cache-Control": "no-store",
  },
});
```

**Verify:** route test with fixture markdown produces 3 `<section>` (Marp slides).

---

### Task 4: Inventory + create pages (reuse shell)

**Objective:** UX parity with projects/templates listings.

**Files:**
- Create: `app/presentations/page.tsx`
- Create: `app/presentations/new/page.tsx`
- Create: `components/presentations/presentation-create-form.tsx`
- Reuse: `components/projects/create-flow-shell.tsx`
- Modify: `app/projects/page.tsx`, `app/templates/page.tsx` — add Presentations nav link
- Modify: `app/page.tsx` if hub links exist

**Create form fields:**
- `name` (required)
- `templateId` radio — only Simple 3 slides

Success: `redirect(/presentations/${id})`. Local only (no Hermes on create).

---

### Task 5: Presentation builder shell

**Objective:** Edit/preview loop without Next runtime chrome.

**Files:**
- Create: `components/presentations/presentation-builder-shell.tsx`
- Create: `app/presentations/[presentationId]/page.tsx`
- Create: `components/presentations/presentation-preview-frame.tsx` (simpler than `PreviewFrame`: no route bar / runtime restart; keep reloadKey)

**Shell layout (v1):**
- Same resizable left chat / right preview as builder if low-cost to fork
- Strip: inspect mode, package policy, theme select for Next themes, runtime start/stop
- Keep: back home, presentation name, optional “Open markdown” later
- Chat: `useChat` with `id=presentationId`, transport to presentation chat API
- After stream ready: bump preview `_t=`

**Optional v1 stretch (recommended if cheap):** third pane or bottom drawer monospaced editor bound to `deck.md` via server action `savePresentationMarkdownAction` + load on mount. Can be deferred if chat-only is enough for first merge.

---

### Task 6: Hermes presentation mode

**Objective:** Generative edits to `deck.md` only.

**Files:**
- Modify: `lib/hermes/agents.ts` — mode `presentation-edit`
- Create: `.hermes/skills/.../marp-presentations/SKILL.md` (or under ui-builder bundle refs)
- Modify: chat route(s) to resolve presentation workspaces
- Security: command allow-list stays empty of npm for this mode; FS write parity with project-edit but root swapped

**Agent rules (paste into agent brief):**
- Source of truth: `deck.md`
- Valid Marp front matter (`marp: true`)
- Slide separator is a line containing only `---`
- Prefer concise 3-slide decks unless user asks for more
- Do not scaffold Next.js or install packages
- After edits: rely on AppLoop preview refresh

**Verify:** dry run `runProjectOnce`-equivalent or unit that bundle assembly returns mode and workspace.

---

### Task 7: Docs + seed + polish

**Objective:** Operable like projects/templates.

**Files:**
- Create: ```docs/README-USER-FLOW-PRESENTATIONS.md``` (TOC, APIs, DB, files — match projects/templates docs style)
- Modify: `README.md` / `docs/README-ARCHITECTURE…` only if lightly needed
- Modify: `AGENTS.md` ownership bullet for presentations
- Modify: `Makefile` help line if useful (`make` target optional no-op)
- Seed: not required for demo project clone; presentation templates are copied on create

**Validation suite:**
```bash
npm test -- tests/presentation*.test.ts
npm run lint
npm run typecheck
npm run db:migrate   # local
```

Manual:
1. Open `/presentations` → New → create “Demo Deck”
2. Confirm preview shows 3 Marp sections
3. Chat “make the title louder” → markdown changes → preview refresh
4. Confirm no process on 3100–3199 for this deck

---

## Files likely to change (summary)

**New**
- `app/presentations/**`
- `app/api/presentations/**`
- `components/presentations/**`
- `lib/presentations/**`
- `presentations-templates/simple-3-slides/**`
- `tests/presentation-*.test.ts`
- `docs/README-USER-FLOW-PRESENTATIONS.md`
- Drizzle migration for `presentations`
- Optional `.hermes` skill/agent snippets

**Modify**
- `lib/db/schema.ts`, migration journal
- `lib/hermes/agents.ts` (+ chat route)
- Nav links in projects/templates pages
- `package.json` (+ lock) for `@marp-team/marp-core`
- `AGENTS.md` brief ownership note
- `.gitignore` only if presentations root not already ignored

**Do not reuse as-is**
- `lib/runtime/*` for presentation preview
- Template-authoring Hermes-first create for v1
- Visual selector inspect pipeline

---

## Tests / validation

| Area | Command / check |
| --- | --- |
| Template registry | `npm test -- tests/presentation-templates.test.ts` |
| Workspace clone + path containment | `npm test -- tests/presentation-files.test.ts` |
| Marp render fixture | `npm test -- tests/presentation-preview.test.ts` |
| TS/UI | `npm run lint` && `npm run typecheck` |
| DB | migrate fresh; create presentation row |
| Manual browser | create → preview 3 slides → chat edit → reload |

---

## Risks, tradeoffs, open questions

1. **Chat data model coupling** — Reusing `conversations.projectId` vs presentation-specific chat API. Plan prefers dedicated chat path + presentation id to avoid fake projects.
2. **Marp HTML safety** — Prefer `html: false` unless needed; sanitize path to theme CSS.
3. **Editor UX** — Chat-only may frustrate power users; a simple markdown textarea is high value for low cost.
4. **BuilderShell fork vs flags** — Cloning a thinner `PresentationBuilderShell` is safer than littering `BuilderShell` with `mode === "presentation"`.
5. **Template authoring for decks** — Deferred; only one built-in 3-slide template.
6. **Export** PDF/PPTX via marp-cli — post-v1.
7. **Naming** — Folder `presentations-templates/` vs `templates/presentations/` — prefer sibling root **outside** Next app templates so create-project never offers Marp by mime accident.

### Defaults this plan locks unless you disagree

| Decision | Default |
| --- | --- |
| Create flow | Local clone only (like projects), full page `/presentations/new` |
| Preview | `@marp-team/marp-core` HTML iframe, no port |
| Built-in count | One template, max 3 slides |
| Chat | Presentation-specific mode + API; do not fake a Next project |
| Inspect mode | Off for v1 |
| Markdown editor pane | Nice-to-have same PR if shell fork is already open; else follow-up |
| Export PDF | Out of scope |

---

## Implementation order (when approved)

1. Template folder + registry + tests  
2. Schema/service/files + migrate  
3. Actions + preview API + marp-core dep  
4. List/create pages + nav  
5. Builder shell + preview frame  
6. Hermes mode + chat glue  
7. Docs + AGENTS note + manual smoke  

---

## Success criteria

- User can create a presentation from **Simple 3 Slides** without gateway.
- `/presentations/[id]` shows rendered Marp (3 slides) in black/readable default styling.
- Hermes can change title/body in `deck.md`; preview updates without Next runtime.
- Projects/templates flows remain behaviorally unchanged.
- No new preview port leak; workspace under `.apploop/presentations/`.
