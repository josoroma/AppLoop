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

### Multi-Selected Repeated Cards

When the user provides multiple selected repeated elements and explicitly says to modify only those selector boundaries, prefer a single scoped CSS rule that combines the shared bases and each unique last classname, e.g. `.homepage-signal-card.summary-card.home-signal-realtime-inference`. This is safer than editing the shared base class (`.summary-card`, `.homepage-signal-card`) and safer than using only the unique classname if the same unique classname could appear in another context. Nested contrast fixes must also stay inside those same combined selectors, e.g. `.homepage-signal-card.summary-card.home-signal-realtime-inference .homepage-signal-value`.

For visual-only card theming such as gradients, borders, shadows, and nested text contrast, patch CSS only when the JSX already has correct base + unique classnames. Do not touch the mapped data or surrounding page structure unless the classnames are missing or duplicated.

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
| `default` | `template-default` |
| `admin-luma` | `template-admin-luma` |
| `ai-engineer-cv` | `template-ai-engineer-cv` |
| `deep-research-paper` | `template-deep-research-paper` |
| `luminous-rings` | `template-luminous-rings` |

These classnames are in `SEMANTIC_BOUNDARY_CLASS_NAMES` and are recognized by inspect mode. When inspecting an element, check its ancestry for the template classname to identify which template generated the page. This helps resolve ambiguity when multiple templates share common semantic classnames like `dashboard-header` or `summary-card`.

When generating NEW code for a project, always preserve the template classname on the `<body>` element. Never remove it.

## Template And Repeated Element Classnames

All user-visible generated/template UI elements need classnames for inspect mode. Use **shared/base classnames** for grouping/styling and a **unique, human-readable classname written last** for precise inspect-mode targeting.

Pattern: `{shared-base} {optional-shared-base} {unique-instance}` — e.g. `metric-card summary-card metric-revenue`, `hero-title admin-hero-title`, `panel-copy health-panel-copy`.

The inspector-provider chooses the **last classname** as `preferredSelector`. If two rendered elements share the same last classname, multi-select and targeted edits collide. Treat duplicate last classnames as a bug even if earlier base classnames differ.

Repeated elements (cards in a grid, nav links, list items) need both a shared base classname and a unique per-instance classname. Without the unique classname, all instances appear identical in inspect mode (`.metric-card .summary-card`). The user cannot target "the third card" without ambiguity. With unique classnames, the selector becomes `.metric-revenue` and resolves to exactly one element.

When generating code, embed unique classnames in the data model driving `.map()`, including child text elements:

```tsx
const metrics = [
  { label: "Revenue", value: "$128K", className: "metric-revenue" },
  { label: "Users", value: "24K", className: "metric-users" },
];

{metrics.map((m) => (
  <article className={`metric-card summary-card ${m.className}`} key={m.label}>
    <p className={`metric-label ${m.className}-label`}>{m.label}</p>
    <strong className={`metric-value ${m.className}-value`}>{m.value}</strong>
  </article>
))}
```

Avoid generic suffixes like `-1`, `-2`, `-a`, `-b`; use descriptive kebab-case names. The `generated-code-review` hook should flag missing `className`, duplicate preferred/last classnames, repeated elements missing unique per-instance classnames, and child text elements without base + unique classnames.

## Inspect Mode Behavior

Inspect mode supports **multi-select**: clicking an element toggles it — adds if new, removes if already selected. Multiple elements can be selected simultaneously, each showing its own overlay in the preview and a checkbox tag above the prompt.

When inspect mode is enabled:

- **Toggle selection** — clicking an element sends `apploop:inspector-select`. The parent toggles it in `selectedElements` via `toggleSelectedElement()`. Click a selected element again to deselect it.
- **Multiple overlays** — each selected element gets its own `SelectionOverlay` with a dashed border and classname label.
- **Checkbox tags above prompt** — each selected target appears as a `[✓] .classname` tag. Unchecking removes the selection and hides the overlay. A "Clear all" button removes all targets.
- **Prompt includes all targets** — `createVisualSelectionPrompt` now accepts `VisualSelection[]` and produces a bulleted list of all selected classnames with their preferred selectors.
- **Does NOT navigate** — links and buttons are fully disabled via injected CSS: `a[href], button { pointer-events: none; }`. A `<style id="apploop-inspector-disable-interactive">` element is added to `document.head` when inspect mode enables and removed on cleanup. This prevents hover effects, cursor changes, and all click events — pointer events pass through to parent elements so the inspector can still select the containing boundary. A capture-phase `handleClick` listener with `preventDefault()` + `stopPropagation()` runs as belt-and-suspenders, but `pointer-events: none` is the primary mechanism.
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

