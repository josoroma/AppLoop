---
name: visual-selector
description: "Use when a user targets a preview element by selector or stable identifier: locate source, limit edits to the visual boundary, handle ambiguity, and report affected files."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [visual-selection, selectors, source-location, boundary-edits]
    related_skills: [frontend-design, generated-app-standards]
---

# Visual Selector

## Overview

Use this skill when a user selects an element from the preview and asks Hermes to change that specific boundary. The selected boundary constrains source search and edit scope.

## When to Use

- The prompt includes a selector such as `.dashboard-header`, `[data-apploop-id="hero-title"]`, or a selected element payload.
- The user says "this", "selected element", or "selected section" and AppLoop provides selection metadata.
- A change must be limited to a visual boundary and required descendants.

Do not use this skill for full-page redesigns without a selected target.

## Selector Payload

Expected payload fields:
- `selector`: class, data attribute, or stable generated identifier.
- `route`: preview route where the selection was made.
- `textSample`: optional visible text near the target.
- `bounds`: optional preview rectangle.
- `componentHint`: optional source or component name from inspection metadata.

## Source-Location Workflow

1. Search exact selector or stable id inside `workspacePath`.
2. If multiple files match, narrow by route and component hint.
3. If still ambiguous, compare visible text and nearby semantic class names.
4. If no source match exists, generate a stable identifier fallback and add it to the smallest owning boundary.

## Boundary-Limited Editing Rules

- Change only the selected boundary and required descendants.
- Do not rewrite unrelated siblings or page shell structure.
- Preserve semantic class names unless renaming is required and all references are updated.
- Report every affected file.

## Ambiguous Selector Handling

- If multiple plausible boundaries remain, ask for clarification or choose the nearest route-owned match when the prompt is low risk.
- Never apply broad edits to all selector matches unless the user explicitly asks for every matching element.

## Stable Identifier Fallback

- Prefer `data-apploop-id` for generated stable identifiers.
- Use kebab-case values that describe the boundary, such as `dashboard-header` or `billing-plan-card`.
- Keep identifiers stable across visual-only changes.