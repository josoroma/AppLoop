---
name: presentation-inspect-editor
description: "Use when building, debugging, or modifying the AppLoop presentation visual inspector — multi-select, style persistence, drag/resize, undo/redo, delete, or right-side panel editing."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [presentations, inspect, editor, marp]
    related_skills: [marp-presentations, security-review]
---

# Presentation Visual Inspector

## Overview

The presentation builder includes an inspect-and-edit mode with: multi-select, drag/resize, alignment, style fields, delete, undo/redo, and inline text editing. The inspector panel lives in the parent builder shell (not a floating overlay in the iframe).

## CSS scoping (Marpit)

Marpit scopes front-matter CSS under `div.marpit > svg > foreignObject > section`. Writing `section .apploop-el-xxx { }` produces `... section section .apploop-el-xxx` — **never matches**. Always use bare `.apploop-el-xxx { }`.

## Inline-style durability

Class-only rules are fragile. **Always pair with `style="..."`** attributes on wrapper spans. Use `makeWrapperOpenTag()` in `inspect-styles.ts`.

## Element identity

Class names hash `sha1(slide | normalized_text)` only. **Do not include tag or path** — they change after wrapping.

## Client/server boundary

`lib/presentations/marp.ts` imports `node:fs/promises`. **Never import it from a client component.** All mutations must go through server actions in `lib/presentations/actions.ts`.

## Drag/resize pitfall

Inline elements (`<li>`, `<a>`, `<span>`, `<em>`, `<strong>`) ignore `width`/`height` and `transform` as plain inline boxes. **Always set `display: inline-block`** alongside `position: absolute` (resize) or `transform` (movement) style patches.

## Movement is transform-only and flow-preserving (multi-select group drag)

Element movement (mouse drag and arrow keys) in `inspect-editor-assets.ts` applies **only a `transform: translate(...)`** patch — never `position: absolute`/`left`/`top`. The element keeps its slot in normal flow, so moving one or many elements can never reflow, shift, or resize any other slide element; moved elements simply overlap freely.

Rules that keep this correct:

1. **Snapshot before mutating**: `beginBoxGesture` builds one `dragSnapshotForItem` per selected item (rect + `currentElementTranslate`) BEFORE any style patch, and `moveSelectedBy` computes all move styles in a first pass before applying them in a second pass.
2. **Group-wide clamp**: `groupBoundedDelta` clamps the shared drag delta once for the whole group, so relative positions stay rigid at slide edges (never clamp per element — that distorts the group).
3. **Scale correction**: mouse deltas are rendered px; divide by `sectionRenderScale()` to get slide CSS px before writing `transform`.
4. **Inline elements**: transforms do not apply to non-replaced inline boxes — `moveStyleForElement` adds `display: inline-block` when the computed display is `inline`.
5. **Group persistence**: `emitStyleApply` sends all `selected` items, so every group member's transform persists to `deck.md`.

## Undo architecture

- `persistStyles` reads `previousMarkdown` from the server action response (do not use a separate fetch — brittle)
- `handleUndo`/`handleRedo` push/pop `undoStack`/`redoStack` and `saveMarkdownToServer` for snapshots
- Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) use refs to avoid unstable `useCallback` deps
- `/api/presentations/[id]/slides` must return `markdown` for undo consumers

## Inspector panel architecture

- Inspect mode toggled in header; panel opens on first selection
- Iframe sends `apploop-presentation-selection-state` with current targets
- Panel applies style patches via `postMessage({ type: "apploop-presentation-patch-style", ... })`
- Iframe applies patches live; emits selection-state to sync parent

## Message types

Iframe → parent: `slide-ready`, `selection-state`, `style-apply`, `delete-element`, `text-edit`.
Parent → iframe: `set-selections`, `clear-selections`, `focus-target`, `patch-style`, `apply-all-styles`.

## Key files

| File | Role |
|---|---|
| `lib/presentations/inspect-styles.ts` | CSS generation, wrapper insertion, hashing |
| `lib/presentations/inspect-editor-assets.ts` | Inline iframe script: selection, drag, delete button, double-click editor |
| `lib/presentations/marp.ts` | Marp render, wrapMarpDocument (CSS + script injection) |
| `lib/presentations/actions.ts` | Server actions for persistence |
| `components/presentations/presentation-builder-shell.tsx` | Chat, filmstrip, preview, inspector panel |
| `app/api/presentations/[id]/preview/route.ts` | Preview (slide, filmstrip, inspect) |
| `app/api/presentations/[id]/slides/route.ts` | Summaries + raw markdown |
| `app/api/presentations/markdown/route.ts` | Full-deck read/write for undo |

## Server actions

| Action | Purpose |
|---|---|
| `applyPresentationInspectStylesAction` | Persist style targets to deck.md |
| `deletePresentationElementAction` | Remove text + wrappers from slide |
| `deletePresentationSlideAction` | Remove entire slide |

## Verification

```bash
npm test -- tests/presentation-marp.test.ts tests/presentation-inspect-styles.test.ts
npx eslint "lib/presentations/inspect-*.ts" "lib/presentations/actions.ts" "components/presentations/presentation-builder-shell.tsx"
```
