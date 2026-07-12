import type { HermesActivityData } from "@/lib/chat/messages";

export type BuilderSplitLayout = {
  chat: number;
  preview: number;
};

export type ActivityGroup = {
  title: string;
  status: "running" | "succeeded" | "failed" | "warning";
  count: number;
  details: string[];
};

export const DEFAULT_BUILDER_SPLIT_LAYOUT: BuilderSplitLayout = { chat: 38, preview: 62 };

export function getBuilderLayoutStorageKey(projectId: string) {
  return `apploop:builder-layout:${projectId}`;
}

export function parseBuilderSplitLayout(value: string | null): BuilderSplitLayout {
  if (!value) {
    return DEFAULT_BUILDER_SPLIT_LAYOUT;
  }

  try {
    const parsed = JSON.parse(value) as Partial<BuilderSplitLayout>;

    if (isValidPanelSize(parsed.chat) && isValidPanelSize(parsed.preview)) {
      return { chat: parsed.chat, preview: parsed.preview };
    }
  } catch {
    return DEFAULT_BUILDER_SPLIT_LAYOUT;
  }

  return DEFAULT_BUILDER_SPLIT_LAYOUT;
}

export function serializeBuilderSplitLayout(layout: BuilderSplitLayout) {
  return JSON.stringify({ chat: Math.round(layout.chat), preview: Math.round(layout.preview) });
}

export function groupHermesActivities(activities: HermesActivityData[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();

  for (const activity of activities) {
    const title = getActivityGroupTitle(activity);
    const existing = groups.get(title) ?? { title, status: "succeeded", count: 0, details: [] } satisfies ActivityGroup;

    existing.count += 1;

    if (activity.detail) {
      existing.details.push(activity.detail);
    }

    existing.status = mergeActivityStatus(existing.status, activity.status ?? "succeeded");
    groups.set(title, existing);
  }

  return Array.from(groups.values());
}

export function getRuntimeStateCopy(status: "stopped" | "starting" | "running" | "failed", buildState: "idle" | "compiling" | "failed") {
  if (status === "starting") {
    return { title: "Preview starting", detail: "AppLoop is booting the generated project runtime." };
  }

  if (buildState === "compiling") {
    return { title: "Preview compiling", detail: "Next.js is rebuilding changed files. The preview will update shortly." };
  }

  if (status === "failed" || buildState === "failed") {
    return { title: "Preview failed", detail: "Review the runtime log below, repair the project, then restart the preview." };
  }

  if (status === "stopped") {
    return { title: "Preview stopped", detail: "Start the runtime to load this project in the isolated preview frame." };
  }

  return { title: "Preview running", detail: "The generated project is available in the isolated preview frame." };
}

function getActivityGroupTitle(activity: HermesActivityData) {
  if (activity.kind === "tool-start" || activity.kind === "tool-complete") {
    return activity.title.toLowerCase().includes("read") || activity.title.toLowerCase().includes("inspect") ? "Inspecting project" : "Using tools";
  }

  if (activity.kind === "file-change") {
    return "Editing files";
  }

  if (activity.kind === "command") {
    return "Running checks";
  }

  return "Updating preview";
}

function mergeActivityStatus(current: ActivityGroup["status"], next: HermesActivityData["status"]) {
  if (current === "failed" || next === "failed") {
    return "failed";
  }

  if (current === "running" || next === "running") {
    return "running";
  }

  return current;
}

function isValidPanelSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 18 && value <= 82;
}