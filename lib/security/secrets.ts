import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideRoot } from "@/lib/security/paths";

export type SecretScanFinding = {
  relativePath: string;
  pattern: string;
};

const SECRET_PATTERNS = [
  { name: "hermes-api-key", pattern: /HERMES_API_KEY\s*[:=]\s*[^\s'";]+/i },
  { name: "public-hermes-env", pattern: /NEXT_PUBLIC_HERMES_[A-Z0-9_]+/i },
  { name: "bearer-token", pattern: /authorization\s*[:=]\s*bearer\s+[^\s'";]+/i },
  { name: "generic-secret", pattern: /(password|secret|token)\s*[:=]\s*[^\s'";]+/i },
];

const SECRET_SCAN_EXCLUDED_SEGMENTS = new Set(["node_modules", ".next", ".turbo", "dist", "out", "logs", ".git"]);
const SECRET_SCAN_EXTENSIONS = new Set([".env", ".local", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mjs", ".css"]);

export function assertNoPublicHermesEnvironment(source: NodeJS.ProcessEnv) {
  const publicHermesKey = Object.keys(source).find((key) => key.startsWith("NEXT_PUBLIC_HERMES_"));

  if (publicHermesKey) {
    throw new Error(`${publicHermesKey} is not allowed. Hermes configuration must stay server-side.`);
  }
}

export function scanTextForSecrets(relativePath: string, text: string): SecretScanFinding[] {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => ({ relativePath, pattern: name }));
}

export async function scanWorkspaceForSecrets(workspacePath: string) {
  const files = await listSecretScannableFiles(workspacePath);
  const findings = await Promise.all(
    files.map(async (relativePath) => scanTextForSecrets(relativePath, await fs.readFile(assertInsideRoot(workspacePath, path.join(workspacePath, relativePath)), "utf8"))),
  );

  return findings.flat();
}

async function listSecretScannableFiles(workspacePath: string, directory = workspacePath): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      const relativePath = path.relative(workspacePath, entryPath);

      if (relativePath.split(path.sep).some((segment) => SECRET_SCAN_EXCLUDED_SEGMENTS.has(segment))) {
        return [];
      }

      if (entry.isDirectory()) {
        return listSecretScannableFiles(workspacePath, entryPath);
      }

      const extension = path.extname(entry.name) || entry.name;

      return SECRET_SCAN_EXTENSIONS.has(extension) ? [relativePath.split(path.sep).join(path.posix.sep)] : [];
    }),
  );

  return files.flat();
}