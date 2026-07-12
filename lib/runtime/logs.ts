import { recordStructuredEvent } from "@/lib/observability/events";

export type RuntimeLogStream = "stdout" | "stderr" | "lifecycle";

export type RuntimeLogEntry = {
  projectId: string;
  stream: RuntimeLogStream;
  message: string;
  timestamp: string;
};

type RuntimeLogSubscriber = (entry: RuntimeLogEntry) => void;

export class RuntimeLogBuffer {
  private readonly entriesByProject = new Map<string, RuntimeLogEntry[]>();

  constructor(private readonly maxEntriesPerProject = 200) {}

  append(entry: RuntimeLogEntry) {
    const entries = this.entriesByProject.get(entry.projectId) ?? [];
    entries.push({ ...entry, message: redactRuntimeLogMessage(entry.message) });

    if (entries.length > this.maxEntriesPerProject) {
      entries.splice(0, entries.length - this.maxEntriesPerProject);
    }

    this.entriesByProject.set(entry.projectId, entries);
  }

  list(projectId: string) {
    return [...(this.entriesByProject.get(projectId) ?? [])];
  }

  clear(projectId: string) {
    this.entriesByProject.delete(projectId);
  }
}

const runtimeLogBuffer = new RuntimeLogBuffer();
const subscribersByProject = new Map<string, Set<RuntimeLogSubscriber>>();

export function appendRuntimeLog(projectId: string, stream: RuntimeLogStream, message: string) {
  const redactedMessage = redactRuntimeLogMessage(message);
  const entry: RuntimeLogEntry = {
    projectId,
    stream,
    message: redactedMessage,
    timestamp: new Date().toISOString(),
  };

  runtimeLogBuffer.append(entry);
  recordStructuredEvent({
    correlationId: `runtime:${projectId}`,
    projectId,
    source: "runtime",
    action: "log",
    status: stream === "stderr" ? "warning" : "running",
    detail: { stream, message: redactedMessage },
  });

  for (const subscriber of subscribersByProject.get(projectId) ?? []) {
    subscriber(entry);
  }
}

export function getRuntimeLogs(projectId: string) {
  return runtimeLogBuffer.list(projectId);
}

export function clearRuntimeLogs(projectId: string) {
  runtimeLogBuffer.clear(projectId);
}

export function subscribeRuntimeLogs(projectId: string, subscriber: RuntimeLogSubscriber) {
  const subscribers = subscribersByProject.get(projectId) ?? new Set<RuntimeLogSubscriber>();
  subscribers.add(subscriber);
  subscribersByProject.set(projectId, subscribers);

  return () => {
    subscribers.delete(subscriber);

    if (subscribers.size === 0) {
      subscribersByProject.delete(projectId);
    }
  };
}

export function redactRuntimeLogMessage(message: string) {
  return message
    .replace(/(HERMES_API_KEY=)[^\s]+/gi, "$1[redacted]")
    .replace(/(api[_-]?key[=:]\s*)[^\s]+/gi, "$1[redacted]")
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[redacted]");
}