# Screenshot Support Implementation Plan

> **Goal:** Add automatic element screenshots when selecting in Inspect Mode, and allow pasting additional screenshots into the prompt textarea with Ctrl+V / Cmd+V.

**Architecture:** Capture screenshots inside the generated app's iframe (InspectorProvider), stream them to the builder via postMessage, store them temporarily on disk via a new `/api/projects/[projectId]/screenshots` API route, surface attachment previews in the builder UI, and pass them alongside the prompt text to Hermes as structured image content.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand 5, `@ai-sdk/react` 4, `ai` 7, Drizzle ORM (SQLite), Tailwind CSS 4, shadcn/Radix primitives, Vitest, Playwright

---

## Feature Summary

### Feature A — Auto-screenshot on Inspect Select

When a user clicks an element in Inspect Mode and `apploop:inspector-select` fires from the iframe, the generated app's `InspectorProvider` captures a screenshot of the selected element using the `boundingRect` coordinates already present in the selection payload. The screenshot (as a `Blob` / `ImageBitmap`) is sent to the builder via a new `postMessage` type. The builder caches the screenshot and attaches it to the next prompt automatically, preserving the target class name and user instructions alongside it.

### Feature B — Clipboard Image Paste

Users can paste images (screenshots, mockups, reference images) into the prompt textarea via Ctrl+V / Cmd+V. The paste handler detects `ClipboardEvent.clipboardData.files` containing images, renders attachment previews below the textarea, and includes those images in the message payload sent to Hermes.

---

## Architecture and Data Flow

```
┌──────────────────────────────────────────────────┐
│  Generated App (iframe)                          │
│  ┌────────────────────────────────────────────┐  │
│  │ InspectorProvider.tsx                      │  │
│  │  1. User clicks element in Inspect Mode    │  │
│  │  2. createSelectionPayload() → boundingRect │  │
│  │  3. NEW: captureElementScreenshot(element)  │  │
│  │     → OffscreenCanvas + drawImage           │  │
│  │     → canvas.toBlob() or toDataURL()        │  │
│  │  4. NEW: postMessage({                      │  │
│  │       type: "apploop:inspector-screenshot", │  │
│  │       projectId, previewNonce,              │  │
│  │       dataUrl,                              │  │
│  │       selector, boundingRect                │  │
│  │     })                                       │  │
│  └────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────┘
                   │ postMessage
                   ▼
┌──────────────────────────────────────────────────┐
│  Builder (preview-frame.tsx)                     │
│  1. window.addEventListener("message", …)        │
│  2. NEW: handle "apploop:inspector-screenshot"   │
│  3. Validate origin + projectId + previewNonce   │
│  4. NEW: Upload dataUrl →                        │
│     POST /api/projects/:id/screenshots           │
│  5. Returned { screenshotId, path } →            │
│     Store screenshotId in Zustand:               │
│     useBuilderUiStore.attachScreenshot(id)        │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  Builder (builder-shell.tsx)                     │
│  ┌────────────────────────────────────────────┐  │
│  │ Zustand Store (use-builder-ui-store.ts)    │  │
│  │  NEW state:                                │  │
│  │   attachedScreenshots: Screenshot[]        │  │
│  │   pendingClipboardImages: ClipboardImage[] │  │
│  │                                            │  │
│  │  Screenshot = {                            │  │
│  │    id: string                              │  │
│  │    dataUrl: string (small thumbnail)       │  │
│  │    serverPath: string                      │  │
│  │    source: "inspector" | "clipboard"       │  │
│  │    associatedSelector?: string             │  │
│  │  }                                          │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Prompt Form:                                     │
│  ┌────────────────────────────────────────────┐  │
│  │ [Target classname: .header] [screenshot 🖼]│  │
│  │ [Pasted screenshot 🖼]        [✕ remove]   │  │
│  │ ┌──────────────────────────────────────┐   │  │
│  │ │ textarea (paste handler)             │   │  │
│  │ └──────────────────────────────────────┘   │  │
│  │ [Send]                                      │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  On Submit:                                       │
│  chat.sendMessage({                              │
│    text: createVisualSelectionPrompt(             │
│      prompt, selectedElement                     │
│    ),                                            │
│    files: attachedScreenshots.map(s => ({        │
│      name: s.id,                                 │
│      mediaType: "image/png",                     │
│      url: `/api/projects/${projectId}/           │
│            screenshots/${s.id}`                  │
│    }))                                           │
│  })                                               │
└──────────────────┬───────────────────────────────┘
                   │ DefaultChatTransport → POST /api/chat
                   ▼
┌──────────────────────────────────────────────────┐
│  API Route: POST /api/chat (route.ts)            │
│  1. Parse request body (already handled by       │
│     useChat + DefaultChatTransport)              │
│  2. NEW: Extract files[] from last user message  │
│  3. NEW: Read each file, convert to base64       │
│  4. Build augmented message:                     │
│     {                                            │
│       text: prompt,                              │
│       images: [{ mediaType: "image/png",        │
│                  data: "<base64>" }]            │
│     }                                            │
│  5. Pass to HermesClient.streamProjectRun()      │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│  HermesClient (lib/hermes/client.ts)             │
│  NEW: HermesRunRequest gains `images` field      │
│  streamRunPayload includes images in the         │
│  payload sent to Hermes API                      │
└──────────────────────────────────────────────────┘
```

