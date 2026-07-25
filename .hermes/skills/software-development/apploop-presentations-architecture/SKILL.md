---
name: apploop-presentations-architecture
description: "Use when building AppLoop Marp presentations as a first-class surface: routes/DB under presentations, presentations-templates blueprints, marp-core preview without ports, presentation-edit Hermes bundle, and gateway prompt branching for deck.md."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [apploop, presentations, marp, markdown, gateway, architecture]
    related_skills: [apploop-builder-create-flows, hermes-gateway, security-review]
---

# AppLoop Presentations Architecture

## Overview

Presentations are a **third builder surface** parallel to projects and templates: plain Marp Markdown decks. Preview is server-rendered HTML via `@marp-team/marp-core`. No Next runtime ports.

## When to use

- Adding or changing `/presentations*` routes, create UX, builder shell
- Hermes `presentation-edit` mode, marp-builder bundle, or gateway instructions
- Slide counting, deck.md authoring rules, Simple 3 slides starter
- Deciding whether to fake presentations as projects (answer: **no**)

## Domain map

| Piece | Location |
| --- | --- |
| Routes | `/presentations`, `/presentations/new`, `/presentations/[id]` |
| Blueprints | `presentations-templates/<id>/` (sibling of `templates/`) |
| Workspaces | `.apploop/presentations/<slug>/` (`PRESENTATIONS_ROOT`) |
| Domain | `lib/presentations/*` |
| UI | `components/presentations/*` |
| Preview | `GET /api/presentations/[id]/preview` |
| Chat | `POST /api/presentations/chat` |
| Migration | `0010_presentations.sql` |
| Flow doc | `docs/README-USER-FLOW-PRESENTATIONS.md` |

Built-in starter: `simple-3-slides` — **3 slides max** unless user expands.

Create = local clone only → redirect `/presentations/:id`.

Builder panes (confirmed, user-validated): **CSS grid**  
`chat (~16–22rem) · fixed filmstrip (~14–18rem) · preview (1fr)` — **not** percentage resizable panels (they crush the strip).  
**No markdown editor** unless asked. Header home = **Presentations → `/presentations`**.  
**Inspect = multi-select + in-iframe visual editor** (align/drag/resize/colors/shadows/gradients; **Save changes** persists to deck.md; drag/resize mouseup auto-saves). Clear targets on slide change. After Hermes/save, bump `?_t=` and refetch `/slides`.

## Hermes presentation-edit

| Asset | Path |
| --- | --- |
| Agent | `.hermes/agents/presentation-builder.md` |
| Bundle | `.hermes/bundles/marp-builder/BUNDLE.md` |
| Skill | `.hermes/skills/marp-presentations/SKILL.md` |
| Command | `.hermes/commands/presentation-build.md` |
| Hook | `.hermes/hooks/presentation-scope-guard/HOOK.md` |

Assembly: `createPresentationAgentBundle()` in `lib/hermes/agents.ts`.

Extend skill/command/hook **type unions** in `lib/hermes/{skills,commands,hooks}.ts` before new ids.

Gateway: `createGatewayInstructions()` **must branch** on `mode === "presentation-edit"` with Markdown-only rules — **do not** inject generated-UI classname contract.

### Prompt hard rules

- Exact `workspacePath` only writable root
- Source of truth = `deck.md` (optional `theme.css`)
- Valid `marp: true` front matter; slide sep = lone `---`
- No npm / Next scaffold / projects / templates / blueprint edits
- Simple 3 slides length unless user expands

## Marp authoring

```markdown
---
marp: true
theme: default
paginate: true
size: 16:9
---

# Title

---

## Body
```

Preview uses **`html: true`** so inspect can persist `<span class="apploop-el-…">` wrappers. Prefer Markdown; use those spans only for style targeting.

### Pitfall — slide count off-by-one

Front matter is fenced with `---`. Splitting the whole file on `\n---\n` counts the closing fence → 4 for a 3-slide deck.

Fix: strip front matter first (`splitMarpDocument` / `countMarpSlides` in `lib/presentations/marp.ts`).  
Tests: `tests/presentation-marp.test.ts`.

### Pitfall — theme.css without `@theme`

Marpit errors with `Marpit theme CSS requires @theme meta` and preview 500s when bare `theme.css` is registered.

