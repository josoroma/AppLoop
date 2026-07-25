import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SqlitePresentationRepository } from "@/lib/presentations/repository";
import { resolvePresentationsRoot } from "@/lib/presentations/files";
import { assertPresentationTemplate, DEFAULT_PRESENTATION_TEMPLATE_ID } from "@/lib/presentations/templates";
import { assertInsideRoot, toSafePathSegment } from "@/lib/security/paths";
import { createUniqueSlug, reserveHermesSessionId } from "@/lib/projects/service";

const createPresentationInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  templateId: z.string().trim().min(1).default(DEFAULT_PRESENTATION_TEMPLATE_ID),
});

export type CreatePresentationInput = z.infer<typeof createPresentationInputSchema>;

export function resolvePresentationWorkspacePath(presentationsRoot: string, slug: string) {
  const root = resolvePresentationsRoot(presentationsRoot);
  return assertInsideRoot(root, path.join(root, toSafePathSegment(slug)));
}

export function formatPresentationWorkspacePath(workspacePath: string, basePath = process.cwd()) {
  const relativePath = path.isAbsolute(workspacePath) ? path.relative(basePath, workspacePath) : workspacePath;

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return path.basename(workspacePath);
  }

  return relativePath.split(path.sep).join("/");
}

export class PresentationService {
  constructor(private readonly repository: SqlitePresentationRepository) {}

  async createPresentation(input: CreatePresentationInput, presentationsRoot: string) {
    const parsed = createPresentationInputSchema.parse(input);
    const template = assertPresentationTemplate(parsed.templateId);
    const existing = await this.repository.listPresentations();
    const slug = createUniqueSlug(
      parsed.name,
      existing.map((row) => row.slug),
    );
    const presentationId = randomUUID();
    const conversationId = randomUUID();
    const workspacePath = resolvePresentationWorkspacePath(presentationsRoot, slug);
    const hermesSessionId = reserveHermesSessionId(conversationId);

    return {
      overview: await this.repository.createPresentationBundle({
        presentation: {
          id: presentationId,
          name: parsed.name,
          slug,
          workspacePath,
          templateId: template.id,
          sourceFile: template.sourceFile,
          hermesSessionId,
          activeConversationId: conversationId,
          status: "active",
        },
        conversation: {
          id: conversationId,
          presentationId,
          hermesSessionId,
          title: `${parsed.name} chat`,
          status: "active",
        },
      }),
      template,
    };
  }

  async listActivePresentations() {
    return this.repository.listPresentationOverviews("active");
  }

  async listArchivedPresentations() {
    return this.repository.listPresentationOverviews("archived");
  }

  async findPresentationOverview(presentationId: string) {
    return this.repository.findPresentationOverviewById(presentationId);
  }

  async archivePresentation(presentationId: string) {
    await this.repository.updatePresentationStatus(presentationId, "archived");
  }

  async restorePresentation(presentationId: string) {
    await this.repository.updatePresentationStatus(presentationId, "active");
  }

  async markDeleted(presentationId: string) {
    await this.repository.updatePresentationStatus(presentationId, "deleted");
  }

  async openPresentation(presentationId: string) {
    await this.repository.touchPresentation(presentationId);
    return this.findPresentationOverview(presentationId);
  }
}
