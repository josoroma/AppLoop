import { HermesError } from "@/lib/hermes/errors";
import { normalizeHermesEvent, parseHermesSseStream, type HermesStreamEvent } from "@/lib/hermes/events";
import type { ProjectAgentBundle } from "@/lib/hermes/agents";

export type HermesTransport = "rest" | "websocket";

export type HermesClientConfig = {
  baseUrl: string;
  apiKey: string;
  transport: HermesTransport;
  gatewayIntegration?: string;
  inferenceModel?: string;
  inferenceProvider?: string;
};

export type HermesRunRequest = {
  projectId: string;
  conversationId: string;
  message: string;
  workspacePath: string;
  sessionId: string | null;
  agentBundle: ProjectAgentBundle;
  signal?: AbortSignal;
};

export class HermesClient {
  constructor(private readonly config: HermesClientConfig) {}

  async health(signal?: AbortSignal) {
    const response = await fetch(new URL("/health", this.config.baseUrl), {
      headers: this.authHeaders(),
      signal,
    });

    if (!response.ok) {
      throw mapHermesHttpError(response.status, "Hermes health check failed.");
    }
  }

  streamProjectRun(request: HermesRunRequest): AsyncIterable<HermesStreamEvent> {
    if (this.config.transport === "websocket") {
      return this.streamProjectRunWithWebSocket(request);
    }

    return this.streamProjectRunWithRest(request);
  }

  async cancelRun(runId: string, signal?: AbortSignal) {
    const response = await fetch(new URL(`/v1/runs/${encodeURIComponent(runId)}/cancel`, this.config.baseUrl), {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      signal,
    });

    if (!response.ok && response.status !== 404) {
      throw mapHermesHttpError(response.status, "Hermes run cancellation failed.");
    }
  }

  private async *streamProjectRunWithRest(request: HermesRunRequest): AsyncIterable<HermesStreamEvent> {
    const response = await fetch(new URL("/v1/runs/stream", this.config.baseUrl), {
      method: "POST",
      headers: this.authHeaders({ Accept: "text/event-stream", "Content-Type": "application/json" }),
      body: JSON.stringify(this.streamRunPayload(request)),
      signal: request.signal,
    });

    if (response.status === 404 || response.status === 405) {
      yield* this.streamProjectRunWithGatewayEvents(request);
      return;
    }

    if (!response.ok) {
      throw mapHermesHttpError(response.status, "Hermes run failed to start.");
    }

    if (!response.body) {
      throw new HermesError("unavailable", "Hermes stream did not include a response body.");
    }

    yield* parseHermesSseStream(response.body);
  }

  private async *streamProjectRunWithGatewayEvents(request: HermesRunRequest): AsyncIterable<HermesStreamEvent> {
    const startResponse = await fetch(new URL("/v1/runs", this.config.baseUrl), {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(this.gatewayRunPayload(request)),
      signal: request.signal,
    });

    if (!startResponse.ok) {
      throw mapHermesHttpError(startResponse.status, "Hermes gateway run failed to start.");
    }

    const runId = await readGatewayRunId(startResponse);
    yield { type: "run", runId };

    const eventsResponse = await fetch(new URL(`/v1/runs/${encodeURIComponent(runId)}/events`, this.config.baseUrl), {
      headers: this.authHeaders({ Accept: "text/event-stream" }),
      signal: request.signal,
    });

    if (!eventsResponse.ok) {
      throw mapHermesHttpError(eventsResponse.status, "Hermes gateway event stream failed.");
    }

    if (!eventsResponse.body) {
      throw new HermesError("unavailable", "Hermes gateway event stream did not include a response body.");
    }

    yield* parseHermesSseStream(eventsResponse.body);
  }

