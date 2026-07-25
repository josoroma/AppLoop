# Presentation inspect visual editor

## Purpose

When Inspect is on for Marp slide preview, the user can multi-select elements and edit them **in place** (align, drag/resize, colors, shadows, gradients) with live preview, then persist into `deck.md`.

## Key files

| Piece | Path |
| --- | --- |
| Iframe HUD + drag/resize | `lib/presentations/inspect-editor-assets.ts` |
| Markdown/CSS persistence | `lib/presentations/inspect-styles.ts` |
| Server action | `applyPresentationInspectStylesAction` in `lib/presentations/actions.ts` |
| Wrap inject | `wrapMarpDocument(..., { inspect: true })` in `lib/presentations/marp.ts` |
| Parent shell | `components/presentations/presentation-builder-shell.tsx` |
| Tests | `tests/presentation-inspect-styles.test.ts` |

## Message protocol

| Direction | `type` | Role |
| --- | --- | --- |
| iframe → parent | `apploop-presentation-inspect` | Click tally (may include `selected` bool); **ignore** when selection-state follows |
| iframe → parent | `apploop-presentation-selection-state` | **Source of truth** for targets + styles + `activeId` |
| iframe → parent | `apploop-presentation-style-apply` | User hit **Save changes**, or drag/resize `mouseup` auto-save |
| iframe → parent | `apploop-presentation-style-reverted` | Active target local overrides cleared |
| parent → iframe | `apploop-presentation-set-selections` | `{ targets, activeId, paths }` after load/ready |
| parent → iframe | `apploop-presentation-clear-selections` | Wipe outlines |
| parent → iframe | `apploop-presentation-focus-target` | Focus chip → active edit outline |

## Persist format (canonical)

1. **Hash key = `slide|normalizedText` only** → class `apploop-el-<10 hex>`  
   Do **not** include tag or CSS path (both change after wrap: `p` → `span.apploop-el-…`).
2. On the **target slide only**, peel nested prior apploop spans, then wrap first text match:
   ```markdown
   <span class="apploop-el-abc123">Title text</span>
   ```
3. Front-matter managed block (append inside existing `style: |`):
   ```css
   /* @apploop-inspect-styles */
   /* position context for dragged/absolute inspect nodes */
   section {
     position: relative;
   }
   .apploop-el-abc123 {
     color: #38bdf8;
     position: absolute;
     left: 50%;
     top: 20%;
     transform: translate(-50%, 0);
   }
   /* @apploop-inspect-styles-end */
   ```
4. Selectors must be **bare** `.apploop-el-*`. Marpit already scopes front-matter under `section`; writing `section .apploop-el-*` becomes nested `… section section .foo` and **never matches** after reload.
5. **Merge** previously saved entries still referenced in body; apply overwrites the matching class only.
6. Requires Marp render option **`html: true`**.

## UX rules (user-confirmed)

- Multi-select + re-click unselect
- Selections stay outlined until slide change / Clear / Inspect off
- Changing active slide **clears all targets**
- Overlay near element; Align H/V; drag bar; resize handles
- Immediate live preview via inline style
- Primary CTA label = **Save changes** (header, chips, HUD) — not “Apply styles”
- Drag/resize **auto-saves** on mouseup (`style-apply`) so position is not lost if user forgets the button
- After any save: `?_t=` / `previewKey` reload from deck
- Revert clears unapplied inline overrides for the active target only
- Cursors: crosshair on slide; default/pointer/text in HUD; move on drag bar; resize on handles

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Chips and outlines disagree | Parent toggles on both inspect + selection-state | selection-state only when `selected` present |
| Save seems no-op | No preview reload | bump `previewKey` / `_t` |
| Wrappers vanish after render | `html: false` | keep `html: true` for decks |
| Drag saved to deck.md but lost after reload | `section .apploop-el-*` double-scoped by Marpit | bare `.apploop-el-*` + `section { position: relative }` |
| New save mintors a different class each time | hash includes path/tag | hash `slide\|text` only |
| Nested `<span><span class=…>` | re-wrap without peel | strip nested apploop wrappers before wrap |
| Absolute position jumps to 0,0 relative wrong box | no position context on section | inject relative section rule in managed block |
| Whole deck restyled | global CSS without class | always classed `.apploop-el-*` |
| HUD stuck as crosshair | `* { cursor: crosshair !important }` | scope cursors (see Cursor UX above) |
| Theme 500 | bare theme.css | `@theme` meta / `ensureMarpitThemeMeta` |
