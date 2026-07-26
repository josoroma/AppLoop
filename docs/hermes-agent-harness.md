---
marp: true
theme: uncover
class: invert
paginate: true
size: 16:9
header: 'Hermes Agent Harness · AppLoop'
style: |
  :root {
    --hermes-blue: #0400ff;
    --hermes-blue-2: #0b20ff;
    --hermes-deep: #010052;
    --paper: #f7f7ff;
    --ink: #ffffff;
    --muted: rgba(255,255,255,0.74);
    --line: rgba(255,255,255,0.34);
    --panel: rgba(255,255,255,0.10);
  }
  section {
    background: radial-gradient(circle at 72% 46%, rgba(255,255,255,0.22) 0 1px, transparent 2px), radial-gradient(circle at 64% 42%, rgba(255,255,255,0.14), transparent 26%), linear-gradient(135deg, var(--hermes-blue) 0%, var(--hermes-blue-2) 58%, #0300c9 100%);
    color: var(--ink);
    font-family: 'Avenir Next', 'SF Pro Display', system-ui, sans-serif;
    font-size: 26px;
    text-align: left;
    padding: 58px 74px;
    justify-content: flex-start;
    overflow: hidden;
  }
  section::before {
    content: "";
    position: absolute;
    inset: 15% -8% auto auto;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    background: repeating-conic-gradient(from 12deg, rgba(255,255,255,0.56) 0deg 0.7deg, transparent 0.7deg 4.5deg);
    opacity: 0.34;
    pointer-events: none;
  }
  section.lead {
    justify-content: center;
    text-align: left;
    padding-left: 92px;
  }
  section.lead h1 {
    max-width: 820px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 82px;
    line-height: 0.92;
    letter-spacing: -2px;
    text-transform: uppercase;
  }
  h1, h2, h3 { color: var(--ink); }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 54px; line-height: 0.98; letter-spacing: -1px; text-transform: uppercase; }
  h2 { font-size: 34px; letter-spacing: -0.02em; }
  h3 { font-size: 24px; text-transform: uppercase; letter-spacing: 0.08em; }
  p, li { color: var(--muted); line-height: 1.52; }
  strong { color: var(--paper); }
  em { color: var(--paper); font-style: normal; border-bottom: 1px solid var(--line); }
  code { background: var(--paper); color: var(--hermes-blue); padding: 2px 8px; border-radius: 2px; font-family: 'SF Mono', Menlo, monospace; font-size: 0.86em; }
  pre { background: rgba(0,0,0,0.25); border: 1px solid var(--line); border-radius: 2px; padding: 18px 22px; font-size: 18px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: 20px; background: rgba(255,255,255,0.06); }
  th, td { border: 1px solid var(--line); padding: 10px 12px; text-align: left; }
  th { color: var(--hermes-blue); background: var(--paper); text-transform: uppercase; letter-spacing: 0.08em; font-size: 15px; }
  blockquote { margin: 18px 0; padding: 14px 20px; border-left: 3px solid var(--paper); background: rgba(255,255,255,0.10); color: var(--paper); }
  header, footer, section::after { color: rgba(255,255,255,0.70); font-size: 14px; }
  .eyebrow { color: var(--paper); letter-spacing: 0.22em; text-transform: uppercase; font-size: 15px; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .card { position: relative; border: 0; background: transparent; padding: 22px; min-height: 170px; }
  .card-shape { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; overflow: visible; }
  .card-shape rect { fill: rgba(255,255,255,0.10); stroke: rgba(255,255,255,0.34); stroke-width: 1; }
  .card > h3, .card > p { position: relative; z-index: 1; }
  .card h3 { margin-top: 0; }
  .card p { margin-bottom: 0; }
  .pill { display: inline-block; border: 1px solid var(--paper); color: var(--hermes-blue); background: var(--paper); padding: 5px 12px; border-radius: 999px; font-size: 17px; margin-right: 7px; font-weight: 700; }
  .flow { display: flex; align-items: stretch; gap: 8px; margin: 34px 0 24px; }
  .flow-step { position: relative; flex: 1 1 0; min-height: 128px; border: 0; background: transparent; padding: 16px 14px; }
  .flow-step-shape { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; overflow: visible; }
  .flow-step-shape rect { fill: rgba(255,255,255,0.12); stroke: rgba(255,255,255,0.34); stroke-width: 1; }
  .flow-step > h3, .flow-step > p { position: relative; z-index: 1; }
  .flow-arrow { flex: 0 0 18px; width: 18px; height: 18px; align-self: center; overflow: visible; }
  .flow-arrow path { fill: none; stroke: var(--paper); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .flow-step h3 { margin: 0; color: var(--paper); font-size: 18px; text-transform: uppercase; letter-spacing: 0.08em; }
  .flow-step p { margin: 10px 0 0; color: var(--muted); font-size: 17px; line-height: 1.35; }
apploopGradientPresets: '[{"id":"hermes-white-blue","label":"Hermes white blue","from":"#ffffff","to":"#dbe4ff","angle":180},{"id":"cobalt-white","label":"Cobalt white","from":"#0400ff","to":"#ffffff","angle":135},{"id":"deep-cobalt","label":"Deep cobalt","from":"#010052","to":"#0400ff","angle":135},{"id":"paper-blue","label":"Paper blue","from":"#f7f7ff","to":"#7d8cff","angle":90}]'
---

<!-- _class: lead -->

<p class="eyebrow">Open source agent infrastructure</p>

# Hermes Agent Harness

### How AppLoop turns Hermes into a local, scoped, visual app-building workflow

<br>

<span class="pill">Memory</span>
<span class="pill">Delegation</span>
<span class="pill">Isolation</span>

---

# The Hermes Signal

Hermes Agent is presented as an agent that grows with the user: one memory, many surfaces, and a tool-rich runtime that can browse, automate, delegate, and operate in isolated environments.

<div class="grid-3">

<div class="card">
<svg class="card-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="hermes-signal-connect-card" x="0" y="0" width="100" height="100" /></svg>
<h3>Connect</h3>
<p>Telegram, Discord, Slack, WhatsApp, Signal, email, CLI, and desktop surfaces.</p>
</div>

<div class="card">
<svg class="card-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="hermes-signal-remember-card" x="0" y="0" width="100" height="100" /></svg>
<h3>Remember</h3>
<p>Persistent memory and generated skills make solved problems reusable.</p>
</div>

<div class="card">
<svg class="card-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="hermes-signal-delegate-card" x="0" y="0" width="100" height="100" /></svg>
<h3>Delegate</h3>
<p>Subagents, terminals, scripts, browser tools, and model choice multiply execution.</p>
</div>

</div>

---

# Why AppLoop Needs A Harness

AppLoop is local-first. The builder owns project records, previews, SQLite state, path containment, checkpoints, theme metadata, and iframe boundaries.

Hermes owns generated workspace edits.

> The harness is the contract between those worlds: AppLoop decides what is allowed; Hermes decides how to change the generated app or presentation inside that boundary.

---

# AppLoop's Custom Hermes Bundle

Every chat request assembles a project-specific bundle before calling the local Hermes gateway.

| Bundle piece | AppLoop source | Purpose |
| --- | --- | --- |
| Orchestrator | `.hermes/agents/project-builder.md` | plan and delegate edits |
| Delegates | UI, Next.js, validation, security agents | specialist execution |
| Skills | `.hermes/skills/` | visual selector, runtime, themes, standards |
| Hooks | `.hermes/hooks/` | guardrails around generated work |
| Commands | `.hermes/commands/` | repo-local actions exposed to Hermes |

---

# Modes Matter

The same gateway receives different constraints depending on the AppLoop workflow.

<div class="columns">

<div>

**Project edit**

- Workspace: `.apploop/projects/<slug>`
- Preview runtime on a 3100-range port
- Visual selection can target generated UI
- Hermes may edit generated app files only

</div>

<div>

**Presentation edit**

- Workspace: `.apploop/presentations/<slug>`
- Source: `deck.md`
- No Next.js runtime
- Hermes is limited to Marp Markdown and presentation assets

</div>

</div>

---

# The Request Path

<div class="flow">

<div class="flow-step"><svg class="flow-step-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="request-path-user-box" x="0" y="0" width="100" height="100" /></svg><h3>User</h3><p>Prompt and optional visual selection</p></div>
<svg class="flow-arrow" viewBox="0 0 18 18" aria-label="Flow arrow"><path data-apploop-shape="request-path-user-apploop-arrow" d="M2 9 H15 M10 4 L15 9 L10 14" /></svg>
<div class="flow-step"><svg class="flow-step-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="request-path-apploop-box" x="0" y="0" width="100" height="100" /></svg><h3>AppLoop</h3><p>Server route validates context</p></div>
<svg class="flow-arrow" viewBox="0 0 18 18" aria-label="Flow arrow"><path data-apploop-shape="request-path-apploop-bundle-arrow" d="M2 9 H15 M10 4 L15 9 L10 14" /></svg>
<div class="flow-step"><svg class="flow-step-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="request-path-bundle-box" x="0" y="0" width="100" height="100" /></svg><h3>Bundle</h3><p>Agents, skills, hooks, commands</p></div>
<svg class="flow-arrow" viewBox="0 0 18 18" aria-label="Flow arrow"><path data-apploop-shape="request-path-bundle-gateway-arrow" d="M2 9 H15 M10 4 L15 9 L10 14" /></svg>
<div class="flow-step"><svg class="flow-step-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="request-path-gateway-box" x="0" y="0" width="100" height="100" /></svg><h3>Gateway</h3><p>Local Hermes run streams events</p></div>
<svg class="flow-arrow" viewBox="0 0 18 18" aria-label="Flow arrow"><path data-apploop-shape="request-path-gateway-workspace-arrow" d="M2 9 H15 M10 4 L15 9 L10 14" /></svg>
<div class="flow-step"><svg class="flow-step-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="request-path-workspace-box" x="0" y="0" width="100" height="100" /></svg><h3>Workspace</h3><p>Scoped generated files change</p></div>
<svg class="flow-arrow" viewBox="0 0 18 18" aria-label="Flow arrow"><path data-apploop-shape="request-path-workspace-preview-arrow" d="M2 9 H15 M10 4 L15 9 L10 14" /></svg>
<div class="flow-step"><svg class="flow-step-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="request-path-preview-box" x="0" y="0" width="100" height="100" /></svg><h3>Preview</h3><p>AppLoop reloads the result</p></div>

</div>

The browser never gets secrets or write authority. It sends intent and selection metadata; the server validates the workspace boundary and streams results back.

---

# Guardrails In The Harness

- `workspacePath` is the only writable root.
- Browser-provided paths, ports, process ids, and session ids are untrusted.
- Provider keys stay server-side.
- Generated UI needs inspectable classnames.
- Existing files require source inspection before edits.
- Validation and changed-file reporting are completion criteria.

<hr style="border: 0; height: 1px; background: var(--paper); width: 100%; margin: 22px 0;" />

The harness turns a powerful local agent into a bounded collaborator.

---

# What This Gives AppLoop

<div class="grid-3">

<div class="card">
<svg class="card-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="apploop-visual-edits-card" x="0" y="0" width="100" height="100" /></svg>
<h3>Visual edits</h3>
<p>Click an element, prompt the change, preserve the selector payload.</p>
</div>

<div class="card">
<svg class="card-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="apploop-local-control-card" x="0" y="0" width="100" height="100" /></svg>
<h3>Local control</h3>
<p>Projects, templates, and presentations stay in local workspaces with AppLoop-owned state.</p>
</div>

<div class="card">
<svg class="card-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect data-apploop-shape="apploop-auditable-runs-card" x="0" y="0" width="100" height="100" /></svg>
<h3>Auditable runs</h3>
<p>Checkpoints, streamed events, touched files, and validation make changes reviewable.</p>
</div>

</div>

---

# Design Language

This deck borrows the Hermes site palette: saturated cobalt, white editorial type, thin linework, and high-contrast panels.

| Token | Value | Use |
| --- | --- | --- |
| cobalt | `#0400ff` | primary slide field |
| paper | `#f7f7ff` | text, pills, rules |
| deep cobalt | `#010052` | depth and shadows |
| line | `rgba(255,255,255,0.34)` | tables and panels |

The content is AppLoop-specific; the atmosphere is Hermes-inspired.
