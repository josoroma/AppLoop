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
import { createProjectAction } from "@/lib/projects/actions";
import { BUILT_IN_PROJECT_TEMPLATES, DEFAULT_PROJECT_TEMPLATE_ID } from "@/lib/projects/templates";
import { BUILT_IN_PROJECT_THEMES } from "@/lib/themes/registry";

export function ProjectCreateDialog() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_PROJECT_TEMPLATE_ID);
  const selectedTemplate = BUILT_IN_PROJECT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? BUILT_IN_PROJECT_TEMPLATES[0];
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
                    {BUILT_IN_PROJECT_TEMPLATES.map((template) => (
                      <label key={template.id} className="grid min-h-36 cursor-pointer gap-2 rounded-lg border bg-card p-5 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring">
                        <input
                          checked={template.id === selectedTemplateId}
                          className="sr-only"
                          name="templateId"
                          onChange={() => {
                            setSelectedTemplateId(template.id);
                            setSelectedThemeId(template.defaultThemeId);
                          }}
                          type="radio"
                          value={template.id}
                        />
                        <span className="text-lg font-medium">{template.name}</span>
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
                        <input checked={theme.id === selectedThemeId} className="sr-only" name="themeId" onChange={() => setSelectedThemeId(theme.id)} type="radio" value={theme.id} />
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

function PendingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-8 py-6 shadow-xl">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Creating your project…</p>
      </div>
    </div>
  );
}