The `preview-selection-label` appears above the selected element. The preview container has extra top padding (`pt-14`, 56px) to ensure the label is fully visible even when the selected element is near the top of the viewport. If the label appears clipped, check that `overflow-hidden` is NOT on the `preview-viewport-frame` (it was removed to avoid clipping) and increase to `pt-16` or `pt-20`. The label is anchored to the right edge of the selection (`right: 0`) and extends leftward to avoid right-side viewport clipping.

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
| `components/builder/chat-checkpoints.tsx` | Checkpoint chips, New session button, Sessions dropdown trigger |
| `components/builder/session-history.tsx` | Paginated session history dropdown panel |
| `components/builder/hermes-context-usage.tsx` | Context usage display (message count, token bar, compaction/truncation) |
| `components/builder/json-highlight.tsx` | VS Code-style JSON syntax highlighting |
| `lib/chat/file-snapshot.ts` | Server actions for git-based file checkpoint/rollback |
| `lib/visual-selector/types.ts` | `InspectorScreenshotMessage`, `ScreenshotAttachment` |

### Chat Layout

The builder's chat panel uses CSS Grid (`grid-rows-[auto_1fr_auto]`) with `absolute inset-0` positioning inside a `relative` Panel wrapper to keep the textarea and buttons pinned at the bottom while the conversation area scrolls. Full explanation in `references/chat-layout-grid.md`.

Key layout rules:
- Panel wrapper: `className="relative"` to create a positioning context
- Section: `className="absolute inset-0 grid grid-rows-[auto_1fr_auto]"` — fills the Panel exactly
- Conversation area: `overflow-y-auto overflow-x-hidden` (vertical-only scroll)
- Never use `h-full` inside a react-resizable-panels Panel — the Panel uses `flex-basis` (percentage), not a definite `height`, so `height: 100%` doesn't resolve. Use `absolute inset-0` instead.
- Never use `overflow-auto` (both axes) — creates unwanted horizontal scroll. Use `overflow-y-auto overflow-x-hidden`.

### Collapsible Target JSON

User messages with "Target selections JSON:" are rendered with the JSON hidden by default in a collapsible `<details>` element with VS Code-style syntax highlighting via the `JsonHighlight` component:

```tsx
<details className="mt-2">
  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
    Target selections JSON:
  </summary>
  <div className="mt-2 max-h-64 overflow-auto">
    <JsonHighlight json={jsonContent} />
  </div>
</details>
```

The JSON is formatted with `JSON.stringify(selections, null, 2)` in `createVisualSelectionPrompt` for proper indentation. The `JsonHighlight` component (`components/builder/json-highlight.tsx`) uses regex-based tokenization to color: keys (`#9cdcfe`), strings (`#ce9178`), numbers (`#b5cea8`), booleans/null (`#569cd6`), and brackets (`#d4d4d4`) on a dark `#1e1e1e` background — matching the VS Code Dark+ theme. Click the summary to expand/collapse.

### Chat Checkpoints

The builder supports saving and restoring conversation checkpoints that snapshot the current chat state (messages, inspect mode targets, screenshots). Checkpoints are created **automatically on every prompt submit** with an associated git commit in the generated project workspace for file-level rollback.

Clickable chips appear above the conversation; clicking one restores to that point. Past user messages have an **"Edit & Resend"** button that reverts files (git reset), truncates chat, restores targets/screenshots, and pre-fills the textarea with the original prompt for editing.

See `references/chat-checkpoints.md` for architecture, store API, component structure, and restore logic.

## Pitfalls

