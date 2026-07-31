/**
 * Client-safe Marp utilities. No node:fs imports.
 * Safe to import from "use client" components.
 */

export type MarpDocumentParts = {
  frontMatter: string;
  slides: string[];
};

export type PresentationGradientPreset = {
  id: string;
  label: string;
  from: string;
  to: string;
  angle: number;
};

export const DEFAULT_PRESENTATION_GRADIENT_PRESETS: PresentationGradientPreset[] = [
  { id: "emerald-sky", label: "Emerald sky", from: "#34d399", to: "#38bdf8", angle: 135 },
  { id: "amber-rose", label: "Amber rose", from: "#f59e0b", to: "#f43f5e", angle: 135 },
  { id: "violet-cyan", label: "Violet cyan", from: "#a78bfa", to: "#22d3ee", angle: 135 },
  { id: "ink-silver", label: "Ink silver", from: "#f8fafc", to: "#94a3b8", angle: 180 },
];

const GRADIENT_PRESETS_FRONT_MATTER_KEY = "apploopGradientPresets";
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function defaultGradientPresets() {
  return DEFAULT_PRESENTATION_GRADIENT_PRESETS.map((preset) => ({ ...preset }));
}

function sanitizeGradientPreset(value: unknown, index: number): PresentationGradientPreset | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const from = typeof record.from === "string" && HEX_COLOR.test(record.from.trim()) ? record.from.trim() : "";
  const to = typeof record.to === "string" && HEX_COLOR.test(record.to.trim()) ? record.to.trim() : "";
  const rawAngle = typeof record.angle === "number" ? record.angle : Number(record.angle);
  if (!from || !to || !Number.isFinite(rawAngle)) return null;
  const rawId = typeof record.id === "string" ? record.id.trim() : "";
  const rawLabel = typeof record.label === "string" ? record.label.trim() : "";
  const label = rawLabel || `Gradient ${index + 1}`;
  const id = (rawId || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `gradient-${index + 1}`).slice(0, 80);
  return {
    id,
    label: label.slice(0, 80),
    from,
    to,
    angle: Math.min(360, Math.max(0, Math.round(rawAngle))),
  };
}

function normalizeGradientPresets(presets: unknown) {
  if (!Array.isArray(presets)) return defaultGradientPresets();
  const normalized = presets
    .map((preset, index) => sanitizeGradientPreset(preset, index))
    .filter((preset): preset is PresentationGradientPreset => Boolean(preset));
  return normalized.length > 0 ? normalized : defaultGradientPresets();
}

function readFrontMatterScalar(frontMatter: string, key: string) {
  const lines = frontMatter.replace(/\r\n/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.startsWith(`${key}:`)) continue;
    const value = line.slice(key.length + 1).trim();
    if (value === "|" || value === ">") {
      const blockLines: string[] = [];
      for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex += 1) {
        const blockLine = lines[blockIndex] ?? "";
        if (blockLine.trim() && !/^\s/.test(blockLine)) break;
        blockLines.push(blockLine.replace(/^ {2}/, ""));
      }
      return blockLines.join("\n").trim();
    }
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
    if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\"/g, '"');
    return value;
  }
  return "";
}

function removeFrontMatterKey(frontMatter: string, key: string) {
  const lines = frontMatter.replace(/\r\n/g, "\n").split("\n");
  const nextLines: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.startsWith(`${key}:`)) {
      nextLines.push(line);
      continue;
    }
    const value = line.slice(key.length + 1).trim();
    if (value === "|" || value === ">") {
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1] ?? "";
        if (nextLine.trim() && !/^\s/.test(nextLine)) break;
        index += 1;
      }
    }
  }
  return nextLines.join("\n");
}

export function readPresentationGradientPresets(markdown: string) {
  const { frontMatter } = splitMarpDocument(markdown);
  const raw = readFrontMatterScalar(frontMatter, GRADIENT_PRESETS_FRONT_MATTER_KEY);
  if (!raw) return defaultGradientPresets();
  try {
    return normalizeGradientPresets(JSON.parse(raw));
  } catch {
    return defaultGradientPresets();
  }
}

