# Inspect multi-select: scroll overlays stay glued

User signal: *“on inspect element mode selected boxes on scroll are mess”* — multi-select dashed boxes and labels drift/stick after iframe scroll even though tracking “runs.”

Protected skill `visual-selector` owns the general inspect surface; this note captures the **agent-verified fix** so create-flows / standards can keep providers in sync when that skill can’t be patched.

## Root causes (two layers)

### 1. Only last click tracked (classic)

`let selectedElement` + one update post/100ms ⇒ older selections keep stale `getBoundingClientRect()` after scroll.

**Required shape:**

```ts
const selectedElements = new Map<string, HTMLElement>()
// toggle by selection.preferredSelector
// publishTrackedSelections: iterate ALL keys, post update: true each
```

### 2. Map holds dead DOM nodes (this session)

Even with a full `Map`, values can detach after React re-render / soft mail swap / Suspense. Tracker hits `!document.contains(element)`, skips/deletes, **parent Zustand keeps the last good `boundingRect`** → boxes float off the real element.

**Required shape inside `publishTrackedSelections`:**

```ts
const resolveTrackedElement = (preferredSelector: string, current?: HTMLElement | null) => {
  if (current && document.contains(current)) return current
  try {
    const found = document.querySelector(preferredSelector)
    return found instanceof HTMLElement ? found : null
  } catch {
    return null
  }
}

for (const preferredSelector of [...selectedElements.keys()]) {
  const live = resolveTrackedElement(preferredSelector, selectedElements.get(preferredSelector))
  if (!live) {
    selectedElements.delete(preferredSelector)
    continue
  }
  selectedElements.set(preferredSelector, live)
  const selection = createSelectionPayload(live, projectId, previewNonce)
  if (selection) {
    window.parent.postMessage(
      { type: 'apploop:inspector-select', projectId, previewNonce, selection, update: true },
      parentOrigin,
    )
  }
}
```

Iterate `selectedElements.keys()` (copy array) — not only “as long as the node stays alive.”

## Parent / overlay (builder)

1. **Tracking messages must not toggle.** In `preview-frame.tsx`:

   ```ts
   if (event.data.update === true) {
     updateSelectedElementRect(selection.preferredSelector, selection.boundingRect)
   } else {
     toggleSelectedElement(selection)
   }
   ```

2. **Apply rect CSS vars during render**, not only in `useEffect([selection])` (effect lags under 100ms posts):

   ```tsx
   style={{
     ['--selection-x']: `${selection.boundingRect.x}px`,
     ['--selection-y']: `${selection.boundingRect.y}px`,
     ['--selection-width']: `${selection.boundingRect.width}px`,
     ['--selection-height']: `${selection.boundingRect.height}px`,
   }}
   ```

3. **Skip no-op store writes** in `updateSelectedElementRect` when `x/y/width/height` are unchanged — avoid thrashing header/overlays when nothing moved.

4. Geometry: `position: absolute` inside `.preview-viewport-frame`, no portal/fixed for selection boxes; frame has **no** `overflow-hidden`.

## Propagation checklist

When fixing inspect scroll drift:

1. Patch **every** `templates/*/components/inspector-provider.tsx` (same `resolveTrackedElement` block).
2. Rsync/copy into **every active** `.apploop/projects/*/components/inspector-provider.tsx` (workspaces keep stale providers).
3. Patch builder `preview-frame.tsx` + `use-builder-ui-store.ts` once.
4. Assert in `tests/generated-code-standards.test.ts` that providers contain:
   - `const selectedElements = new Map<string, HTMLElement>()`
   - `for (const preferredSelector of [...selectedElements.keys()])`
   - `resolveTrackedElement`
   - `document.querySelector(preferredSelector)`
   - not `let selectedElement: HTMLElement | null`

## Manual verify

Hard-reload builder → Inspect → multi-select two distant elements → scroll iframe content aggressively. Both boxes and labels must stay locked to text/nodes; no leftover boxes in empty space.