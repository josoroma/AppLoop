"use server";

import { eq } from "drizzle-orm";
import { createDatabase } from "@/lib/db";
import { getServerEnv } from "@/lib/env/server";
import { chatCheckpoints, type ChatCheckpointRow } from "@/lib/db/schema";

export async function listChatCheckpoints(projectId: string): Promise<ChatCheckpointRow[]> {
  const db = createDatabase(getServerEnv().DATABASE_URL);

  return db.select().from(chatCheckpoints).where(eq(chatCheckpoints.projectId, projectId)).orderBy(chatCheckpoints.createdAt);
}

export async function saveChatCheckpoint(
  id: string,
  projectId: string,
  name: string,
  isSessionBoundary: boolean,
  dataJson: string,
): Promise<ChatCheckpointRow> {
  const db = createDatabase(getServerEnv().DATABASE_URL);
  const now = new Date();

  const [row] = await db
    .insert(chatCheckpoints)
    .values({ id, projectId, name, isSessionBoundary, dataJson, createdAt: now })
    .onConflictDoUpdate({
      target: chatCheckpoints.id,
      set: { name, isSessionBoundary, dataJson },
    })
    .returning();

  return row;
}

export async function deleteChatCheckpoint(id: string): Promise<void> {
  const db = createDatabase(getServerEnv().DATABASE_URL);

  await db.delete(chatCheckpoints).where(eq(chatCheckpoints.id, id));
}