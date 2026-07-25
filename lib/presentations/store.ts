import { createDatabase } from "@/lib/db";
import { getServerEnv } from "@/lib/env/server";
import { SqlitePresentationRepository } from "@/lib/presentations/repository";
import { PresentationService } from "@/lib/presentations/service";

let repository: SqlitePresentationRepository | null = null;
let service: PresentationService | null = null;

export function getPresentationRepository() {
  if (!repository) {
    repository = new SqlitePresentationRepository(createDatabase(getServerEnv().DATABASE_URL));
  }

  return repository;
}

export function getPresentationService() {
  if (!service) {
    service = new PresentationService(getPresentationRepository());
  }

  return service;
}