export function upsertPresentationGradientPresets(markdown: string, presets: unknown) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const normalized = normalizeGradientPresets(presets);
  const json = JSON.stringify(normalized).replace(/'/g, "''");
  const withoutOld = removeFrontMatterKey(frontMatter, GRADIENT_PRESETS_FRONT_MATTER_KEY).trimEnd();
  const nextFrontMatter = withoutOld.replace(/\n---\s*$/, `\n${GRADIENT_PRESETS_FRONT_MATTER_KEY}: '${json}'\n---`);
  return `${nextFrontMatter}\n\n${slides.join("\n\n---\n\n")}\n`;
}

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

export type PresentationSlideSize = {
  width: number;
  height: number;
};

export const DEFAULT_PRESENTATION_SLIDE_SIZE: PresentationSlideSize = { width: 1280, height: 720 };

const MARP_NAMED_SLIDE_SIZES = new Map<string, PresentationSlideSize>([
  ["16:9", { width: 1280, height: 720 }],
  ["4:3", { width: 960, height: 720 }],
  ["4k", { width: 3840, height: 2160 }],
]);

/**
 * Reads the deck slide size from front matter (`size: 16:9`, `size: 1600x900`,
 * or an explicit `width`/`height` pair). Falls back to Marp's 16:9 default.
 */
export function readPresentationSlideSize(markdown: string): PresentationSlideSize {
  const { frontMatter } = splitMarpDocument(markdown);
  const rawSize = readFrontMatterScalar(frontMatter, "size").trim().toLowerCase();
  const named = MARP_NAMED_SLIDE_SIZES.get(rawSize);
  if (named) return { ...named };
  const explicit = rawSize.match(/^(\d+)\s*[x:]\s*(\d+)$/);
  if (explicit) {
    const width = Number(explicit[1]);
    const height = Number(explicit[2]);
    if (width > 0 && height > 0 && rawSize.includes("x")) {
      return { width, height };
    }
    // `size: 3:2` style ratios keep the 720px reference height Marp uses.
    if (width > 0 && height > 0) {
      return { width: Math.round((720 * width) / height), height: 720 };
    }
  }
  const width = Number.parseInt(readFrontMatterScalar(frontMatter, "width"), 10);
  const height = Number.parseInt(readFrontMatterScalar(frontMatter, "height"), 10);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }
  return { ...DEFAULT_PRESENTATION_SLIDE_SIZE };
}

/**
 * Scales `natural` down (never up) so it fits inside the slide box, keeping the
 * aspect ratio. `padding` reserves slide margin on each axis.
 */
export function fitImageToSlide(
  natural: { width: number; height: number },
  slide: PresentationSlideSize = DEFAULT_PRESENTATION_SLIDE_SIZE,
  padding = 0,
): { width: number; height: number; scaled: boolean } {
  const maxWidth = Math.max(1, slide.width - padding * 2);
  const maxHeight = Math.max(1, slide.height - padding * 2);
  if (!(natural.width > 0) || !(natural.height > 0)) {
    return { width: 0, height: 0, scaled: false };
  }
  if (natural.width <= maxWidth && natural.height <= maxHeight) {
    return { width: Math.round(natural.width), height: Math.round(natural.height), scaled: false };
  }
  const ratio = Math.min(maxWidth / natural.width, maxHeight / natural.height);
  return {
    width: Math.max(1, Math.round(natural.width * ratio)),
    height: Math.max(1, Math.round(natural.height * ratio)),
    scaled: true,
  };
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

export function insertBlankMarpSlide(markdown: string, afterSlideIndex1Based: number) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const nextSlides = slides.length > 0 ? [...slides] : [""];
  const insertIndex = Math.min(Math.max(afterSlideIndex1Based, 0), nextSlides.length);
  nextSlides.splice(insertIndex, 0, "<!-- apploop-blank-slide -->");
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
    .replace(/[•◦▪‣]\s*(?:\[[ xX]\]\s*)?/g, " ")
    .replace(/[☐☑☒✓✔✗✕]/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+] \[[ xX]\] |[-*+] |\d+\. )/gm, "")
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

