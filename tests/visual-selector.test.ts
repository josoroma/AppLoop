import { describe, expect, it } from "vitest";
import {
  createVisualSelectionPrompt,
  getClassNameLabel,
  getClassNameSelector,
  getPreferredSelector,
  parseVisualSelection,
  stripSensitiveText,
  validateBuilderId,
} from "@/lib/visual-selector/types";

const selection = {
  projectId: "project-1",
  previewNonce: "nonce-123456",
  route: "/dashboard",
  tagName: "SECTION",
  classNames: ["rounded-lg", "analytics-card"],
  preferredSelector: ".analytics-card",
  inspectorId: "dashboard-analytics-card",
  componentName: "AnalyticsCard",
  textPreview: "Revenue summary",
  ancestry: [{ tagName: "MAIN", classNames: ["dashboard-content"], inspectorId: "dashboard-main" }],
  boundingRect: { x: 10, y: 20, width: 320, height: 180 },
};

describe("E9 visual element selection", () => {
  it("validates rich visual selection payloads", () => {
    expect(parseVisualSelection(selection)).toEqual({
      ...selection,
      tagName: "section",
      ancestry: [{ tagName: "main", classNames: ["dashboard-content"], inspectorId: "dashboard-main" }],
    });
    expect(parseVisualSelection({ ...selection, boundingRect: { ...selection.boundingRect, x: -12, y: -80 } })).toMatchObject({
      boundingRect: { x: -12, y: -80, width: 320, height: 180 },
    });
    expect(parseVisualSelection({ ...selection, projectId: "" })).toBeNull();
  });

  it("prefers class selectors for visual targeting", () => {
    expect(getPreferredSelector(parseVisualSelection(selection)!)).toBe(".analytics-card");
    expect(getPreferredSelector({ classNames: ["rounded-lg"], inspectorId: "dashboard-analytics-card", preferredSelector: "section" })).toBe(".rounded-lg");
    expect(getClassNameSelector(parseVisualSelection(selection)!)).toBe(".analytics-card");
    expect(getClassNameLabel(parseVisualSelection(selection)!)).toBe(".rounded-lg .analytics-card");
  });

  it("strips sensitive text and appends selection context for Hermes", () => {
    expect(stripSensitiveText("token bearer abc.def")).toBe("[redacted]");
    expect(createVisualSelectionPrompt("Make this compact", parseVisualSelection(selection)!)).toContain('"preferredSelector":".analytics-card"');
    expect(createVisualSelectionPrompt("Make this compact", parseVisualSelection(selection)!)).toContain("Target classname: .rounded-lg .analytics-card");
    expect(createVisualSelectionPrompt("Make this compact", parseVisualSelection(selection)!)).toContain("contains the classname selector .analytics-card");
  });

  it("validates stable inspector id format", () => {
    expect(validateBuilderId("dashboard-revenue-card")).toBe(true);
    expect(validateBuilderId("DashboardRevenueCard")).toBe(false);
  });
});