---

## Affected Components

### Frontend

| File | Change |
|------|--------|
| `components/builder/use-builder-ui-store.ts` | Add `attachedScreenshots`, `pendingClipboardImages`, `attachInspectorScreenshot`, `attachClipboardImage`, `removeScreenshot`, `clearScreenshots` |
| `components/builder/builder-shell.tsx` | Add paste handler on textarea; render attachment previews; send `files` alongside `text` in `chat.sendMessage` |
| `components/builder/preview-frame.tsx` | Handle `apploop:inspector-screenshot` postMessage; upload to API; store screenshotId |
| `templates/generated-nextjs-default/components/inspector-provider.tsx` | Add `captureElementScreenshot()` using OffscreenCanvas; post screenshot on select |
| `templates/generated-nextjs-admin-luma/components/inspector-provider.tsx` | Same as default template (mirror) |

### Backend

| File | Change |
|------|--------|
| `app/api/projects/[projectId]/screenshots/route.ts` | **New** — POST (upload), GET (retrieve by id) |
| `app/api/chat/route.ts` | Extract `files` from user message; read & base64-encode; pass to HermesClient |
| `lib/hermes/client.ts` | Add `images` field to `HermesRunRequest` and payload builders |
| `lib/visual-selector/types.ts` | Add `InspectorScreenshotMessage` type; add screenshot-related types |
| `lib/chat/messages.ts` | Add `BuilderChatFileData` types for the data part |
| `lib/security/paths.ts` | Add `assertInsideScreenshotsDir` helper |
| `lib/hermes/agents.ts` | No schema changes needed (screenshots ride on the message) |

### Database

| File | Change |
|------|--------|
| `lib/db/schema.ts` | **New migration** — `screenshots` table: id, projectId, filename, mediaType, bytes, selector, source, createdAt |
| `lib/db/repository.ts` | New methods: `createScreenshot`, `findScreenshotById`, `deleteScreenshotsByProject` |

### Configuration

| File | Change |
|------|--------|
| `next.config.ts` | Add `serverExternalPackages: ["sharp"]` if using sharp; configure body size limit |
| `package.json` | Add `sharp` dependency for server-side image validation/optimization |

### Tests

| File | Change |
|------|--------|
| `tests/visual-selector.test.ts` | Add screenshot capture type tests, message validation |
| `tests/screenshots.test.ts` | **New** — API route tests, paste handler unit tests |
| `tests/e2e/screenshots.spec.ts` | **New** — Playwright e2e: inspect+select → screenshot attached → sent to chat |

---

## Implementation Phases

### Phase 1: Screenshot Capture in Inspector Provider (iframe side)

**Files:** `templates/generated-nextjs-*/components/inspector-provider.tsx`

1. Add a `captureElementScreenshot(element: HTMLElement): Promise<string>` helper:
   - Use `element.getBoundingClientRect()` for bounds (already available)
   - Use `OffscreenCanvas` (fallback to in-memory `<canvas>`) sized to `devicePixelRatio * (width, height)`
   - Use `drawImage` on the canvas 2D context to composite a screenshot
   - Convert to `data:` URL via `canvas.toBlob()` → `URL.createObjectURL` or `canvas.toDataURL("image/png", 0.85)`
   - Quality clamped to 0.85 to bound data URL size
   
