# Inspect Editor Pattern — Iframe Protocol

This document captures the full `postMessage` protocol between the presentation builder shell (parent) and the Marp slide preview iframe for inspect mode.

## Protocol Messages

### Parent → Iframe

| Message Type | Purpose | Payload |
|---|---|---|
| `apploop-presentation-set-selections` | Sync selection list to iframe | `{ activeId, targets: [{id, path, tag, text, style}] }` |
| `apploop-presentation-clear-selections` | Clear all selections | `{}` |
| `apploop-presentation-focus-target` | Activate a specific target | `{ id }` |
| `apploop-presentation-patch-style` | Apply style changes live | `{ id, style: { key: value } }` |
| `apploop-presentation-apply-all-styles` | Bulk apply styles to all targets | `{ targets: [{id, style}] }` |

### Iframe → Parent

| Message Type | Purpose | Payload |
|---|---|---|
| `apploop-presentation-slide-ready` | Iframe loaded | `{ slide, totalSlides }` |
| `apploop-presentation-selection-state` | Selection changed | `{ slide, totalSlides, activeId, targets }` |
| `apploop-presentation-style-apply` | Request save (drag end) | `{ slide, totalSlides, targets }` |

## Iframe Assets (`inspect-editor-assets.ts`)

The iframe script is injected via `buildPresentationInspectAssets()` in `wrapMarpDocument()` when `inspect=1`. It handles:

1. **Click to toggle select/unselect**: `resolveClickTarget()` finds the content node (prefers existing `apploop-el-*` wrapper), `toggleSelect()` adds/removes from the `selected` array
2. **Outlines**: `applySelectedOutlines()` adds `apploop-inspect-selected` class; active target gets `data-active-edit="true"` for yellow outline
3. **Live style preview**: `applyStyleToElement()` directly sets `element.style[key]` for instant feedback
4. **Drag/resize**: Selection box with drag bar and corner/side handles; calculates position as % of section bounding box
5. **Auto-persist**: On `mouseup` after drag/resize, emits `apploop-presentation-style-apply` to trigger server save

### CSS cursors

The iframe CSS must set cursor per element, NOT blanket `body * { cursor: crosshair }`:
- `body[data-inspect="true"]` → `cursor: crosshair` (default on slide background)
- HUD elements → `cursor: default` / `cursor: pointer` / `cursor: text`
- Drag handle → `cursor: move`
- Resize handles → `nwse-resize`, `ns-resize`, `ew-resize`

### Anti-patterns

- Do NOT put a floating HUD in the iframe — the inspector panel lives in the parent React app
- Do NOT emit `selection-state` and `inspect` separately; use `selection-state` as the single source of truth
- Do NOT hash tag or CSS path in element IDs; use `path::tag::text` for temporary identity only
