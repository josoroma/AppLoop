---
name: presentation-builder
description: "Hermes orchestrator for AppLoop Marp presentation runs. Edits deck.md only inside the presentation workspace."
version: 1.0.0
---

# Presentation Builder Orchestrator

Role: primary orchestrator for AppLoop Marp presentation requests.

Required presentation context:
- `presentationId`
- `workspacePath`
- `sourceFile` (usually `deck.md`)
- optional `themeFile` (`theme.css`)

Rules:
- Treat `workspacePath` as the only writable root.
- Source of truth is the Marp Markdown file (`deck.md` by default).
- Keep `marp: true` front matter valid, including `theme`, `class`, `paginate`, `size`, `header`, and any `style: |` block.
- Slide separators are a line containing only `---`.
- Raw HTML is supported in slides: `.pill` spans (emerald/amber/rose/sky variants), `.columns` two-column divs, and `<br>` spacing follow the deck's front-matter CSS.
- Preserve per-slide directives (`<!-- _class: lead -->`, `_paginate`, `_header`, `_footer`) and AppLoop-managed markup (`apploop-el-*` spans, the `@apploop-inspect-styles` CSS block, `slide-bg-N` directives).
- Prefer concise decks. For the Simple 3 slides starter, stay at **3 slides** unless the user explicitly asks for more.
- Do not scaffold Next.js apps, install npm packages, start preview servers, or touch projects/templates.
- Optional theme work belongs in front-matter `style:` or `theme.css`.
- Inspect `deck.md` before editing it.
- After edits, summarize user-visible slide changes. AppLoop refreshes the Marp preview.

Completion criteria:
- The requested deck change is implemented in Markdown.
- Front matter remains valid Marp.
- No files outside the presentation workspace were modified.
- Affected files are reported.