export type MarpListConversionKind = "ordered" | "unordered" | "checklist";

function linesToListItems(lines: string[], fallbackText: string, kind: MarpListConversionKind) {
  const items = lines
    .map((line) => listItemContent(line))
    .filter(Boolean);
  if (items.length === 0) {
    const fallback = normalizeBlockText(fallbackText);
    if (fallback) items.push(fallback);
  }
  return items.map((item, index) => {
    if (kind === "checklist") return `- [ ] ${item}`;
    if (kind === "ordered") return `${index + 1}. ${item}`;
    return `- ${item}`;
  });
}

function removeEmptyMarkdownMarkers(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s*$/gm, "")
    .replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s*)$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type RemoveMarpSlideElementOptions = {
  path?: string;
  tag?: string;
};

function removeHtmlElementByTagAndText(slideMarkdown: string, text: string, tag: string) {
  const normalizedText = normalizeBlockText(text);
  if (!normalizedText || !/^(?:p|h[1-6]|blockquote|li|span)$/i.test(tag)) return null;
  const elementPattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = elementPattern.exec(slideMarkdown)) !== null) {
    const html = match[0] ?? "";
    const normalizedHtml = normalizeBlockText(html.replace(/<[^>]+>/g, " "));
    if (normalizedHtml === normalizedText || normalizedHtml.includes(normalizedText) || normalizedText.includes(normalizedHtml)) {
      return removeEmptyMarkdownMarkers(`${slideMarkdown.slice(0, match.index)}${slideMarkdown.slice(match.index + html.length)}`);
    }
  }
  return null;
}

function removeSvgShapeByMarker(slideMarkdown: string, text: string, tag: string) {
  if (!/^(?:svg|rect|circle|ellipse|line|path|polygon|polyline)$/i.test(tag)) return null;
  const marker = text.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
  if (!marker) return null;
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (tag === "svg") {
    const svgBlockPattern = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
    let removed = false;
    const next = slideMarkdown.replace(svgBlockPattern, (match) => {
      if (removed) return match;
      const candidateMarker = match.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
      if (candidateMarker !== marker) return match;
      removed = true;
      return "";
    });
    return removed ? removeEmptyMarkdownMarkers(next) : null;
  }
  const svgWrapperPattern = new RegExp(
    `<svg\\b[^>]*>\\s*<${tag}\\b(?=[^>]*\\bdata-apploop-shape=["']${escapedMarker}["'])[^>]*(?:\\/>|>\\s*<\\/${tag}>)\\s*<\\/svg>`,
    "i",
  );
  if (svgWrapperPattern.test(slideMarkdown)) {
    return removeEmptyMarkdownMarkers(slideMarkdown.replace(svgWrapperPattern, ""));
  }
  const shapePattern = new RegExp(
    `<${tag}\\b(?=[^>]*\\bdata-apploop-shape=["']${escapedMarker}["'])[^>]*(?:\\/>|>\\s*<\\/${tag}>)`,
    "i",
  );
  if (shapePattern.test(slideMarkdown)) {
    return removeEmptyMarkdownMarkers(slideMarkdown.replace(shapePattern, ""));
  }
  return null;
}

export function removeMarpSlideElement(slideMarkdown: string, text: string, options: RemoveMarpSlideElementOptions = {}) {
  const normalizedText = normalizeBlockText(text);
  if (!normalizedText) return slideMarkdown;

  const tag = options.tag?.toLowerCase().trim() ?? "";
  const svgShapeRemoval = removeSvgShapeByMarker(slideMarkdown, text, tag);
  if (svgShapeRemoval !== null) return svgShapeRemoval;
  const targetedHtmlRemoval = removeHtmlElementByTagAndText(slideMarkdown, text, tag);
  if (targetedHtmlRemoval !== null) return targetedHtmlRemoval;

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
  kind: MarpListConversionKind,
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
