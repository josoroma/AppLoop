import { getServerEnv } from "@/lib/env/server";
import { LocalProcessRuntimeProvider } from "@/lib/runtime/local-process";
import { RuntimeService } from "@/lib/runtime/service";
import { getProjectRepository } from "@/lib/projects/store";

let runtimeProvider: LocalProcessRuntimeProvider | null = null;
let runtimeService: RuntimeService | null = null;

export function getRuntimeProvider() {
  if (!runtimeProvider) {
    runtimeProvider = new LocalProcessRuntimeProvider(async (event) => {
      await getRuntimeService().markProjectRuntimeFailed(event.projectId, event.exitCode, event.exitSignal);
    });
  }

  return runtimeProvider;
}

export function getRuntimeService() {
  if (!runtimeService) {
    runtimeService = new RuntimeService(getProjectRepository(), getRuntimeProvider(), getServerEnv().RUNTIME_TIMEOUT_MS, {
      start: getServerEnv().PREVIEW_PORT_START,
      end: getServerEnv().PREVIEW_PORT_END,
    });
  }

  return runtimeService;
}