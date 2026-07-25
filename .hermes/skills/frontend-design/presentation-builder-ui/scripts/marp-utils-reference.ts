/**
 * Client-safe Marp slide utilities
 * No node:fs imports — safe to import from "use client" components.
 * 
 * Usage:
 *   import { splitMarpDocument, getMarpSlideBody, replaceMarpSlideBody, parseSlideStyles, injectSlideStylesIntoFrontMatter } from "@/lib/presentations/marp-utils";
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

  return { frontMatter, slides: slides.length > 0 ? slides : [""] };
}

export function getMarpSlideBody(markdown: string, slideIndex1Based: number): string {
  const { slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), slides.length) - 1;
  // Strip Marp directives like <!-- _class: ... -->
  return (slides[index] ?? "").replace(/<!--\s*_.*?-->/g, "").trimEnd();
}

export function replaceMarpSlideBody(markdown: string, slideIndex1Based: number, nextBody: string): string {
  const { frontMatter, slides } = splitMarpDocument(markdown);
  const index = Math.min(Math.max(slideIndex1Based, 1), Math.max(slides.length, 1)) - 1;
  const updated = slides.length > 0 ? [...slides] : [""];
  while (updated.length <= index) updated.push("");
  updated[index] = nextBody.trim();
  return `${frontMatter}\n\n${updated.join("\n\n---\n\n")}\n`;
}

export function countMarpSlides(markdown: string): number {
  return splitMarpDocument(markdown).slides.length;
}

export type SlideStyles = { backgrounds: string[]; textColors: string[] };

const DEFAULT_SLIDE_BG = "#000000";
const DEFAULT_SLIDE_TEXT = "#ffffff";

/**
 * Parse per-slide background + text colors from the front-matter `style:` CSS block.
 * We look for:
 *   section.slide-bg-N { background-color: #... !important; }
 *   section.slide-text-N { color: #... !important; }
 */
export function parseSlideStyles(frontMatter: string, slideCount: number): SlideStyles {
  const backgrounds = Array<string>(Math.max(slideCount, 1)).fill(DEFAULT_SLIDE_BG);
  const textColors = Array<string>(Math.max(slideCount, 1)).fill(DEFAULT_SLIDE_TEXT);

  for (let i = 1; i <= backgrounds.length; i++) {
    // Combined rule (background + color in one block) — prefer this
    const combinedRe = new RegExp(`section\\\\.slide-bg-${i}\\\\s*\\\\{[^}]*background-color:\\\\s*(#[a-fA-F0-9]{3,8})[^}]*color:\\\\s*(#[a-fA-F0-9]{3,8})`, "m");
    const combinedM = frontMatter.match(combinedRe);
    if (combinedM?.[1]) backgrounds[i - 1] = combinedM[1];
    if (combinedM?.[2]) textColors[i - 1] = combinedM[2];

    // Fallback: background-only rule
    if (!combinedM?.[1]) {
      const bgRe = new RegExp(`section\\\\.slide-bg-${i}\\\\s*\\\\{[^}]*background-color:\\\\s*(#[a-fA-F0-9]{3,8})`, "m");
      const bgM = frontMatter.match(bgRe);
      if (bgM?.[1]) backgrounds[i - 1] = bgM[1];
    }

    // Fallback: text-only rule
    if (!combinedM?.[2]) {
      const txtRe = new RegExp(`section\\\\.slide-text-${i}\\\\s*\\\\{[^}]*color:\\\\s*(#[a-fA-F0-9]{3,8})`, "m");
      const txtM = frontMatter.match(txtRe);
      if (txtM?.[1]) textColors[i - 1] = txtM[1];
    }
  }

  return { backgrounds, textColors };
}

/**
 * Write/replace per-slide background + text color rules into the front-matter `style:` block.
 * Strips any previous slide-bg / slide-text rules first.
 */
export function injectSlideStylesIntoFrontMatter(frontMatter: string, backgrounds: string[], textColors: string[]): string {
  const lines = frontMatter.split("\n");
  const out: string[] = [];
  let inStyleBlock = false;
  let styleKeySeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFence = /^\s*---\s*$/.test(line);

    if (/^style:\s*\|?\s*$/.test(line)) {
      inStyleBlock = true;
      styleKeySeen = true;
      out.push(line);
      continue;
    }

    if (inStyleBlock) {
      if (isFence || (/^[a-zA-Z_-]+:/.test(line) && !/^\s/.test(line))) {
        inStyleBlock = false;
      } else {
        // Inside style block: drop old slide-bg / slide-text rules, keep the rest
        if (/section\.(slide-bg|slide-text)-\d+/.test(line)) continue;
        out.push(line);
        continue;
      }
    }
    out.push(line);
  }

  // Build new CSS rules
  const cssRules = backgrounds
    .map((bg, i) => {
      const tc = textColors[i] ?? DEFAULT_SLIDE_TEXT;
      return `  section.slide-bg-${i + 1} { background-color: ${bg} !important; }\n  section.slide-text-${i + 1} { color: ${tc} !important; }`;
    })
    .join("\n");

  const closingIdx = out.lastIndexOf("---");
  if (closingIdx === -1) return out.join("\n");

  if (styleKeySeen) {
    out.splice(closingIdx, 0, cssRules);
  } else {
    out.splice(closingIdx, 0, "style: |", cssRules);
  }
  return out.join("\n");
}

/**
 * Inject `<!-- _class: slide-bg-N slide-text-N -->` directive at the top of each slide.
 */
export function injectSlideClassDirectives(markdown: string): string {
  const parts = splitMarpDocument(markdown);
  const updated = parts.slides.map((slide, i) => {
    const bgClass = `slide-bg-${i + 1}`;
    const txtClass = `slide-text-${i + 1}`;
    const combined = `${bgClass} ${txtClass}`;
    if (/<!--\s*_class:\s*slide-bg-\d+/.test(slide)) {
      return slide.replace(/<!--\s*_class:\s*slide-bg-\d+[^\-]*-->/, `<!-- _class: ${combined} -->`);
    }
    return `<!-- _class: ${combined} -->\n${slide}`;
  });
  return `${parts.frontMatter}\n\n${updated.join("\n\n---\n\n")}\n`;
}