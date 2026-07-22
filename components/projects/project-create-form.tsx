"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProjectAction } from "@/lib/projects/actions";
import { DEFAULT_PROJECT_TEMPLATE_ID, type ProjectTemplate } from "@/lib/projects/templates";
import { BUILT_IN_PROJECT_THEMES } from "@/lib/themes/registry";

export function ProjectCreateForm({ templates }: { templates: ProjectTemplate[] }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_PROJECT_TEMPLATE_ID);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const [selectedThemeId, setSelectedThemeId] = useState<string>(selectedTemplate?.defaultThemeId ?? "luma-indigo-emerald");

  return (
    <form action={createProjectAction} className="luma-create-form grid gap-8">
      <input name="templateId" type="hidden" value={selectedTemplateId} />
      <input name="themeId" type="hidden" value={selectedThemeId} />

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="project-name">
            Project name
          </label>
          <input
            autoFocus
            className="luma-create-input h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
            id="project-name"
            maxLength={80}
            name="name"
            placeholder="CRM Dashboard"
            required
          />
        </div>
      </section>

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <fieldset className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <legend className="text-sm font-medium">Template</legend>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the blueprint Hermes and the preview runtime should bootstrap from.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {templates.length} available
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((template) => {
              const selected = template.id === selectedTemplateId;

              return (
                <label
                  key={template.id}
                  className={`luma-select-card grid min-h-40 cursor-pointer gap-3 rounded-2xl border bg-background/70 p-5 text-sm transition ${
                    selected ? "border-primary ring-2 ring-ring" : "hover:border-primary/40"
                  }`}
                >
                  <input
                    checked={selected}
                    className="sr-only"
                    onChange={() => {
                      setSelectedTemplateId(template.id);
                      setSelectedThemeId(template.defaultThemeId);
                    }}
                    type="radio"
                    value={template.id}
                  />
                  <span className="flex items-center justify-between gap-2 text-lg font-medium">
                    <span className="min-w-0 truncate">{template.name}</span>
                    {template.source === "custom" ? <span className="shrink-0 text-xs text-primary">Custom</span> : null}
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{template.description}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    default theme · {template.defaultThemeId.replaceAll("-", " ")}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <fieldset className="grid gap-4">
          <div>
            <legend className="text-sm font-medium">Theme</legend>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedTemplate?.name ?? "This template"} starts with {selectedTemplate?.defaultThemeId.replaceAll("-", " ")}, but you can override it here.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {BUILT_IN_PROJECT_THEMES.map((theme) => {
              const selected = theme.id === selectedThemeId;

              return (
                <label
                  key={theme.id}
                  className={`luma-select-card grid min-h-36 cursor-pointer gap-3 rounded-2xl border bg-background/70 p-5 text-sm transition ${
                    selected ? "border-primary ring-2 ring-ring" : "hover:border-primary/40"
                  }`}
                >
                  <input checked={selected} className="sr-only" onChange={() => setSelectedThemeId(theme.id)} type="radio" value={theme.id} />
                  <span className="flex items-center justify-between gap-2 text-lg font-medium">
                    <span className="min-w-0 truncate">{theme.name}</span>
                    {theme.id === selectedTemplate?.defaultThemeId ? (
                      <span className="shrink-0 text-xs text-primary">Template default</span>
                    ) : null}
                  </span>
                  <span className="theme-card-preview" data-theme-id={theme.id}>
                    <span className="theme-preview-swatch theme-preview-primary" />
                    <span className="theme-preview-swatch theme-preview-secondary" />
                    <span className="theme-preview-swatch theme-preview-accent" />
                    <span className="theme-preview-swatch theme-preview-background" />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <div className="luma-create-footer sticky bottom-4 z-10 flex justify-end rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur-md">
        <SubmitButton />
      </div>
      <PendingOverlay label="Creating your project…" />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="min-w-44" disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Creating…
        </>
      ) : (
        "Create project"
      )}
    </Button>
  );
}

function PendingOverlay({ label }: { label: string }) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-8 py-6 shadow-xl">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
