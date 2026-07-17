"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { getProjectRepository } from "@/lib/projects/store";

/**
 * Create a git snapshot (commit) in the generated project workspace.
 * Returns the commit hash, or null if git isn't available.
 *
 * Git is initialized at project creation time. This function falls back
 * to lazy init for projects created before that feature was added.
 */
export async function createFileSnapshot(projectId: string): Promise<string | null> {
  const overview = await getProjectRepository().findProjectOverviewById(projectId);

  if (!overview) return null;

  const cwd = overview.project.workspacePath;
  const gitDir = path.join(cwd, ".git");

  // Fallback: lazy init for projects created before git-init-at-creation
  try {
    await fs.access(gitDir);
  } catch {
    // No .git — try to init one now. Only if git is available and we're not
    // inside a parent git repo that would swallow our files.
    try {
      const toplevel = execSync("git rev-parse --show-toplevel", {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5000,
      }).trim();

      if (path.resolve(toplevel) !== path.resolve(cwd)) {
        // Inside parent repo — init project-level git
        await initProjectGit(cwd);
      }
      // else: already rooted here (unlikely without .git), do nothing
    } catch {
      // No git at all — init fresh
      await initProjectGit(cwd);
    }
  }

  // Verify git is rooted at the workspace (not a parent repo)
  try {
    const toplevel = execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();

    if (path.resolve(toplevel) !== path.resolve(cwd)) {
      return null;
    }
  } catch {
    return null;
  }

  // Stage everything and commit
  try {
    execSync("git add -A", { cwd, stdio: "ignore", timeout: 10000 });
    const commitResult = execSync('git commit --allow-empty -m "checkpoint"', {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    });
    const match = commitResult.match(/^\[[^\s]*\s+([a-f0-9]+)\]/m);
    return match?.[1] ?? null;
  } catch {
    // If nothing to commit (clean working tree), get current HEAD
    try {
      const head = execSync("git rev-parse --short HEAD", {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5000,
      });
      return head.trim() || null;
    } catch {
      return null;
    }
  }
}

/**
 * Revert the generated project workspace to a specific git commit.
 * Only operates on the project's own git repo — refuses to run if
 * the workspace is inside a parent git repo (e.g. AppLoop).
 */
export async function revertToFileSnapshot(projectId: string, commitHash: string): Promise<boolean> {
  const overview = await getProjectRepository().findProjectOverviewById(projectId);

  if (!overview) return false;

  const cwd = overview.project.workspacePath;
  const gitDir = path.join(cwd, ".git");

  // Guard: must have its own git repo
  try {
    await fs.access(gitDir);
  } catch {
    return false;
  }

  // Guard: git must be rooted at the workspace, not a parent
  try {
    const toplevel = execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();

    if (path.resolve(toplevel) !== path.resolve(cwd)) {
      return false;
    }
  } catch {
    return false;
  }

  // Guard: commit must exist in this repo
  try {
    execSync(`git cat-file -e ${commitHash}`, { cwd, stdio: "ignore", timeout: 5000 });
  } catch {
    return false;
  }

  try {
    execSync(`git reset --hard ${commitHash}`, { cwd, stdio: "ignore", timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function initProjectGit(workspacePath: string) {
  const ignoreContent = [
    "node_modules/",
    ".next/",
    ".turbo/",
    "dist/",
    "out/",
    "logs/",
    ".apploop/",
  ].join("\n");

  execSync("git init", { cwd: workspacePath, stdio: "ignore", timeout: 10000 });
  await fs.writeFile(path.join(workspacePath, ".gitignore"), `${ignoreContent}\n`, "utf-8");
  execSync("git add -A && git commit -m init --allow-empty", { cwd: workspacePath, stdio: "ignore", timeout: 10000 });
}