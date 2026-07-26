import { notFound } from "next/navigation";
import { PresentationBuilderShell } from "@/components/presentations/presentation-builder-shell";
import { toBuilderChatMessages } from "@/lib/chat/messages";
import { listPresentationImageAssets, readPresentationMarkdown } from "@/lib/presentations/files";
import { getMarpSlideSummaries } from "@/lib/presentations/marp";
import { getPresentationRepository, getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

type PresentationPageProps = {
  params: Promise<{
    presentationId: string;
  }>;
  searchParams?: Promise<{
    slide?: string | string[];
  }>;
};

function parseInitialSlide(value: string | string[] | undefined, slideCount: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const requested = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(requested)) return 1;
  return Math.min(Math.max(requested, 1), Math.max(slideCount, 1));
}

export default async function PresentationPage({ params, searchParams }: PresentationPageProps) {
  const { presentationId } = await params;
  const query = await searchParams;
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview || overview.presentation.status === "deleted") {
    notFound();
  }

  const [markdown, persistedMessages, imageAssets] = await Promise.all([
    readPresentationMarkdown(overview.presentation.workspacePath, overview.presentation.sourceFile),
    overview.conversation
      ? getPresentationRepository().listConversationMessages(overview.conversation.id, { limit: 50 })
      : Promise.resolve([]),
    listPresentationImageAssets(overview.presentation.workspacePath),
  ]);

  const initialSlides = getMarpSlideSummaries(markdown);
  const initialActiveSlide = parseInitialSlide(query?.slide, initialSlides.length);

  return (
    <PresentationBuilderShell
      initialActiveSlide={initialActiveSlide}
      initialMessages={toBuilderChatMessages(
        persistedMessages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          metadataJson: message.metadataJson ?? null,
        })),
      )}
      initialMarkdown={markdown}
      initialImageAssets={imageAssets}
      initialSlideCount={initialSlides.length}
      initialSlides={initialSlides}
      presentationId={overview.presentation.id}
      presentationName={overview.presentation.name}
      sourceFile={overview.presentation.sourceFile}
    />
  );
}
