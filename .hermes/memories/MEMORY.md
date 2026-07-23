AppLoop inspect: clipboard paste (Ctrl+V) only screenshot. Multi-select toggle. Overlays absolute inside preview-viewport-frame. Labels inline-grid+max-content+nowrap, right:0. Repeated elements = base + unique last classname. Tracking 100ms updates rects only, not toggles. Never auto-screenshot.
§
User preference: If a visual/UI feature produces incorrect output and the user rejects it 2+ times ("no", "nope", "not equal", "still not the same"), stop iterating and offer removal or a fundamentally different approach. Don't repeatedly swap libraries/approaches when the user is signaling they want a different direction. This applies especially to screenshot/image capture features.
§
AppLoop: useChat id=projectId. Checkpoints in chat_checkpoints. New session clears messages. Preview bg-black. Post-Hermes CSS ?_t=. Create-project local; create-template Hermes first.
§
AppLoop visual prompt: preferredSelector=last classname; compose with Target selections JSON boundaries via createVisualSelectionPrompt.
§
AppLoop restore: removes clicked prompt + all later messages from UI and persisted DB (timestamp-based delete to catch orphan assistant rows).
§
AppLoop gateway model is builder-global at /projects/settings (defaultHermesModelId: deepseek-v4-pro|grok-4-5|nemotron-3-ultra-free|local-mlx-vlm). Async getHermesClient applies prefs each run; local needs make mlx-vlm-server + model_routes.
§
algovivo-creature=neural-walker cat: quadruped+ears+rump tail verts(3,4); MLPPolicy active+caps; 30Hz max-1+lag clamp+rest settle; yellow#f5c400/black#0a0a0a/red; universe no floor/grid; status 0.72rem; legend black+white ring; vww~6.4; no face. generate-cat-mesh.py.
§
Inspect multi-select scroll: re-query via preferredSelector each track tick if stored node dead; apply --selection-* on render + skip no-op rects. Sync all template+workspace inspector-providers.
§
Makefile `dev` passes `--port $(PORT)`; no port in package.json `dev`. Built-ins need BUILT_IN_PROJECT_TEMPLATES + seed; hot-edit template then rsync `.apploop/projects/<slug>/`.
§
Makefile hermes-gateway must start with `hermes gateway run --replace` (kill port alone leaves stale Hermes instance lock).