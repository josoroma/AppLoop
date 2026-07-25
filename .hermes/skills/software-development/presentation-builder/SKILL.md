---
name: presentation-builder
description: "Build and extend the AppLoop Marp presentation builder UI — layout, per-slide MDX editor, server actions, document model, and common pitfalls. Load when editing or debugging the presentations surface."
version: 3.0.0
---

# Presentation Builder (AppLoop)

## Overview

The AppLoop presentation builder is a dedicated surface for creating and editing Marp Markdown decks. As of v3.0.0, it uses **`@mdxeditor/editor`** for per-slide rich-text markdown editing — the older inspect/visual-editor approach (selection, drag/resize, style panel) has been removed.

Layout: CSS Grid `filmstrip (18rem) | editor or preview (1fr) | chat (optional toggle)`.

### Architecture (vs Projects)

| Aspect | Projects | Presentations |
|--------|----------|---------------|
| Runtime | Next.js dev server on 3100+ ports | None (Marp HTML iframe) |
| Source of truth | Multiple source files | Single `deck.md` |
| Workspace root | `.apploop/projects/` | `.apploop/presentations/` |
| Templates root | `templates/` | `presentations-templates/` |
| Build system | npm / tsx | `@marp-team/marp-core` |
| DB table | `projects` | `presentations` |
| Hermes mode | `project-edit` | `presentation-edit` |
| Editor | Next.js app builder | `@mdxeditor/editor` per-slide |

### Key files

- `components/presentations/presentation-builder-shell.tsx` — main builder: filmstrip + editor/preview + chat
- `components/presentations/presentation-markdown-editor.tsx` — wrapper around `@mdxeditor/editor`
- `app/api/presentations/[presentationId]/slides/route.ts` — slide summaries + raw markdown
- `app/api/presentations/[presentationId]/preview/route.ts` — Marp HTML render
- `app/api/presentations/[presentationId]/chat/route.ts` — Hermes chat endpoint
- `app/api/presentations/markdown/route.ts` — full-deck save (for undo/redo)
- `lib/presentations/marp.ts` — renderer with `html:true`, filmstrip/deck modes
- `lib/presentations/actions.ts` — server actions: save, delete slide, delete element
- `lib/presentations/files.ts` — read/write markdown, workspace creation
- `app/globals.css` — `.presentation-builder-grid`, filmstrip scrollbar

## Layout (CSS Grid)

```
[filmstrip (18rem)] [editor or preview (1fr)] [chat (toggle)]
```

- 2-column default (chat hidden): `18rem 1fr`
- 3-column with chat: `18rem 1fr minmax(14rem, 18rem)`
- Filmstrip uses native React cards (index badge + title + Marp thumbnail iframe)
- Thumbnail iframes have `pointer-events: none` so clicks pass through to parent button
- Scrollbar always visible via CSS `scrollbar-gutter: stable`

## Per-slide editing pattern

```
loadSlides() → fetches /slides → sets fullMarkdown + slides[]
click filmstrip → setActiveSlide(idx)
derive slideContent = splitMarpDocument(fullMarkdown).slides[idx]
render <MDXEditor markdown={slideContent} key={`editor-${idx}-${previewKey}`} />
save → splitMarpDocument(currentFull) → replace slide N → join → savePresentationMarkdownAction(FormData)
```

Key rule: **always preserve front matter and other slides**. Only the edited slide's content is replaced.

## MDX Editor integration

```tsx
import {
  MDXEditor, UndoRedo, BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles, BlockTypeSelect, ListsToggle,
  InsertThematicBreak, InsertCodeBlock, InsertTable,
  toolbarPlugin, headingsPlugin, listsPlugin, quotePlugin,
  thematicBreakPlugin, markdownShortcutPlugin,
  linkPlugin, linkDialogPlugin, codeBlockPlugin,
  codeMirrorPlugin, tablePlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
```

Active plugins: all of the above. Set `suppressHtmlProcessing`. Pass `key={`editor-${activeSlide}-${previewKey}`}` to force re-mount on slide change.

