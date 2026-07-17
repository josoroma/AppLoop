import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { clearActiveHermesRun, getActiveHermesRun, rememberActiveHermesRun } from "@/lib/chat/run-store";
import { serverEnvSchema } from "@/lib/env/schema";
import { createProjectAgentBundle, HERMES_AGENT_DEFINITIONS } from "@/lib/hermes/agents";
import { HermesClient } from "@/lib/hermes/client";
import { HERMES_COMMAND_DEFINITIONS, UI_BUILDER_COMMAND_ORDER } from "@/lib/hermes/commands";
import { HermesError, hermesErrorToUserMessage } from "@/lib/hermes/errors";
import { normalizeHermesEvent, parseHermesSseStream } from "@/lib/hermes/events";
import { HERMES_HOOK_DEFINITIONS, UI_BUILDER_HOOK_ORDER } from "@/lib/hermes/hooks";
import { HERMES_SKILL_DEFINITIONS, UI_BUILDER_SKILL_BUNDLE } from "@/lib/hermes/skills";

describe("E4 Hermes backend and streaming chat", () => {
  it("validates Hermes transport configuration", () => {
    const env = serverEnvSchema.parse({ HERMES_API_KEY: "secret", HERMES_TRANSPORT: "websocket" });

    expect(env.HERMES_TRANSPORT).toBe("websocket");
  });

  it("normalizes observable Hermes events without reasoning", () => {
    expect(normalizeHermesEvent({ type: "file.edited", path: "app/page.tsx" })).toEqual({
      type: "activity",
      activity: { kind: "file-change", title: "Editing app/page.tsx", detail: "app/page.tsx" },
    });
    expect(normalizeHermesEvent({ type: "text.delta", delta: "Hello" })).toEqual({ type: "text-delta", text: "Hello" });
  });

  it("parses Hermes SSE events", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"text.delta","delta":"Hi"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    const events = [];

    for await (const event of parseHermesSseStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "text-delta", text: "Hi" }, { type: "done" }]);
  });

  it("sends authenticated REST streaming requests with workspace and gateway context", async () => {
    const fetchMock = vi.fn<(...args: [RequestInfo | URL, RequestInit?]) => Promise<Response>>();
    fetchMock.mockResolvedValue(
      new Response('data: {"type":"done"}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HermesClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "secret",
      transport: "rest",
      gatewayIntegration: "local-gateway",
      inferenceModel: "openai/gpt-5.5",
      inferenceProvider: "openrouter",
    });

    for await (const event of client.streamProjectRun({
      projectId: "project-1",
      conversationId: "conversation-1",
      message: "Build a page",
      workspacePath: "/tmp/project-1",
      sessionId: "session-1",
      agentBundle: createProjectAgentBundle({
        projectId: "project-1",
        workspacePath: "/tmp/project-1",
        selectedThemeId: "luma-default",
        packageInstallPolicy: "ask",
        validationDepth: "standard",
        defaultRoute: "/",
      }),
    })) {
      expect(event).toEqual({ type: "done" });
    }

    expect(fetchMock).toHaveBeenCalledWith(new URL("/v1/runs/stream", "http://127.0.0.1:8642"), expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      body: expect.stringContaining('"workspacePath":"/tmp/project-1"'),
    }));
    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(String(requestInit?.body)).toContain('"gatewayIntegration":"local-gateway"');
    expect(String(requestInit?.body)).toContain('"model":"openai/gpt-5.5"');
    expect(String(requestInit?.body)).toContain('"orchestrator":{"id":"project-builder"');
    expect(String(requestInit?.body)).toContain('"skillBundle":{"id":"ui-builder"');
    expect(String(requestInit?.body)).toContain('"hooks":[{"id":"project-scope-guard"');
    expect(String(requestInit?.body)).toContain('"commands":[{"id":"project-build"');
  });

  it("falls back to Hermes gateway async runs when stream endpoint is unavailable", async () => {
    const fetchMock = vi.fn<(...args: [RequestInfo | URL, RequestInit?]) => Promise<Response>>();
    fetchMock
      .mockResolvedValueOnce(new Response("Method not allowed", { status: 405 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: "gateway-run-1", status: "started" })))
      .mockResolvedValueOnce(new Response('data: {"event":"run.completed","run_id":"gateway-run-1"}\n\n'));
    vi.stubGlobal("fetch", fetchMock);
    const client = new HermesClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "secret",
      transport: "rest",
      inferenceModel: "openai/gpt-5.5",
      inferenceProvider: "openrouter",
    });
    const events = [];

    for await (const event of client.streamProjectRun({
      projectId: "project-1",
      conversationId: "conversation-1",
      message: "Build a page",
      workspacePath: "/tmp/project-1",
      sessionId: null,
      agentBundle: createProjectAgentBundle({
        projectId: "project-1",
        workspacePath: "/tmp/project-1",
        selectedThemeId: "luma-default",
        packageInstallPolicy: "ask",
        validationDepth: "standard",
        defaultRoute: "/",
      }),
    })) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "run", runId: "gateway-run-1" }, { type: "done" }]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, new URL("/v1/runs", "http://127.0.0.1:8642"), expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"input":"Build a page"'),
    }));
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"model":"openai/gpt-5.5"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"inferenceProvider":"openrouter"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("AppLoop project builder");
    expect(fetchMock).toHaveBeenNthCalledWith(3, new URL("/v1/runs/gateway-run-1/events", "http://127.0.0.1:8642"), expect.objectContaining({
      headers: expect.objectContaining({ Accept: "text/event-stream" }),
    }));
  });

  it("maps Hermes failures to user-safe messages", () => {
    expect(hermesErrorToUserMessage(new HermesError("authentication", "raw", 401))).toBe("Hermes authentication failed.");
    expect(hermesErrorToUserMessage(new HermesError("unavailable", "Hermes run failed: Provider rejected the request."))).toBe(
      "Hermes run failed: Provider rejected the request.",
    );
    expect(hermesErrorToUserMessage(new TypeError("fetch failed"))).toBe("Hermes backend unavailable.");
  });

  it("tracks local and Hermes run ids for cancellation", () => {
    rememberActiveHermesRun("project-1", { runId: "local-run", hermesRunId: "hermes-run" });

    expect(getActiveHermesRun("project-1")).toEqual({ runId: "local-run", hermesRunId: "hermes-run" });

    clearActiveHermesRun("project-1");
    expect(getActiveHermesRun("project-1")).toBeNull();
  });

  it("defines the required Hermes agent architecture", () => {
    const bundle = createProjectAgentBundle({
      projectId: "project-1",
      workspacePath: "/tmp/project-1",
      selectedThemeId: "luma-default",
      packageInstallPolicy: "ask",
      validationDepth: "standard",
      defaultRoute: "/",
    });

    expect(bundle.orchestrator.id).toBe("project-builder");
    expect(bundle.delegates.map((agent) => agent.id)).toEqual([
      "ui-architect",
      "nextjs-implementer",
      "validation-repair",
      "security-auditor",
    ]);
    expect(bundle.isolationRules).toContain("workspacePath is the only writable root");
    expect(HERMES_AGENT_DEFINITIONS["security-auditor"].responsibilities).toContain("path-containment");
    expect(bundle.skillBundle.skills.map((skill) => skill.id)).toEqual(UI_BUILDER_SKILL_BUNDLE.activationOrder);
    expect(bundle.hooks.map((hook) => hook.id)).toEqual(UI_BUILDER_HOOK_ORDER);
    expect(bundle.commands.map((command) => command.id)).toEqual(UI_BUILDER_COMMAND_ORDER);
    expect(bundle.layoutValidationScript).toBe("npm run hermes:validate");
  });

  it("defines the required Hermes skill bundle", () => {
    expect(UI_BUILDER_SKILL_BUNDLE.path).toBe(".hermes/bundles/ui-builder/BUNDLE.md");
    expect(UI_BUILDER_SKILL_BUNDLE.skills.map((skill) => skill.command)).toEqual([
      "/security-review",
      "/visual-selector",
      "/theme-system",
      "/frontend-design",
      "/generated-app-standards",
      "/project-runtime",
    ]);
    expect(HERMES_SKILL_DEFINITIONS["frontend-design"].capabilities).toContain("layout-hierarchy");
    expect(HERMES_SKILL_DEFINITIONS["generated-app-standards"].capabilities).toContain("schema-action-patterns");
    expect(HERMES_SKILL_DEFINITIONS["hermes-gateway"].capabilities).toContain("stream-normalization");
    expect(HERMES_SKILL_DEFINITIONS["theme-system"].capabilities).toContain("rollback");
  });

  it("defines the required Hermes hooks and commands", () => {
    expect(UI_BUILDER_HOOK_ORDER).toEqual(["project-scope-guard", "generated-code-review", "theme-integrity", "preview-readiness"]);
    expect(HERMES_HOOK_DEFINITIONS["project-scope-guard"].enforcement).toContain("resolve-symlinks");
    expect(HERMES_HOOK_DEFINITIONS["generated-code-review"].enforcement).toContain("default-export-check");
    expect(HERMES_HOOK_DEFINITIONS["theme-integrity"].enforcement).toContain("hard-coded-color-detection");
    expect(HERMES_HOOK_DEFINITIONS["preview-readiness"].outputs).toContain("previewReady");

    expect(UI_BUILDER_COMMAND_ORDER).toEqual([
      "project-build",
      "project-fix",
      "project-preview",
      "project-theme",
      "project-element-edit",
      "project-validate",
      "project-snapshot",
    ]);
    expect(HERMES_COMMAND_DEFINITIONS["project-build"].command).toBe("/project-build");
    expect(HERMES_COMMAND_DEFINITIONS["project-element-edit"].loads).toContain("visual-selector");
    expect(HERMES_COMMAND_DEFINITIONS["project-validate"].outputs).toContain("validationResult");
  });

  it("ships the required Hermes agent definition files", async () => {
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "agents", "project-builder.md"), "utf8")).resolves.toContain(
      "Project Builder Orchestrator",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "agents", "ui-architect.md"), "utf8")).resolves.toContain(
      "selected AppLoop theme",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "agents", "nextjs-implementer.md"), "utf8")).resolves.toContain(
      "kebab-case filenames",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "agents", "validation-repair.md"), "utf8")).resolves.toContain(
      "three repair attempts",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "agents", "security-auditor.md"), "utf8")).resolves.toContain(
      "Path containment",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "agents", "project-builder.md"), "utf8")).resolves.toContain(
      "version: 1.0.0",
    );
  });

  it("ships the required Hermes skill and bundle files", async () => {
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "skills", "frontend-design", "SKILL.md"), "utf8")).resolves.toContain(
      "Layout Hierarchy",
    );
    await expect(
      fs.readFile(path.join(process.cwd(), ".hermes", "skills", "generated-app-standards", "SKILL.md"), "utf8"),
    ).resolves.toContain("Schema And Action Patterns");
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "skills", "hermes-gateway", "SKILL.md"), "utf8")).resolves.toContain(
      "server-only",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "skills", "theme-system", "SKILL.md"), "utf8")).resolves.toContain(
      "Rollback Behavior",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "skills", "project-runtime", "SKILL.md"), "utf8")).resolves.toContain(
      "Readiness Checks",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "skills", "visual-selector", "SKILL.md"), "utf8")).resolves.toContain(
      "Ambiguous Selector Handling",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "skills", "security-review", "SKILL.md"), "utf8")).resolves.toContain(
      "Iframe boundary",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "bundles", "ui-builder", "BUNDLE.md"), "utf8")).resolves.toContain(
      "/frontend-design",
    );
  });

  it("ships the required Hermes hook and command files", async () => {
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "hooks", "project-scope-guard", "HOOK.md"), "utf8")).resolves.toContain(
      "Resolve symlinks",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "hooks", "generated-code-review", "HOOK.md"), "utf8")).resolves.toContain(
      "Default exports",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "hooks", "theme-integrity", "HOOK.md"), "utf8")).resolves.toContain(
      "hard-coded colors",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "hooks", "preview-readiness", "HOOK.md"), "utf8")).resolves.toContain(
      "preview-ready",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "commands", "project-build.md"), "utf8")).resolves.toContain(
      "/project-build",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "commands", "project-element-edit.md"), "utf8")).resolves.toContain(
      "Selector payload",
    );
    await expect(fs.readFile(path.join(process.cwd(), ".hermes", "commands", "project-validate.md"), "utf8")).resolves.toContain(
      "Validation result",
    );
  });
});