import { describe, expect, it } from "vitest";
import {
  alignmentToStyle,
  applyPresentationElementStylesToMarkdown,
  buildElementClassName,
  parseManagedStyleEntries,
  repairManagedStyleBlock,
  styleToCssRule,
  styleToInlineAttribute,
} from "@/lib/presentations/inspect-styles";

const SAMPLE = `---
marp: true
theme: default
paginate: true
size: 16:9
---

# Provoke curiosity.

A short Marp starter.

---

## Next

- Keep it short
`;

describe("presentation inspect styles", () => {
  it("builds deterministic class names independent of path/tag", () => {
    const a = buildElementClassName({
      slide: 1,
      tag: "h1",
      text: "Provoke curiosity.",
      path: "section > h1",
    });
    const b = buildElementClassName({
      slide: 1,
      tag: "span",
      text: "Provoke curiosity.",
      path: "section > span.apploop-el-xyz",
    });
    expect(a).toBe(b);
    expect(a.startsWith("apploop-el-")).toBe(true);
  });

  it("serializes style rules and inline attributes", () => {
    const style = {
      color: "#fff",
      backgroundImage: "linear-gradient(135deg, #34d399 0%, #38bdf8 100%)",
      backgroundClip: "text",
      webkitBackgroundClip: "text",
      webkitTextFillColor: "transparent",
      fontStyle: "italic",
      textTransform: "uppercase",
      textAlign: "center" as const,
      left: "50%",
      top: "50%",
      position: "absolute" as const,
      transform: "translate(-50%, -50%)",
    };
    const rule = styleToCssRule("apploop-el-test", style);
    expect(rule).toContain(".apploop-el-test {");
    expect(rule).toContain("color: #fff;");
    expect(rule).toContain("background-image: linear-gradient(135deg, #34d399 0%, #38bdf8 100%);");
    expect(rule).toContain("background-clip: text;");
    expect(rule).toContain("-webkit-background-clip: text;");
    expect(rule).toContain("-webkit-text-fill-color: transparent;");
    expect(rule).toContain("font-style: italic;");
    expect(rule).toContain("text-transform: uppercase;");
    expect(styleToInlineAttribute(style)).toContain("left: 50%;");
    expect(styleToInlineAttribute(style)).toContain('position: absolute;');
  });

  it("alignment helpers set absolute placement", () => {
    const style = alignmentToStyle("center", "middle");
    expect(style.position).toBe("absolute");
    expect(style.left).toBe("50%");
    expect(style.top).toBe("50%");
    expect(style.transform).toContain("translate(-50%, -50%)");
  });

  it("persists table styles with a block wrapper and tag-scoped rules that round-trip", () => {
    const deck = `---\nmarp: true\n---\n\n# Metrics\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n| B | 2 |\n\nSummary\n`;
    const target = {
      slide: 1,
      tag: "table",
      text: "Name Value A 1 B 2",
      path: "section > table",
      style: { padding: "12px", border: "2px solid #94a3b8", margin: "24px", width: "420px", display: "inline-block", tableLayout: "auto", borderCollapse: "collapse" },
    };
    const first = applyPresentationElementStylesToMarkdown(deck, [target]);
    const className = first.classNames[0]!;
    expect(first.markdown).toContain(`<div class="${className}">`);
    expect(first.markdown).toContain("</div>");
    expect(first.markdown).toContain(`.${className} > table {`);
    expect(first.markdown).toContain("width: 420px !important;");
    expect(first.markdown).toContain("display: table !important;");
    expect(first.markdown).toContain("table-layout: fixed !important;");
    expect(first.markdown).not.toContain("display: inline-block !important;");
    expect(first.markdown).not.toContain("table-layout: auto !important;");
    expect(first.markdown).toContain(`.${className} th,`);
    expect(first.markdown).toContain("padding: 12px !important;");
    expect(first.markdown).toContain("margin: 24px !important;");
    expect(parseManagedStyleEntries(first.markdown).find((entry) => entry.className === className)?.style.padding).toBe("12px");
    // table rows stay intact inside the wrapper
    expect(first.markdown).toContain("| B | 2 |");

    // second edit merges without duplicating wrappers and keeps earlier props
    const second = applyPresentationElementStylesToMarkdown(first.markdown, [
      { ...target, style: { borderRadius: "8px" } },
    ]);
    expect(second.markdown.match(new RegExp(`<div class="${className}">`, "g"))?.length).toBe(1);
    expect(second.markdown).toContain("border-radius: 8px !important;");
    expect(second.markdown).toContain("padding: 12px !important;");
    expect(second.markdown).not.toContain("!important !important");
  });

  it("defaults persisted table width to full when no resize width is present", () => {
    const deck = `---\nmarp: true\n---\n\n# Metrics\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n`;
    const result = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "table",
        text: "Name Value A 1",
        path: "section > table",
        style: { top: "24%", position: "absolute" },
      },
    ]);

    expect(result.markdown).toContain("width: 100% !important;");
    expect(result.markdown).toContain("display: table !important;");
    expect(result.markdown).toContain("table-layout: fixed !important;");
  });

  it("persists image position and caps image width to the slide", () => {
    const deck = `---\nmarp: true\n---\n\n# Image\n\n![Revenue chart](assets/revenue.png)\n`;
    const target = {
      slide: 1,
      tag: "img",
      text: "![Revenue chart](assets/revenue.png)",
      path: "section > p > img",
      style: { position: "absolute" as const, left: "12%", top: "24%", width: "640px", maxWidth: "100%" },
    };

    const result = applyPresentationElementStylesToMarkdown(deck, [target]);
    const className = result.classNames[0]!;

    expect(result.markdown).toContain(`<div class="${className}">`);
    expect(result.markdown).toContain("![Revenue chart](assets/revenue.png)");
    expect(result.markdown).toContain(`.${className} img {`);
    expect(result.markdown).toContain("max-width: 100% !important;");
    expect(result.markdown).toContain("position: absolute !important;");
    expect(result.markdown).toContain("left: 12% !important;");
    expect(result.markdown).toContain("top: 24% !important;");
    expect(result.markdown).toContain("width: 640px !important;");
    expect(result.markdown).toContain("height: auto !important;");
    expect(parseManagedStyleEntries(result.markdown).find((entry) => entry.className === className)?.tag).toBe("img");
  });

  it("persists image styles when the selection is keyed by image source", () => {
    const deck = `---\nmarp: true\n---\n\n# Image\n\n![Old alt](assets/revenue.png)\n`;
    const result = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "img",
        text: "assets/revenue.png",
        path: "section > p > img",
        style: { position: "absolute", left: "12%", top: "24%", opacity: "0.55" },
      },
    ]);
    const className = result.classNames[0]!;

    expect(result.markdown).toContain(`<div class="${className}">`);
    expect(result.markdown).toContain("![Old alt](assets/revenue.png)");
    expect(result.markdown).toContain(`.${className} img {`);
    expect(result.markdown).toContain("opacity: 0.55 !important;");
  });

  it("persists layer order, visibility, and lock styles", () => {
    const deck = `---\nmarp: true\n---\n\n# Title\n\nBody copy\n`;
    const result = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "h1",
        text: "# Title",
        path: "section > h1",
        style: { position: "relative", zIndex: "2", visibility: "hidden", pointerEvents: "none" },
      },
    ]);

    expect(result.markdown).toContain("z-index: 2;");
    expect(result.markdown).toContain("visibility: hidden;");
    expect(result.markdown).toContain("pointer-events: none;");
  });

  it("persists table padding without creating a border declaration", () => {
    const deck = `---\nmarp: true\n---\n\n# Metrics\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n| B | 2 |\n`;
    const target = {
      slide: 1,
      tag: "table",
      text: "Name Value A 1 B 2",
      path: "section > table",
      style: { padding: "10px" },
    };

    const result = applyPresentationElementStylesToMarkdown(deck, [target]);
    const className = result.classNames[0]!;

    expect(result.markdown).toContain(`.${className} th,`);
    expect(result.markdown).toContain("padding: 10px !important;");
    expect(result.markdown).not.toContain("border: 7px");
    expect(result.markdown).not.toMatch(new RegExp(`\\.${className} th,[\\s\\S]*?border:`));
    expect(parseManagedStyleEntries(result.markdown).find((entry) => entry.className === className)?.style.border).toBeUndefined();
  });

  it("persists list styles on the inner list element", () => {
    const deck = `---\nmarp: true\n---\n\n# Plan\n\n- First\n- Second\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "ul",
        text: "First Second",
        path: "section > ul",
        style: { listStyleType: "square", paddingLeft: "48px" },
      },
    ]);
    expect(markdown).toContain(`<div class="${classNames[0]}">`);
    expect(markdown).toContain(`.${classNames[0]} > ul {`);
    expect(markdown).toContain("list-style-type: square !important;");
    expect(markdown).toContain("padding-left: 48px !important;");
    expect(parseManagedStyleEntries(markdown).find((entry) => entry.className === classNames[0])?.style.listStyleType).toBe("square");
    expect(markdown).toContain("- Second");
  });

  it("persists divider styles on the inner hr element", () => {
    const deck = `---\nmarp: true\n---\n\n# Plan\n\n<hr style="border: 0; height: 1px; background: rgba(255,255,255,0.65); width: 100%; margin: 24px 0;" />\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "hr",
        text: '<hr style="border: 0; height: 1px; background: rgba(255,255,255,0.65); width: 100%; margin: 24px 0;" />',
        path: "section > hr",
        style: { background: "#f8fafc", height: "3px", width: "420px", margin: "32px 0", border: "0" },
      },
    ]);
    expect(markdown).toContain(`<div class="${classNames[0]}">`);
    expect(markdown).toContain(`.${classNames[0]} > hr {`);
    expect(markdown).toContain("background: #f8fafc !important;");
    expect(markdown).toContain("height: 3px !important;");
    expect(markdown).toContain("width: 420px !important;");
    expect(parseManagedStyleEntries(markdown).find((entry) => entry.className === classNames[0])?.tag).toBe("hr");

    const second = applyPresentationElementStylesToMarkdown(markdown, [
      {
        slide: 1,
        tag: "hr",
        text: '<hr style="border: 0; height: 1px; background: rgba(255,255,255,0.65); width: 100%; margin: 24px 0;" />',
        path: `section > div.${classNames[0]} > hr`,
        style: { background: "#f43f5e", height: "5px", border: "0" },
      },
    ]);
    expect(second.markdown).toContain("<hr style=");
    expect(second.markdown).toContain("background: #f43f5e !important;");
    expect(second.markdown).toContain("height: 5px !important;");
    expect(second.markdown.match(new RegExp(`<div class="${classNames[0]}">`, "g"))?.length).toBe(1);
  });

  it("persists SVG shape styles without wrapping the shape", () => {
    const deck = `---\nmarp: true\n---\n\n<svg viewBox="0 0 100 100"><rect data-apploop-shape="card-a" x="0" y="0" width="100" height="100" /></svg>\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "rect",
        text: '<rect data-apploop-shape="card-a" x="0" y="0" width="100" height="100" />',
        path: "section > svg > rect",
        style: { fill: "#f7f7ff", fillOpacity: "0.35", stroke: "#0400ff", strokeLinecap: "round", strokeLinejoin: "bevel", strokeWidth: "3px", opacity: "0.7", transform: "translate(12px, -4px)" },
      },
    ]);
    expect(markdown).toContain(`<rect data-apploop-shape="card-a" x="0" y="0" width="100" height="100" class="${classNames[0]}" style="`);
    expect(markdown).toContain(`.${classNames[0]} {`);
    expect(markdown).toContain("fill: #f7f7ff !important;");
    expect(markdown).toContain("fill-opacity: 0.35 !important;");
    expect(markdown).toContain("stroke: #0400ff !important;");
    expect(markdown).toContain("stroke-linecap: round !important;");
    expect(markdown).toContain("stroke-linejoin: bevel !important;");
    expect(markdown).toContain("stroke-width: 3px !important;");
    expect(markdown).toContain("transform: translate(12px, -4px) !important;");
    expect(markdown).not.toContain(`<div class="${classNames[0]}">`);
  });

  it("persists SVG wrapper movement without moving the inner shape out of its viewport", () => {
    const deck = `---\nmarp: true\n---\n\n<svg viewBox="0 0 100 100" width="100" height="100"><path data-apploop-shape="spark-a" d="M50 4 L62 38 L96 50 L62 62 L50 96 L38 62 L4 50 L38 38 Z" fill="#fff" /></svg>\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "svg",
        text: 'data-apploop-shape="spark-a"',
        path: "section > svg",
        style: { width: "100px", height: "100px", transform: "translate(48px, 20px)", fill: "#facc15", stroke: "#111827", strokeWidth: "2px" },
      },
    ]);
    expect(markdown).toContain(`<svg viewBox="0 0 100 100" width="100" height="100" class="${classNames[0]}" style="`);
    expect(markdown).toContain("width: 100px");
    expect(markdown).toContain("height: 100px");
    expect(markdown).toContain("transform: translate(48px, 20px)");
    expect(markdown).toContain(`<path data-apploop-shape="spark-a"`);
    expect(markdown).toContain(`style="fill: #facc15; stroke: #111827; stroke-width: 2px;"`);
    expect(markdown).toContain(`.${classNames[0]} {`);
  });

  it("clears text gradient wrapper styles when saving SVG shape attributes", () => {
    const deck = `---\nmarp: true\n---\n\n<svg viewBox="0 0 220 140" width="220" height="140" aria-label="Editable SVG element"><path data-apploop-shape="shape-rounded-triangle-a" d="M110 8 Q118 8 123 16 L207 124 Q213 134 200 134 H20 Q7 134 13 124 L97 16 Q102 8 110 8 Z" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"></path></svg>\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "svg",
        text: 'data-apploop-shape="shape-rounded-triangle-a"',
        path: "section > svg",
        style: {
          backgroundImage: "",
          backgroundClip: "",
          webkitBackgroundClip: "",
          webkitTextFillColor: "",
          color: "",
          width: "474px",
          height: "308px",
          boxSizing: "border-box",
          display: "inline-block",
          transform: "translate(330px, -224px)",
          position: "absolute",
          zIndex: "3",
          fill: "#7d8cff",
          fillOpacity: "0.45",
          stroke: "#f7f7ff",
          strokeWidth: "6px",
          strokeLinejoin: "bevel",
        },
      },
    ]);
    expect(markdown).toContain(`<svg viewBox="0 0 220 140" width="220" height="140" aria-label="Editable SVG element" class="${classNames[0]}" style="`);
    expect(markdown).toContain("width: 474px");
    expect(markdown).toContain("height: 308px");
    expect(markdown).toContain("box-sizing: border-box");
    expect(markdown).toContain("transform: translate(330px, -224px)");
    expect(markdown).toContain("position: absolute");
    expect(markdown).toContain("z-index: 3");
    expect(markdown).toContain(`<path data-apploop-shape="shape-rounded-triangle-a"`);
    expect(markdown).toContain(`style="fill: #7d8cff; fill-opacity: 0.45; stroke: #f7f7ff; stroke-linejoin: bevel; stroke-width: 6px;"`);
    expect(markdown).not.toContain("background-image: linear-gradient");
    expect(markdown).not.toContain("-webkit-text-fill-color: transparent");
    expect(markdown).not.toContain("color: transparent");
  });

  it("persists headings as heading elements with class + inline style", () => {
    const className = buildElementClassName({
      slide: 1,
      tag: "h1",
      text: "Provoke curiosity.",
      path: "section > h1",
    });
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(SAMPLE, [
      {
        slide: 1,
        tag: "h1",
        text: "Provoke curiosity.",
        path: "section > h1",
        style: {
          color: "#38bdf8",
          textAlign: "center",
          position: "absolute",
          left: "50%",
          top: "20%",
          transform: "translate(-50%, 0)",
          width: "640px",
          height: "92px",
          boxSizing: "border-box",
        },
      },
    ]);

    expect(classNames).toEqual([className]);
    expect(markdown).toContain(`class="${className}"`);
    expect(markdown).toContain(`style="`);
    expect(markdown).toContain("left: 50%;");
    expect(markdown).toContain("top: 20%;");
    expect(markdown).toContain("position: absolute;");
    expect(markdown).toContain("width: 640px;");
    expect(markdown).toContain("height: 92px;");
    expect(markdown).toContain("box-sizing: border-box;");
    expect(markdown).toContain("@apploop-inspect-styles");
    expect(markdown).toContain(`<h1 class="${className}" style="`);
    expect(markdown).not.toContain(`# <span class="${className}"`);
    expect(markdown).toContain("## Next");
  });

  it("does not persist invalid numeric CSS values", () => {
    const { markdown } = applyPresentationElementStylesToMarkdown(SAMPLE, [
      {
        slide: 1,
        tag: "h1",
        text: "Provoke curiosity.",
        path: "section > h1",
        style: { width: "640px", height: "NaNpx", left: "12%" },
      },
    ]);

    expect(markdown).toContain("width: 640px;");
    expect(markdown).toContain("left: 12%;");
    expect(markdown).not.toContain("NaNpx");
  });

  it("keeps gradient heading movement visible after reload", () => {
    const deck = `---\nmarp: true\n---\n\n# Claude Code Harness\n\nBody\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "h1",
        text: "Claude Code Harness",
        path: "section > h1",
        style: {
          display: "inline-block",
          position: "absolute",
          left: "30%",
          top: "82%",
          right: "auto",
          bottom: "auto",
          transform: "none",
          zIndex: "3",
        },
      },
    ]);

    expect(markdown).toContain(`<h1 class="${classNames[0]}" style="`);
    expect(markdown).toContain("Claude Code Harness</h1>");
    expect(markdown).toContain("top: 82%;");
    expect(markdown).not.toContain(`<span class="${classNames[0]}"`);
    expect(markdown).not.toContain("# <span");
  });

  it("persists pill styles on the pill element itself", () => {
    const deck = `---\nmarp: true\n---\n\n<span class="pill pill-emerald">Rules</span>\n<span class="pill pill-sky">Skills</span>\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "pill",
        text: "Rules",
        path: "section > span.pill:nth-of-type(1)",
        style: {
          color: "#ecfeff",
          background: "rgba(20, 184, 166, 0.22)",
          backgroundImage: "linear-gradient(135deg, #14b8a6 0%, #38bdf8 100%)",
          border: "2px solid #2dd4bf",
          borderRadius: "999px",
        },
      },
    ]);

    expect(markdown).toContain(`<span class="pill pill-emerald ${classNames[0]}" style="`);
    expect(markdown).toContain("background: rgba(20, 184, 166, 0.22);");
    expect(markdown).toContain("background-image: linear-gradient(135deg, #14b8a6 0%, #38bdf8 100%);");
    expect(markdown).toContain("border-radius: 999px;");
    expect(markdown).toContain(">Rules</span>");
    expect(markdown).toContain(`<span class="pill pill-sky">Skills</span>`);
    expect(markdown).not.toContain(`<span class="${classNames[0]}"`);
  });

  it("keeps pill classes after repeated move and style saves", () => {
    const deck = `---\nmarp: true\n---\n\n<p><span class="pill pill-sky">Skills</span><br>\n<span class="pill pill-amber">Agents</span></p>\n`;
    const first = applyPresentationElementStylesToMarkdown(deck, [
      {
        slide: 1,
        tag: "pill",
        text: "Skills",
        path: "section > p > span.pill:nth-of-type(1)",
        style: {
          position: "absolute",
          left: "24%",
          top: "42%",
          transform: "none",
          zIndex: "3",
        },
      },
    ]);
    const className = first.classNames[0]!;

    const second = applyPresentationElementStylesToMarkdown(first.markdown, [
      {
        slide: 1,
        tag: "pill",
        text: "Skills",
        path: `section > p > span.${className}`,
        style: {
          left: "30%",
          top: "55%",
          borderRadius: "999px",
          background: "#0f172a",
          border: "2px solid #38bdf8",
        },
      },
    ]);

    expect(second.markdown).toContain(`<span class="pill pill-sky ${className}" style="`);
    expect(second.markdown).toContain("left: 30%;");
    expect(second.markdown).toContain("top: 55%;");
    expect(second.markdown).toContain("border-radius: 999px;");
    expect(second.markdown).toContain(">Skills</span>");
    expect(second.markdown).toContain(`<span class="pill pill-amber">Agents</span>`);
    expect(second.markdown).not.toContain(`\nSkills\n`);
    expect(second.markdown).not.toContain(`<span class="${className}"`);
  });

  it("clears previous gradient fields when a flat text color is applied", () => {
    const withGradient = applyPresentationElementStylesToMarkdown(SAMPLE, [
      {
        slide: 1,
        tag: "h1",
        text: "Provoke curiosity.",
        path: "section > h1",
        style: {
          color: "transparent",
          backgroundImage: "linear-gradient(135deg, #34d399 0%, #38bdf8 100%)",
          backgroundClip: "text",
          webkitBackgroundClip: "text",
          webkitTextFillColor: "transparent",
        },
      },
    ]);

    const flatWhite = applyPresentationElementStylesToMarkdown(withGradient.markdown, [
      {
        slide: 1,
        tag: "h1",
        text: "Provoke curiosity.",
        path: "section > h1",
        style: {
          color: "#ffffff",
          backgroundImage: "",
          backgroundClip: "",
          webkitBackgroundClip: "",
          webkitTextFillColor: "",
        },
      },
    ]);

    expect(flatWhite.markdown).toContain("color: #ffffff;");
    expect(flatWhite.markdown).not.toContain("background-image: linear-gradient");
    expect(flatWhite.markdown).not.toContain("-webkit-text-fill-color: transparent;");
  });

  it("keeps managed CSS inside the style block when gradient preset metadata follows it", () => {
    const deck = `---\nmarp: true\nstyle: |\n  section {\n    background: #000000;\n    color: #ffffff;\n  }\napploopGradientPresets: '[{"id":"emerald","label":"Emerald","from":"#34d399","to":"#38bdf8","angle":135}]'\n---\n\n# Title\n`;
    const { markdown, classNames } = applyPresentationElementStylesToMarkdown(deck, [
      { slide: 1, tag: "h1", text: "Title", path: "section > h1", style: { color: "#34d399" } },
    ]);
    const styleStart = markdown.indexOf("style: |");
    const managedStart = markdown.indexOf("/* @apploop-inspect-styles */");
    const presetKey = markdown.indexOf("apploopGradientPresets:");
    expect(styleStart).toBeGreaterThanOrEqual(0);
    expect(managedStart).toBeGreaterThan(styleStart);
    expect(managedStart).toBeLessThan(presetKey);
    expect(markdown).toContain("section {\n    background: #000000;");
    expect(markdown).toContain(`.${classNames[0]} {`);
  });

  it("repairs existing managed CSS that was appended after gradient preset metadata", () => {
    const broken = `---\nmarp: true\nstyle: |\n  section {\n    background: #000000;\n    color: #ffffff;\n  }\napploopGradientPresets: '[{"id":"emerald","label":"Emerald","from":"#34d399","to":"#38bdf8","angle":135}]'\n  /* @apploop-inspect-styles */\n    /* position context for dragged/absolute inspect nodes */\n    section {\n      position: relative;\n    }\n    .apploop-el-1234567890 {\n      color: #34d399;\n    }\n    /* @apploop-inspect-styles-end */\n---\n\n<span class="apploop-el-1234567890">Title</span>\n`;
    const repaired = repairManagedStyleBlock(broken);
    const managedStart = repaired.indexOf("/* @apploop-inspect-styles */");
    const presetKey = repaired.indexOf("apploopGradientPresets:");
    expect(managedStart).toBeGreaterThan(repaired.indexOf("style: |"));
    expect(managedStart).toBeLessThan(presetKey);
    expect(repaired).toContain("section {\n    background: #000000;");
    expect(repaired).toContain(".apploop-el-1234567890 {");
  });

  it("keeps drag position across re-apply with different tag/path", () => {
    const first = applyPresentationElementStylesToMarkdown(SAMPLE, [
      {
        slide: 1,
        tag: "p",
        text: "A short Marp starter.",
        path: "section > p",
        style: {
          position: "absolute",
          left: "13.68%",
          top: "62.72%",
          transform: "none",
        },
      },
    ]);

    const className = first.classNames[0]!;
    expect(first.markdown).toContain(`class="${className}"`);
    expect(first.markdown).toContain("left: 13.68%;");

    const second = applyPresentationElementStylesToMarkdown(first.markdown, [
      {
        slide: 1,
        tag: "span",
        text: "A short Marp starter.",
        path: `section > span.${className}`,
        style: {
          position: "absolute",
          left: "22%",
          top: "40%",
          transform: "none",
        },
      },
    ]);

    expect(second.classNames[0]).toBe(className);
    expect(second.markdown).toContain("left: 22%;");
    expect(second.markdown).toContain("top: 40%;");
    // Single wrapper only.
    expect(second.markdown.match(new RegExp(`class="${className}"`, "g"))?.length).toBe(1);
    // Inline style remains on the wrapper so Marp reload cannot drop position.
    expect(second.markdown).toMatch(
      new RegExp(`<span class="${className}" style="[^"]*left: 22%;[^"]*">A short Marp starter\\.</span>`),
    );
  });

  it("does not rewrite other slides when target is slide 1", () => {
    const { markdown } = applyPresentationElementStylesToMarkdown(SAMPLE, [
      {
        slide: 1,
        tag: "h1",
        text: "Provoke curiosity.",
        path: "section > h1",
        style: { color: "red" },
      },
    ]);
    expect(markdown).toContain("- Keep it short");
    expect(markdown.indexOf('<span class="apploop-el-')).toBeLessThan(markdown.indexOf("## Next"));
  });
});
