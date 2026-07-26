/**
 * Client-safe Marp utilities. No node:fs imports.
 * Safe to import from "use client" components.
 */

export type MarpDocumentParts = {
  frontMatter: string;
  slides: string[];
};

export function splitMarpDocument(markdown: string): MarpDocumentParts {
  const normalized = markdown.replace(/\r\n/g, "\n").trimEnd();

  if (!normalized.startsWith("---\n")) {
    const slides = normalized
      .split(/\n-{3,}\n/)
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      frontMatter: "---\nmarp: true\ntheme: default\npaginate: true\nsize: 16:9\n---",
      slides: slides.length > 0 ? slides : [""],
    };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return {
      frontMatter: "---\nmarp: true\ntheme: default\npaginate: true\nsize: 16:9\n---",
      slides: [normalized],
    };
  }

  const frontMatter = normalized.slice(0, closingIndex + "\n---".length);
  const body = normalized.slice(closingIndex + "\n---\n".length).trim();
  const slides = body
    .split(/\n-{3,}\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    frontMatter,
    slides: slides.length > 0 ? slides : [""],
  };
}

export function stripMarpFrontMatter(markdown: string) {
  return splitMarpDocument(markdown).slides.join("\n\n---\n\n");
}

export function countMarpSlides(markdown: string) {
  return splitMarpDocument(markdown).slides.length;
}

export function composeMarpSlideMarkdown(markdown: string, slideIndex1Based: number) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  return `${frontMatter}\n\n${slides[index] ?? ""}\n`;
}

/** Body-only slide content for human editors (no Marp front matter, no _class directives). */
export function getMarpSlideBody(markdown: string, slideIndex1Based: number) {
  const { slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  // Strip Marp HTML directives like <!-- _class: slide-bg-N -->
  return (slides[index] ?? "").replace(/<!--\s*_.*?-->/g, "").trimEnd();
}

/** Replace one slide body; preserves front matter and other slides. */
export function replaceMarpSlideBody(
  markdown: string,
  slideIndex1Based: number,
  nextBody: string,
) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), Math.max(slides.length, 1)) - 1;
  const updated = slides.length > 0 ? [...slides] : [""];
  while (updated.length <= index) updated.push("");
  updated[index] = nextBody.trim();
  return `${frontMatter}\n\n${updated.join("\n\n---\n\n")}\n`;
}

export function reorderMarpSlide(markdown: string, fromSlideIndex1Based: number, toSlideIndex1Based: number) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  if (slides.length <= 1) return markdown;
  const fromIndex = Math.min(Math.max(fromSlideIndex1Based, 1), slides.length) - 1;
  const toIndex = Math.min(Math.max(toSlideIndex1Based, 1), slides.length) - 1;
  if (fromIndex === toIndex) return markdown;
  const nextSlides = [...slides];
  const [moved] = nextSlides.splice(fromIndex, 1);
  if (moved === undefined) return markdown;
  nextSlides.splice(toIndex, 0, moved);
  return `${frontMatter}\n\n${nextSlides.join("\n\n---\n\n")}\n`;
}

export function cloneMarpSlide(markdown: string, slideIndex1Based: number) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), Math.max(slides.length, 1)) - 1;
  const source = slides[index] ?? "";
  const nextSlides = slides.length > 0 ? [...slides] : [""];
  nextSlides.splice(index + 1, 0, source);
  return `${frontMatter}\n\n${nextSlides.join("\n\n---\n\n")}\n`;
}

export function deleteMarpSlide(markdown: string, slideIndex1Based: number) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  if (slides.length <= 1) return markdown;
  const index = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  const nextSlides = slides.filter((_, slideIndex) => slideIndex !== index);
  return `${frontMatter}\n\n${nextSlides.join("\n\n---\n\n")}\n`;
}

