---
name: mdx-editor-integration
description: "Use when integrating @mdxeditor/editor for rich Markdown editing in AppLoop — client/server module splitting, per-section editing, dark mode, save workflows, and common pitfalls."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [mdxeditor, markdown, editor, client-server, dark-mode]
    related_skills: [frontend-design, generated-app-standards]
---

# MDX Editor Integration (AppLoop)

Pattern for integrating `@mdxeditor/editor` into AppLoop surfaces that edit Markdown files (presentations, templates, projects). This is the same editor used in `hermes-mental-health`.

## Package

```bash
npm install @mdxeditor/editor
```

Import CSS: `import "@mdxeditor/editor/style.css";`

## Client/server module split (CRITICAL)

When a client component needs Markdown parsing functions that are also used server-side (where they depend on `node:fs`), split them:

1. Create `lib/X/marp-utils.ts` with **pure functions only** (no Node APIs)
2. Strip those function bodies from `lib/X/marp.ts`, replace with re-exports from `marp-utils.ts`
3. Client components import from `marp-utils.ts`
4. Server consumers can still import from `marp.ts` (it re-exports)

This prevents Turbopack `node:fs/promises` errors in the client bundle.

## Editor state pattern (pitfall: blank editor, re-hydration)

The MDXEditor does **not** reliably pick up changes to the `markdown` prop after initial mount. The working pattern:

```tsx
const editorMarkdownRef = useRef("");

// Derive as IIFE — runs on every render, no useEffect lag
const editorMarkdown = (() => {
  if (!fullSource) return "";
  try { return extractSection(fullSource, activeIndex); }
  catch { return ""; }
})();

// Key forces remount on section switch or save/refresh
<MDXEditor
  key={`editor-${activeIndex}-${refreshKey}`}
  markdown={editorMarkdown}
  onChange={(v) => { editorMarkdownRef.current = v; }}
  suppressHtmlProcessing
/>
```

Why this works:
- IIFE: fresh value every render, no stale state, no setState-in-effect lint
- Key change: full unmount/remount reinitializes the editor with new markdown
- ref: `onChange` writes to ref — `handleSave` reads from ref, never stale closure

When markdown is empty (initial load), show a loading spinner, not a blank editor.

## Dark mode styling (REQUIRED)

**`<style jsx>` does NOT work** — styled-jsx scopes to the component's own DOM and cannot pierce MDXEditor's deep internal tree (portals, shadow-DOM-like internals). **Always use global CSS** (`app/globals.css`) with `[class*="mdxeditor"]` wildcard attribute selectors.

Wrap the MDXEditor in a **canvas card** that carries the page/slide background; editor stays transparent:

```tsx
<div className="mdx-canvas" style={{ background: pageBg }}>
  <MDXEditor ... />
</div>
```

