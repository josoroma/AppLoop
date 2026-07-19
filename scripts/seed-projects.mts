/**
 * Seed script: creates one demo project per template so each built-in
 * template shows up in the AppLoop builder immediately after `make seed`.
 *
 * Usage: npx tsx scripts/seed-projects.mts
 */

import { createDatabase } from "@/lib/db";
import { BUILT_IN_PROJECT_TEMPLATES } from "@/lib/projects/templates";
import { ProjectService } from "@/lib/projects/service";
import { SqliteProjectRepository } from "@/lib/projects/repository";
import { createProjectWorkspace } from "@/lib/projects/files";
import { getProjectTheme } from "@/lib/themes/registry";

const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? ".apploop/projects";
const DATABASE_URL = process.env.DATABASE_URL ?? "file:.apploop/builder.sqlite";
const PREVIEW_PORT_START = Number(process.env.PREVIEW_PORT_START ?? "3100");
const PREVIEW_PORT_END = Number(process.env.PREVIEW_PORT_END ?? "3199");

async function main() {
  const db = createDatabase(DATABASE_URL);
  const repository = new SqliteProjectRepository(db);
  const service = new ProjectService(repository, {
    start: PREVIEW_PORT_START,
    end: PREVIEW_PORT_END,
  });

  const existingProjects = await service.listProjects();
  const existingNames = new Set(existingProjects.map((p) => p.name));

  const toSeed = BUILT_IN_PROJECT_TEMPLATES.filter((tpl) => {
    if (existingNames.has(tpl.name)) {
      console.log(`  ⏭  Skipping "${tpl.name}" — already exists`);
      return false;
    }
    return true;
  });

  if (toSeed.length === 0) {
    console.log("✅ All templates already seeded.");
    return;
  }

  console.log(`🌱 Seeding ${toSeed.length} project(s) from templates...\n`);

  let created = 0;

  for (const tpl of toSeed) {
    const themeId = tpl.defaultThemeId;
    const theme = getProjectTheme(themeId);

    if (!theme) {
      console.log(`  ❌ Theme "${themeId}" not found for "${tpl.name}" — skipping`);
      continue;
    }

    try {
      const result = await service.createProject(
        { name: tpl.name, themeId },
        PROJECTS_ROOT,
      );

      await createProjectWorkspace(PROJECTS_ROOT, result.project.workspacePath, {
        template: tpl,
        theme,
      });

      created += 1;
      console.log(
        `  ✅ "${tpl.name}" → /projects/${result.project.id} (template: ${tpl.id}, port: ${result.project.previewPort})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed to seed "${tpl.name}": ${message}`);
    }
  }

  console.log(`\n🎉 Seeded ${created}/${toSeed.length} project(s).`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});