function normalizeBlockText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+] |\d+\. |[-*+] \[[ xX]\] )/gm, "")
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, "")
    .replace(/[`*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export { normalizeBlockText, findMarkdownBlockRange };

type MarkdownBlockRange = { start: number; end: number };

function findMarkdownBlockRange(lines: string[], text: string, options: { groupLists: boolean; excludeStart?: number } = { groupLists: false }) {
  const normalizedText = normalizeBlockText(text);
  if (!normalizedText) return null;
  for (let index = 0; index < lines.length; index += 1) {
    if (index === options.excludeStart) continue;
    let end = index + 1;
    if (isMarkdownFenceLine(lines[index] ?? "")) {
      while (end < lines.length && !isMarkdownFenceLine(lines[end] ?? "")) end += 1;
      if (end < lines.length) end += 1;
    } else {
      if (options.groupLists && isMarkdownListItem(lines[index] ?? "")) {
        while (end < lines.length && isMarkdownListItem(lines[end] ?? "")) end += 1;
      }
      if (options.groupLists && isMarkdownTableLine(lines[index] ?? "")) {
        while (end < lines.length && isMarkdownTableLine(lines[end] ?? "")) end += 1;
      }
    }
    const block = lines.slice(index, end).join("\n");
    const normalizedBlock = normalizeBlockText(block);
    if (
      normalizedBlock &&
      (normalizedBlock === normalizedText ||
        normalizedBlock.includes(normalizedText) ||
        normalizedText.includes(normalizedBlock))
    ) {
      return { start: index, end };
    }
    if (end > index + 1) index = end - 1;
  }
  return null;
}

function expandApploopWrapperRange(lines: string[], range: MarkdownBlockRange): MarkdownBlockRange {
  let previous = range.start - 1;
  while (previous >= 0 && !(lines[previous] ?? "").trim()) previous -= 1;
  let next = range.end;
  while (next < lines.length && !(lines[next] ?? "").trim()) next += 1;
  const previousLine = (lines[previous] ?? "").trim();
  const nextLine = (lines[next] ?? "").trim();
  if (/^<div\b[^>]*\bclass=["'][^"']*\bapploop-el-[a-z0-9_-]+\b[^"']*["'][^>]*>$/i.test(previousLine) && /^<\/div>$/i.test(nextLine)) {
    return { start: previous, end: next + 1 };
  }
  return range;
}

function expandMarkdownTableOrListRange(lines: string[], range: MarkdownBlockRange): MarkdownBlockRange {
  const touchesTable = lines.slice(range.start, range.end).some((line) => isMarkdownTableLine(line ?? ""));
  if (touchesTable || isMarkdownTableLine(lines[range.start] ?? "")) {
    let start = range.start;
    while (start > 0 && isMarkdownTableLine(lines[start - 1] ?? "")) start -= 1;
    let end = range.end;
    while (end < lines.length && isMarkdownTableLine(lines[end] ?? "")) end += 1;
    return { start, end };
  }

  const touchesList = lines.slice(range.start, range.end).some((line) => isMarkdownListItem(line ?? ""));
  if (touchesList || isMarkdownListItem(lines[range.start] ?? "")) {
    let start = range.start;
    while (start > 0 && isMarkdownListItem(lines[start - 1] ?? "")) start -= 1;
    let end = range.end;
    while (end < lines.length && isMarkdownListItem(lines[end] ?? "")) end += 1;
    return { start, end };
  }

  return range;
}

function compactTableRowsInsideBlock(lines: string[]) {
  const compacted: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (
      line.trim() === "" &&
      compacted.length > 0 &&
      isMarkdownTableLine(compacted[compacted.length - 1] ?? "")
    ) {
      let lookahead = index + 1;
      while (lookahead < lines.length && (lines[lookahead] ?? "").trim() === "") lookahead += 1;
      if (lookahead < lines.length && isMarkdownTableLine(lines[lookahead] ?? "")) continue;
    }
    compacted.push(line);
  }
  return compacted;
}

function isMarkdownListItem(line: string) {
  return /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/.test(line);
}

function isMarkdownFenceLine(line: string) {
  return /^\s*(?:```|~~~)/.test(line);
}

function markdownFenceRanges(lines: string[]) {
  const ranges: Array<{ start: number; end: number }> = [];
  let fenceStart = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!isMarkdownFenceLine(lines[index] ?? "")) continue;
    if (fenceStart === -1) fenceStart = index;
    else {
      ranges.push({ start: fenceStart, end: index + 1 });
      fenceStart = -1;
    }
  }
  if (fenceStart !== -1) ranges.push({ start: fenceStart, end: lines.length });
  return ranges;
}

