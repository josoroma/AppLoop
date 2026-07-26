"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  House,
  ImagePlus,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  Lock,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Presentation,
  Redo2,
  RefreshCw,
  Save,
  SendHorizontal,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  MDXEditor,
  UndoRedo,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  BlockTypeSelect,
  ListsToggle,
  InsertThematicBreak,
  InsertCodeBlock,
  InsertTable,
  activeEditor$,
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  imagePlugin,
  tablePlugin,
  markdownShortcutPlugin,
} from "@mdxeditor/editor";
import { useCellValue } from "@mdxeditor/gurx";
import { $createRangeSelectionFromDom, $getSelection, $isElementNode, $isRangeSelection, $isTextNode, $setSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, type RangeSelection } from "lexical";
import "@mdxeditor/editor/style.css";
import { Button } from "@/components/ui/button";
import type { BuilderChatMessage } from "@/lib/chat/messages";
import { getMessageText } from "@/lib/chat/messages";
import { applyPresentationInspectStylesAction, convertPresentationElementToListAction, deletePresentationElementAction, listPresentationImagesAction, replacePresentationElementTextAction, savePresentationMarkdownAction, uploadPresentationImageAction } from "@/lib/presentations/actions";
import {
  splitMarpDocument,
  cloneMarpSlide,
  deleteMarpSlide,
  readPresentationGradientPresets,
  getMarpSlideBody,
  insertBlankMarpSlide,
  replaceMarpSlideBody,
  countMarpSlides,
  reorderMarpSlide,
  upsertPresentationGradientPresets,
} from "@/lib/presentations/marp-utils";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

const chatTransport = new DefaultChatTransport<BuilderChatMessage>({ api: "/api/presentations/chat" });

type SlideSummary = { index: number; title: string; preview: string };
type PresentationSelectionTarget = {
  alt?: string;
  id: string;
  slide: number;
  totalSlides?: number;
  tag: string;
  text: string;
  path: string;
  style: Record<string, string | undefined>;
};
type PresentationLayerItem = PresentationSelectionTarget & {
  domIndex?: number;
  hidden?: boolean;
  label?: string;
  layerIndex?: number;
  locked?: boolean;
  zIndex?: number;
};
type SlideStyleSnapshot = { backgrounds: string[]; textColors: string[]; overrideSlides: number[] };
type PresentationImageAsset = { name: string; path: string; alt: string; contentType: string };
type SlideHistoryEntry =
  | { kind: "markdown"; before: string; after: string }
  | { kind: "slide-style"; before: SlideStyleSnapshot; after: SlideStyleSnapshot };
type SlideHistory = Record<number, { undo: SlideHistoryEntry[]; redo: SlideHistoryEntry[] }>;
type ShapeInsertKind = "shape-rounded-rect" | "shape-rounded-square" | "shape-circle" | "shape-rounded-triangle" | "shape-diamond" | "shape-pill" | "shape-hexagon" | "shape-star" | "shape-line";
type IconInsertKind = "icon-arrow-right" | "icon-arrow-left" | "icon-arrow-up" | "icon-arrow-down" | "icon-arrow-bend" | "icon-check" | "icon-x" | "icon-plus" | "icon-spark";
type MarpInsertKind = "heading" | "paragraph" | "bullets" | "numbered" | "checklist" | "quote" | "code" | "table" | "pills" | "callout" | "columns" | "divider" | ShapeInsertKind | IconInsertKind;
type BuilderProps = {
  presentationId: string;
  presentationName: string;
  sourceFile: string;
  initialActiveSlide?: number;
  initialImageAssets: PresentationImageAsset[];
  initialSlideCount: number;
  initialSlides: SlideSummary[];
  initialMarkdown: string;
  initialMessages: BuilderChatMessage[];
};

const DEFAULT_SLIDE_BG = "#000000";
const DEFAULT_SLIDE_TEXT = "#ffffff";
const DEFAULT_SELECTION_BG = "#fef08a";
const MIN_CHAT_WIDTH = 260;
const MAX_CHAT_WIDTH = 560;

function clampSlideNumber(slide: number, totalSlides: number) {
  if (!Number.isFinite(slide)) return 1;
  return Math.min(Math.max(Math.trunc(slide), 1), Math.max(totalSlides, 1));
}

function readSlideQuery(totalSlides: number) {
  if (typeof window === "undefined") return null;
  const requested = Number.parseInt(new URL(window.location.href).searchParams.get("slide") ?? "", 10);
  if (!Number.isFinite(requested)) return null;
  return clampSlideNumber(requested, totalSlides);
}

function withSlideColorPreviewParams(src: string, enabled: boolean, background: string, textColor: string) {
  if (!enabled) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}slideBackground=${encodeURIComponent(background)}&slideTextColor=${encodeURIComponent(textColor)}`;
}

function slideStyleSnapshot(backgrounds: string[], textColors: string[], overrideSlides: number[]): SlideStyleSnapshot {
  return { backgrounds: [...backgrounds], textColors: [...textColors], overrideSlides: [...overrideSlides] };
}

function sameSlideStyleSnapshot(left: SlideStyleSnapshot, right: SlideStyleSnapshot) {
  return sameStringArray(left.backgrounds, right.backgrounds)
    && sameStringArray(left.textColors, right.textColors)
    && sameNumberArray(left.overrideSlides, right.overrideSlides);
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameNumberArray(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function replaceSlideQuery(slide: number) {
  const url = new URL(window.location.href);
  const nextSlide = String(slide);
  if (url.searchParams.get("slide") === nextSlide) return;
  url.searchParams.set("slide", nextSlide);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function summarizeSlidesFromMarkdown(markdown: string): SlideSummary[] {
  return splitMarpDocument(markdown).slides.map((slide, index) => {
    const title = slide.match(/^#{1,6}\s+(.+)$/m)?.[1]
      ?? slide.replace(/<!--[\s\S]*?-->/g, "").split("\n").find((line) => line.trim())
      ?? `Slide ${index + 1}`;
    return {
      index: index + 1,
      title: title.replace(/[#*_`<>]/g, "").trim().slice(0, 80) || `Slide ${index + 1}`,
      preview: slide.replace(/\s+/g, " ").trim().slice(0, 180),
    };
  });
}
const TEXT_STYLE_PRESETS = [
  { id: "headline", label: "Headline", style: { display: "block", width: "100%", fontSize: "76px", fontWeight: "800", lineHeight: "0.95", letterSpacing: "0px" } },
  { id: "subtitle", label: "Subtitle", style: { display: "block", width: "100%", fontSize: "42px", fontWeight: "700", lineHeight: "1.05", letterSpacing: "0px" } },
  { id: "body", label: "Body", style: { fontSize: "28px", fontWeight: "400", lineHeight: "1.35", letterSpacing: "0px", opacity: "1", fontStyle: "" } },
  { id: "caption", label: "Caption", style: { fontSize: "18px", fontWeight: "500", lineHeight: "1.35", letterSpacing: "0px", opacity: "0.78" } },
  { id: "kicker", label: "Kicker", style: { fontSize: "16px", fontWeight: "800", lineHeight: "1.2", letterSpacing: "0.18em", textTransform: "uppercase" } },
  { id: "quote", label: "Quote", style: { display: "block", width: "100%", fontSize: "40px", fontWeight: "700", lineHeight: "1.15", fontStyle: "italic", letterSpacing: "0px" } },
] as const;
const MARP_INSERTS: Array<{ id: MarpInsertKind; label: string }> = [
  { id: "heading", label: "Heading" },
  { id: "paragraph", label: "Paragraph" },
  { id: "bullets", label: "Bullet list" },
  { id: "numbered", label: "Numbered list" },
  { id: "checklist", label: "Checklist" },
  { id: "quote", label: "Quote" },
  { id: "code", label: "Code block" },
  { id: "table", label: "Table" },
  { id: "pills", label: "Pill block" },
  { id: "callout", label: "Callout" },
  { id: "columns", label: "Two columns" },
  { id: "divider", label: "Divider" },
];

const SHAPE_INSERTS: Array<{ id: ShapeInsertKind; label: string }> = [
  { id: "shape-rounded-rect", label: "Rounded rectangle" },
  { id: "shape-rounded-square", label: "Rounded square" },
  { id: "shape-circle", label: "Circle" },
  { id: "shape-rounded-triangle", label: "Rounded triangle" },
  { id: "shape-diamond", label: "Diamond" },
  { id: "shape-pill", label: "Pill" },
  { id: "shape-hexagon", label: "Hexagon" },
  { id: "shape-star", label: "Star" },
  { id: "shape-line", label: "Line" },
];

const ICON_INSERTS: Array<{ id: IconInsertKind; label: string }> = [
  { id: "icon-arrow-right", label: "Arrow right" },
  { id: "icon-arrow-left", label: "Arrow left" },
  { id: "icon-arrow-up", label: "Arrow up" },
  { id: "icon-arrow-down", label: "Arrow down" },
  { id: "icon-arrow-bend", label: "Bend arrow" },
  { id: "icon-check", label: "Check" },
  { id: "icon-x", label: "X" },
  { id: "icon-plus", label: "Plus" },
  { id: "icon-spark", label: "Spark" },
];

function ShapeMenuIcon({ kind }: { kind: ShapeInsertKind }) {
  const baseClassName = "h-5 w-5 shrink-0 overflow-visible text-zinc-100";
  switch (kind) {
    case "shape-rounded-rect":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="4" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case "shape-rounded-square":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case "shape-circle":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case "shape-rounded-triangle":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M12 4.5 Q12.9 4.5 13.4 5.3 L20 17.3 Q20.6 18.4 19.3 18.4 H4.7 Q3.4 18.4 4 17.3 L10.6 5.3 Q11.1 4.5 12 4.5 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
    case "shape-diamond":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><polygon points="12,3.5 20.5,12 12,20.5 3.5,12" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
    case "shape-pill":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="5" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case "shape-hexagon":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><polygon points="8,4 16,4 21,12 16,20 8,20 3,12" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
    case "shape-star":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M12 3.4 L14.4 8.4 L19.9 9.2 L15.9 13.1 L16.9 18.6 L12 16 L7.1 18.6 L8.1 13.1 L4.1 9.2 L9.6 8.4 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" /></svg>;
    case "shape-line":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg>;
  }
}

