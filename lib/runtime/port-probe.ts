import net from "node:net";
import { assertPreviewPort, DEFAULT_PREVIEW_PORT_RANGE, isBuilderPort, type PreviewPortRange } from "@/lib/runtime/ports";

export async function isPortAvailable(port: number, host = "127.0.0.1") {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function findAvailablePreviewPort(
  usedPorts: number[],
  range: PreviewPortRange = DEFAULT_PREVIEW_PORT_RANGE,
  checkPort = isPortAvailable,
) {
  const usedPortSet = new Set(usedPorts);

  for (let port = range.start; port <= range.end; port += 1) {
    if (isBuilderPort(port) || usedPortSet.has(port)) {
      continue;
    }

    if (await checkPort(port)) {
      return assertPreviewPort(port, range);
    }
  }

  throw new Error(`No available preview ports found in range ${range.start}-${range.end}.`);
}