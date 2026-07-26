import { describe, expect, it } from "vitest";
import {
  alignmentToStyle,
  applyPresentationElementStylesToMarkdown,
  buildElementClassName,
  parseManagedStyleEntries,
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
        },
      },
    ]);

    expect(classNames).toEqual([className]);
    expect(markdown).toContain(`class="${className}"`);
    expect(markdown).toContain(`style="`);
    expect(markdown).toContain("left: 50%;");
    expect(markdown).toContain("top: 20%;");
    expect(markdown).toContain("position: absolute;");
    expect(markdown).toContain("@apploop-inspect-styles");
    expect(markdown).toContain(`<h1 class="${className}" style="`);
    expect(markdown).not.toContain(`# <span class="${className}"`);
    expect(markdown).toContain("## Next");
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