### Dark mode (CRITICAL)

**`<style jsx>` does NOT work** — use global CSS with `[class*="mdxeditor"]` wildcards. See `mdx-editor-integration` skill for the full CSS block. Without it, text is invisible (near-black on near-black).

### Body-only editing

Editor shows slide body only (no Marp front matter, no `<!-- _class: ... -->` directives):

```tsx
import { getMarpSlideBody, replaceMarpSlideBody } from "@/lib/presentations/marp-utils";

// Load: strip directives
const body = getMarpSlideBody(fullMarkdown, activeSlide);

// Save: replace only this slide's body, preserve everything else
const next = replaceMarpSlideBody(fullMarkdown, activeSlide, editedBody);
```

## Per-slide background colors

Stored as CSS rules in front-matter `style:` block (the ONLY thing Marp actually renders):

```yaml
style: |
  section.slide-bg-1 { background-color: #c0392b !important; }
```

Plus `<!-- _class: slide-bg-N -->` per slide. The shell's `parseSlideBackgrounds` / `injectSlideBackgroundsIntoFrontMatter` / `injectSlideClassDirectives` helpers handle this. Filmstrip cards get `style={{ background: bg }}` for immediate visual feedback.

## Save per-slide (server action)

```ts
import { replaceMarpSlideBody } from "@/lib/presentations/marp-utils";

// Body-only save — no front matter in editor, preserve everything else
const current = fullMarkdown; // or from ref
const next = replaceMarpSlideBody(current, activeSlide, editedBody);
const form = new FormData();
form.set("presentationId", id);
form.set("markdown", next);
await savePresentationMarkdownAction(form);
```

**Note:** The old pattern of manually splitting front matter and re-joining is error-prone — `replaceMarpSlideBody` handles it correctly including edge cases (empty slides, missing slides, front matter preservation).

## Document model (`lib/presentations/marp-utils.ts`)

Client-safe, no Node APIs:
- `splitMarpDocument(markdown)` → `{ frontMatter, slides: string[] }`
- `composeMarpSlideMarkdown(markdown, idx)` → single slide as complete Marp doc
- `countMarpSlides(markdown)` → slide count
- `getMarpSlideSummaries(markdown)` → `{ index, title, preview }[]`
- `getMarpSlideBody(markdown, idx)` → body-only (strips `<!-- _class -->` directives)
- `replaceMarpSlideBody(markdown, idx, body)` → replace one slide, preserve front matter + others

`lib/presentations/marp.ts` re-exports all of the above + adds Marp rendering + file I/O (server-only).

## Server actions (`lib/presentations/actions.ts`)

- `savePresentationMarkdownAction(formData)` — writes full deck to `deck.md`
- `deletePresentationSlideAction({ presentationId, slideIndex })` — removes a slide, cleans orphaned CSS
- `deletePresentationElementAction({ presentationId, slide, text })` — removes text + wrappers from a slide
- `applyPresentationInspectStylesAction({ presentationId, targets })` — applies `<span class="apploop-el-...">` wrappers + managed CSS block (kept for older saved decks, not used by new editor)

## File I/O (`lib/presentations/files.ts`)

- `readPresentationMarkdown(workspacePath, sourceFile)` → string
- `writePresentationMarkdown(workspacePath, markdown, sourceFile)` → path
- `createPresentationWorkspace(presentationsRoot, workspacePath, options)` — clones template

## Marp rendering notes

- `@marp-team/marp-core` with `html: true`
- `wrapMarpDocument()` supports `"filmstrip"` and `"deck"` modes (slide mode removed)
- Filmstrip SVG sizing override must come **after** Marp default CSS: `svg[data-marpit-svg] { width:100% !important; height:auto !important }`
- Theme CSS requires `@theme` meta; `ensureMarpitThemeMeta()` injects it when missing

## Chat integration

