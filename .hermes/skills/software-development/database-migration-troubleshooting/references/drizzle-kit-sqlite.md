# Drizzle Kit + SQLite Migration Recovery

Framework-specific patterns for diagnosing and fixing Drizzle Kit migration state drift with SQLite databases.

## Migration Tracking

Drizzle Kit tracks applied migrations in the `__drizzle_migrations` table:

```sql
CREATE TABLE __drizzle_migrations (
  hash text PRIMARY KEY,
  created_at integer
);
```

Each row stores the **SHA-256 hash of the entire migration SQL file** and the timestamp when it was applied.

## Migration Journal

The `meta/_journal.json` file in the migrations directory tracks all known migrations:

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1783742400000,
      "tag": "0000_builder_foundation",
      "breakpoints": true
    }
  ]
}
```

Key fields:
- `idx`: Migration index (0-based)
- `tag`: Matches the migration filename prefix (e.g. `0000_builder_foundation` → `0000_builder_foundation.sql`)
- `when`: Timestamp (ms since epoch) for the `__drizzle_migrations.created_at` value

## Computing Migration Hashes

```bash
# On macOS/Linux
sha256sum lib/db/migrations/0007_session_sync.sql

# On macOS without sha256sum
shasum -a 256 lib/db/migrations/0007_session_sync.sql
```

The hash is of the **entire file**, including whitespace and the `--> statement-breakpoint` markers.

## Manual SQL Application

When `drizzle-kit migrate` fails silently:

### 1. Back up the database

```bash
cp .apploop/builder.sqlite .apploop/builder.sqlite.backup
```

### 2. Apply the migration SQL directly

```bash
sqlite3 .apploop/builder.sqlite < lib/db/migrations/0007_session_sync.sql
```

### 3. Record the hash and timestamp

```sql
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('b844aff7ff02872506e0e8952a96292624bf69b30f8d8ab5cf3e1be88ec89b46', 1784390000000);
```

Use the timestamp from `_journal.json` for the corresponding migration entry.

### 4. Record skipped migrations

If migrations 0004-0006 created tables that already exist in the database but aren't tracked in `__drizzle_migrations`, record their hashes too:

```sql
INSERT INTO __drizzle_migrations (hash, created_at) VALUES
  ('7e3e0f2a...', 1784001600000),
  ('95a8e8e6...', 1784088000000),
  ('80280a94...', 1784117338374);
```

## Why drizzle-kit migrate Fails Silently

Common causes of silent (exit 1, no error text) failures:

1. **CREATE TABLE when table exists**: A migration has `CREATE TABLE` (not `CREATE TABLE IF NOT EXISTS`) for a table that already exists in the DB. This happens when tables were created outside the migration system or a migration was applied but not recorded.

2. **ALTER TABLE on missing column**: A migration tries to `ALTER TABLE ... ADD COLUMN` but the column already exists. Drizzle generates plain ALTER TABLE without IF NOT EXISTS guards.

3. **Foreign key violations**: A migration creates a foreign key reference to a table that doesn't exist yet or has been dropped.

## Key Drizzle Kit Limitations

- **No verbose mode**: There is no `--verbose` or `--debug` flag for `drizzle-kit migrate`. The spinner is all you get.
- **No dry-run**: There is no way to preview which migrations would be applied without actually running them.
- **No status command**: There is no built-in way to see which migrations are pending vs applied without querying the DB directly.
- **No force/continue-on-error**: If one migration fails, the entire run aborts.

## Prevention

- Always run `npm run db:migrate` after `npm run db:generate` in development.
- After manual database changes, immediately record the corresponding migration hash.
- If migration SQL files are regenerated, ensure the DB's `__drizzle_migrations` hashes are updated.
- Use `CREATE TABLE IF NOT EXISTS` in hand-written migration SQL to avoid conflicts with auto-generated migrations.