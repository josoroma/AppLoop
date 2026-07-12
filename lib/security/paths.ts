import path from "node:path";
import fs from "node:fs/promises";

const SPECIAL_FILESYSTEM_ROOTS = ["/dev", "/proc", "/sys"];

export function toSafePathSegment(value: string) {
  const segment = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!segment) {
    throw new Error("Path segment cannot be empty.");
  }

  return segment;
}

export function assertInsideRoot(rootPath: string, targetPath: string) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  assertNotSpecialFilesystemPath(resolvedTarget);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Target path must stay inside the configured projects root.");
  }

  return resolvedTarget;
}

export async function assertRealPathInsideRoot(rootPath: string, targetPath: string) {
  const resolvedRoot = await realpathOrResolved(rootPath);
  const resolvedTarget = await realpathOrResolved(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  assertNotSpecialFilesystemPath(resolvedTarget);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Resolved target path must stay inside the configured projects root.");
  }

  return resolvedTarget;
}

export function assertNotSpecialFilesystemPath(targetPath: string) {
  const resolvedTarget = path.resolve(targetPath);
  const specialRoot = SPECIAL_FILESYSTEM_ROOTS.find((root) => resolvedTarget === root || resolvedTarget.startsWith(`${root}${path.sep}`));

  if (specialRoot) {
    throw new Error(`Special filesystem paths are not allowed: ${specialRoot}`);
  }
}

async function realpathOrResolved(targetPath: string) {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}