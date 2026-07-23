import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_TEMPLATE,
  COMPONENT_TEMPLATE,
  GENERATED_FORMAT_RULES,
  SCHEMA_TEMPLATE,
  componentNameFromFileName,
  isKebabCaseFileName,
  validateGeneratedSourceFile,
} from "@/lib/generated-code/standards";
import { BUILT_IN_PROJECT_TEMPLATES } from "@/lib/projects/templates";

describe("E11 generated app code standards", () => {
  it("defines generated-app formatter rules and template scripts", async () => {
    const templateRoot = path.join(process.cwd(), "templates", "default");
    const prettierConfig = JSON.parse(await fs.readFile(path.join(templateRoot, ".prettierrc.json"), "utf8"));
    const packageJson = JSON.parse(await fs.readFile(path.join(templateRoot, "package.json"), "utf8"));
    const tsconfig = JSON.parse(await fs.readFile(path.join(templateRoot, "tsconfig.json"), "utf8"));

    expect(prettierConfig).toEqual(GENERATED_FORMAT_RULES);
    expect(packageJson.scripts.format).toBe("prettier --write .");
    expect(packageJson.scripts.lint).toBe("eslint");
    expect(tsconfig.compilerOptions.paths).toEqual({ "@/*": ["./*"] });
    expect(tsconfig.compilerOptions.baseUrl).toBeUndefined();
  });

  it("validates kebab-case filenames and matching PascalCase components", () => {
    expect(isKebabCaseFileName("project-card.tsx")).toBe(true);
    expect(componentNameFromFileName("project-card.tsx")).toBe("ProjectCard");
    expect(validateGeneratedSourceFile({ relativePath: "components/project-card.tsx", content: COMPONENT_TEMPLATE })).toEqual([]);
    expect(
      validateGeneratedSourceFile({
        relativePath: "components/project-card.tsx",
        content: "export default function ProjectCard() { return null }",
      }).map((violation) => violation.ruleId),
    ).toContain("default-export-check");
  });

  it("rejects deep parent imports and unapproved route modules", () => {
    expect(
      validateGeneratedSourceFile({
        relativePath: "app/dashboard/components/project-card.tsx",
        content: "import { formatCurrency } from '../../lib/money'\nexport const ProjectCard = () => null",
      }).map((violation) => violation.ruleId),
    ).toContain("import-path-check");
    expect(
      validateGeneratedSourceFile({
        relativePath: "app/dashboard/service.ts",
        content: "export const dashboardService = {}",
      }).map((violation) => violation.ruleId),
    ).toContain("route-colocation-check");
  });

  it("validates schema and action templates", () => {
    expect(validateGeneratedSourceFile({ relativePath: "app/positions/schema.ts", content: SCHEMA_TEMPLATE })).toEqual([]);
    expect(validateGeneratedSourceFile({ relativePath: "app/positions/actions.ts", content: ACTION_TEMPLATE })).toEqual([]);
    expect(validateGeneratedSourceFile({ relativePath: "app/positions/schema.ts", content: "export const schema = {}" })).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "schema-pattern-check" })]),
    );
    expect(validateGeneratedSourceFile({ relativePath: "app/positions/actions.ts", content: "export const create = async () => {}" })).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "action-pattern-check" })]),
    );
  });

  it("keeps template UI elements inspectable with unique last classnames", async () => {
    for (const templateName of BUILT_IN_PROJECT_TEMPLATES.map((template) => template.templatePath)) {
      const templateRoot = path.join(process.cwd(), "templates", templateName);
      const files = await collectTemplateUiFiles(templateRoot);
      const lastClassNames: string[] = [];

      for (const file of files) {
        const content = await fs.readFile(file, "utf8");
        const elementMatches = content.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g);

        for (const match of elementMatches) {
          const attrs = match[2] ?? "";
          const literalClassName = attrs.match(/className="([^"]+)"/);
          const templateClassName = attrs.match(/className=\{`([^`]+)`\}/);

          expect(literalClassName || templateClassName, `${path.relative(templateRoot, file)} <${match[1]}> missing className`).toBeTruthy();

          if (literalClassName) {
            const classes = literalClassName[1].trim().split(/\s+/);

            expect(classes.length, `${path.relative(templateRoot, file)} <${match[1]}> needs a classname`).toBeGreaterThan(0);
            lastClassNames.push(classes[classes.length - 1]);
          }
        }
      }

      const duplicates = lastClassNames.filter((className, index) => lastClassNames.indexOf(className) !== index);

      expect(duplicates, `${templateName} has repeated preferred/last classnames`).toEqual([]);
    }
  });

  it("keeps template inspector providers tracking all selected elements during scroll", async () => {
    for (const templateName of BUILT_IN_PROJECT_TEMPLATES.map((template) => template.templatePath)) {
      const providerSource = await fs.readFile(path.join(process.cwd(), "templates", templateName, "components", "inspector-provider.tsx"), "utf8");

      expect(providerSource).toContain("const selectedElements = new Map<string, HTMLElement>()");
      expect(providerSource).toContain("for (const preferredSelector of [...selectedElements.keys()])");
      expect(providerSource).toContain("resolveTrackedElement");
      expect(providerSource).toContain("document.querySelector(preferredSelector)");
      expect(providerSource).not.toContain("let selectedElement: HTMLElement | null");
    }
  });
});

async function collectTemplateUiFiles(templateRoot: string) {
  const files: string[] = [];
  const ignored = new Set([
    "inspector-provider.tsx",
    "theme-provider.tsx",
    "button.tsx",
    "avatar.tsx",
    "layout.tsx",
    "solar-system-scene.tsx",
    "canvas-scene.tsx",
    "algovivo-creature-scene.tsx",
    "creature-sidebar.tsx",
    "curiosity-hero.tsx",
  ]);

  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        await walk(entryPath);
      } else if (entry.name.endsWith(".tsx") && !ignored.has(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  await walk(templateRoot);

  return files;
}
