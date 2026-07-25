---
name: presentation-inspect-styling
description: "Use when building or extending the AppLoop presentations inspect/visual-editor system: selection, drag/resize, style persistence into Marp markdown, undo/redo, and the right-side inspector panel."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [presentations, inspect, marp, styling, persistence]
    related_skills: [marp-presentations, frontend-design, hermes-gateway]
---

# Presentation Inspect & Styling System

## Overview

The inspect engine lets users click elements on rendered Marp slides, apply visual styles via a right-side panel, and persist them into the Markdown source (`deck.md`). Four layers work together:

1. **Iframe inject** (`lib/presentations/inspect-editor-assets.ts`) — Selection, outlines, drag/resize, `postMessage` to parent
2. **Parent builder shell** (`components/presentations/presentation-builder-shell.tsx`) — Right inspector panel, undo/redo, delete
3. **Style persistence** (`lib/presentations/inspect-styles.ts`) — Inline styles + managed CSS block
4. **Server actions** (`lib/presentations/actions.ts`) — Save styles and delete elements

## Architecture invariants

### Marp rendering
- Must use `new Marp({ html: true, script: false })` — without `html: true`, `<span class="apploop-el-...">` wrappers are stripped
- Front-matter `style: |` CSS is auto-scoped by Marpit — do NOT prefix selectors with `section`
- Marp outputs SVG-wrapped slides: `div.marpit > svg[data-marpit-svg] > foreignObject > section`
- Filmstrip mode requires `width: 100% !important; height: auto !important; aspect-ratio: 16/9` overrides

### Style persistence format
- **Inline `style="..."` on wrapper spans** — Primary mechanism, survives Marp reload
- **Managed CSS block** (`/* @apploop-inspect-styles */` ... `/* @apploop-inspect-styles-end */`) inside front-matter `style: |` — Backup and merge surface
- Always include `section { position: relative; }` in the block for absolute children
- Class names: `SHA1(slide_index + normalized_text)` — stable across tag/path changes
- Never hash tag or CSS path into class names — they change after wrap

### Message protocol (parent ↔ iframe)
| Direction | Type | Purpose |
|---|---|---|
| iframe → parent | `selection-state` | Full snapshot of selections + styles |
| iframe → parent | `style-apply` | Save on drag-end or Apply click |
| iframe → parent | `slide-ready` | Iframe loaded → push selections |
| parent → iframe | `set-selections` | Restore outlines after reload |
| parent → iframe | `clear-selections` | Deselect all |
| parent → iframe | `focus-target` | Highlight one target |
| parent → iframe | `patch-style` | Live style update to one target |
| parent → iframe | `apply-all-styles` | Bulk apply to multiple targets |

### Inspector panel layout
- 4-column CSS grid (`.presentation-builder-grid-inspector`): chat | filmstrip | preview | inspector
- Panel opens when inspect is on and selections exist
- Alignment buttons (L/C/R, T/M/B) set `position: absolute; left/top; z-index: 3`
- Fields: colors, size/spacing, typography, effects (shadows, gradients)
- All inputs live-patch the iframe via `patchStyle` message
- Save button persists to deck.md; Reset clears local overrides

### Undo/redo
- History stack tracks full deck.md snapshots
- Reads/restores via `/api/presentations/markdown` POST endpoint
- 30-step limit
- Triggers preview refresh on undo/redo

## Pitfalls

1. **Styles not surviving reload** — Class-only CSS rules are fragile. Always write inline `style=""` on the wrapper span as the primary persistence mechanism. The CSS block is a backup.
2. **Double-toggle on click** — Trust `selection-state` as source of truth; ignore raw `inspect` messages when the iframe also emits `selection-state`.
3. **Drag position as percentages** — Dragging computes `left/top` as percentages of the section bounding box. This works at any scale because Marp sections are 1280×720 internally.
4. **Tag/path in class hash** — After saving, the DOM node changes (e.g. `p` → `span.apploop-el-xxx`). If the class hash includes the tag, subsequent saves mint a new class and orphan the old CSS. Hash from `slide + text` only.
5. **Filmstrip blank** — Marp's default `svg { width: 100vw; height: 100vh }` CSS makes filmstrip slides invisible. Override with `width: 100% !important; height: auto !important; max-height: none !important`.
6. **Delete orphans** — Delete must strip wrapper spans AND prune the managed CSS block of unreferenced classes.

## Files

| File | Role |
|---|---|
| `lib/presentations/marp.ts` | Render + wrap + inject `buildPresentationInspectAssets` |
| `lib/presentations/inspect-editor-assets.ts` | Iframe JS/CSS: selection, drag/resize, messages |
| `lib/presentations/inspect-styles.ts` | Markdown persistence: wrap, CSS block, merge |
| `lib/presentations/actions.ts` | Server actions: apply styles, delete element |
| `components/presentations/presentation-builder-shell.tsx` | Builder UI + inspector panel + undo/redo |
| `app/api/presentations/markdown/route.ts` | Full-deck save endpoint |
| `app/api/presentations/[id]/preview/route.ts` | Preview with `?slide=` + `?inspect=` |
| `app/globals.css` | Grid layouts for builder + inspector |

## Support files

- `references/inspect-architecture.md` — Full architecture reference with protocol tables, code snippets, CSS overrides, and preview API contract
- `templates/inspect-ready-deck.md` — Starter deck template with inspect-ready wrappers and managed CSS block

## Prevented behaviors

- Do NOT build in-iframe floating HUDs — use the right-side panel in the parent React app
- Do NOT prefix CSS selectors with `section` in the managed block
- Do NOT skip `html: true` in the Marp constructor
- Do NOT hash tag or CSS path into class names
