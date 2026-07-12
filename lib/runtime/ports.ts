import { BUILDER_PORT } from "@/lib/env/schema";

export { BUILDER_PORT };

export type PreviewPortRange = {
  start: number;
  end: number;
};

export const DEFAULT_PREVIEW_PORT_RANGE: PreviewPortRange = {
  start: 3100,
  end: 3199,
};

export function isBuilderPort(port: number) {
  return port === BUILDER_PORT;
}

export function isPortInRange(port: number, range: PreviewPortRange) {
  return range.start <= port && port <= range.end;
}

export function assertPreviewPort(port: number, range: PreviewPortRange = DEFAULT_PREVIEW_PORT_RANGE) {
  if (!Number.isInteger(port)) {
    throw new Error("Preview port must be an integer.");
  }

  if (isBuilderPort(port)) {
    throw new Error("Preview port must not use the builder port 3001.");
  }

  if (!isPortInRange(port, range)) {
    throw new Error(`Preview port ${port} is outside the configured range ${range.start}-${range.end}.`);
  }

  return port;
}