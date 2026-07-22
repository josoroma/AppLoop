# Root product docs + ship-to-main

## Authorities (order)

1. Live code
2. Root `SPECS.md` — epic → US → Gherkin → tasks; current shipped acceptance
3. `README.md`, `AGENTS.md`, `CLAUDE.md`, `SOUL.md`
4. `docs/README-*` user-flow MD + architecture/Hermes/reset HTML
5. Older planning notes / hub SPECS mirrors

## SPECS format (do not invent a new shape)

Match https://github.com/josoroma/AppLoop/blob/main/docs/SPECS.md historical format when regenerating root `SPECS.md`:

- Legend `[ ]` `[~]` `[x]` `[!]` + skill tags
- Progress summary table by epic
- Product definition + topology ascii
- Global constraints
- Epics E1… with US stories, Gherkin scenarios, task checklists
- MVP DoD, env families, open decisions

Root `SPECS.md` is the living implementation truth; historical `docs/SPECS.md` may be removed or superseded.

## README must include

- Product Hunt: `https://www.producthunt.com/products/apploop-2?launch=apploop-2`
- Demo videos Joso cares about capturing:
  - https://www.youtube.com/watch?v=jPHKrebwvyA
  - https://www.youtube.com/watch?v=RIXMJz4d5Es
  - https://www.youtube.com/watch?v=eZhgSQLvL6c
  - https://www.youtube.com/watch?v=kwJOute_Ej0
- TOC at top
- Architecture sketch, routes, `.apploop` / `.hermes`, commands including `make seed`

## Docs-only verification

```bash
git diff --check -- README.md AGENTS.md CLAUDE.md SOUL.md SPECS.md docs/*
```

Fix trailing double spaces (Markdown hard-breaks fail `--check`).

## Commit / merge to main

When asked to commit and push to main after multi-branch work:

1. Drop / ignore Hermes heartbeat and other runtime noise under `.hermes/state/`
2. Commit durable docs/skill refs if needed
3. Prefer fast-forward merge of the feature branch into `main` when linear history is available
4. Push `origin/main` and confirm clean WT + tracking

## Ops default

User often asks to “reset and seed for me” → run `make seed` (timeout generous) and report seeded project cards + ports.
