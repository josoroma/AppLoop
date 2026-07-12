import { z } from "zod";
import { HermesError } from "@/lib/hermes/errors";

export type HermesActivityKind = "tool-start" | "tool-complete" | "file-change" | "command" | "preview-ready";

export type HermesActivity = {
  kind: HermesActivityKind;
  title: string;
  detail?: string;
  status?: "running" | "succeeded" | "failed";
};

export type HermesStreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "run"; runId: string }
  | { type: "text-delta"; text: string }
  | { type: "activity"; activity: HermesActivity }
  | { type: "done" }
  | { type: "error"; message: string };

const hermesRawEventSchema = z.object({
  type: z.unknown().optional(),
  event: z.unknown().optional(),
  sessionId: z.unknown().optional(),
  session_id: z.unknown().optional(),
  runId: z.unknown().optional(),
  run_id: z.unknown().optional(),
  delta: z.unknown().optional(),
  text: z.unknown().optional(),
  content: z.unknown().optional(),
  output: z.unknown().optional(),
  result: z.unknown().optional(),
  response: z.unknown().optional(),
  message: z.unknown().optional(),
  error: z.unknown().optional(),
  tool: z.unknown().optional(),
  tool_name: z.unknown().optional(),
  command: z.unknown().optional(),
  path: z.unknown().optional(),
  status: z.unknown().optional(),
  url: z.unknown().optional(),
  data: z.unknown().optional(),
  payload: z.unknown().optional(),
});

export function normalizeHermesEvent(value: unknown): HermesStreamEvent | null {
  const result = hermesRawEventSchema.safeParse(unwrapHermesEvent(value));

  if (!result.success) {
    throw new HermesError("malformed-event", "Hermes emitted a malformed stream event.");
  }

  const event = result.data;
  const eventType = getString(event.type) ?? getString(event.event);

  if (!eventType) {
    return normalizeHermesStatusEvent(event);
  }

  if (eventType === "session" || eventType === "session.created") {
    const sessionId = getString(event.sessionId) ?? getString(event.session_id);

    if (!sessionId) {
      throw new HermesError("malformed-event", "Hermes session event did not include a session id.");
    }

    return { type: "session", sessionId };
  }

  if (eventType === "run" || eventType === "run.created" || eventType === "run.started") {
    const runId = getString(event.runId) ?? getString(event.run_id);

    if (!runId) {
      throw new HermesError("malformed-event", "Hermes run event did not include a run id.");
    }

    return { type: "run", runId };
  }

  if (eventType === "text" || eventType === "text.delta" || eventType === "assistant.delta" || eventType === "message.delta" || eventType === "output.delta") {
    return { type: "text-delta", text: getEventText(event) };
  }

  if (eventType === "tool.start") {
    return {
      type: "activity",
      activity: { kind: "tool-start", title: `Running ${getString(event.tool) ?? getString(event.tool_name) ?? "tool"}`, status: "running" },
    };
  }

  if (eventType === "tool.complete") {
    return {
      type: "activity",
      activity: { kind: "tool-complete", title: `Completed ${getString(event.tool) ?? getString(event.tool_name) ?? "tool"}`, status: normalizeActivityStatus(event.status) ?? "succeeded" },
    };
  }

  if (eventType === "file.change" || eventType === "file.edited") {
    return {
      type: "activity",
      activity: { kind: "file-change", title: `Editing ${getString(event.path) ?? "file"}`, detail: getString(event.path) },
    };
  }

  if (eventType === "command.start" || eventType === "command.complete") {
    return {
      type: "activity",
      activity: {
        kind: "command",
        title: getString(event.command) ?? "Command",
        status: normalizeActivityStatus(event.status) ?? (eventType === "command.start" ? "running" : "succeeded"),
      },
    };
  }

  if (eventType === "preview.ready") {
    return {
      type: "activity",
      activity: { kind: "preview-ready", title: "Preview ready", detail: getString(event.url) },
    };
  }

  if (eventType === "done" || eventType === "complete" || eventType === "run.completed") {
    return { type: "done" };
  }

  if (eventType === "error" || eventType === "run.failed" || eventType === "failed") {
    return { type: "error", message: getEventErrorText(event) || "Hermes stream failed." };
  }

  if (eventType === "message" || eventType === "assistant.message" || eventType === "output" || eventType === "response") {
    const text = getEventText(event);

    return text ? { type: "text-delta", text } : null;
  }

  if (eventType === "status" || eventType === "run.status") {
    return normalizeHermesStatusEvent(event);
  }

  return null;
}

