# Chat Layout with Sticky Bottom Textarea

The builder's chat panel uses `react-resizable-panels` `<Panel>` component, which wraps children in a flex container. Standard flexbox approaches (`flex flex-col`, `h-full`, `overflow-hidden`) fail to properly constrain the conversation area — the textarea and buttons get pushed off-screen as messages grow.

## The Fix: Absolute Positioning + CSS Grid

```tsx
<Panel className="relative" collapsedSize={0} collapsible id="chat" minSize={24}>
  <section className="absolute inset-0 grid grid-rows-[auto_1fr_auto] border-r bg-secondary/35">
    <div className="border-b p-4">{/* header */}</div>
    <div className="space-y-3 overflow-x-hidden overflow-y-auto p-4" role="log">
      {/* conversation — fills 1fr, scrolls internally */}
    </div>
    <form className="border-t bg-card p-4">
      {/* textarea + buttons — pinned to bottom */}
    </form>
  </section>
</Panel>
```

### Why This Works

- Panel wrapper: `className="relative"` — establishes positioning context. react-resizable-panels Panel already has `overflow: hidden` on its wrapper.
- Section: `absolute inset-0` — fills the Panel's actual pixel dimensions. This bypasses the `height: 100%` problem entirely — the section sizes itself to the Panel's computed dimensions, not the Panel's `flex-basis` percentage.
- `grid-rows-[auto_1fr_auto]`: Three rows — header (natural height), conversation (fills remaining space), form (natural height).
- Conversation: `overflow-y-auto overflow-x-hidden` — vertical-only scroll when content exceeds `1fr` row.
- Form row: implicit `auto` — sized to natural content height. Always visible at bottom.

### What Did NOT Work

- `h-full` + `flex flex-col` — `height: 100%` doesn't resolve against `flex-basis` parents
- `min-h-0 flex-1 overflow-auto` — still grew beyond the Panel; `min-h-0` alone insufficient
- `overflow-hidden` on section — prevented conversation's own scrollbar from showing
- `style={{ height: "100%" }}` inline — same problem as `h-full`, CSS `height` requires definite parent height
- `overflow-auto` (both axes) — creates unwanted horizontal scroll on narrow panels. Always use `overflow-y-auto overflow-x-hidden`.

### Related

- The `preview-frame.tsx` container also uses extra top padding (`pt-10`) to ensure the `preview-selection-label` is visible above elements near the top
- The targets area above the prompt uses `max-h-48 overflow-y-auto` for its own independent scroll
