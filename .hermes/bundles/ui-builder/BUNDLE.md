---
name: ui-builder
description: "Activates the AppLoop UI builder skill set for generated-project runs: frontend design, generated app standards, theme system, project runtime, visual selector, and security review."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [bundle, ui-builder, generated-projects]
    skills: [frontend-design, generated-app-standards, theme-system, project-runtime, visual-selector, security-review]
---

# UI Builder Bundle

## Overview

Activate this bundle for every AppLoop generated-project run. It makes the design, code, theme, runtime, selection, and security skills available in a predictable order.

## Skills

- `/frontend-design`
- `/generated-app-standards`
- `/theme-system`
- `/project-runtime`
- `/visual-selector`
- `/security-review`

## Activation Order

1. `/security-review`: establish trusted project context and isolation rules.
2. `/visual-selector`: narrow the target when a preview selector is present.
3. `/theme-system`: resolve selected Luma/shadcn tokens before UI design.
4. `/frontend-design`: define layout hierarchy, component map, states, and semantic class names.
5. `/generated-app-standards`: apply code-generation conventions during implementation.
6. `/project-runtime`: validate, start or restart preview, inspect logs, and emit preview readiness.

## Completion Criteria

- All six skills are available to the run.
- Activation order is preserved unless the run does not need a target-specific or runtime-specific step.
- The final response reports implementation, validation, and preview readiness outcomes.