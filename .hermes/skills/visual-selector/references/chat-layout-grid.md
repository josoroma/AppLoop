# Chat Layout with Sticky Bottom Textarea

The builder's chat panel uses `react-resizable-panels` `<Panel>` component, which wraps children in a flex container. Standard flexbox approaches (`flex flex-col`, `h-full`, `overflow-hidden`) fail to properly constrain the conversation area — the textarea and buttons get pushed off-screen as messages grow.

## The Fix: CSS Grid

```tsx
<Panel>
  <section 
    className="grid grid-rows-[auto_1fr_auto] border-r bg-secondary/35" 
    style={{ height: "100%" }}
  >
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

- `grid-rows-[auto_1fr_auto]`: Three rows — header (natural height), conversation (fills remaining space), form (natural height)
- `height: 100%` as inline style: Forces the grid to fill the Panel wrapper. CSS `height: 100%` only resolves when the parent has a definite height — the Panel's `flex-basis` percentage does NOT count as definite height for `h-full` in Tailwind. The inline `style={{ height: "100%" }}` bypasses this.
- Conversation row is `1fr`: Takes all remaining space after header and form. Combined with `overflow-y-auto`, it scrolls when content overflows.
- Form row is implicit `auto`: Sized to its natural content height. Always visible at the bottom.

### What Did NOT Work

- `h-full` + `flex flex-col` — `h-full` doesn't resolve against `flex-basis` parents
- `min-h-0 flex-1` — still grew beyond the Panel
- `overflow-hidden` on the section — prevented the conversation area from showing its own scrollbar
- `absolute inset-0` — broke the Panel's resize drag behavior

### Related

- The `preview-frame.tsx` container also uses extra top padding (`pt-10`) to ensure the `preview-selection-label` is visible above elements near the top
- The targets area above the prompt uses `max-h-48 overflow-y-auto` for its own independent scroll
