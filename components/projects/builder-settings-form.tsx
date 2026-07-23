"use client";

import { useFormStatus } from "react-dom";
import { updateBuilderHermesModelAction } from "@/lib/projects/actions";
import type { HermesModelOption, HermesModelOptionId } from "@/lib/hermes/models";
import { Button } from "@/components/ui/button";

type BuilderSettingsFormProps = {
  options: HermesModelOption[];
  selectedOptionId: HermesModelOptionId;
  saved: boolean;
  gatewayStatus?: "reloaded" | "warn" | null;
  gatewayMessage?: string | null;
};

export function BuilderSettingsForm({
  options,
  selectedOptionId,
  saved,
  gatewayStatus = null,
  gatewayMessage = null,
}: BuilderSettingsFormProps) {
  return (
    <form action={updateBuilderHermesModelAction} className="space-y-6">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Default Hermes model</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Used for every AppLoop ↔ Hermes gateway call: create template authoring, project-edit chat,
              and template-edit chat. Saving also updates Hermes <code className="font-mono">model_routes</code>{" "}
              and reloads the local gateway so the selection actually takes effect.
            </p>
          </div>
          {saved ? (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
              Saved
            </span>
          ) : null}
        </div>

        {gatewayStatus === "reloaded" ? (
          <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Hermes gateway reloaded with the selected model routes.
          </p>
        ) : null}
        {gatewayStatus === "warn" ? (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {gatewayMessage || "Model preference saved, but the gateway could not be reloaded automatically. Run `make hermes-gateway`."}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3">
          {options.map((option) => (
            <label
              key={option.id}
              className="luma-select-card flex cursor-pointer items-start gap-3 rounded-lg border bg-background/60 p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring"
            >
              <input
                className="mt-1"
                defaultChecked={option.id === selectedOptionId}
                name="defaultHermesModelId"
                type="radio"
                value={option.id}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{option.label}</span>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {option.badge}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
                <span className="mt-2 block font-mono text-xs text-muted-foreground">
                  {option.provider} · {option.model}
                </span>
                {option.kind === "local" ? (
                  <span className="mt-2 block text-xs text-amber-200/90">
                    Requires a local server: <code className="font-mono">make mlx-vlm-server</code>
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Saving + reloading gateway…" : "Save default model"}
    </Button>
  );
}
