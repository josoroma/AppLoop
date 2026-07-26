---
marp: true
theme: uncover
class: invert
paginate: true
size: 16:9
header: 'Claude Code Harness'
style: |
  :root {
    --bg: #0b0d12;
    --bg-2: #11141b;
    --fg: #e6e8ee;
    --muted: #9aa3b2;
    --accent: #34d399;
    --accent-2: #f59e0b;
    --danger: #f43f5e;
    --info: #38bdf8;
    --border: #1f2430;
    --code-bg: #0f1320;
  }
  section {
    background: var(--bg);
    color: var(--fg);
    font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif;
    font-size: 26px;
    text-align: left;
    padding: 56px 72px;
    justify-content: flex-start;
  }
  section.lead {
    text-align: center;
    justify-content: center;
    background: radial-gradient(ellipse at top, #131826 0%, var(--bg) 62%);
  }
  section.lead h1 {
    font-size: 66px;
    letter-spacing: -1.5px;
    background: linear-gradient(135deg, #34d399 0%, #38bdf8 50%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  h1, h2, h3 { color: var(--fg); letter-spacing: -0.5px; }
  h1 { font-size: 44px; border-bottom: 2px solid var(--border); padding-bottom: 12px; }
  h2 { font-size: 36px; }
  h3 { font-size: 26px; color: var(--accent); }
  strong { color: var(--accent); font-weight: 650; }
  em { color: var(--info); font-style: normal; }
  blockquote { border-left: 3px solid var(--accent); background: var(--bg-2); color: var(--muted); padding: 12px 20px; margin: 16px 0; border-radius: 4px; font-size: 22px; }
  code { background: var(--code-bg); color: #fef3c7; padding: 2px 8px; border-radius: 4px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.9em; }
  pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 18px 22px; font-size: 18px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; font-size: 20px; margin: 12px 0; }
  th, td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
  th { background: var(--bg-2); color: var(--accent); font-weight: 650; }
  ul, ol { line-height: 1.55; }
  li { margin: 4px 0; }
  header, footer, section::after { color: var(--muted); font-size: 14px; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--border); color: var(--muted); font-size: 18px; margin-right: 6px; }
  .pill-emerald { color: var(--accent); border-color: var(--accent); }
  .pill-amber { color: var(--accent-2); border-color: var(--accent-2); }
  .pill-rose { color: var(--danger); border-color: var(--danger); }
  .pill-sky { color: var(--info); border-color: var(--info); }
apploopGradientPresets: '[{"id":"emerald-sky","label":"Emerald sky","from":"#34d399","to":"#38bdf8","angle":135},{"id":"amber-rose","label":"Amber rose","from":"#f59e0b","to":"#f43f5e","angle":135},{"id":"violet-cyan","label":"Violet cyan","from":"#a78bfa","to":"#22d3ee","angle":135},{"id":"ink-silver","label":"Ink silver","from":"#f8fafc","to":"#94a3b8","angle":180}]'
---

<!-- _class: lead -->

# Claude Code Harness

### Spec-driven delivery for AI coding agents

<br>

<span class="pill pill-emerald">Rules</span>
<span class="pill pill-sky">Skills</span>
<span class="pill pill-amber">Agents</span>
<span class="pill pill-rose">Hooks</span>

---

# Why a Harness?

Without structure, an LLM agent can drift. A harness binds the run to a single source of truth and two-sided enforcement: upstream instructions before work, downstream gates before code leaves the branch.

| Concept | Source | When | Modifies code? |
| --- | --- | --- | --- |
| **Rules** | `.claude/rules/` | auto-loaded guidance | No |
| **Skills** | `.claude/skills/` | invoked recipes | Yes |
| **Agents** | `.claude/agents/` | delegated context | Usually bounded |
| **Hooks** | `.husky/` | commit / push gates | No |

---

# Document Chain

```
Product design document      -> what and why
SPECS.md                     -> what to build, in order
CLAUDE.md                    -> how to build it
.claude/                     -> how the agent operates
  rules/                     -> always-on guardrails
  skills/                    -> repeatable workflows
  agents/                    -> specialist roles
.husky/                      -> what cannot ship
```

> One story, one prompt, one audited change.

---

# Operating Model

<div class="columns">

<div>

**Before edit**

- Locate controlling file
- Read nearby tests/docs
- State the smallest falsifiable hypothesis
- Make the smallest grounded change

</div>

<div>

**After edit**

- Run focused validation
- Repair same slice first
- Broaden only when evidence requires it
- Report changed files and residual risk

</div>

</div>

---

# Delivery Gates

- Formatting and linting keep style drift out.
- Type checks catch broken contracts.
- Unit slices prove the touched behavior.
- Commit messages tie the change back to the story.
- Push gates keep unfinished or unreviewed work local.

```bash
npm run lint
npm run typecheck
npm test -- tests/touched-slice.test.ts
```

---

# The Point

The harness does not make the agent slower. It makes the agent **legible**.

- Local context before broad guesses
- Tools over memory when facts matter
- Explicit ownership boundaries
- Validation as part of the work, not a ceremony after it
