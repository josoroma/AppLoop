"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env/server";
import {
  createPresentationWorkspace,
  movePresentationWorkspaceToTrash,
  writePresentationMarkdown,
} from "@/lib/presentations/files";
import { getPresentationService, getPresentationRepository } from "@/lib/presentations/store";
import { assertPresentationTemplate } from "@/lib/presentations/templates";
import { moveMarpSlideBlock, removeMarpSlideElement } from "@/lib/presentations/marp-utils";

export async function createPresentationAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const templateId = String(formData.get("templateId") ?? "simple-3-slides");
  const presentationsRoot = getServerEnv().PRESENTATIONS_ROOT;
  const service = getPresentationService();
  const { overview, template } = await service.createPresentation({ name, templateId }, presentationsRoot);

  await createPresentationWorkspace(presentationsRoot, overview.presentation.workspacePath, {
    template: assertPresentationTemplate(template.id),
  });

  revalidatePath("/presentations");
  redirect(`/presentations/${overview.presentation.id}`);
}

export async function openPresentationAction(formData: FormData) {
  const presentationId = String(formData.get("presentationId") ?? "");
  await getPresentationService().openPresentation(presentationId);
  revalidatePath("/presentations");
  redirect(`/presentations/${presentationId}`);
}

export async function archivePresentationAction(formData: FormData) {
  const presentationId = String(formData.get("presentationId") ?? "");
  await getPresentationService().archivePresentation(presentationId);
  revalidatePath("/presentations");
}

export async function restorePresentationAction(formData: FormData) {
  const presentationId = String(formData.get("presentationId") ?? "");
  await getPresentationService().restorePresentation(presentationId);
  revalidatePath("/presentations");
}

export async function deletePresentationAction(formData: FormData) {
  const presentationId = String(formData.get("presentationId") ?? "");
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview) {
    redirect("/presentations");
  }

  try {
    await movePresentationWorkspaceToTrash(
      getServerEnv().PRESENTATIONS_ROOT,
      overview.presentation.workspacePath,
      presentationId,
    );
    await getPresentationRepository().deletePresentation(presentationId);
  } catch {
    redirect(`/presentations?deleteError=${encodeURIComponent(presentationId)}`);
  }

  revalidatePath("/presentations");
  redirect("/presentations");
}

export async function savePresentationMarkdownAction(formData: FormData) {
  const presentationId = String(formData.get("presentationId") ?? "");
  const markdown = String(formData.get("markdown") ?? "");
  const overview = await getPresentationService().findPresentationOverview(presentationId);

  if (!overview || overview.presentation.status === "deleted") {
    throw new Error("Presentation not found.");
  }

  await writePresentationMarkdown(
    overview.presentation.workspacePath,
    markdown,
    overview.presentation.sourceFile,
  );
  await getPresentationService().openPresentation(presentationId);
  revalidatePath(`/presentations/${presentationId}`);
}

export async function applyPresentationInspectStylesAction(input: {
  presentationId: string;
  targets: Array<{
    slide: number;
    tag: string;
    text: string;
    path: string;
    style: Record<string, string | undefined>;
  }>;
}) {
  const overview = await getPresentationService().findPresentationOverview(input.presentationId);
  if (!overview || overview.presentation.status === "deleted") {
    throw new Error("Presentation not found.");
  }

  const {
    applyPresentationElementStylesToMarkdown,
    PresentationElementStyleSchema,
  } = await import("@/lib/presentations/inspect-styles");
  const { readPresentationMarkdown } = await import("@/lib/presentations/files");

  const markdown = await readPresentationMarkdown(
    overview.presentation.workspacePath,
    overview.presentation.sourceFile,
  );

  const targets = input.targets.map((target) => ({
    slide: target.slide,
    tag: target.tag,
    text: target.text,
    path: target.path,
    style: PresentationElementStyleSchema.parse(target.style ?? {}),
  }));

  if (targets.length === 0) {
    throw new Error("No style targets to save.");
  }

  const result = applyPresentationElementStylesToMarkdown(markdown, targets);
  await writePresentationMarkdown(
    overview.presentation.workspacePath,
    result.markdown,
    overview.presentation.sourceFile,
  );
  await getPresentationService().openPresentation(input.presentationId);
  revalidatePath(`/presentations/${input.presentationId}`);
  revalidatePath(`/api/presentations/${input.presentationId}/preview`);

  return {
    ok: true as const,
    classNames: result.classNames,
    sourceFile: overview.presentation.sourceFile,
    previousMarkdown: markdown,
    markdown: result.markdown,
  };
}

