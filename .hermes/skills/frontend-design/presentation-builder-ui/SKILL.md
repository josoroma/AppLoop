---
name: presentation-builder-ui
description: "Patterns for the AppLoop presentation builder UI (components/presentations/presentation-builder-shell.tsx) — per-slide MDX editor, filmstrip, background/text color pickers, live Marp preview iframe."
version: 1.0.0
author: Hermes
license: MIT
metadata:
  hermes:
    tags: [presentations, builder, mdx-editor, marp, filmstrip]
    related_skills: [presentation-inspect-styling, hermes-gateway, marp-presentations]
---

# Presentation Builder UI

## Scope

This skill covers the **client-side builder shell** for presentations:
- `components/presentations/presentation-builder-shell.tsx`
- Global CSS rules in `app/globals.css` (`.presentation-mdx-*`, `.presentation-slide-*`)

It does **not** cover Marp Markdown authoring rules — see `marp-presentations`.

## Layout contract

Three-column CSS grid (chat | filmstrip | main), switching to preview mode on demand:

```
min-h-0 flex-1
grid-template-columns:
  18rem 1fr              // chat closed
  18rem 1fr minmax(14rem, 18rem)  // chat open
```

Filmstrip: native vertical scrollbar, 16:9 iframe thumbnails. Click → `setActiveSlide` → editor remounts with new key.

## Editor behavior

- **Source of truth**: `deck.md` is read via `/slides` API → split into per-slide bodies (`getMarpSlideBody`).
- **Editor state**: `editorMarkdown` derived directly from `fullMarkdown + activeSlide` on every render (no stale closure). `onChange` writes to a ref; `handleSave` reads the ref.
- **No front-matter in editor** — user edits only the slide body. Save path:
  1. `replaceMarpSlideBody()` → preserves front matter + other slides
  2. `injectSlideClassDirectives()` → adds `<!-- _class: slide-bg-N slide-text-N -->`
  3. `injectSlideStylesIntoFrontMatter()` → writes CSS rules into `style: |` block
- **Key for remount**: `editor-${activeSlide}-${previewKey}` (bump `previewKey` to force full reset).

## Background / Text color picker

- State: `slideBackgrounds[]`, `slideTextColors[]` loaded from `parseSlideStyles()` (scans `style:` CSS block).
- UI: native `<input type="color">` in editor header. Changes local state → "Background updated · Save to persist" toast. On **Save** both arrays are serialized into the front-matter `style:` block as:

```css
section.slide-bg-1 { background-color: #c0392b !important; }
section.slide-text-1 { color: #ffd700 !important; }
```

- Thumbnail filmstrip iframes inherit the slide background via `style={{ background: bg }}` so strip + preview match.

## Dark-mode MDXEditor theming

All editor internals are forced via global CSS (`.presentation-mdx-editor *` wildcards) because styled-jsx doesn't pierce MDXEditor's class structure. Key tokens:

```css
.presentation-mdx-editor {
  --basePageBg: #111113;
  --baseBg: #18181b;
  --baseText: #f4f4f5;
  --baseBorder: #3f3f46;
}
.presentation-mdx-editor [contenteditable] { background: transparent !important; }
```

## Preview iframe

- URL: `/api/presentations/[id]/preview?slide=N&_t=${previewKey}`
- Marp renders full HTML + scoped CSS. Slide classes (`slide-bg-N`, `slide-text-N`) match the `style:` rules → backgrounds + text colors render correctly.
- `previewKey` bumped on save / refresh / chat completion → hard cache bust.

## Anti-patterns

- Don't read `deck.md` from the filesystem directly — always go through the slides API.
- Don't put full `deck.md` in the editor — only the current slide body.
- Don't forget to bump `previewKey` after a save, otherwise the iframe serves stale HTML.
- Don't use styled-jsx for MDXEditor theming — use `app/globals.css` global rules.