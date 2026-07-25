import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideRoot } from "@/lib/security/paths";
import {
  assertPresentationTemplate,
  DEFAULT_PRESENTATION_TEMPLATE_ID,
  type PresentationTemplate,
} from "@/lib/presentations/templates";

export const PRESENTATION_TEMPLATES_ROOT = path.join(process.cwd(), "presentations-templates");

const TRANSIENT_PRESENTATION_PATHS = new Set(["node_modules", ".next", ".turbo", "dist", "out", "logs"]);

export function resolvePresentationsRoot(presentationsRoot: string) {
  return path.isAbsolute(presentationsRoot)
    ? presentationsRoot
    : path.resolve(process.cwd(), presentationsRoot);
}

export async function createPresentationWorkspace(
  presentationsRoot: string,
  workspacePath: string,
  options: { template?: PresentationTemplate } = {},
) {
  const root = resolvePresentationsRoot(presentationsRoot);
  const safeWorkspacePath = assertInsideRoot(root, workspacePath);
  const template = options.template ?? assertPresentationTemplate(DEFAULT_PRESENTATION_TEMPLATE_ID);
  const templatePath = assertInsideRoot(
    PRESENTATION_TEMPLATES_ROOT,
    path.join(PRESENTATION_TEMPLATES_ROOT, template.templatePath),
  );

  await fs.mkdir(root, { recursive: true });
  await fs.cp(templatePath, safeWorkspacePath, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (source) => !isTransientPresentationPath(templatePath, source),
  });

  return safeWorkspacePath;
}

export async function movePresentationWorkspaceToTrash(
  presentationsRoot: string,
  workspacePath: string,
  presentationId: string,
) {
  const root = resolvePresentationsRoot(presentationsRoot);
  const safeWorkspacePath = assertInsideRoot(root, workspacePath);
  const trashRoot = path.join(root, ".trash");
  const trashPath = path.join(trashRoot, `${path.basename(safeWorkspacePath)}-${presentationId}`);

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

export function resolvePresentationSourcePath(workspacePath: string, sourceFile = "deck.md") {
  return assertInsideRoot(workspacePath, path.join(workspacePath, sourceFile));
}

export async function readPresentationMarkdown(workspacePath: string, sourceFile = "deck.md") {
  const deckPath = resolvePresentationSourcePath(workspacePath, sourceFile);
  return fs.readFile(deckPath, "utf8");
}

export async function writePresentationMarkdown(
  workspacePath: string,
  markdown: string,
  sourceFile = "deck.md",
) {
  const deckPath = resolvePresentationSourcePath(workspacePath, sourceFile);
  await fs.writeFile(deckPath, markdown, "utf8");
  return deckPath;
}

function isTransientPresentationPath(sourceWorkspacePath: string, sourcePath: string) {
  const relativePath = path.relative(sourceWorkspacePath, sourcePath);
  const [topLevelPath] = relativePath.split(path.sep);
  return TRANSIENT_PRESENTATION_PATHS.has(topLevelPath);
}

function isMissingPathError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
