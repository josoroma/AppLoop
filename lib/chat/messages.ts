import type { UIMessage } from "ai";
import type { Message } from "@/lib/db/schema";

export type HermesActivityData = {
  kind: "tool-start" | "tool-complete" | "file-change" | "command" | "preview-ready";
  title: string;
  detail?: string;
  status?: "running" | "succeeded" | "failed";
};

export type BuilderChatDataTypes = {
  "hermes-activity": HermesActivityData;
};

export type BuilderChatMessage = UIMessage<unknown, BuilderChatDataTypes>;

export type AssistantMessageMetadata = {
  runId?: string;
  hermesRunId?: string | null;
  activities?: HermesActivityData[];
};

export function getMessageText(message: Pick<UIMessage, "parts">) {
  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("");
}

export function getLastUserMessage(messages: UIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user") ?? null;
}

export function assistantMessageIdForRun(runId: string) {
  return `assistant-${runId}`;
}

export function serializeAssistantMessageMetadata(metadata: AssistantMessageMetadata) {
  return JSON.stringify({
    ...metadata,
    activities: metadata.activities?.slice(0, 100) ?? [],
  });
}

export function toBuilderChatMessages(messages: Pick<Message, "id" | "role" | "content" | "metadataJson">[]): BuilderChatMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "tool") {
      return [];
    }

    const metadata = parseAssistantMessageMetadata(message.metadataJson);
    const activityParts = (metadata.activities ?? []).map((activity) => ({
      type: "data-hermes-activity" as const,
      data: activity,
    }));

    return {
      id: message.id,
      role: message.role,
      parts: [...activityParts, { type: "text", text: message.content }],
    } satisfies BuilderChatMessage;
  });
}

function parseAssistantMessageMetadata(metadataJson: string | null): AssistantMessageMetadata {
  if (!metadataJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadataJson) as AssistantMessageMetadata;

    return {
      runId: typeof parsed.runId === "string" ? parsed.runId : undefined,
      hermesRunId: typeof parsed.hermesRunId === "string" ? parsed.hermesRunId : null,
      activities: Array.isArray(parsed.activities) ? parsed.activities.filter(isHermesActivityData) : [],
    };
  } catch {
    return {};
  }
}

function isHermesActivityData(value: unknown): value is HermesActivityData {
  return typeof value === "object" && value !== null && "kind" in value && "title" in value;
}