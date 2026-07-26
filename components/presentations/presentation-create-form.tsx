"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createPresentationAction } from "@/lib/presentations/actions";
import {
  DEFAULT_PRESENTATION_TEMPLATE_ID,
  type PresentationTemplate,
} from "@/lib/presentations/templates";

export function PresentationCreateForm({ templates }: { templates: PresentationTemplate[] }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.id ?? DEFAULT_PRESENTATION_TEMPLATE_ID,
  );

  return (
    <form action={createPresentationAction} className="luma-create-form grid gap-8">
      <input name="templateId" type="hidden" value={selectedTemplateId} />

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="presentation-name">
            Presentation name
          </label>
          <input
            autoFocus
            className="luma-create-input h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
            id="presentation-name"
            maxLength={80}
            name="name"
            placeholder="Product narrative"
            required
          />
        </div>
      </section>

      <section className="luma-create-panel rounded-2xl border bg-card/90 p-6 shadow-sm backdrop-blur-sm">
        <fieldset className="grid gap-4">
          <div>
            <legend className="text-sm font-medium">Template</legend>
            <p className="mt-1 text-sm text-muted-foreground">
              Starter decks are plain Marp Markdown. Simple 3 Slides is selected by default; choose another template to start from a different deck.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((template) => {
              const selected = template.id === selectedTemplateId;
              const isDefault = template.id === DEFAULT_PRESENTATION_TEMPLATE_ID;

              return (
                <label
                  key={template.id}
                  aria-label={`${template.name}${isDefault ? " default template" : ""}${selected ? " selected" : ""}`}
                  className={`luma-select-card grid min-h-32 cursor-pointer gap-3 rounded-2xl border p-5 text-sm transition ${
                    selected ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/45" : "bg-background/70 hover:border-primary/40"
                  }`}
                >
                  <input
                    checked={selected}
                    className="sr-only"
                    onChange={() => setSelectedTemplateId(template.id)}
                    type="radio"
                    value={template.id}
                  />
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-lg font-medium">{template.name}</span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {isDefault ? (
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Default
                        </span>
                      ) : null}
                      {selected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground">
                          <CheckCircle2 className="size-3" />
                          Selected
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{template.description}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    source · {template.sourceFile}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="lg" type="submit">
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? "Creating presentation…" : "Create presentation"}
    </Button>
  );
}
