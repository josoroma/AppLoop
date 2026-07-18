import type { Conversation, Project } from "@/lib/db/schema";

export function resolveRunHermesSessionId(project: Pick<Project, "hermesSessionId">, conversation: Pick<Conversation, "hermesSessionId"> | null) {
  return normalizeHermesSessionId(conversation?.hermesSessionId ?? project.hermesSessionId);
}

export function normalizeHermesSessionId(sessionId: string | null | undefined) {
  if (!sessionId || sessionId.startsWith("reserved:")) {
    return null;
  }

  return sessionId;
}
