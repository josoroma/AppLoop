import Link from "next/link";
import {
  ArchiveRestore,
  FolderOpen,
  House,
  LayoutTemplate,
  Plus,
  Presentation,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  archivePresentationAction,
  deletePresentationAction,
  openPresentationAction,
  restorePresentationAction,
} from "@/lib/presentations/actions";
import { formatPresentationWorkspacePath } from "@/lib/presentations/service";
import { getPresentationService } from "@/lib/presentations/store";

export const dynamic = "force-dynamic";

type PresentationsPageProps = {
  searchParams?: Promise<{
    deleteError?: string;
  }>;
};

export default async function PresentationsPage({ searchParams }: PresentationsPageProps) {
  const params = await searchParams;
  const deleteErrorPresentationId = params?.deleteError;
  const [activePresentations, archivedPresentations] = await Promise.all([
    getPresentationService().listActivePresentations(),
    getPresentationService().listArchivedPresentations(),
  ]);

  return (
    <main className="luma-list-page min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AppLoop builder
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Presentations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Author Marp decks from plain Markdown. Preview is rendered from `deck.md` — no Next.js runtime.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/projects">
              <House className="size-4" />
              Projects
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/templates">
              <LayoutTemplate className="size-4" />
              Templates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/presentations/new">
              <Plus className="size-4" />
              New presentation
            </Link>
          </Button>
        </div>
      </section>

      {deleteErrorPresentationId ? (
        <section className="mx-auto mt-6 max-w-6xl rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not delete presentation {deleteErrorPresentationId}. Try again after closing any locks.
        </section>
      ) : null}

      <section className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2">
        {activePresentations.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm md:col-span-2">
            No presentations yet. Create one from the Simple 3 slides Marp starter.
          </div>
        ) : (
          activePresentations.map((overview) => (
            <article key={overview.presentation.id} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Presentation className="size-5 text-primary" />
                  <h2 className="mt-4 text-lg font-semibold">{overview.presentation.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPresentationWorkspacePath(overview.presentation.workspacePath)}
                  </p>
                </div>
                <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                  {overview.presentation.templateId}
                </span>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">Source: {overview.presentation.sourceFile}</p>

              <div className="mt-5 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                <form action={openPresentationAction} className="min-w-0">
                  <input name="presentationId" type="hidden" value={overview.presentation.id} />
                  <Button className="w-full min-w-0" type="submit">
                    <FolderOpen className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">Open</span>
                  </Button>
                </form>
                <form action={archivePresentationAction} className="min-w-0">
                  <input name="presentationId" type="hidden" value={overview.presentation.id} />
                  <Button className="w-full min-w-0" type="submit" variant="outline">
                    <ArchiveRestore className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">Archive</span>
                  </Button>
                </form>
                <form action={deletePresentationAction} className="min-w-0">
                  <input name="presentationId" type="hidden" value={overview.presentation.id} />
                  <Button className="w-full min-w-0" type="submit" variant="destructive">
                    <Trash2 className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">Delete</span>
                  </Button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>

      {archivedPresentations.length > 0 ? (
        <section className="mx-auto mt-10 max-w-6xl">
          <h2 className="text-lg font-semibold">Archived</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {archivedPresentations.map((overview) => (
              <article key={overview.presentation.id} className="rounded-lg border bg-card p-5 shadow-sm">
                <h3 className="text-base font-semibold">{overview.presentation.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPresentationWorkspacePath(overview.presentation.workspacePath)}
                </p>
                <div className="mt-4 flex gap-2">
                  <form action={restorePresentationAction}>
                    <input name="presentationId" type="hidden" value={overview.presentation.id} />
                    <Button type="submit" variant="outline">
                      Restore
                    </Button>
                  </form>
                  <form action={deletePresentationAction}>
                    <input name="presentationId" type="hidden" value={overview.presentation.id} />
                    <Button type="submit" variant="destructive">
                      Delete
                    </Button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
