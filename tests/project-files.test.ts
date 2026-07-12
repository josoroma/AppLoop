import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyProjectFileChanges,
  createDependencyApprovalRecord,
  createGeneratedPagePlan,
  evaluateDependencyPolicy,
  inspectProjectSourceFile,
  locateVisualSelectionInSource,
  resolveRouteFromPrompt,
  rollbackProjectFileSnapshot,
} from "@/lib/project-files/operations";
import type { VisualSelection } from "@/lib/visual-selector/types";

const GENERATED_TEMPLATE_PATH = path.join(process.cwd(), "templates", "generated-nextjs-default");

describe("E12 file generation and editing", () => {
  it("keeps the controlled generated app template ready for Hermes edits", async () => {
    const [packageJson, globalsCss, layoutSource, pageSource, prettierConfig, buttonSource, componentsConfig] = await Promise.all([
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, "package.json"), "utf8"),
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, "app", "globals.css"), "utf8"),
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, "app", "layout.tsx"), "utf8"),
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, "app", "page.tsx"), "utf8"),
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, ".prettierrc.json"), "utf8"),
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, "components", "ui", "button.tsx"), "utf8"),
      fs.readFile(path.join(GENERATED_TEMPLATE_PATH, "components.json"), "utf8"),
    ]);

    expect(packageJson).toContain('"typescript"');
    expect(packageJson).toContain('"tailwindcss"');
    expect(packageJson).toContain('"@radix-ui/react-slot"');
    expect(globalsCss.startsWith('@import "tailwindcss";')).toBe(true);
    expect(globalsCss).toContain("--primary");
    expect(layoutSource).toContain("InspectorProvider");
    expect(pageSource).toContain('data-builder-id="home-page"');
    expect(pageSource).toContain("Use the header navigation or switch themes");
    expect(prettierConfig).toContain('"singleQuote": true');
    expect(buttonSource).toContain("buttonVariants");
    expect(componentsConfig).toContain('"ui": "@/components/ui"');
  });

  it("creates route generation plans from chat prompts", () => {
    expect(resolveRouteFromPrompt("Build /sales-dashboard with cards")).toBe("/sales-dashboard");
    expect(resolveRouteFromPrompt("Create a SaaS landing page", "/dashboard")).toBe("/");

    const plan = createGeneratedPagePlan({ route: "/sales-dashboard", title: "Sales Dashboard", brief: "Track pipeline and revenue" });

    expect(plan.affectedFiles).toEqual(["app/sales-dashboard/page.tsx", "app/sales-dashboard/components/sales-dashboard-page.tsx"]);
    expect(plan.changes[1].content).toContain('className="app-shell page-shell"');
    expect(plan.changes[1].content).toContain('data-builder-id="sales-dashboard-page-page"');
  });

  it("applies generated changes with rollback snapshots", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-files-"));
    const plan = createGeneratedPagePlan({ route: "/reports", title: "Reports", brief: "Review performance" });
    const result = await applyProjectFileChanges(workspacePath, plan.changes);

    await expect(inspectProjectSourceFile(workspacePath, "app/reports/page.tsx")).resolves.toContain("ReportsPage");

    await rollbackProjectFileSnapshot(result.snapshot);

    await expect(fs.access(path.join(workspacePath, "app", "reports", "page.tsx"))).rejects.toThrow();
  });

  it("requires source inspection before editing existing files", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-edit-"));
    await fs.mkdir(path.join(workspacePath, "app"));
    await fs.writeFile(path.join(workspacePath, "app", "page.tsx"), "export default function Page() { return null }\n");

    await expect(
      applyProjectFileChanges(workspacePath, [
        {
          relativePath: "app/page.tsx",
          content: "export default function Page() { return <main /> }\n",
          description: "Edit home page",
          requiresExistingSource: true,
        },
      ]),
    ).rejects.toThrow("Source inspection is required");

    await expect(inspectProjectSourceFile(workspacePath, "app/page.tsx")).resolves.toContain("Page");
    await expect(
      applyProjectFileChanges(
        workspacePath,
        [
          {
            relativePath: "app/page.tsx",
            content: "export default function Page() { return <main /> }\n",
            description: "Edit home page",
            requiresExistingSource: true,
          },
        ],
        new Set(["app/page.tsx"]),
      ),
    ).resolves.toMatchObject({ affectedFiles: ["app/page.tsx"] });
  });

  it("locates visual selection boundaries and detects ambiguity", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-selector-"));
    await fs.mkdir(path.join(workspacePath, "app", "dashboard", "components"), { recursive: true });
    await fs.writeFile(path.join(workspacePath, "app", "dashboard", "components", "right-column.tsx"), '<aside className="right-column" data-builder-id="dashboard-right-column" />\n');
    await fs.writeFile(path.join(workspacePath, "app", "dashboard", "components", "copy.tsx"), '<aside className="right-column" />\n');
    const selection = {
      projectId: "project-1",
      previewNonce: "nonce-123456",
      route: "/dashboard",
      tagName: "aside",
      classNames: ["right-column"],
      preferredSelector: ".right-column",
      inspectorId: "dashboard-right-column",
      ancestry: [],
      boundingRect: { x: 0, y: 0, width: 100, height: 100 },
    } satisfies VisualSelection;

    const result = await locateVisualSelectionInSource(workspacePath, selection);

    expect(result.found).toBe(true);
    expect(result.ambiguous).toBe(false);
    expect(result.matches.map((match) => match.relativePath)).toEqual(["app/dashboard/components/right-column.tsx"]);

    const ambiguousResult = await locateVisualSelectionInSource(workspacePath, { ...selection, inspectorId: undefined });

    expect(ambiguousResult.ambiguous).toBe(true);
    expect(ambiguousResult.matches.map((match) => match.relativePath).sort()).toEqual(["app/dashboard/components/copy.tsx", "app/dashboard/components/right-column.tsx"]);
  });

  it("evaluates dependency installation policy", () => {
    const beforePackageJson = JSON.stringify({ dependencies: { next: "16.2.9" } });
    const afterPackageJson = JSON.stringify({ dependencies: { next: "16.2.9", recharts: "latest" } });

    const askDecision = evaluateDependencyPolicy({ beforePackageJson, afterPackageJson, packageInstallPolicy: "ask" });

    expect(askDecision).toMatchObject({
      addedPackages: ["recharts"],
      requiresApproval: true,
      blocked: false,
      auditCommand: "npm audit --audit-level=moderate",
    });
    expect(createDependencyApprovalRecord("project-1", askDecision, new Date("2026-01-02T03:04:05.000Z"))).toEqual({
      projectId: "project-1",
      packages: ["recharts"],
      approvedAt: "2026-01-02T03:04:05.000Z",
    });
    expect(evaluateDependencyPolicy({ beforePackageJson, afterPackageJson, packageInstallPolicy: "never" })).toMatchObject({
      blocked: true,
      auditCommand: null,
    });
  });
});