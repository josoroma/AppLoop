# Session Synchronization Implementation Plan

> **For Hermes:** Implement this plan directly with strict TDD. Keep the first pass scoped to the critical synchronization invariant from `README-SYNC-SESSIONS.md`: the active AppLoop conversation is the authority for the Hermes session used by the next run.

**Goal:** Make AppLoop sessions first-class database conversations, bind new sessions to reserved Hermes session IDs, and persist prompt metadata separately enough to support safer edit/resend.

**Architecture:** Add active-conversation fields and synchronization metadata to the Drizzle schema plus a migration. Update project creation, duplication, project overview hydration, and the chat route so the active conversation’s `hermesSessionId` is authoritative. Add a server action for “New session” that creates a new conversation and switches the project active pointer. Add raw/composed prompt metadata helpers and persist inferred raw prompt fields on user messages.

**Tech Stack:** Next.js server actions, Drizzle ORM with SQLite/libSQL, Vitest, AI SDK `useChat`, Hermes REST/gateway client.

---

## Task 1: Add failing tests for active conversation session ownership

**Objective:** Capture the desired invariant before changing production code.

**Files:**
- Create: `tests/session-sync.test.ts`
- Exercise: `lib/projects/service.ts`, `lib/hermes/session-sync.ts`, `lib/chat/prompt-metadata.ts`

**Steps:**
1. Add tests asserting project creation reserves Hermes IDs from the conversation ID and sets `project.activeConversationId`.
2. Add tests asserting new sessions create a fresh conversation with `reserved:<conversationId>` and parent linkage.
3. Add tests asserting Hermes run session resolution prefers `conversation.hermesSessionId` over stale `project.hermesSessionId`.
4. Add tests asserting prompt metadata splits raw prompt from `Target selections JSON:`.
5. Run `npm test -- tests/session-sync.test.ts` and confirm RED.

## Task 2: Extend schema and migrations

**Objective:** Add the minimum database shape needed by the invariant.

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0007_session_sync.sql`
- Modify: `lib/db/migrations/meta/_journal.json`

**Steps:**
1. Add `projects.activeConversationId`.
2. Add conversation branch/session fields: `status`, `kind`, `parentConversationId`, `branchedFromMessageId`, `branchedFromCheckpointId`, `fileSnapshotCommit`.
3. Add message prompt metadata columns: `rawUserPrompt`, `composedPrompt`, `visualSelectionJson`, `screenshotIdsJson`, checkpoint/session metadata.
4. Add checkpoint/run synchronization columns.
5. Add `sessionEvents` and `hermesSessionLinks` tables.
6. Add SQL `ALTER TABLE` and `CREATE TABLE` migration.

## Task 3: Update repository and service behavior

**Objective:** Make active conversations durable and queryable.

**Files:**
- Modify: `lib/db/repository.ts`
- Modify: `lib/projects/repository.ts`
- Modify: `lib/projects/service.ts`

**Steps:**
1. Add repository methods for `createConversation`, `findConversationById`, and `setActiveConversation`.
2. Change `hydrateProjectOverview()` to load `project.activeConversationId` first and fall back to the first conversation for migration compatibility.
3. Change project creation/duplication to generate the conversation ID first, reserve `reserved:<conversationId>`, and set `project.activeConversationId`.
4. Add `startNewProjectConversation(projectId)` to create a child session conversation and switch the project active pointer.

## Task 4: Update chat route and prompt metadata

**Objective:** Ensure each run uses the active conversation’s Hermes session and persists prompt metadata.

**Files:**
- Create: `lib/hermes/session-sync.ts`
- Create: `lib/chat/prompt-metadata.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `lib/chat/messages.ts`

**Steps:**
1. Add `resolveRunHermesSessionId(project, conversation)` that prefers conversation-level session IDs and strips `reserved:` values.
2. Use that helper in `/api/chat`.
3. Add `extractPromptMetadata()` to split raw prompt, composed prompt, selection JSON, and screenshot IDs.
4. Persist user messages with raw/composed prompt fields and current Hermes session ID.
5. Hydrate user messages from `rawUserPrompt` when available, while retaining composed content in the DB.

## Task 5: Wire New Session UI to the server

**Objective:** Make the existing New button switch AppLoop’s active DB conversation before the next prompt.

**Files:**
- Create: `lib/chat/session-actions.ts`
- Modify: `components/builder/builder-shell.tsx`

**Steps:**
1. Add `startNewProjectConversationAction(projectId)` server action.
2. In `onNewSession`, after saving the visible session checkpoint, call the server action.
3. Clear chat state only after the server action succeeds.
4. Keep existing checkpoint/session history UI compatible for now.

## Task 6: Verify

**Objective:** Prove behavior and type safety.

**Commands:**
1. `npm test -- tests/session-sync.test.ts`
2. `npm test -- tests/project-domain.test.ts tests/project-management.test.ts tests/hermes.test.ts tests/persistence-recovery.test.ts`
3. `npm run typecheck`
4. `npm run lint`
5. `git diff --check`

**Expected:** Focused tests pass; typecheck/lint pass or any pre-existing unrelated failures are reported clearly.
