import { readPresentationAsset } from "@/lib/presentations/files";
import { getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

type AssetRouteProps = {
  params: Promise<{
    presentationId: string;
    assetPath: string[];
  }>;
};

export async function GET(_request: Request, { params }: AssetRouteProps) {
  const { presentationId, assetPath } = await params;
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview || overview.presentation.status === "deleted") {
    return new Response("Presentation not found.", { status: 404 });
  }

  try {
    const asset = await readPresentationAsset(overview.presentation.workspacePath, assetPath.join("/"));
    return new Response(asset.contents, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'none'; sandbox",
        "Content-Type": asset.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Asset not found.", { status: 404 });
  }
}