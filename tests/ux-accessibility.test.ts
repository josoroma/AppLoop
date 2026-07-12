import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUILDER_SPLIT_LAYOUT,
  getBuilderLayoutStorageKey,
  getRuntimeStateCopy,
  groupHermesActivities,
  parseBuilderSplitLayout,
  serializeBuilderSplitLayout,
} from "@/lib/builder/ux";

describe("E16 UX, accessibility, and responsiveness", () => {
  it("defaults and persists the builder split layout", () => {
    expect(DEFAULT_BUILDER_SPLIT_LAYOUT).toEqual({ chat: 38, preview: 62 });
    expect(getBuilderLayoutStorageKey("project-1")).toBe("apploop:builder-layout:project-1");
    expect(parseBuilderSplitLayout(null)).toEqual(DEFAULT_BUILDER_SPLIT_LAYOUT);
    expect(parseBuilderSplitLayout('{"chat":42,"preview":58}')).toEqual({ chat: 42, preview: 58 });
    expect(parseBuilderSplitLayout('{"chat":5,"preview":95}')).toEqual(DEFAULT_BUILDER_SPLIT_LAYOUT);
    expect(serializeBuilderSplitLayout({ chat: 37.6, preview: 62.4 })).toBe('{"chat":38,"preview":62}');
  });

  it("groups agent activities into understandable status cards", () => {
    expect(
      groupHermesActivities([
        { kind: "tool-start", title: "Read app/page.tsx", detail: "app/page.tsx", status: "running" },
        { kind: "tool-complete", title: "Inspect components", detail: "components/builder", status: "succeeded" },
        { kind: "file-change", title: "Updated file", detail: "components/builder/builder-shell.tsx", status: "succeeded" },
        { kind: "command", title: "npm run lint", detail: "eslint", status: "failed" },
      ]),
    ).toMatchObject([
      { title: "Inspecting project", count: 2, status: "running" },
      { title: "Editing files", count: 1, status: "succeeded" },
      { title: "Running checks", count: 1, status: "failed" },
    ]);
  });

  it("returns explicit preview state copy", () => {
    expect(getRuntimeStateCopy("starting", "idle").title).toBe("Preview starting");
    expect(getRuntimeStateCopy("running", "compiling").title).toBe("Preview compiling");
    expect(getRuntimeStateCopy("failed", "idle").title).toBe("Preview failed");
    expect(getRuntimeStateCopy("stopped", "idle").title).toBe("Preview stopped");
  });
});