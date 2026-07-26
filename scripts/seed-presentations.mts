/**
 * Seed script: creates one demo presentation per built-in Marp template so
 * presentations show up in AppLoop immediately after `make seed`.
 *
 * Usage: npx tsx scripts/seed-presentations.mts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "@/lib/db";
import { createPresentationWorkspace, resolvePresentationSourcePath } from "@/lib/presentations/files";
import { countMarpSlides } from "@/lib/presentations/marp-utils";
import { renderMarpDeck } from "@/lib/presentations/marp";
import { SqlitePresentationRepository } from "@/lib/presentations/repository";
import { PresentationService } from "@/lib/presentations/service";
import { BUILT_IN_PRESENTATION_TEMPLATES, type PresentationTemplate } from "@/lib/presentations/templates";

const PRESENTATIONS_ROOT = process.env.PRESENTATIONS_ROOT ?? ".apploop/presentations";
const DATABASE_URL = process.env.DATABASE_URL ?? "file:.apploop/builder.sqlite";
const PRESENTATION_TEMPLATES_ROOT = path.join(process.cwd(), "presentations-templates");

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validatePresentationTemplate(template: PresentationTemplate) {
  const sourcePath = path.join(PRESENTATION_TEMPLATES_ROOT, template.templatePath, template.sourceFile);
  let markdown = "";
  try {
    markdown = await fs.readFile(sourcePath, "utf8");
  } catch {
    throw new Error(`Presentation template "${template.id}" is missing source file: ${sourcePath}`);
  }

  const slideCount = countMarpSlides(markdown);
  if (slideCount < 1) {
    throw new Error(`Presentation template "${template.id}" must contain at least one Marp slide.`);
  }

  try {
    await renderMarpDeck(markdown, { slide: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Presentation template "${template.id}" failed Marp render validation: ${message}`);
  }

  return { sourcePath, slideCount };
}

async function assertPresentationTemplateBlueprints() {
  const entries = await fs.readdir(PRESENTATION_TEMPLATES_ROOT, { withFileTypes: true });
  const sourceTemplatePaths = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const registeredPaths = new Set(BUILT_IN_PRESENTATION_TEMPLATES.map((template) => template.templatePath));
  const unregisteredPaths = sourceTemplatePaths.filter((templatePath) => !registeredPaths.has(templatePath));

  if (unregisteredPaths.length > 0) {
    throw new Error(
      `Unregistered presentation template blueprint(s): ${unregisteredPaths.join(", ")}. Add them to BUILT_IN_PRESENTATION_TEMPLATES before seeding.`,
    );
  }

  for (const template of BUILT_IN_PRESENTATION_TEMPLATES) {
    const { slideCount } = await validatePresentationTemplate(template);
    console.log(`  ✓ ${template.id} (${slideCount} slide${slideCount === 1 ? "" : "s"})`);
  }

  console.log(`✅ Verified ${BUILT_IN_PRESENTATION_TEMPLATES.length} presentation template blueprint(s).`);
}

async function ensureExistingSeedWorkspace(template: PresentationTemplate, overview: Awaited<ReturnType<PresentationService["listActivePresentations"]>>[number]) {
  const sourcePath = resolvePresentationSourcePath(overview.presentation.workspacePath, overview.presentation.sourceFile);
  if (await pathExists(sourcePath)) {
    console.log(`  ⏭  Skipping "${template.name}" — already exists`);
    return "skipped" as const;
  }

  const workspaceExists = await pathExists(overview.presentation.workspacePath);
  if (workspaceExists) {
    console.log(
      `  ⚠️  "${template.name}" exists in DB but is missing ${overview.presentation.sourceFile}; leaving workspace untouched: ${overview.presentation.workspacePath}`,
    );
    return "broken" as const;
  }

  await createPresentationWorkspace(PRESENTATIONS_ROOT, overview.presentation.workspacePath, { template });
  console.log(`  🔧 Repaired "${template.name}" workspace → ${overview.presentation.workspacePath}`);
  return "repaired" as const;
}

async function main() {
  await assertPresentationTemplateBlueprints();

  const db = createDatabase(DATABASE_URL);
  const repository = new SqlitePresentationRepository(db);
  const service = new PresentationService(repository);

  const existingPresentations = await service.listActivePresentations();
  const existingByTemplateName = new Map(existingPresentations.map((overview) => [overview.presentation.name, overview]));

  const toSeed = [];
  let repaired = 0;
  let broken = 0;

  for (const template of BUILT_IN_PRESENTATION_TEMPLATES) {
    const existing = existingByTemplateName.get(template.name);
    if (!existing) {
      toSeed.push(template);
      continue;
    }

    const state = await ensureExistingSeedWorkspace(template, existing);
    if (state === "repaired") repaired += 1;
    if (state === "broken") broken += 1;
  }

  if (toSeed.length === 0) {
    console.log(`✅ All presentation templates already seeded.${repaired ? ` Repaired ${repaired} workspace(s).` : ""}`);
    if (broken > 0) process.exitCode = 1;
    return;
  }

  console.log(`🌱 Seeding ${toSeed.length} presentation(s) from templates...\n`);

  let created = 0;

  for (const template of toSeed) {
    let createdPresentationId: string | null = null;
    try {
      const result = await service.createPresentation(
        { name: template.name, templateId: template.id },
        PRESENTATIONS_ROOT,
      );
      createdPresentationId = result.overview.presentation.id;

      await createPresentationWorkspace(PRESENTATIONS_ROOT, result.overview.presentation.workspacePath, {
        template,
      });

      created += 1;
      console.log(
        `  ✅ "${template.name}" → /presentations/${result.overview.presentation.id} (template: ${template.id})`,
      );
    } catch (error) {
      if (createdPresentationId) {
        await repository.deletePresentation(createdPresentationId);
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed to seed "${template.name}": ${message}`);
    }
  }

  console.log(`\n🎉 Seeded ${created}/${toSeed.length} presentation(s).${repaired ? ` Repaired ${repaired} workspace(s).` : ""}`);
  if (broken > 0 || created !== toSeed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Presentation seed failed:", error);
  process.exit(1);
});