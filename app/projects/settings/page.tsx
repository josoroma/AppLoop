import Link from "next/link";
import { ArrowLeft, Server } from "lucide-react";
import { BuilderSettingsForm } from "@/components/projects/builder-settings-form";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_HERMES_MODEL_OPTION_ID,
  listHermesModelOptions,
  type HermesModelOptionId,
} from "@/lib/hermes/models";
import { getPreferredHermesModelSelection } from "@/lib/hermes/preferences";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<{
    saved?: string;
    gateway?: string;
    gatewayMessage?: string;
  }>;
};

export default async function BuilderSettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const selection = await getPreferredHermesModelSelection();
  const options = listHermesModelOptions();
  const selectedOptionId = (selection.optionId ?? DEFAULT_HERMES_MODEL_OPTION_ID) as HermesModelOptionId;
  const gatewayStatus = params?.gateway === "reloaded" || params?.gateway === "warn" ? params.gateway : null;

  return (
    <main className="luma-list-page min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-3xl items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AppLoop builder
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-normal">
            <Server className="size-7 text-primary" />
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Choose the default model AppLoop uses for Hermes gateway communication.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/projects">
            <ArrowLeft className="size-4" />
            Projects
          </Link>
        </Button>
      </section>

      <section className="mx-auto mt-8 max-w-3xl">
        <BuilderSettingsForm
          gatewayMessage={params?.gatewayMessage ?? null}
          gatewayStatus={gatewayStatus}
          options={options}
          saved={params?.saved === "1"}
          selectedOptionId={selectedOptionId}
        />
      </section>
    </main>
  );
}
