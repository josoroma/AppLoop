# Marp Image Sizing & Fit-to-Slide

Reference for `insertSlideImage` / `fitActiveImageToSlide` in
`components/presentations/presentation-builder-shell.tsx` and the helpers in
`lib/presentations/marp-utils.ts`.

## The problem

Uploading or inserting a large asset (e.g. 3000x1200 px) produced an `<img>` that
overflowed the 1280x720 Marp slide box. The old insert path emitted a bare
`![alt](path)` with no sizing, so Marp rendered the image at natural size.

## Slide box is 1280x720 (not the iframe size)

Marp renders into `svg[data-marpit-svg] viewBox="0 0 1280 720"` → `foreignObject`
→ `section`. All sizing math must use the **deck** slide size, never the live
iframe/preview rect.

Front-matter forms `readPresentationSlideSize()` handles:

| Front matter | Result |
|---|---|
| `size: 16:9` | 1280x720 (also the fallback default) |
| `size: 4:3` | 960x720 |
| `size: 4K` | 3840x2160 |
| `size: 1600x900` | 1600x900 (literal px, requires the `x` separator) |
| `size: 3:2` | ratio → 720px reference height (1080x720) |
| `width: 1024` + `height: 768` | 1024x768 |

Marp's named sizes are case-insensitive — lowercase the scalar before lookup.

## Fit math

`fitImageToSlide(natural, slide, padding)`:

- **Downscale only** — never upscale a small image. If it already fits, return
  the natural size with `scaled: false`.
- Aspect-preserving: `ratio = min(maxW/naturalW, maxH/naturalH)`.
- `SLIDE_IMAGE_FIT_PADDING = 48` reserves margin on *each* axis, so the usable
  box for a 16:9 deck is 1184x624 (Marp themes carry their own section padding).
- Unknown dimensions (`0`) return `{width: 0, height: 0, scaled: false}` — the
  caller must treat that as "couldn't measure" and skip emitting directives.

## Measuring natural size client-side

`measureImageNaturalSize(src)` uses `new window.Image()` with an 8s
`setTimeout` guard and a `settled` flag so `onload`/`onerror`/timeout can't
double-resolve. Guard `typeof window === "undefined"` for SSR.

Build the src with `presentationAssetSrc(presentationId, assetPath)`
(`/presentations/<id>/assets/<file>`); for an already-selected target, pass
`activeTarget.text` straight through when it starts with `/` or `http`.

## Two persistence paths (both needed)

1. **Insert path** — emit Marp alt-text directives:
   `![alt w:1184 h:474](assets/x.png)`. Marp turns those into
   `style="width:1184px;height:474px;"` on the `<img>`. Only append the hint
   when `scaled` is true, so already-fitting images stay clean.
2. **Fit to slide button** (existing image) — goes through
   `patchSelectedTextStyle({ width, height, maxWidth: "100%" })`, which persists
   through `inspect-styles.ts` as a managed CSS block:
   `.apploop-el-HASH img { width: 1184px !important; height: 474px !important; }`

## Pitfall: alt-rename wipes Marp directives

Marp encodes sizing **and** filters in the alt text (`w:`, `h:`, `bg`, `left`,
`right`, `fit`, `blur`, `brightness`, `contrast`, `drop-shadow`, `grayscale`,
`hue-rotate`, `invert`, `opacity`, `saturate`, `sepia`). A naive
`![${newAlt}](src)` rewrite in `updateImageAltInSlideMarkdown` silently drops
them and the image jumps back to full size.

Fix: `splitMarpImageAltTokens(alt)` → `{ directives, label }`, and
`composeMarpImageAlt(newAlt, existingAlt)` re-appends the preserved directives.
Also feed the alt **input's displayed value** through
`splitMarpImageAltTokens(...).label` so the user sees `huge test`, not
`huge test w:1184 h:474`.

## Verifying in the browser

1. Drop an oversized PNG into `.apploop/presentations/<slug>/assets/`.
2. Reload the builder page (the asset list is fetched on mount).
3. The "Insert an uploaded image into this slide" `<select>` is inside the
   collapsed **Images** toolbar group — clicking the group button re-renders and
   invalidates snapshot refs, so drive it from the console instead:
   use the native `HTMLSelectElement.prototype.value` setter then dispatch
   `new Event('change', {bubbles:true})` (React ignores a plain `.value =`).
4. Assert on `deck.md` (`grep` for the asset name) AND on the rendered preview:
   `fetch('/api/presentations/<id>/preview?slide=1')` then match `<img[^>]*>`.
5. For the alt input, a synthetic `blur` event does **not** fire React's
   `onBlur`. Dispatch `keydown` with `key: 'Enter'` instead — the handler calls
   `currentTarget.blur()` itself.
6. Clean up test artifacts from `.apploop/` (asset file, injected CSS block,
   wrapper div) before finishing.

## Tests

`tests/presentation-marp.test.ts` → `describe("presentation image fit to slide")`
covers named/explicit/fallback slide sizes, already-fits, wide-constrained,
tall-constrained, no-upscale, and unknown-dimension cases.
