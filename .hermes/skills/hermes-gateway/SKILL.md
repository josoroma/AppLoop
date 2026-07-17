---
name: hermes-gateway
description: "Use when AppLoop integrates with Hermes gateway streaming: session context, server-only authentication, event normalization, cancellation, and user-safe errors."
version: 1.0.0
author: AppLoop
license: MIT
metadata:
  hermes:
    tags: [gateway, streaming, sessions, cancellation, errors]
    related_skills: [project-runtime, security-review]
---

# Hermes Gateway

## Overview

Use this skill when a generated-project run needs to communicate with the Hermes backend through the AppLoop server. Gateway work must keep authentication server-side and expose only user-safe stream events to the browser.

## Inputs

- `projectId` from trusted server routing.
- `workspacePath` from the project repository.
- `conversationId` and optional server-resolved Hermes session id.
- User message text.
- Agent, skill, hook, and command metadata for the run.
- The full AppLoop `agentBundle` metadata, including repo-local paths for `.hermes/agents/`, `.hermes/bundles/ui-builder/BUNDLE.md`, `.hermes/skills/`, `.hermes/hooks/`, and `.hermes/commands/`.

## Outputs

- Normalized text deltas.
- Observable activity events without private reasoning.
- Completion, cancellation, or user-safe error state.

## Rules

- Never send `HERMES_API_KEY` or raw environment values to browser code.
- Strip browser-provided reserved session placeholders before calling Hermes.
- Include project-scoped metadata with every run.
- Include `agentBundle` as top-level gateway payload data and inside metadata so gateway-run prompts can load and follow the repo-local AppLoop agents, skill bundle, skills, hooks, and commands.
- Gateway instructions must restate the generated-code classname contract: every user-visible generated UI element needs shared/base classnames where useful plus a unique, human-readable classname written last for inspect-mode targeting.
- Map transport and authentication failures to user-safe messages.
- Preserve cancellation state for active project runs.

## Completion Criteria

- Stream transport is selected from server configuration.
- Authorization is server-only.
- Events are normalized before reaching UI message data.
- Cancellation and errors have deterministic user-facing outcomes.