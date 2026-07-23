# Preferred Hermes gateway model (AppLoop)

Builder-global default for **every** AppLoop ↔ Hermes call:

- create-template `runProjectOnce`
- project-edit / template-edit `streamProjectRun`
- cancel run

Protected skill `hermes-gateway` should eventually mirror this; keep the durable agent-created recipe **here** while that skill stays manually authored.

## Storage + code paths

| Piece | Location |
| --- | --- |
| Column | `builder_preferences.default_hermes_model_id` |
| Migration | `lib/db/migrations/0009_builder_default_hermes_model.sql` |
| Singleton row | `id = 'local'` |
| Catalog | `lib/hermes/models.ts` |
| Resolve | `lib/hermes/preferences.ts` → `getPreferredHermesConfig()` |
| Client | **async** `getHermesClient()` in `lib/hermes/store.ts` (fresh preference each request) |
| UI | `/projects/settings` + **Settings** CTA on `/projects` |
| Save action | `updateBuilderHermesModelAction` |

## Curated options

| option id | label | model | provider |
| --- | --- | --- | --- |
| `deepseek-v4-pro` | DeepSeek V4 Pro | `deepseek/deepseek-v4-pro` | `openrouter` |
| `grok-4-5` | Grok 4.5 | `x-ai/grok-4.5` | `openrouter` |
| `nemotron-3-ultra-free` | Nemotron 3 Ultra (free) | `nvidia/nemotron-3-ultra-550b-a55b:free` | `openrouter` |
| `local-mlx-vlm` | Local MLX VLM | `local-qwen3.6-27b-optiq-4bit` | `mlx-vlm` |

Default option id follows `DEFAULT_HERMES_MODEL` in `lib/env/schema.ts` (`deepseek/deepseek-v4-pro`), not the Hermes TUI default in `.hermes/config.yaml`.

## Payload

`HermesClient` stream + gateway payloads must carry:

```ts
model: selection.model
metadata: {
  inferenceModel: selection.model,
  inferenceProvider: selection.provider,
  …
}
```

Preference overwrites env values from `getHermesConfig()` before client construction.

## Hermes route map

Under `.hermes/config.yaml` → `platforms.api_server.extra.model_routes`, every selectable model string must exist. Agent write tools may refuse `.hermes/config.yaml` — use terminal or `docs/hermes-model-routes.snippet.yaml`, then restart the gateway.

Local route example:

```yaml
local-qwen3.6-27b-optiq-4bit:
  model: /Users/<user>/models/qwen/Qwen3.6-27B-OptiQ-4bit
  provider: custom
  base_url: http://127.0.0.1:8080/v1
  api_key: not-needed
```

## Local MLX path

```bash
make mlx-vlm-setup
make mlx-vlm-download
make mlx-vlm-server
```

Then select **Local MLX VLM** in settings.

## Pitfalls

- Caching `let client = new HermesClient(getHermesConfig())` ignores UI settings until process restart — always resolve preference per request.
- UI option without `model_routes` → gateway misroutes or rejects.
- OpenRouter free models are rate-limited; badge them Free.
- No secrets on the settings page — only option ids.
- Foundation `builderTables` key tests lag schema growth — update expected keys when extending tables.