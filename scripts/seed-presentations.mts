/**
 * Seed script: creates one demo presentation per built-in Marp template so
 * presentations show up in AppLoop immediately after `make seed`.
 *
 * Usage: npx tsx scripts/seed-presentations.mts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "@/lib/db";
import { createPresentationWorkspace } from "@/lib/presentations/files";
import { SqlitePresentationRepository } from "@/lib/presentations/repository";
import { PresentationService } from "@/lib/presentations/service";
import { BUILT_IN_PRESENTATION_TEMPLATES } from "@/lib/presentations/templates";

const PRESENTATIONS_ROOT = process.env.PRESENTATIONS_ROOT ?? ".apploop/presentations";
const DATABASE_URL = process.env.DATABASE_URL ?? "file:.apploop/builder.sqlite";
const PRESENTATION_TEMPLATES_ROOT = path.join(process.cwd(), "presentations-templates");

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
    const sourcePath = path.join(PRESENTATION_TEMPLATES_ROOT, template.templatePath, template.sourceFile);
    try {
      await fs.access(sourcePath);
    } catch {
      throw new Error(`Presentation template "${template.id}" is missing source file: ${sourcePath}`);
    }
  }

  console.log(`✅ Verified ${BUILT_IN_PRESENTATION_TEMPLATES.length} presentation template blueprint(s).`);
}

async function main() {
  await assertPresentationTemplateBlueprints();

  const db = createDatabase(DATABASE_URL);
  const repository = new SqlitePresentationRepository(db);
  const service = new PresentationService(repository);

  const existingPresentations = await service.listActivePresentations();
  const existingNames = new Set(existingPresentations.map(({ presentation }) => presentation.name));

  const toSeed = BUILT_IN_PRESENTATION_TEMPLATES.filter((template) => {
    if (existingNames.has(template.name)) {
      console.log(`  ⏭  Skipping "${template.name}" — already exists`);
      return false;
    }

    return true;
  });

  if (toSeed.length === 0) {
    console.log("✅ All presentation templates already seeded.");
    return;
  }

  console.log(`🌱 Seeding ${toSeed.length} presentation(s) from templates...\n`);

  let created = 0;

  for (const template of toSeed) {
    try {
      const result = await service.createPresentation(
        { name: template.name, templateId: template.id },
        PRESENTATIONS_ROOT,
      );

      await createPresentationWorkspace(PRESENTATIONS_ROOT, result.overview.presentation.workspacePath, {
        template,
      });

      created += 1;
      console.log(
        `  ✅ "${template.name}" → /presentations/${result.overview.presentation.id} (template: ${template.id})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed to seed "${template.name}": ${message}`);
    }
  }

  console.log(`\n🎉 Seeded ${created}/${toSeed.length} presentation(s).`);
}

main().catch((error) => {
  console.error("Presentation seed failed:", error);
  process.exit(1);
});