import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RuntimeLogBuffer, redactRuntimeLogMessage } from "@/lib/runtime/logs";
import { createInstallCommand, createRuntimeCommand, LocalProcessRuntimeProvider } from "@/lib/runtime/local-process";
import { findAvailablePreviewPort } from "@/lib/runtime/port-probe";
import { mapExitToRuntimeStatus } from "@/lib/runtime/state";

describe("E3 generated project runtime", () => {
  it("selects the next live-available preview port", async () => {
    await expect(
      findAvailablePreviewPort([3100], { start: 3100, end: 3103 }, async (port) => port === 3102),
    ).resolves.toBe(3102);
  });

  it("builds package-manager specific runtime commands", () => {
    expect(createRuntimeCommand("npm", 3100)).toEqual({
      bin: "npm",
      args: ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3100"],
    });
    expect(createRuntimeCommand("pnpm", 3100)).toEqual({
      bin: "pnpm",
      args: ["dev", "--hostname", "127.0.0.1", "--port", "3100"],
    });
    expect(createInstallCommand("npm")).toEqual({ bin: "npm", args: ["install"] });
    expect(createInstallCommand("pnpm")).toEqual({ bin: "pnpm", args: ["install"] });
  });

  it("keeps a bounded per-project log buffer", () => {
    const buffer = new RuntimeLogBuffer(2);

    buffer.append({ projectId: "project-1", stream: "stdout", message: "one", timestamp: "1" });
    buffer.append({ projectId: "project-1", stream: "stdout", message: "two", timestamp: "2" });
    buffer.append({ projectId: "project-1", stream: "stderr", message: "three", timestamp: "3" });

    expect(buffer.list("project-1").map((entry) => entry.message)).toEqual(["two", "three"]);
  });

  it("redacts runtime log secrets", () => {
    expect(redactRuntimeLogMessage("HERMES_API_KEY=secret Authorization: Bearer token")).toBe(
      "HERMES_API_KEY=[redacted] Authorization: Bearer [redacted]",
    );
  });

  it("maps unexpected exits to failed runtime state", () => {
    expect(mapExitToRuntimeStatus(false)).toBe("failed");
    expect(mapExitToRuntimeStatus(true)).toBe("stopped");
  });

  it("starts and stops a local generated runtime process", async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-runtime-"));
    const port = await findAvailablePreviewPort([], { start: 3800, end: 3899 });
    const provider = new LocalProcessRuntimeProvider();

    await fs.writeFile(
      path.join(workspacePath, "package.json"),
      JSON.stringify({ scripts: { dev: "node server.mjs" } }),
    );
    await fs.mkdir(path.join(workspacePath, "node_modules"));
    await fs.writeFile(
      path.join(workspacePath, "server.mjs"),
      `import http from "node:http";
const portIndex = process.argv.indexOf("--port");
const hostIndex = process.argv.indexOf("--hostname");
const port = Number(process.argv[portIndex + 1] || process.env.PORT);
const host = process.argv[hostIndex + 1] || "127.0.0.1";
const server = http.createServer((_request, response) => response.end("ok"));
server.listen(port, host, () => console.log("ready"));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`,
    );

    const descriptor = await provider.start({
      projectId: "runtime-integration",
      workspacePath,
      port,
      timeoutMs: 10000,
    });

    expect(descriptor.status).toBe("running");
    expect(descriptor.pid).toEqual(expect.any(Number));

    const stoppedDescriptor = await provider.stop("runtime-integration");

    expect(stoppedDescriptor.status).toBe("stopped");
    expect(stoppedDescriptor.pid).toBeNull();
  });
});