function IconMenuIcon({ kind }: { kind: IconInsertKind }) {
  const baseClassName = "h-5 w-5 shrink-0 overflow-visible text-zinc-100";
  switch (kind) {
    case "icon-arrow-right":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M4 12 H19 M14 7 L19 12 L14 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
    case "icon-arrow-left":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M20 12 H5 M10 7 L5 12 L10 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
    case "icon-arrow-up":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M12 20 V5 M7 10 L12 5 L17 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
    case "icon-arrow-down":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M12 4 V19 M7 14 L12 19 L17 14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
    case "icon-arrow-bend":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M5 19 V12 Q5 6 11 6 H19 M15 2 L19 6 L15 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
    case "icon-check":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></svg>;
    case "icon-x":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M7 7 L17 17 M17 7 L7 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg>;
    case "icon-plus":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M12 5 V19 M5 12 H19" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg>;
    case "icon-spark":
      return <svg aria-hidden="true" className={baseClassName} viewBox="0 0 24 24"><path d="M12 3.5 L14.2 9.2 L20 12 L14.2 14.8 L12 20.5 L9.8 14.8 L4 12 L9.8 9.2 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
}

function svgMarker(kind: MarpInsertKind) {
  return `${kind}-${Date.now().toString(36)}`;
}

function svgBox(inner: string, width = 220, height = 140) {
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Editable SVG element">${inner}</svg>`;
}

function PresentationSlideThumbnail({ bg, eager, src, textColor, title }: { bg: string; eager: boolean; src: string; textColor: string; title: string }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const frameHostRef = useRef<HTMLDivElement | null>(null);
  const shouldRender = eager || shouldLoad;

  useEffect(() => {
    const host = frameHostRef.current;
    if (!host || shouldRender) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = globalThis.setTimeout(() => setShouldLoad(true), 300);
      return () => globalThis.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "360px 0px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={frameHostRef} className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10" style={{ background: bg, color: textColor }}>
      {shouldRender ? (
        <iframe className="pointer-events-none absolute inset-0 h-full w-full border-0" loading={eager ? "eager" : "lazy"} sandbox="allow-same-origin" src={src} tabIndex={-1} title={title} />
      ) : (
        <div className="absolute inset-0 bg-black/20" />
      )}
    </div>
  );
}

function deckFileName(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${slug || "presentation"}.md`;
}

function presentationAssetSrc(presentationId: string, assetPath: string) {
  const safePath = assetPath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `/presentations/${encodeURIComponent(presentationId)}/${safePath}`;
}

function cleanMarkdownImageAlt(value: string) {
  return value.replace(/[\]\n\r]/g, " ").replace(/\s+/g, " ").trim();
}

function updateImageAltInSlideMarkdown(slideMarkdown: string, imageSrc: string, alt: string) {
  const safeAlt = cleanMarkdownImageAlt(alt);
  const lines = slideMarkdown.split("\n");
  let changed = false;
  const nextLines = lines.map((line) => {
    if (changed || !line.includes(imageSrc)) return line;
    const markdownMatch = line.match(/^(\s*)!\[[^\]]*\]\(([^)]+)\)(\s*)$/);
    if (markdownMatch && markdownMatch[2]?.startsWith(imageSrc)) {
      changed = true;
      return `${markdownMatch[1] ?? ""}![${safeAlt}](${markdownMatch[2]})${markdownMatch[3] ?? ""}`;
    }
    const htmlMatch = line.match(/<img\b[^>]*\bsrc=["'][^"']+["'][^>]*>/i);
    if (!htmlMatch) return line;
    changed = true;
    const imageTag = htmlMatch[0];
    const safeAttribute = safeAlt.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const nextTag = /\balt=["'][^"']*["']/i.test(imageTag)
      ? imageTag.replace(/\balt=["'][^"']*["']/i, `alt="${safeAttribute}"`)
      : imageTag.replace(/\s*\/?>$/, ` alt="${safeAttribute}"$&`);
    return line.replace(imageTag, nextTag);
  });
  return { changed, markdown: nextLines.join("\n") };
}

function getSlideValue(values: string[], slide: number, fallback: string) {
  return values[Math.min(Math.max(slide, 1), values.length) - 1] ?? fallback;
}

function mergeCssDeclaration(style: string, property: string, value: string) {
  const declarations = new Map<string, string>();
  for (const declaration of style.split(";")) {
    const [rawName, ...rawValue] = declaration.split(":");
    const name = rawName?.trim().toLowerCase();
    const declarationValue = rawValue.join(":").trim();
    if (name && declarationValue) declarations.set(name, declarationValue);
  }
  declarations.set(property, value);
  return Array.from(declarations, ([name, declarationValue]) => `${name}: ${declarationValue}`).join("; ");
}

function safeHexColor(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function parsePxValue(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textGradientStyle(from: string, to: string, angle: number, display?: string): Record<string, string> {
  return {
    display: display || "inline-block",
    backgroundImage: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
    backgroundClip: "text",
    webkitBackgroundClip: "text",
    webkitTextFillColor: "transparent",
    color: "transparent",
  };
}

function boxGradientStyle(from: string, to: string, angle: number): Record<string, string> {
  return {
    backgroundImage: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
    backgroundClip: "",
    webkitBackgroundClip: "",
    webkitTextFillColor: "",
  };
}

const SVG_ELEMENT_TAGS = ["svg", "rect", "circle", "ellipse", "line", "path", "polygon", "polyline"];

function buildMarpInsertBlock(kind: MarpInsertKind) {
  switch (kind) {
    case "heading":
      return "## New heading";
    case "paragraph":
      return "A concise supporting sentence.";
    case "bullets":
      return "- First point\n- Second point\n- Third point";
    case "numbered":
      return "1. First step\n2. Second step\n3. Third step";
    case "checklist":
      return "- [ ] Draft the idea\n- [ ] Review the flow\n- [ ] Ship the slide";
    case "quote":
      return "> A sharp idea worth emphasizing.";
    case "code":
      return "```ts\nconst message = \"Make it clear.\";\n```";
    case "table":
      return "| Metric | Status | Owner |\n| --- | --- | --- |\n| Adoption | On track | Team |\n| Risk | Watch | Team |";
    case "pills":
      return "<p class=\"apploop-pill-block\">\n<span class=\"pill pill-emerald\">Rules</span>\n<span class=\"pill pill-sky\">Skills</span>\n<span class=\"pill pill-amber\">Agents</span>\n<span class=\"pill pill-rose\">Hooks</span>\n</p>";
    case "callout":
      return "<div class=\"pill\">Important note</div>";
    case "columns":
      return "<div class=\"columns\">\n<div>\n\n### Left\n\n- First point\n- Second point\n\n</div>\n<div>\n\n### Right\n\n- First point\n- Second point\n\n</div>\n</div>";
    case "divider":
      return "<hr style=\"border: 0; height: 1px; background: rgba(255,255,255,0.65); width: 100%; margin: 24px 0;\" />";
    case "shape-rounded-rect":
      return svgBox(`<rect data-apploop-shape="${svgMarker(kind)}" x="4" y="4" width="212" height="132" rx="18" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" />`);
    case "shape-rounded-square":
      return svgBox(`<rect data-apploop-shape="${svgMarker(kind)}" x="22" y="2" width="136" height="136" rx="18" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" />`, 180, 140);
    case "shape-circle":
      return svgBox(`<circle data-apploop-shape="${svgMarker(kind)}" cx="90" cy="70" r="62" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" />`, 180, 140);
    case "shape-rounded-triangle":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M110 8 Q118 8 123 16 L207 124 Q213 134 200 134 H20 Q7 134 13 124 L97 16 Q102 8 110 8 Z" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" />`);
    case "shape-diamond":
      return svgBox(`<polygon data-apploop-shape="${svgMarker(kind)}" points="110,4 216,70 110,136 4,70" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" />`);
    case "shape-pill":
      return svgBox(`<rect data-apploop-shape="${svgMarker(kind)}" x="5" y="35" width="210" height="70" rx="35" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" />`);
    case "shape-hexagon":
      return svgBox(`<polygon data-apploop-shape="${svgMarker(kind)}" points="58,6 162,6 216,70 162,134 58,134 4,70" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" />`);
    case "shape-star":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M110 7 L135 51 L186 61 L151 99 L157 150 L110 128 L63 150 L69 99 L34 61 L85 51 Z" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" />`, 220, 156);
    case "shape-line":
      return svgBox(`<line data-apploop-shape="${svgMarker(kind)}" x1="8" y1="70" x2="212" y2="70" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />`, 220, 140);
    case "icon-arrow-right":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M16 70 H192 M154 32 L192 70 L154 108" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`, 220, 140);
    case "icon-arrow-left":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M204 70 H28 M66 32 L28 70 L66 108" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`, 220, 140);
    case "icon-arrow-up":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M90 126 V18 M52 56 L90 18 L128 56" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`, 180, 140);
    case "icon-arrow-down":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M90 14 V122 M52 84 L90 122 L128 84" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`, 180, 140);
    case "icon-arrow-bend":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M34 108 V66 Q34 34 66 34 H184 M150 6 L184 34 L150 62" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`, 220, 140);
    case "icon-check":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M32 76 L78 118 L158 24" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />`, 180, 140);
    case "icon-x":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M42 34 L138 106 M138 34 L42 106" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" />`, 180, 140);
    case "icon-plus":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M90 28 V112 M48 70 H132" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" />`, 180, 140);
    case "icon-spark":
      return svgBox(`<path data-apploop-shape="${svgMarker(kind)}" d="M90 10 L107 54 L154 70 L107 86 L90 130 L73 86 L26 70 L73 54 Z" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" />`, 180, 140);
  }
}

type SelectionStyleControlsProps = {
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  onTextColorChange: (color: string) => void;
  textColor: string;
};

function PresentationSelectionStyleControls({ backgroundColor, onBackgroundColorChange, onTextColorChange, textColor }: SelectionStyleControlsProps) {
  const activeEditor = useCellValue(activeEditor$);
  const lastSelectionRef = useRef<RangeSelection | null>(null);

  function rememberSelection(selection: RangeSelection) {
    if (!selection.isCollapsed()) lastSelectionRef.current = selection.clone();
  }

  useEffect(() => {
    if (!activeEditor) return;
    const unregisterUpdateListener = activeEditor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) rememberSelection(selection);
      });
    });
    const unregisterSelectionListener = activeEditor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) rememberSelection(selection);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      unregisterSelectionListener();
      unregisterUpdateListener();
    };
  }, [activeEditor]);

  function captureSelection() {
    activeEditor?.update(() => {
      const domSelection = window.getSelection();
      const selectionFromDom = $createRangeSelectionFromDom(domSelection, activeEditor);
      const selection = selectionFromDom ?? $getSelection();
      if ($isRangeSelection(selection)) rememberSelection(selection);
    });
  }

  function applySelectionStyle(property: "background-color" | "color", color: string) {
    if (property === "color") onTextColorChange(color);
    else onBackgroundColorChange(color);

    activeEditor?.update(() => {
      let selection = $getSelection();
      if (lastSelectionRef.current && !lastSelectionRef.current.isCollapsed()) {
        $setSelection(lastSelectionRef.current.clone());
        selection = $getSelection();
      }
      if (!$isRangeSelection(selection)) return;
      if (selection.isCollapsed()) {
        selection.setStyle(mergeCssDeclaration(selection.style, property, color));
        return;
      }
      for (const node of selection.extract()) {
        if ($isTextNode(node)) {
          node.setStyle(mergeCssDeclaration(node.getStyle(), property, color));
          if (property === "color") {
            const parent = node.getParent();
            if ($isElementNode(parent) && parent.getType() === "listitem") {
              parent.setStyle(mergeCssDeclaration(parent.getStyle(), property, color));
            }
          }
        }
      }
    });
  }

  return (
    <div className="presentation-selection-style-controls flex items-center gap-2 border-l border-white/10 pl-2">
      <label className="flex items-center gap-1.5 cursor-pointer" title="Selected text color">
        <span className="text-[11px] text-zinc-300">Text</span>
        <input type="color" value={textColor} onChange={(e) => applySelectionStyle("color", e.target.value)} onFocus={captureSelection} onPointerDown={captureSelection}
          className="h-6 w-6 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-white/20" />
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer" title="Selected text background color">
        <span className="text-[11px] text-zinc-300">Fill</span>
        <input type="color" value={backgroundColor} onChange={(e) => applySelectionStyle("background-color", e.target.value)} onFocus={captureSelection} onPointerDown={captureSelection}
          className="h-6 w-6 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-white/20" />
      </label>
    </div>
  );
}

/**
 * Parse per-slide backgrounds + text colors from the Marp front-matter `style:` CSS block.
 * Generated slide classes are intentionally high-priority: BG/TXT are global
 * overrides for that slide, including descendant element colors.
 */
