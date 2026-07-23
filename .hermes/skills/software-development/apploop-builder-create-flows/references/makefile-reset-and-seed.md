# Makefile: run, reset, seed (current)

Source of truth: repo root `Makefile`. Engineer HTML: `docs/README-RESET.html`.

## Daily run

```bash
# Terminal A
make hermes-gateway          # :8642, HERMES_HOME=.hermes

# Terminal B
make dev                     # :3001, Makefile passes --port $(PORT)
```

Optional: `make hermes-gateway-curl-test`.

## Target ladder

```text
make seed
  ├─ apploop-reset
  │    ├─ rm .apploop/projects + runtime-logs + sqlite/db files
  │    └─ rm templates/*/node_modules + lockfiles
  └─ apploop-seed
       └─ apploop-seed-projects
            ├─ apploop-template-seed   # npm install every templates/*
            ├─ npm run db:migrate
            └─ npx tsx scripts/seed-projects.mts

make reset
  ├─ clean                   # builder .next/out/dist/build
  ├─ apploop-reset
  └─ rm root node_modules + package-lock.json
  # then: make install && make apploop-seed
```

| Target | Keeps root node_modules? | Wipes DB/projects? | Installs template deps? | Seeds demo projects? |
|--------|---------------------------|--------------------|-------------------------|----------------------|
| `apploop-template-seed` | yes | no | yes | no |
| `apploop-seed` | yes | no | yes | yes (idempotent by name) |
| `seed` | yes | yes | yes | yes |
| `reset` | **no** | yes | no | no |

## Two catalogs

1. **Disk templates** — `apploop-template-seed` loops `templates/*/package.json` (includes vestaboard, lumacv, immersive-full-screen, algovivo-creature, etc.).
2. **Demo projects** — `scripts/seed-projects.mts` only seeds `BUILT_IN_PROJECT_TEMPLATES` in `lib/projects/templates.ts`. **Built-ins today (7):** `default`, `admin-luma`, `ai-engineer-cv`, `deep-research-paper`, `luminous-rings`, `solar-system`, `algovivo-creature` (shipped name **Algovivo Soft Creature**, theme `luma-orange-stone`). Disk-only templates are **not** auto-demoed until registered there.

When adding a built-in, also update `docs/README-RESET.html` disk tags + built-in seed table (user-facing “reset and seed” docs). Detail: [`adding-built-in-template.md`](adding-built-in-template.md).

Env defaults for seeder: `PROJECTS_ROOT=.apploop/projects`, `DATABASE_URL=file:.apploop/builder.sqlite`, ports `3100–3199`.

## Recipes

```bash
# Recommended clean start
make seed && make hermes-gateway && make dev

# Nuclear
make reset && make install && make apploop-seed && make hermes-gateway && make dev

# Incremental demos only (skips existing names)
make apploop-seed-projects
```

## Safety

- `seed`/`apploop-reset` destroy SQLite (chat history, custom template **rows**) and generated workspaces.
- Template **source** under `templates/` and `.hermes/` remain; custom template folders can become orphans without DB rows.
- Idempotent seeder: same display name already present → skip. Use `make seed` for a true clean slate.

## Pitfalls

- Older docs stop at “template-seed + migrate”; live Makefile also runs `seed-projects.mts`.
- Do not hardcode `--port` in package.json `dev` if Makefile already passes it.
- Preview ports can linger after crash — free 3100–3199 if allocation fails after dense seeds.
- Seeder is skip-by-**name**: rename registry `name` without `make seed` (or deleting the old project) and the new title never appears as a demo card.
- README-RESET / root README catalog tables lag easily — treat them as part of the registration change, not a docs-only follow-up.
- After template source edits, already-seeded workspaces stay stale until rsync `templates/<id>/` → `.apploop/projects/<slug>/` (exclude `node_modules`/`.next`/`.git`) + hard-reload.