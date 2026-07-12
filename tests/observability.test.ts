import { describe, expect, it, beforeEach } from "vitest";
import { GET as exportDiagnostics } from "@/app/api/diagnostics/export/route";
import { HermesError } from "@/lib/hermes/errors";
import {
  categorizeFailure,
  clearStructuredEvents,
  createCorrelationId,
  getDiagnosticsExport,
  recordStructuredEvent,
} from "@/lib/observability/events";
import { appendRuntimeLog, getRuntimeLogs } from "@/lib/runtime/logs";

describe("E17 structured observability", () => {
  beforeEach(() => clearStructuredEvents());

  it("records correlated structured events with duration and failure categories", () => {
    const correlationId = createCorrelationId("test");

    recordStructuredEvent({ correlationId, projectId: "project-1", runId: "run-1", source: "chat", action: "request", status: "started" });
    recordStructuredEvent({
      correlationId,
      projectId: "project-1",
      runId: "run-1",
      hermesRunId: "hermes-1",
      source: "hermes",
      action: "run",
      status: "succeeded",
      durationMs: 25,
    });

    expect(categorizeFailure(new HermesError("authentication", "bad"))).toBe("hermes:authentication");
    expect(getDiagnosticsExport({ correlationId })).toMatchObject({
      eventCount: 2,
      summaries: [{ correlationId, projectId: "project-1", runId: "run-1", durationMs: 25 }],
    });
  });

  it("adds runtime log context without leaking secrets", () => {
    appendRuntimeLog("project-1", "stderr", "HERMES_API_KEY=secret failed");

    expect(getRuntimeLogs("project-1")[0]?.message).toBe("HERMES_API_KEY=[redacted] failed");
    expect(getDiagnosticsExport({ projectId: "project-1" }).events[0]).toMatchObject({
      correlationId: "runtime:project-1",
      source: "runtime",
      action: "log",
      status: "warning",
    });
  });

  it("exports local diagnostics as no-store JSON", async () => {
    recordStructuredEvent({ correlationId: "trace-1", projectId: "project-1", source: "diagnostics", action: "export", status: "succeeded" });

    const response = await exportDiagnostics(new Request("http://127.0.0.1:3001/api/diagnostics/export?projectId=project-1"));
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.eventCount).toBe(1);
  });
});