2. In the `handlePointerDown` handler (line 193), after creating the selection and before posting `apploop:inspector-select`:
   - Call `await captureElementScreenshot(selectedElement)`
   - If successful, post a new message:
     ```ts
     window.parent.postMessage({
       type: "apploop:inspector-screenshot",
       projectId,
       previewNonce,
       dataUrl,
       selector: selection.preferredSelector,
       boundingRect: selection.boundingRect,
     }, parentOrigin);
     ```

3. The screenshot message is sent **after** the select message so the builder receives them in order.

**Pitfalls:**
- `OffscreenCanvas` is not supported in Firefox without flags; fallback to regular `<canvas>` in-memory
- Large elements may produce large data URLs; limit canvas dimensions to `max(4096, element size)` and use JPEG (0.80) for elements exceeding 2048px in either dimension
- `drawImage` on OffscreenCanvas may fail for cross-origin images; accept the partial result (elements with `<img crossorigin="anonymous">` or same-origin resources only)
- The `toDataURL` returns a string that could be >10MB for large elements; enforce a 5MB cap and downsample if needed

**Verification:** After inspect-selecting an element, a `console.log` in the builder's message handler should show the screenshot data URL received.

---

### Phase 2: Temporary Screenshot Storage API

**Files:** `app/api/projects/[projectId]/screenshots/route.ts` (new), `next.config.ts`, `lib/security/paths.ts`

1. **New API route** — `POST /api/projects/:projectId/screenshots`:
   - Accepts `multipart/form-data` with field `file` (the image) and optional fields `selector`, `source`
   - Validates project access via `requireProjectAccess`
   - Validates the uploaded file:
     - Media types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
     - Max file size: 10 MB
     - Verify magic bytes (not just Content-Type header)
   - Optionally optimizes with `sharp`: strip metadata (EXIF GPS, etc.), resize if >1920px, convert to PNG
   - Stores to `data/screenshots/<projectId>/<uuid>.png`
   - Inserts row into `screenshots` DB table
   - Returns `{ screenshotId, url }`

2. **GET /api/projects/:projectId/screenshots/:screenshotId**:
   - Retrieves and serves the stored image with correct `Content-Type`
   - Validates project access

3. **Path security** — Add `assertInsideScreenshotsDir` in `lib/security/paths.ts`:
   - Root: `path.join(process.cwd(), "data", "screenshots")`
   - Per-project subdirectory; validate project ID is a safe segment

4. **Cleanup** — On project deletion, remove all screenshot rows + files.

**next.config.ts changes:**
```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  // Body size limit for the screenshots API route
  experimental: {
    // default bodyParser limit is 1MB; increased via route config
  },
};
```

**DB Schema — new `screenshots` table:**
```sql
CREATE TABLE screenshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image/png',
  size_bytes INTEGER NOT NULL,
  selector TEXT,
  source TEXT NOT NULL DEFAULT 'inspector', -- 'inspector' | 'clipboard'
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX screenshots_project_id_idx ON screenshots(project_id);
```

**Pitfalls:**
- `sharp` is a native module; ensure it's listed in `serverExternalPackages`
- Large screenshots could fill disk over time; add a cap per project (50 screenshots max, oldest evicted)
- Concurrent uploads for the same project must not collide on filenames

---

### Phase 3: Builder State — Screenshot Attachment Store

**Files:** `components/builder/use-builder-ui-store.ts`, `lib/visual-selector/types.ts`

1. **New types** in `lib/visual-selector/types.ts`:
```ts
export type ScreenshotAttachment = {
  id: string;
  dataUrl: string;       // 128px thumbnail for preview
  serverPath: string;    // relative API path
  source: "inspector" | "clipboard";
  selector?: string;
  filename?: string;     // original filename for clipboard images
};

export type InspectorScreenshotMessage = {
  type: "apploop:inspector-screenshot";
  projectId: string;
  previewNonce: string;
  dataUrl: string;
  selector: string;
  boundingRect: VisualSelection["boundingRect"];
};
```

2. **Zustand store additions:**
```ts
type BuilderUiState = {
  // ... existing fields ...
  attachedScreenshots: ScreenshotAttachment[];
  attachInspectorScreenshot: (screenshot: ScreenshotAttachment) => void;
  attachClipboardImage: (screenshot: ScreenshotAttachment) => void;
  removeScreenshot: (id: string) => void;
  clearScreenshots: () => void;
};
```

