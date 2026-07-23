# Adding A Built-In Specialty Template

Use when promoting a new disk template under `templates/<id>/` into AppLoop’s create-project catalog (not the Hermes Create Template / custom DB path).

## Built-in vs custom

| | Built-in | Custom |
|--|----------|--------|
| Source of truth | `lib/projects/templates.ts` + `templates/<id>/` | SQLite `project_templates` + `templates/<id>/` |
| Create path | Code change + seed | `/templates/new` → Hermes authoring |
| Demo project | `scripts/seed-projects.mts` only seeds built-ins | Not auto-seeded |

## Checklist

1. **Folder** `templates/<id>/` — independent Next.js app (`name: generated-apploop-app`), `CHOKIDAR_USEPOLLING=true` on `dev`.
2. **Body classname** in `app/layout.tsx`: `className="template-<id>"` (exact match to registry id).
3. **Registry** append to `BUILT_IN_PROJECT_TEMPLATES` in `lib/projects/templates.ts` (`id`, `name`, `description`, `templatePath`, `defaultThemeId`).
4. **Theme** — existing `defaultThemeId` from `lib/themes/registry.ts`, or new theme + `app/globals.css` `data-theme-id` swatches.
5. **Seed** — after registry entry: `npx tsx scripts/seed-projects.mts` (idempotent skip-by-name). Or `make apploop-seed-projects` / full `make seed`.
6. **Deps** — `npm install` in `templates/<id>/` (or `make apploop-template-seed`).

## Tests (required)

`tests/project-management.test.ts`:

- Expected id list in “wires every GitHub templates directory…” (sorted alphabetically with the new id).
- Specialty loop markers: `[id, "template-<id>", "<PageMarker>"]` where `page.tsx` contains that marker (e.g. `data-builder-component="AlgovivoCreaturePage"`).

`tests/generated-code-standards.test.ts`:

- Add canvas/sim component filenames that lack `className=` (R3F, WebGL, algovivo host, raw canvas) to the `ignored` Set in `collectTemplateUiFiles` (same as `solar-system-scene.tsx`, `canvas-scene.tsx`).

## Inspector providers (all templates)

Every `templates/*/components/inspector-provider.tsx` shares `SEMANTIC_CLASS_NAMES`. Add `"template-<id>"` to **all** of them (built-ins + vestaboard/lumacv/immersive leftovers), not only the new template.

## Hermes / agent docs

Update classname catalogs when provided skills allow edits:

- generated-app-standards / frontend-design / visual-selector / project-runtime body classname lists
- `.hermes/agents/nextjs-implementer.md`, hooks `generated-code-review`
- README Templates table, SPECS built-in catalog line

Note: some repo skills are **manually authored / protected** from autonomous curator writes — still edit product code + this create-flows skill.

## Specialty assets

| Kind | Pattern |
|------|---------|
| R3F / Three | deps in template `package.json`; ignore scene tsx in standards audit |
| Native WebGL | client canvas component |
| Vendored WASM / ESM | `templates/<id>/public/vendor/...`; load with `import(/* webpackIgnore: true */ href)` + `WebAssembly.instantiateStreaming` with `arrayBuffer` fallback; public/ copies with workspace |
| Full-screen immersive | single stage + unique last classnames on HUD |

## Verification

```bash
npm --prefix templates/<id> run typecheck
npm --prefix templates/<id> run lint
npm test -- tests/project-management.test.ts tests/generated-code-standards.test.ts
npm run typecheck
npx tsx scripts/seed-projects.mts
```

## Pitfalls

- **Registry without seed** → picker may show code registry, but Projects demo cards need seed.
- **Seed without registry** → no demo project.
- **Body classname ≠ id** → inspect + authoring asserts fail.
- **Only updating one inspector-provider** → inconsistent SEMANTIC_CLASS_NAMES across templates.
- **Canvas/sim file fails classname audit** → add filename to `ignored`, do not fake classNames on WebGL/DOM-less nodes.
- **Assuming custom-template DB row for built-ins** — wrong table.
- **Disk-only templates** (vestaboard, lumacv, immersive-full-screen, …) stay unlisted until registered here.

See also: [`algovivo-creature-template.md`](algovivo-creature-template.md), [`makefile-reset-and-seed.md`](makefile-reset-and-seed.md).
