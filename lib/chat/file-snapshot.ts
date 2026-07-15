"use server";

import { execSync } from "node:child_process";
import { getProjectRepository } from "@/lib/projects/store";

/**
 * Create a git snapshot (commit) in the generated project workspace.
 * Returns the commit hash, or null if git isn't available.
 */
export async function createFileSnapshot(projectId: string): Promise<string | null> {
  const overview = await getProjectRepository().findProjectOverviewById(projectId);

  if (!overview) return null;

  const cwd = overview.project.workspacePath;

  try {
    // Initialize git if needed
    execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "ignore", timeout: 5000 });
  } catch {
    try {
      execSync("git init && git add -A && git commit -m init --allow-empty", { cwd, stdio: "ignore", timeout: 10000 });
    } catch {
      return null;
    }
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
 * Discards all uncommitted changes.
 */
export async function revertToFileSnapshot(projectId: string, commitHash: string): Promise<boolean> {
  const overview = await getProjectRepository().findProjectOverviewById(projectId);

  if (!overview) return false;

  const cwd = overview.project.workspacePath;

  try {
    execSync(`git reset --hard ${commitHash}`, { cwd, stdio: "ignore", timeout: 15000 });
    execSync("git clean -fd", { cwd, stdio: "ignore", timeout: 10000 });

    return true;
  } catch {
    return false;
  }
}