- `attachInspectorScreenshot`: Replaces any existing inspector screenshot (only one at a time)
- `attachClipboardImage`: Appends; max 5 total (inspector + clipboard)
- `clearScreenshots`: Called after successful send, when clearing selected element, and on project switch

---

### Phase 4: Builder — Handle Screenshot from Preview Frame

**Files:** `components/builder/preview-frame.tsx`

1. In the `handleMessage` listener (line 138), add a case for `"apploop:inspector-screenshot"`:
   - Validate origin + projectId + previewNonce (same as existing handlers)
   - Read `dataUrl` and `selector` from the message
   - Convert the data URL to a Blob: `fetch(dataUrl)` → `.blob()`
   - Upload via `POST /api/projects/${projectId}/screenshots` with `FormData`
   - On success, create a thumbnail (resize the data URL to 128px using an offscreen canvas or just reuse the dataUrl and CSS-resize in the UI)
   - Call `useBuilderUiStore.getState().attachInspectorScreenshot({…})`

2. Edge case: if the screenshot upload fails (network error, size too large), silently skip — the selection still works without a screenshot.

---

### Phase 5: Builder — Clipboard Paste Handler

**Files:** `components/builder/builder-shell.tsx`

1. Add a `onPaste` handler to the prompt textarea (line 280):
```tsx
onPaste={async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      event.preventDefault(); // Don't paste binary into textarea
      const file = item.getAsFile();
      if (!file) continue;
      await handleClipboardImage(file);
      break; // Process first image only per paste
    }
  }
  // If no image found, let default paste behavior handle text
}}
```

2. `handleClipboardImage(file: File)`:
   - Validate type (`image/png`, `image/jpeg`, `image/webp`, `image/gif`)
   - Validate size (max 10 MB)
   - Read as data URL with `FileReader`
   - Generate a thumbnail (128px, or reuse data URL and CSS-resize)
   - Upload via `POST /api/projects/${projectId}/screenshots` with `source: "clipboard"`
   - Call `attachClipboardImage({ id, dataUrl: thumbnail, serverPath, source: "clipboard", filename: file.name })`

3. Additional: The paste handler should NOT intercept when the user is pasting text. Only block default behavior when an image is detected in the clipboard.

**Pitfalls:**
- On macOS, Finder screenshot copies place a PNG in the clipboard as `image/png`
- On Windows, the Print Screen key may place a bitmap; test for `image/bmp` and convert
- Some browsers (Safari) may not support `navigator.clipboard.read()` for images — `ClipboardEvent.clipboardData` is the reliable cross-browser approach

---

### Phase 6: Builder — Attachment Previews UI

**Files:** `components/builder/builder-shell.tsx`

1. Between the target classname display (line 263-273) and the textarea (line 280), render attachment previews:

```tsx
{attachedScreenshots.length > 0 && (
  <div className="mb-3 flex flex-wrap gap-2">
    {attachedScreenshots.map((screenshot) => (
      <div key={screenshot.id} className="group relative">
        <img
          src={screenshot.dataUrl}
          alt={screenshot.source === "inspector"
            ? `Screenshot of ${screenshot.selector ?? "selected element"}`
            : `Pasted image: ${screenshot.filename ?? "clipboard"}`}
          className="h-20 w-20 rounded-md border object-cover"
        />
        <button
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition group-hover:opacity-100"
          onClick={() => removeScreenshot(screenshot.id)}
          type="button"
          aria-label="Remove screenshot"
        >
          <X className="size-3" />
        </button>
        {screenshot.source === "inspector" && screenshot.selector && (
          <span className="mt-1 block truncate text-[10px] text-muted-foreground">
            {screenshot.selector}
          </span>
        )}
      </div>
    ))}
  </div>
)}
```

2. Update the submit handler (line 252-261) to include screenshots:
```tsx
onSubmit={(event) => {
  // ... existing logic ...
  if (prompt.length > 0 || attachedScreenshots.length > 0) {
    void chat.sendMessage({
      text: createVisualSelectionPrompt(prompt, selectedElement),
      files: attachedScreenshots.map((s) => ({
        name: s.id,
        mediaType: "image/png",
        url: s.serverPath,
      })),
    });
    event.currentTarget.reset();
    clearScreenshots(); // Also clears inspector screenshot
  }
}}
```

