import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@/lib/db/repository";
import { createProjectInputSchema, formatProjectWorkspacePath, ProjectService, resolveProjectWorkspacePath } from "@/lib/projects/service";
import { assertPreviewPort } from "@/lib/runtime/ports";
import { assertInsideRoot } from "@/lib/security/paths";
import { DEFAULT_THEME_ID, getProjectTheme } from "@/lib/themes/registry";
import { parseVisualSelection } from "@/lib/visual-selector/types";

describe("E17 project-domain test coverage", () => {
  it("accepts contained workspace paths and rejects escaped paths", async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-domain-root-"));

    expect(resolveProjectWorkspacePath(rootPath, "CRM Dashboard")).toBe(path.join(rootPath, "crm-dashboard"));
    expect(() => assertInsideRoot(rootPath, path.join(rootPath, "..", "escape"))).toThrow("projects root");
  });

  it("formats project workspace paths relative to the builder repo", () => {
    expect(formatProjectWorkspacePath(path.join(process.cwd(), ".apploop", "projects", "homepage"))).toBe(".apploop/projects/homepage");
    expect(formatProjectWorkspacePath(".apploop/projects/homepage")).toBe(".apploop/projects/homepage");
  });

  it("creates a project bundle with default runtime, settings, and theme", async () => {
    const createdBundles: unknown[] = [];
    const repository = {
      listProjects: async () => [],
      listAllocatedPreviewPorts: async () => [3100],
      createProjectBundle: async (bundle: unknown) => {
        createdBundles.push(bundle);
        return { project: (bundle as { project: unknown }).project, conversation: null, runtime: null, theme: null, settings: null };
      },
    } as unknown as ProjectRepository;
    const service = new ProjectService(repository, { start: 3100, end: 3102 });
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-domain-create-"));

    await service.createProject({ name: "Landing Page", themeId: DEFAULT_THEME_ID }, rootPath);

    expect(createdBundles).toHaveLength(1);
    expect(createdBundles[0]).toMatchObject({
      project: { name: "Landing Page", slug: "landing-page", previewPort: 3101, themeId: DEFAULT_THEME_ID },
      runtime: { status: "stopped", previewUrl: "http://127.0.0.1:3101" },
      settings: { autoStartPreview: true, defaultRoute: "/" },
    });
  });

  it("covers port allocation, theme validation, and selector schema contracts", () => {
    expect(assertPreviewPort(3100, { start: 3100, end: 3101 })).toBe(3100);
    expect(createProjectInputSchema.parse({ name: "Valid", themeId: DEFAULT_THEME_ID }).themeId).toBe(DEFAULT_THEME_ID);
    expect(getProjectTheme(DEFAULT_THEME_ID)).toBeTruthy();
    expect(
      parseVisualSelection({
        projectId: "project-1",
        previewNonce: "nonce-123456",
        route: "/",
        tagName: "HEADER",
        classNames: ["page-header"],
        preferredSelector: ".page-header",
        ancestry: [],
        boundingRect: { x: 0, y: 0, width: 320, height: 80 },
      }),
    ).toMatchObject({ tagName: "header", preferredSelector: ".page-header" });
  });
});