import { describe, expect, it } from "vitest";
import { assertPresentationTemplate, listPresentationTemplates } from "@/lib/presentations/templates";
import { countMarpSlides, ensureMarpitThemeMeta, getMarpSlideBody, replaceMarpSlideBody, renderMarpDeck, wrapMarpDocument } from "@/lib/presentations/marp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPresentationWorkspace, listPresentationImageAssets, readPresentationAsset, readPresentationMarkdown, writePresentationAsset } from "@/lib/presentations/files";
import { createPresentationAgentBundle } from "@/lib/hermes/agents";
import { buildPresentationInspectAssets } from "@/lib/presentations/inspect-editor-assets";
import { DEFAULT_PRESENTATION_GRADIENT_PRESETS, cloneMarpSlide, convertMarpSlideElementToList, deleteMarpSlide, insertBlankMarpSlide, moveMarpListItem, moveMarpSlideBlock, readPresentationGradientPresets, removeMarpSlideElement, reorderMarpSlide, upsertPresentationGradientPresets } from "@/lib/presentations/marp-utils";

describe("presentation templates", () => {
  it("lists the built-in presentation templates", () => {
    const templates = listPresentationTemplates();
    expect(templates.map((template) => template.id)).toEqual([
      "simple-3-slides",
      "claude-code-harness",
      "hermes-agent-harness",
    ]);
    expect(templates[0]?.id).toBe("simple-3-slides");
    expect(templates.find((template) => template.id === "claude-code-harness")?.name).toBe("Claude Code Harness");
    expect(templates.find((template) => template.id === "hermes-agent-harness")?.name).toBe("Hermes Agent Harness");
    expect(assertPresentationTemplate("simple-3-slides").sourceFile).toBe("deck.md");
  });

  it("renders every built-in presentation template", async () => {
    for (const template of listPresentationTemplates()) {
      const markdown = await fs.readFile(
        path.join(process.cwd(), "presentations-templates", template.templatePath, template.sourceFile),
        "utf8",
      );
      expect(countMarpSlides(markdown), template.id).toBeGreaterThan(0);
      const rendered = await renderMarpDeck(markdown);
      expect(rendered.html, template.id).toContain("section");
    }
  });
});

