# Presentations create + chat (builder UX)

## Surface

| Route | Purpose |
| --- | --- |
| `/presentations` | Inventory + archive/delete |
| `/presentations/new` | Full-page create (`CreateFlowShell`) |
| `/presentations/[id]` | Chat · filmstrip · single-slide Marp preview |
| `GET /api/presentations/[id]/preview` | `@marp-team/marp-core` HTML (`slide=filmstrip\|N`, optional `inspect=1`) |
| `POST /api/presentations/chat` | Hermes `presentation-edit` |

## Create rules

- **Local only** — clone `presentations-templates/<id>/` → `.apploop/presentations/<slug>/`
- Built-in starter: `simple-3-slides` (max 3 slides unless user expands later)
- Blueprints live in `presentations-templates/`, **not** under `templates/` (avoids create-project pollution)
- DB: `presentations` + `presentation_conversations` (+ messages). Migration `0010_presentations`
- Env: `PRESENTATIONS_ROOT` default `.apploop/presentations`
- Success: `redirect(/presentations/${id})` — never fake a project runtime/port

## Builder shell (confirmed UX)

Thin presentation shell (do **not** mode-flag full Next `BuilderShell`):

1. Left: chat (`useChat` id=presentationId, transport `/api/presentations/chat`)
2. Center: vertical **filmstrip** iframe (`?slide=filmstrip`) — click to select
3. Right: **single-slide** preview (`?slide=N`, optional `&inspect=1`)

**No markdown editor pane** — Hermes writes `deck.md`; optional Inspect attaches slide element text/path to the next chat prompt.

After Hermes stream ready / manual refresh: bump `?_t=` on **both** iframes.

Filmstrip/inspect need `sandbox="allow-scripts allow-same-origin"` and CSP `script-src 'unsafe-inline'`.

See **`apploop-presentations-architecture`** → `references/filmstrip-inspect-ux.md`.

## Hermes prompt branch

When assembling runs, `mode: "presentation-edit"`:

- Bundle: `marp-builder` (`createPresentationAgentBundle`)
- Agent: `presentation-builder`
- Command: `/presentation-build`
- Hook: `presentation-scope-guard` (block npm + path escape)
- Gateway instructions must be **Markdown/Marp only** — do not inject generated-UI classname contract

Hard rules for Hermes:

- writable root = presentation workspace only
- source of truth = `deck.md` (optional `theme.css` with `@theme` meta)
- keep `marp: true` front matter and lone-line `---` separators
- Simple 3 slides stays at 3 unless user asks for more
- If prompt includes `Target presentation selection` / slide K, edit that slide only

## Pitfalls

- Slide-count off-by-one: strip YAML front matter before splitting on `---` (`splitMarpDocument`)
- Preview 500 `Marpit theme CSS requires @theme meta`: bare `theme.css` — use `ensureMarpitThemeMeta` / proper blueprint theme
- Presentation inspect ≠ project unique-last-classname inspect

## Listing CTAs

Cross-link Projects ↔ Templates ↔ Presentations on all three headers.

## Docs

- `docs/README-USER-FLOW-PRESENTATIONS.md`
- Architecture skill: **`apploop-presentations-architecture`**