export async function organizePresentationElementAction(input: {
  presentationId: string;
  slide: number;
  sourceText: string;
  targetText: string;
  placement: "before" | "after";
}) {
  const overview = await getPresentationService().findPresentationOverview(input.presentationId);
  if (!overview || overview.presentation.status === "deleted") {
    throw new Error("Presentation not found.");
  }

  const { readPresentationMarkdown } = await import("@/lib/presentations/files");
  const markdown = await readPresentationMarkdown(
    overview.presentation.workspacePath,
    overview.presentation.sourceFile,
  );
  const nextMarkdown = moveMarpSlideBlock(
    markdown,
    input.slide,
    input.sourceText,
    input.targetText,
    input.placement,
  );
  if (nextMarkdown === markdown) {
    return { ok: false as const, previousMarkdown: markdown, markdown };
  }

  await writePresentationMarkdown(
    overview.presentation.workspacePath,
    nextMarkdown,
    overview.presentation.sourceFile,
  );
  await getPresentationService().openPresentation(input.presentationId);
  revalidatePath(`/presentations/${input.presentationId}`);
  revalidatePath(`/api/presentations/${input.presentationId}/preview`);

  return { ok: true as const, previousMarkdown: markdown, markdown: nextMarkdown };
}

export async function deletePresentationElementAction(input: {
  presentationId: string;
  slide: number;
  text: string;
}) {
  const overview = await getPresentationService().findPresentationOverview(input.presentationId);
  if (!overview || overview.presentation.status === "deleted") {
    throw new Error("Presentation not found.");
  }

  const { splitMarpDocument } = await import("@/lib/presentations/marp");
  const { readPresentationMarkdown } = await import("@/lib/presentations/files");

  const markdown = await readPresentationMarkdown(
    overview.presentation.workspacePath,
    overview.presentation.sourceFile,
  );

  const { frontMatter, slides } = splitMarpDocument(markdown);
  const slideIndex = Math.min(Math.max(input.slide, 1), slides.length) - 1;
  const slideMarkdown = slides[slideIndex] ?? "";

  let cleaned = removeMarpSlideElement(slideMarkdown, input.text);

  if (!cleaned) cleaned = "";

  const nextSlides = [...slides];
  nextSlides[slideIndex] = cleaned;

  // Remove orphaned managed CSS entries for this slide's wrappers that no longer exist.
  const { parseManagedStyleEntries, stylesToCssBlock, upsertFrontMatterStyleBlock } =
    await import("@/lib/presentations/inspect-styles");
  const entries = parseManagedStyleEntries(markdown);
  const bodyMarkdown = nextSlides.join("\n\n---\n\n");
  const stillReferenced = new Set(bodyMarkdown.match(/apploop-el-[a-z0-9]+/g) ?? []);
  const kept = entries.filter((entry) => stillReferenced.has(entry.className));
  const cssBlock = stylesToCssBlock(kept);
  const nextFm = upsertFrontMatterStyleBlock(frontMatter, cssBlock);
  const nextMarkdown = [nextFm, "", bodyMarkdown, ""].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  await writePresentationMarkdown(
    overview.presentation.workspacePath,
    nextMarkdown,
    overview.presentation.sourceFile,
  );

  await getPresentationService().openPresentation(input.presentationId);
  revalidatePath(`/presentations/${input.presentationId}`);
  revalidatePath(`/api/presentations/${input.presentationId}/preview`);

  return { ok: true as const, previousMarkdown: markdown, markdown: nextMarkdown };
}

