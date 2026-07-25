import { randomUUID } from "node:crypto";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import {
  assistantMessageIdForRun,
  getLastUserMessage,
  getMessageText,
  serializeAssistantMessageMetadata,
  type HermesActivityData,
} from "@/lib/chat/messages";
import { createPresentationAgentBundle } from "@/lib/hermes/agents";
import { hermesErrorToUserMessage, HermesError, mapHermesError } from "@/lib/hermes/errors";
import { getHermesClient } from "@/lib/hermes/store";
import { categorizeFailure, getDurationMs, recordStructuredEvent, startDurationTimer } from "@/lib/observability/events";
import { getPresentationRepository, getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

type ChatRequestBody = {
  id?: string;
  messages?: UIMessage[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;
  const presentationId = body.id;
  const messages = body.messages ?? [];
  const userMessage = getLastUserMessage(messages);

  if (!presentationId || !userMessage) {
    return new Response("Missing presentation id or user message.", { status: 400 });
  }

  const repository = getPresentationRepository();
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview || overview.presentation.status === "deleted") {
    return new Response("Presentation not found.", { status: 404 });
  }

  if (!overview.conversation) {
    return new Response("Active presentation conversation not found.", { status: 404 });
  }

  const { conversation, presentation } = overview;
  const prompt = getMessageText(userMessage);
  const hermesSessionId = presentation.hermesSessionId ?? conversation.hermesSessionId ?? `reserved:${conversation.id}`;
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
    hermesSessionId,
  });

  recordStructuredEvent({
    correlationId,
    projectId: presentationId,
    runId,
    source: "chat",
    action: "request",
    status: "started",
    detail: { messageLength: prompt.length, mode: "presentation-edit" },
  });

  const stream = createUIMessageStream({
    originalMessages: messages,
    async execute({ writer }) {
      writer.write({ type: "start", messageId: textPartId, messageMetadata: { presentationId, runId } });
      writer.write({ type: "text-start", id: textPartId });

      try {
        const hermesClient = await getHermesClient();
        for await (const event of hermesClient.streamProjectRun({
          projectId: presentationId,
          conversationId: conversation.id,
          message: prompt,
          workspacePath: presentation.workspacePath,
          sessionId: hermesSessionId,
          agentBundle: createPresentationAgentBundle({
            projectId: presentationId,
            presentationId,
            workspacePath: presentation.workspacePath,
            sourceFile: presentation.sourceFile,
            themeFile: "theme.css",
            selectedThemeId: "marp-default",
            packageInstallPolicy: "never",
            validationDepth: "quick",
            defaultRoute: "/",
            mode: "presentation-edit",
            templateId: presentation.templateId,
          }),
          signal: request.signal,
        })) {
          if (event.type === "session") {
            recordStructuredEvent({
              correlationId,
              projectId: presentationId,
              runId,
              source: "hermes",
              action: "session",
              status: "succeeded",
              detail: { sessionId: event.sessionId },
            });
            await repository.updatePresentationHermesSession(presentationId, event.sessionId);
            await repository.updateConversationHermesSession(conversation.id, event.sessionId);
          }

          if (event.type === "run") {
            hermesRunId = event.runId;
            recordStructuredEvent({
              correlationId,
              projectId: presentationId,
              runId,
              hermesRunId,
              source: "hermes",
              action: "run",
              status: "started",
            });
          }

          if (event.type === "activity") {
            activityEvents.push(event.activity);
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
        writer.write({
          type: "finish",
          finishReason: streamCompleted ? "stop" : "other",
          messageMetadata: { presentationId, runId, hermesRunId },
        });

        await repository.createMessageOnce({
          id: textPartId,
          conversationId: conversation.id,
          role: "assistant",
          content: assistantText,
          metadataJson: serializeAssistantMessageMetadata({ hermesRunId, runId, activities: activityEvents }),
          hermesSessionId,
        });
        await repository.touchPresentation(presentationId);

        recordStructuredEvent({
          correlationId,
          projectId: presentationId,
          runId,
          hermesRunId,
          source: "chat",
          action: "request",
          status: streamCompleted ? "succeeded" : "failed",
          durationMs: getDurationMs(runStartedTimer),
        });
      } catch (error) {
        const hermesError = mapHermesError(error);
        recordStructuredEvent({
          correlationId,
          projectId: presentationId,
          runId,
          hermesRunId,
          source: "chat",
          action: "request",
          status: hermesError.code === "interrupted" ? "cancelled" : "failed",
          durationMs: getDurationMs(runStartedTimer),
          failureCategory: categorizeFailure(hermesError),
        });
        throw hermesError;
      }
    },
    onError: hermesErrorToUserMessage,
  });

  return createUIMessageStreamResponse({ stream });
}
