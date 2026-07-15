Do not add automatic screenshot-on-click for inspect mode in AppLoop. Keep clipboard paste (Ctrl+V) as the only screenshot path. Client-side DOM-to-image libraries are NEVER pixel-perfect; server-side Playwright CDP is accurate but overengineered for this use case.
§
AppLoop inspect mode: manual screenshot via Ctrl+V paste only. Multi-select click-to-toggle. Repeated elements = base + unique classname (e.g. metric-card summary-card metric-revenue). Tracking updates (100ms) must NOT toggle selections.
§
User preference: If a visual/UI feature produces incorrect output and the user rejects it 2+ times ("no", "nope", "not equal", "still not the same"), stop iterating and offer removal or a fundamentally different approach. Don't repeatedly swap libraries/approaches when the user is signaling they want a different direction. This applies especially to screenshot/image capture features.
§
AppLoop: Never change useChat id (it doubles as projectId in /api/chat). Sessions per-project via chat_checkpoints DB table. Session restore: save current msgs then load target. New session = chat.setMessages([]). Preview states use dark bg.