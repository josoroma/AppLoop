import { getRuntimeLogs, subscribeRuntimeLogs } from "@/lib/runtime/logs";
import { getProjectRepository } from "@/lib/projects/store";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";

export const dynamic = "force-dynamic";

type RuntimeLogsRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(request: Request, { params }: RuntimeLogsRouteProps) {
  const { projectId } = await params;
  const access = await requireProjectAccess(getProjectRepository(), projectId).catch(projectAccessErrorResponse);

  if (access instanceof Response) {
    return access;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (entry: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
      };

      getRuntimeLogs(projectId).forEach(send);
      const unsubscribe = subscribeRuntimeLogs(projectId, send);
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}