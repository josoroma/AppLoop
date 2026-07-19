import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProjectWorkspace, duplicateProjectWorkspace } from "@/lib/projects/files";
import {
  allocatePreviewPort,
  createUniqueSlug,
  projectSettingsInputSchema,
  reserveHermesSessionId,
} from "@/lib/projects/service";
import { assertProjectTemplate, BUILT_IN_PROJECT_TEMPLATES } from "@/lib/projects/templates";
import { DEFAULT_THEME_ID } from "@/lib/themes/registry";

describe("E2 project management", () => {
  it("creates unique project slugs", () => {
    expect(createUniqueSlug("CRM Dashboard", [])).toBe("crm-dashboard");
    expect(createUniqueSlug("CRM Dashboard", ["crm-dashboard", "crm-dashboard-2"])).toBe("crm-dashboard-3");
  });

  it("allocates preview ports without using reserved builder ports", () => {
    expect(allocatePreviewPort([3100, 3101], { start: 3100, end: 3103 })).toBe(3102);
    expect(() => allocatePreviewPort([3100], { start: 3001, end: 3002 })).toThrow("builder port");
  });

  it("reserves independent Hermes session ids per project", () => {
    expect(reserveHermesSessionId("project-1")).toBe("reserved:project-1");
  });

  it("validates project settings", () => {
    expect(
      projectSettingsInputSchema.parse({
        projectId: "project-1",
        packageInstallPolicy: "ask",
        validationDepth: "standard",
        autoStartPreview: true,
        defaultRoute: "/dashboard",
      }),
    ).toEqual({
      projectId: "project-1",
      packageInstallPolicy: "ask",
      validationDepth: "standard",
      autoStartPreview: true,
      defaultRoute: "/dashboard",
      themeId: DEFAULT_THEME_ID,
    });
  });

  it("duplicates source trees while excluding transient build output", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-e2-"));
    const sourcePath = path.join(tempRoot, "source");
    const destinationPath = path.join(tempRoot, "copy");

    await fs.mkdir(path.join(sourcePath, "app"), { recursive: true });
    await fs.mkdir(path.join(sourcePath, ".next"), { recursive: true });
    await fs.writeFile(path.join(sourcePath, "app", "page.tsx"), "export default function Page() { return null; }\n");
    await fs.writeFile(path.join(sourcePath, ".next", "trace"), "transient\n");

    await duplicateProjectWorkspace(sourcePath, destinationPath);

    await expect(fs.readFile(path.join(destinationPath, "app", "page.tsx"), "utf8")).resolves.toContain("Page");
    await expect(fs.access(path.join(destinationPath, ".next", "trace"))).rejects.toThrow();
  });

  it("creates workspaces from the selected project template", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-template-"));
    const workspacePath = path.join(tempRoot, "admin-project");

    await createProjectWorkspace(tempRoot, workspacePath, {
      template: assertProjectTemplate("admin-luma"),
    });

    await expect(fs.readFile(path.join(workspacePath, "app", "page.tsx"), "utf8")).resolves.toContain("AdminHomePage");
    await expect(fs.readFile(path.join(workspacePath, "app", "not-found.tsx"), "utf8")).resolves.toContain("NotFoundView");
  });

  it("wires every GitHub templates directory into the create-project registry", async () => {
    const expectedTemplateIds = ["admin-luma", "ai-engineer-cv", "deep-research-paper", "default", "luminous-rings", "solar-system"];
    const registeredTemplateIds = BUILT_IN_PROJECT_TEMPLATES.map((template) => template.id).toSorted();

    expect(registeredTemplateIds).toEqual(expectedTemplateIds);

    for (const template of BUILT_IN_PROJECT_TEMPLATES) {
      const templateRoot = path.join(process.cwd(), "templates", template.templatePath);

      await expect(fs.readFile(path.join(templateRoot, "package.json"), "utf8")).resolves.toContain("generated-apploop-app");
      await expect(fs.readFile(path.join(templateRoot, "app", "layout.tsx"), "utf8")).resolves.toContain(`template-${template.id}`);
    }
  });

  it("creates solar-system workspaces with package metadata and without transient template output", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-solar-template-"));
    const workspacePath = path.join(tempRoot, "solar-project");

    await createProjectWorkspace(tempRoot, workspacePath, {
      template: assertProjectTemplate("solar-system"),
    });

    await expect(fs.readFile(path.join(workspacePath, "package.json"), "utf8")).resolves.toContain("@react-three/fiber");
    await expect(fs.readFile(path.join(workspacePath, "app", "layout.tsx"), "utf8")).resolves.toContain("template-solar-system");
    await expect(fs.readFile(path.join(workspacePath, "components", "solar-system-scene.tsx"), "utf8")).resolves.toContain("SolarSystemScene");
    await expect(fs.access(path.join(workspacePath, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(workspacePath, ".next"))).rejects.toThrow();
  });

  it("registers specialty project templates", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-specialty-template-"));

    for (const [templateId, bodyClassName, pageMarker] of [
      ["ai-engineer-cv", "template-ai-engineer-cv", "AiEngineerCvPage"],
      ["deep-research-paper", "template-deep-research-paper", "DeepResearchPaperPage"],
      ["luminous-rings", "template-luminous-rings", "ParticlesHomePage"],
      ["solar-system", "template-solar-system", "SolarSystemPage"],
    ] as const) {
      const workspacePath = path.join(tempRoot, templateId);

      await createProjectWorkspace(tempRoot, workspacePath, {
        template: assertProjectTemplate(templateId),
      });

      await expect(fs.readFile(path.join(workspacePath, "app", "layout.tsx"), "utf8")).resolves.toContain(bodyClassName);
      await expect(fs.readFile(path.join(workspacePath, "app", "page.tsx"), "utf8")).resolves.toContain(pageMarker);
    }
  });
});