Inspect: Ctrl+V screenshot only; multi-select; overlays absolute in preview-viewport-frame; labels max-content/right:0; unique last classname; track rects only.
§
UI reject 2+: stop iterating; offer remove/different approach (esp screenshot).
§
useChat id=projectId; checkpoints chat_checkpoints; new session clears msgs; preview black; post-Hermes ?_t=; create-project local; create-template Hermes.
§
Visual prompt: preferredSelector=last classname; Target selections JSON via createVisualSelectionPrompt.
§
Restore: drop clicked prompt + later UI+DB msgs (timestamp delete orphans).
§
Gateway model global /projects/settings (deepseek-v4-pro|grok-4-5|nemotron-3-ultra-free|local-mlx-vlm); getHermesClient prefs/run; local=mlx-vlm-server+model_routes.
§
algovivo cat neural-walker: quad+ears+tail(3,4); MLPPolicy on; 30Hz; yellow/black/red; no grid/face; generate-cat-mesh.py.
§
Inspect multi-select: re-query preferredSelector each tick if node dead; --selection-* on render; skip no-op rects; sync inspectors.
§
Makefile: dev --port PORT; hermes-gateway=`run --replace`; Built-in=registry+seed; rsync template	o projects.
§
Presentations: filmstrip+MDXEditor(@mdxeditor/editor v4,per-slide)+Marp preview+chat toggle. Inspect/edit mode IS active (select, layers, drag, image toolbar). Save: reconstruct deck.md preserving front matter+other slides. marp-utils.ts=client-safe(no node:fs), marp.ts=server-only. Slide box=1280x720 deck coords, not iframe rect. Marp alt text carries directives (w:/h:/bg/fit/blur) — preserve on alt rewrite.
§
AppLoop: make reset wipes root node_modules, so make seed then fails at drizzle-kit migrate. Order: make reset → npm install → make seed (seed is idempotent).
§
AppLoop presentations: after make seed/reset the presentation UUIDs change, so bookmarked /presentations/<id> URLs 404 — re-read with `sqlite3 .apploop/builder.sqlite "select id,name,status from presentations"`.