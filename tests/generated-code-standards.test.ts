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

describe("E11 generated app code standards", () => {
  it("defines generated-app formatter rules and template scripts", async () => {
    const templateRoot = path.join(process.cwd(), "templates", "generated-nextjs-default");
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
});