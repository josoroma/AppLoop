---
name: visual-selector
description: "Use when a user targets a preview element by selector or stable identifier: locate source, limit edits to the visual boundary, handle ambiguity, and report affected files."
version: 3.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [visual-selection, selectors, source-location, boundary-edits, screenshots]
    related_skills: [frontend-design, generated-app-standards]
---

# Visual Selector

## Overview

Use this skill when a user selects an element from the preview and asks Hermes to change that specific boundary. The selected boundary constrains source search and edit scope.

## When to Use

- The prompt includes a selector such as `.dashboard-header`, `[data-apploop-id="hero-title"]`, or a selected element payload.
- The user says "this", "selected element", or "selected section" and AppLoop provides selection metadata.
- A change must be limited to a visual boundary and required descendants.

Do not use this skill for full-page redesigns without a selected target.

## Selector Payload

Expected payload fields:
- `selector`: class, data attribute, or stable generated identifier.
- `route`: preview route where the selection was made.
- `textSample`: optional visible text near the target.
- `bounds`: optional preview rectangle.
- `componentHint`: optional source or component name from inspection metadata.

Users can paste screenshots (Ctrl+V / Cmd+V) into the prompt textarea for visual context alongside the selector. See Clipboard Image Paste below.

## Source-Location Workflow

1. Search exact selector or stable id inside `workspacePath`.
2. If multiple files match, narrow by route and component hint.
3. If still ambiguous, compare visible text and nearby semantic class names.
4. If no source match exists, generate a stable identifier fallback and add it to the smallest owning boundary.

## Boundary-Limited Editing Rules

- Change only the selected boundary and required descendants.
- Do not rewrite unrelated siblings or page shell structure.
- Preserve semantic class names unless renaming is required and all references are updated.
- Report every affected file.

## Ambiguous Selector Handling

- If multiple plausible boundaries remain, ask for clarification or choose the nearest route-owned match when the prompt is low risk.
- Never apply broad edits to all selector matches unless the user explicitly asks for every matching element.

## Stable Identifier Fallback

- Prefer `data-apploop-id` for generated stable identifiers.
- Use kebab-case values that describe the boundary, such as `dashboard-header` or `billing-plan-card`.
- Keep identifiers stable across visual-only changes.

## Template Classnames

Each generated project has a unique template classname on the root `<body>` element that identifies the template source:

| Template | Body classname |
|----------|---------------|
| `generated-nextjs-default` | `template-default` |
| `generated-nextjs-admin-luma` | `template-admin-luma` |

These classnames are in `SEMANTIC_BOUNDARY_CLASS_NAMES` and are recognized by inspect mode. When inspecting an element, check its ancestry for the template classname to identify which template generated the page. This helps resolve ambiguity when multiple templates share common semantic classnames like `dashboard-header` or `summary-card`.

When generating NEW code for a project, always preserve the template classname on the `<body>` element. Never remove it.

## Repeated Element Classnames

Repeated elements (cards in a grid, nav links, list items) need both a **shared base classname** (for grouping/styling) AND a **unique per-instance classname** (for precise inspect-mode identification).

Pattern: `{shared-base} {shared-base} {unique-instance}` — e.g. `metric-card summary-card metric-revenue`.

Without the unique classname, all instances appear identical in inspect mode (`.metric-card .summary-card`). The user cannot target "the third card" without scrolling through ambiguous matches. With unique classnames, the selector becomes `.metric-card .summary-card .metric-revenue` which resolves to exactly one element.

When generating code, embed the unique classname in the data model driving `.map()`. E.g.:

```tsx
const metrics = [
  { label: "Revenue", value: "$128K", className: "metric-revenue" },
  { label: "Users", value: "24K", className: "metric-users" },
];

{metrics.map((m) => (
  <article className={`metric-card summary-card ${m.className}`} key={m.label}>
))}
```

The `generated-code-review` hook flags repeated elements missing unique per-instance classnames and rejects generic suffixes like `-1`, `-2`.

## Inspect Mode Behavior

Inspect mode supports **multi-select**: clicking an element toggles it — adds if new, removes if already selected. Multiple elements can be selected simultaneously, each showing its own overlay in the preview and a checkbox tag above the prompt.

When inspect mode is enabled:

