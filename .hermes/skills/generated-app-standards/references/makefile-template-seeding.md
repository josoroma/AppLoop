# Makefile Template Seeding Workflow

AppLoop templates in `templates/` are independent Next.js projects, each with their own `package.json`. They need `node_modules/` installed to be ready for use. The Makefile provides targets to clean and reseed these dependencies.

## Targets

| Target | What It Does |
|--------|-------------|
| `make apploop-template-seed` | Runs `npm install` in every `templates/*/` directory that has a `package.json`. Skips directories without one. |
| `make apploop-reset` | Removes `.apploop/` state (projects, logs, DBs) **and** cleans `node_modules/`, `package-lock.json`, `pnpm-lock.yaml` from all templates. |
| `make apploop-seed` | Runs `apploop-template-seed` first, then `npm run db:migrate`. |
| `make reset` | Runs `clean` → `apploop-reset` → removes root `node_modules` and `package-lock.json`. Full teardown. |

## Dependency Chain

```
apploop-seed     → apploop-template-seed → db:migrate
reset            → clean → apploop-reset → rm root node_modules
apploop-reset    → rm .apploop/* → rm template node_modules/locks
```

## When to Use

- **After `reset` or `apploop-reset`**: run `make apploop-seed` to reinstall template deps and migrate the DB.
- **After cloning the repo**: run `make install` then `make apploop-template-seed` to install template deps.
- **When adding a new template**: `make apploop-template-seed` picks it up automatically (loops over `templates/*/`).
- **When a template has stale `node_modules`**: `make apploop-reset && make apploop-seed` does a full rebuild.

## Verification

```bash
# Check which templates have node_modules installed
for dir in templates/*/; do
  name=$(basename "$dir")
  [ -d "$dir/node_modules" ] && echo "$name: HAS node_modules" || echo "$name: NO node_modules"
done
```

All 6 built-in templates should show `HAS node_modules` after seeding:

```
admin-luma, ai-engineer-cv, deep-research-paper, default, luminous-rings, solar-system
```

## Pitfalls

- **Template `node_modules` are excluded from project workspace copies** (`lib/projects/files.ts` filters `node_modules`). Runtime `ensureDependenciesInstalled()` installs deps in the generated workspace at first start. Template `node_modules` are for template-level validation and typechecking — not directly used at runtime.
- **`make apploop-template-seed` uses the global `npm`**, which can take 20-60+ seconds for all 6 templates. Run with `timeout` or background for large operations.
- **Some templates have extra deps** (e.g. `solar-system` includes Three.js, `luminous-rings` includes WebGL libs). The seeding loop handles heterogeneous `package.json` files correctly — each gets its own `npm install`.