```css
/* CSS variables — force on every editor element */
.mdx-scope, .mdx-scope *, .mdx-scope [class*="mdxeditor"] {
  --basePageBg: #111113 !important; --baseBg: #18181b !important;
  --baseBgSubtle: #09090b !important; --baseText: #f4f4f5 !important;
  --baseTextContrast: #fafafa !important; --baseBorder: #3f3f46 !important;
  --baseBorderHover: #52525b !important; --baseSolid: #3f3f46 !important;
  --baseSolidHover: #52525b !important; --baseLine: #3f3f46 !important;
}
.mdx-scope [class*="mdxeditor"], .mdx-scope .mdxeditor {
  color: #f4f4f5 !important; background: #111113 !important;
  border: 0 !important; font-size: 15px !important;
}
/* Toolbar */
.mdx-scope [class*="mdxeditor-toolbar"], .mdx-scope .mdxeditor-toolbar {
  background: #18181b !important; border-bottom: 1px solid #3f3f46 !important;
  border-radius: 0 !important; position: sticky; top: 0; z-index: 5;
}
.mdx-scope [class*="mdxeditor-toolbar"] button,
.mdx-scope [class*="mdxeditor-toolbar"] [role="combobox"],
.mdx-scope [class*="mdxeditor-toolbar"] [role="button"] {
  color: #e4e4e7 !important; background: transparent !important;
}
.mdx-scope [class*="mdxeditor-toolbar"] button svg,
.mdx-scope [class*="mdxeditor-toolbar"] [role="button"] svg {
  fill: #e4e4e7 !important; color: #e4e4e7 !important; stroke: #e4e4e7 !important;
}
.mdx-scope [class*="mdxeditor-toolbar"] button:hover,
.mdx-scope [class*="mdxeditor-toolbar"] button[data-state="on"],
.mdx-scope [class*="mdxeditor-toolbar"] button[data-active="true"] {
  color: #fafafa !important; background: #27272a !important;
}
.mdx-scope [class*="mdxeditor-toolbar"] button:hover svg,
.mdx-scope [class*="mdxeditor-toolbar"] button[data-state="on"] svg,
.mdx-scope [class*="mdxeditor-toolbar"] button[data-active="true"] svg {
  fill: #fafafa !important; color: #fafafa !important; stroke: #fafafa !important;
}
/* Content area — transparent so canvas bg shows through */
.mdx-scope [contenteditable="true"], .mdx-scope [contenteditable],
.mdx-scope [role="textbox"], .mdx-scope [class*="root-contenteditable"],
.mdx-scope [class*="rich-text-editor"] {
  color: #f4f4f5 !important; background: transparent !important;
  caret-color: #fafafa !important;
  min-height: 20rem; padding: 1.25rem 1.5rem !important; line-height: 1.6 !important;
}
.mdx-scope [class*="root-contenteditable"] *,
.mdx-scope [class*="rich-text-editor"] *,
.mdx-scope [contenteditable="true"] * { color: inherit; }
/* Typography */
.mdx-scope h1, .mdx-scope h2, .mdx-scope h3, .mdx-scope h4 {
  color: #fafafa !important; font-weight: 700 !important;
}
.mdx-scope p, .mdx-scope li, .mdx-scope span { color: #e4e4e7 !important; }
.mdx-scope a { color: #7dd3fc !important; }
.mdx-scope code, .mdx-scope pre {
  background: #09090b !important; color: #fde68a !important;
  border: 1px solid #3f3f46 !important; border-radius: 0.375rem;
}
.mdx-scope blockquote {
  border-left: 3px solid #52525b !important; color: #d4d4d8 !important;
  background: rgba(255,255,255,0.03); padding-left: 1rem !important;
}
.mdx-scope table th, .mdx-scope table td {
  border-color: #3f3f46 !important; color: #e4e4e7 !important;
}
/* Popups */
.mdx-scope .mdxeditor-popup-container, .mdx-scope .mdxeditor-select-content,
[data-radix-popper-content-wrapper] .mdxeditor-select-content {
  background: #18181b !important; color: #f4f4f5 !important;
  border: 1px solid #3f3f46 !important;
}
```

Without this, text renders near-black on near-black — invisible. The wildcard `[class*="mdxeditor"]` catches every internal class regardless of depth.

## Plugins (full set)

Mirroring `hermes-mental-health`:

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

plugins={[
  toolbarPlugin({ toolbarContents: () => (
    <><UndoRedo /><BoldItalicUnderlineToggles />
     <StrikeThroughSupSubToggles /><ListsToggle />
     <BlockTypeSelect /><InsertThematicBreak />
     <InsertCodeBlock /><InsertTable /></>
  ) }),
  headingsPlugin(), listsPlugin(), quotePlugin(),
  thematicBreakPlugin(), markdownShortcutPlugin(),
  linkPlugin(), linkDialogPlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
  codeMirrorPlugin({ codeBlockLanguages: {
    "": "Plain Text", js: "JavaScript", ts: "TypeScript",
    json: "JSON", md: "Markdown", py: "Python",
    sql: "SQL", bash: "Bash",
  }}),
  tablePlugin(),
]}
```

## Per-section save pattern

For documents with multiple sections (Marp slides, template files):

1. Read current full source (fetch from API or ref)
2. Split into sections (`splitMarpDocument` or equivalent)
3. Read the edited section from `editorMarkdownRef.current`
4. Split the edited markdown to extract just the content
5. Replace `sections[activeIndex]` with the edited content
6. Reconstruct full document
7. POST to server action / API endpoint
8. Update state → triggers re-derivation
9. Increment refresh key → refreshes previews

## Anti-patterns

- Importing server modules (with `node:fs`) from client components
- Using `useEffect` to sync editor state (use derived IIFE)
- Relying on MDXEditor to pick up prop changes (force remount)
- Using state closures in `onChange` handlers for save (use refs)
- Skipping dark mode CSS (defaults to light/white theme)
