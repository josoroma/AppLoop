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

## Selection chrome: ONE box per selection, not one per element

`updatePositionBox()` in `inspect-editor-assets.ts` has two distinct paths — do not collapse them back into a per-element loop:

- **2+ selected** → exactly ONE `.apploop-inspect-box` sized to the union rect of all selected elements (`groupUnionRect(entries)`), `data-group="true"`, dashed border, a single DRAG handle. Handles and the delete button are hidden for groups. `data-media="true"` only when EVERY selected element is media (`isMediaSelection` for all entries) — otherwise the whole group box becomes an unexpected drag surface.
- **1 selected** → the per-element box (`single.item` / `single.el`), `data-group="false"`.

Per-element visual feedback still comes from the `.apploop-inspect-selected` class on each element, so users see individual outlines inside the one group bounding box. Group drag continues to work because `beginBoxGesture` resolves the box's `data-target-id` to the active item and then snapshots ALL of `selected`.

**Layers panel must mirror the selection**, not just the active target — if N elements are
outlined on the slide, exactly N layer rows must be highlighted. A panel keyed only on
`activeTargetId` silently disagrees with the canvas whenever 2+ elements are selected.

Do **not** match on strict id equality alone. A selected target's `id`
(`path::tag::text`) drifts whenever its path or wrapper changes — style patches, drags, and
list/wrapper rewrites all rewrite it (`syncItemToVisibleElement` reassigns `item.id`) — and
a strict compare then drops the highlight with no visible error. Build a resolved id set in
`presentation-builder-shell.tsx` with positional/textual fallbacks:

```tsx
const selectedLayerIds = useMemo(() => {
  const ids = new Set<string>();
  for (const target of selectedTargets) {
    ids.add(target.id);
    const match = layerTargets.find((layer) => (
      layer.id === target.id
      || (layer.tag === target.tag && layer.path === target.path)
      || (layer.tag === target.tag && layer.text === target.text)
    ));
    if (match) ids.add(match.id);
  }
  return ids;
}, [layerTargets, selectedTargets]);
```

Then per row: `isSelectedLayer = selectedLayerIds.has(layer.id)`, and give the active row the
same `tag + path` fallback so the active element is never left unhighlighted:

```tsx
const isActiveLayer = activeTargetId === layer.id
  || (activeTarget != null && activeTargetId !== null
      && layer.tag === activeTarget.tag && layer.path === activeTarget.path);
// active: border-sky-400 bg-sky-400/10 · selected: border-sky-400/60 bg-sky-400/5 · else: border-white/10
```

Verify across element kinds, not just headings — pills (`span.pill`, tag `pill`) and SVG
shapes (tag `svg`, id text `data-apploop-shape="..."`) take different id paths than block
text, plus `Select all` (every row must light) and a group drag (count must survive it).

### Parity is BIDIRECTIONAL — the panel must also drive the slide

Highlighting layer rows to match the canvas is only half the contract. Selecting N rows
**in the panel** must outline those same N elements on the slide, with one group box. The
default `selectLayerTarget` replaced the whole selection with a single target, so the panel
could never express a multi-selection at all.

The iframe bridge already accepts an array — `apploop-presentation-set-selections` maps over
`data.targets` and re-resolves each `path` — so no iframe change is needed. Make the parent
send the full array and support additive clicks:

```tsx
const selectLayerTarget = useCallback((target: PresentationLayerItem, additive = false) => {
  setSelectedTargets((current) => {
    let nextTargets: PresentationSelectionTarget[];
    let nextActiveId: string | null;
    if (!additive) {
      nextTargets = [target];
      nextActiveId = target.id;
    } else if (current.some((item) => item.id === target.id)) {
      nextTargets = current.filter((item) => item.id !== target.id);   // toggle OFF
      nextActiveId = nextTargets.length ? nextTargets[nextTargets.length - 1]!.id : null;
    } else {
      nextTargets = [...current, target];                              // toggle ON
      nextActiveId = target.id;
    }
    setActiveTargetId(nextActiveId);
    currentSlideFrameRef.current?.contentWindow?.postMessage(
      { type: "apploop-presentation-set-selections", targets: nextTargets, activeId: nextActiveId },
      "*",
    );
    return nextTargets;
  });
}, []);
```

Pitfalls:

- **Compute inside the `setSelectedTargets` updater**, not from the captured `selectedTargets`
  — additive clicks arrive faster than the re-render, and reading stale state makes the 3rd
  ⌘-click drop the 2nd selection.
