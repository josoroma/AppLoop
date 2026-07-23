AppLoop inspect: clipboard paste (Ctrl+V) only screenshot. Multi-select toggle. Overlays absolute inside preview-viewport-frame. Labels inline-grid+max-content+nowrap, right:0. Repeated elements = base + unique last classname. Tracking 100ms updates rects only, not toggles. Never auto-screenshot.
§
User preference: If a visual/UI feature produces incorrect output and the user rejects it 2+ times ("no", "nope", "not equal", "still not the same"), stop iterating and offer removal or a fundamentally different approach. Don't repeatedly swap libraries/approaches when the user is signaling they want a different direction. This applies especially to screenshot/image capture features.
§
AppLoop: useChat id=projectId. Checkpoints in chat_checkpoints. New session clears messages. Preview load bg-black. Post-Hermes CSS: cache-bust iframe ?_t=. Create-project local-only; create-template Hermes first. Docs: docs/README-USER-FLOW-*.md.
§
AppLoop visual prompt: preferredSelector=last classname; compose with Target selections JSON boundaries via createVisualSelectionPrompt.
§
AppLoop restore: removes clicked prompt + all later messages from UI and persisted DB (timestamp-based delete to catch orphan assistant rows).
§
AppLoop model default: deepseek/deepseek-v4-pro via OpenRouter.
§
Specialty: luminous-rings=WebGL neon rings (dark-first). algovivo-creature=neural-walker cat: official quadruped mesh + appended ears/compact tail (scripts/generate-cat-mesh.py), pretrained MLPPolicy with active:true + numVertices/numMuscles caps, 30Hz fixed-step, yellow/blue/red palette, visibleWorldWidth~6.4, no face. See apploop-builder-create-flows/references/algovivo-creature-template.md.
§
Inspect multi-select scroll: template inspector-provider must track ALL selected elements in Map<string,HTMLElement>, iterate each on tracking updates so all overlays stay positioned after scroll.
§
Makefile `dev` passes `--port $(PORT)`; no port in package.json `dev`. Built-ins need BUILT_IN_PROJECT_TEMPLATES + seed; hot-edit template then rsync `.apploop/projects/<slug>/`.