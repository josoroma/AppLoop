# Screenshots

## Current State

**Automatic screenshot-on-click was removed.** The inspector-provider templates no longer capture screenshots on element click. Users paste screenshots manually (Ctrl+V / Cmd+V) into the prompt textarea.

## Clipboard Paste Flow

```
User presses Ctrl+V / Cmd+V in textarea
  │
  ▼
builder-shell.tsx: handleClipboardPaste(event: ClipboardEvent)
  ├── Scan event.clipboardData.items for image/* types
  ├── If image found: event.preventDefault()
  ├── item.getAsFile() → File
  ├── FileReader.readAsDataURL() → thumbnail
  ├── attachClipboardImage({ id, dataUrl, serverPath, source: "clipboard", filename })
  └── POST /api/projects/:id/screenshots (source="clipboard") — background upload for persistence
  │
  ▼
builder-shell.tsx
  ├── ScreenshotAttachment thumbnails render below target classname bar
  ├── On submit: chat.sendMessage({ text, files: [{ type: "file", mediaType, filename, url }] })
  └── useChat → DefaultChatTransport → POST /api/chat
  │
  ▼
/api/chat/route.ts (server)
  ├── extractImagesFromMessage(userMessage, projectId)
       │     ├── Filter parts where type === "file" && mediaType starts with "image/"
       │     ├── Resolve URL → screenshotId → DB row → fs.readFile
       │     ├── Buffer → base64
       │     └── Return ImageAttachment[]: { mediaType, data }
    ├── saveScreenshotsToWorkspace(images, workspacePath)
       │     ├── mkdir workspacePath/.apploop/screenshots/
       │     ├── Write base64-decoded PNG/JPG files
       │     └── Return workspace-relative paths: [".apploop/screenshots/<file>.png"]
    └── appendScreenshotPaths(prompt, paths)
          └── Appends "[Screenshots attached — use vision_analyze with these workspace-relative paths]" block
  │
  ▼
Hermes API
  ├── REST: payload.images = [{ mediaType, data }]
  └── Gateway: payload.images included in metadata
```

## Message Types

### apploop:inspector-screenshot (retained for backward compat)

```ts
type InspectorScreenshotMessage = {
  type: "apploop:inspector-screenshot";
  projectId: string;
  previewNonce: string;
  dataUrl: string;
  selector: string;
};
```

This type is still in `lib/visual-selector/types.ts` and `preview-frame.tsx` handles it, but the templates no longer send it.

### ScreenshotAttachment (builder state)

```ts
type ScreenshotAttachment = {
  id: string;
  dataUrl: string;       // thumbnail (CSS constrains to 80×80)
  serverPath: string;    // data: URL for pasted, /api/… path for clipboard upload
  source: "inspector" | "clipboard";
  selector?: string;
  filename?: string;
};
```

### ImageAttachment (server → Hermes)

```ts
type ImageAttachment = {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string;          // Base64-encoded, no data: prefix
};
```

## Screenshot Storage API

### POST /api/projects/:projectId/screenshots

- Accepts `multipart/form-data` with fields: `file` (required), `selector`, `source`
- Validates: media type (allow-list), file size (≤10MB), magic bytes
- Stores to `data/screenshots/<projectId>/<uuid>.png`
- Inserts DB row in `screenshots` table
- Evicts oldest when project exceeds 50 screenshots
- Returns `{ screenshotId, url }`

### GET /api/projects/:projectId/screenshots/:screenshotId

- Serves the image file with correct `Content-Type` and `Cache-Control`
- Validates project access and screenshot ownership

## Builder State Management

The Zustand store (`useBuilderUiStore`) manages screenshots:

- `attachInspectorScreenshot(s)`: Appends; max 5 total
- `attachClipboardImage(s)`: Appends; max 5 total
- `removeScreenshot(id)`: Removes one by id
- `clearScreenshots()`: Called on send, on "Clear" button, on project switch

## Key Files

| File | Role |
|------|------|
| `templates/…/inspector-provider.tsx` | Inspect mode element selection (no screenshot capture) |
| `components/builder/preview-frame.tsx` | IFRAME message handling, selection overlay, route sync |
| `components/builder/builder-shell.tsx` | Attachment UI, paste handler, send |
| `components/builder/use-builder-ui-store.ts` | Screenshot state (Zustand) |
| `app/api/projects/[projectId]/screenshots/route.ts` | Upload + retrieve API |
| `app/api/chat/route.ts` | Extracts images from message, passes to Hermes |
| `lib/hermes/client.ts` | `ImageAttachment` type, `images` in payload |
| `lib/visual-selector/types.ts` | `InspectorScreenshotMessage`, `ScreenshotAttachment` |

## Why Automatic Screenshots Were Removed

Client-side DOM-to-image libraries (html2canvas, html-to-image, SVG foreignObject) do not capture actual composited pixels from the browser — they approximate CSS rendering and produce visually different output. Server-side CDP capture (Playwright) is accurate but adds latency, dependency, and architectural complexity disproportionate to the feature's value. The user decided manual clipboard paste provides the needed visual context without these tradeoffs.