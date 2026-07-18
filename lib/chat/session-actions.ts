"use server";

import { getProjectService } from "@/lib/projects/store";
import { getProjectRepository } from "@/lib/projects/store";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";

export async function startNewProjectConversationAction(projectId: string) {
  const access = await requireProjectAccess(getProjectRepository(), projectId).catch(projectAccessErrorResponse);

  if (access instanceof Response) {
    throw new Error("Project access denied.");
  }

  return getProjectService().startNewProjectConversation(projectId);
}
