"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            A workspace, preview port, theme record, runtime state, and Hermes session reservation will be created.
          </DialogDescription>
        </DialogHeader>
        <form action={createProjectAction} className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="project-name">
            Project name
          </label>
          <input
            autoFocus
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            id="project-name"
            maxLength={80}
            name="name"
            placeholder="CRM Dashboard"
            required
          />
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Template</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUILT_IN_PROJECT_TEMPLATES.map((template) => (
                <label key={template.id} className="grid cursor-pointer gap-1 rounded-md border bg-card p-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring">
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
                  <span className="font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Theme</legend>
            <p className="text-xs text-muted-foreground">
              {selectedTemplate.name} starts with {selectedTemplate.defaultThemeId.replaceAll("-", " ")}, but you can override it here.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUILT_IN_PROJECT_THEMES.map((theme) => (
                <label key={theme.id} className="grid cursor-pointer gap-2 rounded-md border bg-card p-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring">
                  <input checked={theme.id === selectedThemeId} className="sr-only" name="themeId" onChange={() => setSelectedThemeId(theme.id)} type="radio" value={theme.id} />
                  <span className="flex items-center justify-between gap-2 font-medium">
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
          <Button className="w-full" type="submit">
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}