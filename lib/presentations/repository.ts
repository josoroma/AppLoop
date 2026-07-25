import { and, asc, desc, eq } from "drizzle-orm";
import type { BuilderDatabase } from "@/lib/db";
import {
  presentationConversations,
  presentationMessages,
  presentations,
  type NewPresentation,
  type NewPresentationConversation,
  type NewPresentationMessage,
  type Presentation,
} from "@/lib/db/schema";

export type PresentationOverview = {
  presentation: Presentation;
  conversation: typeof presentationConversations.$inferSelect | null;
};

export class SqlitePresentationRepository {
  constructor(private readonly db: BuilderDatabase) {}

  async createPresentationBundle(input: {
    presentation: NewPresentation;
    conversation: NewPresentationConversation;
  }) {
    try {
      await this.db.insert(presentations).values(input.presentation);
      await this.db.insert(presentationConversations).values(input.conversation);

      const overview = await this.findPresentationOverviewById(input.presentation.id);
      if (!overview) {
        throw new Error("Created presentation could not be loaded.");
      }

      return overview;
    } catch (error) {
      await this.db.delete(presentations).where(eq(presentations.id, input.presentation.id));
      throw error;
    }
  }

  async deletePresentation(presentationId: string) {
    await this.db.delete(presentations).where(eq(presentations.id, presentationId));
  }

  async findPresentationById(presentationId: string) {
    const [row] = await this.db.select().from(presentations).where(eq(presentations.id, presentationId)).limit(1);
    return row ?? null;
  }

  async findPresentationOverviewById(presentationId: string): Promise<PresentationOverview | null> {
    const presentation = await this.findPresentationById(presentationId);
    if (!presentation) {
      return null;
    }

    let conversation = null;
    if (presentation.activeConversationId) {
      const [row] = await this.db
        .select()
        .from(presentationConversations)
        .where(eq(presentationConversations.id, presentation.activeConversationId))
        .limit(1);
      conversation = row ?? null;
    }

    if (!conversation) {
      const [row] = await this.db
        .select()
        .from(presentationConversations)
        .where(
          and(
            eq(presentationConversations.presentationId, presentationId),
            eq(presentationConversations.status, "active"),
          ),
        )
        .orderBy(desc(presentationConversations.createdAt))
        .limit(1);
      conversation = row ?? null;
    }

    return { presentation, conversation };
  }

  async listPresentations(status?: Presentation["status"]) {
    if (status) {
      return this.db.select().from(presentations).where(eq(presentations.status, status)).orderBy(asc(presentations.createdAt));
    }

    return this.db.select().from(presentations).orderBy(asc(presentations.createdAt));
  }

  async listPresentationOverviews(status?: Presentation["status"]) {
    const rows = await this.listPresentations(status);
    return Promise.all(rows.map((presentation) => this.findPresentationOverviewById(presentation.id).then((overview) => overview!)));
  }

  async updatePresentationStatus(presentationId: string, status: Presentation["status"]) {
    await this.db
      .update(presentations)
      .set({ status, updatedAt: new Date() })
      .where(eq(presentations.id, presentationId));
  }

  async updatePresentationHermesSession(presentationId: string, hermesSessionId: string) {
    await this.db
      .update(presentations)
      .set({ hermesSessionId, updatedAt: new Date() })
      .where(eq(presentations.id, presentationId));
  }

  async updateConversationHermesSession(conversationId: string, hermesSessionId: string) {
    await this.db
      .update(presentationConversations)
      .set({ hermesSessionId, updatedAt: new Date() })
      .where(eq(presentationConversations.id, conversationId));
  }

  async touchPresentation(presentationId: string) {
    await this.db.update(presentations).set({ updatedAt: new Date() }).where(eq(presentations.id, presentationId));
  }

  async createMessage(message: NewPresentationMessage) {
    const [created] = await this.db.insert(presentationMessages).values(message).returning();
    return created;
  }

  async createMessageOnce(message: NewPresentationMessage) {
    const [existing] = await this.db
      .select()
      .from(presentationMessages)
      .where(eq(presentationMessages.id, message.id))
      .limit(1);

    if (existing) {
      return existing;
    }

    return this.createMessage(message);
  }

  async listConversationMessages(conversationId: string, options: { limit?: number } = {}) {
    const limit = options.limit ?? 50;
    return this.db
      .select()
      .from(presentationMessages)
      .where(and(eq(presentationMessages.conversationId, conversationId), eq(presentationMessages.active, true)))
      .orderBy(asc(presentationMessages.createdAt))
      .limit(limit);
  }
}
