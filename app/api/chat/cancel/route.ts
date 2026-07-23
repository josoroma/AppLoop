import { clearActiveHermesRun, getActiveHermesRun } from "@/lib/chat/run-store";
import { getHermesClient } from "@/lib/hermes/store";
import { getProjectRepository } from "@/lib/projects/store";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { projectId } = (await request.json()) as { projectId?: string };

  if (!projectId) {
    return new Response("Missing project id.", { status: 400 });
  }

  const access = await requireProjectAccess(getProjectRepository(), projectId).catch(projectAccessErrorResponse);

  if (access instanceof Response) {
    return access;
  }

  const activeRun = getActiveHermesRun(projectId);

  if (activeRun) {
    if (activeRun.hermesRunId) {
      const hermesClient = await getHermesClient();
      await hermesClient.cancelRun(activeRun.hermesRunId, request.signal);
    }

    await getProjectRepository().updateRun(activeRun.runId, { status: "cancelled", finishedAt: new Date() });
    clearActiveHermesRun(projectId);
  }

  return Response.json({ cancelled: Boolean(activeRun) });
}