import Link from "next/link";
import { Activity, AlertTriangle, ArchiveRestore, Copy, ExternalLink, FolderGit2, LayoutTemplate, LoaderCircle, Pencil, Plus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    page?: string;
    pageSize?: string;
    archivedPage?: string;
  }>;
};

const PAGE_SIZE_OPTIONS = [5, 10, 15, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const deleteErrorProjectId = params?.deleteError;
  const pageSize = parsePageSize(params?.pageSize);
  const activePage = parsePage(params?.page);
  const archivedPage = parsePage(params?.archivedPage);
  const [activeProjects, archivedProjects] = await Promise.all([
    getProjectService().listActiveProjects(),
    getProjectService().listArchivedProjects(),
  ]);
  const activeProjectPage = paginateItems(activeProjects, activePage, pageSize);
  const archivedProjectPage = paginateItems(archivedProjects, archivedPage, pageSize);

  return (
    <main className="luma-list-page min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AppLoop builder
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Projects</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/templates">
              <LayoutTemplate className="size-4" />
              Templates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2">
        {activeProjects.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm md:col-span-2">
            No active projects yet. Create one to generate a workspace and reserve its Hermes session.
          </div>
        ) : (
          activeProjectPage.items.map((overview) => (
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

      {activeProjects.length > 0 ? (
        <PaginationControls
          basePath="/projects"
          currentPage={activeProjectPage.page}
          pageParam="page"
          pageSize={pageSize}
          totalItems={activeProjects.length}
        />
      ) : null}

      {archivedProjects.length > 0 ? (
        <section className="mx-auto mt-10 max-w-6xl">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Archived</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {archivedProjectPage.items.map((overview) => (
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
          <PaginationControls
            basePath="/projects"
            currentPage={archivedProjectPage.page}
            pageParam="archivedPage"
            pageSize={pageSize}
            totalItems={archivedProjects.length}
          />
        </section>
      ) : null}
    </main>
  );
}

function parsePage(value: string | undefined) {
  const page = Number(value ?? "1");

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePageSize(value: string | undefined) {
  const pageSize = Number(value ?? DEFAULT_PAGE_SIZE);

  return PAGE_SIZE_OPTIONS.includes(pageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? pageSize : DEFAULT_PAGE_SIZE;
}

function paginateItems<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    totalPages,
  };
}

function PaginationControls({
  basePath,
  currentPage,
  pageParam,
  pageSize,
  totalItems,
}: {
  basePath: string;
  currentPage: number;
  pageParam: string;
  pageSize: number;
  totalItems: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground" aria-label={`${pageParam} pagination`}>
      <span>
        Page {currentPage} of {totalPages} · {totalItems} total
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.12em]">Per page</span>
        {PAGE_SIZE_OPTIONS.map((option) => (
          <Button key={option} asChild size="sm" variant={option === pageSize ? "default" : "outline"}>
            <Link href={buildPageHref(basePath, pageParam, 1, option)}>{option}</Link>
          </Button>
        ))}
        <Button asChild size="sm" variant="outline" aria-disabled={currentPage <= 1}>
          <Link href={buildPageHref(basePath, pageParam, previousPage, pageSize)}>Previous</Link>
        </Button>
        <Button asChild size="sm" variant="outline" aria-disabled={currentPage >= totalPages}>
          <Link href={buildPageHref(basePath, pageParam, nextPage, pageSize)}>Next</Link>
        </Button>
      </div>
    </nav>
  );
}

function buildPageHref(basePath: string, pageParam: string, page: number, pageSize: number) {
  const params = new URLSearchParams();

  params.set(pageParam, String(page));
  params.set("pageSize", String(pageSize));

  return `${basePath}?${params.toString()}`;
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