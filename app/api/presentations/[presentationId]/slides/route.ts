import { getMarpSlideSummaries } from "@/lib/presentations/marp";
import { readPresentationMarkdown } from "@/lib/presentations/files";
import { getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

type SlidesRouteProps = {
  params: Promise<{
    presentationId: string;
  }>;
};

export async function GET(_request: Request, { params }: SlidesRouteProps) {
  const { presentationId } = await params;
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview || overview.presentation.status === "deleted") {
    return Response.json({ error: "Presentation not found." }, { status: 404 });
  }

  try {
    const markdown = await readPresentationMarkdown(
      overview.presentation.workspacePath,
      overview.presentation.sourceFile,
    );
    const slides = getMarpSlideSummaries(markdown);
    return Response.json(
      {
        presentationId,
        sourceFile: overview.presentation.sourceFile,
        totalSlides: slides.length,
        slides,
        markdown,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load slides.";
    return Response.json({ error: message }, { status: 500 });
  }
}