function clampIndexOutsideFences(lines: string[], index: number) {
  for (const range of markdownFenceRanges(lines)) {
    if (index > range.start && index < range.end) {
      return index - range.start <= range.end - index ? range.start : range.end;
    }
  }
  return index;
}

function isMarkdownTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function listItemContent(line: string) {
  return normalizeBlockText(line.replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/, ""));
}

function linesToListItems(lines: string[], fallbackText: string, kind: "ordered" | "checklist") {
  const items = lines
    .map((line) => listItemContent(line))
    .filter(Boolean);
  if (items.length === 0) {
    const fallback = normalizeBlockText(fallbackText);
    if (fallback) items.push(fallback);
  }
  return items.map((item, index) => kind === "checklist" ? `- [ ] ${item}` : `${index + 1}. ${item}`);
}

function removeEmptyMarkdownMarkers(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s*$/gm, "")
    .replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s*)$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeMarpSlideElement(slideMarkdown: string, text: string) {
  const normalizedText = normalizeBlockText(text);
  if (!normalizedText) return slideMarkdown;

  const lines = slideMarkdown.split("\n");
  const rangeMatch = findMarkdownBlockRange(lines, text, { groupLists: true });
  if (rangeMatch) {
    const range = expandApploopWrapperRange(lines, expandMarkdownTableOrListRange(lines, rangeMatch));
    return removeEmptyMarkdownMarkers([...lines.slice(0, range.start), ...lines.slice(range.end)].join("\n"));
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const start = index;
    let end = index + 1;
    if (isMarkdownListItem(line)) {
      while (end < lines.length && isMarkdownListItem(lines[end] ?? "")) {
        end += 1;
      }
      index = end - 1;
    }
    const block = lines.slice(start, end).join("\n");
    const normalizedBlock = normalizeBlockText(block);
    if (
      normalizedBlock &&
      (normalizedBlock === normalizedText ||
        normalizedBlock.includes(normalizedText) ||
        normalizedText.includes(normalizedBlock))
    ) {
      return removeEmptyMarkdownMarkers([...lines.slice(0, start), ...lines.slice(end)].join("\n"));
    }
  }

  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return removeEmptyMarkdownMarkers(
    slideMarkdown
      .replace(new RegExp(`<span\\b[^>]*\\bclass=["'][^"']*apploop-el-[^"']*["'][^>]*>\\s*${escaped}\\s*<\\/span>`, "gi"), "")
      .replace(new RegExp(escaped, "g"), ""),
  );
}

export function convertMarpSlideElementToList(
  markdown: string,
  slideIndex1Based: number,
  sourceText: string,
  kind: "ordered" | "checklist",
) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const slideIndex = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  const slide = slides[slideIndex] ?? "";
  const lines = slide.split("\n");
  const sourceRangeMatch = findMarkdownBlockRange(lines, sourceText, { groupLists: true });
  if (!sourceRangeMatch) return markdown;
  const sourceRange = expandApploopWrapperRange(lines, expandMarkdownTableOrListRange(lines, sourceRangeMatch));
  const sourceLines = lines.slice(sourceRange.start, sourceRange.end);
  const nextList = linesToListItems(sourceLines, sourceText, kind);
  if (nextList.length === 0) return markdown;

  const nextLines = [
    ...lines.slice(0, sourceRange.start),
    ...nextList,
    ...lines.slice(sourceRange.end),
  ];
  const nextSlides = [...slides];
  nextSlides[slideIndex] = nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return `${frontMatter}\n\n${nextSlides.join("\n\n---\n\n")}\n`;
}

