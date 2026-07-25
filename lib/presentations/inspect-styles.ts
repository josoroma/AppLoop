import { z } from "zod";
import { createHash } from "node:crypto";
import { splitMarpDocument } from "@/lib/presentations/marp";
import { findMarkdownBlockRange } from "@/lib/presentations/marp-utils";

export const PresentationElementStyleSchema = z.object({
  background: z.string().optional(),
  color: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  padding: z.string().optional(),
  paddingLeft: z.string().optional(),
  margin: z.string().optional(),
  border: z.string().optional(),
  borderRadius: z.string().optional(),
  borderCollapse: z.string().optional(),
  borderSpacing: z.string().optional(),
  listStyleType: z.string().optional(),
  opacity: z.string().optional(),
  fontSize: z.string().optional(),
  fontStyle: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
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

const CSS_PROP_MAP: Array<[keyof PresentationElementStyle, string]> = [
  ["background", "background"],
  ["backgroundImage", "background-image"],
  ["backgroundClip", "background-clip"],
  ["webkitBackgroundClip", "-webkit-background-clip"],
  ["webkitTextFillColor", "-webkit-text-fill-color"],
  ["color", "color"],
  ["width", "width"],
  ["height", "height"],
  ["padding", "padding"],
  ["paddingLeft", "padding-left"],
  ["margin", "margin"],
  ["border", "border"],
  ["borderRadius", "border-radius"],
  ["borderCollapse", "border-collapse"],
  ["borderSpacing", "border-spacing"],
  ["listStyleType", "list-style-type"],
  ["opacity", "opacity"],
  ["fontSize", "font-size"],
  ["fontStyle", "font-style"],
  ["fontWeight", "font-weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
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
  const normalizedText = normalizeText(target.text);
  const hash = createHash("sha1")
    .update(`${target.slide}|${normalizedText}`)
    .digest("hex")
    .slice(0, 10);
  return `${CLASS_PREFIX}${hash}`;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function styleToCssDeclarations(style: PresentationElementStyle, options: { important?: boolean } = {}) {
  const lines: string[] = [];
  for (const [key, cssName] of CSS_PROP_MAP) {
    const value = style[key];
    if (typeof value === "string" && value.trim().length > 0) {
      const cleanValue = value.trim().replace(/\s*!important\s*$/i, "");
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
  const declarations = styleToCssDeclarations(style, { important: tag === "table" || tag === "ul" || tag === "ol" || tag === "blockquote" || tag === "pre" });
  if (declarations.length === 0) {
    return "";
  }
  // Block elements (tables, lists, quotes, fences) are wrapped in a div carrying
  // the class; scope tag-specific properties onto the inner element so reloads
  // match the live inline preview.
  if (tag === "table") {
    const cellProps = new Set(["padding", "border"]);
    const cellDeclarations = declarations.filter((line) => cellProps.has(line.split(":")[0]?.trim() ?? ""));
    const tableDeclarations = declarations.filter((line) => !cellProps.has(line.split(":")[0]?.trim() ?? ""));
    const rules: string[] = [];
    if (tableDeclarations.length > 0) {
      rules.push(`.${className} > table {\n    ${tableDeclarations.join("\n    ")}\n  }`);
    }
    if (cellDeclarations.length > 0) {
      rules.push(`.${className} th,\n  .${className} td {\n    ${cellDeclarations.join("\n    ")}\n  }`);
    }
    return rules.join("\n  ");
  }
  if (tag === "ul" || tag === "ol" || tag === "blockquote" || tag === "pre") {
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
  // Ensure absolute children can anchor to the slide frame after Marpit scoping.
  const base = [
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
    const tag = suffix.match(/^>\s*(table|ul|ol|blockquote|pre)$/)?.[1]
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

export function upsertFrontMatterStyleBlock(frontMatter: string, cssBlock: string) {
  let fm = frontMatter.trimEnd();
  if (!fm.endsWith("---")) {
    fm = `${fm}\n---`;
  }

  if (!cssBlock) {
    return fm
      .replace(
        new RegExp(`\\n\\s*${escapeRegExp(STYLE_BLOCK_START)}[\\s\\S]*?${escapeRegExp(STYLE_BLOCK_END)}\\s*`, "g"),
        "\n",
      )
      .replace(/\n{3,}/g, "\n\n");
  }

  const blockIndented = cssBlock
    .split("\n")
    .map((line) => (line.length ? `  ${line}` : line))
    .join("\n");

  if (/^style:\s*\|/m.test(fm)) {
    const withoutOld = fm.replace(
      new RegExp(`\\n\\s*${escapeRegExp(STYLE_BLOCK_START)}[\\s\\S]*?${escapeRegExp(STYLE_BLOCK_END)}\\s*`, "g"),
      "\n",
    );
    const closing = withoutOld.lastIndexOf("\n---");
    if (closing === -1) {
      return `${withoutOld}\nstyle: |\n${blockIndented}\n---`;
    }
    const head = withoutOld.slice(0, closing);
    const ensureStyle = /^style:\s*\|/m.test(head)
      ? head
      : `${head.replace(/\n---\s*$/, "")}\nstyle: |\n`;
    if (/^style:\s*\|/m.test(head)) {
      return `${head.trimEnd()}\n${blockIndented}\n---`;
    }
    return `${ensureStyle}${blockIndented}\n---`;
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

function makeWrapperOpenTag(className: string, style: PresentationElementStyle) {
  const inline = styleToInlineAttribute(style);
  if (inline) {
    return `<span class="${className}" style="${inline}">`;
  }
  return `<span class="${className}">`;
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

const BLOCK_WRAP_TAGS = new Set(["table", "ul", "ol", "blockquote", "pre"]);

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
  const range = findMarkdownBlockRange(lines, target.text, { groupLists: true });
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

  for (const target of targets) {
    const slideIndex = Math.min(Math.max(target.slide, 1), nextSlides.length) - 1;
    const className = buildElementClassName(target);
    classNames.push(className);
    const targetTag = target.tag.toLowerCase();
    const isBlockTarget = BLOCK_WRAP_TAGS.has(targetTag);
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
      entryMap.set(className, { style: parsedStyle, tag: isBlockTarget ? targetTag : undefined });
      nextSlides[slideIndex] = isBlockTarget
        ? wrapBlockInSlideMarkdown(nextSlides[slideIndex] ?? "", target, className)
        : wrapTextInSlideMarkdown(nextSlides[slideIndex] ?? "", target, className, parsedStyle);
    } else {
      entryMap.delete(className);
      nextSlides[slideIndex] = isBlockTarget
        ? stripExistingBlockWrapper(nextSlides[slideIndex] ?? "", className)
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
