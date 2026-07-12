import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideRoot } from "@/lib/security/paths";
import { assertProjectTemplate, DEFAULT_PROJECT_TEMPLATE_ID, type ProjectTemplate } from "@/lib/projects/templates";
import { applyThemeToWorkspace } from "@/lib/themes/apply";
import type { ProjectTheme } from "@/lib/themes/registry";

export const GENERATED_APP_TEMPLATE_PATH = path.join(process.cwd(), "templates", "generated-nextjs-default");
const PROJECT_TEMPLATES_ROOT = path.join(process.cwd(), "templates");

const TRANSIENT_PROJECT_PATHS = new Set([".next", ".turbo", "node_modules", "out", "dist", "logs"]);

type CreateProjectWorkspaceOptions = {
  template?: ProjectTemplate;
  theme?: ProjectTheme;
};

export async function createProjectWorkspace(projectsRoot: string, workspacePath: string, options: CreateProjectWorkspaceOptions = {}) {
  const safeWorkspacePath = assertInsideRoot(projectsRoot, workspacePath);
  const template = options.template ?? assertProjectTemplate(DEFAULT_PROJECT_TEMPLATE_ID);
  const theme = options.theme;
  const templatePath = assertInsideRoot(PROJECT_TEMPLATES_ROOT, path.join(PROJECT_TEMPLATES_ROOT, template.templatePath));

  await fs.mkdir(projectsRoot, { recursive: true });
  await fs.cp(templatePath, safeWorkspacePath, { recursive: true, errorOnExist: true, force: false });

  if (theme) {
    await applyThemeToWorkspace(safeWorkspacePath, theme);
  }

  return safeWorkspacePath;
}

export async function duplicateProjectWorkspace(sourceWorkspacePath: string, destinationWorkspacePath: string) {
  const safeDestinationPath = assertInsideRoot(path.dirname(destinationWorkspacePath), destinationWorkspacePath);

  await fs.cp(sourceWorkspacePath, safeDestinationPath, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (source) => !isTransientProjectPath(sourceWorkspacePath, source),
  });

  return safeDestinationPath;
}

export async function moveProjectWorkspaceToTrash(projectsRoot: string, workspacePath: string, projectId: string) {
  const safeWorkspacePath = assertInsideRoot(projectsRoot, workspacePath);
  const trashRoot = path.join(projectsRoot, ".trash");
  const trashPath = path.join(trashRoot, `${path.basename(safeWorkspacePath)}-${projectId}`);

  await fs.mkdir(trashRoot, { recursive: true });

  try {
    await fs.rename(safeWorkspacePath, trashPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }

    throw error;
  }

  return trashPath;
}

function isTransientProjectPath(sourceWorkspacePath: string, sourcePath: string) {
  const relativePath = path.relative(sourceWorkspacePath, sourcePath);
  const [topLevelPath] = relativePath.split(path.sep);

  return TRANSIENT_PROJECT_PATHS.has(topLevelPath);
}

function isMissingPathError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}