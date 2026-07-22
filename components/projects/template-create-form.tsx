"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCustomTemplateAction } from "@/lib/projects/actions";

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

export function TemplateCreateForm() {
  return (
    <form action={createCustomTemplateAction} className="luma-create-form grid gap-8">
      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="template-name">
              Template name
            </label>
            <input
              autoFocus
              className="luma-create-input h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
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
              className="luma-create-input h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
              id="template-description"
              maxLength={180}
              name="description"
              placeholder="A focused dashboard for investor relationship workflows."
            />
          </div>
        </div>
      </section>

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="template-prompt">
            Template prompt
          </label>
          <textarea
            className="luma-create-input min-h-56 resize-y rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            id="template-prompt"
            maxLength={6000}
            name="prompt"
            placeholder="Describe the pages, layout, data cards, visual style, interactions, and any domain-specific content this reusable template should include."
            required
          />
          <p className="text-xs leading-5 text-muted-foreground">
            The prompt is sent to Hermes with the AppLoop /ui-builder bundle, template-authoring guardrails, and inspectable classname rules.
          </p>
        </div>
      </section>

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="template-theme-css">
            Theme CSS
          </label>
          <textarea
            className="luma-create-input min-h-[28rem] resize-y rounded-xl border bg-background px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            defaultValue={DEFAULT_TEMPLATE_THEME_CSS}
            id="template-theme-css"
            name="themeCss"
            required
            spellCheck={false}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Edit the shadcn-compatible <code>:root</code> and <code>.dark</code> token blocks. AppLoop validates and applies this CSS before Hermes authors the template.
          </p>
        </div>
      </section>

      <div className="luma-create-footer sticky bottom-4 z-10 flex justify-end rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur-md">
        <SubmitButton />
      </div>
      <PendingOverlay />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="min-w-48" disabled={pending} type="submit">
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

function PendingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-8 py-6 shadow-xl">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Creating your template with Hermes…</p>
      </div>
    </div>
  );
}
