import { z } from "zod";
import { createHash } from "node:crypto";
import { splitMarpDocument } from "@/lib/presentations/marp";
import { findMarkdownBlockRange } from "@/lib/presentations/marp-utils";

export const PresentationElementStyleSchema = z.object({
  background: z.string().optional(),
  color: z.string().optional(),
  fill: z.string().optional(),
  fillOpacity: z.string().optional(),
  stroke: z.string().optional(),
  strokeLinecap: z.string().optional(),
  strokeLinejoin: z.string().optional(),
  strokeWidth: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  boxSizing: z.string().optional(),
  padding: z.string().optional(),
  paddingLeft: z.string().optional(),
  margin: z.string().optional(),
  border: z.string().optional(),
  borderRadius: z.string().optional(),
  borderCollapse: z.string().optional(),
  borderSpacing: z.string().optional(),
  tableLayout: z.string().optional(),
  maxWidth: z.string().optional(),
  listStyleType: z.string().optional(),
  opacity: z.string().optional(),
  visibility: z.string().optional(),
  pointerEvents: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontStyle: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  wordSpacing: z.string().optional(),
  textTransform: z.string().optional(),
  textAlign: z.enum(["left", "center", "right", "justify", ""]).optional(),
  boxShadow: z.string().optional(),
  textShadow: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundClip: z.string().optional(),
  webkitBackgroundClip: z.string().optional(),
  webkitTextFillColor: z.string().optional(),
  // Absolute placement within the slide section (percent of section box).
  left: z.string().optional(),
  top: z.string().optional(),
  right: z.string().optional(),
  bottom: z.string().optional(),
  transform: z.string().optional(),
  position: z.enum(["absolute", "relative", "static", ""]).optional(),
  zIndex: z.string().optional(),
  alignSelf: z.enum(["auto", "flex-start", "center", "flex-end", "stretch", ""]).optional(),
  justifySelf: z.enum(["auto", "start", "center", "end", "stretch", ""]).optional(),
  display: z.string().optional(),
});

export type PresentationElementStyle = z.infer<typeof PresentationElementStyleSchema>;

export type PresentationStyleTarget = {
  slide: number;
  tag: string;
  text: string;
  path: string;
  style: PresentationElementStyle;
};

const STYLE_BLOCK_START = "/* @apploop-inspect-styles */";
const STYLE_BLOCK_END = "/* @apploop-inspect-styles-end */";
const CLASS_PREFIX = "apploop-el-";
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const SVG_SHAPE_TAGS = new Set(["svg", "rect", "circle", "ellipse", "line", "path", "polygon", "polyline"]);
const SVG_PRIMITIVE_TAGS = new Set(["rect", "circle", "ellipse", "line", "path", "polygon", "polyline"]);
const SVG_PAINT_STYLE_KEYS = new Set<keyof PresentationElementStyle>(["fill", "fillOpacity", "stroke", "strokeLinecap", "strokeLinejoin", "strokeWidth"]);

