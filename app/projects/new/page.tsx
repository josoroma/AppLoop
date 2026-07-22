import { CreateFlowShell } from "@/components/projects/create-flow-shell";
import { ProjectCreateForm } from "@/components/projects/project-create-form";
import { getProjectRepository } from "@/lib/projects/store";
import { listSelectableProjectTemplates } from "@/lib/projects/template-authoring";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const templates = await listSelectableProjectTemplates(getProjectRepository());

  return (
    <CreateFlowShell
      backHref="/projects"
      backLabel="Back to projects"
      description="A workspace, preview port, theme record, runtime state, and Hermes session reservation will be created. When creation finishes you land in the project edit builder."
      eyebrow="AppLoop builder"
      title="Create project"
    >
      <ProjectCreateForm templates={templates} />
    </CreateFlowShell>
  );
}
