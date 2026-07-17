import { describe, expect, it, vi } from "vitest";
import { messages } from "@/lib/db/schema";
import { SqliteProjectRepository } from "@/lib/projects/repository";

describe("message deletion", () => {
  it("deletes only the requested ids inside the active conversation", async () => {
    const where = vi.fn();
    const deleteMock = vi.fn(() => ({ where }));
    const db = { delete: deleteMock };
    const repository = new SqliteProjectRepository(db as never);

    await repository.deleteConversationMessages("conversation-1", ["user-2", "assistant-2", "user-3"]);

    expect(deleteMock).toHaveBeenCalledWith(messages);
    expect(where).toHaveBeenCalledOnce();
  });

  it("skips the database when there are no message ids to delete", async () => {
    const deleteMock = vi.fn();
    const db = { delete: deleteMock };
    const repository = new SqliteProjectRepository(db as never);

    await repository.deleteConversationMessages("conversation-1", []);

    expect(deleteMock).not.toHaveBeenCalled();
  });
});
