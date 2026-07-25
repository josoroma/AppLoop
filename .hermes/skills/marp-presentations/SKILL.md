---
name: marp-presentations
description: "Use when Hermes authors or edits AppLoop Marp presentation Markdown decks (deck.md) under .apploop/presentations."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [marp, presentations, markdown, slides]
    related_skills: [hermes-gateway, security-review]
---

# Marp Presentations

## Overview

AppLoop presentations are plain Marp Markdown decks. The builder previews them with `@marp-team/marp-core`. There is no Next.js generated-app runtime for this mode.

## Workspace contract

- Writable root: the active presentation workspace only (`.apploop/presentations/<slug>/`)
- Source of truth: `deck.md` (or the presentation `sourceFile`)
- Optional theme: `theme.css` or front-matter `style:`
- Do not create `package.json`, `app/`, or install dependencies

## Marp authoring rules

1. Keep YAML front matter with at least:

```markdown
---
marp: true
theme: default
paginate: true
size: 16:9
---
```

2. Separate slides with a line that is only `---`.
3. Prefer short title, scannable bullets, strong hierarchy.
4. For built-in Simple 3 slides starter, **stay at 3 slides** unless the user expands scope.
5. Raw HTML **is supported** (the preview renders with `html: true`). Use the deck's established patterns:
   - Callout pills: `<span class="pill pill-emerald">Rules</span>` (variants: `pill-emerald`, `pill-amber`, `pill-rose`, `pill-sky`, or bare `pill`)
   - Two-column layout: `<div class="columns">` containing two `<div>…</div>` children with blank lines around Markdown inside
   - Manual spacing: `<br>`
6. Per-slide Marp directives are supported and must be preserved: `<!-- _class: lead -->` (hero slides), `_paginate`, `_header`, `_footer`, `_backgroundColor`, `_color`.
7. Rich decks define aesthetics in front-matter `style: |` — keep its CSS custom properties (`--bg`, `--fg`, `--accent`, `--accent-2`, `--danger`, `--info`, `--muted`, `--border`, `--code-bg`) and selectors (`section`, `section.lead`, `h1–h3`, `strong`, `em`, `code`, `pre`, `table`/`th`/`tr`, `blockquote`, `ul`/`li`, `a`, `header`, `section::after`, `.pill*`, `.columns`) intact unless the user asks to retheme.
8. Full block palette is supported: headings, paragraphs, bullet/numbered lists, checklists (`- [ ]`), pipe tables, blockquotes, fenced code blocks (including ASCII diagrams), `***` dividers, and images.
9. Keep monochrome-friendly contrast when theming dark decks.

## Edit workflow

1. Read `deck.md` first.
2. Apply the smallest Markdown change that satisfies the user.
3. Preserve existing slide structure unless asked to restructure.
4. Preserve AppLoop-managed markup you did not author:
   - `<span class="apploop-el-…">` wrappers (inspect element styles)
   - the `/* @apploop-inspect-styles */ … /* @apploop-inspect-styles-end */` block inside front-matter `style: |`
   - `<!-- _class: slide-bg-N -->` slide style directives
5. Report affected files (`deck.md`, optional `theme.css`).
6. Do not run package managers or Next validation commands.

## Anti-patterns

- Project/template UI classname contracts
- Visual selector / inspect boundaries
- Runtime start/restart/preview ports
- Editing sibling presentations, projects, or repo templates
