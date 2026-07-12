import { Activity, AlertTriangle, ArchiveRestore, Copy, ExternalLink, FolderGit2, LoaderCircle, Pencil, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCreateDialog } from "@/components/projects/project-create-dialog";
import {
  archiveProjectAction,
  deleteProjectAction,
  duplicateProjectAction,
  openProjectAction,
  renameProjectAction,
  restoreProjectAction,
} from "@/lib/projects/actions";
import { formatProjectWorkspacePath } from "@/lib/projects/service";
import { getProjectService } from "@/lib/projects/store";
import { stopRuntimeAction } from "@/lib/runtime/actions";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams?: Promise<{
    deleteError?: string;
  }>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const deleteErrorProjectId = params?.deleteError;
  const [activeProjects, archivedProjects] = await Promise.all([
    getProjectService().listActiveProjects(),
    getProjectService().listArchivedProjects(),
  ]);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AppLoop builder
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Projects</h1>
        </div>
        <ProjectCreateDialog />
      </section>

      <section className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2">
        {activeProjects.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm md:col-span-2">
            No active projects yet. Create one to generate a workspace and reserve its Hermes session.
          </div>
        ) : (
          activeProjects.map((overview) => (
            <article key={overview.project.id} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <FolderGit2 className="size-5 text-primary" />
                  <h2 className="mt-4 text-lg font-semibold">{overview.project.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{formatProjectWorkspacePath(overview.project.workspacePath)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                    :{overview.project.previewPort}
                  </span>
                  <ProjectRuntimeBadge status={overview.runtime?.status ?? "stopped"} />
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <form action={openProjectAction}>
                  <input name="projectId" type="hidden" value={overview.project.id} />
                  <Button className="w-full" type="submit">
                    <ExternalLink className="size-4" />
                    Open
                  </Button>
                </form>
                <form action={duplicateProjectAction}>
                  <input name="projectId" type="hidden" value={overview.project.id} />
                  <Button className="w-full" type="submit" variant="secondary">
                    <Copy className="size-4" />
                    Duplicate
                  </Button>
                </form>
              </div>

              {overview.runtime?.status === "running" || overview.runtime?.status === "starting" ? (
                <form action={stopRuntimeAction} className="mt-2">
                  <input name="projectId" type="hidden" value={overview.project.id} />
                  <Button className="w-full" type="submit" variant="outline">
                    <Square className="size-4" />
                    Stop preview
                  </Button>
                </form>
              ) : null}

              <form action={renameProjectAction} className="mt-4 flex gap-2">
                <input name="projectId" type="hidden" value={overview.project.id} />
                <input
                  aria-label="Project name"
                  className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  defaultValue={overview.project.name}
                  name="name"
                />
                <Button size="icon" type="submit" variant="outline">
                  <Pencil className="size-4" />
                  <span className="sr-only">Rename project</span>
                </Button>
              </form>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <form action={archiveProjectAction}>
                  <input name="projectId" type="hidden" value={overview.project.id} />
                  <Button className="w-full" type="submit" variant="outline">
                    Archive
                  </Button>
                </form>
                <form action={deleteProjectAction} className="flex gap-2">
                  <input name="projectId" type="hidden" value={overview.project.id} />
                  <input
                    aria-label="Confirm project name before delete"
                    aria-describedby={`delete-help-${overview.project.id}${deleteErrorProjectId === overview.project.id ? ` delete-error-${overview.project.id}` : ""}`}
                    className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring"
                    name="confirmName"
                    pattern={escapeHtmlPattern(overview.project.name)}
                    placeholder="Confirm project name"
                    required
                    title={`Type ${overview.project.name} exactly to delete.`}
                  />
                  <Button size="icon" type="submit" variant="destructive">
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete project</span>
                  </Button>
                </form>
              </div>
              <p id={`delete-help-${overview.project.id}`} className="mt-2 text-xs text-muted-foreground">
                Type {overview.project.name} to delete.
              </p>
              {deleteErrorProjectId === overview.project.id ? (
                <p id={`delete-error-${overview.project.id}`} className="mt-2 text-xs text-destructive" role="status">
                  Project deletion requires typing the project name exactly.
                </p>
              ) : null}
            </article>
          ))
        )}
      </section>

      {archivedProjects.length > 0 ? (
        <section className="mx-auto mt-10 max-w-6xl">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Archived</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {archivedProjects.map((overview) => (
              <article key={overview.project.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
                <div>
                  <h3 className="font-semibold">{overview.project.name}</h3>
                  <p className="text-xs text-muted-foreground">Files remain at {formatProjectWorkspacePath(overview.project.workspacePath)}</p>
                </div>
                <form action={restoreProjectAction}>
                  <input name="projectId" type="hidden" value={overview.project.id} />
                  <Button type="submit" variant="secondary">
                    <ArchiveRestore className="size-4" />
                    Restore
                  </Button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function escapeHtmlPattern(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function ProjectRuntimeBadge({ status }: { status: "stopped" | "starting" | "running" | "failed" }) {
  const label = status === "running" ? "Running" : status === "starting" ? "Starting" : status === "failed" ? "Failed" : "Stopped";
  const iconClassName = "size-3";

  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
      {status === "running" ? <Activity className={`${iconClassName} text-emerald-400`} /> : null}
      {status === "starting" ? <LoaderCircle className={`${iconClassName} animate-spin text-primary`} /> : null}
      {status === "failed" ? <AlertTriangle className={`${iconClassName} text-destructive`} /> : null}
      {status === "stopped" ? <Square className={iconClassName} /> : null}
      {label}
    </span>
  );
}