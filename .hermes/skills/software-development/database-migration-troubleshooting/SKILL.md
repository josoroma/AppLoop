---
name: database-migration-troubleshooting
description: Diagnose and recover from ORM migration state drift — when applied migrations don't match tracked state. Covers drizzle-kit + SQLite patterns, Drizzle ORM, and general SQLite schema inspection.
version: 1.0.0
author: Hermes Agent
platforms: [linux, macos]
metadata:
  hermes:
    tags: [database, migrations, drizzle, sqlite, troubleshooting, debugging]
    related_skills: [systematic-debugging]
---

# Database Migration Troubleshooting

## Overview

When an ORM migration runner fails silently or the database schema doesn't match what the code expects, you need to triangulate between three sources of truth: the **migration tracking table**, the **actual database schema**, and the **migration journal/metadata files**.

## When to Use

- `drizzle-kit migrate` exits non-zero with no visible error
- A migration spinner hangs indefinitely
- Runtime errors about missing columns (`SQLITE_ERROR: no such column`)
- Tables exist but migration runner tries to re-create them
- After manual database changes outside the migration system

## Core Technique: Three-Source Triangulation

Identify the mismatch by comparing three independent sources:

| Source | How to Inspect | What It Tells You |
|--------|---------------|-------------------|
| **Migration tracking** | `SELECT * FROM __drizzle_migrations` | Which migrations the ORM believes are applied (by SHA-256 hash) |
| **Actual schema** | `PRAGMA table_info(tablename)` | Which columns and types actually exist |
| **Migration journal** | `meta/_journal.json` | All migration entries that SHOULD exist (idx, tag, timestamp) |

A mismatch between any two sources explains the failure.

## Step-by-Step Diagnosis

### 1. Count tracking vs journal entries

```sql
-- How many migrations are recorded as applied?
SELECT COUNT(*) FROM __drizzle_migrations;
```

Then count entries in `meta/_journal.json`. If tracking has fewer entries, migrations are pending or were never recorded.

### 2. Compare columns against schema definition

Use `PRAGMA table_info()` on each table and compare against the Drizzle schema file (e.g. `lib/db/schema.ts`):

```sql
PRAGMA table_info(projects);
PRAGMA table_info(conversations);
```

Missing columns → the migration that adds them was never applied.

### 3. Check if tables from pending migrations already exist

```bash
sqlite3 db.sqlite ".tables"
```

If tables from unrecorded migrations already exist, the `CREATE TABLE` in the migration SQL will fail silently when drizzle-kit tries to apply it. This is the most common cause of silent failures.

## Resolution Patterns

See the linked references for framework-specific details:

- `references/drizzle-kit-sqlite.md` — Drizzle Kit + SQLite specifics (hash calculation, journal format, manual application)
- `references/apploop-template-seeding.md` — AppLoop local builder DB seeding from built-in template registry when no dedicated seed script exists

## Seeding Local Databases

When a user asks to "seed the database," do not jump straight to ad-hoc inserts. First inspect the project manifest, migration config, schema, repository/service layer, and any existing seed scripts. Run migrations before seeding. If no seed command exists, mirror the app's own creation flow and verify by querying the database plus checking generated local artifacts.

## General Pitfalls

- ORM migration runners often **swallow SQL errors** without reporting them. When a migration fails, the runner may show a spinner that just stops or exits with a generic error code.
- **Never assume** the migration tracking table is authoritative. Tables may have been created outside the migration system.
- **Back up the database** before applying manual fixes. A simple `cp db.sqlite db.sqlite.backup` is sufficient.
- When recording migration hashes manually, use the **SHA-256 of the SQL file content**, not the filename or journal tag.
- Migration files may have been regenerated after application. The hash in `__drizzle_migrations` reflects what was applied, not what the file currently contains.