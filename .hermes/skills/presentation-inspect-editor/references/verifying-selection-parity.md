# Verifying slide ↔ layers-panel selection parity

The invariant is **bidirectional**: N elements outlined in the preview iframe ⇒ exactly N
highlighted rows in the parent's layers panel, and N rows selected in the panel ⇒ exactly N
outlined elements on the slide — with exactly one of them the emphasized *active* row either
way. Test both directions; each has its own failure mode (id drift going one way, a
selection-replacing handler going the other).

The selection lives in the iframe; the panel lives in the parent document. Parity bugs are
invisible in either half alone, so every check must read both in the same expression.

## Read both halves at once

```js
const f = [...document.querySelectorAll('iframe')]
  .find(i => i.title?.includes('current slide'));
const d = f.contentDocument;

const panel = () => [...document
  .querySelector('aside[aria-label="Layers panel"]')
  .querySelectorAll('div.group')]
  .map(x => ({
    l: x.textContent.slice(0, 24),
    s: /border-sky-400\/60/.test(x.className) ? 'sel'
      : /border-sky-400/.test(x.className)    ? 'ACT' : '-',
  }));

// the assertion
({ outlined: d.querySelectorAll('.apploop-inspect-selected').length,
   highlighted: panel().filter(r => r.s !== '-').length });
```

Order matters in the class regex: test the `/60` suffix **before** the bare
`border-sky-400`, otherwise every selected row reads as active.

## Sweep the element kinds that take different id paths

Block text alone will pass while pills and SVG shapes fail — they resolve through different
branches (`pill` tag on a wrapper `span`, `svg` tag whose `text` is the
`data-apploop-shape="..."` marker). Drive all of them in one loop, clearing selection
between cases by clicking empty slide margin:

```js
const cases = {
  'h1+p+h3': [d.querySelector('section h1'), d.querySelector('section p'), d.querySelector('section h3')],
  '3 h3s'  : [...d.querySelectorAll('section h3')].slice(0, 3),
  '3 svgs' : [...d.querySelectorAll('section svg')]
               .filter(s => s.querySelector('[data-apploop-shape]')).slice(0, 3),
  '3 pills': [...d.querySelectorAll('section .pill')].slice(0, 3),
};
for (const [name, els] of Object.entries(cases)) {
  d.body.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 3, clientY: 150, view: f.contentWindow }));
  await new Promise(r => setTimeout(r, 350));
  // click an SVG's inner marked primitive, not the <svg> wrapper
  els.forEach((e, i) => fire(e.querySelector?.('[data-apploop-shape]') || e, i > 0));
  await new Promise(r => setTimeout(r, 900));
  // record outlined vs highlighted
}
```

Also cover `Select all` (every row must light — e.g. 11 selected → 11/11) and re-read the
panel *after* a group drag: ids get rewritten mid-drag, so a count that was right before
and wrong after is the id-drift bug.

## Direction 2: panel-driven (clicking rows must outline the slide)

Same invariant, opposite driver. Two setup traps make this fiddly:

**The panel starts empty.** `layerTargets` is populated from the iframe's selection-state
message, so on a fresh load there are zero `div.group` rows and every
`rows[0].getBoundingClientRect()` throws `Cannot read properties of undefined`. Seed the
panel by selecting one element on the slide first, then clear the slide selection so the
panel is provably the driver:

```js
// 1. seed the panel
fire(d.querySelector('section h1'), false);
await new Promise(r => setTimeout(r, 1200));
// 2. clear the slide selection — assert it actually cleared
d.body.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 3, clientY: 150, view: f.contentWindow }));
await new Promise(r => setTimeout(r, 700));
d.querySelectorAll('.apploop-inspect-selected').length;   // expect 0
```

Polling for rows without seeding never succeeds — don't waste a 6s retry loop on it.

