import { CreateFlowShell } from "@/components/projects/create-flow-shell";
import { TemplateCreateForm } from "@/components/projects/template-create-form";

export const dynamic = "force-dynamic";

export default function NewTemplatePage() {
  return (
    <CreateFlowShell
      backHref="/templates"
      backLabel="Back to templates"
      description="Describe the reusable template you want. AppLoop applies editable theme CSS, sends your prompt through the repo-local Hermes agents, then opens the finished template in the builder for editing."
      eyebrow="AppLoop builder"
      title="Create template"
    >
      <TemplateCreateForm />
    </CreateFlowShell>
  );
}