- `ensureMarpitThemeMeta()` injects `/* @theme apploop-presentation */` when missing
- `themeSet.add()` only; do not force as default when deck uses `theme: default` + `style:`
- try/catch invalid CSS; put real `@theme` on blueprint theme files
- Detail: [`references/marp-theme-css.md`](references/marp-theme-css.md)

### Filmstrip + single slide + inspect (confirmed product)

User preference: **full-width mini slides**, **narrow chat**, no markdown pane; **Inspect multi-select** with **in-iframe visual edit overlay**.

| API / query / msg | Purpose |
| --- | --- |
| `GET /api/presentations/[id]/slides` | Slide list metadata |
| `?slide=N` | Single-slide / thumbnail Marp HTML |
| `?slide=N&inspect=1` | Active slide + inspect editor assets |
| parent → iframe `set-selections` | Re-apply outlines + active styles after reload |
| iframe → `selection-state` | Source of truth for multi-select list + styles |
| iframe → `style-apply` | Persist overlay edits to `deck.md` |
| `?slide=filmstrip` | Legacy full-deck iframe (avoid as primary UI) |

#### Primary UI: CSS grid + native cards (REQUIRED)

Do **not** ship percentage splitters or a thin Marp iframe strip — both left the rail unusable (chat too wide / thumbs clipped).

Working shell (`presentation-builder-shell.tsx` + `.presentation-builder-grid`):

- Grid: `minmax(16rem,22rem) 18rem minmax(0,1fr)` (tighter under 1280/1024)
- Native scroll: `.presentation-filmstrip-scroll` + visible ~14px scrollbar
- Each slide = full-width **button** card: badge + title + `aspect-video` thumb (`pointer-events-none`, `max-w-full`)
- Click the **button**, not the iframe; **changing slide clears inspect targets**
- Inspect multi-select: toggle by path+tag+text; keep outlines; chips + Clear; chat lists **all** targets
- Single-slide iframe: `allow-scripts` + CSP `script-src 'unsafe-inline'`

#### Inspect visual editor (REQUIRED when Inspect is on)

In-iframe HUD from `lib/presentations/inspect-editor-assets.ts` (injected by `wrapMarpDocument` when `inspect=1`):

- Align H: left / center / right · V: top / middle / bottom (absolute placement % inside slide)
- Drag bar + corner/side handles for move/resize
- Live style fields: color, background, width/height, padding/margin, border, radius, opacity, typography, box-shadow, text-shadow, gradients
- Overlay stays near selection; **Revert** + **Save changes** (never label CTAs “Apply styles”)
- Cursor UX: crosshair only on slide content; HUD default/pointer/text; drag=move; handles=resize — never `body[data-inspect] * { cursor: crosshair !important }`

Parent responsibilities (`presentation-builder-shell.tsx`):

- Multi-select toggle; **`selection-state` is SoT** when present (do **not** double-toggle on inspect + selection-state)
- Clear targets on slide change / inspect off
- Header + chip tray + HUD = **Save changes** → `applyPresentationInspectStylesAction`
- **Drag/resize mouseup auto-saves** via `style-apply` (position must survive reload without a second click)
- After save: bump `?_t=` so preview reloads from saved deck
- Chat prompt includes all targets (+ style keys when set)

#### Style persistence into `deck.md`

`lib/presentations/inspect-styles.ts` + `applyPresentationInspectStylesAction`:

1. **Class identity = `slide|normalizedText` only** (NOT tag/path — after wrap DOM is `span.apploop-el-*` and path/tag hashes orphan CSS)
2. Wrap first text match on the target slide: `<span class="apploop-el-<hash>">…</span>` — peel nested prior wrappers
3. Upsert managed front-matter CSS block between  
   `/* @apploop-inspect-styles */` … `/* @apploop-inspect-styles-end */`
4. **CSS selectors = bare `.apploop-el-…`** (NOT `section .apploop-el-…`). Marpit already scopes front-matter under the slide `section`; adding `section` becomes `… section section .foo` and **never matches** → drag/save writes deck.md but reload forgets placement
5. Also inject `section { position: relative; }` in the managed block so absolute kids anchor
6. **Merge** existing managed entries still referenced in body — do not drop other elements when saving one selection
7. Require Marp `html: true` or wrappers are stripped at render

Tests: `tests/presentation-inspect-styles.test.ts` (incl. drag re-apply across tag/path change) + `tests/presentation-marp.test.ts`.

