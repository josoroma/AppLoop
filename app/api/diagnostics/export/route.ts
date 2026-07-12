import { getDiagnosticsExport } from "@/lib/observability/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const correlationId = url.searchParams.get("correlationId") ?? undefined;

  return Response.json(getDiagnosticsExport({ projectId, correlationId }), {
    headers: {
      "cache-control": "no-store",
    },
  });
}