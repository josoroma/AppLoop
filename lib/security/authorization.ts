import type { ProjectOverview, ProjectRepository } from "@/lib/db/repository";

export class ProjectAccessError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
  }
}

export async function requireProjectAccess(repository: Pick<ProjectRepository, "findProjectOverviewById">, projectId: string): Promise<ProjectOverview> {
  const overview = await repository.findProjectOverviewById(projectId);

  if (!overview || overview.project.status !== "active") {
    throw new ProjectAccessError("Project access denied.");
  }

  return overview;
}

export function projectAccessErrorResponse(error: unknown) {
  if (error instanceof ProjectAccessError) {
    return new Response("Project access denied.", { status: error.status });
  }

  throw error;
}