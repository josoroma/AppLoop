import type { ChatCheckpoint } from "@/components/builder/use-builder-ui-store";
import type { BuilderChatMessage } from "@/lib/chat/messages";

/**
 * Find the prompt checkpoint that was created immediately before a user message was sent.
 *
 * Prompt checkpoints intentionally store messageIds from before the new prompt exists, so
 * the clicked user message id is not part of the checkpoint. Match by the exact ordered
 * message history preceding the clicked user message instead.
 */
export function findCheckpointBeforeMessage(
  checkpoints: ChatCheckpoint[],
  messages: BuilderChatMessage[],
  message: BuilderChatMessage,
) {
  const messageIndex = messages.findIndex((candidate) => candidate.id === message.id);

  if (messageIndex === -1) return null;

  const previousMessageIds = messages
    .slice(0, messageIndex)
    .filter((candidate) => candidate.role === "user" || candidate.role === "assistant")
    .map((candidate) => candidate.id);

  const matches = checkpoints.filter(
    (checkpoint) =>
      !checkpoint.isSessionBoundary &&
      checkpoint.messageIds.length === previousMessageIds.length &&
      checkpoint.messageIds.every((id, index) => id === previousMessageIds[index]),
  );

  return matches[matches.length - 1] ?? null;
}

/**
 * Return the conversation state that should remain after restoring a prompt.
 * The clicked prompt itself and every message after it are intentionally removed.
 */
export function messagesBeforeMessage(messages: BuilderChatMessage[], message: BuilderChatMessage) {
  const messageIndex = messages.findIndex((candidate) => candidate.id === message.id);

  if (messageIndex === -1) return messages;

  return messages.slice(0, messageIndex);
}

/** IDs for the clicked prompt and every later conversation message. */
export function messageIdsFromMessage(messages: BuilderChatMessage[], message: BuilderChatMessage) {
  const messageIndex = messages.findIndex((candidate) => candidate.id === message.id);

  if (messageIndex === -1) return [];

  return messages
    .slice(messageIndex)
    .filter((candidate) => candidate.role === "user" || candidate.role === "assistant")
    .map((candidate) => candidate.id);
}
