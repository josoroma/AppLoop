import { describe, expect, it } from "vitest";
import { HermesError } from "@/lib/hermes/errors";
import { normalizeHermesEvent, parseHermesSseStream } from "@/lib/hermes/events";

function sseStream(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

async function collectEvents(stream: ReadableStream<Uint8Array>) {
  const events = [];

  for await (const event of parseHermesSseStream(stream)) {
    events.push(event);
  }

  return events;
}

describe("E17 Hermes event adaptation", () => {
  it("parses assistant text deltas and tool events as structured events", () => {
    expect(normalizeHermesEvent({ type: "assistant.delta", delta: "Hello" })).toEqual({ type: "text-delta", text: "Hello" });
    expect(normalizeHermesEvent({ type: "tool.start", tool: "read_file" })).toEqual({
      type: "activity",
      activity: { kind: "tool-start", title: "Running read_file", status: "running" },
    });
    expect(normalizeHermesEvent({ type: "tool.complete", tool: "read_file", status: "succeeded" })).toEqual({
      type: "activity",
      activity: { kind: "tool-complete", title: "Completed read_file", status: "succeeded" },
    });
    expect(normalizeHermesEvent({ event: "run.failed", run_id: "run-1", error: "Provider rejected the request." })).toEqual({
      type: "error",
      message: "Provider rejected the request.",
    });
  });

  it("maps malformed events and invalid JSON to Hermes errors", async () => {
    expect(() => normalizeHermesEvent({ type: "run.started" })).toThrow(HermesError);
    await expect(collectEvents(sseStream(["data: {bad json}\n\n"]))).rejects.toThrow("invalid stream JSON");
  });

  it("adapts Hermes gateway status envelopes without failing the stream", async () => {
    expect(normalizeHermesEvent({ run_id: "run-1", status: "running" })).toEqual({ type: "run", runId: "run-1" });
    expect(normalizeHermesEvent({ run_id: "run-1", status: "completed" })).toEqual({ type: "done" });
    expect(normalizeHermesEvent({ payload: { type: "assistant.message", content: "Done" } })).toEqual({ type: "text-delta", text: "Done" });
    expect(normalizeHermesEvent({ type: "assistant.message", content: [{ text: "Header nav added." }] })).toEqual({ type: "text-delta", text: "Header nav added." });
    expect(normalizeHermesEvent({ type: "run.failed", error: { message: "Provider rejected the request." } })).toEqual({
      type: "error",
      message: "Provider rejected the request.",
    });
    expect(normalizeHermesEvent({ event: "tool.complete", tool_name: "terminal", status: "completed" })).toEqual({
      type: "activity",
      activity: { kind: "tool-complete", title: "Completed terminal", status: "succeeded" },
    });
  });

  it("uses SSE event names and plain text data when Hermes omits JSON types", async () => {
    await expect(collectEvents(sseStream(['event: run.status\ndata: {"run_id":"run-1","status":"running"}\n\n', "event: message\ndata: Working\n\n"]))).resolves.toEqual([
      { type: "run", runId: "run-1" },
      { type: "text-delta", text: "Working" },
    ]);
  });

  it("parses batched Hermes SSE event arrays", async () => {
    await expect(collectEvents(sseStream(['data: [{"type":"text.delta","delta":"Hi"},{"type":"done"}]\n\n']))).resolves.toEqual([
      { type: "text-delta", text: "Hi" },
      { type: "done" },
    ]);
  });

  it("parses stream completion with and without trailing delimiters", async () => {
    await expect(collectEvents(sseStream(['data: {"type":"text.delta","delta":"Hi"}\n\n', 'data: {"type":"done"}']))).resolves.toEqual([
      { type: "text-delta", text: "Hi" },
      { type: "done" },
    ]);
  });
});