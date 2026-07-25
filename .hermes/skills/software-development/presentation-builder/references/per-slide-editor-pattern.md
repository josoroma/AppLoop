# Per-Slide MDX Editor Pattern

## Overview

As of presentation-builder v3.0.0, the inspect/visual-editor approach has been removed. The builder now uses `@mdxeditor/editor` for per-slide rich-text markdown editing.

## Flow

1. **Load**: `GET /api/presentations/[id]/slides` returns `{ slides[], markdown, totalSlides }`. The `markdown` field is the full deck content.
2. **Select**: Click a slide in the filmstrip → `setActiveSlide(idx)`. The slide's markdown is derived from `splitMarpDocument(fullMarkdown).slides[idx]`.
3. **Edit**: MDXEditor renders the slide's markdown with plugins for headings, lists, quotes, links, bold/italic, and undo/redo toolbar.
4. **Save**: `handleSave()` reads editor content via `editorRef.current?.getMarkdown()`, extracts the edited slide from it, replaces that slide in the full deck, and POSTs via `savePresentationMarkdownAction(FormData)`.

## Key implementation details

### State management
- `fullMarkdown` — the complete deck (set from API response, updated after save)
- `activeSlide` — 1-based index of the selected slide
- `slideContent` — derived inline: `{ markdown: string, title: string }` from `splitMarpDocument` + regex heading extraction
- `previewKey` — incremented to bust iframe and filmstrip caches after save/refresh

### MDXEditor keying
```tsx
<MDXEditor
  ref={editorRef}
  markdown={slideContent.markdown}
  key={`editor-${activeSlide}-${previewKey}`}
  ...
/>
```
The key MUST include both `activeSlide` and `previewKey` so the editor re-mounts:
- When the user switches slides (different `activeSlide`)
- After saving/refreshing (different `previewKey`, so stale cached markdown is replaced)

### Save preserving structure
```ts
const editorContent = editorRef.current?.getMarkdown();
const { frontMatter, slides } = splitMarpDocument(currentFullMarkdown);
const idx = activeSlide - 1;
const editorSlides = splitMarpDocument(editorContent).slides;
slides[idx] = editorSlides[0] ?? slides[idx];
const next = [frontMatter, "", slides.join("\n\n---\n\n"), ""].join("\n").trimEnd() + "\n";
```

Critical: the full deck is reconstructed from `currentFullMarkdown` (state), not from the editor content. Only slide N is replaced. This preserves all other slides unchanged.

### Chat prompt composition
```ts
function composeChatPrompt(raw, activeSlide, totalSlides, slideTitle) {
  return [
    raw,
    "",
    `Active slide: ${activeSlide} of ${totalSlides}${slideTitle ? ` ("${slideTitle}")` : ""}`,
    "Edit only this slide in deck.md unless I ask otherwise. Keep Marp front matter and --- separators.",
  ].join("\n");
}
```

## Files involved
- `components/presentations/presentation-builder-shell.tsx` — main component
- `components/presentations/presentation-markdown-editor.tsx` — MDXEditor wrapper (save button, status)
- `lib/presentations/marp.ts` — `splitMarpDocument`, `composeMarpSlideMarkdown`
- `lib/presentations/actions.ts` — `savePresentationMarkdownAction`
- `app/api/presentations/[id]/slides/route.ts` — returns `markdown` field in response