- Chat endpoint: `POST /api/presentations/chat`
- Always include active slide number, total slides, and slide title in prompts
- Chat sidebar toggle via **Chat** button in header

## Common pitfalls

1. **Turbopack `node:fs` bundling** — Client components must not import modules using `node:fs/promises`. Use server actions for all filesystem operations. **Dynamic `import()` of marp.ts in a client component ALSO breaks the build** — Turbopack resolves it and pulls `node:fs` into the client bundle. Fix: split into `lib/presentations/marp-utils.ts` (client-safe, no Node deps) and `lib/presentations/marp.ts` (server-only, re-exports from marp-utils). The builder shell imports from `marp-utils.ts` only.
2. **Inline elements ignore width/height** — `li`, `a`, `span` need `display: inline-block` alongside `position: absolute` for drag/resize to work. Apply in every code path that sets position (mousemove handler, alignment buttons, server-side style generation).
3. **Marine SVG scaling vs CSS %** — Slide content inside SVG `viewBox="0 0 1280 720"`, so percentage positioning is relative to that coordinate space, not the viewport.
4. **Marne front-matter `style:` scoping** — Rules get scoped under `div.marpit > svg > foreignObject > section`. Use bare `.class {}` selectors (NEVER `section .class`). Also inject `section { position: relative; }` so absolute children anchor correctly.
5. **Filmstrip SVG sizing** — Override MUST come after Marp's generated CSS in the HTML. Target `div.marpit > svg[data-marpit-svg]`, not bare `section`.
6. **Nested button elements** — Don't render shadcn `<Button>` inside raw `<button>` tags. Use `<div role="button" tabIndex={0}>` or plain `<span>` with click handlers for nested click targets.
7. **React setState in useEffect** — Use `useMemo` or IIFE assignment (`const x = (() => { ... })()`) for derived state. Never use an unassigned `(function () {})()` block — it runs but doesn't produce a variable.
8. **Slide key for MDXEditor** — Pass `key={`editor-${activeSlide}-${previewKey}`}` to force re-mount when content changes externally (post-save, post-Hermes chat, post-undo).
9. **Undo** — Capture previous markdown from server action return values (`previousMarkdown` field on the response), not a separate fetch. A failed fetch silently skips undo recording. Also: MDXEditor has built-in undo/redo (Ctrl+Z works within the editor) — don't stack a second app-level undo unless needed.
10. **Slide delete must be a server action** — Use `deletePresentationSlideAction({ presentationId, slideIndex })`. Never client-side import marp.ts to construct markdown.
11. **Client/server module split** — `marp-utils.ts` is pure string functions (splitMarpDocument, composeMarpSlideMarkdown, countMarpSlides, getMarpSlideSummaries). `marp.ts` adds Marp rendering + file I/O. Always import from the right one.
12. **IIFE vs plain function** — In a React component, `const x = (() => { ... })();` assigns a derived value. Plain `(function () { ... })();` runs but is unreferenced — use arrow version with assignment.
13. **`slideContent` reference error** — The IIFE-derived slide content uses `fullMarkdown` state. Must be computed at render time (not in useEffect), since `fullMarkdown` is set asynchronously by `loadSlides`. The IIFE pattern `const slideContent = (() => { ... })();` is correct — it re-runs on every render, which is needed because `loadSlides` updates `fullMarkdown` async.

## Anti-patterns

- Visual inspect / drag-resize / style overlay (removed in v3.0.0 — use MDX editor)
- Resizable panels (use fixed CSS grid)
- Importing Node.js modules in client code
- Client-side markdown manipulation of full deck (use server actions)
- Editing adjacent slides' content while saving one slide
- Prefixing CSS rules with `section .classname` inside Marp front-matter style blocks
- Storing per-slide backgrounds as YAML keys (`slide-bg-N: "#..."`) — Marp ignores them. Use CSS rules in `style:` block instead
- Using `<style jsx>` for MDXEditor dark mode — it cannot pierce the editor's internals. Use global CSS with `[class*="mdxeditor"]` wildcards
