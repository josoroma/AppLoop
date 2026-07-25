# Presentation Builder Layout

## Default (no inspector)

```
presentation-builder-grid (CSS grid)
  presentation-chat-pane     — minmax(16rem, 22rem) Chat + input
  presentation-filmstrip     — 18rem Native slide cards
  presentation-preview-pane  — 1fr Marp iframe
```

## With Inspector Panel

```
presentation-builder-grid-inspector
  minmax(14rem, 18rem) — Chat (narrower)
  15rem               — Filmstrip (narrower)
  1fr                 — Preview
  minmax(12rem, 14rem) — Inspector panel (right side)
```

## Editor Mode (Edit toggle)

Replaces entire grid with `PresentationMarkdownEditor` (full-width `@mdxeditor/editor`).

## Responsive

@media (max-width: 1280px) narrows columns.
@media (max-width: 1024px) further reduces.
