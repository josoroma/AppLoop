import { CreateFlowShell } from "@/components/projects/create-flow-shell";
import { PresentationCreateForm } from "@/components/presentations/presentation-create-form";
import { listPresentationTemplates } from "@/lib/presentations/templates";

export const dynamic = "force-dynamic";

export default function NewPresentationPage() {
  const templates = listPresentationTemplates();

  return (
    <CreateFlowShell
      backHref="/presentations"
      backLabel="Back to presentations"
      description="Create a Marp deck from a plain Markdown starter. Local clone only — Hermes edits deck.md after you open the builder."
      eyebrow="AppLoop presentations"
      title="New presentation"
    >
      <PresentationCreateForm templates={templates} />
    </CreateFlowShell>
  );
}