describe("marp rendering", () => {
  it("counts slides and renders three sections for the starter deck", async () => {
    const markdown = await fs.readFile(
      path.join(process.cwd(), "presentations-templates", "simple-3-slides", "deck.md"),
      "utf8",
    );

    expect(countMarpSlides(markdown)).toBe(3);

    const rendered = await renderMarpDeck(markdown);
    expect(rendered.html).toContain("section");
    expect(rendered.css.length).toBeGreaterThan(10);
    expect((rendered.html.match(/<section/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("renders a single slide when slide index is provided", async () => {
    const markdown = await fs.readFile(
      path.join(process.cwd(), "presentations-templates", "simple-3-slides", "deck.md"),
      "utf8",
    );

    const rendered = await renderMarpDeck(markdown, { slide: 2 });
    expect(rendered.slideCountHint).toBe(3);
    expect((rendered.html.match(/<section/g) ?? []).length).toBe(1);
    expect(rendered.html.toLowerCase()).toContain("what this is");
  });

  it("keeps relative presentation image paths in rendered slide HTML", async () => {
    const markdown = `---\nmarp: true\n---\n\n# Image\n\n![Demo](assets/demo.png)\n`;
    const rendered = await renderMarpDeck(markdown, { slide: 1 });

    expect(rendered.html).toContain('src="assets/demo.png"');
    expect(rendered.html).toContain('alt="Demo"');
  });

  it("exposes body-only slide text and can replace one slide without front matter noise", async () => {
    const markdown = await fs.readFile(
      path.join(process.cwd(), "presentations-templates", "simple-3-slides", "deck.md"),
      "utf8",
    );

    const body1 = getMarpSlideBody(markdown, 1);
    expect(body1).not.toContain("marp: true");
    expect(body1.toLowerCase()).toContain("curiosity");

    const next = replaceMarpSlideBody(markdown, 1, "# New title\n\nBody only.");
    expect(next).toContain("marp: true");
    expect(getMarpSlideBody(next, 1)).toBe("# New title\n\nBody only.");
    expect(getMarpSlideBody(next, 2).toLowerCase()).toContain("what this is");
    expect(countMarpSlides(next)).toBe(3);
  });

  it("reorders slides while preserving front matter", () => {
    const markdown = `---\nmarp: true\n---\n\n# One\n\n---\n\n# Two\n\n---\n\n# Three\n`;
    const next = reorderMarpSlide(markdown, 3, 1);
    expect(next).toContain("marp: true");
    expect(getMarpSlideBody(next, 1)).toBe("# Three");
    expect(getMarpSlideBody(next, 2)).toBe("# One");
    expect(getMarpSlideBody(next, 3)).toBe("# Two");
  });

  it("falls back to common gradient presets when deck metadata is missing", () => {
    const markdown = `---\nmarp: true\n---\n\n# One\n`;

    expect(readPresentationGradientPresets(markdown)).toEqual(DEFAULT_PRESENTATION_GRADIENT_PRESETS);
  });

  it("stores and reads gradient presets in Marp front matter", () => {
    const markdown = `---\nmarp: true\nstyle: |\n  section { color: white; }\n---\n\n# One\n`;
    const presets = [
      { id: "sunrise", label: "Sunrise", from: "#f97316", to: "#facc15", angle: 90 },
      { id: "forest", label: "Forest", from: "#166534", to: "#22c55e", angle: 135 },
    ];

    const next = upsertPresentationGradientPresets(markdown, presets);

    expect(next).toContain("apploopGradientPresets:");
    expect(next).toContain("style: |");
    expect(next).toContain("# One");
    expect(readPresentationGradientPresets(next)).toEqual(presets);
  });

  it("clones one slide after the source slide", () => {
    const markdown = `---\nmarp: true\n---\n\n# One\n\n---\n\n# Two\n`;
    const next = cloneMarpSlide(markdown, 1);

    expect(countMarpSlides(next)).toBe(3);
    expect(getMarpSlideBody(next, 1)).toBe("# One");
    expect(getMarpSlideBody(next, 2)).toBe("# One");
    expect(getMarpSlideBody(next, 3)).toBe("# Two");
  });

  it("inserts a blank slide before, between, or after existing slides", () => {
    const markdown = `---\nmarp: true\n---\n\n# One\n\n---\n\n# Two\n`;
    const beforeFirst = insertBlankMarpSlide(markdown, 0);
    const between = insertBlankMarpSlide(markdown, 1);
    const afterLast = insertBlankMarpSlide(markdown, 2);

    expect(countMarpSlides(beforeFirst)).toBe(3);
    expect(getMarpSlideBody(beforeFirst, 1)).toBe("<!-- apploop-blank-slide -->");
    expect(getMarpSlideBody(beforeFirst, 2)).toBe("# One");
    expect(getMarpSlideBody(between, 2)).toBe("<!-- apploop-blank-slide -->");
    expect(getMarpSlideBody(afterLast, 3)).toBe("<!-- apploop-blank-slide -->");
  });

  it("deletes one slide while preserving front matter", () => {
    const markdown = `---\nmarp: true\n---\n\n# One\n\n---\n\n# Two\n\n---\n\n# Three\n`;
    const next = deleteMarpSlide(markdown, 2);

    expect(next).toContain("marp: true");
    expect(countMarpSlides(next)).toBe(2);
    expect(getMarpSlideBody(next, 1)).toBe("# One");
    expect(getMarpSlideBody(next, 2)).toBe("# Three");
  });

  it("moves a slide text block before a list item for smart organization", () => {
    const markdown = `---\nmarp: true\n---\n\n# Plan\n\nImportant note\n\n- First task\n- Second task\n`;
    const next = moveMarpSlideBlock(markdown, 1, "Important note", "Second task", "before");
    const body = getMarpSlideBody(next, 1);
    expect(body.indexOf("Important note")).toBeLessThan(body.indexOf("- First task"));
    expect(body.indexOf("- First task")).toBeLessThan(body.indexOf("- Second task"));
  });

  it("converts selected text to an ordered list", () => {
    const markdown = `---\nmarp: true\n---\n\n# Plan\n\nImportant note\n\nOutro\n`;
    const next = convertMarpSlideElementToList(markdown, 1, "Important note", "ordered");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("1. Important note");
    expect(body).not.toContain("\nImportant note\n");
  });

  it("converts selected html pills to checklists", () => {
    const markdown = `---\nmarp: true\n---\n\n<span class="pill pill-emerald">Rules</span>\n<span class="pill pill-sky">Skills</span>\n`;
    const next = convertMarpSlideElementToList(markdown, 1, "Rules", "checklist");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("- [ ] Rules");
    expect(body).toContain("<span class=\"pill pill-sky\">Skills</span>");
  });

  it("converts existing bullet lists to checklists as a block", () => {
    const markdown = `---\nmarp: true\n---\n\n- First task\n- Second task\n\nOutro\n`;
    const next = convertMarpSlideElementToList(markdown, 1, "First task Second task", "checklist");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("- [ ] First task\n- [ ] Second task");
    expect(body).toContain("Outro");
  });

  it("converts existing bullet lists to numbered lists as a block", () => {
    const markdown = `---\nmarp: true\n---\n\n- First task\n- Second task\n\nOutro\n`;
    const next = convertMarpSlideElementToList(markdown, 1, "First task Second task", "ordered");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("1. First task\n2. Second task");
    expect(body).toContain("Outro");
  });

  it("converts existing numbered lists to unordered lists as a block", () => {
    const markdown = `---\nmarp: true\n---\n\n1. First task\n2. Second task\n\nOutro\n`;
    const next = convertMarpSlideElementToList(markdown, 1, "First task Second task", "unordered");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("- First task\n- Second task");
    expect(body).toContain("Outro");
  });

  it("matches multiline checklist source when converting to unordered lists", () => {
    const markdown = `---\nmarp: true\n---\n\n- [ ] PR title cites US-X.Y\n- [ ] Plan file exists for M+ stories\n- [ ] Review file with verdict != X\n- [ ] Conventional commit scope\n\nOutro\n`;
    const sourceText = "- [ ] PR title cites US-X.Y\n- [ ] Plan file exists for M+ stories\n- [ ] Review file with verdict != X\n- [ ] Conventional commit scope";
    const next = convertMarpSlideElementToList(markdown, 1, sourceText, "unordered");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("- PR title cites US-X.Y\n- Plan file exists for M+ stories\n- Review file with verdict != X\n- Conventional commit scope");
    expect(body).toContain("Outro");
  });

  it("matches rendered bullet text when converting lists", () => {
    const markdown = `---\nmarp: true\n---\n\n- [ ] PR title cites US-X.Y\n- [ ] Plan file exists for M+ stories\n\nOutro\n`;
    const next = convertMarpSlideElementToList(markdown, 1, "• [ ] PR title cites US-X.Y • [ ] Plan file exists for M+ stories", "ordered");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("1. PR title cites US-X.Y\n2. Plan file exists for M+ stories");
    expect(body).toContain("Outro");
  });

  it("moves one list item only inside its current list", () => {
    const markdown = `---\nmarp: true\n---\n\n# Plan\n\n- First task\n- Second task\n- Third task\n\nOutside\n\n- Other list\n`;
    const next = moveMarpListItem(markdown, 1, "Third task", "First task", "before");
    const body = getMarpSlideBody(next, 1);
    expect(body.indexOf("- Third task")).toBeLessThan(body.indexOf("- First task"));
    expect(body.indexOf("- First task")).toBeLessThan(body.indexOf("- Second task"));
    expect(body.indexOf("Outside")).toBeLessThan(body.indexOf("- Other list"));
  });

  it("keeps moved blocks separated by blank lines", () => {
    const markdown = `---\nmarp: true\n---\n\n# Metrics\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n\nSummary line\n`;
    const next = moveMarpSlideBlock(markdown, 1, "Name Value A 1", "Summary line", "after");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("Summary line\n\n| Name | Value |");
  });

  it("never inserts a moved block inside a code fence", () => {
    const markdown = "---\nmarp: true\n---\n\n# Chain\n\nIntro paragraph\n\n```\nline one\nline two\nline three\n```\n";
    const next = moveMarpSlideBlock(markdown, 1, "Intro paragraph", "line one line two line three", "after");
    const body = getMarpSlideBody(next, 1);
    const fenceStart = body.indexOf("```");
    const fenceEnd = body.indexOf("```", fenceStart + 3);
    const movedIndex = body.indexOf("Intro paragraph");
    expect(movedIndex === -1 || movedIndex < fenceStart || movedIndex > fenceEnd).toBe(true);
    expect(body).toContain("line one\nline two\nline three");
  });

  it("moves a text block after another block for smart organization", () => {
    const markdown = `---\nmarp: true\n---\n\n# Plan\n\nImportant note\n\nOutro\n`;
    const next = moveMarpSlideBlock(markdown, 1, "Important note", "Outro", "after");
    const body = getMarpSlideBody(next, 1);
    expect(body.indexOf("Outro")).toBeLessThan(body.indexOf("Important note"));
  });

  it("moves a selected multi-line list block as a unit", () => {
    const markdown = `---\nmarp: true\n---\n\n# Plan\n\n- First point\n- Second point\n- Third point\n\nOutro\n`;
    const next = moveMarpSlideBlock(markdown, 1, "First point Second point Third point", "Outro", "after");
    const body = getMarpSlideBody(next, 1);
    expect(body.indexOf("Outro")).toBeLessThan(body.indexOf("- First point"));
    expect(body.indexOf("- First point")).toBeLessThan(body.indexOf("- Third point"));
  });

  it("moves a selected markdown table as a unit", () => {
    const markdown = `---\nmarp: true\n---\n\n# Metrics\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n| B | 2 |\n\nSummary\n`;
    const next = moveMarpSlideBlock(markdown, 1, "Name Value A 1 B 2", "Summary", "after");
    const body = getMarpSlideBody(next, 1);
    expect(body.indexOf("Summary")).toBeLessThan(body.indexOf("| Name | Value |"));
    expect(body.indexOf("| Name | Value |")).toBeLessThan(body.indexOf("| B | 2 |"));
  });

  it("swaps adjacent markdown tables without splitting either table", () => {
    const markdown = `---\nmarp: true\n---\n\n# Maps\n\n| SPECS.md | ADO Work Item | Identifier |\n| -------- | ------------- | ---------- |\n| E1 | Epic | SpecId = E1 |\n\n| SPECS.md | Agile | Scrum |\n| -------- | ----- | ----- |\n| [ ] | New | New |\n| [x] | Closed | Done |\n\nOutro\n`;
    const next = moveMarpSlideBlock(markdown, 1, "SPECS.md ADO Work Item Identifier E1 Epic SpecId = E1", "SPECS.md Agile Scrum New Closed Done", "after");
    const body = getMarpSlideBody(next, 1);
    expect(body).toContain("| SPECS.md | Agile | Scrum |\n| -------- | ----- | ----- |\n| [ ] | New | New |");
    expect(body).toContain("| SPECS.md | ADO Work Item | Identifier |\n| -------- | ------------- | ---------- |\n| E1 | Epic | SpecId = E1 |");
    expect(body.indexOf("| SPECS.md | Agile | Scrum |")).toBeLessThan(body.indexOf("| SPECS.md | ADO Work Item | Identifier |"));
  });

  it("moves a styled table wrapper with its table block", () => {
    const markdown = `---\nmarp: true\n---\n\n# Maps\n\n<div class="apploop-el-table">\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n\n</div>\n\nSummary\n`;
    const next = moveMarpSlideBlock(markdown, 1, "Name Value A 1", "Summary", "after");
    const body = getMarpSlideBody(next, 1);
    expect(body.indexOf("Summary")).toBeLessThan(body.indexOf("<div class=\"apploop-el-table\">"));
    expect(body).toContain("<div class=\"apploop-el-table\">\n\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n\n</div>");
  });

  it("removes a selected multi-line list block", () => {
    const slide = `# Plan\n\nIntro\n\n- First point\n- Second point\n- Third point\n\nOutro`;
    const next = removeMarpSlideElement(slide, "First point Second point Third point");
    expect(next).toContain("# Plan");
    expect(next).toContain("Intro");
    expect(next).toContain("Outro");
    expect(next).not.toContain("First point");
    expect(next).not.toContain("Second point");
    expect(next).not.toContain("Third point");
  });

  it("removes a selected markdown table as a whole block", () => {
    const slide = `# Metrics\n\nIntro\n\n| Metric | Status | Owner |\n| --- | --- | --- |\n| Adoption | On track | Team |\n| Risk | Watch | Team |\n\nOutro`;
    const next = removeMarpSlideElement(slide, "Metric Status Owner Adoption On track Team Risk Watch Team");
    expect(next).toContain("# Metrics");
    expect(next).toContain("Intro");
    expect(next).toContain("Outro");
    expect(next).not.toContain("| Metric | Status | Owner |");
    expect(next).not.toContain("| --- | --- | --- |");
    expect(next).not.toContain("| Adoption | On track | Team |");
    expect(next).not.toContain("| Risk | Watch | Team |");
  });

  it("removes a selected styled table wrapper with the whole table", () => {
    const slide = `# Metrics\n\n<div class="apploop-el-table">\n\n| Metric | Status | Owner |\n| --- | --- | --- |\n| Adoption | On track | Team |\n| Risk | Watch | Team |\n\n</div>\n\nOutro`;
    const next = removeMarpSlideElement(slide, "Metric Status Owner Adoption On track Team Risk Watch Team");
    expect(next).toContain("# Metrics");
    expect(next).toContain("Outro");
    expect(next).not.toContain("apploop-el-table");
    expect(next).not.toContain("| --- | --- | --- |");
    expect(next).not.toContain("| Adoption | On track | Team |");
  });

  it("removes a selected HTML card body without deleting the card title", () => {
    const slide = `<div class="card">
<svg class="card-shape" viewBox="0 0 100 100"><rect data-apploop-shape="card-a" x="0" y="0" width="100" height="100" /></svg>
<h3>Visual edits</h3>
<p>Click an element, prompt the change, preserve the selector payload.</p>
</div>`;
    const next = removeMarpSlideElement(slide, "Click an element, prompt the change, preserve the selector payload.", { tag: "p", path: "section > div.card > p" });
    expect(next).toContain("<h3>Visual edits</h3>");
    expect(next).toContain("data-apploop-shape=\"card-a\"");
    expect(next).not.toContain("<p>Click an element");
  });

  it("removes a selected SVG card shape without deleting card text", () => {
    const slide = `<div class="card">
<svg class="card-shape" viewBox="0 0 100 100"><rect data-apploop-shape="card-a" x="0" y="0" width="100" height="100" /></svg>
<h3>Visual edits</h3>
<p>Click an element, prompt the change.</p>
</div>`;
    const next = removeMarpSlideElement(slide, 'data-apploop-shape="card-a"', { tag: "rect", path: "section > div.card > svg > rect" });
    expect(next).toContain("<h3>Visual edits</h3>");
    expect(next).toContain("<p>Click an element, prompt the change.</p>");
    expect(next).not.toContain("data-apploop-shape=\"card-a\"");
    expect(next).not.toContain("card-shape");
  });

  it("removes a selected SVG arrow icon", () => {
    const slide = `<div class="flow">
<div class="flow-step"><h3>User</h3><p>Prompt</p></div>
<svg class="flow-arrow" viewBox="0 0 18 18"><path data-apploop-shape="request-path-arrow" d="M2 9 H15 M10 4 L15 9 L10 14" /></svg>
<div class="flow-step"><h3>AppLoop</h3><p>Route</p></div>
</div>`;
    const next = removeMarpSlideElement(slide, 'data-apploop-shape="request-path-arrow"', { tag: "path", path: "section > div.flow > svg > path" });
    expect(next).toContain("<h3>User</h3>");
    expect(next).toContain("<h3>AppLoop</h3>");
    expect(next).not.toContain("request-path-arrow");
    expect(next).not.toContain("flow-arrow");
  });

  it("injects @theme meta so optional theme.css never crashes Marpit", async () => {
    const markdown = await fs.readFile(
      path.join(process.cwd(), "presentations-templates", "simple-3-slides", "deck.md"),
      "utf8",
    );
    const bareCss = "section { background: #000; color: #fff; }";
    expect(ensureMarpitThemeMeta(bareCss)).toContain("@theme apploop-presentation");

    await expect(renderMarpDeck(markdown, { themeCss: bareCss })).resolves.toMatchObject({
      slideCountHint: 3,
    });

    const themed = await renderMarpDeck(markdown, { themeCss: bareCss });
    expect(themed.html).toContain("section");
  });

  it("can hide Marp pagination marks for fullscreen slide preview", () => {
    const documentHtml = wrapMarpDocument("<div class=\"marpit\"><section>Slide</section></div>", "", {
      mode: "slide",
      hidePagination: true,
      previewBackground: "#0d3687",
    });

    expect(documentHtml).toContain("background: #0d3687");
    expect(documentHtml).toContain("div.marpit section::after");
    expect(documentHtml).toContain("content: none !important");
    expect(documentHtml).toContain("display: none !important");
  });

  it("caps rendered slide images at the slide width", () => {
    const documentHtml = wrapMarpDocument("<div class=\"marpit\"><section><img src=\"assets/large.png\" alt=\"Large\" /></section></div>", "", {
      mode: "slide",
    });

    expect(documentHtml).toContain("div.marpit section img { max-width: 100% !important; height: auto; }");
  });

  it("can force live slide background and text color overrides in slide preview", () => {
    const documentHtml = wrapMarpDocument("<div class=\"marpit\"><section><h1>Slide</h1></section></div>", "section.lead { background: radial-gradient(red, blue); }", {
      mode: "slide",
      slideBackground: "#ff0000",
      slideTextColor: "#00ff00",
    });

    expect(documentHtml).toContain("div.marpit section { background: #ff0000 !important; background-color: #ff0000 !important; }");
    expect(documentHtml).toContain("div.marpit section, div.marpit section :where(*) { color: #00ff00 !important;");
    expect(documentHtml).toContain("-webkit-text-fill-color: #00ff00 !important");
    expect(documentHtml).toContain("background-image: none !important");
  });

  it("injects free element movement as the default inspect behavior", () => {
    const assets = buildPresentationInspectAssets({
      activeSlide: 1,
      totalSlides: 1,
      slideMarkdown: "# Move me\n\nBody",
    });

    expect(assets.script).toContain("moveSelectedBy(Number(data.dxPx) || 0, moveDy);");
    expect(assets.script).toContain("lastGestureKind = 'drag'");
    expect(assets.script).toContain("lastGestureKind = 'resize'");
    expect(assets.script).toContain("startW: rect.width");
    expect(assets.script).toContain("function hasExplicitTableWidth(style)");
    expect(assets.script).toContain("function renderedToSlideCssSize(width, height)");
    expect(assets.script).toContain("function preserveElementDimensions(style, item, width, height)");
    expect(assets.script).toContain("srect.width / cssWidth");
    expect(assets.script).toContain("style.boxSizing = 'border-box';");
    expect(assets.script).not.toContain("item && item.style && item.style.width ? item.style.width");
    expect(assets.script).not.toContain("item && item.style && item.style.height ? item.style.height");
    expect(assets.script).not.toContain("draggingImage ? slideBoundedWidthPx(dragging.startW, dragging.srect) : Math.round(dragging.startW) + 'px'");
    expect(assets.script).not.toContain("dragStyle.width = slideBoundedWidthPx(dragging.startW, dragging.srect);");
    expect(assets.script).toContain("preserveElementDimensions(dragStyle, dragging.item, dragging.startW, dragging.startH);");
    expect(assets.script).toContain("preserveElementDimensions(moveStyle, item, rect.width, rect.height);");
    expect(assets.script).toContain("left: leftPct.toFixed(2) + '%'");
    expect(assets.script).toContain("draggingTable ? 'table' : 'inline-block'");
    expect(assets.script).toContain("dragStyle.tableLayout = 'fixed';");
    expect(assets.script).toContain("resizingImage ? slideBoundedWidthPx(w, resizing.srect) : Math.round(w) + 'px'");
    expect(assets.script).toContain("boxSizing: 'border-box'");
    expect(assets.script).toContain("resizingTable ? 'table' : 'inline-block'");
    expect(assets.css).toContain("#apploop-alignment-guides");
    expect(assets.css).toContain('#apploop-inspect-box[data-table-cell="true"] .drag');
    expect(assets.css).toContain('#apploop-inspect-box[data-table-cell="true"] .drag-del');
    expect(assets.css).toContain('#apploop-inspect-box[data-list-item="true"] .drag');
    expect(assets.css).toContain('#apploop-inspect-box[data-list-item="true"] .handle');
    expect(assets.css).toContain(".apploop-empty-managed-host");
    expect(assets.css).toContain(".apploop-empty-managed-host .pill");
    expect(assets.script).toContain("updateAlignmentGuidesForElement");
    expect(assets.script).toContain("visibleElementForItem");
    expect(assets.script).toContain("function isTableCellSelection(item, el)");
    expect(assets.script).toContain("box.setAttribute('data-table-cell', isTableCellSelection(item, el) ? 'true' : 'false');");
    expect(assets.script).toContain("function isListItemSelection(item, el)");
    expect(assets.script).toContain("box.setAttribute('data-list-item', isListItemSelection(item, el) ? 'true' : 'false');");
    expect(assets.script).toContain("function markdownListTextFromElement(list, previousSource)");
    expect(assets.script).toContain("newItem.setAttribute('data-apploop-inserted', 'true');");
    expect(assets.script).toContain("markEditing(newItem, false);");
    expect(assets.script).toContain("if (isTableCellSelection(item, pathToElement(item.path))) return;");
    expect(assets.script).toContain("isEmptyManagedTextHost");
    expect(assets.script).toContain("refreshEmptyManagedTextHosts");
    expect(assets.script).toContain("toLowerCase() === 'section') return null");
    expect(assets.script).toContain("emitStyleApply('apploop-presentation-style-apply')");
    expect(assets.script).toContain("apploop-presentation-flush-styles");
    expect(assets.script).toContain("requestId: requestId || null");
    expect(assets.script).not.toContain("apploop-presentation-set-free-move");
    expect(assets.script).not.toContain("apploop-presentation-smart-organize-element");
    expect(assets.script).not.toContain("swapActiveBlock");
  });
});

describe("presentation workspace clone", () => {
  it("copies the built-in template into a presentations root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-presentations-"));
    const workspacePath = path.join(root, "demo-deck");
    await createPresentationWorkspace(root, workspacePath);
    const markdown = await readPresentationMarkdown(workspacePath);
    expect(markdown).toContain("marp: true");
    expect(countMarpSlides(markdown)).toBe(3);
  });

  it("stores uploaded presentation images in the workspace assets directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "apploop-presentations-"));
    const workspacePath = path.join(root, "image-deck");
    await createPresentationWorkspace(root, workspacePath);

    const relativePath = await writePresentationAsset(workspacePath, "chart.png", Buffer.from("png-data"));
    const asset = await readPresentationAsset(workspacePath, "chart.png");
    const assets = await listPresentationImageAssets(workspacePath);

    expect(relativePath).toBe("assets/chart.png");
    expect(asset.contentType).toBe("image/png");
    expect(asset.contents.toString()).toBe("png-data");
    expect(assets).toEqual([{ name: "chart.png", path: "assets/chart.png", alt: "chart", contentType: "image/png" }]);
  });
});

describe("presentation agent bundle", () => {
  it("builds a presentation-edit bundle centered on deck.md", () => {
    const bundle = createPresentationAgentBundle({
      projectId: "pres-1",
      presentationId: "pres-1",
      workspacePath: "/tmp/deck",
      selectedThemeId: "marp-default",
      packageInstallPolicy: "never",
      validationDepth: "quick",
      defaultRoute: "/",
      mode: "presentation-edit",
      sourceFile: "deck.md",
    });

    expect(bundle.orchestrator.id).toBe("presentation-builder");
    expect(bundle.skillBundle.id).toBe("marp-builder");
    expect(bundle.commands.map((command) => command.id)).toContain("presentation-build");
    expect(bundle.hooks.map((hook) => hook.id)).toContain("presentation-scope-guard");
    expect(bundle.projectContext.mode).toBe("presentation-edit");
    expect(bundle.projectContext.sourceFile).toBe("deck.md");
    expect(bundle.isolationRules.some((rule) => rule.includes("deck.md"))).toBe(true);
  });

    it("emits syntactically valid inspect script for list item editing", () => {
      const assets = buildPresentationInspectAssets({
        activeSlide: 1,
        totalSlides: 1,
        slideMarkdown: "# List\n\n- First\n- Second",
      });
      const scriptBody = assets.script.replace(/^\s*<script>/, "").replace(/<\/script>\s*$/, "");
      expect(() => new Function(scriptBody)).not.toThrow();
      expect(assets.script).toContain("split(/\\n/)");
      expect(assets.script).toContain("join('\\n')");
    });
});
