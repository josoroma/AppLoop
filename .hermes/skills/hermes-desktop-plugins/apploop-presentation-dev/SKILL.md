---
name: apploop-presentation-dev
description: "Use when developing, debugging, or modifying the AppLoop presentation feature — builder shell, MDX editor integration, client/server split, build fixes, and save flow."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [apploop, presentations, mdxeditor, marp, nextjs]
    related_skills: [marp-presentations, frontend-design, hermes-gateway]
---

# AppLoop Presentation Development

## When to use

- Modifying `presentation-builder-shell.tsx`, `lib/presentations/marp*.ts`, or presentation API routes
- Adding/removing editor features (MDXEditor plugins, toolbar, save flow)
- Debugging build errors related to `node:fs` in client bundles
- Changing presentation layout (filmstrip, editor, preview, chat panels)
- Working on presentation server actions (save, delete slide, apply styles)

## Client/server module split

**Critical rule:** Never import `marp.ts` from a `"use client"` component. `marp.ts` imports `node:fs/promises` which Turbopack cannot bundle for the browser.

```
lib/presentations/
├── marp-utils.ts          ← client-safe (no node:fs)
│   splitMarpDocument()    → { frontMatter, slides[] }
│   composeMarpSlideMarkdown(md, slideIndex1Based) → single-slide md
│   countMarpSlides()      → number
│   getMarpSlideSummaries() → [{ index, title, preview }]
│
└── marp.ts                ← server-only
    renderMarpDeck()       → { html, css, slideCountHint }  (html: true)
    wrapMarpDocument()     → full iframe HTML wrapper
    loadOptionalThemeCss() → reads theme.css from disk
```

`marp.ts` re-exports everything from `marp-utils.ts` for backward compatibility in server code.

**Build error fix:** When you see `node:fs/promises` in client chunk — check which `marp` import is used. Switch to `marp-utils`.

## Per-slide MDX Editor

The presentation builder uses `@mdxeditor/editor` v4+ with rich plugins matching `hermes-mental-health`.

### State management (critical — IIFE-derived + ref pattern)

MDXEditor does **NOT** re-hydrate when the `markdown` prop changes after initial mount. Using a derived prop causes blank editor on slide switch.

**Current pattern: IIFE for derivation + ref for onChange.**

```tsx
// Derive editor content directly from fullMarkdown at render time
const editorMarkdown = (() => {
  if (!fullMarkdown) return "";
  try { return getMarpSlideBody(fullMarkdown, activeSlide); } catch { return ""; }
})();

// Ref tracks live edits (onChange fires) for Save without stale closures
const editorMarkdownRef = useRef("");
useEffect(() => { editorMarkdownRef.current = editorMarkdown; }, [editorMarkdown]);

// In JSX — key includes activeSlide + previewKey to force remount
<MDXEditor
  key={`editor-${activeSlide}-${previewKey}`}
  markdown={editorMarkdown}
  onChange={(v) => { editorMarkdownRef.current = v; }}
/>
```

**Why not useState+useEffect?** Triggers cascading renders and lint errors. The IIFE re-runs on every render, which is correct since `fullMarkdown` changes asynchronously via `loadSlides`. The ref pattern avoids stale closures in `handleSave`.

### Body-only editing

The editor shows only the slide body (no Marp front matter). `getMarpSlideBody` also strips `<!-- _class: ... -->` directives:

```ts
// marp-utils.ts
export function getMarpSlideBody(markdown: string, slideIndex1Based: number) {
  const { slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  return (slides[index] ?? "").replace(/<!--\s*_.*?-->/g, "").trimEnd();
}

export function replaceMarpSlideBody(markdown: string, slideIndex1Based: number, nextBody: string) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), Math.max(slides.length, 1)) - 1;
  const updated = slides.length > 0 ? [...slides] : [""];
  while (updated.length <= index) updated.push("");
  updated[index] = nextBody.trim();
  return `${frontMatter}\n\n${updated.join("\n\n---\n\n")}\n`;
}
```

