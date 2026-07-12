import { randomUUID } from "node:crypto";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { assistantMessageIdForRun, getMessageText, getLastUserMessage, serializeAssistantMessageMetadata, type HermesActivityData } from "@/lib/chat/messages";
import { clearActiveHermesRun, rememberActiveHermesRun } from "@/lib/chat/run-store";
import { createProjectAgentBundle } from "@/lib/hermes/agents";
import { hermesErrorToUserMessage, HermesError, mapHermesError } from "@/lib/hermes/errors";
import { getHermesClient } from "@/lib/hermes/store";
import { categorizeFailure, getDurationMs, recordStructuredEvent, startDurationTimer } from "@/lib/observability/events";
import { getProjectRepository } from "@/lib/projects/store";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";

export const dynamic = "force-dynamic";

type ChatRequestBody = {
  id?: string;
  messages?: UIMessage[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;
  const projectId = body.id;
  const messages = body.messages ?? [];
  const userMessage = getLastUserMessage(messages);

  if (!projectId || !userMessage) {
    return new Response("Missing project id or user message.", { status: 400 });
  }

  const repository = getProjectRepository();
  const overview = await requireProjectAccess(repository, projectId).catch(projectAccessErrorResponse);

  if (overview instanceof Response) {
    return overview;
  }

  if (!overview.conversation) {
    return new Response("Active project not found.", { status: 404 });
  }

  const { conversation, project } = overview;
  const prompt = getMessageText(userMessage);
  const runId = randomUUID();
  const correlationId = runId;
  const runStartedTimer = startDurationTimer();
  const textPartId = assistantMessageIdForRun(runId);
  let assistantText = "";
  const activityEvents: HermesActivityData[] = [];
  let hermesRunId: string | null = null;
  let streamCompleted = false;

  await repository.createMessageOnce({
    id: userMessage.id,
    conversationId: conversation.id,
    role: "user",
    content: prompt,
  });
  await repository.createRun({
    id: runId,
    projectId,
    conversationId: conversation.id,
    status: "running",
    startedAt: new Date(),
  });
  rememberActiveHermesRun(projectId, { runId, hermesRunId: null });
  recordStructuredEvent({ correlationId, projectId, runId, source: "chat", action: "request", status: "started", detail: { messageLength: prompt.length } });

  const stream = createUIMessageStream({
    originalMessages: messages,
    async execute({ writer }) {
      writer.write({ type: "start", messageId: randomUUID(), messageMetadata: { projectId, runId } });
      writer.write({ type: "text-start", id: textPartId });

      try {
        for await (const event of getHermesClient().streamProjectRun({
          projectId,
          conversationId: conversation.id,
          message: prompt,
          workspacePath: project.workspacePath,
          sessionId: resolveHermesSessionId(project.hermesSessionId ?? conversation.hermesSessionId),
          agentBundle: createProjectAgentBundle({
            projectId,
            workspacePath: project.workspacePath,
            selectedThemeId: overview.theme?.themeId ?? project.themeId,
            packageInstallPolicy: overview.settings?.packageInstallPolicy ?? "ask",
            validationDepth: overview.settings?.validationDepth ?? "standard",
            defaultRoute: overview.settings?.defaultRoute ?? "/",
          }),
          signal: request.signal,
        })) {
          if (event.type === "session") {
            recordStructuredEvent({ correlationId, projectId, runId, source: "hermes", action: "session", status: "succeeded", detail: { sessionId: event.sessionId } });
            await repository.updateProjectHermesSession(projectId, event.sessionId);
            await repository.updateConversationHermesSession(conversation.id, event.sessionId);
          }

          if (event.type === "run") {
            hermesRunId = event.runId;
            recordStructuredEvent({ correlationId, projectId, runId, hermesRunId, source: "hermes", action: "run", status: "started" });
            rememberActiveHermesRun(projectId, { runId, hermesRunId: event.runId });
            await repository.updateRun(runId, { hermesRunId: event.runId });
          }

          if (event.type === "activity") {
            activityEvents.push(event.activity);
            recordStructuredEvent({
              correlationId,
              projectId,
              runId,
              hermesRunId,
              source: event.activity.kind === "file-change" ? "files" : event.activity.kind === "command" ? "validation" : "hermes",
              action: event.activity.kind,
              status: event.activity.status === "failed" ? "failed" : event.activity.status === "running" ? "running" : "succeeded",
              detail: { title: event.activity.title, detail: event.activity.detail },
            });
            writer.write({ type: "data-hermes-activity", data: event.activity, transient: false });
          }

          if (event.type === "text-delta") {
            assistantText += event.text;
            writer.write({ type: "text-delta", id: textPartId, delta: event.text });
          }

          if (event.type === "error") {
            throw new HermesError("unavailable", `Hermes run failed: ${event.message}`);
          }

          if (event.type === "done") {
            streamCompleted = true;
          }
        }

        writer.write({ type: "text-end", id: textPartId });
        writer.write({ type: "finish", finishReason: streamCompleted ? "stop" : "other", messageMetadata: { projectId, runId, hermesRunId } });

        await repository.createMessageOnce({
          id: textPartId,
          conversationId: conversation.id,
          role: "assistant",
          content: assistantText,
          metadataJson: serializeAssistantMessageMetadata({ hermesRunId, runId, activities: activityEvents }),
        });
        await repository.updateRun(runId, {
          hermesRunId,
          status: streamCompleted ? "succeeded" : "failed",
          finishedAt: new Date(),
        });
        recordStructuredEvent({
          correlationId,
          projectId,
          runId,
          hermesRunId,
          source: "chat",
          action: "request",
          status: streamCompleted ? "succeeded" : "failed",
          durationMs: getDurationMs(runStartedTimer),
        });
        clearActiveHermesRun(projectId);
      } catch (error) {
        const hermesError = mapHermesError(error);
        await repository.updateRun(runId, { hermesRunId, status: hermesError.code === "interrupted" ? "cancelled" : "failed", finishedAt: new Date() });
        recordStructuredEvent({
          correlationId,
          projectId,
          runId,
          hermesRunId,
          source: "chat",
          action: "request",
          status: hermesError.code === "interrupted" ? "cancelled" : "failed",
          durationMs: getDurationMs(runStartedTimer),
          failureCategory: categorizeFailure(hermesError),
        });
        clearActiveHermesRun(projectId);
        throw hermesError;
      }
    },
    onError: hermesErrorToUserMessage,
  });

  return createUIMessageStreamResponse({ stream });
}

function resolveHermesSessionId(sessionId: string | null | undefined) {
  if (!sessionId || sessionId.startsWith("reserved:")) {
    return null;
  }

  return sessionId;
}