  private streamProjectRunWithWebSocket(request: HermesRunRequest): AsyncIterable<HermesStreamEvent> {
    const url = new URL("/v1/runs/stream", this.config.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("authorization", `Bearer ${this.config.apiKey}`);

    return {
      [Symbol.asyncIterator]: () => {
        const pendingEvents: HermesStreamEvent[] = [];
        const pendingResolvers: Array<(result: IteratorResult<HermesStreamEvent>) => void> = [];
        let done = false;
        let streamError: unknown = null;
        const socket = new WebSocket(url);

        const resolveNext = (result: IteratorResult<HermesStreamEvent>) => {
          const resolver = pendingResolvers.shift();

          if (resolver) {
            resolver(result);
          } else if (!result.done) {
            pendingEvents.push(result.value);
          }
        };

        socket.addEventListener("open", () => {
          socket.send(
            JSON.stringify({
              projectId: request.projectId,
              conversationId: request.conversationId,
              message: request.message,
              workspacePath: request.workspacePath,
              sessionId: request.sessionId,
              gatewayIntegration: this.config.gatewayIntegration,
              model: this.config.inferenceModel,
              agentBundle: request.agentBundle,
            }),
          );
        });
        socket.addEventListener("message", (event) => {
          const normalized = normalizeHermesEvent(JSON.parse(String(event.data)));

          if (normalized) {
            resolveNext({ done: false, value: normalized });
          }
        });
        socket.addEventListener("close", () => {
          done = true;
          resolveNext({ done: true, value: undefined });
        });
        socket.addEventListener("error", () => {
          streamError = new HermesError("unavailable", "Hermes WebSocket stream failed.");
          done = true;
          resolveNext({ done: true, value: undefined });
        });
        request.signal?.addEventListener("abort", () => {
          socket.close();
        });

        return {
          next() {
            if (streamError) {
              return Promise.reject(streamError);
            }

            const event = pendingEvents.shift();

            if (event) {
              return Promise.resolve({ done: false, value: event });
            }

            if (done) {
              return Promise.resolve({ done: true, value: undefined });
            }

            return new Promise<IteratorResult<HermesStreamEvent>>((resolve) => pendingResolvers.push(resolve));
          },
        };
      },
    };
  }

  private authHeaders(extraHeaders: Record<string, string> = {}) {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      ...extraHeaders,
    };
  }

  private streamRunPayload(request: HermesRunRequest) {
    return {
      projectId: request.projectId,
      conversationId: request.conversationId,
      message: request.message,
      input: request.message,
      workspacePath: request.workspacePath,
      sessionId: request.sessionId,
      session_id: request.sessionId,
      gatewayIntegration: this.config.gatewayIntegration,
      model: this.config.inferenceModel,
      agentBundle: request.agentBundle,
    };
  }

  private gatewayRunPayload(request: HermesRunRequest) {
    return {
      input: request.message,
      instructions: createGatewayInstructions(request),
      model: this.config.inferenceModel,
      session_id: request.sessionId ?? undefined,
      metadata: {
        projectId: request.projectId,
        conversationId: request.conversationId,
        workspacePath: request.workspacePath,
        gatewayIntegration: this.config.gatewayIntegration,
        inferenceModel: this.config.inferenceModel,
        inferenceProvider: this.config.inferenceProvider,
        agentBundle: request.agentBundle,
      },
    };
  }
}

async function readGatewayRunId(response: Response) {
  const body = (await response.json()) as { run_id?: unknown; runId?: unknown };
  const runId = typeof body.run_id === "string" ? body.run_id : typeof body.runId === "string" ? body.runId : null;

  if (!runId) {
    throw new HermesError("malformed-event", "Hermes gateway run response did not include a run id.");
  }

  return runId;
}

function createGatewayInstructions(request: HermesRunRequest) {
  return [
    "You are the AppLoop project builder for a local generated Next.js workspace.",
    `Project ID: ${request.projectId}`,
    `Workspace path: ${request.workspacePath}`,
    `Default route: ${request.agentBundle.projectContext.defaultRoute}`,
    `Selected theme: ${request.agentBundle.projectContext.selectedThemeId}`,
    `Package install policy: ${request.agentBundle.projectContext.packageInstallPolicy}`,
    `Validation depth: ${request.agentBundle.projectContext.validationDepth}`,
    "Use the provided AppLoop agent bundle metadata to plan, edit, validate, and report observable activity. Do not reveal private reasoning.",
  ].join("\n");
}

function mapHermesHttpError(status: number, fallbackMessage: string) {
  if (status === 401 || status === 403) {
    return new HermesError("authentication", "Hermes authentication failed.", status);
  }

  return new HermesError("unavailable", fallbackMessage, status);
}