3. `clearScreenshots` is also called when the user clicks "Clear" on the selected element, and when switching projects.

---

### Phase 7: Chat API — Handle Images in Messages

**Files:** `app/api/chat/route.ts`, `lib/hermes/client.ts`, `lib/chat/messages.ts`

1. **Extract files from user message:**
   - `@ai-sdk/react`'s `useChat` sends files as `parts` in the message
   - In the route handler, after extracting `userMessage`, inspect `userMessage.parts` for parts of type `"file"` with `url` pointing to our screenshot API
   - Read each file from the filesystem (the URL is a relative path like `/api/projects/X/screenshots/Y` — resolve to the actual file path)
   - Base64-encode the image content

2. **Update `HermesRunRequest`** in `lib/hermes/client.ts`:
```ts
export type ImageAttachment = {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string; // base64-encoded, no data: prefix
};

export type HermesRunRequest = {
  // ... existing ...
  images?: ImageAttachment[];
};
```

3. **Update payload builders** to include images:
   - `streamRunPayload`: Add `images` field with base64 data
   - `gatewayRunPayload`: Add images into the `metadata` field or as structured input

4. **Update `lib/chat/messages.ts`**:
   - Add `BuilderChatDataTypes` entry for `"file"` parts if not already handled
   - Ensure `getMessageText` still works (it already filters to `type === "text"`)

**Pitfalls:**
- Base64 encoding adds ~33% overhead; a 5MB image becomes ~6.7MB base64
- Some Hermes providers have message size limits; enforce a total payload cap or compress images before sending
- Gateway mode (REST 404 fallback) stores images in metadata — verify the Hermes gateway can handle this

---

### Phase 8: Hermes Vision-Model Integration

**Files:** `.hermes/bundles/ui-builder/BUNDLE.md`, skill updates

1. **No Hermes-side changes needed** if the Hermes client API already supports image content in messages. The `images` field in the payload should be compatible with Hermes' standard multimodal message format.

2. **Update the UI Builder bundle** to mention screenshot awareness:
   - Add to completion criteria: "Screenshot context included when provided by the builder"

3. **Verify with Hermes docs** that the `/v1/runs/stream` and gateway endpoints accept images. If they require a specific format, adjust the payload shape in `lib/hermes/client.ts`.

4. **Fallback behavior:** If the configured Hermes model doesn't support vision, the screenshots are still attached but the model may ignore them. This is acceptable — the screenshots don't break the workflow.

---

### Phase 9: Validation, Limits, Error States, Security, Privacy

#### File Size Limits
- **Upload API:** 10 MB per image
- **Total payload per message:** 25 MB (enforced in API route before base64 encoding)
- **Max images per message:** 5
- **Per-project screenshot storage:** 50 files max (oldest evicted on new upload)

#### Supported Formats
- `image/png` — primary format for element screenshots
- `image/jpeg` — accepted for clipboard paste
- `image/webp` — accepted for clipboard paste
- `image/gif` — accepted but only first frame is meaningful; no animation support
- `image/bmp` — converted to PNG on upload (Windows clipboard support)

#### Validation
- **Magic byte verification** — check file headers, not just Content-Type
- **Dimension validation** — reject images smaller than 16×16 or larger than 8192×8192
- **Metadata stripping** — use `sharp` to remove EXIF, ICC profiles, GPS coordinates, thumbnails
- **Integrity** — verify the uploaded data is a valid image (sharp can parse it without error)

#### Error States
- **Screenshot capture failure (iframe):** Silent — selection still works
- **Upload failure (API down):** Toast notification; screenshot discarded; prompt sends without image
- **Image too large:** Validation error returned to client; shown as inline error near the attachment
- **Unsupported format:** Validation error; toast
- **Hermes rejects image:** Error event in stream; shown in chat error state
- **Disk full on server:** API returns 507; screenshots disabled for the session

