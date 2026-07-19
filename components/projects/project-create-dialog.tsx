"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCustomTemplateAction, createProjectAction } from "@/lib/projects/actions";
import { DEFAULT_PROJECT_TEMPLATE_ID, type ProjectTemplate } from "@/lib/projects/templates";
import { BUILT_IN_PROJECT_THEMES } from "@/lib/themes/registry";

const DEFAULT_TEMPLATE_THEME_CSS = `:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.488 0.243 264.376);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.845 0.143 164.978);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.596 0.145 163.225);
  --chart-4: oklch(0.508 0.118 165.612);
  --chart-5: oklch(0.432 0.095 166.913);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.546 0.245 262.881);
  --sidebar-primary-foreground: oklch(0.97 0.014 254.604);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.424 0.199 265.638);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.845 0.143 164.978);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.596 0.145 163.225);
  --chart-4: oklch(0.508 0.118 165.612);
  --chart-5: oklch(0.432 0.095 166.913);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.623 0.214 259.815);
  --sidebar-primary-foreground: oklch(0.97 0.014 254.604);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}`;

export function ProjectCreateDialog({ templates }: { templates: ProjectTemplate[] }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_PROJECT_TEMPLATE_ID);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const [selectedThemeId, setSelectedThemeId] = useState<string>(selectedTemplate.defaultThemeId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="inset-0 left-0 top-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-0">
        <div className="grid h-full grid-rows-[auto_1fr] bg-card">
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              A workspace, preview port, theme record, runtime state, and Hermes session reservation will be created.
            </DialogDescription>
          </DialogHeader>
          <form action={createProjectAction} className="grid min-h-0 grid-rows-[1fr_auto]">
            <input name="templateId" type="hidden" value={selectedTemplateId} />
            <input name="themeId" type="hidden" value={selectedThemeId} />
            <div className="project-create-scrollarea min-h-0 overflow-y-scroll px-6 py-5">
              <div className="mx-auto grid max-w-6xl gap-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="project-name">
                    Project name
                  </label>
                  <input
                    autoFocus
                    className="h-12 w-full rounded-md border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
                    id="project-name"
                    maxLength={80}
                    name="name"
                    placeholder="CRM Dashboard"
                    required
                  />
                </div>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-medium">Template</legend>
                  <div className="grid gap-3 md:grid-cols-2">
                    {templates.map((template) => (
                      <label key={template.id} className="grid min-h-36 cursor-pointer gap-2 rounded-lg border bg-card p-5 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring">
                        <input
                          checked={template.id === selectedTemplateId}
                          className="sr-only"
                          onChange={() => {
                            setSelectedTemplateId(template.id);
                            setSelectedThemeId(template.defaultThemeId);
                          }}
                          type="radio"
                          value={template.id}
                        />
                        <span className="flex items-center justify-between gap-2 text-lg font-medium">
                          {template.name}
                          {template.source === "custom" ? <span className="text-xs text-primary">Custom</span> : null}
                        </span>
                        <span className="text-sm text-muted-foreground">{template.description}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-medium">Theme</legend>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate.name} starts with {selectedTemplate.defaultThemeId.replaceAll("-", " ")}, but you can override it here.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {BUILT_IN_PROJECT_THEMES.map((theme) => (
                      <label key={theme.id} className="grid min-h-36 cursor-pointer gap-3 rounded-lg border bg-card p-5 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring">
                        <input checked={theme.id === selectedThemeId} className="sr-only" onChange={() => setSelectedThemeId(theme.id)} type="radio" value={theme.id} />
                        <span className="flex items-center justify-between gap-2 text-lg font-medium">
                          {theme.name}
                          {theme.id === selectedTemplate.defaultThemeId ? <span className="text-xs text-primary">Template default</span> : null}
                        </span>
                        <span className="theme-card-preview" data-theme-id={theme.id}>
                          <span className="theme-preview-swatch theme-preview-primary" />
                          <span className="theme-preview-swatch theme-preview-secondary" />
                          <span className="theme-preview-swatch theme-preview-accent" />
                          <span className="theme-preview-swatch theme-preview-background" />
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
            <div className="border-t bg-card px-6 py-4">
              <div className="mx-auto flex max-w-6xl justify-end">
                <SubmitButton />
              </div>
            </div>
          </form>
        </div>
        <PendingOverlay />
      </DialogContent>
    </Dialog>
  );
}

export function CustomTemplateCreateDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus className="size-4" />
          New template
        </Button>
      </DialogTrigger>
      <DialogContent className="inset-0 left-0 top-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-0">
        <div className="grid h-full grid-rows-[auto_1fr] bg-card">
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle>Create template</DialogTitle>
            <DialogDescription>
              Describe the reusable template you want. AppLoop applies the editable theme CSS, sends your prompt through the repo-local Hermes agents, skills, hooks, and commands, then registers the finished template for future projects.
            </DialogDescription>
          </DialogHeader>
          <form action={createCustomTemplateAction} className="grid min-h-0 grid-rows-[1fr_auto]">
            <div className="project-create-scrollarea min-h-0 overflow-y-scroll px-6 py-5">
              <div className="mx-auto grid max-w-6xl gap-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="template-name">
                    Template name
                  </label>
                  <input
                    autoFocus
                    className="h-12 w-full rounded-md border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
                    id="template-name"
                    maxLength={80}
                    name="name"
                    placeholder="Investor CRM Dashboard"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="template-description">
                    Short description
                  </label>
                  <input
                    className="h-12 w-full rounded-md border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
                    id="template-description"
                    maxLength={180}
                    name="description"
                    placeholder="A focused dashboard for investor relationship workflows."
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="template-prompt">
                    Template prompt
                  </label>
                  <textarea
                    className="min-h-48 resize-y rounded-md border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                    id="template-prompt"
                    maxLength={6000}
                    name="prompt"
                    placeholder="Describe the pages, layout, data cards, visual style, interactions, and any domain-specific content this reusable template should include."
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The prompt is sent to Hermes with the AppLoop /ui-builder bundle, template-authoring guardrails, and inspectable classname rules.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="template-theme-css">
                    Theme CSS
                  </label>
                  <textarea
                    className="min-h-96 resize-y rounded-md border bg-background px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                    defaultValue={DEFAULT_TEMPLATE_THEME_CSS}
                    id="template-theme-css"
                    name="themeCss"
                    required
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Edit the shadcn-compatible <code>:root</code> and <code>.dark</code> token blocks. AppLoop validates and applies this CSS before Hermes authors the template.
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t bg-card px-6 py-4">
              <div className="mx-auto flex max-w-6xl justify-end">
                <TemplateSubmitButton />
              </div>
            </div>
          </form>
        </div>
        <PendingOverlay label="Creating your template with Hermes…" />
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
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

function TemplateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Creating template…
        </>
      ) : (
        "Create template"
      )}
    </Button>
  );
}

function PendingOverlay({ label = "Creating your project…" }: { label?: string }) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-8 py-6 shadow-xl">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
