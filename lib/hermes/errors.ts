export type HermesErrorCode = "configuration" | "unavailable" | "authentication" | "malformed-event" | "interrupted";

export class HermesError extends Error {
  constructor(
    readonly code: HermesErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HermesError";
  }
}

export function mapHermesError(error: unknown) {
  if (error instanceof HermesError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new HermesError("interrupted", "Hermes stream interrupted.");
  }

  if (error instanceof TypeError) {
    return new HermesError("unavailable", "Hermes backend unavailable.");
  }

  if (error instanceof Error && error.message.includes("HERMES_API_KEY")) {
    return new HermesError("configuration", "Hermes API key is not configured.");
  }

  return new HermesError("unavailable", "Hermes backend unavailable.");
}

export function hermesErrorToUserMessage(error: unknown) {
  const hermesError = mapHermesError(error);

  if (hermesError.code === "authentication") {
    return "Hermes authentication failed.";
  }

  if (hermesError.code === "configuration") {
    return "Hermes API key is not configured.";
  }

  if (hermesError.code === "malformed-event") {
    return "Hermes returned an unreadable stream event.";
  }

  if (hermesError.code === "interrupted") {
    return "Hermes stream interrupted.";
  }

  if (hermesError.code === "unavailable" && hermesError.message !== "Hermes backend unavailable.") {
    return hermesError.message;
  }

  return "Hermes backend unavailable.";
}