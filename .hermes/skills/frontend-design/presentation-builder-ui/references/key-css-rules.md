---
title: Key CSS rules for presentation-builder-ui
---

# Global MDXEditor dark theme (pierces MDXEditor internals)

```css
/* app/globals.css */

.presentation-mdx-editor,
.presentation-mdx-editor *,
.presentation-mdx-editor [class*="mdxeditor"] {
  --basePageBg: #111113 !important;
  --baseBg: #18181b !important;
  --baseBgSubtle: #09090b !important;
  --baseText: #f4f4f5 !important;
  --baseTextContrast: #fafafa !important;
  --baseBorder: #3f3f46 !important;
  --baseBorderHover: #52525b !important;
  --baseSolid: #3f3f46 !important;
  --baseSolidHover: #52525b !important;
  --baseLine: #3f3f46 !important;
}

.presentation-mdx-editor [class*="mdxeditor-toolbar"] {
  background: #18181b !important;
  border-bottom: 1px solid #3f3f46 !important;
  position: sticky;
  top: 0;
  z-index: 5;
}

.presentation-mdx-editor [class*="mdxeditor-toolbar"] button,
.presentation-mdx-editor [class*="mdxeditor-toolbar"] [role="combobox"],
.presentation-mdx-editor [class*="mdxeditor-toolbar"] [role="button"] {
  color: #e4e4e7 !important;
  background: transparent !important;
}

.presentation-mdx-editor [class*="mdxeditor-toolbar"] button:hover,
.presentation-mdx-editor [class*="mdxeditor-toolbar"] button[data-state="on"],
.presentation-mdx-editor [class*="mdxeditor-toolbar"] button[data-active="true"] {
  color: #fafafa !important;
  background: #27272a !important;
}

.presentation-mdx-editor [contenteditable="true"],
.presentation-mdx-editor [class*="rich-text-editor"],
.presentation-mdx-editor [class*="root-contenteditable"] {
  color: #f4f4f5 !important;
  background: transparent !important;
  caret-color: #fafafa !important;
  min-height: 20rem;
  padding: 1.25rem 1.5rem !important;
  line-height: 1.6 !important;
}

.presentation-mdx-editor [contenteditable="true"] *,
.presentation-mdx-editor [class*="rich-text-editor"] * {
  color: inherit;
}

.presentation-mdx-editor h1,
.presentation-mdx-editor h2,
.presentation-mdx-editor h3,
.presentation-mdx-editor h4 {
  color: #fafafa !important;
  font-weight: 700 !important;
}

.presentation-mdx-editor p,
.presentation-mdx-editor li,
.presentation-mdx-editor span {
  color: #e4e4e7 !important;
}

.presentation-mdx-editor a {
  color: #7dd3fc !important;
}

.presentation-mdx-editor code,
.presentation-mdx-editor pre {
  background: #09090b !important;
  color: #fde68a !important;
  border: 1px solid #3f3f46 !important;
  border-radius: 0.375rem;
}

.presentation-mdx-editor blockquote {
  border-left: 3px solid #52525b !important;
  color: #d4d4d8 !important;
  background: rgba(255, 255, 255, 0.03);
  padding-left: 1rem !important;
}

.presentation-mdx-editor table th,
.presentation-mdx-editor table td {
  border-color: #3f3f46 !important;
  color: #e4e4e7 !important;
}

.presentation-mdx-editor [class*="popup-container"],
.presentation-mdx-editor [class*="select-content"],
[data-radix-popper-content-wrapper] [class*="select-content"] {
  background: #18181b !important;
  color: #f4f4f5 !important;
  border: 1px solid #3f3f46 !important;
}
```

# Canvas wrapper

```css
.presentation-mdx-canvas {
  margin-top: 1rem;
  margin-bottom: 2rem;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.presentation-mdx-canvas [class*="mdxeditor"] {
  background: transparent !important;
}
```

# Filmstrip scrollbar

```css
.presentation-filmstrip-scroll {
  scrollbar-gutter: stable;
  scrollbar-width: auto;
  scrollbar-color: #a1a1aa #18181b;
}
.presentation-filmstrip-scroll::-webkit-scrollbar { width: 14px; }
.presentation-filmstrip-scroll::-webkit-scrollbar-track { background: #18181b; border-left: 1px solid rgba(255, 255, 255, 0.08); }
.presentation-filmstrip-scroll::-webkit-scrollbar-thumb { background: #a1a1aa; border-radius: 999px; border: 3px solid #18181b; }
```