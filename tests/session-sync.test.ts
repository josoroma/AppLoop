import { describe, expect, it } from "vitest";
import type { Conversation, Project } from "@/lib/db/schema";
import type { ProjectRepository } from "@/lib/db/repository";
import { extractPromptMetadata } from "@/lib/chat/prompt-metadata";
import { resolveRunHermesSessionId } from "@/lib/hermes/session-sync";
import { ProjectService, reserveHermesSessionId } from "@/lib/projects/service";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Project",
    slug: "project",
    workspacePath: "/tmp/project",
    hermesSessionId: "stale-project-session",
    activeConversationId: "conversation-1",
    themeId: "luma-indigo-emerald",
    previewPort: 3100,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conversation-1",
    projectId: "project-1",
    hermesSessionId: "conversation-session",
    title: "Project chat",
    status: "active",
    kind: "main",
    parentConversationId: null,
    branchedFromMessageId: null,
    branchedFromCheckpointId: null,
    fileSnapshotCommit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("session synchronization", () => {
  it("reserves Hermes sessions from the conversation id, not the project id", async () => {
    const createdBundles: unknown[] = [];
    const repository = {
      listProjects: async () => [],
      listAllocatedPreviewPorts: async () => [],
      createProjectBundle: async (bundle: unknown) => {
        createdBundles.push(bundle);
        return { project: (bundle as { project: Project }).project, conversation: null, runtime: null, theme: null, settings: null };
      },
    } as unknown as ProjectRepository;
    const service = new ProjectService(repository, { start: 3100, end: 3101 });

    await service.createProject({ name: "Landing", themeId: "luma-indigo-emerald" }, "/tmp");

    const bundle = createdBundles[0] as {
      project: { id: string; hermesSessionId: string; activeConversationId: string };
      conversation: { id: string; hermesSessionId: string; kind: string; status: string };
    };

    expect(bundle.project.activeConversationId).toBe(bundle.conversation.id);
    expect(bundle.conversation.hermesSessionId).toBe(reserveHermesSessionId(bundle.conversation.id));
    expect(bundle.project.hermesSessionId).toBe(bundle.conversation.hermesSessionId);
    expect(bundle.conversation.kind).toBe("main");
    expect(bundle.conversation.status).toBe("active");
  });

  it("creates a new session conversation and switches the active project pointer", async () => {
    const createdConversations: unknown[] = [];
    const activeSwitches: Array<{ projectId: string; conversationId: string; hermesSessionId: string | null }> = [];
    const repository = {
      findProjectOverviewById: async () => ({
        project: project(),
        conversation: conversation(),
        runtime: null,
        theme: null,
        settings: null,
      }),
      createConversation: async (newConversation: unknown) => {
        createdConversations.push(newConversation);
        return { ...conversation(), ...(newConversation as object) };
      },
      setActiveConversation: async (projectId: string, conversationId: string, hermesSessionId: string | null) => {
        activeSwitches.push({ projectId, conversationId, hermesSessionId });
        return project({ id: projectId, activeConversationId: conversationId, hermesSessionId });
      },
    } as unknown as ProjectRepository;
    const service = new ProjectService(repository, { start: 3100, end: 3101 });

    const next = await service.startNewProjectConversation("project-1");

    expect(createdConversations).toHaveLength(1);
    expect(next.kind).toBe("session");
    expect(next.status).toBe("active");
    expect(next.parentConversationId).toBe("conversation-1");
    expect(next.hermesSessionId).toBe(reserveHermesSessionId(next.id));
    expect(activeSwitches).toEqual([{ projectId: "project-1", conversationId: next.id, hermesSessionId: next.hermesSessionId }]);
  });

  it("uses the active conversation Hermes session instead of stale project session state", () => {
    expect(resolveRunHermesSessionId(project({ hermesSessionId: "stale-project-session" }), conversation({ hermesSessionId: "conversation-session" }))).toBe(
      "conversation-session",
    );
    expect(resolveRunHermesSessionId(project({ hermesSessionId: "stale-project-session" }), conversation({ hermesSessionId: "reserved:conversation-1" }))).toBeNull();
    expect(resolveRunHermesSessionId(project({ hermesSessionId: "project-session" }), null)).toBe("project-session");
  });

  it("extracts raw prompt, composed prompt, visual selection JSON, and screenshot ids", () => {
    const composed = `Make the hero green\n\nModify only elements that match these exact selectors or are strictly descendants of:\n\n- .hero → .hero\n\nDo not modify elements outside these selector boundaries, even if they share the same base class names, unless the user explicitly requests a global change.\n\nTarget selections JSON:\n[{"preferredSelector":".hero"}]`;

    expect(extractPromptMetadata(composed, ["screenshot-1"])).toEqual({
      rawUserPrompt: "Make the hero green",
      composedPrompt: composed,
      visualSelectionJson: '[{"preferredSelector":".hero"}]',
      screenshotIdsJson: '["screenshot-1"]',
    });
  });
});