#### Security & Privacy
- **No secrets in screenshots:** Already handled by the inspector (it doesn't capture raw DOM text). The image is a visual rendering only.
- **Server-side storage:** Screenshots stored in `data/screenshots/` (gitignored). Cleared on project deletion.
- **API auth:** Screenshot API routes use `requireProjectAccess` (same auth as chat)
- **No EXIF leak:** `sharp` strips all metadata before storage
- **No cross-project access:** Screenshot retrieval validates `projectId` matches the request
- **Per-session cleanup:** `clearScreenshots` called on project switch, element clear, and send

#### Browser Compatibility
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| `OffscreenCanvas` | ✓ 109+ | ✗ (behind flag) | ✓ 16.4+ | ✓ 109+ |
| `canvas.toBlob()` | ✓ | ✓ | ✓ | ✓ |
| `ClipboardEvent.clipboardData` | ✓ | ✓ | ✓ | ✓ |
| `navigator.clipboard.read()` for images | ✓ | ✗ | ✗ | ✓ |

**Fallback for OffscreenCanvas:** Use an in-memory `<canvas>` element (not attached to DOM) with `getContext("2d")`.

---

### Phase 10: Testing

#### Unit Tests (`tests/screenshots.test.ts`)
1. `InspectorScreenshotMessage` type validation
2. Clipboard image type detection from `DataTransferItemList`
3. File size validation logic
4. Magic byte verification
5. Path containment for screenshot storage
6. Zustand store: attach, replace, remove, clear

#### API Tests
1. `POST /api/projects/:id/screenshots` — valid upload
2. `POST` — invalid format → 400
3. `POST` — oversized → 413
4. `POST` — no auth → 403
5. `GET /api/projects/:id/screenshots/:sid` — valid retrieval
6. `GET` — wrong project → 404

#### Visual Selector Test Extension (`tests/visual-selector.test.ts`)
1. `createVisualSelectionPrompt` with screenshot metadata
2. New types compile correctly

#### E2E Tests (`tests/e2e/screenshots.spec.ts`)
1. Enable inspect mode → click element → verify screenshot appears in attachment area
2. Paste clipboard image → verify preview appears
3. Send prompt with screenshot → verify API receives image data
4. Remove screenshot → verify it disappears
5. Switch projects → verify screenshots cleared

---

## File Tree Summary

```
NEW FILES:
  app/api/projects/[projectId]/screenshots/route.ts
  data/screenshots/                          (gitignored)
  tests/screenshots.test.ts
  tests/e2e/screenshots.spec.ts
  lib/db/migrations/0005_screenshots.sql

MODIFIED FILES:
  components/builder/use-builder-ui-store.ts
  components/builder/builder-shell.tsx
  components/builder/preview-frame.tsx
  templates/generated-nextjs-default/components/inspector-provider.tsx
  templates/generated-nextjs-admin-luma/components/inspector-provider.tsx
  app/api/chat/route.ts
  lib/hermes/client.ts
  lib/visual-selector/types.ts
  lib/chat/messages.ts
  lib/security/paths.ts
  lib/db/schema.ts
  lib/db/repository.ts
  next.config.ts
  package.json
  .hermes/bundles/ui-builder/BUNDLE.md
  tests/visual-selector.test.ts
  docs/screenshots.md                       (this file)
```

---

## Risk and Tradeoffs

| Risk | Mitigation |
|------|------------|
| Large screenshots increase API payload size | Max dimensions, JPEG for large elements, 5MB data URL cap |
| OffscreenCanvas not in Firefox | Fallback to in-memory `<canvas>` |
| Hermes model doesn't support vision | Screenshots silently ignored; text prompt still works |
| Screenshot capture misses `position: fixed` elements | Use `getBoundingClientRect` (already handling negative coords per `types.ts:5`) |
| `sharp` adds native dependency complexity | Optional; fallback to pure-JS validation if sharp fails to install |
| Base64 images double payload size in transit to Hermes | Compress to JPEG 0.80 before base64; enforce payload cap |
| User pastes sensitive data as screenshot | Metadata stripped; no OCR; treated as opaque image content |

---

## Open Questions

1. **Should we support drag-and-drop image upload in addition to paste?** — Out of scope for this phase, but the infrastructure (upload API, attachment previews) would support it trivially.

2. **Should the screenshot capture include the inspector overlay (selection highlight)?** — No. The screenshot should show the element's natural visual state. Capture before any overlay is applied.

3. **How does Hermes handle multiple images in a single message?** — Need to verify the Hermes API format. The plan assumes `images: [{ mediaType, data }]` array format, which is standard for multimodal LLM APIs.

4. **Should we support annotating screenshots (arrows, highlights)?** — Out of scope. Users can paste annotated screenshots from external tools.

5. **What about animated GIFs?** — Only the first frame is sent. Animated GIFs are accepted on paste but converted to static PNG for storage.