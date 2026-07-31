# Fitting inserted images to the slide (AppLoop presentations)

Problem: inserting an image whose natural size exceeds the slide (e.g. 3000x1200 into a
1280x720 deck) overflows the slide box. Fix: measure the asset in the browser, then emit
Marp size directives so the image is scaled down (never up) on insert.

## Slide size comes from front matter, not a constant

`lib/presentations/marp-utils.ts` (client-safe — no `node:fs`) owns:

- `readPresentationSlideSize(markdown)` — parses `size: 16:9` (1280x720), `4:3` (960x720),
  `4K` (3840x2160), `size: 1600x900` explicit pixels, or a `width:`/`height:` pair.
  Ratio forms like `size: 3:2` keep Marp's 720px reference height. Falls back to
  `DEFAULT_PRESENTATION_SLIDE_SIZE` = 1280x720.
- `fitImageToSlide(natural, slide, padding)` — aspect-preserving **downscale only**.
  Returns `{ width, height, scaled }`; `scaled: false` when it already fits, so callers
  can skip emitting directives. Returns zeros when dimensions are unknown.

`SLIDE_IMAGE_FIT_PADDING = 48` in `presentation-builder-shell.tsx` reserves margin per
axis, so a fitted 16:9 deck image maxes out at 1184x624.

## Measuring natural size

`measureImageNaturalSize(src)` builds a detached `new window.Image()`, resolves
`{ naturalWidth, naturalHeight }` on load, `{0,0}` on error, and has an 8s timeout guard
so a broken asset can never hang the insert. Guard `typeof window === "undefined"` for
SSR safety.

Build the src with the existing `presentationAssetSrc(presentationId, assetPath)` helper —
asset paths in `deck.md` are workspace-relative (`assets/foo.png`), not URLs.

## Two insertion surfaces

1. **On insert** — `insertSlideImage` emits `![alt w:1184 h:474](assets/x.png)`. Marp
   renders those alt tokens as `style="width:1184px;height:474px;"`. Only append the
   `w:`/`h:` hint when `fitted.scaled` is true.
2. **"Fit to slide" button** — for images already on the slide (or inserted by Hermes).
   `fitActiveImageToSlide` measures, then calls `patchSelectedTextStyle({ width, height,
   maxWidth: "100%" })`, which persists as an `.apploop-el-<hash> img { ... !important }`
   rule via the normal inspect-styles path.

## Pitfall: alt rename wipes Marp directives

Marp encodes sizing and filters as **alt-text tokens** (`w:600`, `h:400`, `bg`, `left`,
`fit`, `blur`, `grayscale`, ...). A naive alt-rename regex replaces the whole `![...]`
label and silently drops the sizing.

Fix in `presentation-builder-shell.tsx`:

- `MARP_IMAGE_ALT_TOKEN` regex classifies tokens.
- `splitMarpImageAltTokens(alt)` → `{ directives, label }`.
- `composeMarpImageAlt(newAlt, existingAlt)` → new label + preserved directives.
- The alt `<input>` displays `splitMarpImageAltTokens(activeTarget.alt).label` so the user
  never sees or types `w:1184` by hand.

## Verifying without a real file picker

The `<input type="file">` cannot be driven from `browser_console`. Instead:

1. Copy an oversized PNG straight into `.apploop/presentations/<slug>/assets/`
   (name it `<base>-<8 hex>.png` to match `listPresentationImageAssets` alt derivation).
2. Reload the builder page so `loadImageAssets` picks it up.
3. Fire the insert select with a native setter so React sees the change:
   ```js
   const s = [...document.querySelectorAll('select')]
     .find(x => x.title?.includes('Insert an uploaded image'));
   Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
     .set.call(s, 'assets/huge-test-aabbccdd.png');
   s.dispatchEvent(new Event('change', { bubbles: true }));
   ```
4. `grep` the emitted line in `deck.md` and fetch
   `/api/presentations/<id>/preview?slide=1` to confirm the rendered `<img style=...>`.
5. Clean up: remove the asset and revert `deck.md` (or `cp` the template deck back).

React `onBlur` handlers do not fire from a synthetic `blur` event. To commit an alt-text
input from the console, dispatch `input` then a `keydown` with `key: 'Enter'` (the field
blurs itself on Enter).

## Tests

`tests/presentation-marp.test.ts` covers slide-size parsing (named / explicit / fallback)
and the fit math (already-fits, wide downscale, tall downscale bound by the tighter axis,
no upscale, unknown dimensions).