### Per-slide background colors

Stored in Marp front matter as `slide-bg-N: "RRGGBB"` keys with `<!-- _class: slide-bg-N -->` directives:

```ts
// Parse from front matter lines between the first --- fences
function parseSlideBackgrounds(frontMatter: string, slideCount: number): string[] {
  const backgrounds = Array<string>(Math.max(slideCount, 1)).fill("#000000");
  for (let i = 1; i <= backgrounds.length; i++) {
    const re = new RegExp(`slide-bg-${i}:"?#?([a-fA-F0-9]{3,6})"?`, "m");
    const m = frontMatter.match(re);
    if (m?.[1]) backgrounds[i - 1] = `#${m[1]}`;
  }
  return backgrounds;
}

// Inject slide-bg-N lines into front matter before the closing ---
function injectSlideBackgroundsIntoFrontMatter(frontMatter: string, backgrounds: string[]): string {
  const fm = frontMatter.split("\n").filter(l => !/^\s*slide-bg-\d+:/.test(l)).join("\n");
  const closingIdx = fm.lastIndexOf("---");
  const bgLines = backgrounds.map((bg, i) => `slide-bg-${i+1}: "${bg.replace("#", "")}"`).join("\n");
  return fm.slice(0, closingIdx).trimEnd() + "\n" + bgLines + "\n" + fm.slice(closingIdx);
}

