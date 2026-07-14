# Inspector Screenshot Capture (removed)

**Automatic screenshot-on-click was removed from the inspector-provider templates.**

The templates no longer capture screenshots or send `apploop:inspector-screenshot` messages. The `InspectorScreenshotMessage` type remains in `lib/visual-selector/types.ts` for backward compatibility but is not used by the templates.

## Why

Client-side DOM-to-image libraries (html2canvas, html-to-image, SVG foreignObject) do not capture actual composited pixels — they approximate CSS rendering and produce visually different output. Server-side CDP capture (Playwright) is accurate but adds latency and architectural complexity disproportionate to the feature's value.

Users can paste screenshots manually (Ctrl+V / Cmd+V) into the prompt textarea. See the `visual-selector` skill for the clipboard paste flow details.

## When debugging stale screenshots

If a user reports screenshots still appearing after cleanup, check the generated project at `.apploop/projects/<slug>/components/inspector-provider.tsx`. The generated project may have an old copy with screenshot capture logic. Copy the clean template to sync:

```bash
cp templates/generated-nextjs-default/components/inspector-provider.tsx \
   .apploop/projects/<slug>/components/inspector-provider.tsx
```

**Template mismatch warning**: The two templates share an identical `inspector-provider.tsx` (safe to cross-copy), but their `layout.tsx` and shell components differ. Always check which template the project uses before syncing layout files: `grep "template-" .apploop/projects/<slug>/app/layout.tsx`.