function parseSlideStyles(frontMatter: string, slideCount: number): { backgrounds: string[]; textColors: string[]; overrideSlides: number[] } {
  const backgrounds = Array<string>(Math.max(slideCount, 1)).fill(DEFAULT_SLIDE_BG);
  const textColors = Array<string>(Math.max(slideCount, 1)).fill(DEFAULT_SLIDE_TEXT);
  const overrideSlides = new Set<number>();
  for (let i = 1; i <= backgrounds.length; i++) {
    const rulePattern = new RegExp(`section\\.slide-(?:bg|text)-${i}\\s*\\{[^}]*\\}`, "g");
    for (const rule of frontMatter.match(rulePattern) ?? []) {
      overrideSlides.add(i);
      const background = rule.match(/background-color:\s*(#[a-fA-F0-9]{3,8})/i)?.[1];
      const textColor = rule.match(/(?:^|[\s;{])color:\s*(#[a-fA-F0-9]{3,8})/i)?.[1];
      if (background) backgrounds[i - 1] = background;
      if (textColor) textColors[i - 1] = textColor;
    }
  }
  return { backgrounds, textColors, overrideSlides: [...overrideSlides] };
}

/**
 * Write per-slide background + text color rules into the front-matter `style:` block so
 * Marp actually renders them. Strips previous generated slide color rules first.
 */
function injectSlideStylesIntoFrontMatter(frontMatter: string, backgrounds: string[], textColors: string[], overrideSlides: number[]): string {
  const lines = frontMatter.split("\n");
  const out: string[] = [];
  let inStyleBlock = false;
  let styleKeySeen = false;
  const enabledSlides = new Set(overrideSlides);

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
        if (/section\.slide-(?:bg|text)-\d+/.test(line)) continue;
        out.push(line);
        continue;
      }
    }
    out.push(line);
  }

  const cssRules = backgrounds
    .map((bg, i) => {
      const slide = i + 1;
      if (!enabledSlides.has(slide)) return "";
      const tc = textColors[i] ?? DEFAULT_SLIDE_TEXT;
      return [
        `  section.slide-bg-${slide} { background: ${bg} !important; background-color: ${bg} !important; }`,
        `  section.slide-bg-${slide} :where(*, *::before, *::after) { background-color: ${bg} !important; }`,
        `  section.slide-text-${slide} { color: ${tc} !important; border-color: ${tc} !important; text-decoration-color: ${tc} !important; }`,
        `  section.slide-text-${slide} :where(*) { color: ${tc} !important; border-color: ${tc} !important; text-decoration-color: ${tc} !important; }`,
        `  section.slide-text-${slide} :where(*) { -webkit-text-fill-color: ${tc} !important; background-image: none !important; text-shadow: none !important; }`,
        `  section.slide-text-${slide} :where(li)::marker { color: ${tc} !important; }`,
        `  section.slide-text-${slide} :where(svg, svg *) { fill: ${tc} !important; stroke: ${tc} !important; }`,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n");

  if (!cssRules) return out.join("\n");

  const closingIdx = out.lastIndexOf("---");
  if (closingIdx === -1) return out.join("\n");

  if (styleKeySeen) {
    out.splice(closingIdx, 0, cssRules);
  } else {
    out.splice(closingIdx, 0, "style: |", cssRules);
  }
  return out.join("\n");
}

/** Apply per-slide `<!-- _class: slide-bg-N slide-text-N -->` directives into the markdown. */
function injectSlideClassDirectives(markdown: string, overrideSlides: number[]): string {
  const parts = splitMarpDocument(markdown);
  const enabledSlides = new Set(overrideSlides);
  const updated = parts.slides.map((slide, i) => {
    const bgClass = `slide-bg-${i + 1}`;
    const txtClass = `slide-text-${i + 1}`;
    const shouldApply = enabledSlides.has(i + 1);
    const directivePattern = /^<!--\s*_class:\s*([^\n]*?)\s*-->\n?/m;
    const existing = slide.match(directivePattern);
    const classNames = (existing?.[1] ?? "")
      .split(/\s+/)
      .map((className) => className.trim())
      .filter((className) => className && !/^slide-(?:bg|text)-\d+$/.test(className));
    if (shouldApply) classNames.push(bgClass, txtClass);
    const nextDirective = classNames.length ? `<!-- _class: ${classNames.join(" ")} -->\n` : "";
    if (existing) {
      return slide.replace(directivePattern, nextDirective);
    }
    return shouldApply ? `${nextDirective}${slide}` : slide;
  });
  return `${parts.frontMatter}\n\n${updated.join("\n\n---\n\n")}\n`;
}

function slideHasRawHtml(markdown: string) {
  return /<\/?(?:div|span|section|article|aside|header|footer|main|table|thead|tbody|tr|td|th)\b/i.test(markdown);
}

function deckUsesMarpCanvas(markdown: string) {
  const parts = splitMarpDocument(markdown);
  return (
    /^theme:\s*(?!default\s*$).+/im.test(parts.frontMatter) ||
    /^class:\s*.+/im.test(parts.frontMatter) ||
    /(^|\n)\s*\.(?:columns|pill)\b/.test(parts.frontMatter) ||
    parts.slides.some(slideHasRawHtml)
  );
}

function composeChatPrompt(raw: string, activeSlide: number, totalSlides: number, slideTitle: string) {
  return [raw, "", `Active slide: ${activeSlide} of ${totalSlides}${slideTitle ? ` ("${slideTitle}")` : ""}`, "Edit only this slide in deck.md unless I ask otherwise. Keep Marp front matter and --- separators."].join("\n");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationBuilderShell({ presentationId, presentationName, sourceFile, initialActiveSlide = 1, initialImageAssets = [], initialSlideCount, initialSlides = [], initialMarkdown = "", initialMessages }: BuilderProps) {
  const initialSlideStyles = useMemo(() => {
    if (!initialMarkdown) return { backgrounds: [DEFAULT_SLIDE_BG], textColors: [DEFAULT_SLIDE_TEXT], overrideSlides: [] };
    const parts = splitMarpDocument(initialMarkdown);
    return parseSlideStyles(parts.frontMatter, Math.max(1, initialSlideCount));
  }, [initialMarkdown, initialSlideCount]);
  const [previewKey, setPreviewKey] = useState(0);
  const [activeSlide, setActiveSlide] = useState(() => readSlideQuery(initialSlideCount) ?? clampSlideNumber(initialActiveSlide, initialSlideCount));
  const [totalSlides, setTotalSlides] = useState(Math.max(1, initialSlideCount));
  const [slides, setSlides] = useState<SlideSummary[]>(initialSlides);
  const [fullMarkdown, setFullMarkdown] = useState(initialMarkdown);
  const [slideBackgrounds, setSlideBackgrounds] = useState<string[]>(initialSlideStyles.backgrounds);
  const [slideTextColors, setSlideTextColors] = useState<string[]>(initialSlideStyles.textColors);
  const [slideStyleOverrideSlides, setSlideStyleOverrideSlides] = useState<number[]>(initialSlideStyles.overrideSlides);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(356);
  const [draft, setDraft] = useState("");
  const [selectionTextColor, setSelectionTextColor] = useState(DEFAULT_SLIDE_TEXT);
  const [selectionBackgroundColor, setSelectionBackgroundColor] = useState(DEFAULT_SELECTION_BG);
  const [elementEditEnabled, setElementEditEnabled] = useState(true);
  const [elementEditModeSaving, setElementEditModeSaving] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<PresentationSelectionTarget[]>([]);
  const [layerTargets, setLayerTargets] = useState<PresentationLayerItem[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [activeToolbarGroup, setActiveToolbarGroup] = useState<"images" | "alignment" | "lists" | "shapes" | "icons" | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [slideHistory, setSlideHistory] = useState<SlideHistory>({});
  const [gradientFrom, setGradientFrom] = useState("#34d399");
  const [gradientTo, setGradientTo] = useState("#38bdf8");
  const [gradientAngle, setGradientAngle] = useState(135);
  const [draggedSlide, setDraggedSlide] = useState<number | null>(null);
  const [dropSlide, setDropSlide] = useState<number | null>(null);
  const [iframeDragActive, setIframeDragActive] = useState(false);
  const [thumbKey, setThumbKey] = useState(0);
  const [imageAssets, setImageAssets] = useState<PresentationImageAsset[]>(initialImageAssets);
  const editorMarkdownRef = useRef("");
  const slideStyleRef = useRef<SlideStyleSnapshot>(slideStyleSnapshot(initialSlideStyles.backgrounds, initialSlideStyles.textColors, initialSlideStyles.overrideSlides));

  const prevStatus = useRef<string>("ready");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const previewOverlayRef = useRef<HTMLElement | null>(null);
  const currentSlideFrameRef = useRef<HTMLIFrameElement | null>(null);
  const fullMarkdownRef = useRef("");
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarGroupRef = useRef<HTMLDivElement | null>(null);
  const selectAllPendingRef = useRef(false);
  const inspectFlushResolversRef = useRef<Map<string, () => void>>(new Map());
  const styleSaveTimerRef = useRef<number | null>(null);
  const pendingStyleSaveRef = useRef<{ target: PresentationSelectionTarget; message: string } | null>(null);
  const slideStylesDirtyRef = useRef(false);

  useEffect(() => { fullMarkdownRef.current = fullMarkdown; }, [fullMarkdown]);
  const chat = useChat({ id: presentationId, messages: initialMessages, transport: chatTransport });

  useEffect(() => {
    if (!activeToolbarGroup) return;

    function closeToolbarGroupOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && toolbarGroupRef.current?.contains(target)) return;
      setActiveToolbarGroup(null);
    }

    function closeToolbarGroupOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveToolbarGroup(null);
    }

    document.addEventListener("pointerdown", closeToolbarGroupOnOutsidePointer, true);
    document.addEventListener("keydown", closeToolbarGroupOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeToolbarGroupOnOutsidePointer, true);
      document.removeEventListener("keydown", closeToolbarGroupOnEscape, true);
    };
  }, [activeToolbarGroup]);

  const loadImageAssets = useCallback(async () => {
    try {
      setImageAssets(await listPresentationImagesAction(presentationId));
    } catch { /* noop */ }
  }, [presentationId]);

  const syncSlideQuery = useCallback((slide: number) => {
    replaceSlideQuery(slide);
  }, []);

  const preserveSlideQueryAfterMutation = useCallback((slide: number) => {
    syncSlideQuery(slide);
    window.setTimeout(() => syncSlideQuery(slide), 0);
    window.setTimeout(() => syncSlideQuery(slide), 150);
  }, [syncSlideQuery]);

  const loadSlides = useCallback(async () => {
    try {
      const res = await fetch(`/api/presentations/${presentationId}/slides?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { totalSlides?: number; slides?: SlideSummary[]; markdown?: string };
      if (Array.isArray(payload.slides) && payload.slides.length > 0) {
        setSlides(payload.slides);
        setTotalSlides(payload.slides.length);
        setActiveSlide((c) => Math.min(Math.max(c, 1), payload.slides!.length));
      }
      if (typeof payload.markdown === "string") {
        setFullMarkdown(payload.markdown);
        const parts = splitMarpDocument(payload.markdown);
        const { backgrounds, textColors, overrideSlides } = parseSlideStyles(parts.frontMatter, countMarpSlides(payload.markdown));
        if (slideStylesDirtyRef.current) return;
        slideStyleRef.current = slideStyleSnapshot(backgrounds, textColors, overrideSlides);
        setSlideBackgrounds(backgrounds);
        setSlideTextColors(textColors);
        setSlideStyleOverrideSlides(overrideSlides);
      }
    } catch { /* noop */ }
  }, [presentationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
    void loadSlides();
  }, [loadSlides, previewKey]);

  const editorMarkdown = (() => {
    if (!fullMarkdown) return "";
    try { return getMarpSlideBody(fullMarkdown, activeSlide); } catch { return ""; }
  })();

  useEffect(() => { editorMarkdownRef.current = editorMarkdown; }, [editorMarkdown]);

  const slideContent = useMemo(() => {
    if (!fullMarkdown) return { title: "" };
    try {
      const { slides: all } = splitMarpDocument(fullMarkdown);
      const idx = Math.min(Math.max(activeSlide, 1), all.length) - 1;
      const content = all[idx] ?? "";
      const heading = content.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? `Slide ${activeSlide}`;
      return { title: heading.replace(/[#*_`]/g, "").trim().slice(0, 80) };
    } catch { return { title: "" }; }
  }, [fullMarkdown, activeSlide]);

  const useMarpCanvas = useMemo(() => (fullMarkdown ? deckUsesMarpCanvas(fullMarkdown) : false), [fullMarkdown]);
  const activeTarget = useMemo(() => selectedTargets.find((target) => target.id === activeTargetId) ?? selectedTargets.at(-1) ?? null, [activeTargetId, selectedTargets]);
  const activeLayerIndex = activeTarget ? layerTargets.findIndex((target) => target.id === activeTarget.id) : -1;
  const activeLayerCanMoveBack = activeLayerIndex > 0;
  const activeLayerCanMoveForward = activeLayerIndex >= 0 && activeLayerIndex < layerTargets.length - 1;
  const layerPanelTargets = useMemo(() => [...layerTargets].reverse(), [layerTargets]);
  const activeHistory = slideHistory[activeSlide] ?? { undo: [], redo: [] };
  const activeTargetFontSize = Math.round(parsePxValue(activeTarget?.style.fontSize, 64));
  const activeTargetLineHeight = Number.parseFloat(activeTarget?.style.lineHeight ?? "") || 1.2;
  const activeTargetLetterSpacing = parsePxValue(activeTarget?.style.letterSpacing, 0);
  const activeTargetColor = safeHexColor(activeTarget?.style.color, "#ffffff");
  const activeTargetKind = activeTarget?.tag.toLowerCase() ?? "";
  const activeTargetIsImage = activeTargetKind === "img";
  const activeTargetIsTable = activeTargetKind === "table";
  const activeTargetIsList = activeTargetKind === "ul" || activeTargetKind === "ol";
  const activeTargetIsDivider = activeTargetKind === "hr";
  const activeTargetIsShape = SVG_ELEMENT_TAGS.includes(activeTargetKind);
  const activeTargetIsPill = activeTargetKind === "pill";
  const activeTargetUsesTextToolbar = activeTarget ? !activeTargetIsImage && !activeTargetIsTable && !activeTargetIsList && !activeTargetIsDivider && !activeTargetIsShape : false;
  const canConvertActiveTargetToList = Boolean(activeTarget && !activeTargetIsImage && !activeTargetIsTable && !activeTargetIsDivider && !activeTargetIsShape);
  const activeTargetPadding = Math.round(parsePxValue(activeTarget?.style.padding, 0));
  const activeTargetMargin = Math.round(parsePxValue(activeTarget?.style.margin, 0));
  const activeTargetBorderWidth = Math.round(parsePxValue(activeTarget?.style.border, 1));
  const activeTargetBorderColor = safeHexColor(activeTarget?.style.border?.match(/#[0-9a-fA-F]{6}/)?.[0], "#94a3b8");
  const activeTargetBorderRadius = Math.round(parsePxValue(activeTarget?.style.borderRadius, 0));
  const activeTargetFillColor = safeHexColor(activeTarget?.style.background?.match(/#[0-9a-fA-F]{6}/)?.[0], "#111827");
  const activeTargetShapeFillColor = safeHexColor(activeTarget?.style.fill, "#ffffff");
  const activeTargetShapeStrokeColor = safeHexColor(activeTarget?.style.stroke, "#ffffff");
  const activeTargetShapeStrokeWidth = Math.round(parsePxValue(activeTarget?.style.strokeWidth, 1));
  const activeTargetShapeFillOpacity = Math.round(Math.min(1, Math.max(0, Number.parseFloat(activeTarget?.style.fillOpacity ?? "1") || 0)) * 100);
  const activeTargetShapeStrokeLinecap = activeTarget?.style.strokeLinecap ?? "round";
  const activeTargetShapeStrokeLinejoin = activeTarget?.style.strokeLinejoin ?? "round";
  const activeTargetShapeWidth = Math.round(parsePxValue(activeTarget?.style.width, 220));
  const activeTargetShapeHeight = Math.round(parsePxValue(activeTarget?.style.height, 140));
  const activeTargetDividerColor = safeHexColor(activeTarget?.style.background?.match(/#[0-9a-fA-F]{6}/)?.[0], "#ffffff");
  const activeTargetDividerThickness = Math.round(parsePxValue(activeTarget?.style.height, 1));
  const activeTargetDividerWidth = Math.round(parsePxValue(activeTarget?.style.width, 100));
  const activeTargetListIndent = Math.round(parsePxValue(activeTarget?.style.paddingLeft, activeTargetKind === "ol" ? 36 : 28));
  const activeTargetImageAlt = activeTarget?.alt ?? "";
  const activeTargetImageWidth = Math.round(parsePxValue(activeTarget?.style.width, 480));
  const activeTargetImageHeight = Math.round(parsePxValue(activeTarget?.style.height, 270));
  const activeTargetOpacityValue = Number.parseFloat(activeTarget?.style.opacity ?? "1");
  const activeTargetOpacity = Math.round((Number.isFinite(activeTargetOpacityValue) ? activeTargetOpacityValue : 1) * 100);
  const gradientPresets = useMemo(() => readPresentationGradientPresets(fullMarkdown), [fullMarkdown]);

  const activeBackground = getSlideValue(slideBackgrounds, activeSlide, DEFAULT_SLIDE_BG);
  const activeTextColor = getSlideValue(slideTextColors, activeSlide, DEFAULT_SLIDE_TEXT);
  const activeSlideHasColorOverride = slideStyleOverrideSlides.includes(activeSlide);
  const activeSlideStyle = {
    "--presentation-slide-bg": activeBackground,
    "--presentation-slide-text": activeTextColor,
    background: activeBackground,
    color: activeTextColor,
  } as CSSProperties;

  useEffect(() => {
    if (prevStatus.current === "streaming" && chat.status === "ready") setPreviewKey((v) => v + 1);
    prevStatus.current = chat.status;
  }, [chat.status]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat.messages]);
  useEffect(() => {
    filmstripRef.current?.querySelector<HTMLElement>(`[data-slide-card="${activeSlide}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSlide]);

  useEffect(() => {
    syncSlideQuery(activeSlide);
  }, [activeSlide, syncSlideQuery]);

  const slideSrc = useMemo(() => `/api/presentations/${presentationId}/preview?slide=${activeSlide}&_t=${previewKey}&hidePagination=1`, [presentationId, previewKey, activeSlide]);
  const activeSlidePreviewSrc = useMemo(() => withSlideColorPreviewParams(slideSrc, activeSlideHasColorOverride, activeBackground, activeTextColor), [activeBackground, activeSlideHasColorOverride, activeTextColor, slideSrc]);
  const currentSlideSrc = useMemo(() => `${activeSlidePreviewSrc}${useMarpCanvas && elementEditEnabled ? "&inspect=1" : ""}`, [activeSlidePreviewSrc, elementEditEnabled, useMarpCanvas]);
  const canGoPreviousSlide = activeSlide > 1;
  const canGoNextSlide = activeSlide < totalSlides;

  const navigatePreviewSlide = useCallback((direction: -1 | 1) => {
    setActiveSlide((current) => Math.min(Math.max(current + direction, 1), totalSlides));
  }, [totalSlides]);

  const fullscreenSlideSrc = useMemo(() => `${activeSlidePreviewSrc}&previewBackground=${encodeURIComponent(activeBackground)}`, [activeBackground, activeSlidePreviewSrc]);

  const recordSlideHistory = useCallback((slide: number, before: string, after: string) => {
    if (!before || !after || before === after) return;
    setSlideHistory((current) => {
      const entry = current[slide] ?? { undo: [], redo: [] };
      return {
        ...current,
        [slide]: {
          undo: [...entry.undo, { kind: "markdown" as const, before, after }].slice(-40),
          redo: [],
        },
      };
    });
  }, []);

  const recordSlideStyleHistory = useCallback((slide: number, before: SlideStyleSnapshot, after: SlideStyleSnapshot) => {
    if (sameSlideStyleSnapshot(before, after)) return;
    setSlideHistory((current) => {
      const entry = current[slide] ?? { undo: [], redo: [] };
      return {
        ...current,
        [slide]: {
          undo: [...entry.undo, { kind: "slide-style" as const, before, after }].slice(-40),
          redo: [],
        },
      };
    });
  }, []);

  const restoreMarkdownSnapshot = useCallback(async (markdown: string, message: string) => {
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", markdown);
    await savePresentationMarkdownAction(form);
    setFullMarkdown(markdown);
    setSelectedTargets([]);
    setActiveTargetId(null);
    setStatus(message);
    setPreviewKey((value) => value + 1);
    void loadSlides();
  }, [loadSlides, presentationId]);

  const restoreSlideStyleSnapshot = useCallback((snapshot: SlideStyleSnapshot, message: string) => {
    slideStylesDirtyRef.current = true;
    slideStyleRef.current = slideStyleSnapshot(snapshot.backgrounds, snapshot.textColors, snapshot.overrideSlides);
    setSlideBackgrounds([...snapshot.backgrounds]);
    setSlideTextColors([...snapshot.textColors]);
    setSlideStyleOverrideSlides([...snapshot.overrideSlides]);
    setStatus(message);
  }, []);

  const undoSlideEdit = useCallback(() => {
    const entry = activeHistory.undo.at(-1);
    if (!entry) return;
    setSlideHistory((current) => {
      const stack = current[activeSlide] ?? { undo: [], redo: [] };
      return {
        ...current,
        [activeSlide]: {
          undo: stack.undo.slice(0, -1),
          redo: [...stack.redo, entry].slice(-40),
        },
      };
    });
    if (entry.kind === "slide-style") {
      restoreSlideStyleSnapshot(entry.before, "Undid slide color override.");
      return;
    }
    void restoreMarkdownSnapshot(entry.before, "Undid slide edit.");
  }, [activeHistory.undo, activeSlide, restoreMarkdownSnapshot, restoreSlideStyleSnapshot]);

  const redoSlideEdit = useCallback(() => {
    const entry = activeHistory.redo.at(-1);
    if (!entry) return;
    setSlideHistory((current) => {
      const stack = current[activeSlide] ?? { undo: [], redo: [] };
      return {
        ...current,
        [activeSlide]: {
          undo: [...stack.undo, entry].slice(-40),
          redo: stack.redo.slice(0, -1),
        },
      };
    });
    if (entry.kind === "slide-style") {
      restoreSlideStyleSnapshot(entry.after, "Redid slide color override · Save to persist");
      return;
    }
    void restoreMarkdownSnapshot(entry.after, "Redid slide edit.");
  }, [activeHistory.redo, activeSlide, restoreMarkdownSnapshot, restoreSlideStyleSnapshot]);

  const applyInspectTargets = useCallback(async (targets: PresentationSelectionTarget[], successMessage = "Element style saved.", options?: { refreshPreview?: boolean }) => {
    if (targets.length === 0) return;
    setStatus("Saving element style...");
    const result = await applyPresentationInspectStylesAction({
      presentationId,
      targets: targets.map((target) => ({
        slide: target.slide,
        tag: target.tag,
        text: target.text,
        path: target.path,
        style: target.style,
      })),
    });
    recordSlideHistory(targets[0]?.slide ?? activeSlide, result.previousMarkdown, result.markdown);
    setFullMarkdown(result.markdown);
    setStatus(successMessage);
    if (options?.refreshPreview !== false) setPreviewKey((value) => value + 1);
    else setThumbKey((value) => value + 1);
    preserveSlideQueryAfterMutation(targets[0]?.slide ?? activeSlide);
    void loadSlides();
  }, [activeSlide, loadSlides, presentationId, preserveSlideQueryAfterMutation, recordSlideHistory]);

  const normalizeLayerOrder = useCallback((orderedTargets: PresentationLayerItem[]) => orderedTargets.map((target, index) => {
    const currentPosition = target.style.position;
    const nextStyle = {
      ...target.style,
      position: currentPosition && currentPosition !== "static" ? currentPosition : "relative",
      zIndex: String(index + 1),
    };
    return { ...target, slide: activeSlide, totalSlides, layerIndex: index, zIndex: index + 1, style: nextStyle };
  }), [activeSlide, totalSlides]);

  const applyLayerTargets = useCallback(async (targets: PresentationLayerItem[], successMessage: string) => {
    if (targets.length === 0) return;
    setLayerTargets((current) => current.map((item) => targets.find((target) => target.id === item.id) ?? item));
    setSelectedTargets((current) => current.map((item) => targets.find((target) => target.id === item.id) ?? item));
    currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-apply-all-styles", targets }, "*");
    await applyInspectTargets(targets, successMessage, { refreshPreview: false });
  }, [applyInspectTargets]);

  const applyLayerOrder = useCallback(async (orderedTargets: PresentationLayerItem[], successMessage: string) => {
    const normalized = normalizeLayerOrder(orderedTargets);
    setLayerTargets(normalized);
    setSelectedTargets((current) => current.map((item) => normalized.find((target) => target.id === item.id) ?? item));
    currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-apply-all-styles", targets: normalized }, "*");
    await applyInspectTargets(normalized, successMessage, { refreshPreview: false });
  }, [applyInspectTargets, normalizeLayerOrder]);

  const moveActiveLayer = useCallback((direction: "front" | "forward" | "backward" | "back") => {
    if (!activeTarget || activeLayerIndex < 0) return;
    const next = [...layerTargets];
    const [target] = next.splice(activeLayerIndex, 1);
    if (!target) return;
    const insertIndex = direction === "front"
      ? next.length
      : direction === "forward"
        ? Math.min(activeLayerIndex + 1, next.length)
        : direction === "backward"
          ? Math.max(activeLayerIndex - 1, 0)
          : 0;
    next.splice(insertIndex, 0, target);
    const message = direction === "front"
      ? "Element brought to front."
      : direction === "forward"
        ? "Element brought forward."
        : direction === "backward"
          ? "Element sent backward."
          : "Element sent to back.";
    void applyLayerOrder(next, message);
  }, [activeLayerIndex, activeTarget, applyLayerOrder, layerTargets]);

  const selectLayerTarget = useCallback((target: PresentationLayerItem) => {
    setSelectedTargets([target]);
    setActiveTargetId(target.id);
    currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-set-selections", targets: [target], activeId: target.id }, "*");
  }, []);

  const patchLayerTarget = useCallback((target: PresentationLayerItem, style: Record<string, string | undefined>, successMessage: string) => {
    const nextTarget = {
      ...target,
      hidden: style.visibility === "hidden" ? true : style.visibility === "visible" ? false : target.hidden,
      locked: style.pointerEvents === "none" ? true : style.pointerEvents === "auto" ? false : target.locked,
      style: { ...target.style, ...style },
    };
    void applyLayerTargets([nextTarget], successMessage);
  }, [applyLayerTargets]);

  const reorderLayerFromPanel = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    const topFirst = [...layerTargets].reverse();
    const fromIndex = topFirst.findIndex((target) => target.id === fromId);
    const toIndex = topFirst.findIndex((target) => target.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [target] = topFirst.splice(fromIndex, 1);
    if (!target) return;
    topFirst.splice(toIndex, 0, target);
    void applyLayerOrder(topFirst.reverse(), "Layer order saved.");
  }, [applyLayerOrder, layerTargets]);

  const resolveInspectFlush = useCallback((requestId: string | null) => {
    if (!requestId) return;
    const resolver = inspectFlushResolversRef.current.get(requestId);
    if (!resolver) return;
    inspectFlushResolversRef.current.delete(requestId);
    resolver();
  }, []);

  const requestInspectStyleFlush = useCallback(() => new Promise<void>((resolve) => {
    const frameWindow = currentSlideFrameRef.current?.contentWindow;
    if (!frameWindow) {
      resolve();
      return;
    }
    const requestId = `inspect-flush-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = window.setTimeout(() => {
      inspectFlushResolversRef.current.delete(requestId);
      resolve();
    }, 900);
    inspectFlushResolversRef.current.set(requestId, () => {
      window.clearTimeout(timer);
      resolve();
    });
    frameWindow.postMessage({ type: "apploop-presentation-flush-styles", requestId }, "*");
  }), []);

  const toggleElementEditMode = useCallback(() => {
    if (!elementEditEnabled) {
      setElementEditEnabled(true);
      return;
    }
    void (async () => {
      setElementEditModeSaving(true);
      setStatus("Saving element position...");
      currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-finish-drag" }, "*");
      setIframeDragActive(false);
      await requestInspectStyleFlush();
      setElementEditEnabled(false);
      setElementEditModeSaving(false);
      setStatus("Element edit mode disabled.");
    })();
  }, [elementEditEnabled, requestInspectStyleFlush]);

  const patchActiveTarget = useCallback(async (style: Record<string, string | undefined>, successMessage: string) => {
    if (!activeTarget) return;
    const nextTarget = { ...activeTarget, style: { ...activeTarget.style, ...style } };
    const patchTarget = { ...nextTarget, style };
    currentSlideFrameRef.current?.contentWindow?.postMessage({
      type: "apploop-presentation-patch-style",
      id: nextTarget.id,
      style,
    }, "*");
    setSelectedTargets((targets) => targets.map((target) => target.id === nextTarget.id ? nextTarget : target));
    // The iframe already shows the change live; debounce the save and skip the
    // preview reload so rapid slider input does not blink the slide.
    const pending = pendingStyleSaveRef.current?.target.id === nextTarget.id ? pendingStyleSaveRef.current.target.style : {};
    pendingStyleSaveRef.current = { target: { ...patchTarget, style: { ...pending, ...style } }, message: successMessage };
    if (styleSaveTimerRef.current) window.clearTimeout(styleSaveTimerRef.current);
    styleSaveTimerRef.current = window.setTimeout(() => {
      styleSaveTimerRef.current = null;
      const pending = pendingStyleSaveRef.current;
      pendingStyleSaveRef.current = null;
      if (pending) void applyInspectTargets([pending.target], pending.message, { refreshPreview: false });
    }, 350);
  }, [activeTarget, applyInspectTargets]);

  const alignActiveTarget = useCallback((textAlign: "left" | "center" | "right") => {
    void patchActiveTarget({ display: "block", width: "100%", textAlign }, `Aligned ${textAlign}.`);
  }, [patchActiveTarget]);

  const patchSelectedTextStyle = useCallback((style: Record<string, string | undefined>, message: string) => {
    void patchActiveTarget(style, message);
  }, [patchActiveTarget]);

  const saveActiveImageAlt = useCallback(async (alt: string) => {
    if (!activeTarget || activeTarget.tag.toLowerCase() !== "img") return;
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before) return;
    const { slides } = splitMarpDocument(before);
    const slideIndex = Math.min(Math.max(activeSlide, 1), slides.length) - 1;
    const currentSlide = slides[slideIndex] ?? "";
    const updated = updateImageAltInSlideMarkdown(currentSlide, activeTarget.text, alt);
    if (!updated.changed || updated.markdown === currentSlide) return;
    const nextMarkdown = replaceMarpSlideBody(before, activeSlide, updated.markdown);
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus("Saving image alt text...");
    await savePresentationMarkdownAction(form);
    recordSlideHistory(activeSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSelectedTargets([]);
    setActiveTargetId(null);
    setPreviewKey((value) => value + 1);
    setStatus("Image alt text saved.");
    void loadSlides();
  }, [activeSlide, activeTarget, fullMarkdown, loadSlides, presentationId, recordSlideHistory]);

  const applyFlatTextColor = useCallback((color: string) => {
    patchSelectedTextStyle({
      color,
      webkitTextFillColor: "",
      backgroundImage: "",
      backgroundClip: "",
      webkitBackgroundClip: "",
    }, "Text color applied.");
  }, [patchSelectedTextStyle]);

  const applyCustomTextGradient = useCallback((from: string, to: string, angle: number) => {
    const style = activeTargetIsPill ? boxGradientStyle(from, to, angle) : textGradientStyle(from, to, angle, activeTarget?.style.display);
    patchSelectedTextStyle(style, "Custom gradient applied.");
  }, [activeTarget?.style.display, activeTargetIsPill, patchSelectedTextStyle]);

  const applyTextStylePreset = useCallback((presetId: string) => {
    const preset = TEXT_STYLE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    void patchActiveTarget(preset.style, `${preset.label} text style applied.`);
  }, [patchActiveTarget]);

  const convertActiveTargetToList = useCallback((kind: "ordered" | "unordered") => {
    if (!activeTarget) return;
    void (async () => {
      setStatus(kind === "unordered" ? "Converting to bulleted list..." : "Converting to numbered list...");
      const result = await convertPresentationElementToListAction({
        presentationId,
        slide: activeSlide,
        text: activeTarget.text,
        kind,
      });
      if (!result.ok) {
        setStatus("Couldn't match this element in the slide source. Use the Markdown editor for this conversion.");
        setPreviewKey((value) => value + 1);
        return;
      }
      recordSlideHistory(activeSlide, result.previousMarkdown, result.markdown);
      setFullMarkdown(result.markdown);
      setSelectedTargets([]);
      setActiveTargetId(null);
      setPreviewKey((value) => value + 1);
      setStatus(kind === "unordered" ? "Converted to bulleted list." : "Converted to numbered list.");
      void loadSlides();
    })();
  }, [activeSlide, activeTarget, loadSlides, presentationId, recordSlideHistory]);

  const insertMarpMarkdownBlock = useCallback(async (block: string, insertingMessage = "Inserting slide block...", insertedMessage = "Slide block inserted.") => {
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before) return;
    const { slides: currentSlides } = splitMarpDocument(before);
    const index = Math.min(Math.max(activeSlide, 1), currentSlides.length) - 1;
    const currentSlide = currentSlides[index] ?? "";
    const nextSlide = `${currentSlide.trimEnd()}\n\n${block}`.trim();
    const nextMarkdown = replaceMarpSlideBody(before, activeSlide, nextSlide);
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus(insertingMessage);
    await savePresentationMarkdownAction(form);
    recordSlideHistory(activeSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSelectedTargets([]);
    setActiveTargetId(null);
    setPreviewKey((value) => value + 1);
    setStatus(insertedMessage);
    void loadSlides();
  }, [activeSlide, fullMarkdown, loadSlides, presentationId, recordSlideHistory]);

  const insertMarpBlock = useCallback(async (kind: MarpInsertKind) => {
    await insertMarpMarkdownBlock(buildMarpInsertBlock(kind));
  }, [insertMarpMarkdownBlock]);

  const insertSlideImage = useCallback(async (asset: Pick<PresentationImageAsset, "alt" | "path">) => {
    await insertMarpMarkdownBlock(`![${asset.alt}](${asset.path})`, "Inserting image...", "Image inserted.");
  }, [insertMarpMarkdownBlock]);

  const uploadSlideImage = useCallback(async (file: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("image", file);
    setStatus("Uploading image...");
    const result = await uploadPresentationImageAction(form);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    await loadImageAssets();
    await insertSlideImage(result);
  }, [insertSlideImage, loadImageAssets, presentationId]);

  const reorderSlide = useCallback(async (fromSlide: number, toSlide: number) => {
    if (fromSlide === toSlide) return;
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before) return;
    const nextMarkdown = reorderMarpSlide(before, fromSlide, toSlide);
    if (nextMarkdown === before) return;
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus(`Moving slide ${fromSlide} to ${toSlide}...`);
    await savePresentationMarkdownAction(form);
    const nextActiveSlide = activeSlide === fromSlide
      ? toSlide
      : fromSlide < activeSlide && activeSlide <= toSlide
        ? activeSlide - 1
        : toSlide <= activeSlide && activeSlide < fromSlide
          ? activeSlide + 1
          : activeSlide;
    recordSlideHistory(nextActiveSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSlides(summarizeSlidesFromMarkdown(nextMarkdown));
    setTotalSlides(countMarpSlides(nextMarkdown));
    setSelectedTargets([]);
    setActiveTargetId(null);
    syncSlideQuery(nextActiveSlide);
    setActiveSlide(nextActiveSlide);
    setPreviewKey((value) => value + 1);
    setStatus("Slide reordered.");
    void loadSlides();
  }, [activeSlide, fullMarkdown, loadSlides, presentationId, recordSlideHistory, syncSlideQuery]);

  const cloneSlide = useCallback(async (slide: number) => {
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before) return;
    const nextMarkdown = cloneMarpSlide(before, slide);
    if (nextMarkdown === before) return;
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus(`Cloning slide ${slide}...`);
    await savePresentationMarkdownAction(form);
    const nextActiveSlide = Math.min(slide + 1, countMarpSlides(nextMarkdown));
    recordSlideHistory(nextActiveSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSlides(summarizeSlidesFromMarkdown(nextMarkdown));
    setTotalSlides(countMarpSlides(nextMarkdown));
    setSelectedTargets([]);
    setActiveTargetId(null);
    syncSlideQuery(nextActiveSlide);
    setActiveSlide(nextActiveSlide);
    setPreviewKey((value) => value + 1);
    setThumbKey((value) => value + 1);
    setStatus("Slide cloned.");
    void loadSlides();
  }, [fullMarkdown, loadSlides, presentationId, recordSlideHistory, syncSlideQuery]);

  const insertBlankSlide = useCallback(async (afterSlide: number) => {
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before) return;
    const nextMarkdown = insertBlankMarpSlide(before, afterSlide);
    if (nextMarkdown === before) return;
    const nextActiveSlide = Math.min(Math.max(afterSlide + 1, 1), countMarpSlides(nextMarkdown));
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus(afterSlide <= 0 ? "Adding blank slide at top..." : `Adding blank slide after slide ${afterSlide}...`);
    await savePresentationMarkdownAction(form);
    recordSlideHistory(nextActiveSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSlides(summarizeSlidesFromMarkdown(nextMarkdown));
    setTotalSlides(countMarpSlides(nextMarkdown));
    setSelectedTargets([]);
    setActiveTargetId(null);
    syncSlideQuery(nextActiveSlide);
    setActiveSlide(nextActiveSlide);
    setPreviewKey((value) => value + 1);
    setThumbKey((value) => value + 1);
    setStatus("Blank slide added.");
    void loadSlides();
  }, [fullMarkdown, loadSlides, presentationId, recordSlideHistory, syncSlideQuery]);

  const deleteSlide = useCallback(async (slide: number) => {
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before || countMarpSlides(before) <= 1) {
      setStatus("Cannot delete the only slide.");
      return;
    }
    const nextMarkdown = deleteMarpSlide(before, slide);
    if (nextMarkdown === before) return;
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus(`Deleting slide ${slide}...`);
    await savePresentationMarkdownAction(form);
    const nextActiveSlide = clampSlideNumber(slide, countMarpSlides(nextMarkdown));
    recordSlideHistory(nextActiveSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSlides(summarizeSlidesFromMarkdown(nextMarkdown));
    setTotalSlides(countMarpSlides(nextMarkdown));
    setSelectedTargets([]);
    setActiveTargetId(null);
    syncSlideQuery(nextActiveSlide);
    setActiveSlide(nextActiveSlide);
    setPreviewKey((value) => value + 1);
    setThumbKey((value) => value + 1);
    setStatus("Slide deleted.");
    void loadSlides();
  }, [fullMarkdown, loadSlides, presentationId, recordSlideHistory, syncSlideQuery]);

  const deleteSelectedTarget = useCallback(async (target: PresentationSelectionTarget) => {
    setStatus("Deleting selected element...");
    const result = await deletePresentationElementAction({ presentationId, slide: target.slide, tag: target.tag, text: target.text, path: target.path });
    recordSlideHistory(target.slide, result.previousMarkdown, result.markdown);
    setFullMarkdown(result.markdown);
    setStatus("Selected element deleted.");
    setSelectedTargets((targets) => targets.filter((item) => item.id !== target.id));
    setActiveTargetId(null);
    setPreviewKey((value) => value + 1);
    void loadSlides();
  }, [loadSlides, presentationId, recordSlideHistory]);

  const requestDeleteSelectedTarget = useCallback(() => {
    const frameWindow = currentSlideFrameRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.postMessage({ type: "apploop-presentation-request-delete-active" }, "*");
      return;
    }
    if (activeTarget) void deleteSelectedTarget(activeTarget);
  }, [activeTarget, deleteSelectedTarget]);

  const selectAllSlideElements = useCallback(() => {
    const frameWindow = currentSlideFrameRef.current?.contentWindow;
    if (!frameWindow) {
      setStatus("Slide preview is not ready yet.");
      return;
    }
    selectAllPendingRef.current = true;
    frameWindow.postMessage({ type: "apploop-presentation-select-all-elements" }, "*");
    currentSlideFrameRef.current?.focus();
    window.setTimeout(() => {
      if (selectAllPendingRef.current) {
        currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-select-all-elements" }, "*");
      }
    }, 120);
    setStatus("Selected all slide elements. Use arrow keys to move them.");
  }, []);

  const forwardIframeDragMove = useCallback((clientX: number, clientY: number) => {
    const frame = currentSlideFrameRef.current;
    const frameWindow = frame?.contentWindow;
    if (!frame || !frameWindow) return;
    const rect = frame.getBoundingClientRect();
    frameWindow.postMessage({
      type: "apploop-presentation-drag-move",
      clientX: clientX - rect.left,
      clientY: clientY - rect.top,
    }, "*");
  }, []);

  const finishIframeDrag = useCallback(() => {
    if (!iframeDragActive) return;
    currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-finish-drag" }, "*");
    setIframeDragActive(false);
  }, [iframeDragActive]);

  useEffect(() => {
    if (!iframeDragActive) return;
    function handleMove(event: MouseEvent | PointerEvent) {
      event.preventDefault();
      forwardIframeDragMove(event.clientX, event.clientY);
    }
    function handleEnd(event: MouseEvent | PointerEvent) {
      event.preventDefault();
      finishIframeDrag();
    }
    window.addEventListener("mousemove", handleMove, true);
    window.addEventListener("pointermove", handleMove, true);
    window.addEventListener("mouseup", handleEnd, true);
    window.addEventListener("pointerup", handleEnd, true);
    document.addEventListener("mousemove", handleMove, true);
    document.addEventListener("pointermove", handleMove, true);
    document.addEventListener("mouseup", handleEnd, true);
    document.addEventListener("pointerup", handleEnd, true);
    return () => {
      window.removeEventListener("mousemove", handleMove, true);
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("mouseup", handleEnd, true);
      window.removeEventListener("pointerup", handleEnd, true);
      document.removeEventListener("mousemove", handleMove, true);
      document.removeEventListener("pointermove", handleMove, true);
      document.removeEventListener("mouseup", handleEnd, true);
      document.removeEventListener("pointerup", handleEnd, true);
    };
  }, [finishIframeDrag, forwardIframeDragMove, iframeDragActive]);

  useEffect(() => {
    if (!showPreview) return;
    previewOverlayRef.current?.focus();
  }, [showPreview, activeSlide]);

  useEffect(() => {
    if (!showPreview) return;
    function handlePreviewKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigatePreviewSlide(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigatePreviewSlide(1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setShowPreview(false);
      }
    }
    window.addEventListener("keydown", handlePreviewKeyDown);
    return () => window.removeEventListener("keydown", handlePreviewKeyDown);
  }, [navigatePreviewSlide, showPreview]);

  useEffect(() => {
    if (!useMarpCanvas || !elementEditEnabled || showPreview) return;
    function handleSelectedElementKeyDown(event: KeyboardEvent) {
      if (!/^Arrow(?:Left|Right|Up|Down)$/.test(event.key)) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const frameWindow = currentSlideFrameRef.current?.contentWindow;
      if (!frameWindow) return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 12 : 4;
      frameWindow.postMessage({
        type: "apploop-presentation-move-selection",
        dxPx: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
        dyPx: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
      }, "*");
    }
    window.addEventListener("keydown", handleSelectedElementKeyDown, true);
    return () => window.removeEventListener("keydown", handleSelectedElementKeyDown, true);
  }, [elementEditEnabled, showPreview, useMarpCanvas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection when the active slide changes
    setSelectedTargets([]);
    setLayerTargets([]);
    setActiveTargetId(null);
    setIframeDragActive(false);
  }, [activeSlide]);

  useEffect(() => {
    if (!useMarpCanvas || !elementEditEnabled || showPreview) return;
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || (event.key !== "z" && event.key !== "Z")) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) redoSlideEdit();
      else undoSlideEdit();
    }
    window.addEventListener("keydown", handleHistoryShortcut, true);
    return () => window.removeEventListener("keydown", handleHistoryShortcut, true);
  }, [elementEditEnabled, redoSlideEdit, showPreview, undoSlideEdit, useMarpCanvas]);

  useEffect(() => {
    function handlePresentationInspectMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; [key: string]: unknown };
      if (!data || typeof data !== "object") return;

      if (data.type === "apploop-presentation-slide-ready") {
        if (selectAllPendingRef.current) {
          currentSlideFrameRef.current?.contentWindow?.postMessage({ type: "apploop-presentation-select-all-elements" }, "*");
          selectAllPendingRef.current = false;
          return;
        }
        if (data.slide !== activeSlide || selectedTargets.length === 0) return;
        currentSlideFrameRef.current?.contentWindow?.postMessage({
          type: "apploop-presentation-set-selections",
          targets: selectedTargets,
          activeId: activeTargetId,
        }, "*");
        return;
      }

      if (data.type === "apploop-presentation-selection-state") {
        const targets = Array.isArray(data.targets) ? data.targets as PresentationSelectionTarget[] : [];
        const layers = Array.isArray(data.layers) ? data.layers as PresentationLayerItem[] : [];
        if (targets.length > 0) selectAllPendingRef.current = false;
        setLayerTargets(layers.filter((target) => target.slide === activeSlide));
        setSelectedTargets(targets.filter((target) => target.slide === activeSlide));
        setActiveTargetId(typeof data.activeId === "string" ? data.activeId : targets.at(-1)?.id ?? null);
        return;
      }

      if (data.type === "apploop-presentation-drag-start") {
        setIframeDragActive(true);
        return;
      }

      if (data.type === "apploop-presentation-request-undo") {
        undoSlideEdit();
        return;
      }

      if (data.type === "apploop-presentation-request-redo") {
        redoSlideEdit();
        return;
      }

      if (data.type === "apploop-presentation-drag-end") {
        setIframeDragActive(false);
        return;
      }

      if (data.type === "apploop-presentation-style-apply") {
        const targets = Array.isArray(data.targets) ? data.targets as PresentationSelectionTarget[] : [];
        const requestId = typeof data.requestId === "string" ? data.requestId : null;
        // Positions are already reflected live in the iframe; save without reloading.
        void (async () => {
          await applyInspectTargets(targets.filter((target) => target.slide === activeSlide), "Element position saved.", { refreshPreview: false });
          resolveInspectFlush(requestId);
        })();
        return;
      }

      if (data.type === "apploop-presentation-delete-element") {
        const text = typeof data.text === "string" ? data.text : "";
        const target = selectedTargets.find((item) => item.text === text) ?? (text ? { id: `${activeSlide}:${text}`, slide: activeSlide, tag: "", text, path: "", style: {} } : null);
        if (!target) return;
        void (async () => {
          await deleteSelectedTarget(target);
        })();
        return;
      }

      if (data.type === "apploop-presentation-text-edit") {
        const oldText = typeof data.oldText === "string" ? data.oldText : "";
        const text = typeof data.text === "string" ? data.text : "";
        void (async () => {
          setStatus("Saving text edit...");
          const result = await replacePresentationElementTextAction({ presentationId, slide: activeSlide, oldText, text });
          if (!result.ok) {
            setStatus("Couldn't match this text in the slide source. Use the Markdown editor for this edit.");
            setPreviewKey((value) => value + 1);
            return;
          }
          recordSlideHistory(activeSlide, result.previousMarkdown, result.markdown);
          setFullMarkdown(result.markdown);
          setStatus("Text updated.");
          setPreviewKey((value) => value + 1);
          void loadSlides();
        })();
      }
    }

    window.addEventListener("message", handlePresentationInspectMessage);
    return () => window.removeEventListener("message", handlePresentationInspectMessage);
  }, [activeSlide, activeTargetId, applyInspectTargets, deleteSelectedTarget, loadSlides, presentationId, recordSlideHistory, redoSlideEdit, resolveInspectFlush, selectedTargets, undoSlideEdit]);
  const isStreaming = chat.status === "streaming" || chat.status === "submitted";

  // ---- Save content ----
  async function handleSave() {
    const edit = editorMarkdownRef.current;
    const body = (edit || editorMarkdown).trimEnd();
    setSaving(true);
    setStatus("Saving…");
    try {
      const current = fullMarkdownRef.current || fullMarkdown;
      const originalSlide = splitMarpDocument(current).slides[Math.min(Math.max(activeSlide, 1), totalSlides) - 1] ?? "";
      const bodyChanged = body.trim() !== getMarpSlideBody(current, activeSlide).trim();
      const slideStyles = slideStyleRef.current;
      if (!bodyChanged && slideStyles.overrideSlides.length === 0) {
        setStatus("No changes to save.");
        setSaving(false);
        return;
      }
      if (bodyChanged && slideHasRawHtml(originalSlide)) {
        setStatus("This slide uses raw Marp HTML. Use chat to edit it so layout markup is preserved.");
        setSaving(false);
        return;
      }
      let nextMarkdown = bodyChanged ? replaceMarpSlideBody(current, activeSlide, body) : current;
      if (slideStyles.overrideSlides.length > 0) {
        nextMarkdown = injectSlideClassDirectives(nextMarkdown, slideStyles.overrideSlides);
        const parts = splitMarpDocument(nextMarkdown);
        const fmWithStyles = injectSlideStylesIntoFrontMatter(parts.frontMatter, slideStyles.backgrounds, slideStyles.textColors, slideStyles.overrideSlides);
        nextMarkdown = `${fmWithStyles}\n\n${parts.slides.join("\n\n---\n\n")}\n`;
      }
      const form = new FormData();
      form.set("presentationId", presentationId);
      form.set("markdown", nextMarkdown);
      await savePresentationMarkdownAction(form);
      setFullMarkdown(nextMarkdown);
      slideStylesDirtyRef.current = false;
      editorMarkdownRef.current = body;
      setStatus("Saved.");
      setPreviewKey((v) => v + 1);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ---- Background / Text colour change ----
  function handleBgChange(color: string) {
    const slide = Math.min(Math.max(activeSlide, 1), totalSlides);
    const before = slideStyleRef.current;
    const updatedBackgrounds = [...before.backgrounds];
    updatedBackgrounds[slide - 1] = color;
    const updatedOverrideSlides = before.overrideSlides.includes(slide) ? [...before.overrideSlides] : [...before.overrideSlides, slide];
    const after = slideStyleSnapshot(updatedBackgrounds, before.textColors, updatedOverrideSlides);
    recordSlideStyleHistory(slide, before, after);
    slideStylesDirtyRef.current = true;
    slideStyleRef.current = after;
    setSlideBackgrounds(updatedBackgrounds);
    setSlideStyleOverrideSlides(updatedOverrideSlides);
    setStatus("Background updated · Save to persist");
  }

  function handleTextColorChange(color: string) {
    const slide = Math.min(Math.max(activeSlide, 1), totalSlides);
    const before = slideStyleRef.current;
    const updatedTextColors = [...before.textColors];
    updatedTextColors[slide - 1] = color;
    const updatedOverrideSlides = before.overrideSlides.includes(slide) ? [...before.overrideSlides] : [...before.overrideSlides, slide];
    const after = slideStyleSnapshot(before.backgrounds, updatedTextColors, updatedOverrideSlides);
    recordSlideStyleHistory(slide, before, after);
    slideStylesDirtyRef.current = true;
    slideStyleRef.current = after;
    setSlideTextColors(updatedTextColors);
    setSlideStyleOverrideSlides(updatedOverrideSlides);
    setStatus("Text color updated · Save to persist");
  }

  function handleChatResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = chatWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, startWidth - (moveEvent.clientX - startX)));
      setChatWidth(nextWidth);
    }

    function handlePointerUp() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  // ---- Chat ----
  async function handleSend() {
    const text = draft.trim();
    if (!text || isStreaming) return;
    setDraft("");
    await chat.sendMessage({ text: composeChatPrompt(text, activeSlide, totalSlides, slideContent.title) });
  }

  function selectSlide(slide: number) {
    editorMarkdownRef.current = "";
    setActiveSlide(slide);
    setSelectedTargets([]);
    setLayerTargets([]);
    setActiveTargetId(null);
    setShowPreview(false);
    setStatus(null);
    syncSlideQuery(slide);
  }

  function handleExportMarkdown() {
    const markdown = fullMarkdownRef.current || fullMarkdown;
    if (!markdown.trim()) {
      setStatus("Nothing to export yet.");
      return;
    }
    const exportMarkdown = upsertPresentationGradientPresets(markdown, gradientPresets);
    const url = URL.createObjectURL(new Blob([exportMarkdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = deckFileName(presentationName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Deck exported as Markdown.");
  }

  async function handleImportMarkdown(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".md") && file.type && !/markdown|text/.test(file.type)) {
      setStatus("Choose a Markdown .md file to import.");
      return;
    }
    const previousMarkdown = fullMarkdownRef.current || fullMarkdown;
    const markdown = await file.text();
    if (!markdown.trim()) {
      setStatus("Imported file is empty.");
      return;
    }
    const importedPresets = readPresentationGradientPresets(markdown);
    const markdownWithPresets = upsertPresentationGradientPresets(markdown, importedPresets);
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", markdownWithPresets);
    setStatus("Importing Markdown and replacing slides...");
    await savePresentationMarkdownAction(form);
    if (previousMarkdown && previousMarkdown !== markdownWithPresets) {
      recordSlideHistory(1, previousMarkdown, markdownWithPresets);
    }
    setFullMarkdown(markdownWithPresets);
    setActiveSlide(1);
    setSelectedTargets([]);
    setLayerTargets([]);
    setActiveTargetId(null);
    setPreviewKey((value) => value + 1);
    setStatus(`Imported ${file.name} and replaced current slides.`);
    void loadSlides();
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      {/* ---- Top bar ---- */}
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild size="sm" variant="outline"><Link href="/presentations"><ChevronLeft className="size-4" />Presentations</Link></Button>
          <div className="min-w-0"><div className="flex items-center gap-2"><Presentation className="size-4 text-primary" /><h1 className="truncate text-base font-semibold">{presentationName}</h1></div><p className="truncate text-xs text-muted-foreground">Marp · {sourceFile} · slide {activeSlide}/{totalSlides}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost"><Link href="/presentations"><House className="size-4" />Presentations</Link></Button>
          <Button size="sm" onClick={() => setShowPreview(true)} variant={showPreview ? "default" : "outline"}><Eye className="size-4 mr-1" />Preview</Button>
          <Button size="sm" onClick={() => setChatOpen((v) => !v)} variant={chatOpen ? "default" : "outline"}><MessageSquare className="size-4 mr-1" />Chat</Button>
          <input ref={importFileInputRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = "";
            void handleImportMarkdown(file);
          }} />
          <Button size="sm" variant="outline" onClick={() => importFileInputRef.current?.click()} title="Import a Markdown deck and replace current slides"><Upload className="size-4 mr-1" />Import</Button>
          <Button size="sm" onClick={handleExportMarkdown} title="Export this deck as a Markdown file"><Download className="size-4 mr-1" />Export</Button>
          <Button onClick={() => setPreviewKey((v) => v + 1)} size="sm" variant="outline"><RefreshCw className="size-4" /></Button>
        </div>
      </header>
      {status && <div className="border-b bg-secondary/20 px-4 py-1 text-center text-[11px] text-muted-foreground">{status}</div>}

      {showPreview && (
        <section
          ref={previewOverlayRef}
          aria-label="Presentation fullscreen preview"
          className="fixed inset-0 z-[80] flex flex-col text-white outline-none"
          style={{ backgroundColor: activeBackground }}
          tabIndex={-1}
        >
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white shadow-2xl backdrop-blur">
            <div className="min-w-0">
              <p className="truncate font-medium">Slide {activeSlide} of {totalSlides}</p>
              <p className="truncate text-xs text-white/60">Use Left / Right arrows to navigate</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => navigatePreviewSlide(-1)} disabled={!canGoPreviousSlide}>
                <ChevronLeft className="size-4" />Prev
              </Button>
              <Button size="sm" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => navigatePreviewSlide(1)} disabled={!canGoNextSlide}>
                Next<ChevronRight className="size-4" />
              </Button>
              <Button size="sm" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setShowPreview(false)}>
                <X className="size-4" />Close
              </Button>
            </div>
          </div>
          <iframe className="pointer-events-none h-full w-full border-0" sandbox="allow-same-origin" src={fullscreenSlideSrc} tabIndex={-1} title="fullscreen preview" />
        </section>
      )}

      {/* ---- Body ---- */}
      <div className="min-h-0 flex-1" style={{ display: "grid", gridTemplateColumns: chatOpen ? `18rem minmax(0, 1fr) 6px ${chatWidth}px` : "18rem minmax(0, 1fr)", minHeight: 0 }}>
        {/* Filmstrip */}
        <section className="flex h-full min-h-0 w-full flex-col border-r bg-black">
          <div className="border-b border-white/10 px-3 py-3 text-xs font-medium text-white/80">Slides · {totalSlides}</div>
          <div ref={filmstripRef} className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-scroll px-3 py-3" style={{ scrollbarGutter: "stable", scrollbarColor: "#a1a1aa #18181b" }}>
            <button type="button" className="flex h-8 w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-white/55 transition hover:border-sky-400 hover:bg-sky-400/10 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400" title="Insert blank slide at top" onClick={() => void insertBlankSlide(0)}>
              <Plus className="size-4" />
            </button>
            {slides.map((s) => {
              const selected = s.index === activeSlide;
              const bg = getSlideValue(slideBackgrounds, s.index, DEFAULT_SLIDE_BG);
              const textColor = getSlideValue(slideTextColors, s.index, DEFAULT_SLIDE_TEXT);
              return (
                <div key={s.index} className="space-y-2">
                  <div className={`presentation-slide-card group block w-full max-w-full rounded-xl border p-2 text-left transition ${selected ? "border-sky-400 bg-white/5 shadow-[0_0_0_1px_rgba(96,165,250,0.45)]" : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-white/5"} ${dropSlide === s.index && draggedSlide !== s.index ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-black" : ""} ${draggedSlide === s.index ? "cursor-grabbing opacity-55" : "cursor-grab"}`}
                    data-slide-card={s.index}
                    draggable
                    onClick={() => selectSlide(s.index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectSlide(s.index);
                      }
                    }}
                    onDragStart={(event) => {
                      setDraggedSlide(s.index);
                      setDropSlide(s.index);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(s.index));
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDropSlide(s.index);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropSlide(s.index);
                    }}
                    onDragEnd={() => {
                      setDraggedSlide(null);
                      setDropSlide(null);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = Number(event.dataTransfer.getData("text/plain")) || draggedSlide;
                      setDraggedSlide(null);
                      setDropSlide(null);
                      if (from) void reorderSlide(from, s.index);
                    }}
                    role="button"
                    tabIndex={0}>
                    <div className="mb-2 flex min-w-0 items-center gap-2">
                      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${selected ? "bg-sky-500 text-black" : "bg-white/10 text-white/80"}`}>{s.index}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/85">{s.title}</span>
                      {selected && (
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          <Button size="icon" variant="ghost" className="size-7 text-white/75 hover:bg-white/10 hover:text-white" onClick={(event) => { event.stopPropagation(); void cloneSlide(s.index); }} title="Clone slide">
                            <Copy className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7 text-rose-200/80 hover:bg-rose-500/15 hover:text-rose-100" disabled={totalSlides <= 1} onClick={(event) => { event.stopPropagation(); void deleteSlide(s.index); }} title="Delete slide">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </span>
                      )}
                    </div>
                    <PresentationSlideThumbnail
                      bg={bg}
                      eager={selected || Math.abs(s.index - activeSlide) <= 1}
                      src={`/api/presentations/${presentationId}/preview?slide=${s.index}&_t=${previewKey}.${thumbKey}&hidePagination=1`}
                      textColor={textColor}
                      title={`thumb ${s.index}`}
                    />
                  </div>
                  <button type="button" className="flex h-8 w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-white/55 transition hover:border-sky-400 hover:bg-sky-400/10 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400" title={`Insert blank slide after slide ${s.index}`} onClick={() => void insertBlankSlide(s.index)}>
                    <Plus className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main panel: editor */}
          <section className="presentation-slide-editor-pane flex h-full min-h-0 min-w-0 flex-col border-r border-l border-white/10">
            {/* Editor header with background picker */}
            <div className="presentation-slide-editor-header flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-50">{slideContent.title || `Slide ${activeSlide}`}</p>
                <p className="truncate text-[11px] text-zinc-400">{useMarpCanvas ? "Click a slide element to edit or align it" : "Editing body only · front matter stays in deck.md"}</p>
              </div>
              <div className="flex items-center gap-2">
                {useMarpCanvas && (
                  <>
                    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title="Undo or redo slide element edits">
                      <Button size="icon" variant="ghost" className="size-7" disabled={activeHistory.undo.length === 0} onClick={undoSlideEdit} title="Undo slide edit">
                        <Undo2 className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" disabled={activeHistory.redo.length === 0} onClick={redoSlideEdit} title="Redo slide edit">
                        <Redo2 className="size-4" />
                      </Button>
                    </div>
                    <Button aria-pressed={elementEditEnabled} size="sm" onClick={toggleElementEditMode} disabled={elementEditModeSaving} variant={elementEditEnabled ? "default" : "outline"}>
                      {elementEditModeSaving ? "Saving..." : "Edit elements"}
                    </Button>
                    <input ref={imageFileInputRef} type="file" accept="image/png,image/gif,image/jpeg,image/svg+xml,.png,.gif,.jpg,.jpeg,.svg" className="hidden" onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      void uploadSlideImage(file);
                    }} />
                    <div ref={toolbarGroupRef} className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title="Option groups">
                      <div className="relative">
                        <Button size="sm" variant={activeToolbarGroup === "images" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setActiveToolbarGroup((group) => group === "images" ? null : "images")} title="Show image options">
                          <ImagePlus className="size-4" />Images
                        </Button>
                        {activeToolbarGroup === "images" && (
                          <div className="absolute left-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-[#101014] p-2 text-xs text-zinc-300 shadow-2xl">
                            <div className="flex items-center gap-1" title="Image options">
                              <Button size="icon" variant="ghost" className="size-7" onClick={() => { setActiveToolbarGroup(null); imageFileInputRef.current?.click(); }} title="Upload an image into this presentation and insert it on this slide">
                                <ImagePlus className="size-4" />
                              </Button>
                              <select className="h-7 max-w-40 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" value="" disabled={imageAssets.length === 0} title="Insert an uploaded image into this slide" onChange={(event) => {
                                const asset = imageAssets.find((item) => item.path === event.target.value);
                                setActiveToolbarGroup(null);
                                if (asset) void insertSlideImage(asset);
                                event.currentTarget.value = "";
                              }}>
                                <option value="" disabled>{imageAssets.length === 0 ? "No images" : "Pick image..."}</option>
                                {imageAssets.map((asset) => <option key={asset.path} value={asset.path}>{asset.name}</option>)}
                              </select>
                              {imageAssets.slice(0, 3).map((asset) => (
                                <button key={asset.path} type="button" className="h-7 w-9 shrink-0 overflow-hidden rounded border border-white/15 bg-zinc-950 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400" title={`Insert ${asset.name}`} onClick={() => { setActiveToolbarGroup(null); void insertSlideImage(asset); }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded thumbnails can be SVG/GIF and should render directly. */}
                                  <img src={presentationAssetSrc(presentationId, asset.path)} alt={asset.alt} className="h-full w-full object-cover" draggable={false} />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Button size="sm" variant={activeToolbarGroup === "alignment" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setActiveToolbarGroup((group) => group === "alignment" ? null : "alignment")} title="Show alignment options">
                          <AlignLeft className="size-4" />Alignment
                        </Button>
                        {activeToolbarGroup === "alignment" && (
                          <div className="absolute left-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-[#101014] p-2 text-xs text-zinc-300 shadow-2xl">
                            <div className="flex items-center gap-1" title={activeTarget ? `Selected: ${activeTarget.tag}` : "Select an element on the slide"}>
                              <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => { setActiveToolbarGroup(null); alignActiveTarget("left"); }} title="Align selected element left">
                                <AlignLeft className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => { setActiveToolbarGroup(null); alignActiveTarget("center"); }} title="Align selected element center">
                                <AlignCenter className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => { setActiveToolbarGroup(null); alignActiveTarget("right"); }} title="Align selected element right">
                                <AlignRight className="size-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Button size="sm" variant={activeToolbarGroup === "lists" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setActiveToolbarGroup((group) => group === "lists" ? null : "lists")} title="Show list options">
                          <ListChecks className="size-4" />Lists
                        </Button>
                        {activeToolbarGroup === "lists" && (
                          <div className="absolute left-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-[#101014] p-2 text-xs text-zinc-300 shadow-2xl">
                            <div className="grid min-w-36 gap-1" title="Convert selected element">
                              <Button size="sm" variant="ghost" className="h-8 justify-start px-2 text-xs" disabled={!canConvertActiveTargetToList} onClick={() => { setActiveToolbarGroup(null); convertActiveTargetToList("ordered"); }} title="Convert selected element to numbered list">
                                <ListOrdered className="size-4" />Numbered list
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 justify-start px-2 text-xs" disabled={!canConvertActiveTargetToList} onClick={() => { setActiveToolbarGroup(null); convertActiveTargetToList("unordered"); }} title="Convert selected element to bulleted list">
                                <ListChecks className="size-4" />Bulleted list
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Button size="sm" variant={activeToolbarGroup === "shapes" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setActiveToolbarGroup((group) => group === "shapes" ? null : "shapes")} title="Insert SVG shapes">
                          <Shapes className="size-4" />Shapes
                        </Button>
                        {activeToolbarGroup === "shapes" && (
                          <div className="absolute left-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-[#101014] p-2 text-xs text-zinc-300 shadow-2xl">
                            <div className="grid min-w-[21rem] grid-cols-2 gap-1" title="Insert SVG shape">
                              {SHAPE_INSERTS.map((item) => (
                                <Button key={item.id} size="sm" variant="ghost" className="h-8 justify-start gap-2 px-2 text-xs whitespace-nowrap" onClick={() => { setActiveToolbarGroup(null); void insertMarpBlock(item.id); }} title={`Insert ${item.label}`}>
                                  <ShapeMenuIcon kind={item.id} />{item.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Button size="sm" variant={activeToolbarGroup === "icons" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setActiveToolbarGroup((group) => group === "icons" ? null : "icons")} title="Insert SVG icons">
                          <ArrowRight className="size-4" />Icons
                        </Button>
                        {activeToolbarGroup === "icons" && (
                          <div className="absolute right-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-[#101014] p-2 text-xs text-zinc-300 shadow-2xl">
                            <div className="grid min-w-64 grid-cols-2 gap-1" title="Insert SVG icon">
                              {ICON_INSERTS.map((item) => (
                                <Button key={item.id} size="sm" variant="ghost" className="h-8 justify-start gap-2 px-2 text-xs whitespace-nowrap" onClick={() => { setActiveToolbarGroup(null); void insertMarpBlock(item.id); }} title={`Insert ${item.label}`}>
                                  <IconMenuIcon kind={item.id} />{item.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer" title="Slide background color">
                  <span className="text-[11px] text-zinc-400">BG</span>
                  <input type="color" value={activeBackground} onChange={(e) => handleBgChange(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-white/20" />
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer" title="Slide text color">
                  <span className="text-[11px] text-zinc-400">TXT</span>
                  <input type="color" value={activeTextColor} onChange={(e) => void handleTextColorChange(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-white/20" />
                </label>
                <Button size="sm" onClick={() => void handleSave()} disabled={saving}><Save className="size-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
            {useMarpCanvas && elementEditEnabled && (
              <div className="border-b border-white/10 bg-[#101014] px-4 py-3 text-xs text-zinc-300">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Insert Marp content into this slide">
                    <span>Add</span>
                    <select className="h-7 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" defaultValue="" onChange={(event) => {
                      const nextKind = event.target.value as MarpInsertKind;
                      if (nextKind) void insertMarpBlock(nextKind);
                      event.currentTarget.value = "";
                    }}>
                      <option value="" disabled>Block...</option>
                      {MARP_INSERTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <Button size="sm" variant="outline" onClick={selectAllSlideElements} title="Select all slide elements and move them with arrow keys">Select all</Button>
                  {activeTarget ? (
                    <>
                  <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                    <Type className="size-4 text-zinc-400" />
                    <span className="max-w-36 truncate text-zinc-200">{activeTarget.text || activeTarget.tag}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title="Layer order">
                    <Button size="icon" variant="ghost" className="size-7" disabled={!activeLayerCanMoveForward} onClick={() => moveActiveLayer("front")} title="Bring to Front"><ChevronsUp className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" disabled={!activeLayerCanMoveForward} onClick={() => moveActiveLayer("forward")} title="Bring Forward"><ChevronUp className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" disabled={!activeLayerCanMoveBack} onClick={() => moveActiveLayer("backward")} title="Send Backward"><ChevronDown className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" disabled={!activeLayerCanMoveBack} onClick={() => moveActiveLayer("back")} title="Send to Back"><ChevronsDown className="size-4" /></Button>
                  </div>
                  {activeTargetIsImage && (
                    <>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Image alt text">
                        <span>Alt</span>
                        <input key={activeTarget.id} className="h-7 w-40 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" defaultValue={activeTargetImageAlt} onBlur={(event) => void saveActiveImageAlt(event.currentTarget.value)} onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }} />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Image width">
                        <span>Width {activeTargetImageWidth}px</span>
                        <input type="range" min="80" max="1400" step="10" value={activeTargetImageWidth} onChange={(event) => patchSelectedTextStyle({ width: `${event.target.value}px`, maxWidth: "100%" }, "Image width applied.")} className="w-24" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Image height">
                        <span>Height {activeTargetImageHeight}px</span>
                        <input type="range" min="40" max="900" step="10" value={activeTargetImageHeight} onChange={(event) => patchSelectedTextStyle({ height: `${event.target.value}px` }, "Image height applied.")} className="w-24" />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => patchSelectedTextStyle({ height: "auto" }, "Image height set to auto.")}>Auto height</Button>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Image border width">
                        <span>Border {activeTargetBorderWidth}px</span>
                        <input type="range" min="0" max="16" step="1" value={activeTargetBorderWidth} onChange={(event) => patchSelectedTextStyle({ border: `${event.target.value}px solid ${activeTargetBorderColor}` }, "Image border applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Image border color">
                        <span>Border</span>
                        <input type="color" value={activeTargetBorderColor} onInput={(event) => patchSelectedTextStyle({ border: `${activeTargetBorderWidth}px solid ${event.currentTarget.value}` }, "Image border color applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Image opacity">
                        <span>Opacity {activeTargetOpacity}%</span>
                        <input type="range" min="0" max="100" step="5" value={activeTargetOpacity} onChange={(event) => patchSelectedTextStyle({ opacity: String(Number(event.target.value) / 100) }, "Image transparency applied.")} className="w-24" />
                      </label>
                    </>
                  )}
                  {activeTargetIsTable && (
                    <>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Table outer margin">
                        <span>Margin {activeTargetMargin}px</span>
                        <input type="range" min="0" max="80" step="2" value={activeTargetMargin} onChange={(event) => patchSelectedTextStyle({ margin: `${event.target.value}px` }, "Table margin applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Table cell padding">
                        <span>Pad {activeTargetPadding}px</span>
                        <input type="range" min="0" max="48" step="2" value={activeTargetPadding} onChange={(event) => patchSelectedTextStyle({ padding: `${event.target.value}px` }, "Table padding applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Table border width">
                        <span>Border {activeTargetBorderWidth}px</span>
                        <input type="range" min="0" max="8" step="1" value={activeTargetBorderWidth} onChange={(event) => patchSelectedTextStyle({ border: `${event.target.value}px solid ${activeTargetBorderColor}`, borderCollapse: "collapse" }, "Table border applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Table border color">
                        <span>Border</span>
                        <input type="color" value={activeTargetBorderColor} onInput={(event) => patchSelectedTextStyle({ border: `${activeTargetBorderWidth}px solid ${event.currentTarget.value}`, borderCollapse: "collapse" }, "Table border color applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Table corner radius">
                        <span>Radius {activeTargetBorderRadius}px</span>
                        <input type="range" min="0" max="32" step="1" value={activeTargetBorderRadius} onChange={(event) => patchSelectedTextStyle({ borderRadius: `${event.target.value}px` }, "Table radius applied.")} className="w-20" />
                      </label>
                    </>
                  )}
                  {activeTargetIsList && (
                    <>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="List marker style">
                        <span>Markers</span>
                        <select className="h-7 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" value={activeTarget.style.listStyleType ?? ""} onChange={(event) => patchSelectedTextStyle({ listStyleType: event.target.value }, "List marker style applied.")}>
                          <option value="">Default</option>
                          <option value="disc">Disc</option>
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                          <option value="decimal">Decimal</option>
                          <option value="lower-alpha">a, b, c</option>
                          <option value="upper-roman">I, II, III</option>
                          <option value="none">None</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="List indentation">
                        <span>Indent {activeTargetListIndent}px</span>
                        <input type="range" min="0" max="96" step="2" value={activeTargetListIndent} onChange={(event) => patchSelectedTextStyle({ paddingLeft: `${event.target.value}px` }, "List indent applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="List item spacing">
                        <span>Spacing {activeTargetLineHeight.toFixed(1)}</span>
                        <input type="range" min="0.8" max="2" step="0.1" value={activeTargetLineHeight} onChange={(event) => patchSelectedTextStyle({ lineHeight: event.target.value }, "List spacing applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="List outer margin">
                        <span>Margin {activeTargetMargin}px</span>
                        <input type="range" min="0" max="80" step="2" value={activeTargetMargin} onChange={(event) => patchSelectedTextStyle({ margin: `${event.target.value}px` }, "List margin applied.")} className="w-20" />
                      </label>
                    </>
                  )}
                  {activeTargetIsDivider && (
                    <>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Divider color">
                        <span>Color</span>
                        <input type="color" value={activeTargetDividerColor} onInput={(event) => patchSelectedTextStyle({ background: event.currentTarget.value, border: "0" }, "Divider color applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Divider thickness">
                        <span>{activeTargetDividerThickness}px</span>
                        <input type="range" min="1" max="16" step="1" value={activeTargetDividerThickness} onChange={(event) => patchSelectedTextStyle({ height: `${event.target.value}px`, border: "0" }, "Divider thickness applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Divider width">
                        <span>Width {activeTargetDividerWidth}px</span>
                        <input type="range" min="80" max="900" step="10" value={activeTargetDividerWidth} onChange={(event) => patchSelectedTextStyle({ width: `${event.target.value}px`, border: "0" }, "Divider width applied.")} className="w-24" />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => patchSelectedTextStyle({ width: "100%", border: "0" }, "Divider width applied.")}>Full width</Button>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Divider vertical margin">
                        <span>Margin {activeTargetMargin}px</span>
                        <input type="range" min="0" max="96" step="2" value={activeTargetMargin} onChange={(event) => patchSelectedTextStyle({ margin: `${event.target.value}px 0`, border: "0" }, "Divider margin applied.")} className="w-20" />
                      </label>
                    </>
                  )}
                  {activeTargetIsShape && (
                    <>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="SVG element width">
                        <span>Width {activeTargetShapeWidth}px</span>
                        <input type="range" min="20" max="1200" step="10" value={activeTargetShapeWidth} onChange={(event) => patchSelectedTextStyle({ width: `${event.target.value}px`, boxSizing: "border-box", display: "inline-block", backgroundImage: "", backgroundClip: "", webkitBackgroundClip: "", webkitTextFillColor: "", color: "" }, "Shape width applied.")} className="w-24" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="SVG element height">
                        <span>Height {activeTargetShapeHeight}px</span>
                        <input type="range" min="20" max="900" step="10" value={activeTargetShapeHeight} onChange={(event) => patchSelectedTextStyle({ height: `${event.target.value}px`, boxSizing: "border-box", display: "inline-block", backgroundImage: "", backgroundClip: "", webkitBackgroundClip: "", webkitTextFillColor: "", color: "" }, "Shape height applied.")} className="w-24" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape fill color">
                        <span>Fill</span>
                        <input type="color" value={activeTargetShapeFillColor} onInput={(event) => patchSelectedTextStyle({ fill: event.currentTarget.value, backgroundImage: "", backgroundClip: "", webkitBackgroundClip: "", webkitTextFillColor: "", color: "" }, "Shape fill applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape stroke color">
                        <span>Stroke</span>
                        <input type="color" value={activeTargetShapeStrokeColor} onInput={(event) => patchSelectedTextStyle({ stroke: event.currentTarget.value, backgroundImage: "", backgroundClip: "", webkitBackgroundClip: "", webkitTextFillColor: "", color: "" }, "Shape stroke applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape stroke width">
                        <span>Stroke {activeTargetShapeStrokeWidth}px</span>
                        <input type="range" min="0" max="12" step="1" value={activeTargetShapeStrokeWidth} onChange={(event) => patchSelectedTextStyle({ strokeWidth: `${event.target.value}px` }, "Shape stroke width applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape fill opacity">
                        <span>Fill {activeTargetShapeFillOpacity}%</span>
                        <input type="range" min="0" max="100" step="5" value={activeTargetShapeFillOpacity} onChange={(event) => patchSelectedTextStyle({ fillOpacity: String(Number(event.target.value) / 100) }, "Shape fill opacity applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape line cap">
                        <span>Cap</span>
                        <select className="h-7 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" value={activeTargetShapeStrokeLinecap} onChange={(event) => patchSelectedTextStyle({ strokeLinecap: event.target.value }, "Shape line cap applied.")}>
                          <option value="butt">Butt</option>
                          <option value="round">Round</option>
                          <option value="square">Square</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape line join">
                        <span>Join</span>
                        <select className="h-7 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" value={activeTargetShapeStrokeLinejoin} onChange={(event) => patchSelectedTextStyle({ strokeLinejoin: event.target.value }, "Shape line join applied.")}>
                          <option value="miter">Miter</option>
                          <option value="round">Round</option>
                          <option value="bevel">Bevel</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Shape opacity">
                        <span>Opacity {activeTargetOpacity}%</span>
                        <input type="range" min="0" max="100" step="5" value={activeTargetOpacity} onChange={(event) => patchSelectedTextStyle({ opacity: String(Number(event.target.value) / 100) }, "Shape opacity applied.")} className="w-20" />
                      </label>
                    </>
                  )}
                  {activeTargetIsPill && (
                    <>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Pill text color">
                        <span>Text</span>
                        <input type="color" value={activeTargetColor} onInput={(event) => patchSelectedTextStyle({ color: event.currentTarget.value, webkitTextFillColor: "" }, "Pill text color applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Pill background color">
                        <span>Fill</span>
                        <input type="color" value={activeTargetFillColor} onInput={(event) => patchSelectedTextStyle({ background: event.currentTarget.value, backgroundImage: "", backgroundClip: "", webkitBackgroundClip: "", webkitTextFillColor: "" }, "Pill background applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Pill roundness">
                        <span>Round {activeTargetBorderRadius}px</span>
                        <input type="range" min="0" max="999" step="1" value={activeTargetBorderRadius} onChange={(event) => patchSelectedTextStyle({ borderRadius: `${event.target.value}px` }, "Pill roundness applied.")} className="w-24" />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => patchSelectedTextStyle({ borderRadius: "999px" }, "Pill roundness applied.")}>Round</Button>
                      <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Pill border width">
                        <span>Border {activeTargetBorderWidth}px</span>
                        <input type="range" min="0" max="8" step="1" value={activeTargetBorderWidth} onChange={(event) => patchSelectedTextStyle({ border: `${event.target.value}px solid ${activeTargetBorderColor}` }, "Pill border applied.")} className="w-20" />
                      </label>
                      <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Pill border color">
                        <span>Border</span>
                        <input type="color" value={activeTargetBorderColor} onInput={(event) => patchSelectedTextStyle({ border: `${activeTargetBorderWidth}px solid ${event.currentTarget.value}` }, "Pill border color applied.")} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                      </label>
                      <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title="Pill background gradient presets">
                        <Sparkles className="mx-1 size-4 text-zinc-400" />
                        {gradientPresets.map((preset) => (
                          <button key={preset.id} type="button" className="h-6 w-10 rounded border border-white/15" style={{ backgroundImage: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})` }} title={preset.label}
                            onClick={() => {
                              setGradientFrom(preset.from);
                              setGradientTo(preset.to);
                              setGradientAngle(preset.angle);
                              patchSelectedTextStyle(boxGradientStyle(preset.from, preset.to, preset.angle), `${preset.label} pill gradient applied.`);
                            }} />
                        ))}
                      </div>
                    </>
                  )}
                  {activeTargetUsesTextToolbar && (
                    <>
                  <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Apply a text style preset to the selected element">
                    <span>Text type</span>
                    <select className="h-7 rounded border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none" defaultValue="" onChange={(event) => {
                      applyTextStylePreset(event.target.value);
                      event.currentTarget.value = "";
                    }}>
                      <option value="" disabled>Choose...</option>
                      {TEXT_STYLE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                    </select>
                  </label>
                  <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => alignActiveTarget("left")} title="Align selected element left"><AlignLeft className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => alignActiveTarget("center")} title="Align selected element center"><AlignCenter className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => alignActiveTarget("right")} title="Align selected element right"><AlignRight className="size-4" /></Button>
                  </div>
                  <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Text color">
                    <span>Text</span>
                    <input type="color" value={activeTargetColor} onInput={(event) => applyFlatTextColor(event.currentTarget.value)} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                  </label>
                  <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title="Gradient presets">
                    <Sparkles className="mx-1 size-4 text-zinc-400" />
                    {gradientPresets.map((preset) => (
                      <button key={preset.id} type="button" className="h-6 w-10 rounded border border-white/15" style={{ backgroundImage: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})` }} title={preset.label}
                        onClick={() => {
                          setGradientFrom(preset.from);
                          setGradientTo(preset.to);
                          setGradientAngle(preset.angle);
                          patchSelectedTextStyle(activeTargetIsPill ? boxGradientStyle(preset.from, preset.to, preset.angle) : textGradientStyle(preset.from, preset.to, preset.angle, activeTarget.style.display), `${preset.label} gradient applied.`);
                        }} />
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Gradient start color">
                    <span>From</span>
                    <input type="color" value={gradientFrom} onInput={(event) => {
                      const nextFrom = event.currentTarget.value;
                      setGradientFrom(nextFrom);
                      applyCustomTextGradient(nextFrom, gradientTo, gradientAngle);
                    }} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                  </label>
                  <label className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Gradient end color">
                    <span>To</span>
                    <input type="color" value={gradientTo} onInput={(event) => {
                      const nextTo = event.currentTarget.value;
                      setGradientTo(nextTo);
                      applyCustomTextGradient(gradientFrom, nextTo, gradientAngle);
                    }} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Gradient angle">
                    <span>{gradientAngle}deg</span>
                    <input type="range" min="0" max="360" step="15" value={gradientAngle} onInput={(event) => {
                      const nextAngle = Number(event.currentTarget.value);
                      setGradientAngle(nextAngle);
                      applyCustomTextGradient(gradientFrom, gradientTo, nextAngle);
                    }} className="w-20" />
                  </label>
                  <Button size="sm" variant="outline" onClick={() => patchSelectedTextStyle(textGradientStyle(gradientFrom, gradientTo, gradientAngle, activeTarget.style.display), "Custom gradient applied.")}>Apply gradient</Button>
                  <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Font size">
                    <span>{activeTargetFontSize}px</span>
                    <input type="range" min="12" max="120" step="1" value={activeTargetFontSize} onChange={(event) => patchSelectedTextStyle({ fontSize: `${event.target.value}px` }, "Font size applied.")} className="w-24" />
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Line height">
                    <span>LH {activeTargetLineHeight.toFixed(1)}</span>
                    <input type="range" min="0.8" max="2" step="0.1" value={activeTargetLineHeight} onChange={(event) => patchSelectedTextStyle({ lineHeight: event.target.value }, "Line height applied.")} className="w-20" />
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5" title="Letter spacing">
                    <span>{activeTargetLetterSpacing}px</span>
                    <input type="range" min="0" max="12" step="0.5" value={activeTargetLetterSpacing} onChange={(event) => patchSelectedTextStyle({ letterSpacing: `${event.target.value}px` }, "Letter spacing applied.")} className="w-20" />
                  </label>
                  <Button size="sm" variant={activeTarget.style.fontWeight === "800" ? "default" : "outline"} onClick={() => patchSelectedTextStyle({ fontWeight: activeTarget.style.fontWeight === "800" ? "400" : "800" }, "Font weight applied.")}>Bold</Button>
                    </>
                  )}
                  <Button size="sm" variant="destructive" onClick={requestDeleteSelectedTarget} title="Delete only the selected element">
                    <Trash2 className="size-4" />Delete selected
                  </Button>
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed border-white/10 px-3 py-1.5 text-zinc-500">Click an element on the slide to style text.</div>
                  )}
                </div>
              </div>
            )}
            {/* MDX Editor */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#111113]">
              {editorMarkdown || fullMarkdown ? (
                useMarpCanvas ? (
                  <div className="flex h-full min-h-full items-start justify-center gap-4 p-6">
                    <div className="relative aspect-video w-full min-w-0 max-w-5xl overflow-hidden rounded-md border border-white/10 bg-black" style={{ backgroundColor: activeBackground }}>
                      <iframe ref={currentSlideFrameRef} className="absolute inset-0 h-full w-full border-0" sandbox={elementEditEnabled ? "allow-same-origin allow-scripts" : "allow-same-origin"} src={currentSlideSrc} tabIndex={-1} title={`current slide ${activeSlide}`} />
                      {iframeDragActive && (
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 z-10 cursor-grabbing"
                          onMouseMove={(event) => forwardIframeDragMove(event.clientX, event.clientY)}
                          onMouseUp={finishIframeDrag}
                          onPointerMove={(event) => forwardIframeDragMove(event.clientX, event.clientY)}
                          onPointerUp={finishIframeDrag}
                        />
                      )}
                    </div>
                    {elementEditEnabled && (
                      <aside className="flex max-h-full w-72 shrink-0 flex-col overflow-hidden rounded-md border border-white/10 bg-[#101014] text-xs text-zinc-300 shadow-2xl" aria-label="Layers panel">
                        <div className="border-b border-white/10 px-3 py-2">
                          <p className="font-medium text-zinc-100">Layers</p>
                          <p className="text-[11px] text-zinc-500">Top layer first</p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                          {layerPanelTargets.length === 0 ? (
                            <div className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-zinc-500">No elements on this slide.</div>
                          ) : (
                            <div className="space-y-1">
                              {layerPanelTargets.map((layer) => {
                                const selected = activeTargetId === layer.id;
                                const layerLabel = layer.label ?? layer.text ?? layer.tag;
                                return (
                                  <div
                                    key={layer.id}
                                    className={`group flex items-center gap-2 rounded-md border px-2 py-1.5 transition ${selected ? "border-sky-400 bg-sky-400/10 text-zinc-50" : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5"} ${draggedLayerId === layer.id ? "opacity-50" : ""}`}
                                    draggable
                                    onClick={() => selectLayerTarget(layer)}
                                    onDragStart={(event) => {
                                      setDraggedLayerId(layer.id);
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData("text/plain", layer.id);
                                    }}
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = "move";
                                    }}
                                    onDragEnd={() => setDraggedLayerId(null)}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const fromId = event.dataTransfer.getData("text/plain") || draggedLayerId;
                                      setDraggedLayerId(null);
                                      if (fromId) reorderLayerFromPanel(fromId, layer.id);
                                    }}
                                  >
                                    <GripVertical className="size-4 shrink-0 cursor-grab text-zinc-500" />
                                    <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => selectLayerTarget(layer)} title={layerLabel}>
                                      <span className="block truncate">{layerLabel}</span>
                                      <span className="block truncate text-[10px] text-zinc-500">z {layer.style.zIndex ?? layer.zIndex ?? 0}{layer.locked ? " · locked" : ""}{layer.hidden ? " · hidden" : ""}</span>
                                    </button>
                                    <Button size="icon" variant="ghost" className="size-7 shrink-0" title={layer.hidden ? "Show layer" : "Hide layer"} onClick={(event) => {
                                      event.stopPropagation();
                                      patchLayerTarget(layer, { visibility: layer.hidden ? "visible" : "hidden" }, layer.hidden ? "Layer shown." : "Layer hidden.");
                                    }}>
                                      {layer.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </Button>
                                    <Button size="icon" variant="ghost" className="size-7 shrink-0" title={layer.locked ? "Unlock layer" : "Lock layer"} onClick={(event) => {
                                      event.stopPropagation();
                                      patchLayerTarget(layer, { pointerEvents: layer.locked ? "auto" : "none" }, layer.locked ? "Layer unlocked." : "Layer locked.");
                                    }}>
                                      {layer.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </aside>
                    )}
                  </div>
                ) : (
                  <div className="presentation-mdx-editor h-full min-h-full">
                    <div className="presentation-mdx-canvas mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-md border border-white/10 px-6 py-4" style={activeSlideStyle}>
                      <MDXEditor
                        key={`editor-${activeSlide}-${previewKey}`}
                        className="presentation-mdx-editor"
                        markdown={editorMarkdown}
                        onChange={(v) => { editorMarkdownRef.current = v; }}
                        contentEditableClassName="max-w-none min-h-[24rem] outline-none"
                        plugins={[
                          toolbarPlugin({ toolbarContents: () => (<><UndoRedo /><BoldItalicUnderlineToggles /><StrikeThroughSupSubToggles /><ListsToggle /><BlockTypeSelect /><PresentationSelectionStyleControls backgroundColor={selectionBackgroundColor} onBackgroundColorChange={(color) => { setSelectionBackgroundColor(color); setStatus("Selection background updated · Save to persist"); }} onTextColorChange={(color) => { setSelectionTextColor(color); setStatus("Selection text updated · Save to persist"); }} textColor={selectionTextColor} /><InsertThematicBreak /><InsertCodeBlock /><InsertTable /></>) }),
                          headingsPlugin(), listsPlugin(), quotePlugin(), thematicBreakPlugin(), markdownShortcutPlugin(),
                          linkPlugin(), linkDialogPlugin(),
                          codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
                          codeMirrorPlugin({ codeBlockLanguages: { "": "Plain Text", js: "JavaScript", ts: "TypeScript", json: "JSON", md: "Markdown", py: "Python", sql: "SQL", bash: "Bash" } }),
                          imagePlugin(),
                          tablePlugin(),
                        ]}
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-400"><LoaderCircle className="size-4 animate-spin" />Loading slide…</div>
              )}
            </div>
          </section>

        {/* Chat sidebar */}
        {chatOpen && (
          <div aria-label="Resize chat" className="cursor-col-resize border-l border-r border-white/10 bg-background hover:bg-primary/20" onPointerDown={handleChatResizePointerDown} role="separator" />
        )}
        {chatOpen && (
          <section className="flex h-full min-h-0 flex-col border-l">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><p className="text-sm font-medium">Chat</p><Button size="sm" variant="ghost" onClick={() => setChatOpen(false)}><PanelLeftClose className="size-4" /></Button></div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {chat.messages.length === 0 && <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Try: &ldquo;Make the title shorter and bolder.&rdquo;</div>}
              {chat.messages.map((m) => {
                const text = getMessageText(m);
                return <article key={m.id} className={`rounded-lg border px-3 py-2 text-sm ${m.role === "user" ? "bg-secondary/40" : "bg-card"}`}><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{m.role === "user" ? "You" : "Hermes"}</p><div className="whitespace-pre-wrap leading-6">{text || "…"}</div></article>;
              })}
              {isStreaming && <div className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Editing…</div>}
              <div ref={messagesEndRef} />
            </div>
            <form className="border-t p-3" onSubmit={(e) => { e.preventDefault(); void handleSend(); }}>
              <textarea className="min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }} placeholder={`Edit slide ${activeSlide}…`} value={draft} />
              <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">Slide {activeSlide} · {slideContent.title}</p><Button disabled={isStreaming || !draft.trim()} type="submit"><SendHorizontal className="size-4" />Send</Button></div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}