// Inject <!-- _class: slide-bg-N --> directive at top of each slide body
function injectSlideClassDirectives(markdown: string): string {
  const parts = splitMarpDocument(markdown);
  const updated = parts.slides.map((slide, i) => {
    const bgClass = `slide-bg-${i + 1}`;
    return slide.replace(/<!--\s*_class:\s*slide-bg-\d+\s*-->/, `<!-- _class: ${bgClass} -->`)
               .replace(/^(?!<!-- _class)/, `<!-- _class: ${bgClass} -->\n`);
  });
  return [parts.frontMatter, "", updated.join("\n\n---\n\n"), ""].join("\n").trimEnd() + "\n";
}
```

Filmstrip cards get `style={{ background: bg }}` for instant feedback. Full Marp CSS integration requires a Save.

### MDXEditor dark mode — global CSS (not styled-jsx)

**styled-jsx does NOT pierce MDXEditor internals.** Use global CSS with `[class*="mdxeditor"]` wildcard selectors in `app/globals.css`:

```css
.presentation-mdx-editor *,
.presentation-mdx-editor [class*="mdxeditor"] {
  --baseText: #f4f4f5 !important;
  --basePageBg: #111113 !important;
}
.presentation-mdx-editor [contenteditable="true"],
.presentation-mdx-editor [class*="root-contenteditable"] *,
.presentation-mdx-editor [class*="rich-text-editor"] * {
  color: #f4f4f5 !important;
  background: transparent !important;
  caret-color: #fafafa !important;
}
```

Key: use `[class*="substring"]` attribute selectors alongside exact class selectors to cover MDXEditor's internal class name variations.

### Full plugin set
```
toolbarPlugin({ toolbarContents: () => (
  <><UndoRedo /><BoldItalicUnderlineToggles /><StrikeThroughSupSubToggles />
   <ListsToggle /><BlockTypeSelect /><InsertThematicBreak />
   <InsertCodeBlock /><InsertTable /></>
)}),
headingsPlugin(), listsPlugin(), quotePlugin(), thematicBreakPlugin(),
markdownShortcutPlugin(), linkPlugin(), linkDialogPlugin(),
codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
codeMirrorPlugin({ codeBlockLanguages: { "": "Plain Text", js: "JavaScript", ts: "TypeScript", json: "JSON", md: "Markdown", py: "Python", sql: "SQL", bash: "Bash" }}),
tablePlugin(),
```

Install: `npm install @mdxeditor/editor`. Import `@mdxeditor/editor/style.css`.

### Save flow (body-only)

```ts
async function handleSave() {
  const edit = editorMarkdownRef.current;
  const body = (edit || editorMarkdown).trimEnd();  // fallback to IIFE value
  let nextMarkdown = replaceMarpSlideBody(fullMarkdown, activeSlide, body);
  // Re-apply background classes and front-matter metadata
  nextMarkdown = injectSlideClassDirectives(nextMarkdown);
  const parts = splitMarpDocument(nextMarkdown);
  const fmWithBg = injectSlideBackgroundsIntoFrontMatter(parts.frontMatter, slideBackgrounds);
  nextMarkdown = [fmWithBg, "---\n", parts.slides.join("\n\n---\n\n"), ""].join("\n");
  // Save via savePresentationMarkdownAction(formData) with "presentationId" + "markdown"
  const form = new FormData();
  form.set("presentationId", presentationId);
  form.set("markdown", nextMarkdown);
  await savePresentationMarkdownAction(form);
  setFullMarkdown(nextMarkdown);
  editorMarkdownRef.current = body;
  setPreviewKey(v => v + 1);
}
```

Front-matter is preserved from `fullMarkdown` (not the editor) to avoid drift. After save, sync `editorMarkdownRef` to the saved body, set `fullMarkdown`, and increment `previewKey`.

## APIs

| Endpoint | Key fields |
|---|---|
| `GET /api/presentations/[id]/slides` | `slides[]`, `markdown` (raw, for undo/extraction) |
| `GET /api/presentations/[id]/preview?slide=N` | Single-slide iframe |
| `GET /api/presentations/[id]/preview?slide=filmstrip` | Vertical thumbnails |
| `POST /api/presentations/markdown` | FormData: `presentationId`, `markdown` |

## Server actions (lib/presentations/actions.ts)

- `savePresentationMarkdownAction(form)` — writes full deck.md
- `applyPresentationInspectStylesAction({ presentationId, targets })` — persists `<span class="apploop-el-*">` + CSS block
- `deletePresentationElementAction({ presentationId, slide, text })` — removes matched text from a slide
- `deletePresentationSlideAction({ presentationId, slideIndex })` — removes entire slide + cleans orphan CSS

## Layout (CSS grid, no resizable panels)

```
grid-template-columns: (chatOpen ? "18rem 1fr minmax(14rem, 18rem)" : "18rem 1fr")
```
- Left: filmstrip (scrollable, `scrollbarColor: #a1a1aa #18181b`)
- Center: editor (default) or preview iframe (toggled via `showPreview`)
- Right (toggle): chat panel via `chatOpen`

Filmstrip uses iframe thumbnails: `preview?slide=N`. Click sets `activeSlide`, resets `showPreview`.

## Build/common pitfalls

1. **`node:fs` in client bundle** — Check import source, use `marp-utils.ts` not `marp.ts`
2. **Nested `<button>`** hydration error — `<Button>` inside `<button>` → use `<div role="button">` or `<span onClick>`
3. **Blank editor on slide switch** — MDXEditor doesn't re-hydrate on prop change → use IIFE-derived `editorMarkdown` + `editorMarkdownRef` pattern above. Ensure `key` includes `activeSlide`.
4. **`slideContent` undefined** — IIFE must be assigned: `const slideContent = (() => { ... })();`, not `(function () { ... })();`
5. **`set-state-in-effect` lint** — add `eslint-disable-next-line react-hooks/set-state-in-effect` on the `setEditorMarkdown` line

## Removed (v1 inspect mode)

- Visual element select/drag/resize in iframe
- Floating `#apploop-inspect-hud` style panel
- `inspect-editor-assets.ts` — no longer injected
- `inspect-styles.ts` persistence — replaced by MDXEditor direct markdown editing
- `WrapMarpDocumentOptions.inspect` — removed
- `?inspect=1` query param in preview API — removed
- Undo/redo stack — MDXEditor has its own undo/redo toolbar
