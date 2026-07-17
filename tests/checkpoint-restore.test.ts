import { describe, expect, it } from "vitest";
import type { ChatCheckpoint } from "@/components/builder/use-builder-ui-store";
import type { BuilderChatMessage } from "@/lib/chat/messages";
import { findCheckpointBeforeMessage, messageIdsFromMessage, messagesBeforeMessage } from "@/lib/chat/checkpoint-restore";

function message(id: string, role: "user" | "assistant"): BuilderChatMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text: id }],
  } as BuilderChatMessage;
}

function checkpoint(id: string, messageIds: string[], commitHash = id): ChatCheckpoint {
  return {
    id,
    name: id,
    createdAt: 1,
    targets: [],
    screenshots: [],
    messageIds,
    commitHash,
    isSessionBoundary: false,
    messages: [],
  };
}

describe("checkpoint restore lookup", () => {
  it("finds the first prompt checkpoint even though it contains no user message id", () => {
    const firstUserMessage = message("user-1", "user");

    expect(findCheckpointBeforeMessage([checkpoint("cp-before-first", [])], [firstUserMessage], firstUserMessage)).toMatchObject({
      id: "cp-before-first",
      commitHash: "cp-before-first",
    });
  });

  it("finds the checkpoint whose ids match the ordered messages before the clicked prompt", () => {
    const messages = [
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user"),
      message("assistant-2", "assistant"),
    ];

    expect(
      findCheckpointBeforeMessage(
        [checkpoint("cp-before-first", []), checkpoint("cp-before-second", ["user-1", "assistant-1"])],
        messages,
        messages[2],
      ),
    ).toMatchObject({ id: "cp-before-second" });
  });

  it("ignores session boundary checkpoints for per-prompt restore", () => {
    const firstUserMessage = message("user-1", "user");
    const sessionCheckpoint = { ...checkpoint("session", []), isSessionBoundary: true };

    expect(findCheckpointBeforeMessage([sessionCheckpoint], [firstUserMessage], firstUserMessage)).toBeNull();
  });

  it("removes the restored prompt itself and every message after it", () => {
    const messages = [
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user"),
      message("assistant-2", "assistant"),
      message("user-3", "user"),
    ];

    expect(messagesBeforeMessage(messages, messages[2]).map((remaining) => remaining.id)).toEqual(["user-1", "assistant-1"]);
  });

  it("returns ids for the restored prompt itself and every later conversation message", () => {
    const messages = [
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user"),
      message("assistant-2", "assistant"),
      message("user-3", "user"),
    ];

    expect(messageIdsFromMessage(messages, messages[2])).toEqual(["user-2", "assistant-2", "user-3"]);
  });
});