- **Hot reload after Hermes changes**: The builder restarts the preview runtime after each Hermes response. When `chat.status` transitions from `"streaming"` to `"ready"`, `restartRuntimeAction` is called with the project ID. This kills the existing Next.js process and starts a fresh one — force-recompiling all CSS/JS from disk. This is preferred over iframe-reload approaches because Turbopack sometimes fails to detect file changes from external processes even with `CHOKIDAR_USEPOLLING=true`. The runtime restart is handled by a `useEffect` in `builder-shell.tsx` using a `prevStatusRef` pattern to detect the `"streaming"` → `"ready"` transition.
- **Templates have NO screenshot capture logic**: The inspector-provider only sends selection metadata via `apploop:inspector-select`. No `captureElementScreenshot`, no `apploop:request-screenshot`, no DOM-to-image libraries. If a user clicks an element and expects an automatic screenshot, explain that screenshots must be pasted manually.
- **Template changes don't propagate automatically**: Changes to `templates/…/inspector-provider.tsx` only take effect when a generated project is recreated or its runtime restarted.
- **Generated projects retain stale code**: When debugging inspect-mode behavior, always check `.apploop/projects/<slug>/components/inspector-provider.tsx`. The generated project may have an old version with screenshot capture logic that persists independently of template changes. Use `cp templates/default/components/inspector-provider.tsx .apploop/projects/<slug>/components/inspector-provider.tsx` to sync a specific project.
- **Feature iteration vs. removal**: If a visual feature produces incorrect output and the user rejects it 2+ times (\"not equal\", \"still not the same\"), stop trying different libraries/approaches and ask whether they want the feature removed entirely. Repeatedly swapping rendering approaches wastes effort when the user may prefer manual workflow.
- **Templates share inspector-provider but differ at root**: The templates share a common `inspector-provider.tsx` pattern (keep selector behavior in sync). However, layouts and shell components differ, and each template has its own body classname (`template-default`, `template-admin-luma`, `template-ai-engineer-cv`, `template-deep-research-paper`, or `template-luminous-rings`). When adding a new inspector event listener, apply it to every template's provider and verify all insertion points landed: (1) handler function definition, (2) `addEventListener` registration, (3) `removeEventListener` cleanup. Do NOT blindly copy layout or shell files across templates — sync only the provider behavior that should truly be shared.
- **Wrong-template sync breaks preview**: Overwriting a generated project's `layout.tsx` with the wrong template (e.g. default's `SiteHeader` into an admin-luma project expecting `AdminShell`) causes a missing-module compilation error. The Next.js dev server hangs in a retry loop — `curl` times out but `lsof` shows the port is listening. Check which template a project uses before syncing: `grep "template-" .apploop/projects/<slug>/app/layout.tsx`. The body classname (`template-default` vs `template-admin-luma`) tells you which template to copy from.
- **`PreviewRouteMessage` type uses `unknown`**: To keep `isTrustedPreviewMessage` simple, the union type in `preview-frame.tsx` uses `unknown` for all message data fields rather than separate typed message sub-types.
- **Multi-select effect dependency causes flicker**: Adding `selectedElements` to the `useEffect` dependency array in `preview-frame.tsx` causes the message listener to re-register on every selection toggle, which triggers a render cascade that makes the target area blink. The fix: keep `toggleSelectedElement` in deps (it's stable via Zustand) but remove `selectedElements`. The overlay rendering updates via Zustand subscriptions, not the effect re-run. If a `selectedElements` read is needed inside the effect (e.g. for a toast message), use a `useRef` synced via a separate `useEffect` — never mutate refs during render (`react-hooks/refs` lint rule). Simpler: use a generic message like "Target toggled" that doesn't need current state.
- **Tracking updates toggle selections**: The inspector-provider runs a 100ms tracking interval that sends `apploop:inspector-select` with `update: true` for selected elements. If the parent's `handleMessage` calls `toggleSelectedElement` for these update messages, the element toggles on/off every 100ms (add, then remove, then add...). The fix: handle update messages separately — use `updateSelectedElementRect` to keep overlays positioned correctly after DOM changes, and only call `toggleSelectedElement` for non-update messages (real clicks). Tracking updates should update rects, not toggle selections.

- **Multi-select scroll drift**: The inspector-provider must track **all** selected elements, not just the last clicked one. If it stores `let selectedElement` and only publishes one update per 100ms, earlier selected overlays keep stale `getBoundingClientRect()` values after the iframe scrolls, so boxes/labels become messy and misaligned. Use `const selectedElements = new Map<string, HTMLElement>()`, toggle entries by `selection.preferredSelector`, and in `publishTrackedSelections()` iterate every tracked element and send `update: true` for each. Apply this provider fix to every template and to any active generated workspace that already copied an older provider.
- **`preferredSelector` must be unique per instance**: All repeated elements (metric cards, nav links, panels) must resolve to different `preferredSelector` values for multi-select to work. The selector is used as the toggle key in `toggleSelectedElement` — if two cards both resolve to `.metric-card`, clicking the second one toggles the first one off instead of adding a second target. The fix has two parts: (a) add unique per-instance classnames to `SEMANTIC_BOUNDARY_CLASS_NAMES` in `lib/visual-selector/types.ts`, and (b) `createSelectionPayload` uses the LAST classname (most specific) as `preferredSelector` with semantic classname as fallback: `metric-card summary-card metric-revenue` → `.metric-revenue`. Always verify that repeated elements in a template produce different preferred selectors by testing multi-select with 2+ instances of the same component type.\n- **\"Wrong element\" corrections — similar class names**: When the user says \"you're modifying the wrong element\" after applying a targeted CSS change, the `preferredSelector` from the target selections JSON may point to an element the user didn't intend. This happens when multiple elements share similar class name patterns — e.g. `.dashboard-header` (top nav bar) vs `.dashboard-page-header` (hero section), or `.admin-hero` vs `.admin-header`. Before reapplying the change, search the page source for all class names that share a prefix with the `preferredSelector`, read each matching element's surrounding markup, and confirm which boundary the user actually wants. Don't blindly re-apply to a different class without verifying it's the intended target.\n\n- **Prompt must use `selection.preferredSelector`, not `getClassNameSelector`**: `getClassNameSelector` returns the first semantic classname match (e.g. `.summary-card`), which is shared across all repeated elements. Using it in the prompt tells Hermes to target the shared base class, affecting ALL instances instead of just the selected ones. `createVisualSelectionPrompt` uses `selection.preferredSelector` directly, which is the unique per-instance selector (`.metric-revenue`, `.metric-open-issues`). Always verify the prompt output shows unique selectors, not shared classnames.

- **Overlay clipping from parent overflow**: Selection overlays and dropdown panels get clipped when a parent container has `overflow-hidden` or `overflow-auto`. The root cause is the CSS overflow property on an ancestor — not stacking context. `z-index` alone cannot fix this; the element is geometrically clipped regardless of z-index. Two patterns handle this, with different tradeoffs:

  1. **Dropdown panels** (session history, menus): Use `createPortal(children, document.body)` to render outside the DOM hierarchy. Position via `getBoundingClientRect()` on a trigger button ref + `fixed` CSS. Add an invisible `fixed inset-0` backdrop at `z-[60]` for click-to-close, and the panel itself at `z-[61]`. Gate with `isClient` hydration check (`createPortal` fails during SSR with `document is not defined`). See `session-history.tsx` for the pattern.

  2. **Preview overlays** (selection labels, hover indicators): **Do NOT use portals or `position: fixed` for overlays that should scroll with the preview content.** Instead, render the overlay inside the `preview-viewport-frame` div using `position: absolute` with the raw bounding rect values from the iframe (`selection.boundingRect.x`, `.y`). Remove `overflow-hidden` from the container so the overlay is not clipped. The overlay uses CSS custom properties: `left: var(--selection-x); top: var(--selection-y)` where x/y come from the iframe's `getBoundingClientRect()` values (relative to the container). Tracking updates (100ms interval) keep the overlay positioned correctly as the iframe scrolls. The overlay moves naturally with the preview content because it's a child of the scrollable container — unlike `position: fixed` portal overlays which stay pinned to the viewport.

  **Why portals failed for preview overlays**: The portal approach (`createPortal` to `document.body` with `position: fixed` and viewport frame offset) required SSR guards, frame offset math, and the overlay stayed fixed on screen even when the preview scrolled — the user expected it to scroll WITH the content. The tracking updates theoretically kept positions correct, but the `position: fixed` overlay felt disconnected from the element it highlighted. Rendering the overlay inside the container with `position: absolute` gives a natural, scroll-aligned experience.

  Never try to fix clipping with `z-index` alone — it does not work across overflow boundaries.

- **Overlay label expanding beyond container**: The `.preview-selection-label` should dynamically expand to fit its content instead of wrapping into a narrow column. Use `display: inline-grid` (sizes to content), `width: max-content` (expands to longest text), and `white-space: nowrap` (never wraps). Remove `overflow-wrap: anywhere` which forces wrapping. The label is `position: absolute` inside the overlay and positioned above the element via `translate: 0 calc(-100% - 4px)`. Add `max-width: min(22rem, calc(100vw - 2rem))` as a safety cap.

- **Effect-scoped style injection for inspect-mode CSS**: When inspect mode needs document-wide CSS (e.g. disabling links/buttons), inject a `<style>` element into `document.head` during the effect and remove it on cleanup. Pattern:
  ```typescript
  const STYLE_ID = "apploop-inspector-disable-interactive";
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "a[href], button{pointer-events:none;}";
    document.head.appendChild(style);
  }
  // ... in cleanup:
  document.getElementById(STYLE_ID)?.remove();
  ```
  This is cleaner than per-event listener interception for whole-category disabling — it prevents hover/cursor feedback AND click events in one shot. Always gate the injection on the same condition as the effect (e.g. `if (!enabled) return`) and clean up on unmount/disable. Never forget the cleanup — a leaked style persists across inspect-mode toggles.

- **React synthetic event nulled after await**: In async form submit handlers, `event.currentTarget` becomes `null` after an `await` call because React pools synthetic events. Always capture the form reference BEFORE the first `await`: `const form = event.currentTarget;` at the top of the handler, then use `form.reset()` and `new FormData(form)` instead of `event.currentTarget`. This is especially important in async handlers that call server actions like `createFileSnapshot`.