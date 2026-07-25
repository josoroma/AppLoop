---
name: marp-builder
description: "Activates the AppLoop Marp presentation skill set for presentation-edit runs."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [bundle, marp, presentations]
    skills: [security-review, hermes-gateway, marp-presentations]
---

# Marp Builder Bundle

## Overview

Activate this bundle for every AppLoop presentation-edit run. It keeps gateway auth/session hygiene, workspace isolation, and Marp Markdown discipline without generated-app Next.js workflows.

## Skills

- `/security-review`
- `/hermes-gateway`
- `/marp-presentations`

## Activation order

1. `/security-review` — containment and secret safety
2. `/hermes-gateway` — server-only gateway auth, session context, stream hygiene
3. `/marp-presentations` — Marp front matter, slide separators, deck.md ownership

## Completion criteria

- Edits stay inside the presentation workspace
- `deck.md` remains valid Marp Markdown (front matter, `---` separators, per-slide directives, supported HTML patterns intact)
- AppLoop-managed markup is preserved (`apploop-el-*` spans, `@apploop-inspect-styles` block)
- No Next.js project scaffolding or package installs
- Affected files are reported