- **Toggle selection** — clicking an element sends `apploop:inspector-select`. The parent toggles it in `selectedElements` via `toggleSelectedElement()`. Click a selected element again to deselect it.
- **Multiple overlays** — each selected element gets its own `SelectionOverlay` with a dashed border and classname label.
- **Checkbox tags above prompt** — each selected target appears as a `[✓] .classname` tag. Unchecking removes the selection and hides the overlay. A "Clear all" button removes all targets.
- **Prompt includes all targets** — `createVisualSelectionPrompt` now accepts `VisualSelection[]` and produces a bulleted list of all selected classnames with their preferred selectors.
- **Does NOT navigate** — link elements are not followed. The `handlePointerDown` handler no longer sends `apploop:preview-route` messages.
- **Does NOT capture screenshots** — no `captureElementScreenshot`, no `apploop:inspector-screenshot` or `apploop:request-screenshot` messages.
- **Does respond to keyboard navigation** — Alt+] and Alt+[ cycle through inspectable elements.

The Zustand store manages selections via:
- `selectedElements: VisualSelection[]` — ordered list, keyed by `preferredSelector` for dedup
- `toggleSelectedElement(selection)` — adds if not present, removes if present
- `updateSelectedElementRect(preferredSelector, boundingRect)` — updates the boundingRect of a matching selected element (called by tracking updates to keep overlays in position after DOM changes)
- `removeSelectedElement(preferredSelector)` — removes by selector (used by checkbox uncheck)
- `clearSelectedElements()` — clears all (called on prompt send, runtime stop, project switch, and "Clear all" button)

For the full store API, effect dependency rules, and tracking update handling, see `references/multi-select-store.md`.

## Preview Selection Label

The `preview-selection-label` appears above the selected element. The preview container has extra top padding (`pt-10`) to ensure the label is fully visible even when the selected element is near the top of the viewport. If the label appears clipped, check that the container's `overflow` and padding allow the label to render.

## Screenshots

**Automatic screenshot-on-click was removed.** The inspector-provider templates no longer capture screenshots or send screenshot messages on element click. No screenshot libraries (html2canvas, html-to-image) are in the template dependencies.

The `apploop:inspector-screenshot` message type is retained in `lib/visual-selector/types.ts` for backward compatibility but is no longer sent by the templates.

### Clipboard Image Paste (preserved)

Users can paste images (Ctrl+V / Cmd+V) into the prompt textarea. The `handleClipboardPasteStable` handler in `builder-shell.tsx` detects `image/*` clipboard items, uploads to the screenshot API, and shows an attachment preview. The handler is wrapped in `useCallback` with `[attachClipboardImage, projectId]` dependencies. Pasting text still works normally — only `image/*` clipboard items trigger the image handler.

Flow:
```
User presses Ctrl+V / Cmd+V in textarea
  │
  ▼
handleClipboardPaste(event: ClipboardEvent)
  ├── Scan event.clipboardData.items for image/* types
  ├── If image found: event.preventDefault()
  ├── item.getAsFile() → File
  ├── FileReader.readAsDataURL() → thumbnail
  ├── attachClipboardImage({ id, dataUrl, serverPath, source: "clipboard", filename })
  └── POST /api/projects/:id/screenshots (source="clipboard") — background upload for persistence
```

### Screenshot Storage API

`POST /api/projects/:projectId/screenshots`:
- Accepts `multipart/form-data` with fields: `file` (required), `selector`, `source`
- Validates: media type (allow-list), file size (≤10MB), magic bytes
- Stores to `data/screenshots/<projectId>/<uuid>.png`
- Inserts DB row in `screenshots` table
- Evicts oldest when project exceeds 50 screenshots
- Returns `{ screenshotId, url }`

`GET /api/projects/:projectId/screenshots/:screenshotId`:
- Serves the image file with correct `Content-Type` and `Cache-Control`
- Validates project access and screenshot ownership

### Builder State Management

The Zustand store (`useBuilderUiStore`) manages screenshots:

- `attachInspectorScreenshot(s)`: Appends; max 5 total
- `attachClipboardImage(s)`: Appends; max 5 total
- `removeScreenshot(id)`: Removes one by id
- `clearScreenshots()`: Called on send, on "Clear" button, on project switch

### Thumbnail Preview

Clicking any screenshot thumbnail opens a full-size preview in a modal dialog. The image is displayed at `object-contain` with viewport-constrained dimensions. Click outside or × to dismiss.

### Multiple Attachments

Each paste appends a new screenshot (capped at 5 total per message). Remove individual thumbnails with the × button.

## Key Files

| File | Role |
|------|------|
| `templates/…/inspector-provider.tsx` | Inspect mode element selection (no screenshot capture) |
| `components/builder/preview-frame.tsx` | IFRAME message handling, selection overlay, route sync |
| `components/builder/builder-shell.tsx` | Attachment UI, paste handler, send |
| `components/builder/use-builder-ui-store.ts` | Screenshot state (Zustand) |
| `app/api/projects/[projectId]/screenshots/route.ts` | Upload + retrieve API |
| `app/api/chat/route.ts` | Extracts images from message, passes to Hermes |
| `lib/hermes/client.ts` | `ImageAttachment` type, `images` in payload |
| `lib/visual-selector/types.ts` | `InspectorScreenshotMessage`, `ScreenshotAttachment` |

## Pitfalls

- **Templates have NO screenshot capture logic**: The inspector-provider only sends selection metadata via `apploop:inspector-select`. No `captureElementScreenshot`, no `apploop:request-screenshot`, no DOM-to-image libraries. If a user clicks an element and expects an automatic screenshot, explain that screenshots must be pasted manually.
- **Template changes don't propagate automatically**: Changes to `templates/…/inspector-provider.tsx` only take effect when a generated project is recreated or its runtime restarted.
- **Generated projects retain stale code**: When debugging inspect-mode behavior, always check `.apploop/projects/<slug>/components/inspector-provider.tsx`. The generated project may have an old version with screenshot capture logic that persists independently of template changes. Use `cp templates/generated-nextjs-default/components/inspector-provider.tsx .apploop/projects/<slug>/components/inspector-provider.tsx` to sync a specific project.
- **Feature iteration vs. removal**: If a visual feature produces incorrect output and the user rejects it 2+ times (\"not equal\", \"still not the same\"), stop trying different libraries/approaches and ask whether they want the feature removed entirely. Repeatedly swapping rendering approaches wastes effort when the user may prefer manual workflow.
- **Both templates share inspector-provider but differ at root**: The templates share an identical `inspector-provider.tsx` (keep them in sync). However, the layouts differ: `template-default` on the default `<body>` and `template-admin-luma` on the admin-luma `<body>`. When syncing the inspector-provider between templates: `cp templates/generated-nextjs-default/components/inspector-provider.tsx templates/generated-nextjs-admin-luma/components/inspector-provider.tsx`. Layout files and shell components (`app/layout.tsx`, `components/site-header.tsx`, `components/admin-shell.tsx`) differ between templates and should NOT be synced.
- **Wrong-template sync breaks preview**: Overwriting a generated project's `layout.tsx` with the wrong template (e.g. default's `SiteHeader` into an admin-luma project expecting `AdminShell`) causes a missing-module compilation error. The Next.js dev server hangs in a retry loop — `curl` times out but `lsof` shows the port is listening. Check which template a project uses before syncing: `grep "template-" .apploop/projects/<slug>/app/layout.tsx`. The body classname (`template-default` vs `template-admin-luma`) tells you which template to copy from.
- **`PreviewRouteMessage` type uses `unknown`**: To keep `isTrustedPreviewMessage` simple, the union type in `preview-frame.tsx` uses `unknown` for all message data fields rather than separate typed message sub-types.
- **Multi-select effect dependency causes flicker**: Adding `selectedElements` to the `useEffect` dependency array in `preview-frame.tsx` causes the message listener to re-register on every selection toggle, which triggers a render cascade that makes the target area blink. The fix: keep `toggleSelectedElement` in deps (it's stable via Zustand) but remove `selectedElements`. The overlay rendering updates via Zustand subscriptions, not the effect re-run. If a `selectedElements` read is needed inside the effect (e.g. for a toast message), use a `useRef` synced via a separate `useEffect` — never mutate refs during render (`react-hooks/refs` lint rule). Simpler: use a generic message like "Target toggled" that doesn't need current state.
- **Tracking updates toggle selections**: The inspector-provider runs a 100ms tracking interval that sends `apploop:inspector-select` with `update: true` for the last-clicked element. If the parent's `handleMessage` calls `toggleSelectedElement` for these update messages, the element toggles on/off every 100ms (add, then remove, then add...). The fix: handle update messages separately — use `updateSelectedElementRect` to keep overlays positioned correctly after DOM changes, and only call `toggleSelectedElement` for non-update messages (real clicks). Tracking updates should update rects, not toggle selections.
- **`preferredSelector` must be unique per instance**: All repeated elements (metric cards, nav links, panels) must resolve to different `preferredSelector` values for multi-select to work. The selector is used as the toggle key in `toggleSelectedElement` — if two cards both resolve to `.metric-card`, clicking the second one toggles the first one off instead of adding a second target. The fix has two parts: (a) add unique per-instance classnames to `SEMANTIC_BOUNDARY_CLASS_NAMES` in `lib/visual-selector/types.ts`, and (b) `createSelectionPayload` uses the LAST classname (most specific) as `preferredSelector` with semantic classname as fallback: `metric-card summary-card metric-revenue` → `.metric-revenue`. Always verify that repeated elements in a template produce different preferred selectors by testing multi-select with 2+ instances of the same component type.\n- **Prompt must use `selection.preferredSelector`, not `getClassNameSelector`**: `getClassNameSelector` returns the first semantic classname match (e.g. `.summary-card`), which is shared across all repeated elements. Using it in the prompt tells Hermes to target the shared base class, affecting ALL instances instead of just the selected ones. `createVisualSelectionPrompt` uses `selection.preferredSelector` directly, which is the unique per-instance selector (`.metric-revenue`, `.metric-open-issues`). Always verify the prompt output shows unique selectors, not shared classnames.