**Row clicks are parent-document events**, so pass `view: window` (not
`f.contentWindow`) and put `clientX/clientY` inside the row's own rect. **Dispatch on the
element the cursor would actually hit — the innermost clickable descendant, not the row
wrapper.** A row is a `div` containing a label `<button>` plus icon buttons; a real click
lands on the label and bubbles up, so dispatching on the wrapper exercises a path users
never take and can hide a genuine double-fire bug (see SKILL.md, "let exactly ONE handler
run per click"). This is the single most important detail in this file: it is how I shipped
a "verified" multi-select fix that did nothing in the browser.

```js
// WRONG — bypasses the label button, only fires the row handler once
const click = (row, mod) => { const r = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 8, clientY: r.top + 8, metaKey: mod, view: window })); };

// RIGHT — hits the label button, exactly like a user, and lets it bubble
const clickLabel = (row, mod, shift) => {
  const btn = row.querySelector('button');            // first button = the label
  const r = btn.getBoundingClientRect();
  btn.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true,
    clientX: r.left + 10, clientY: r.top + 6,
    metaKey: !!mod, shiftKey: !!shift, view: window,
  }));
};
```

Cover BOTH surfaces in the sweep — label button and the bare grip/padding area of the row —
plus one icon-button click asserting the selection count is unchanged. If the two surfaces
disagree, propagation is wrong somewhere.

Re-query `rows()` before each click — React re-renders the list on every selection change,
so a cached row node from before the previous click is detached.

Then walk all four transitions and assert `panel === slide` at each step:

```js
const snap = () => ({
  panel: rows().filter(x => /border-sky-400/.test(x.className)).length,
  slide: d.querySelectorAll('.apploop-inspect-selected').length,
});
clickLabel(rows()[0], false);      await pause(650);   // 1 / 1
clickLabel(rows()[1], true);       await pause(650);   // 2 / 2
clickLabel(rows()[2], true);       await pause(900);   // 3 / 3  + one data-group="true" box
clickLabel(rows()[1], true);       await pause(800);   // 2 / 2  (⌘ toggles off)
clickLabel(rows()[3], false, true);await pause(800);   // 3 / 3  (shift also adds)
clickGrip(rows()[4], true);        await pause(800);   // 4 / 4  (non-label surface agrees)
clickLabel(rows()[5], false);      await pause(800);   // 1 / 1  (plain click resets)
// eye icon must NOT change the count
rows()[0].querySelectorAll('button')[1].dispatchEvent(
  new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
await pause(1200);                                     // still 1 / 1
```

A run that reports `1 / 1` at every step is the double-fire signature, not a stubborn
selection bug — check propagation before touching the reducer.

Also confirm the 3-row case yields exactly ONE
`.apploop-inspect-box[data-open="true"][data-group="true"]` and a `3 elements selected`
toolbar — same chrome as a slide-driven group, or the two paths have diverged.

Mix element kinds here too (a heading + an SVG shape + another heading); the panel resolves
targets through the same `path`-rewriting bridge as the canvas.

## The false negative that will fool you

Selection state reaches the parent over `postMessage`
(`apploop-presentation-selection-state`) and lands one React commit later. Reading the panel
in the **same synchronous expression** that fired the clicks reports the *previous*
selection — I "reproduced" a nonexistent pill bug this way, seeing 3 pills outlined while
the panel still showed the earlier H1/H3/P rows.

Always `await new Promise(r => setTimeout(r, ~900))` after the last click, and after a drag
allow ~2500ms (the drag also round-trips a `deck.md` save). If you want proof rather than a
sleep, capture the messages:

```js
const msgs = [];
const h = e => { if (e.data?.type === 'apploop-presentation-selection-state')
                   msgs.push((e.data.targets || []).map(t => t.id)); };
window.addEventListener('message', h);
// ...clicks...  then compare the final msgs entry against the panel rows
```

A growing `[1] → [1,2] → [1,2,3]` sequence confirms the iframe side is correct, which
localizes any remaining mismatch to the parent's row-matching logic.

## Cleanup

These interactions autosave. Restore the seeded deck before finishing:

```bash
cp presentations-templates/<id>/deck.md .apploop/presentations/<slug>/deck.md
grep -c "apploop-el" .apploop/presentations/<slug>/deck.md   # expect 0
```

Note: after a `make seed`/reset the presentation **UUID changes**, so a bookmarked
`/presentations/<old-id>` 404s. Re-read it rather than assuming:

```bash
sqlite3 .apploop/builder.sqlite "select id,name,status from presentations"
```
