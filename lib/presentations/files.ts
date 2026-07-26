import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideRoot } from "@/lib/security/paths";
import {
  assertPresentationTemplate,
  DEFAULT_PRESENTATION_TEMPLATE_ID,
  type PresentationTemplate,
} from "@/lib/presentations/templates";

export const PRESENTATION_TEMPLATES_ROOT = path.join(process.cwd(), "presentations-templates");
export const PRESENTATION_ASSETS_DIR = "assets";

const PRESENTATION_IMAGE_TYPES = new Map([
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

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

export function presentationImageContentType(fileName: string) {
  return PRESENTATION_IMAGE_TYPES.get(path.extname(fileName).toLowerCase()) ?? null;
}

export function isSupportedPresentationImage(fileName: string) {
  return presentationImageContentType(fileName) !== null;
}

export function resolvePresentationAssetPath(workspacePath: string, assetPath: string) {
  const assetsRoot = assertInsideRoot(workspacePath, path.join(workspacePath, PRESENTATION_ASSETS_DIR));
  return assertInsideRoot(assetsRoot, path.join(assetsRoot, assetPath));
}

export async function writePresentationAsset(workspacePath: string, fileName: string, contents: Buffer) {
  if (!isSupportedPresentationImage(fileName)) {
    throw new Error("Unsupported image type. Use PNG, GIF, JPG, or SVG.");
  }
  const assetsRoot = assertInsideRoot(workspacePath, path.join(workspacePath, PRESENTATION_ASSETS_DIR));
  const assetPath = resolvePresentationAssetPath(workspacePath, fileName);
  await fs.mkdir(assetsRoot, { recursive: true });
  await fs.writeFile(assetPath, contents);
  return `${PRESENTATION_ASSETS_DIR}/${path.basename(assetPath)}`;
}

export async function listPresentationImageAssets(workspacePath: string) {
  const assetsRoot = assertInsideRoot(workspacePath, path.join(workspacePath, PRESENTATION_ASSETS_DIR));
  try {
    const entries = await fs.readdir(assetsRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && isSupportedPresentationImage(entry.name))
      .map((entry) => {
        const relativePath = `${PRESENTATION_ASSETS_DIR}/${entry.name}`;
        return {
          name: entry.name,
          path: relativePath,
          alt: path.basename(entry.name, path.extname(entry.name)).replace(/-[0-9a-f]{8}$/i, "").replace(/-/g, " "),
          contentType: presentationImageContentType(entry.name) ?? "application/octet-stream",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (isMissingPathError(error)) return [];
    throw error;
  }
}

export async function readPresentationAsset(workspacePath: string, assetPath: string) {
  const resolvedPath = resolvePresentationAssetPath(workspacePath, assetPath);
  const contentType = presentationImageContentType(resolvedPath);
  if (!contentType) {
    throw new Error("Unsupported image type.");
  }
  const contents = await fs.readFile(resolvedPath);
  return { contents, contentType };
}

function isTransientPresentationPath(sourceWorkspacePath: string, sourcePath: string) {
  const relativePath = path.relative(sourceWorkspacePath, sourcePath);
  const [topLevelPath] = relativePath.split(path.sep);
  return TRANSIENT_PRESENTATION_PATHS.has(topLevelPath);
}

function isMissingPathError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
