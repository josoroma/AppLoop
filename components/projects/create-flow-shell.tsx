import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type CreateFlowShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
};

export function CreateFlowShell({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  children,
}: CreateFlowShellProps) {
  return (
    <main className="luma-create-page min-h-screen">
      <div className="luma-create-ambient" aria-hidden="true" />
      <div className="luma-create-ambient luma-create-ambient-secondary" aria-hidden="true" />

      <section className="luma-create-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="luma-create-header flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-6">
          <div className="min-w-0 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
          </Button>
        </header>

        <div className="luma-create-body flex-1 py-8">{children}</div>
      </section>
    </main>
  );
}
