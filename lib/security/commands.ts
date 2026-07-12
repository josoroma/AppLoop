export type CommandReview = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
};

const DEFAULT_COMMAND_TIMEOUT_MS = 120000;
const ALLOWED_ENV_KEYS = new Set(["CI", "HOME", "LANG", "LC_ALL", "NODE_ENV", "PATH", "PWD", "TMPDIR", "USER"]);
const DENIED_COMMAND_PATTERNS = [
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bchmod\s+777\b/i,
  /\bchown\b/i,
  /\brm\s+-rf\s+(\/|~|\.\.|\*)/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bcurl\b.*\|\s*(sh|bash)\b/i,
];

export function reviewProjectCommand(bin: string, args: string[]): CommandReview {
  const commandText = [bin, ...args].join(" ");
  const deniedPattern = DENIED_COMMAND_PATTERNS.find((pattern) => pattern.test(commandText));

  if (deniedPattern) {
    return { allowed: false, requiresApproval: true, reason: `Command matches denied pattern: ${deniedPattern.source}` };
  }

  if (isRootProcess()) {
    return { allowed: false, requiresApproval: false, reason: "Generated project commands must not run as root." };
  }

  return { allowed: true, requiresApproval: false, reason: "Command passed AppLoop safety review." };
}

export function assertProjectCommandAllowed(bin: string, args: string[]) {
  const review = reviewProjectCommand(bin, args);

  if (!review.allowed) {
    throw new Error(review.reason);
  }

  return review;
}

export function createAllowedCommandEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => ALLOWED_ENV_KEYS.has(key) && typeof value === "string")) as NodeJS.ProcessEnv;
}

export function resolveCommandTimeout(timeoutMs: number | undefined) {
  return timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_COMMAND_TIMEOUT_MS;
}

function isRootProcess() {
  return typeof process.getuid === "function" && process.getuid() === 0;
}