- **Wire the modifier on every click surface of the row, but let exactly ONE handler run per
  click.** The row `div` and the inner label `<button>` both have `onClick`. Patching only one
  makes multi-select work in part of the row and silently reset in the rest — but wiring both
  without stopping propagation is worse: a click on the label fires the button handler *and*
  bubbles to the row handler, so an additive click toggles the layer ON then immediately OFF
  and the count never leaves 1. The inner button must `event.stopPropagation()` before
  selecting:

  ```tsx
  <button type="button" onClick={(event) => {
    event.stopPropagation();   // row wrapper also handles selection — don't double-count
    selectLayerTarget(layer, event.metaKey || event.ctrlKey || event.shiftKey);
  }}>
  ```

  Accept `metaKey || ctrlKey || shiftKey` (mac + Windows/Linux). The eye/lock/delete icon
  buttons must keep their existing `stopPropagation()` so they never mutate selection.
  **Any nested-clickable row is exposed to this class of bug** — an idempotent action (plain
  replace-selection) hides it completely, because firing twice looks identical to firing once.
  Only toggling actions reveal it, so audit propagation whenever you make a row handler additive.
- **Toggle-off must reassign `activeTargetId`** to the last remaining target (or `null` when
  emptied), otherwise the active id points at a deselected element and no row renders active.
- Advertise it — the panel subtitle carries `Top layer first · ⌘/Shift-click to multi-select`;
  an invisible modifier is an undiscoverable feature.

Verify all four transitions, asserting panel count == slide count each time: plain click (1),
⌘-click to build up (2, 3), ⌘-click a selected row (toggles back down), plain click (resets to
1). Start from a **cleared** slide selection so you prove the panel is the driver.

## Alignment guides must measure the SELECTION, not the grabbed element

Centering guides live in `#apploop-alignment-guides` (`.vertical` / `.horizontal`, ±6px
threshold against the section center). The guide geometry must be driven by a **rect**, not
an element, so a group can supply its union rect:

- `updateAlignmentGuidesForRect(rect, options)` — the geometry (was inlined in the
  element-taking function).
- `updateAlignmentGuidesForElement(el, options)` — thin wrapper over the rect version.
- `currentSelectionRect()` — union rect over all `selected` items, resolved through
  `visibleElementForItem` + `visualRectForElement` (same resolution chain as
  `updatePositionBox`, so SVG shapes measure by bbox).
- `updateAlignmentGuidesForSelection(fallbackEl, options)` — uses the union when
  `selected.length > 1`, else falls back to the single element.

Both movement paths must call the *selection* variant: `handleDragMove` (pointer drag) and
`moveSelectedBy` (arrow keys).

**Symptom of getting this wrong** (real bug): with a group selected, the vertical
(x-centering) guide appears but the horizontal (y-centering) guide never does. Cause was
passing `dragging.el` — one member's rect. Its center X often coincidentally matches the
group's, so the vertical guide looks fine while the center Y almost never matches the slide
center, making the horizontal guide unreachable. **A guide that works on one axis but not
the other is the signature of measuring one element instead of the group.**

Also: in `moveSelectedBy`, evaluate guides ONCE after the whole move loop, not per element
inside it — a per-element call inside the loop leaves the guides describing whichever
element happened to be last, and does redundant layout reads.

## Image insert must fit the slide

Inserting an oversized image raw overflows the slide. `insertSlideImage` measures the asset then emits Marp size directives. See `references/image-fit-to-slide.md` for the full recipe (slide-size parsing, alt-token preservation, "Fit to slide" button).

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

`tests/presentation-marp.test.ts` asserts on the inline iframe script with **exact
`expect(assets.script).toContain("...")` string literals**. Any refactor of
`inspect-editor-assets.ts` that renames a variable (e.g. `item, el` → `single.item,
single.el`) breaks those assertions even though behavior is correct. Expect to update
them in the same commit; grep the failing literal out of the vitest diff rather than
guessing which assertion moved.

When live-verifying against a seeded deck, revert your edits afterwards — `cp
presentations-templates/<id>/deck.md .apploop/presentations/<slug>/deck.md` restores the
template state, and drop any test assets you dropped into `assets/`. Gesture verification
autosaves to `deck.md`, so skipping this leaves raw `<span class="apploop-el-...">` text as
filmstrip slide titles in the next session.

Selection/drag/guide behavior lives in the preview **iframe**, so gestures must be
synthesized against `iframe.contentDocument` — see
`references/verifying-inspect-gestures.md` for the multi-select, drag-sweep, and
guide-threshold recipes (including how to sample guide `data-open` at each step of one
held-open drag).

For slide ↔ layers-panel parity in **both** directions (N outlined ⇒ N highlighted rows, and
N rows clicked ⇒ N outlined) see `references/verifying-selection-parity.md` — it covers
reading both documents in one expression, sweeping pill/SVG/heading id paths, seeding an
initially-empty panel before driving it, and the `postMessage` timing trap that fakes a
reproduction if you read the panel synchronously after clicking.

```bash
npm test -- tests/presentation-marp.test.ts tests/presentation-inspect-styles.test.ts
npx eslint "lib/presentations/inspect-*.ts" "lib/presentations/actions.ts" "components/presentations/presentation-builder-shell.tsx"
```

Repo-wide `npm run typecheck` / `npm run lint` are drowned in pre-existing
`templates/*/node_modules` noise (duplicate `@types/three`, unresolved template aliases).
Scope to touched files instead: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E
"^(components|lib)/presentations"` and `npx eslint <files>`.
