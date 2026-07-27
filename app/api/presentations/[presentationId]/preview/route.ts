import { getMarpSlideBody, loadOptionalThemeCss, renderMarpDeck, wrapMarpDocument } from "@/lib/presentations/marp";
import { readPresentationMarkdown } from "@/lib/presentations/files";
import { getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

type PreviewRouteProps = {
  params: Promise<{
    presentationId: string;
  }>;
};

function parseSlideParam(value: string | null): number | "all" | "filmstrip" {
  if (!value || value === "all") {
    return "all";
  }
  if (value === "filmstrip") {
    return "filmstrip";
  }
  const asNumber = Number.parseInt(value, 10);
  if (!Number.isFinite(asNumber) || asNumber < 1) {
    return "all";
  }
  return asNumber;
}

export async function GET(request: Request, { params }: PreviewRouteProps) {
  const { presentationId } = await params;
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview || overview.presentation.status === "deleted") {
    return new Response("Presentation not found.", { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const slideParam = parseSlideParam(url.searchParams.get("slide"));
    const hidePagination = url.searchParams.get("hidePagination") === "1";
    const previewBackground = url.searchParams.get("previewBackground") ?? undefined;
    const slideBackground = url.searchParams.get("slideBackground") ?? undefined;
    const slideTextColor = url.searchParams.get("slideTextColor") ?? undefined;
    const inspect = url.searchParams.get("inspect") === "1";

    const markdown = await readPresentationMarkdown(
      overview.presentation.workspacePath,
      overview.presentation.sourceFile,
    );
    const themeCss = await loadOptionalThemeCss(overview.presentation.workspacePath);

    const renderSlide = typeof slideParam === "number" ? slideParam : "all";
    const rendered = await renderMarpDeck(markdown, {
      themeCss,
      slide: renderSlide,
    });

    const mode =
      slideParam === "filmstrip" ? "filmstrip" : typeof slideParam === "number" ? "slide" : "deck";

    const documentHtml = wrapMarpDocument(rendered.html, rendered.css, {
      title: overview.presentation.name,
      mode,
      activeSlide: typeof slideParam === "number" ? slideParam : 1,
      totalSlides: rendered.slideCountHint,
      hidePagination,
      previewBackground,
      slideBackground,
      slideTextColor,
      inspect,
      slideMarkdown: typeof slideParam === "number" ? getMarpSlideBody(markdown, slideParam) : undefined,
    });

    const scriptNeeded = mode === "filmstrip" || mode === "slide" || inspect;

    return new Response(documentHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": scriptNeeded
          ? "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; script-src 'unsafe-inline'; img-src data: https: http:; font-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
          : "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src data: https: http:; font-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render presentation.";
    return new Response(message, { status: 500 });
  }
}
