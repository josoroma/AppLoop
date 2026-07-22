AppLoop inspect: clipboard paste (Ctrl+V) only screenshot. Multi-select toggle. Overlays absolute inside preview-viewport-frame. Labels inline-grid+max-content+nowrap, right:0. Repeated elements = base + unique last classname. Tracking 100ms updates rects only, not toggles. Never auto-screenshot.
§
User preference: If a visual/UI feature produces incorrect output and the user rejects it 2+ times ("no", "nope", "not equal", "still not the same"), stop iterating and offer removal or a fundamentally different approach. Don't repeatedly swap libraries/approaches when the user is signaling they want a different direction. This applies especially to screenshot/image capture features.
§
AppLoop: useChat id=projectId. Checkpoints in chat_checkpoints. New session clears messages. Preview load bg-black. Post-Hermes CSS: cache-bust iframe ?_t= (not runtime restart). Create-project local-only; create-template Hermes first. Docs: docs/README-USER-FLOW-*.md.
§
AppLoop visual prompt: preferredSelector=last classname; compose with Target selections JSON boundaries via createVisualSelectionPrompt.
§
AppLoop restore: removes clicked prompt + all later messages from UI and persisted DB (timestamp-based delete to catch orphan assistant rows).
§
AppLoop model: default to deepseek/deepseek-v4-pro via OpenRouter for desktop, dashboard, and gateway.
§
WebGL particles template: native WebGL (no Three.js), dark-mode-first, luminous concentric laser rings in blue/pink/purple/white. Containers use dark gradients, nested text/controls use explicit high-contrast colors (not theme tokens).
§
Inspect multi-select scroll: template inspector-provider must track ALL selected elements in Map<string,HTMLElement>, iterate each on tracking updates so all overlays stay positioned after scroll.
§
AppLoop Makefile `dev` target: Makefile passes `--port $(PORT)` to `npm run dev`. If package.json's `dev` script also hardcodes `--port 3001`, the result is `next dev --port 3001 --port 3001`. Check both files when port-related CLI issues arise. Fix: remove port from package.json scripts, keep it in Makefile only.