Detail: [`references/inspect-visual-editor.md`](references/inspect-visual-editor.md) · [`references/filmstrip-inspect-ux.md`](references/filmstrip-inspect-ux.md)

#### Pitfall — percentage panels crush the filmstrip

`react-resizable-panels` percentage defaults left the middle rail as a sliver while chat dominated. Prefer fixed CSS grid tracks.

#### Pitfall — Marp SVG filmstrip blank if used

Marp forces `svg { width:100vw; height:100vh }`. CSS order: modeCss → Marp css → **modeOverrides last** on `div.marpit > svg[data-marpit-svg]`. Prefer native cards.

#### Pitfall — `/*` inside TS template for `@theme`

Use `"/" + "*"` concat — raw `` `/* @theme` `` starts a real block comment.

#### Pitfall — JSX inspect tag display

Use plain text / template strings, not angle-bracket JSX tag fragments.

#### Pitfall — double-toggle multi-select

If the iframe emits both `inspect` (with `selected` bool) and `selection-state`, parent must treat **selection-state** as SoT. Toggling again from inspect messages desyncs chips vs outlines.

#### Pitfall — style apply without reload

Persisting CSS wrappers while keeping a stale iframe src shows old markup. Always `setPreviewKey` / `?_t=` after Save changes.

#### Pitfall — drag/save forgotten after reload (CRITICAL)

Three bugs often stack:

1. Rules written as `section .apploop-el-*` → Marpit double-scopes → no match after reload  
2. Class hash includes CSS `path` or `tag` → after wrap node is `span`, new hash, old CSS orphaned  
3. Drag only applied inline styles until manual save — mouseup must auto-`style-apply`

Fix: bare `.apploop-el-*` selectors, hash `slide|text` only, merge retained entries, auto-save on drag end. Recipe: `references/inspect-visual-editor.md`.

#### Pitfall — HUD forced to crosshair

Never set `body[data-inspect] * { cursor: crosshair !important }`. Scope crosshair to the slide; restore default/pointer/text/move/resize inside `#apploop-inspect-hud` and handle boxes.

## Anti-patterns

- Faking decks as projects for ports/chat reuse
- Blueprints under `templates/`
- Mode-flagging full Next `BuilderShell` instead of thin presentation shell
- Keeping a markdown editor after filmstrip UX is requested
- Loading skeleton `theme.css` without `@theme`
- Injecting project classname gateway instructions into `presentation-edit`
- Filmstrip CSS only on bare `section` while Marp uses SVG shells
- Presentation builder home linking to `/projects`
- Percentage resizable three-pane layout that widens chat and clips mini slides
- Single-select-only Inspect (must toggle multi-select + clear on slide change)
- Inspect without align/style overlay when user asks for direct visual edit
- CTAs labeled “Apply styles” — user-facing name is **Save changes**
- Hash class names on CSS path/tag (orphans after wrap)
- CSS `section .apploop-el-*` under Marpit front-matter scoping (never matches after reload)
- Drag/resize without auto-save / without `?_t=` reload
- HUD `cursor: crosshair !important` on all descendants
- Persisting styles via whole-file rewrite of unrelated slides
- Marp `html: false` after style wrappers are in play

## Ops related

`make hermes-gateway` should run `hermes gateway run --replace` — port kill alone leaves Hermes PID/lock blocking restart.

## Verification

```bash
npm test -- tests/presentation-marp.test.ts tests/presentation-inspect-styles.test.ts
npx eslint "app/presentations/**/*.{ts,tsx}" "components/presentations/**/*.{ts,tsx}" "lib/presentations/**/*.{ts,tsx}" "app/api/presentations/**/*.{ts,tsx}"
npm run db:migrate
```

Manual: create Simple 3 slides → rail full-width thumbs → select slide 2 → Inspect multi-select 2 elements → unselect by re-click → overlay align/color/drag on active → **Save changes** (or release drag to auto-save) → deck.md has single span + bare `.apploop-el-*` rules that still match after reload → change slide clears chips → chat includes remaining targets.

## Related

- Builder listing/create UX: `apploop-builder-create-flows` + `references/presentations-create-and-chat.md`
- Support files: `references/gateway-presentation-edit.md`, `references/filmstrip-inspect-ux.md`, `references/marp-theme-css.md`, `references/inspect-visual-editor.md`
- In-repo Hermes skill for deck edits: `.hermes/skills/marp-presentations` (manual skill; keep style-wrapper rules synced when editing agent bundle assets)
