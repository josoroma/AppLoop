import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";

export function createDatabaseClient(databaseUrl: string) {
  ensureFileDatabaseDirectory(databaseUrl);

  const client = createClient({ url: databaseUrl });

  client.execute("PRAGMA foreign_keys = ON");

  return client;
}

export function createDatabase(databaseUrl: string) {
  return drizzle(createDatabaseClient(databaseUrl), { schema });
}

export type BuilderDatabase = ReturnType<typeof createDatabase>;

function ensureFileDatabaseDirectory(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const filePath = databaseUrl.slice("file:".length);

  if (!filePath || filePath === ":memory:") {
    return;
  }

  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}