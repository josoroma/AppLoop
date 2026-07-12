"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRuntimeService } from "@/lib/runtime/store";

export async function startRuntimeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getRuntimeService().startProject(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function stopRuntimeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getRuntimeService().stopProject(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function stopRuntimeAndReturnHomeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getRuntimeService().stopProject(projectId);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect("/projects");
}

export async function restartRuntimeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  await getRuntimeService().restartProject(projectId);
  revalidatePath(`/projects/${projectId}`);
}