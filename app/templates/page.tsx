import Link from "next/link";
import { Copy, FolderGit2, House, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloneTemplateAction, deleteTemplateAction, editTemplateAction } from "@/lib/projects/actions";
import { getProjectRepository } from "@/lib/projects/store";
import { listManagedProjectTemplates } from "@/lib/projects/template-authoring";

export const dynamic = "force-dynamic";

type TemplatesPageProps = {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
  }>;
};

const PAGE_SIZE_OPTIONS = [5, 10, 15, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const params = await searchParams;
  const pageSize = parsePageSize(params?.pageSize);
  const requestedPage = parsePage(params?.page);
  const templates = await listManagedProjectTemplates(getProjectRepository());
  const templatePage = paginateItems(templates, requestedPage, pageSize);

  return (
    <main className="luma-list-page min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AppLoop builder
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Templates</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse reusable project templates. Create new ones from a full page, or edit existing templates in place with template-scoped builder guardrails.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/projects">
              <House className="size-4" />
              Projects
            </Link>
          </Button>
          <Button asChild>
            <Link href="/templates/new">
              <Plus className="size-4" />
              New template
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2">
        {templatePage.items.map((template) => (
          <article key={template.id} className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <FolderGit2 className="size-5 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">{template.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">templates/{template.templatePath}</p>
              </div>
              <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                {template.source === "custom" ? template.status ?? "custom" : "built-in"}
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{template.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">Default theme: {template.defaultThemeId}</p>

            <div className="mt-5 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              <form action={editTemplateAction} className="min-w-0">
                <input name="templateId" type="hidden" value={template.id} />
                <Button className="w-full min-w-0" type="submit">
                  <Pencil className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">Edit</span>
                </Button>
              </form>
              <form action={cloneTemplateAction} className="min-w-0">
                <input name="templateId" type="hidden" value={template.id} />
                <Button className="w-full min-w-0" type="submit" variant="secondary">
                  <Copy className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">Clone</span>
                </Button>
              </form>

              {template.source === "custom" ? (
                <form action={deleteTemplateAction} className="min-w-0">
                  <input name="templateId" type="hidden" value={template.id} />
                  <Button className="w-full min-w-0" type="submit" variant="destructive">
                    <Trash2 className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">Delete</span>
                  </Button>
                </form>
              ) : (
                <Button className="w-full min-w-0 px-3" disabled title="Built-in templates cannot be deleted" type="button" variant="outline">
                  <span className="min-w-0 truncate text-xs sm:text-sm">Built-in templates cannot be deleted</span>
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      <PaginationControls
        currentPage={templatePage.page}
        pageSize={pageSize}
        totalItems={templates.length}
      />
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

function PaginationControls({ currentPage, pageSize, totalItems }: { currentPage: number; pageSize: number; totalItems: number }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground" aria-label="Templates pagination">
      <span>
        Page {currentPage} of {totalPages} · {totalItems} total
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.12em]">Per page</span>
        {PAGE_SIZE_OPTIONS.map((option) => (
          <Button key={option} asChild size="sm" variant={option === pageSize ? "default" : "outline"}>
            <Link href={buildPageHref(1, option)}>{option}</Link>
          </Button>
        ))}
        <Button asChild size="sm" variant="outline" aria-disabled={currentPage <= 1}>
          <Link href={buildPageHref(previousPage, pageSize)}>Previous</Link>
        </Button>
        <Button asChild size="sm" variant="outline" aria-disabled={currentPage >= totalPages}>
          <Link href={buildPageHref(nextPage, pageSize)}>Next</Link>
        </Button>
      </div>
    </nav>
  );
}

function buildPageHref(page: number, pageSize: number) {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  return `/templates?${params.toString()}`;
}
