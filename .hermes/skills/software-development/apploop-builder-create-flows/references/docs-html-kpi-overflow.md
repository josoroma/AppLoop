# Docs HTML KPI / card overflow

User signal: **"content overlaps"** on Luma dark architecture HTML hero cards (see `docs/README-HERMES.html`).

## Failure mode

Long unbreakable titles in a 3-column KPI strip bleed into the next card:

- `.hermes/{agents,bundles,skills,hooks,commands}`
- `createProjectAgentBundle()`
- long one-line paths under monospace/code styling

Root CSS mistakes:

1. `grid-template-columns: repeat(3, 1fr)` without `minmax(0, 1fr)` (tracks won’t shrink)
2. Missing `min-width: 0` / `overflow: hidden` on card
3. Code spans that default to `white-space: nowrap`

## Required CSS

```css
.grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.kpi { min-width: 0; overflow: hidden; }
.kpi .value {
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.25;
  font-size: clamp(0.95rem, 1.5vw, 1.15rem);
}
.kpi .value code {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
```

## Content patterns

Prefer readable shortened titles:

| Bad | Good |
|-----|------|
| `.hermes/{agents,bundles,skills,hooks,commands}` | `.hermes/` agents · bundles · skills · hooks · commands |
| `Assembled in lib/hermes/agents.ts, sent as agentBundle on gateway runs.` | `Built in lib/hermes/agents.ts and sent as agentBundle.` |

## Applies to

- `docs/README-HERMES.html`
- `docs/README-ARCHITECTURE-DOCUMENTATION.html`
- `docs/README-RESET.html`
- any future multi-column KPI / glass-card doc chrome

Also linked from the umbrella SKILL.md **Documentation pack** section.
