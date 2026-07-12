import { createDatabase } from "@/lib/db";
import { getServerEnv } from "@/lib/env/server";
import { SqliteProjectRepository } from "@/lib/projects/repository";
import { ProjectService } from "@/lib/projects/service";

let repository: SqliteProjectRepository | null = null;
let service: ProjectService | null = null;

export function getProjectRepository() {
  if (!repository) {
    repository = new SqliteProjectRepository(createDatabase(getServerEnv().DATABASE_URL));
  }

  return repository;
}

export function getProjectService() {
  if (!service) {
    service = new ProjectService(getProjectRepository());
  }

  return service;
}