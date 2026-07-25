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

Inline elements (`<li>`, `<a>`, `<span>`, `<em>`, `<strong>`) ignore `width`/`height` even with `position: absolute`. **Always set `display: inline-block`** alongside `position: absolute` in drag/resize style patches.

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
