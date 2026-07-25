/**
 * Seed script: creates one demo presentation per built-in Marp template so
 * presentations show up in AppLoop immediately after `make seed`.
 *
 * Usage: npx tsx scripts/seed-presentations.mts
 */

import { createDatabase } from "@/lib/db";
import { createPresentationWorkspace } from "@/lib/presentations/files";
import { SqlitePresentationRepository } from "@/lib/presentations/repository";
import { PresentationService } from "@/lib/presentations/service";
import { BUILT_IN_PRESENTATION_TEMPLATES } from "@/lib/presentations/templates";

const PRESENTATIONS_ROOT = process.env.PRESENTATIONS_ROOT ?? ".apploop/presentations";
const DATABASE_URL = process.env.DATABASE_URL ?? "file:.apploop/builder.sqlite";

async function main() {
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