const CSS_PROP_MAP: Array<[keyof PresentationElementStyle, string]> = [
  ["background", "background"],
  ["backgroundImage", "background-image"],
  ["backgroundClip", "background-clip"],
  ["webkitBackgroundClip", "-webkit-background-clip"],
  ["webkitTextFillColor", "-webkit-text-fill-color"],
  ["color", "color"],
  ["fill", "fill"],
  ["fillOpacity", "fill-opacity"],
  ["stroke", "stroke"],
  ["strokeLinecap", "stroke-linecap"],
  ["strokeLinejoin", "stroke-linejoin"],
  ["strokeWidth", "stroke-width"],
  ["width", "width"],
  ["height", "height"],
  ["boxSizing", "box-sizing"],
  ["padding", "padding"],
  ["paddingLeft", "padding-left"],
  ["margin", "margin"],
  ["border", "border"],
  ["borderRadius", "border-radius"],
  ["borderCollapse", "border-collapse"],
  ["borderSpacing", "border-spacing"],
  ["tableLayout", "table-layout"],
  ["maxWidth", "max-width"],
  ["listStyleType", "list-style-type"],
  ["opacity", "opacity"],
  ["visibility", "visibility"],
  ["pointerEvents", "pointer-events"],
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontStyle", "font-style"],
  ["fontWeight", "font-weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
  ["wordSpacing", "word-spacing"],
  ["textTransform", "text-transform"],
  ["textAlign", "text-align"],
  ["boxShadow", "box-shadow"],
  ["textShadow", "text-shadow"],
  ["left", "left"],
  ["top", "top"],
  ["right", "right"],
  ["bottom", "bottom"],
  ["transform", "transform"],
  ["position", "position"],
  ["zIndex", "z-index"],
  ["alignSelf", "align-self"],
  ["justifySelf", "justify-self"],
  ["display", "display"],
];

/**
 * Stable identity for styled elements.
 * ONLY slide + normalized text. Tag/path change after wrap/reload
 * (p → span.apploop-el-…), and would orphan saved styles.
 */
export function buildElementClassName(target: Pick<PresentationStyleTarget, "slide" | "tag" | "text" | "path">) {
  const normalizedText = SVG_SHAPE_TAGS.has(target.tag.toLowerCase())
    ? normalizeSvgShapeIdentity(target.text)
    : normalizeText(target.text);
  const hash = createHash("sha1")
    .update(`${target.slide}|${normalizedText}`)
    .digest("hex")
    .slice(0, 10);
  return `${CLASS_PREFIX}${hash}`;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

// Layer-based selections send Markdown source text (e.g. "### Title"). Strip
// the heading markers so identity and wrapping match DOM-text selections and
// raw markdown never ends up inside an HTML wrapper (Marp would render "###").
function stripHeadingMarkers(text: string) {
  return text.replace(/^\s*#{1,6}\s+/, "").replace(/\s+#+\s*$/, "");
}

function normalizeSvgShapeIdentity(text: string) {
  const marker = text.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
  if (marker) return marker;
  return normalizeText(
    text
      .replace(/\sclass=["'][^"']*["']/gi, "")
      .replace(/\sstyle=["'][^"']*["']/gi, "")
      .replace(/\s(?:fill|stroke|stroke-width|opacity)=["'][^"']*["']/gi, ""),
  );
}

export function styleToCssDeclarations(style: PresentationElementStyle, options: { important?: boolean } = {}) {
  const lines: string[] = [];
  for (const [key, cssName] of CSS_PROP_MAP) {
    const value = style[key];
    if (typeof value === "string" && value.trim().length > 0) {
      const cleanValue = value.trim().replace(/\s*!important\s*$/i, "");
      if (/(?:NaN|Infinity|undefined|null)/i.test(cleanValue)) continue;
      lines.push(`${cssName}: ${cleanValue}${options.important ? " !important" : ""};`);
    }
  }
  return lines;
}

export function styleToInlineAttribute(style: PresentationElementStyle) {
  const declarations = styleToCssDeclarations(style);
  if (declarations.length === 0) {
    return "";
  }
  return declarations
    .join(" ")
    .replace(/&/g, "&" + "amp;")
    .replace(/"/g, "&" + "quot;");
}

export function styleToCssRule(className: string, style: PresentationElementStyle, tag?: string) {
  const declarations = styleToCssDeclarations(style, { important: tag === "table" || tag === "ul" || tag === "ol" || tag === "blockquote" || tag === "pre" || tag === "img" || tag === "hr" || SVG_SHAPE_TAGS.has(tag ?? "") });
  if (declarations.length === 0) {
    return "";
  }
  // Block elements (tables, lists, quotes, fences) are wrapped in a div carrying
  // the class; scope tag-specific properties onto the inner element so reloads
  // match the live inline preview.
  if (tag === "table") {
    const cellProps = new Set(["padding", "border"]);
    const cellDeclarations = declarations.filter((line) => cellProps.has(line.split(":")[0]?.trim() ?? ""));
    const tableDeclarations = declarations.filter((line) => {
      const prop = line.split(":")[0]?.trim() ?? "";
      return !cellProps.has(prop) && prop !== "display" && prop !== "table-layout";
    });
    const hasWidth = tableDeclarations.some((line) => (line.split(":")[0]?.trim() ?? "") === "width");
    const rules: string[] = [];
    tableDeclarations.unshift("table-layout: fixed !important;");
    tableDeclarations.unshift("display: table !important;");
    if (!hasWidth) {
      tableDeclarations.unshift("width: 100% !important;");
    }
    if (tableDeclarations.length > 0) {
      rules.push(`.${className} > table {\n    ${tableDeclarations.join("\n    ")}\n  }`);
    }
    if (cellDeclarations.length > 0) {
      rules.push(`.${className} th,\n  .${className} td {\n    ${cellDeclarations.join("\n    ")}\n  }`);
    }
    return rules.join("\n  ");
  }
  if (tag === "img") {
    const imageDeclarations = declarations.filter((line) => {
      const prop = line.split(":")[0]?.trim() ?? "";
      return prop !== "max-width";
    });
    imageDeclarations.unshift("max-width: 100% !important;");
    if (!imageDeclarations.some((line) => (line.split(":")[0]?.trim() ?? "") === "height")) {
      imageDeclarations.push("height: auto !important;");
    }
    return `.${className} img {\n    ${imageDeclarations.join("\n    ")}\n  }`;
  }
  if (tag === "ul" || tag === "ol" || tag === "blockquote" || tag === "pre" || tag === "hr") {
    return `.${className} > ${tag} {\n    ${declarations.join("\n    ")}\n  }`;
  }
  // Class rules remain as a backup / batch-edit surface. Marpit scopes front-matter
  // CSS under the slide section automatically.
  return `.${className} {\n    ${declarations.join("\n    ")}\n  }`;
}

export function stylesToCssBlock(entries: Array<{ className: string; style: PresentationElementStyle; tag?: string }>) {
  const rules = entries
    .map((entry) => styleToCssRule(entry.className, entry.style, entry.tag))
    .filter(Boolean);
  if (rules.length === 0) {
    return "";
  }
  const googleFonts = [...new Set(entries
    .map((entry) => entry.style.fontFamily?.match(/["']([^"']+)["']/)?.[1] ?? entry.style.fontFamily?.split(",")[0]?.trim())
    .filter((family): family is string => Boolean(family && /[A-Za-z]/.test(family))))]
    .filter((family) => !/^(?:serif|sans-serif|monospace|system-ui|ui-serif|ui-sans-serif|ui-monospace)$/i.test(family));
  const imports = googleFonts.map((family) => `@import url('https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, "+")}&display=swap');`);
  // Ensure absolute children can anchor to the slide frame after Marpit scoping.
  const base = [
    ...imports,
    "/* position context for dragged/absolute inspect nodes */",
    "section {",
    "  position: relative;",
    "}",
    ...rules,
  ];
  return `${STYLE_BLOCK_START}\n  ${base.join("\n  ")}\n  ${STYLE_BLOCK_END}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}

function textFromHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

export function parseManagedStyleEntries(markdown: string): Array<{ className: string; style: PresentationElementStyle; tag?: string }> {
  const match = markdown.match(
    new RegExp(`${escapeRegExp(STYLE_BLOCK_START)}([\\s\\S]*?)${escapeRegExp(STYLE_BLOCK_END)}`),
  );
  if (!match) {
    return [];
  }

  const block = match[1] ?? "";
  const merged = new Map<string, { className: string; style: PresentationElementStyle; tag?: string }>();
  const ruleRegex = /\.((?:apploop-el-)[a-z0-9_-]+)((?:\s*[>a-z,.\s-]+?)?)\s*\{([^}]*)\}/gi;
  let ruleMatch: RegExpExecArray | null;
  while ((ruleMatch = ruleRegex.exec(block)) !== null) {
    const className = ruleMatch[1] ?? "";
    const suffix = (ruleMatch[2] ?? "").trim();
    const body = ruleMatch[3] ?? "";
    const style: PresentationElementStyle = {};
    for (const line of body.split(";")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(":")) continue;
      const colon = trimmed.indexOf(":");
      const prop = trimmed.slice(0, colon).trim().toLowerCase();
      const value = trimmed.slice(colon + 1).trim().replace(/\s*!important\s*$/i, "");
      const mapped = CSS_PROP_MAP.find(([, cssName]) => cssName === prop);
      if (mapped) {
        (style as Record<string, string>)[mapped[0]] = value;
      }
    }
    if (!className || styleToCssDeclarations(style).length === 0) continue;
    const tag = suffix.match(/^(?:>\s*)?(table|ul|ol|blockquote|pre|img|hr|svg|rect|circle|ellipse|line|path|polygon|polyline)$/)?.[1]
      ?? (suffix.startsWith("th") || suffix.includes("td") ? "table" : undefined);
    const existing = merged.get(className);
    if (existing) {
      existing.style = { ...existing.style, ...style };
      if (tag && !existing.tag) existing.tag = tag;
    } else {
      merged.set(className, { className, style, tag });
    }
  }
  return [...merged.values()];
}

// The managed block removal must never consume the following line's leading
// indentation: inside a YAML `style: |` block scalar, dedenting the next line
// to column 0 terminates the scalar and silently drops the rest of the theme
// CSS (which manifests as slides losing their backgrounds).
function removeManagedCssBlock(frontMatter: string) {
  return frontMatter.replace(
    new RegExp(
      `\\n[\\t ]*${escapeRegExp(STYLE_BLOCK_START)}[\\s\\S]*?${escapeRegExp(STYLE_BLOCK_END)}[\\t ]*(?:\\n|$)`,
      "g",
    ),
    "\n",
  );
}

// Repair decks corrupted by the previous removal regex: CSS lines that were
// dedented to column 0 inside the `style: |` scalar get re-indented so the
// scalar (and the theme CSS that follows) stays part of the front matter.
function reindentOrphanedStyleLines(frontMatter: string) {
  const lines = frontMatter.split("\n");
  const styleIndex = lines.findIndex((line) => /^style:\s*\|\s*$/.test(line));
  if (styleIndex === -1) return frontMatter;
  for (let index = styleIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^---\s*$/.test(line)) break;
    if (line.length === 0 || /^\s/.test(line)) continue;
    // A bare top-level YAML key ends the scalar region. CSS lines that could
    // look like keys (e.g. `background: #000;`) end with `;` or `{`.
    if (/^[A-Za-z_][A-Za-z0-9_-]*:(?:\s|$)/.test(line) && !/[;{]\s*$/.test(line)) break;
    lines[index] = `  ${line}`;
  }
  return lines.join("\n");
}

export function upsertFrontMatterStyleBlock(frontMatter: string, cssBlock: string) {
  let fm = reindentOrphanedStyleLines(frontMatter.trimEnd());
  if (!fm.endsWith("---")) {
    fm = `${fm}\n---`;
  }

  if (!cssBlock) {
    return removeManagedCssBlock(fm).replace(/\n{3,}/g, "\n\n");
  }

  const blockIndented = cssBlock
    .split("\n")
    .map((line) => (line.length ? `  ${line}` : line))
    .join("\n");

  if (/^style:\s*\|/m.test(fm)) {
    const withoutOld = removeManagedCssBlock(fm);
    const lines = withoutOld.split("\n");
    const styleIndex = lines.findIndex((line) => /^style:\s*\|\s*$/.test(line));
    if (styleIndex === -1) {
      return withoutOld.replace(/\n---\s*$/, `\nstyle: |\n${blockIndented}\n---`);
    }

    const blockLines = blockIndented.split("\n");
    if (blockLines.some((line) => /^\s*@import\b/.test(line))) {
      let importInsertIndex = styleIndex + 1;
      while (importInsertIndex < lines.length) {
        const line = lines[importInsertIndex] ?? "";
        if (/^---\s*$/.test(line) || (/^[A-Za-z_-][A-Za-z0-9_-]*:\s*/.test(line) && !/^\s/.test(line))) break;
        if (line.trim().length > 0) break;
        importInsertIndex += 1;
      }
      lines.splice(importInsertIndex, 0, ...blockLines);
      return lines.join("\n");
    }

    let insertIndex = lines.length;
    for (let index = styleIndex + 1; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (/^---\s*$/.test(line) || (/^[A-Za-z_-][A-Za-z0-9_-]*:\s*/.test(line) && !/^\s/.test(line))) {
        insertIndex = index;
        break;
      }
    }
    lines.splice(insertIndex, 0, ...blockLines);
    return lines.join("\n");
  }

  return fm.replace(/\n---\s*$/, `\nstyle: |\n${blockIndented}\n---`);
}

function stripAllApploopWrappersAroundText(markdown: string, text: string) {
  if (!text) return markdown;
  // Unwrap nested / sibling apploop spans that exactly (or nearly) wrap this text.
  let next = markdown;
  const escaped = escapeRegExp(text);
  const wrapper = new RegExp(
    `<span\\s+(?:class=["'][^"']*\\bapploop-el-[a-z0-9_-]+\\b[^"']*["']|style=["'][^"']*["']|\\s)+\\s*>\\s*(${escaped})\\s*<\\/span>`,
    "gi",
  );
  // Also match class-first or style-first attribute orders.
  const wrapperLoose = new RegExp(
    `<span\\b[^>]*\\bclass=["'][^"']*\\bapploop-el-[a-z0-9_-]+\\b[^"']*["'][^>]*>\\s*(${escaped})\\s*<\\/span>`,
    "gi",
  );
  for (let i = 0; i < 6; i += 1) {
    const replaced = next.replace(wrapper, "$1").replace(wrapperLoose, "$1");
    if (replaced === next) break;
    next = replaced;
  }
  return next;
}

function stripExistingWrapper(markdown: string, className: string) {
  return markdown.replace(
    new RegExp(
      `<span\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`,
      "g",
    ),
    "$1",
  );
}

function stripAttribute(attrs: string, name: string) {
  return attrs.replace(new RegExp(`\\s+${name}=["'][^"']*["']`, "i"), "");
}

function upsertClassAttribute(attrs: string, className: string) {
  const match = attrs.match(/\sclass=(['"])(.*?)\1/i);
  if (!match) return `${attrs} class="${className}"`;
  const quote = match[1] ?? '"';
  const classes = new Set((match[2] ?? "").split(/\s+/).filter(Boolean));
  classes.add(className);
  return attrs.replace(/\sclass=(['"])(.*?)\1/i, ` class=${quote}${[...classes].join(" ")}${quote}`);
}

function upsertStyleAttribute(attrs: string, style: PresentationElementStyle) {
  const inline = styleToInlineAttribute(style);
  const withoutStyle = stripAttribute(attrs, "style");
  return inline ? `${withoutStyle} style="${inline}"` : withoutStyle;
}

function pickStyle(style: PresentationElementStyle, include: (key: keyof PresentationElementStyle) => boolean) {
  const next: PresentationElementStyle = {};
  for (const [key, value] of Object.entries(style) as Array<[keyof PresentationElementStyle, string | undefined]>) {
    if (typeof value === "string" && include(key)) {
      next[key] = value as never;
    }
  }
  return next;
}

function svgHostStyle(style: PresentationElementStyle) {
  return pickStyle(style, (key) => !SVG_PAINT_STYLE_KEYS.has(key));
}

function svgPaintStyle(style: PresentationElementStyle) {
  return pickStyle(style, (key) => SVG_PAINT_STYLE_KEYS.has(key));
}

function upsertSvgShapeClass(slideMarkdown: string, target: PresentationStyleTarget, className: string, style: PresentationElementStyle) {
  const tag = target.tag.toLowerCase();
  if (!SVG_SHAPE_TAGS.has(tag)) return slideMarkdown;
  const text = target.text.trim();
  const marker = text.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
  const hostStyle = tag === "svg" ? svgHostStyle(style) : style;
  const paintStyle = tag === "svg" ? svgPaintStyle(style) : {};
  if (tag === "svg" && marker) {
    const svgBlockPattern = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
    let replaced = false;
    return slideMarkdown.replace(svgBlockPattern, (match) => {
        if (replaced) return match;
        const candidateMarker = match.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
        if (candidateMarker !== marker) return match;
        replaced = true;
        const openTag = match.match(/^<svg\b[^>]*>/i)?.[0];
        if (!openTag) return match;
        const openAttrs = openTag.replace(/^<svg\b/i, "").replace(/>$/, "");
        const markerIsOnSvg = openTag.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1] === marker;
        const nextOpenTag = `<svg${upsertStyleAttribute(upsertClassAttribute(openAttrs, className), markerIsOnSvg ? style : hostStyle)}>`;
        let nextMatch = `${nextOpenTag}${match.slice(openTag.length)}`;
        if (markerIsOnSvg || styleToCssDeclarations(paintStyle).length === 0) return nextMatch;
        const primitivePattern = /<(rect|circle|ellipse|line|path|polygon|polyline)\b[^>]*\bdata-apploop-shape=["'][^"']+["'][^>]*>/i;
        nextMatch = nextMatch.replace(primitivePattern, (primitive) => {
          const primitiveTag = primitive.match(/^<(rect|circle|ellipse|line|path|polygon|polyline)\b/i)?.[1] ?? "path";
          const closing = /\/\s*>$/.test(primitive) ? " />" : ">";
          const attrs = primitive.replace(new RegExp(`^<${primitiveTag}\\b`, "i"), "").replace(/\s*\/?>$/, "");
          return `<${primitiveTag}${upsertStyleAttribute(attrs, paintStyle)}${closing}`;
        });
        return nextMatch;
      });
  }
  if (!SVG_PRIMITIVE_TAGS.has(tag)) return slideMarkdown;
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  let replaced = false;
  return slideMarkdown.replace(tagPattern, (match) => {
    if (replaced) return match;
    const candidateMarker = match.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
    if (marker ? candidateMarker !== marker : normalizeSvgShapeIdentity(match) !== normalizeSvgShapeIdentity(text)) return match;
    replaced = true;
    const closing = /\/\s*>$/.test(match) ? " />" : ">";
    const attrs = match.replace(new RegExp(`^<${tag}\\b`, "i"), "").replace(/\s*\/?>$/, "");
    return `<${tag}${upsertStyleAttribute(upsertClassAttribute(attrs, className), style)}${closing}`;
  });
}

function removeSvgShapeStyle(slideMarkdown: string, target: PresentationStyleTarget, className: string) {
  const tag = target.tag.toLowerCase();
  if (!SVG_SHAPE_TAGS.has(tag)) return slideMarkdown;
  if (tag === "svg") {
    const marker = target.text.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
    const svgBlockPattern = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
    return slideMarkdown.replace(svgBlockPattern, (match) => {
      const candidateMarker = match.match(/\bdata-apploop-shape=["']([^"']+)["']/i)?.[1];
      const hasClass = new RegExp(`\\b${escapeRegExp(className)}\\b`).test(match);
      if (marker ? candidateMarker !== marker : !hasClass) return match;
      const openTag = match.match(/^<svg\b[^>]*>/i)?.[0];
      if (!openTag) return match;
      const attrs = openTag.replace(/^<svg\b/i, "").replace(/>$/, "");
      const classMatch = attrs.match(/\sclass=(["'])(.*?)\1/i);
      const quote = classMatch?.[1] ?? '"';
      const classes = (classMatch?.[2] ?? "").split(/\s+/).filter((token) => token && token !== className);
      const withoutClass = attrs.replace(/\sclass=(["'])(.*?)\1/i, classes.length ? ` class=${quote}${classes.join(" ")}${quote}` : "");
      const nextOpen = `<svg${stripAttribute(withoutClass, "style")}>`;
      return `${nextOpen}${match.slice(openTag.length)}`;
    });
  }
  if (!SVG_PRIMITIVE_TAGS.has(tag)) return slideMarkdown;
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  return slideMarkdown.replace(tagPattern, (match) => {
    if (!new RegExp(`\\b${escapeRegExp(className)}\\b`).test(match)) return match;
    const closing = /\/\s*>$/.test(match) ? " />" : ">";
    const attrs = match.replace(new RegExp(`^<${tag}\\b`, "i"), "").replace(/\s*\/?>$/, "");
    const classMatch = attrs.match(/\sclass=(["'])(.*?)\1/i);
    const quote = classMatch?.[1] ?? '"';
    const classes = (classMatch?.[2] ?? "").split(/\s+/).filter((token) => token && token !== className);
    const withoutClass = attrs.replace(/\sclass=(["'])(.*?)\1/i, classes.length ? ` class=${quote}${classes.join(" ")}${quote}` : "");
    return `<${tag}${stripAttribute(withoutClass, "style")}${closing}`;
  });
}

function removeManagedPillStyle(slideMarkdown: string, className: string) {
  return slideMarkdown.replace(
    /<(span|div)\b([^>]*\bclass=["'][^"']*\bpill\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (match: string, tag: string, attrs: string, inner: string) => {
      if (!new RegExp(`\\b${escapeRegExp(className)}\\b`).test(attrs)) return match;
      const classMatch = attrs.match(/\sclass=(['"])(.*?)\1/i);
      const quote = classMatch?.[1] ?? '"';
      const classes = (classMatch?.[2] ?? "").split(/\s+/).filter((token) => token && token !== className);
      const withoutClass = attrs.replace(/\sclass=(['"])(.*?)\1/i, classes.length ? ` class=${quote}${classes.join(" ")}${quote}` : "");
      return `<${tag}${stripAttribute(withoutClass, "style")}>${inner}</${tag}>`;
    },
  );
}

function makeWrapperOpenTag(className: string, style: PresentationElementStyle) {
  const inline = styleToInlineAttribute(style);
  if (inline) {
    return `<span class="${className}" style="${inline}">`;
  }
  return `<span class="${className}">`;
}

function makeHeadingTag(tag: string, className: string, style: PresentationElementStyle, text: string) {
  const inline = styleToInlineAttribute(style);
  const styleAttribute = inline ? ` style="${inline}"` : "";
  return `<${tag} class="${className}"${styleAttribute}>${escapeHtmlText(text)}</${tag}>`;
}

function stripExistingHeadingWrapper(slideMarkdown: string, className: string) {
  return slideMarkdown.replace(
    new RegExp(
      `<h([1-6])\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/h\\1>`,
      "g",
    ),
    (_match, level: string, inner: string) => `${"#".repeat(Number(level))} ${normalizeText(textFromHtml(inner))}`,
  );
}

function wrapHeadingInSlideMarkdown(
  slideMarkdown: string,
  target: PresentationStyleTarget,
  className: string,
  style: PresentationElementStyle,
) {
  const tag = target.tag.toLowerCase();
  const level = Number(tag.slice(1));
  const text = normalizeText(target.text);
  if (!level || !text) return slideMarkdown;

  let body = stripExistingHeadingWrapper(slideMarkdown, className);
  body = stripAllApploopWrappersAroundText(body, text);
  // Heal wrappers that captured the raw markdown heading (legacy bug): unwrap
  // "<span ...>### Title</span>" back to "### Title" so it re-wraps as a heading.
  body = stripAllApploopWrappersAroundText(body, `${"#".repeat(level)} ${text}`);
  body = stripExistingWrapper(body, className);
  const lines = body.split("\n");
  const lineIndex = lines.findIndex((line) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    return Boolean(match && match[1]?.length === level && normalizeText(match[2] ?? "") === text);
  });
  if (lineIndex === -1) {
    return wrapTextInSlideMarkdown(body, target, className, style);
  }
  lines[lineIndex] = makeHeadingTag(tag, className, style, text);
  return lines.join("\n");
}

function wrapTextInSlideMarkdown(
  slideMarkdown: string,
  target: PresentationStyleTarget,
  className: string,
  style: PresentationElementStyle,
) {
  const text = normalizeText(target.text);
  if (!text) {
    return slideMarkdown;
  }

  // Drop any previous apploop wrappers around this text, then apply the canonical one.
  let body = stripAllApploopWrappersAroundText(slideMarkdown, text);
  body = stripExistingWrapper(body, className);
  const open = makeWrapperOpenTag(className, style);

  const idx = body.indexOf(text);
  if (idx === -1) {
    const prefix = text.slice(0, Math.min(24, text.length));
    const softIdx = body.indexOf(prefix);
    if (softIdx === -1) {
      return body;
    }
    const end = softIdx + prefix.length;
    return `${body.slice(0, softIdx)}${open}${body.slice(softIdx, end)}</span>${body.slice(end)}`;
  }

  return `${body.slice(0, idx)}${open}${text}</span>${body.slice(idx + text.length)}`;
}

function wrapPillInSlideMarkdown(
  slideMarkdown: string,
  target: PresentationStyleTarget,
  className: string,
  style: PresentationElementStyle,
) {
  const text = normalizeText(target.text);
  if (!text) return slideMarkdown;

  const body = removeManagedPillStyle(slideMarkdown, className);
  let replaced = false;
  const next = body.replace(
    /<(span|div)\b([^>]*\bclass=["'][^"']*\bpill\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (match: string, tag: string, attrs: string, inner: string) => {
      if (replaced || normalizeText(textFromHtml(inner)) !== text) return match;
      replaced = true;
      const nextAttrs = upsertStyleAttribute(upsertClassAttribute(attrs, className), style);
      return `<${tag}${nextAttrs}>${escapeHtmlText(text)}</${tag}>`;
    },
  );
  return replaced ? next : wrapTextInSlideMarkdown(body, target, className, style);
}

function collectReferencedClassNames(markdown: string) {
  const found = new Set<string>();
  const re = /class=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    for (const token of (match[1] ?? "").split(/\s+/)) {
      if (token.startsWith(CLASS_PREFIX)) {
        found.add(token);
      }
    }
  }
  return found;
}

const BLOCK_WRAP_TAGS = new Set(["table", "ul", "ol", "blockquote", "pre", "img", "hr"]);

function stripExistingBlockWrapper(slideMarkdown: string, className: string) {
  return slideMarkdown.replace(
    new RegExp(
      `<div\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>\\s*\\n([\\s\\S]*?)\\n\\s*<\\/div>`,
      "g",
    ),
    "$1",
  );
}

function wrapBlockInSlideMarkdown(
  slideMarkdown: string,
  target: PresentationStyleTarget,
  className: string,
) {
  const withoutWrapper = stripExistingBlockWrapper(slideMarkdown, className);
  const lines = withoutWrapper.split("\n");
  const range = target.tag.toLowerCase() === "hr"
    ? findDividerRange(lines, target.text)
    : findMarkdownBlockRange(lines, target.text, { groupLists: true });
  if (!range) {
    return withoutWrapper;
  }
  const before = lines.slice(0, range.start);
  const block = lines.slice(range.start, range.end);
  const after = lines.slice(range.end);
  return [
    ...before,
    `<div class="${className}">`,
    "",
    ...block,
    "",
    "</div>",
    ...after,
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

function findDividerRange(lines: string[], text: string) {
  const trimmedText = text.trim();
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!line) continue;
    if (/^<div\b[^>]*\bclass=["'][^"']*\bapploop-el-[a-z0-9_-]+\b[^"']*["'][^>]*>$/i.test(line)) {
      let end = index + 1;
      while (end < lines.length && !/^<\/div>$/i.test((lines[end] ?? "").trim())) end += 1;
      if (end < lines.length) {
        const block = lines.slice(index, end + 1).join("\n");
        if (/<hr\b/i.test(block)) return { start: index, end: end + 1 };
      }
    }
    if (line === trimmedText || /^<hr\b/i.test(line) || /^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      return { start: index, end: index + 1 };
    }
  }
  return null;
}

/**
 * Apply (or remove) visual styles for inspect selections.
 * - Merges into managed CSS block in front-matter `style: |`
 * - Wraps matching text on the target slide with `<span class="apploop-el-...">`
 * - Keeps previously saved styles for other elements still referenced in the deck
 */
export function applyPresentationElementStylesToMarkdown(
  markdown: string,
  targets: PresentationStyleTarget[],
): { markdown: string; classNames: string[] } {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const nextSlides = [...slides];
  const existingEntries = parseManagedStyleEntries(markdown);
  const entryMap = new Map(existingEntries.map((entry) => [entry.className, { style: entry.style, tag: entry.tag }]));
  const classNames: string[] = [];

  for (const rawTarget of targets) {
    const rawTag = rawTarget.tag.toLowerCase();
    const hasHeadingMarkers = HEADING_TAGS.has(rawTag) && /^\s*#{1,6}\s/.test(rawTarget.text);
    const target = hasHeadingMarkers
      ? { ...rawTarget, text: stripHeadingMarkers(rawTarget.text) }
      : rawTarget;
    const slideIndex = Math.min(Math.max(target.slide, 1), nextSlides.length) - 1;
    const className = buildElementClassName(target);
    classNames.push(className);
    // Migrate styles saved under the marker-prefixed identity (legacy bug).
    if (hasHeadingMarkers) {
      const legacyClassName = buildElementClassName(rawTarget);
      const legacyEntry = entryMap.get(legacyClassName);
      if (legacyClassName !== className && legacyEntry) {
        if (!entryMap.has(className)) entryMap.set(className, legacyEntry);
        entryMap.delete(legacyClassName);
      }
    }
    const targetTag = target.tag.toLowerCase();
    const isBlockTarget = BLOCK_WRAP_TAGS.has(targetTag);
    const isHeadingTarget = HEADING_TAGS.has(targetTag);
    const isPillTarget = targetTag === "pill";
    const isSvgShapeTarget = SVG_SHAPE_TAGS.has(targetTag);
    const incoming = PresentationElementStyleSchema.parse(target.style ?? {});
    // Merge onto any previously saved style for this stable class so partial updates
    // (drag-only, color-only) do not wipe earlier properties.
    const mergedStyle = { ...(entryMap.get(className)?.style ?? {}) } as Record<string, string | undefined>;
    for (const [key, value] of Object.entries(incoming)) {
      if (typeof value !== "string") continue;
      if (value.trim().length > 0) {
        mergedStyle[key] = value;
      } else {
        delete mergedStyle[key];
      }
    }
    const parsedStyle = PresentationElementStyleSchema.parse(mergedStyle);
    const hasStyles = styleToCssDeclarations(parsedStyle).length > 0;

    if (hasStyles) {
      entryMap.set(className, { style: parsedStyle, tag: isBlockTarget || isSvgShapeTarget ? targetTag : undefined });
      nextSlides[slideIndex] = isSvgShapeTarget
        ? upsertSvgShapeClass(nextSlides[slideIndex] ?? "", target, className, parsedStyle)
        : isBlockTarget
        ? wrapBlockInSlideMarkdown(nextSlides[slideIndex] ?? "", target, className)
        : isHeadingTarget
          ? wrapHeadingInSlideMarkdown(nextSlides[slideIndex] ?? "", target, className, parsedStyle)
          : isPillTarget
            ? wrapPillInSlideMarkdown(nextSlides[slideIndex] ?? "", target, className, parsedStyle)
        : wrapTextInSlideMarkdown(nextSlides[slideIndex] ?? "", target, className, parsedStyle);
    } else {
      entryMap.delete(className);
      nextSlides[slideIndex] = isSvgShapeTarget
        ? removeSvgShapeStyle(nextSlides[slideIndex] ?? "", target, className)
        : isBlockTarget
        ? stripExistingBlockWrapper(nextSlides[slideIndex] ?? "", className)
        : isHeadingTarget
          ? stripExistingHeadingWrapper(nextSlides[slideIndex] ?? "", className)
          : isPillTarget
            ? removeManagedPillStyle(nextSlides[slideIndex] ?? "", className)
        : stripExistingWrapper(nextSlides[slideIndex] ?? "", className);
    }
  }

  const bodyMarkdown = nextSlides.join("\n\n---\n\n");
  const referenced = collectReferencedClassNames(bodyMarkdown);
  // Keep only styles that still have a wrapper in the body, plus the ones we just applied.
  const applied = new Set(classNames);
  const styleEntries = [...entryMap.entries()]
    .filter(([className]) => referenced.has(className) || applied.has(className))
    .map(([className, entry]) => ({ className, style: entry.style, tag: entry.tag }));

  const cssBlock = stylesToCssBlock(styleEntries);
  const nextFrontMatter = upsertFrontMatterStyleBlock(frontMatter, cssBlock);
  const nextMarkdown = [nextFrontMatter, "", bodyMarkdown, ""].join("\n");

  return {
    markdown: nextMarkdown.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n",
    classNames,
  };
}

export function mergeManagedStyleBlock(
  markdown: string,
  keepEntries: Array<{ className: string; style: PresentationElementStyle }>,
) {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const cssBlock = stylesToCssBlock(keepEntries);
  const nextFrontMatter = upsertFrontMatterStyleBlock(frontMatter, cssBlock);
  return [nextFrontMatter, "", slides.join("\n\n---\n\n"), ""].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function repairManagedStyleBlock(markdown: string) {
  if (!markdown.includes(STYLE_BLOCK_START)) return markdown;
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const cssBlock = stylesToCssBlock(parseManagedStyleEntries(markdown));
  const nextFrontMatter = upsertFrontMatterStyleBlock(frontMatter, cssBlock);
  return [nextFrontMatter, "", slides.join("\n\n---\n\n"), ""].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Front-most stacking order for one slide: one step above the highest z-index
 * already persisted for an element that slide references (managed CSS rule or
 * inline style attribute). Floored at 3 so a newly inserted element also clears
 * the defaults the placement paths use when an element has no saved z-index
 * (`alignmentToStyle` uses 2, drag/resize use 3).
 */
export function nextFrontZIndexForSlide(markdown: string, slide: number) {
  const { slides } = splitMarpDocument(markdown);
  const slideIndex = Math.min(Math.max(slide, 1), Math.max(slides.length, 1)) - 1;
  const slideMarkdown = slides[slideIndex] ?? "";
  const referenced = collectReferencedClassNames(slideMarkdown);
  let highest = 0;

  for (const entry of parseManagedStyleEntries(markdown)) {
    if (!referenced.has(entry.className)) continue;
    const parsed = Number.parseInt(entry.style.zIndex ?? "", 10);
    if (Number.isFinite(parsed)) highest = Math.max(highest, parsed);
  }

  const inlineZIndex = /z-index:\s*(-?\d+)/gi;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineZIndex.exec(slideMarkdown)) !== null) {
    const parsed = Number.parseInt(inlineMatch[1] ?? "", 10);
    if (Number.isFinite(parsed)) highest = Math.max(highest, parsed);
  }

  return Math.max(highest + 1, 3);
}

/**
 * Placement written once, when an element is first added to a slide: centered in
 * the slide frame and in front of everything already there.
 *
 * Centering is `left/top: 50%` plus a percentage translate so it holds for any
 * element size (the size is unknown until the slide renders). A later drag or
 * arrow move merges onto the same managed class and replaces `transform` with a
 * pixel offset, so the centering only ever applies to the first render.
 */
export function centeredInsertPlacementStyle(zIndex: number): PresentationElementStyle {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: String(zIndex),
  };
}

export function alignmentToStyle(
  horizontal?: "left" | "center" | "right",
  vertical?: "top" | "middle" | "bottom",
): PresentationElementStyle {
  const style: PresentationElementStyle = {
    position: "absolute",
    zIndex: "2",
  };

  if (horizontal === "left") {
    style.left = "6%";
    style.right = "auto";
    style.transform = vertical ? undefined : "translateX(0)";
    style.textAlign = "left";
  } else if (horizontal === "center") {
    style.left = "50%";
    style.right = "auto";
    style.textAlign = "center";
  } else if (horizontal === "right") {
    style.left = "auto";
    style.right = "6%";
    style.textAlign = "right";
  }

  if (vertical === "top") {
    style.top = "8%";
    style.bottom = "auto";
  } else if (vertical === "middle") {
    style.top = "50%";
    style.bottom = "auto";
  } else if (vertical === "bottom") {
    style.top = "auto";
    style.bottom = "8%";
  }

  const tx =
    horizontal === "center" ? "-50%" : horizontal === "right" ? "0" : horizontal === "left" ? "0" : "0";
  const ty =
    vertical === "middle" ? "-50%" : vertical === "bottom" ? "0" : vertical === "top" ? "0" : "0";

  if (horizontal === "center" || vertical === "middle") {
    style.transform = `translate(${tx}, ${ty})`;
  } else if (horizontal || vertical) {
    style.transform = "none";
  }

  return style;
}
