---
name: presentation-builder-patterns
description: "Implementation patterns for AppLoop's Marp presentation builder: MDX editor integration, body-only editing, background colors, Marp quirks, client/server boundaries. Load alongside apploop-presentation-dev or presentation-builder."
version: 2.0.0
---

# Presentation Builder Patterns

> **v2.0.0 — Inspect removed.** The visual inspect/select/drag-resize system was replaced by `@mdxeditor/editor` direct markdown editing. See `apploop-presentation-dev` for the current patterns. This skill retains Marp rendering quirks and client/server boundary rules.

## When to load

Load this skill when working on the AppLoop presentation builder UI, Marp rendering quirks, layout, or client/server boundaries. For MDX editor integration patterns, prefer `apploop-presentation-dev` or `presentation-builder`.

## Marp rendering quirks (debug)

1. **html: true required** — `marp-core` strips `<span>` tags without it. Needed for class directives.
2. **SVG wrapping** — Marp outputs `div.marpit > svg[data-marpit-svg] > foreignObject > section`. CSS must target the SVG element, not bare `section`, for sizing to work.
3. **CSS scoping** — Marpit auto-scopes front-matter `style:` rules. Never prefix selectors with `section`.
4. **`@theme` meta required** — Theme CSS must declare `/* @theme <name> */`.
5. **Percentage coordinates** — `left: x%` / `top: y%` work in the foreignObject coordinate system (1280×720).
6. **Per-slide `_class` directives** — `<!-- _class: slide-bg-N -->` at top of each slide for per-slide styling.

## Per-slide background colors (Marp-native)

The ONLY correct way to color slides is via the front-matter `style:` block — NOT YAML keys.

**Wrong (ignored by Marp):**
```yaml
slide-bg-1: "#c0392b"
```

**Right:**
```yaml
style: |
  section.slide-bg-1 { background-color: #c0392b !important; }
```

Plus `<!-- _class: slide-bg-N -->` at the top of each slide body.

The parse/inject helpers in `presentation-builder-shell.tsx` handle this:
- `parseSlideBackgrounds(frontMatter, count)` — reads `section.slide-bg-N` rules from `style:` block
- `injectSlideBackgroundsIntoFrontMatter(fm, bgs)` — writes CSS rules into `style:` block, strips old ones
- `injectSlideClassDirectives(markdown)` — inserts/updates `<!-- _class: slide-bg-N -->` per slide
- `getMarpSlideBody()` strips `<!-- _class: ... -->` before showing in editor

Filmstrip cards get `style={{ background: bg }}` so they match immediately.

## MDX Editor key patterns

- **NEVER** import `lib/presentations/marp.ts` in a client component. It pulls `node:fs` → Turbopack fails with "chunking context does not support external modules."
- **Even dynamic `import()` of marp.ts breaks the build** — Turbopack resolves it and pulls `node:fs` into the client bundle.
- **Solution**: Split into `lib/presentations/marp-utils.ts` (client-safe, no Node deps) and `lib/presentations/marp.ts` (server-only). The builder shell imports from `marp-utils.ts` only.
- `marp-utils.ts` exports: `splitMarpDocument`, `composeMarpSlideMarkdown`, `countMarpSlides`, `getMarpSlideSummaries`, `getMarpSlideBody`, `replaceMarpSlideBody`, `readPresentationSlideSize`, `fitImageToSlide`.
- **Rule:** any new pure/derivation helper a client component needs goes in `marp-utils.ts`, never `marp.ts`. Slide-geometry math (deck size, image fit) is pure — it belongs client-side so the builder can compute before saving.
- Use server actions for all deck mutations: `savePresentationMarkdownAction`, `deletePresentationSlideAction`.
- `GET /api/presentations/[id]/slides` returns `{ slides, totalSlides, markdown }`.
- `POST /api/presentations/markdown` accepts FormData `{ presentationId, markdown }`.

## Layout (CSS Grid — no resizable panels)

- 2-column default (chat hidden): `18rem 1fr`
- 3-column with chat: `18rem 1fr minmax(14rem, 18rem)`
- Filmstrip uses native div cards with iframe thumbnails (native scrollbars)
- Cards show per-slide background color via `style={{ background: bg }}`
- Thumbnail iframes have `pointer-events: none` so clicks pass through

## MDX Editor key patterns

See `apploop-presentation-dev` for the full implementation. Quick reference:

1. **State**: IIFE-derived `editorMarkdown` + `editorMarkdownRef` for onChange tracking
2. **Body-only**: `getMarpSlideBody` strips directives, `replaceMarpSlideBody` preserves front matter
3. **Dark mode**: Global CSS with `[class*="mdxeditor"]` wildcard selectors (styled-jsx doesn't work)
4. **Background colors**: Front matter `slide-bg-N` keys + `<!-- _class: slide-bg-N -->` directives
5. **Save**: body-only replacement, inject class directives, update front matter, save via server action

## Removed (as of v2.0.0 — inspect/visual-editor system)

The following patterns are **obsolete** and should not be used:

- Visual element select/drag/resize in iframe (replaced by MDXEditor)
- `#apploop-inspect-box` / `#apploop-inspect-hud` in iframes
- `inspect-editor-assets.ts` — no longer injected into preview HTML
- `inspect-styles.ts` — wrapper + CSS block persistence replaced by direct markdown editing
- `applyPresentationInspectStylesAction` — kept for backward compat, not used by new editor
- App-level undo/redo stack — MDXEditor has built-in undo/redo
- Iframe messaging protocol (select, drag, style-apply postMessages)
- `<span class="apploop-el-*">` wrappers with inline styles
- `WrapMarpDocumentOptions.inspect` — removed from API
