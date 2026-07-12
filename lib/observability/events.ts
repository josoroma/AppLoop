import { randomUUID } from "node:crypto";
import { HermesError } from "@/lib/hermes/errors";

export type ObservabilitySource = "chat" | "hermes" | "files" | "validation" | "runtime" | "preview" | "diagnostics";
export type ObservabilityStatus = "started" | "running" | "succeeded" | "failed" | "cancelled" | "warning";

export type StructuredObservabilityEvent = {
  id: string;
  timestamp: string;
  correlationId: string;
  source: ObservabilitySource;
  action: string;
  status: ObservabilityStatus;
  projectId?: string;
  runId?: string;
  hermesRunId?: string | null;
  durationMs?: number;
  failureCategory?: string;
  detail?: Record<string, unknown>;
};

export type DiagnosticsExport = {
  generatedAt: string;
  eventCount: number;
  events: StructuredObservabilityEvent[];
  summaries: Array<{
    correlationId: string;
    projectId?: string;
    runId?: string;
    statuses: ObservabilityStatus[];
    sources: ObservabilitySource[];
    durationMs: number;
  }>;
};

const structuredEventBuffer = new Map<string, StructuredObservabilityEvent[]>();
const MAX_EVENTS_PER_CORRELATION = 120;

export function createCorrelationId(prefix = "trace") {
  return `${prefix}:${randomUUID()}`;
}

export function startDurationTimer() {
  return Date.now();
}

export function getDurationMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

export function recordStructuredEvent(input: Omit<StructuredObservabilityEvent, "id" | "timestamp">) {
  const event: StructuredObservabilityEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...input,
  };
  const events = structuredEventBuffer.get(event.correlationId) ?? [];
  events.push(event);

  if (events.length > MAX_EVENTS_PER_CORRELATION) {
    events.splice(0, events.length - MAX_EVENTS_PER_CORRELATION);
  }

  structuredEventBuffer.set(event.correlationId, events);
  writeStructuredServerLog(event);

  return event;
}

export function getDiagnosticsExport(options: { projectId?: string; correlationId?: string } = {}): DiagnosticsExport {
  const events = Array.from(structuredEventBuffer.values())
    .flat()
    .filter((event) => !options.projectId || event.projectId === options.projectId)
    .filter((event) => !options.correlationId || event.correlationId === options.correlationId)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return {
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    events,
    summaries: summarizeEvents(events),
  };
}

export function clearStructuredEvents() {
  structuredEventBuffer.clear();
}

export function categorizeFailure(error: unknown) {
  if (error instanceof HermesError) {
    return `hermes:${error.code}`;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "interrupted";
  }

  if (error instanceof Error) {
    return error.name || "error";
  }

  return "unknown";
}

function summarizeEvents(events: StructuredObservabilityEvent[]): DiagnosticsExport["summaries"] {
  const byCorrelation = new Map<string, StructuredObservabilityEvent[]>();

  for (const event of events) {
    byCorrelation.set(event.correlationId, [...(byCorrelation.get(event.correlationId) ?? []), event]);
  }

  return Array.from(byCorrelation.entries()).map(([correlationId, correlationEvents]) => {
    const first = correlationEvents[0];
    const durationMs = correlationEvents.reduce((duration, event) => Math.max(duration, event.durationMs ?? 0), 0);

    return {
      correlationId,
      projectId: first?.projectId,
      runId: first?.runId,
      statuses: Array.from(new Set(correlationEvents.map((event) => event.status))),
      sources: Array.from(new Set(correlationEvents.map((event) => event.source))),
      durationMs,
    };
  });
}

function writeStructuredServerLog(event: StructuredObservabilityEvent) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info(JSON.stringify({ type: "apploop.observability", ...event }));
}