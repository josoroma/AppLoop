import { describe, expect, it } from "vitest";
import { assertPresentationTemplate, listPresentationTemplates } from "@/lib/presentations/templates";
import { countMarpSlides, ensureMarpitThemeMeta, getMarpSlideBody, replaceMarpSlideBody, renderMarpDeck, wrapMarpDocument } from "@/lib/presentations/marp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPresentationWorkspace, readPresentationMarkdown } from "@/lib/presentations/files";
import { createPresentationAgentBundle } from "@/lib/hermes/agents";
import { buildPresentationInspectAssets } from "@/lib/presentations/inspect-editor-assets";
import { cloneMarpSlide, convertMarpSlideElementToList, deleteMarpSlide, moveMarpListItem, moveMarpSlideBlock, removeMarpSlideElement, reorderMarpSlide } from "@/lib/presentations/marp-utils";

describe("presentation templates", () => {
  it("lists the simple 3-slide built-in template", () => {
    const templates = listPresentationTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe("simple-3-slides");
    expect(assertPresentationTemplate("simple-3-slides").sourceFile).toBe("deck.md");
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

  it("clones one slide after the source slide", () => {
    const markdown = `---\nmarp: true\n---\n\n# One\n\n---\n\n# Two\n`;
    const next = cloneMarpSlide(markdown, 1);

    expect(countMarpSlides(next)).toBe(3);
    expect(getMarpSlideBody(next, 1)).toBe("# One");
    expect(getMarpSlideBody(next, 2)).toBe("# One");
    expect(getMarpSlideBody(next, 3)).toBe("# Two");
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
    expect(assets.script).toContain("draggingTable ? draggingTableWidth : Math.round(dragging.startW) + 'px'");
    expect(assets.script).toContain("draggingTable && !draggingTableHasExplicitWidth ? '0%' : leftPct.toFixed(2) + '%'");
    expect(assets.script).toContain("draggingTable ? 'table' : 'inline-block'");
    expect(assets.script).toContain("draggingTable ? 'fixed' : undefined");
    expect(assets.script).toContain("width: Math.round(w) + 'px'");
    expect(assets.script).toContain("resizingTable ? 'table' : 'inline-block'");
    expect(assets.css).toContain("#apploop-alignment-guides");
    expect(assets.css).toContain(".apploop-empty-managed-host");
    expect(assets.css).toContain(".apploop-empty-managed-host .pill");
    expect(assets.script).toContain("updateAlignmentGuidesForElement");
    expect(assets.script).toContain("visibleElementForItem");
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
});