export function moveMarpSlideBlock(
  markdown: string,
  slideIndex1Based: number,
  sourceText: string,
  targetText: string,
  placement: "before" | "after",
) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const slideIndex = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  const slide = slides[slideIndex] ?? "";
  const lines = slide.split("\n");
  const sourceRangeMatch = findMarkdownBlockRange(lines, sourceText, { groupLists: true });
  if (!sourceRangeMatch) return markdown;
  const sourceRange = expandApploopWrapperRange(lines, expandMarkdownTableOrListRange(lines, sourceRangeMatch));
  const targetRangeMatch = findMarkdownBlockRange(lines, targetText, { groupLists: true, excludeStart: sourceRange.start })
    ?? findMarkdownBlockRange(lines, targetText, { groupLists: false, excludeStart: sourceRange.start });
  if (!targetRangeMatch) return markdown;
  const targetRange = expandApploopWrapperRange(lines, expandMarkdownTableOrListRange(lines, targetRangeMatch));

  const nextLines = [...lines];
  const sourceBlock = compactTableRowsInsideBlock(nextLines.splice(sourceRange.start, sourceRange.end - sourceRange.start));
  if (sourceBlock.length === 0) return markdown;
  const adjustedTargetStart = targetRange.start > sourceRange.start ? targetRange.start - sourceBlock.length : targetRange.start;
  const adjustedTargetEnd = targetRange.end > sourceRange.start ? targetRange.end - sourceBlock.length : targetRange.end;
  const insertIndex = clampIndexOutsideFences(
    nextLines,
    Math.min(Math.max(placement === "before" ? adjustedTargetStart : adjustedTargetEnd, 0), nextLines.length),
  );
  nextLines.splice(insertIndex, 0, "", ...sourceBlock, "");

  const nextSlides = [...slides];
  nextSlides[slideIndex] = nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return `${frontMatter}\n\n${nextSlides.join("\n\n---\n\n")}\n`;
}

export function moveMarpListItem(
  markdown: string,
  slideIndex1Based: number,
  sourceText: string,
  targetText: string,
  placement: "before" | "after",
) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const slideIndex = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  const slide = slides[slideIndex] ?? "";
  const lines = slide.split("\n");
  const normalizedSource = normalizeBlockText(sourceText);
  const normalizedTarget = normalizeBlockText(targetText);
  if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) return markdown;

  let sourceIndex = -1;
  let targetIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!isMarkdownListItem(line)) continue;
    const normalizedLine = normalizeBlockText(line);
    if (sourceIndex === -1 && (normalizedLine === normalizedSource || normalizedLine.includes(normalizedSource) || normalizedSource.includes(normalizedLine))) {
      sourceIndex = index;
    }
    if (targetIndex === -1 && (normalizedLine === normalizedTarget || normalizedLine.includes(normalizedTarget) || normalizedTarget.includes(normalizedLine))) {
      targetIndex = index;
    }
  }
  if (sourceIndex === -1 || targetIndex === -1) return markdown;

  let listStart = sourceIndex;
  while (listStart > 0 && isMarkdownListItem(lines[listStart - 1] ?? "")) listStart -= 1;
  let listEnd = sourceIndex + 1;
  while (listEnd < lines.length && isMarkdownListItem(lines[listEnd] ?? "")) listEnd += 1;
  if (targetIndex < listStart || targetIndex >= listEnd) return markdown;

  const nextLines = [...lines];
  const [sourceLine] = nextLines.splice(sourceIndex, 1);
  if (sourceLine === undefined) return markdown;
  const adjustedTargetIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
  const insertIndex = placement === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
  nextLines.splice(Math.min(Math.max(insertIndex, listStart), listEnd), 0, sourceLine);

  const nextSlides = [...slides];
  nextSlides[slideIndex] = nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return `${frontMatter}\n\n${nextSlides.join("\n\n---\n\n")}\n`;
}

export function getMarpSlideSummaries(markdown: string) {
  const { slides } = splitMarpDocument(markdown);
  return slides.map((slide, index) => {
    const headingMatch = slide.match(/^#{1,6}\s+(.+)$/m);
    const firstLine = slide
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("<!--"));
    const title = (headingMatch?.[1] ?? firstLine ?? `Slide ${index + 1}`)
      .replace(/[#*_`]/g, "")
      .trim();
    return {
      index: index + 1,
      title: title.slice(0, 80) || `Slide ${index + 1}`,
      preview: slide.slice(0, 160),
    };
  });
}
