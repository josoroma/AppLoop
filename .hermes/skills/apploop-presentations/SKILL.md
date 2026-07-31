---
name: apploop-presentations
description: "Developer reference for AppLoop Marp presentations — slides lifecycle, preview, inspect, persistence, and anti-patterns. Load when working on lib/presentations/, components/presentations/, or app/presentations/."
version: 1.0.0
author: AppLoop
metadata:
  hermes:
    tags: [apploop, presentations, marp]
---

# AppLoop Presentations — Developer Reference

Covers `lib/presentations/`, `components/presentations/`, `app/presentations/`, and `app/api/presentations/`.

## Architecture

- DB: `presentations` table (migration 0010), `presentation_conversations`, `presentation_messages`
- Workspaces: `.apploop/presentations/<slug>/` — NOT Next.js project clones
- No preview ports — Marp renders via `@marp-team/marp-core` → HTML iframe
- Source of truth: `deck.md` (configurable via `sourceFile`)

## Files

| Path | Role |
|------|------|
| `lib/presentations/templates.ts` | Built-in blueprint registry |
| `lib/presentations/files.ts` | Workspace create/read/write |
| `lib/presentations/repository.ts` | SqlitePresentationRepository |
| `lib/presentations/service.ts` | PresentationService |
| `lib/presentations/actions.ts` | Server actions (create, delete, styles, undo-capable) |
| `lib/presentations/marp.ts` | Marp render, markdown split/compose, CSS escape, wrapMarpDocument |
| `lib/presentations/inspect-styles.ts` | Style schema, class building, markdown persistence |
| `lib/presentations/inspect-editor-assets.ts` | Iframe inspect script + CSS (selection, drag, resize, edit) |
| `components/presentations/presentation-builder-shell.tsx` | Main builder layout |
| `components/presentations/presentation-markdown-editor.tsx` | `@mdxeditor/editor` raw markdown editor |
| `components/presentations/presentation-create-form.tsx` | Create flow |

## Marp CSS Scoping (critical pitfall)

Marpit outputs slides as `div.marpit > svg[data-marpit-svg] > foreignObject > section`. Front-matter `style: |` CSS is scoped under the slide `<section>`. Writing `section .foo { ... }` becomes `… section section .foo` and **never matches**. Use `.foo { ... }` without `section` prefix.

Inline `style="..."` attributes on wrapper spans survive Marpit scoping cleanly and are the preferred persistence mechanism for inspect styles.

## Slide-Level Styling via Editor Pickers

The presentation builder includes **BG** (background) and **TXT** (text) color pickers in the editor header. These allow per-slide styling that is persisted to the deck's front matter:

1. When a user selects a color and clicks **Save**, the builder updates the front matter `style:` block with:
   ```css
   section.slide-bg-N { background-color: #RRGGBB !important; }
   section.slide-text-N { color: #RRGGBB !important; }
   ```
   where `N` is the 1-based slide index.

2. Each slide's Markdown comment is updated to include both classes:
   ```markdown
   <!-- _class: slide-bg-1 slide-text-1 -->
   # Slide One
   ```

3. Both filmstrip thumbnails and preview iframes reflect these colors:
   - Filmstrip: uses inline style `style={{ background: activeBackground }}` on each thumbnail card
   - Preview: Marp renders the CSS rules from the front matter into the iframe

4. Files affected: `.apploop/presentations/<slug>/deck.md` (front matter and slide class comments)

## Style Persistence (Inspect System)

1. Inline style: `<span class="apploop-el-HASH" style="left: 13%; top: 62%; position: absolute;">`
2. Managed CSS block in front-matter `style: |` as backup
3. Class hash is based on `slide|normalizedText` only — NOT tag or CSS path (those change after wrapping)
4. On re-apply, merge with existing styles from previous save to avoid wipe

## Undo/Redo

Capture previous markdown from server action response (atomic, not a separate fetch):
```
result.previousMarkdown → recordUndo()
```

`/api/presentations/markdown` — POST endpoint for full-deck save (used by undo/redo restore).

## Client/Server Boundary

`lib/presentations/marp.ts` imports `node:fs/promises` — never import it in client components. Use server actions for any markdown manipulation.

## Drag/Resize

Always set `display: inline-block` alongside `position: absolute` — inline elements (`<li>`, `<a>`, `<em>`) don't respond to `width`/`height` otherwise.

## Image Sizing (fit-to-slide)

The slide box is the **deck** size (`svg[data-marpit-svg] viewBox="0 0 1280 720"`), not the live iframe rect. Read it with `readPresentationSlideSize(markdown)` and scale with `fitImageToSlide(natural, slide, padding)` — both in `lib/presentations/marp-utils.ts` (client-safe).

- Inserting an oversized image emits Marp alt-text directives: `![alt w:1184 h:474](assets/x.png)`.
- **Pitfall:** Marp stores sizing/filters as alt-text tokens (`w:`, `h:`, `bg`, `fit`, `blur`, …). Any code that rewrites an image's alt text must preserve them (`composeMarpImageAlt`) or the image silently jumps back to full size. Strip them from the alt *input's* displayed value.
- Downscale only — never upscale. `SLIDE_IMAGE_FIT_PADDING = 48` per axis.

Full detail, browser-verification recipe, and React-event gotchas: `references/image-sizing.md`.

## Filmstrip

Native React cards via `GET /api/presentations/[id]/slides` — returns `{ slides, markdown, totalSlides }`. CSS grid `presentation-builder-grid` (chat | filmstrip | preview). Inspector adds 4th column.

## Inspect postMessage API

**Iframe → parent:**
- `apploop-presentation-selection-state` — full selection snapshot
- `apploop-presentation-style-apply` — save requested (drag end, button click)
- `apploop-presentation-delete-element` — × button in drag bar
- `apploop-presentation-text-edit` — double-click text edit committed

**Parent → iframe:**
- `apploop-presentation-set-selections` — sync targets
- `apploop-presentation-clear-selections`
- `apploop-presentation-focus-target` — highlight specific
- `apploop-presentation-patch-style` — live field edit
- `apploop-presentation-apply-all-styles` — batch apply

## Verification

```bash
npm test -- tests/presentation-marp.test.ts
npm test -- tests/presentation-inspect-styles.test.ts
```

`npm run lint` and `npm run typecheck` are **noisy at repo scope** — the seeded
`templates/*/node_modules` produce thousands of pre-existing three.js/@types
duplication errors. Scope to your own files instead:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "^(components|lib|app)/presentations"
npx eslint components/presentations/... lib/presentations/...
```
