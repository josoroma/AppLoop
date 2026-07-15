# Multi-Select State API

## Zustand Store (`use-builder-ui-store.ts`)

```typescript
type BuilderUiState = {
  selectedElements: VisualSelection[];
  toggleSelectedElement: (selection: VisualSelection) => void;
  updateSelectedElementRect: (preferredSelector: string, boundingRect: VisualSelection["boundingRect"]) => void;
  removeSelectedElement: (preferredSelector: string) => void;
  clearSelectedElements: () => void;
};
```

### `selectedElements: VisualSelection[]`
Ordered list of currently selected elements. Deduplicated by `preferredSelector`. Each element's `preferredSelector` serves as the toggle key.

### `toggleSelectedElement(selection)`
Adds if `preferredSelector` is not in the list, removes if it is. Must only be called for non-`update` messages (real clicks, not tracking updates).

### `updateSelectedElementRect(preferredSelector, boundingRect)`
Maps over `selectedElements` and replaces the `boundingRect` of the matching element. This keeps selection overlays in position after DOM changes (code edits, scroll, resize). Does NOT add or remove elements. Called by tracking updates (100ms interval with `update: true`).

### `removeSelectedElement(preferredSelector)`
Removes a single element by its `preferredSelector`. Used by the checkbox uncheck handler in `builder-shell.tsx`. Does NOT toggle — always removes.

### `clearSelectedElements()`

Clears all selections. Called on:
- Prompt send (in form submit handler, alongside `clearScreenshots()`)
- Runtime stop (via `useEffect` watching `runtimeStatus === "stopped"`)
- Project switch (via `useEffect` watching `projectId`)
- "Clear all" button in targets area

## Selection Flow

```
iframe click
  → inspector-provider: handlePointerDown()
    → postMessage("apploop:inspector-select", selection)

parent preview-frame: handleMessage()
  → if (update === true):
      updateSelectedElementRect(selection.preferredSelector, selection.boundingRect)
      (keeps overlays positioned; does NOT toggle)
  → if (update !== true):
      toggleSelectedElement(selection)
      toast("Target toggled: ...")

builder-shell: selectedElements (Zustand subscription)
  → renders checkbox tags above prompt area
  → checkbox onChange → removeSelectedElement(preferredSelector)

form submit
  → createVisualSelectionPrompt(prompt, selectedElements)
  → sends all targets as bulleted list to Hermes
  → uses selection.preferredSelector directly (NOT getClassNameSelector)
```

## Tracking Updates (100ms interval)

The inspector-provider runs a tracking interval that sends `apploop:inspector-select` with `update: true` for the last-clicked element. These messages serve TWO purposes:

1. **Update bounding rects** — after a code change or scroll, the element's position changes. `updateSelectedElementRect()` syncs the stored bounding rect so overlays stay positioned correctly.
2. **Must NOT toggle** — toggle would flip the element on/off every 100ms, causing visible blink.

```typescript
// CORRECT — toggle only on real clicks, update rect on tracking
if (event.data.update === true) {
  updateSelectedElementRect(selection.preferredSelector, selection.boundingRect);
} else {
  toggleSelectedElement(selection);
}

// WRONG — toggles every 100ms, causes blink
toggleSelectedElement(selection);
```

## Effect Dependencies

`selectedElements` must NOT be in the `useEffect` dependency array of the `handleMessage` handler. Every toggle would re-register the message listener, causing a render cascade.

```typescript
// CORRECT — toggleSelectedElement is stable (Zustand), selectedElements removed
}, [historyIndex, postInspectorEnabled, previewNonce, previewOrigin,
    projectId, runtimeStatus, setHoveredElement, toggleSelectedElement,
    updateSelectedElementRect]);

// WRONG — selectedElements causes re-registration on every toggle
}, [..., toggleSelectedElement, selectedElements]);
```

If `selectedElements` state is needed inside the effect handler (e.g., for a toast), use a `useRef` synced via a separate `useEffect`. Never mutate refs during render (`react-hooks/refs` lint rule). Prefer generic messages that don't need current state.

## preferredSelector Uniqueness

`createSelectionPayload` in the template's `inspector-provider.tsx` resolves `preferredSelector` using:

```
preferredSelector = lastClassName ? `.${lastClassName}`
                  : semanticClassName ? `.${semanticClassName}`
                  : `.${classNames[0]}`;
```

The **last classname** is always the most specific / unique per-instance identifier. E.g. `metric-card summary-card metric-revenue` → `.metric-revenue`.

**Critical**: Both the builder's `SEMANTIC_BOUNDARY_CLASS_NAMES` array and the template's `SEMANTIC_CLASS_NAMES` Set must include all per-instance classnames. The Set is used by `createSelectionPayload` to find semantic matches in the template's iframe context; the array is used by the builder for `getClassNameSelector` and label display. They are independent copies — updating one without the other breaks multi-select.

When adding new unique classnames to templates:
1. Add to `lib/visual-selector/types.ts` → `SEMANTIC_BOUNDARY_CLASS_NAMES` array
2. Add to `templates/*/components/inspector-provider.tsx` → `SEMANTIC_CLASS_NAMES` Set
3. Verify multi-select works with 2+ instances

## Prompt Generation

`createVisualSelectionPrompt` in `lib/visual-selector/types.ts` now accepts `VisualSelection[]` and uses `selection.preferredSelector` directly:

```typescript
export function createVisualSelectionPrompt(message: string, selections: VisualSelection[]) {
  const targets = selections
    .map((s) => `- ${getClassNameLabel(s)} → ${s.preferredSelector}`)
    .join("\n");
  return `${message}\n\nTarget classnames (ONLY change these elements):\n${targets}\n\n...`;
}
```

**Why not `getClassNameSelector` or `getPreferredSelector`**: Those functions find the first semantic classname match (e.g. `.summary-card`), which is shared across all instances. Using them in the prompt tells Hermes to target `.summary-card` which matches ALL cards, not just the selected ones. `selection.preferredSelector` is the per-instance unique identifier.
