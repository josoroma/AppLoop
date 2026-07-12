import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { describe, expect, it } from "vitest";
import { builderTables } from "@/lib/db/schema";
import { requireHermesApiKey, serverEnvSchema } from "@/lib/env/schema";
import { createProjectSlug, resolveProjectWorkspacePath } from "@/lib/projects/service";
import { assertPreviewPort, BUILDER_PORT, DEFAULT_PREVIEW_PORT_RANGE } from "@/lib/runtime/ports";

describe("E1 foundation", () => {
  it("validates server environment defaults and keeps Hermes secrets server-side", () => {
    const env = serverEnvSchema.parse({});

    expect(env.HERMES_BASE_URL).toBe("http://127.0.0.1:8642");
    expect(env.DATABASE_URL).toBe("file:.apploop/builder.sqlite");
    expect(env.HERMES_API_KEY).toBeUndefined();
    expect(() => requireHermesApiKey(env)).toThrow("HERMES_API_KEY");
    expect(requireHermesApiKey(serverEnvSchema.parse({ API_SERVER_KEY: "gateway-key" }))).toBe("gateway-key");
  });

  it("rejects preview port ranges that include the builder port", () => {
    expect(BUILDER_PORT).toBe(3001);
    expect(() => serverEnvSchema.parse({ PREVIEW_PORT_START: "3000", PREVIEW_PORT_END: "3002" })).toThrow();
    expect(assertPreviewPort(3100, DEFAULT_PREVIEW_PORT_RANGE)).toBe(3100);
    expect(() => assertPreviewPort(3001, { start: 3000, end: 3010 })).toThrow("builder port");
  });

  it("supports path aliases for project services", () => {
    expect(createProjectSlug("CRM Dashboard")).toBe("crm-dashboard");
    expect(resolveProjectWorkspacePath("/tmp/apploop", "CRM Dashboard")).toBe("/tmp/apploop/crm-dashboard");
  });

  it("defines the local persistence tables required by E1", () => {
    expect(Object.keys(builderTables)).toEqual([
      "projects",
      "conversations",
      "messages",
      "runs",
      "runtimes",
      "projectSnapshots",
      "gitCommits",
      "projectThemes",
      "projectSettings",
      "builderPreferences",
    ]);
  });

  it("keeps the builder UI stack importable", () => {
    expect(typeof useChat).toBe("function");
    expect(new DefaultChatTransport()).toBeInstanceOf(DefaultChatTransport);
  });
});