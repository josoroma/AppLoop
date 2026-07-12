import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideRoot } from "@/lib/security/paths";
import { buildGeneratedAppStylesheet, type ProjectTheme } from "@/lib/themes/registry";

export async function applyThemeToWorkspace(workspacePath: string, theme: ProjectTheme) {
  const globalsPath = assertInsideRoot(workspacePath, path.join(workspacePath, "app", "globals.css"));
  const currentCss = await readExistingCss(globalsPath);

  await fs.writeFile(globalsPath, currentCss ? replaceThemeTokenBlocks(currentCss, theme.css) : buildGeneratedAppStylesheet(theme), "utf8");

  return globalsPath;
}

async function readExistingCss(globalsPath: string) {
  try {
    return await fs.readFile(globalsPath, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function replaceThemeTokenBlocks(currentCss: string, themeCss: string) {
  return replaceTokenBlock(replaceTokenBlock(currentCss, themeCss, ":root"), themeCss, ".dark");
}

function replaceTokenBlock(currentCss: string, themeCss: string, selector: ":root" | ".dark") {
  const replacement = extractTokenBlock(themeCss, selector);
  const blockPattern = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[\\s\\S]*?\\}`);

  if (!blockPattern.test(currentCss)) {
    return `${replacement}\n\n${currentCss}`;
  }

  return currentCss.replace(blockPattern, replacement);
}

function extractTokenBlock(themeCss: string, selector: ":root" | ".dark") {
  const blockPattern = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[\\s\\S]*?\\}`);
  const match = themeCss.match(blockPattern);

  if (!match) {
    throw new Error(`Theme CSS is missing ${selector}.`);
  }

  return match[0];
}