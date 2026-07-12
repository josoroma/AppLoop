import fs from "node:fs";
import path from "node:path";

const requiredMarkdownFiles = [
  ".hermes/agents/project-builder.md",
  ".hermes/agents/ui-architect.md",
  ".hermes/agents/nextjs-implementer.md",
  ".hermes/agents/validation-repair.md",
  ".hermes/agents/security-auditor.md",
  ".hermes/bundles/ui-builder/BUNDLE.md",
  ".hermes/skills/frontend-design/SKILL.md",
  ".hermes/skills/generated-app-standards/SKILL.md",
  ".hermes/skills/hermes-gateway/SKILL.md",
  ".hermes/skills/project-runtime/SKILL.md",
  ".hermes/skills/security-review/SKILL.md",
  ".hermes/skills/theme-system/SKILL.md",
  ".hermes/skills/visual-selector/SKILL.md",
  ".hermes/hooks/generated-code-review/HOOK.md",
  ".hermes/hooks/preview-readiness/HOOK.md",
  ".hermes/hooks/project-scope-guard/HOOK.md",
  ".hermes/hooks/theme-integrity/HOOK.md",
  ".hermes/commands/project-build.md",
  ".hermes/commands/project-element-edit.md",
  ".hermes/commands/project-fix.md",
  ".hermes/commands/project-preview.md",
  ".hermes/commands/project-snapshot.md",
  ".hermes/commands/project-theme.md",
  ".hermes/commands/project-validate.md",
];

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return null;
  }

  const closingIndex = content.indexOf("\n---\n", 4);

  if (closingIndex === -1) {
    return null;
  }

  return content.slice(4, closingIndex);
}

const root = process.cwd();
const errors = [];

for (const relativePath of requiredMarkdownFiles) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    errors.push(`${relativePath}: missing`);
    continue;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    errors.push(`${relativePath}: missing YAML frontmatter`);
    continue;
  }

  for (const field of ["name", "description", "version"]) {
    if (!new RegExp(`^${field}:\\s*\\S`, "m").test(frontmatter)) {
      errors.push(`${relativePath}: missing ${field} frontmatter field`);
    }
  }

  if (content.slice(content.indexOf("\n---\n") + 5).trim().length === 0) {
    errors.push(`${relativePath}: missing body`);
  }
}

if (errors.length > 0) {
  console.error("Hermes layout validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Hermes layout OK: ${requiredMarkdownFiles.length} assets validated.`);