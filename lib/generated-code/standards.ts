import path from "node:path";

export type GeneratedCodeViolation = {
  ruleId: string;
  message: string;
};

export type GeneratedSourceFile = {
  relativePath: string;
  content: string;
};

export const GENERATED_FORMAT_RULES = {
  tabWidth: 2,
  singleQuote: true,
  trailingComma: "all",
  semi: false,
} as const;

export const DEFAULT_EXPORT_ALLOWED_FILES = new Set(["page.tsx", "layout.tsx", "loading.tsx", "error.tsx", "route.ts"]);
export const APPROVED_ROUTE_MODULE_FILES = new Set(["actions.ts", "schema.ts", "hooks.ts", "atoms.ts", "types.ts", "utils.ts", "constants.ts"]);

export const COMPONENT_TEMPLATE = `type ProjectCardProps = {\n  title: string\n  description: string\n}\n\nexport const ProjectCard = ({ title, description }: ProjectCardProps) => {\n  return (\n    <article className="summary-card border-border bg-card text-card-foreground">\n      <h2>{title}</h2>\n      <p>{description}</p>\n    </article>\n  )\n}\n`;

export const SCHEMA_TEMPLATE = `import { z } from 'zod'\n\nexport const PositionSchema = z.object({\n  title: z.string().min(1),\n})\n\nexport type Position = z.infer<typeof PositionSchema>\n`;

export const ACTION_TEMPLATE = `'use server'\n\nexport async function createPosition() {\n  return { success: true as const }\n}\n`;

export function validateGeneratedSourceFile(file: GeneratedSourceFile) {
  const violations: GeneratedCodeViolation[] = [];
  const fileName = path.posix.basename(file.relativePath);

  if (!isFrameworkFile(fileName) && !isKebabCaseFileName(fileName)) {
    violations.push({ ruleId: "file-naming-check", message: "Generated source filenames must be kebab-case." });
  }

  if (hasDefaultExport(file.content) && !DEFAULT_EXPORT_ALLOWED_FILES.has(fileName)) {
    violations.push({ ruleId: "default-export-check", message: "Default exports are allowed only in Next.js route convention files." });
  }

  if (hasDeepParentImport(file.content)) {
    violations.push({ ruleId: "import-path-check", message: "Relative imports must not traverse more than one parent directory." });
  }

  if (isComponentFile(file.relativePath)) {
    const componentExports = findPascalCaseComponentExports(file.content);
    const expectedComponentName = componentNameFromFileName(fileName);

    if (componentExports.length > 1) {
      violations.push({ ruleId: "one-component-per-file", message: "Component files must export one PascalCase component." });
    }

    if (componentExports.length === 1 && componentExports[0] !== expectedComponentName) {
      violations.push({ ruleId: "component-file-match", message: "The PascalCase component export must match the kebab-case filename." });
    }
  }

  if (isAppRouteModule(file.relativePath) && !isApprovedRouteModule(file.relativePath)) {
    violations.push({ ruleId: "route-colocation-check", message: "Route modules must use approved filenames or live under a route components folder." });
  }

  if (fileName === "schema.ts" && !hasSchemaPattern(file.content)) {
    violations.push({ ruleId: "schema-pattern-check", message: "Schemas must export a PascalCase Schema constant and matching z.infer type." });
  }

  if (fileName === "actions.ts" && !hasActionPattern(file.content)) {
    violations.push({ ruleId: "action-pattern-check", message: "Actions must use exported async verb-noun function declarations." });
  }

  return violations;
}

export function isKebabCaseFileName(fileName: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:ts|tsx)$/.test(fileName);
}

export function componentNameFromFileName(fileName: string) {
  return fileName
    .replace(/\.(?:ts|tsx)$/, "")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function isFrameworkFile(fileName: string) {
  return DEFAULT_EXPORT_ALLOWED_FILES.has(fileName) || APPROVED_ROUTE_MODULE_FILES.has(fileName);
}

function hasDefaultExport(content: string) {
  return /export\s+default\b/.test(content);
}

function hasDeepParentImport(content: string) {
  return /from\s+['"]\.\.\/\.\.\//.test(content) || /import\(['"]\.\.\/\.\.\//.test(content);
}

function isComponentFile(relativePath: string) {
  return relativePath.endsWith(".tsx") && !DEFAULT_EXPORT_ALLOWED_FILES.has(path.posix.basename(relativePath));
}

function findPascalCaseComponentExports(content: string) {
  const constExports = Array.from(content.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9]*)\s*=/g)).map((match) => match[1]);
  const functionExports = Array.from(content.matchAll(/export\s+function\s+([A-Z][A-Za-z0-9]*)\s*\(/g)).map((match) => match[1]);

  return [...constExports, ...functionExports];
}

function isAppRouteModule(relativePath: string) {
  return relativePath.startsWith("app/") && /\.(?:ts|tsx)$/.test(relativePath);
}

function isApprovedRouteModule(relativePath: string) {
  const parts = relativePath.split("/");
  const fileName = parts.at(-1) ?? "";

  return DEFAULT_EXPORT_ALLOWED_FILES.has(fileName) || APPROVED_ROUTE_MODULE_FILES.has(fileName) || parts.includes("components");
}

function hasSchemaPattern(content: string) {
  const schemaMatch = content.match(/export\s+const\s+([A-Z][A-Za-z0-9]*)Schema\s*=\s*z\.object\s*\(/);

  if (!schemaMatch) {
    return false;
  }

  return new RegExp(`export\\s+type\\s+${schemaMatch[1]}\\s*=\\s*z\\.infer<typeof ${schemaMatch[1]}Schema>`).test(content);
}

function hasActionPattern(content: string) {
  return /export\s+async\s+function\s+[a-z]+[A-Z][A-Za-z0-9]*\s*\(/.test(content);
}