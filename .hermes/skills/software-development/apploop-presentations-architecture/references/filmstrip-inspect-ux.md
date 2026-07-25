# Filmstrip + single-slide preview + inspect

## Layout (confirmed product preference)

```
| narrow chat (~16–22rem) | fixed slide rail (~14–18rem) | preview (1fr) |
```

Prefer **CSS Grid** (`.presentation-builder-grid` in `app/globals.css`), not percentage `react-resizable-panels` for the three panes. Percentage splits kept crushing the middle rail into a sliver while chat took half the viewport (user-reported twice until grid.cfg).

```css
.presentation-builder-grid {
  display: grid;
  grid-template-columns: minmax(16rem, 22rem) 18rem minmax(0, 1fr);
  min-height: 0;
  width: 100%;
}
```

- No markdown editor pane unless the user explicitly asks for it.
- Header home control: **Presentations → `/presentations`** (not Projects).
- After Hermes completes: bump preview `_t=` and refetch `/slides` summaries.

## Primary UI: native slide cards (REQUIRED)

**Do not** use a thin full-deck Marp iframe as the main filmstrip. It repeatedly failed usability:

- Marp SVG slides default to `100vw × 100vh`
- Narrow percentage panels get clipped next to the preview
- Hit targets become slivers; users cannot click slides

### Working pattern

1. Metadata API: `GET /api/presentations/[id]/slides` → `getMarpSlideSummaries(deck.md)`
2. Fixed-width middle column (~18rem, responsive 14–16 on smaller screens)
3. Native scroll container `.presentation-filmstrip-scroll`:
   - `overflow-y-scroll` + `overflow-x-hidden`
   - `scrollbar-gutter: stable`
   - Visible track/thumb in `app/globals.css` (~14px)
4. Each slide is a full-width **`<button class="presentation-slide-card">`**:
   - Index badge + title
   - Large `aspect-video` thumbnail iframe (`?slide=N`, `pointer-events-none`, `max-w-full`)
   - Card: `w-full max-w-full box-sizing:border-box` so thumbs are not clipped
   - Click the **button** to select (not the iframe)
5. Active card: sky border / badge highlight; `scrollIntoView` on active change
6. **Slide change clears inspect targets**

### Single-slide preview iframe

- `?slide=N` or `?slide=N&inspect=1`
- Sandbox: `allow-scripts allow-same-origin` when inspect scripts run
- CSP for scripted modes needs `script-src 'unsafe-inline'`
- Parent keeps a `ref` to the iframe for selection sync

## Multi-select inspect (REQUIRED)

Project-style multi-select, adapted for Marp (path/tag/text, not unique last classname).

| Behavior | Rule |
| --- | --- |
| Select | Click element while Inspect is on |
| Unselect | Click the same element again (toggle by stable id = path+tag+text) |
| Multi | Many targets stay selected together |
| Visible | Selected nodes keep solid outline (`.apploop-inspect-selected`); hover is dashed |
| Clear on slide change | `selectSlide` / filmstrip click must `setInspectTargets([])` |
| Clear on Inspect off | Turning Inspect off clears the list |
| Clear all | Target list “Clear” control |
| Remove one | X on each target chip |

### Iframe ↔ parent contract

Iframe → parent:

```ts
{ type: 'apploop-presentation-inspect', slide, totalSlides, tag, text, path }
{ type: 'apploop-presentation-slide-ready', slide, totalSlides }
```

Parent → iframe (persist outlines after reload / toggle):

```ts
{ type: 'apploop-presentation-set-selections', paths: string[] }
{ type: 'apploop-presentation-clear-selections' }
```

Implementation notes (`lib/presentations/marp.ts` slide script + `presentation-builder-shell.tsx`):

- Parent holds `inspectTargets: PresentationInspectTarget[]` + `inspectTargetsRef` for async iframe ready
- On toggle: keep only same-slide targets; same `id` removes
- On `slide-ready` / iframe `onLoad`: `postMessage` current paths so outlines redraw after `_t` reload
- Hover class must not fight selected class
- Prefer concrete content nodes over bare `section` when resolving click target
- Chat prompt lists **all** targets (count + path/text each); if empty, scope to active slide only

Marp lacks project unique last classnames — do not promise full `visual-selector` parity. Paths are best-effort CSS paths inside the slide.

## Legacy iframe filmstrip (avoid)

`?slide=filmstrip` still exists. If used, **CSS order is load-bearing**:

1. modeCss
2. Marp-generated css
3. **modeOverrides last** forcing:

```css
div.marpit > svg[data-marpit-svg] {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 16 / 9 !important;
  flex: 0 0 auto !important;
}
```

Bare `section {}` rules do not fix Marp SVG shells. Prefer native cards anyway.

## Chat prompt attachment

Multi-select:

```
Target presentation selections:
- Slide: K of N
- Count: M
- 1. <h1> · path=… · text="…"
- 2. <p> · …
Edit only the selected elements on this slide in deck.md …
```

No selection:

```
Target presentation selection:
- Active slide: K of N
Prefer editing only this active slide …
```

Display inspect chips as plain text — avoid JSX angle brackets around tags.

## Implementation anchors

- `components/presentations/presentation-builder-shell.tsx`
- `app/api/presentations/[presentationId]/slides/route.ts`
- `app/api/presentations/[presentationId]/preview/route.ts`
- `lib/presentations/marp.ts` (`wrapMarpDocument` slide inspect script)
- `app/globals.css` (`.presentation-builder-grid`, `.presentation-filmstrip-scroll`, `.presentation-slide-card`)