export async function replacePresentationElementTextAction(input: {
  presentationId: string;
  slide: number;
  oldText: string;
  text: string;
}) {
  const overview = await getPresentationService().findPresentationOverview(input.presentationId);
  if (!overview || overview.presentation.status === "deleted") {
    throw new Error("Presentation not found.");
  }

  const { splitMarpDocument } = await import("@/lib/presentations/marp");
  const { readPresentationMarkdown } = await import("@/lib/presentations/files");

  const markdown = await readPresentationMarkdown(
    overview.presentation.workspacePath,
    overview.presentation.sourceFile,
  );

  const { frontMatter, slides } = splitMarpDocument(markdown);
  const slideIndex = Math.min(Math.max(input.slide, 1), slides.length) - 1;
  const slideMarkdown = slides[slideIndex] ?? "";
  const oldText = input.oldText.trim();
  const nextText = input.text.trim();
  if (!oldText || !nextText) {
    throw new Error("Missing text to replace.");
  }

  const exactIndex = slideMarkdown.indexOf(oldText);
  let nextSlide = exactIndex >= 0
    ? `${slideMarkdown.slice(0, exactIndex)}${nextText}${slideMarkdown.slice(exactIndex + oldText.length)}`
    : slideMarkdown.replace(
      new RegExp(oldText.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")),
      nextText,
    );
  if (nextSlide === slideMarkdown) {
    // Rendered text differs from source when the block contains markup
    // (**bold**, `code`, _em_). Allow markup characters between the
    // rendered characters so the edit still lands.
    const tolerant = new RegExp(
      oldText
        .split(/\s+/)
        .map((token) => token.split("").map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[`*_~]*"))
        .join("[\\s`*_~]+"),
    );
    nextSlide = slideMarkdown.replace(tolerant, nextText);
  }
  if (nextSlide === slideMarkdown) {
    return { ok: false as const, previousMarkdown: markdown, markdown };
  }

  const nextSlides = [...slides];
  nextSlides[slideIndex] = nextSlide;
  const nextMarkdown = [frontMatter, "", nextSlides.join("\n\n---\n\n"), ""].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  await writePresentationMarkdown(
    overview.presentation.workspacePath,
    nextMarkdown,
    overview.presentation.sourceFile,
  );
  await getPresentationService().openPresentation(input.presentationId);
  revalidatePath(`/presentations/${input.presentationId}`);
  revalidatePath(`/api/presentations/${input.presentationId}/preview`);

  return { ok: true as const, previousMarkdown: markdown, markdown: nextMarkdown };
}

export async function deletePresentationSlideAction(input: {
  presentationId: string;
  slideIndex: number;
}) {
  const overview = await getPresentationService().findPresentationOverview(input.presentationId);
  if (!overview || overview.presentation.status === "deleted") {
    throw new Error("Presentation not found.");
  }

  const { splitMarpDocument } = await import("@/lib/presentations/marp");
  const { readPresentationMarkdown } = await import("@/lib/presentations/files");
  const { parseManagedStyleEntries, stylesToCssBlock, upsertFrontMatterStyleBlock } =
    await import("@/lib/presentations/inspect-styles");

  const markdown = await readPresentationMarkdown(
    overview.presentation.workspacePath,
    overview.presentation.sourceFile,
  );

  const { frontMatter, slides } = splitMarpDocument(markdown);
  if (slides.length <= 1) {
    throw new Error("Cannot delete the only slide.");
  }

  const idx = Math.min(Math.max(input.slideIndex, 1), slides.length) - 1;
  const nextSlides = slides.filter((_, i) => i !== idx);

  // Clean orphaned CSS entries.
  const bodyMarkdown = nextSlides.join("\n\n---\n\n");
  const entries = parseManagedStyleEntries(markdown);
  const stillReferenced = new Set(bodyMarkdown.match(/apploop-el-[a-z0-9]+/g) ?? []);
  const kept = entries.filter((entry) => stillReferenced.has(entry.className));
  const cssBlock = stylesToCssBlock(kept);
  const nextFm = upsertFrontMatterStyleBlock(frontMatter, cssBlock);
  const nextMarkdown = [nextFm, "", bodyMarkdown, ""].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  await writePresentationMarkdown(
    overview.presentation.workspacePath,
    nextMarkdown,
    overview.presentation.sourceFile,
  );

  await getPresentationService().openPresentation(input.presentationId);
  revalidatePath(`/presentations/${input.presentationId}`);
  revalidatePath(`/api/presentations/${input.presentationId}/preview`);

  return { ok: true as const };
}
