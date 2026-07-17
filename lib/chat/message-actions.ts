"use server";

import { getProjectRepository } from "@/lib/projects/store";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";

export async function deleteProjectConversationMessages(projectId: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;

  const repository = getProjectRepository();
  const overview = await requireProjectAccess(repository, projectId).catch(projectAccessErrorResponse);

  if (overview instanceof Response) {
    throw new Error("Project access denied.");
  }

  if (!overview.conversation) return;

  await repository.deleteConversationMessages(overview.conversation.id, messageIds);
}

export async function deleteProjectConversationMessagesFrom(projectId: string, messageId: string): Promise<void> {
  const repository = getProjectRepository();
  const overview = await requireProjectAccess(repository, projectId).catch(projectAccessErrorResponse);

  if (overview instanceof Response) {
    throw new Error("Project access denied.");
  }

  if (!overview.conversation) return;

  await repository.deleteConversationMessagesFrom(overview.conversation.id, messageId);
}
