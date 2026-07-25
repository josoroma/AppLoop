import { revalidatePath } from "next/cache";
import {
  writePresentationMarkdown,
} from "@/lib/presentations/files";
import { getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const presentationId = String(form.get("presentationId") ?? "");
    const markdown = String(form.get("markdown") ?? "");

    if (!presentationId || !markdown) {
      return Response.json({ error: "presentationId and markdown required" }, { status: 400 });
    }

    const overview = await getPresentationService().findPresentationOverview(presentationId);
    if (!overview || overview.presentation.status === "deleted") {
      return Response.json({ error: "Presentation not found." }, { status: 404 });
    }

    await writePresentationMarkdown(
      overview.presentation.workspacePath,
      markdown,
      overview.presentation.sourceFile,
    );
    await getPresentationService().openPresentation(presentationId);
    revalidatePath(`/presentations/${presentationId}`);
    revalidatePath(`/api/presentations/${presentationId}/preview`);

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