export async function* parseHermesSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<HermesStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      for (const normalized of parseHermesSseChunk(chunk)) {
        yield normalized;
      }
    }
  }

  if (buffer.trim()) {
    for (const normalized of parseHermesSseChunk(buffer)) {
      yield normalized;
    }
  }
}

function parseHermesSseChunk(chunk: string): HermesStreamEvent[] {
  const eventName = chunk
    .split("\n")
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const dataLines = chunk
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());

  if (dataLines.length === 0 || dataLines[0] === "[DONE]") {
    return [];
  }

  const data = dataLines.join("\n").trim();

  try {
    const parsed = JSON.parse(data) as unknown;
    const values = Array.isArray(parsed) ? parsed : [parsed];

    return values.flatMap((value) => {
      const normalized = normalizeHermesEvent(applySseEventName(value, eventName));

      return normalized ? [normalized] : [];
    });
  } catch (error) {
    if (error instanceof HermesError) {
      throw error;
    }

    if (data && !data.startsWith("{") && !data.startsWith("[")) {
      if (eventName === "error") {
        return [{ type: "error", message: data }];
      }

      return [{ type: "text-delta", text: data }];
    }

    throw new HermesError("malformed-event", "Hermes emitted invalid stream JSON.");
  }
}

function unwrapHermesEvent(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const nested = value.data ?? value.payload;

  if (isRecord(nested) && !hasEventIdentity(value)) {
    return nested;
  }

  return value;
}

function applySseEventName(value: unknown, eventName: string | undefined) {
  if (!eventName || !isRecord(value) || hasEventIdentity(value)) {
    return value;
  }

  return { ...value, event: eventName };
}

function normalizeHermesStatusEvent(event: z.infer<typeof hermesRawEventSchema>): HermesStreamEvent | null {
  const status = getString(event.status)?.toLowerCase();
  const runId = getString(event.runId) ?? getString(event.run_id);
  const sessionId = getString(event.sessionId) ?? getString(event.session_id);
  const text = getEventText(event);

  if (status && ["completed", "complete", "succeeded", "success", "done"].includes(status)) {
    return { type: "done" };
  }

  if (status && ["failed", "failure", "error"].includes(status)) {
    const message = getEventErrorText(event) || text;

    return { type: "error", message: message || "Hermes stream failed." };
  }

  if (sessionId) {
    return { type: "session", sessionId };
  }

  if (runId) {
    return { type: "run", runId };
  }

  if (text) {
    return { type: "text-delta", text };
  }

  return null;
}

function normalizeActivityStatus(statusValue: unknown): HermesActivity["status"] | undefined {
  const status = getString(statusValue)?.toLowerCase();

  if (!status) {
    return undefined;
  }

  if (["running", "started", "queued", "pending", "in_progress", "processing"].includes(status)) {
    return "running";
  }

  if (["succeeded", "success", "completed", "complete", "done"].includes(status)) {
    return "succeeded";
  }

  if (["failed", "failure", "error"].includes(status)) {
    return "failed";
  }

  return undefined;
}

function getEventText(event: z.infer<typeof hermesRawEventSchema>) {
  return getString(event.delta) ?? getString(event.text) ?? getString(event.content) ?? getString(event.output) ?? getString(event.result) ?? getString(event.response) ?? "";
}

function getEventErrorText(event: z.infer<typeof hermesRawEventSchema>) {
  return getString(event.error) ?? getString(event.message);
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const text = value.map(getString).filter(Boolean).join("\n");

    return text || undefined;
  }

  if (isRecord(value)) {
    return getString(value.text) ?? getString(value.content) ?? getString(value.message) ?? getString(value.error);
  }

  return undefined;
}

function hasEventIdentity(value: Record<string, unknown>) {
  return typeof value.type === "string" || typeof value.event === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}