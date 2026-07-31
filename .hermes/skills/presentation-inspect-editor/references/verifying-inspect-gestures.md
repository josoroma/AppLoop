# Verifying inspect-editor gestures from browser_console

The inspect editor's selection, drag, resize, and alignment-guide behavior lives in an
inline script inside the preview **iframe**. Playwright-style ref clicks target the parent
document, so gestures must be synthesized against `iframe.contentDocument`. These recipes
proved the multi-select group box, group drag, and alignment-guide fixes.

## Reach into the preview iframe

```js
const f = [...document.querySelectorAll('iframe')]
  .find(i => i.title?.includes('current slide'));
const d = f.contentDocument;
```

Always pass `view: f.contentWindow` in `MouseEvent` init, and `buttons: 1` for
mousedown/mousemove — the drag handler ignores events without a held button.

## Build a multi-selection

Modifier-click is how the editor adds to a selection. Fire the full
mousedown → mouseup → click triple; a bare `click` is not enough.

```js
const fire = (el, mod) => {
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true,
    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    metaKey: mod, shiftKey: mod, view: f.contentWindow };
  el.dispatchEvent(new MouseEvent('mousedown', o));
  el.dispatchEvent(new MouseEvent('mouseup', o));
  el.dispatchEvent(new MouseEvent('click', o));
};
fire(d.querySelector('section h1'), false);   // select
fire(d.querySelector('section h3'), true);    // add to selection
```

## Assert the selection chrome

```js
[...d.querySelectorAll('.apploop-inspect-box')].map(b => ({
  open: b.getAttribute('data-open'),
  group: b.getAttribute('data-group'),
  id: b.getAttribute('data-target-id'),
}));
[...d.querySelectorAll('.apploop-inspect-selected')].map(e => e.tagName);
```

Expected for a 2-element selection: exactly ONE box with `data-group="true"`, and
per-element outlines still on both (`["H1","H3"]`).

## Sweep a drag and sample guide state per step

This is the high-value pattern: hold the drag open across several `mousemove` steps and
read guide `data-open` at each, which turns "does the guide work" into a table you can
check against the ±6px threshold.

```js
const box = d.querySelector('.apploop-inspect-box[data-group="true"]');
const drag = box.querySelector('.drag');
const r = drag.getBoundingClientRect();
const o = (t, x, y) => new MouseEvent(t, { bubbles: true, cancelable: true,
  clientX: x, clientY: y, view: f.contentWindow, buttons: 1 });
const sx = r.left + r.width / 2, sy = r.top + r.height / 2;

drag.dispatchEvent(o('mousedown', sx, sy));
const out = [];
for (const dy of [8, 12, 14, 16, 18, 22]) {
  d.dispatchEvent(o('mousemove', sx, sy + dy));
  const b = d.querySelector('.apploop-inspect-box[data-group="true"]').getBoundingClientRect();
  out.push({ dy,
    groupCy: +(b.top + b.height / 2).toFixed(2),
    h: d.querySelector('#apploop-alignment-guides .horizontal').getAttribute('data-open'),
    v: d.querySelector('#apploop-alignment-guides .vertical').getAttribute('data-open') });
}
d.dispatchEvent(o('mouseup', sx, sy));
out;
```

Compute the expected snap point first so the sweep straddles it:

```js
const sec = d.querySelector('section').getBoundingClientRect();
const b = box.getBoundingClientRect();
const neededDy = (sec.top + sec.height / 2) - (b.top + b.height / 2);
```

A correct result opens the guide symmetrically around `neededDy` and closes it outside
±6px. Asymmetric or never-opening = the guide is measuring the wrong rect.

## Confirm a group drag moved every member

```js
const before = { h1: d.querySelector('section h1').getBoundingClientRect().left,
                 h3: d.querySelector('section h3').getBoundingClientRect().left };
// ...drag...
// both deltas must be identical; unequal deltas mean per-element clamping crept back in
```

## Rule out the harness before believing a reproduction

Synthesized gestures fail in ways the real UI does not, so a "reproduced" bug here is
guilty until proven otherwise. Twice in one session I reported a regression that was purely
my own probe: once reading parent state before the `postMessage` landed, once from a stale
node cached across a re-render. Both looked exactly like the product bug.

Before reporting, get one of these:

- **The same result with a different modifier / entry point.** If ⌘-click fails but
  Shift-click and the real toolbar path both work, suspect the probe.
- **Instrumentation, not inference.** Capture the `apploop-presentation-selection-state`
  messages and check the iframe emitted what you expected; that splits "iframe is wrong"
  from "parent is wrong" instead of guessing.
- **A wait long enough to be obviously sufficient** (~900ms after clicks, ~2500ms after a
  drag that round-trips a `deck.md` save), then re-read.

Corollary: a failing probe that starts passing when you *only* added a `setTimeout` never
found a product bug — it found your race. Don't ship a "fix" for it.

## Cleanup is mandatory

These gestures **persist to `deck.md`** (the editor autosaves element positions), so a
verification run dirties the seeded deck and pollutes later snapshots — filmstrip titles
start showing raw `<span class="apploop-el-...">` markup, which is the tell that you
forgot. Restore before finishing:

```bash
cp presentations-templates/<id>/deck.md .apploop/presentations/<slug>/deck.md
grep -c "apploop-el" .apploop/presentations/<slug>/deck.md   # expect 0
```
