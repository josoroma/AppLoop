import { notFound } from "next/navigation";
import { BuilderShell } from "@/components/builder/builder-shell";
import { toBuilderChatMessages } from "@/lib/chat/messages";
import { getProjectRepository } from "@/lib/projects/store";
import { getProjectService } from "@/lib/projects/store";
import { getRuntimeService } from "@/lib/runtime/store";
import { listProjectThemes } from "@/lib/themes/registry";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const [overview, activeProjects] = await Promise.all([
    getProjectService().findProjectOverview(projectId),
    getProjectService().listActiveProjects(),
  ]);

  if (!overview || overview.project.status === "deleted") {
    notFound();
  }

  const [runtimeLogs, persistedMessages] = await Promise.all([
    getRuntimeService().getProjectLogs(projectId),
    overview.conversation ? getProjectRepository().listConversationMessages(overview.conversation.id, { limit: 50 }) : Promise.resolve([]),
  ]);

  return (
    <BuilderShell
      activeProjects={activeProjects.map((projectOverview) => ({
        id: projectOverview.project.id,
        name: projectOverview.project.name,
      }))}
      autoStartPreview={overview.settings?.autoStartPreview ?? true}
      defaultRoute={overview.settings?.defaultRoute ?? "/"}
      packageInstallPolicy={overview.settings?.packageInstallPolicy ?? "ask"}
      previewUrl={overview.runtime?.previewUrl ?? `http://127.0.0.1:${overview.project.previewPort}`}
      projectId={overview.project.id}
      initialMessages={toBuilderChatMessages(persistedMessages)}
      projectName={overview.project.name}
      runtimeExitCode={overview.runtime?.exitCode ?? null}
      runtimeExitSignal={overview.runtime?.exitSignal ?? null}
      runtimeLogs={runtimeLogs}
      runtimePid={overview.runtime?.pid ?? null}
      runtimeStatus={overview.runtime?.status ?? "stopped"}
      selectedThemeId={overview.theme?.themeId ?? overview.project.themeId}
      themeOptions={listProjectThemes().map((theme) => ({
        id: theme.id,
        name: theme.name,
        description: theme.description,
      }))}
      validationDepth={overview.settings?.validationDepth ?? "standard"}
    />
  );
}