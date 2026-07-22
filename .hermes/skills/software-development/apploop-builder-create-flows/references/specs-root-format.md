# Root SPECS.md format (AppLoop)

When the user asks for specs “like docs/SPECS.md” or an implementation statement of inventory:

## Shape

```markdown
# SPECS.md — AppLoop (...)
> Version | Last updated | Status line

## Legend
[ ] [~] [x] [!] plus skill markers

## Progress Summary
| Epic | Stories | Todo | In Progress | Completed | Blocked |

## Product Definition
topology ascii + owns lists

## Global Product Constraints
numbered hard rules

# E1: …
## US-1.1: Title [x]
Gherkin-style nested scenarios (Feature / Scenario / Given-When-Then)
### Tasks
- [x] T-1.1.1: …

# Implemented Runtime Topology
# MVP Definition of Done
# Acceptance Scenarios (Cross-epic)
# Environment Variables
# Open Decisions
# Document Control
```

## Content rules

- Document **what ships now**, not a speculative roadmap as done work.
- Keep deploy/remote as an open epic (`[ ]`) when unimplemented.
- Mirror real routes: `/projects/new`, `/templates/new`, not “create dialog”.
- Call out create-project = local; create-template = Hermes once; inspect-send = stream.
- Prefer acceptance scenarios that match server actions and `/api/chat`.
- Link companion prose docs rather than duplicating entire HTML runbooks.

## Maintenance

Update root `SPECS.md` when shipping or removing a user-visible epic/story. Recompute story counts in Progress Summary.