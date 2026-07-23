import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { assistantMessageIdForRun, getMessageText, getLastUserMessage, serializeAssistantMessageMetadata, type HermesActivityData } from "@/lib/chat/messages";
import { extractPromptMetadata } from "@/lib/chat/prompt-metadata";
import { clearActiveHermesRun, rememberActiveHermesRun } from "@/lib/chat/run-store";
import { createProjectAgentBundle } from "@/lib/hermes/agents";
import { hermesErrorToUserMessage, HermesError, mapHermesError } from "@/lib/hermes/errors";
import type { ImageAttachment } from "@/lib/hermes/client";
import { getHermesClient } from "@/lib/hermes/store";
import { resolveRunHermesSessionId } from "@/lib/hermes/session-sync";
import { categorizeFailure, getDurationMs, recordStructuredEvent, startDurationTimer } from "@/lib/observability/events";
import { getProjectRepository } from "@/lib/projects/store";
import { getTemplateIdFromWorkspacePath } from "@/lib/projects/template-authoring";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";
import { getProjectScreenshotsDir } from "@/lib/security/paths";

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
  const images = await extractImagesFromMessage(userMessage, projectId);
  const promptMetadata = extractPromptMetadata(prompt, extractScreenshotIds(userMessage));
  const hermesSessionId = resolveRunHermesSessionId(project, conversation);
  const templateId = getTemplateIdFromWorkspacePath(project.workspacePath);
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
    rawUserPrompt: promptMetadata.rawUserPrompt,
    composedPrompt: promptMetadata.composedPrompt,
    visualSelectionJson: promptMetadata.visualSelectionJson,
    screenshotIdsJson: promptMetadata.screenshotIdsJson,
    hermesSessionId,
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
      writer.write({ type: "start", messageId: textPartId, messageMetadata: { projectId, runId } });
      writer.write({ type: "text-start", id: textPartId });

      try {
        const hermesClient = await getHermesClient();
        for await (const event of hermesClient.streamProjectRun({
          projectId,
          conversationId: conversation.id,
          message: prompt,
          workspacePath: project.workspacePath,
          sessionId: hermesSessionId,
          agentBundle: createProjectAgentBundle({
            projectId,
            workspacePath: project.workspacePath,
            selectedThemeId: overview.theme?.themeId ?? project.themeId,
            packageInstallPolicy: overview.settings?.packageInstallPolicy ?? "ask",
            validationDepth: overview.settings?.validationDepth ?? "standard",
            defaultRoute: overview.settings?.defaultRoute ?? "/",
            mode: templateId ? "template-edit" : "project-edit",
            templateId: templateId ?? undefined,
            templateName: templateId ? project.name.replace(/^Template:\s*/, "") : undefined,
            templatePath: templateId ?? undefined,
            baseTemplateId: templateId ?? undefined,
          }),
          images: images.length > 0 ? images : undefined,
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

function extractScreenshotIds(userMessage: UIMessage) {
  return userMessage.parts.flatMap((part) => {
    if (part.type !== "file" || !part.url) {
      return [];
    }

    try {
      const urlPath = new URL(part.url, "http://localhost").pathname;
      const segments = urlPath.split("/").filter(Boolean);
      const screenshotId = segments[segments.length - 1];

      return screenshotId ? [screenshotId] : [];
    } catch {
      return [];
    }
  });
}

async function extractImagesFromMessage(userMessage: UIMessage, projectId: string): Promise<ImageAttachment[]> {
  const fileParts = userMessage.parts.filter((part) => part.type === "file" && part.mediaType?.startsWith("image/"));

  if (fileParts.length === 0) {
    return [];
  }

  const images: ImageAttachment[] = [];

  for (const part of fileParts) {
    try {
      if (part.type !== "file" || !part.url) {
        continue;
      }

      // Data URLs: extract base64 directly
      if (part.url.startsWith("data:")) {
        const commaIndex = part.url.indexOf(",");

        if (commaIndex === -1) {
          continue;
        }

        const base64 = part.url.slice(commaIndex + 1);
        const mimeMatch = part.url.slice(0, commaIndex).match(/data:(image\/[a-z+]+);?/);
        const mediaType = (mimeMatch ? mimeMatch[1] : part.mediaType || "image/png") as ImageAttachment["mediaType"];

        images.push({ mediaType, data: base64 });
        continue;
      }

      // Server path URLs: resolve from screenshots directory
      const urlPath = new URL(part.url, "http://localhost").pathname;
      const segments = urlPath.split("/").filter(Boolean);
      const screenshotId = segments[segments.length - 1];

      if (!screenshotId) {
        continue;
      }

      const screenshot = await getProjectRepository().findScreenshotById(screenshotId);

      if (!screenshot || screenshot.projectId !== projectId) {
        continue;
      }

      const filePath = path.join(getProjectScreenshotsDir(projectId), screenshot.filename);
      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString("base64");

      images.push({
        mediaType: screenshot.mediaType as ImageAttachment["mediaType"],
        data: base64,
      });
    } catch {
      // Skip images that can't be read
    }
  }

  return images;
}