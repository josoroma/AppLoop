"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env/server";
import {
  createProjectWorkspace,
  duplicateProjectWorkspace,
  moveProjectWorkspaceToTrash,
} from "@/lib/projects/files";
import { projectSettingsInputSchema } from "@/lib/projects/service";
import { getProjectService } from "@/lib/projects/store";
import { assertProjectTemplate, DEFAULT_PROJECT_TEMPLATE_ID } from "@/lib/projects/templates";
import { getRuntimeService } from "@/lib/runtime/store";
import { applyThemeToWorkspace } from "@/lib/themes/apply";
import { assertProjectTheme, CUSTOM_THEME_ID, DEFAULT_THEME_ID, resolveProjectTheme } from "@/lib/themes/registry";

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const templateId = String(formData.get("templateId") ?? DEFAULT_PROJECT_TEMPLATE_ID);
  const themeId = String(formData.get("themeId") ?? DEFAULT_THEME_ID);
  const projectService = getProjectService();
  const template = assertProjectTemplate(templateId);
  const theme = assertProjectTheme(themeId);
  const project = await projectService.createProject({ name, themeId }, getServerEnv().PROJECTS_ROOT);

  await createProjectWorkspace(getServerEnv().PROJECTS_ROOT, project.project.workspacePath, { template, theme });
  await projectService.rememberLastOpenedProject(project.project.id);
  revalidatePath("/projects");
  redirect(`/projects/${project.project.id}`);
}

export async function openProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getProjectService().rememberLastOpenedProject(projectId);
  redirect(`/projects/${projectId}`);
}

export async function renameProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "");

  await getProjectService().renameProject({ projectId, name });
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function archiveProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getRuntimeService().stopProject(projectId);
  await getProjectService().archiveProject(projectId);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function restoreProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getProjectService().restoreProject(projectId);
  revalidatePath("/projects");
}

export async function deleteProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "");
  const overview = await getProjectService().findProjectOverview(projectId);

  if (overview) {
    if (confirmName !== overview.project.name) {
      redirect(`/projects?deleteError=${encodeURIComponent(projectId)}`);
    }

    await getRuntimeService().stopProject(projectId);
    await moveProjectWorkspaceToTrash(getServerEnv().PROJECTS_ROOT, overview.project.workspacePath, projectId);
  }

  await getProjectService().deleteProject(projectId);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function duplicateProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const overview = await getProjectService().findProjectOverview(projectId);

  if (!overview) {
    throw new Error("Project not found.");
  }

  const duplicatedProject = await getProjectService().duplicateProject(projectId);

  await duplicateProjectWorkspace(overview.project.workspacePath, duplicatedProject.project.workspacePath);
  revalidatePath("/projects");
  redirect(`/projects/${duplicatedProject.project.id}`);
}

export async function updateProjectSettingsAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const themeId = String(formData.get("themeId") ?? DEFAULT_THEME_ID);
  const customThemeCss = String(formData.get("customThemeCss") ?? "").trim();
  const settings = projectSettingsInputSchema.parse({
    projectId,
    packageInstallPolicy: formData.get("packageInstallPolicy"),
    validationDepth: formData.get("validationDepth"),
    autoStartPreview: formData.get("autoStartPreview") === "on",
    defaultRoute: formData.get("defaultRoute") ?? "/",
    themeId,
    customThemeCss: customThemeCss.length > 0 ? customThemeCss : undefined,
  });
  const projectService = getProjectService();

  await projectService.updateProjectSettings(settings);
  await projectService.updateProjectTheme(settings);

  const overview = await projectService.findProjectOverview(projectId);

  if (overview) {
    const selectedTheme = resolveProjectTheme(customThemeCss.length > 0 ? CUSTOM_THEME_ID : themeId, overview.theme?.tokenJson);
    await applyThemeToWorkspace(overview.project.workspacePath, selectedTheme);
  }

  revalidatePath(`/projects/${projectId}`);
}