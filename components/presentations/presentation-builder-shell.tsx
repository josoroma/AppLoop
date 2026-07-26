"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  House,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  Presentation,
  Redo2,
  RefreshCw,
  Save,
  SendHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
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
  tablePlugin,
  markdownShortcutPlugin,
} from "@mdxeditor/editor";
import { useCellValue } from "@mdxeditor/gurx";
import { $createRangeSelectionFromDom, $getSelection, $isElementNode, $isRangeSelection, $isTextNode, $setSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, type RangeSelection } from "lexical";
import "@mdxeditor/editor/style.css";
import { Button } from "@/components/ui/button";
import type { BuilderChatMessage } from "@/lib/chat/messages";
import { getMessageText } from "@/lib/chat/messages";
import { applyPresentationInspectStylesAction, convertPresentationElementToListAction, deletePresentationElementAction, replacePresentationElementTextAction, savePresentationMarkdownAction } from "@/lib/presentations/actions";
import {
  splitMarpDocument,
  cloneMarpSlide,
  deleteMarpSlide,
  getMarpSlideBody,
  replaceMarpSlideBody,
  countMarpSlides,
  reorderMarpSlide,
} from "@/lib/presentations/marp-utils";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

const chatTransport = new DefaultChatTransport<BuilderChatMessage>({ api: "/api/presentations/chat" });

type SlideSummary = { index: number; title: string; preview: string };
type PresentationSelectionTarget = {
  id: string;
  slide: number;
  totalSlides?: number;
  tag: string;
  text: string;
  path: string;
  style: Record<string, string | undefined>;
};
type SlideStyleSnapshot = { backgrounds: string[]; textColors: string[]; overrideSlides: number[] };
type SlideHistoryEntry =
  | { kind: "markdown"; before: string; after: string }
  | { kind: "slide-style"; before: SlideStyleSnapshot; after: SlideStyleSnapshot };
type SlideHistory = Record<number, { undo: SlideHistoryEntry[]; redo: SlideHistoryEntry[] }>;
type MarpInsertKind = "heading" | "paragraph" | "bullets" | "numbered" | "checklist" | "quote" | "code" | "table" | "callout" | "columns" | "divider";
type BuilderProps = {
  presentationId: string;
  presentationName: string;
  sourceFile: string;
  initialActiveSlide?: number;
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
const GRADIENT_PRESETS = [
  { id: "emerald-sky", label: "Emerald sky", from: "#34d399", to: "#38bdf8", angle: 135 },
  { id: "amber-rose", label: "Amber rose", from: "#f59e0b", to: "#f43f5e", angle: 135 },
  { id: "violet-cyan", label: "Violet cyan", from: "#a78bfa", to: "#22d3ee", angle: 135 },
  { id: "ink-silver", label: "Ink silver", from: "#f8fafc", to: "#94a3b8", angle: 180 },
] as const;
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
  { id: "callout", label: "Callout" },
  { id: "columns", label: "Two columns" },
  { id: "divider", label: "Divider" },
];

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
    case "callout":
      return "<div class=\"pill\">Important note</div>";
    case "columns":
      return "<div class=\"columns\">\n<div>\n\n### Left\n\n- First point\n- Second point\n\n</div>\n<div>\n\n### Right\n\n- First point\n- Second point\n\n</div>\n</div>";
    case "divider":
      return "***";
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

export function PresentationBuilderShell({ presentationId, presentationName, sourceFile, initialActiveSlide = 1, initialSlideCount, initialSlides = [], initialMarkdown = "", initialMessages }: BuilderProps) {
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
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [slideHistory, setSlideHistory] = useState<SlideHistory>({});
  const [gradientFrom, setGradientFrom] = useState("#34d399");
  const [gradientTo, setGradientTo] = useState("#38bdf8");
  const [gradientAngle, setGradientAngle] = useState(135);
  const [draggedSlide, setDraggedSlide] = useState<number | null>(null);
  const [dropSlide, setDropSlide] = useState<number | null>(null);
  const [iframeDragActive, setIframeDragActive] = useState(false);
  const [thumbKey, setThumbKey] = useState(0);
  const editorMarkdownRef = useRef("");
  const slideStyleRef = useRef<SlideStyleSnapshot>(slideStyleSnapshot(initialSlideStyles.backgrounds, initialSlideStyles.textColors, initialSlideStyles.overrideSlides));

  const prevStatus = useRef<string>("ready");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const previewOverlayRef = useRef<HTMLElement | null>(null);
  const currentSlideFrameRef = useRef<HTMLIFrameElement | null>(null);
  const fullMarkdownRef = useRef("");
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const selectAllPendingRef = useRef(false);
  const inspectFlushResolversRef = useRef<Map<string, () => void>>(new Map());
  const styleSaveTimerRef = useRef<number | null>(null);
  const pendingStyleSaveRef = useRef<{ target: PresentationSelectionTarget; message: string } | null>(null);
  const slideStylesDirtyRef = useRef(false);

  useEffect(() => { fullMarkdownRef.current = fullMarkdown; }, [fullMarkdown]);
  const chat = useChat({ id: presentationId, messages: initialMessages, transport: chatTransport });

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
  const activeHistory = slideHistory[activeSlide] ?? { undo: [], redo: [] };
  const activeTargetFontSize = Math.round(parsePxValue(activeTarget?.style.fontSize, 64));
  const activeTargetLineHeight = Number.parseFloat(activeTarget?.style.lineHeight ?? "") || 1.2;
  const activeTargetLetterSpacing = parsePxValue(activeTarget?.style.letterSpacing, 0);
  const activeTargetColor = safeHexColor(activeTarget?.style.color, "#ffffff");
  const activeTargetKind = activeTarget?.tag.toLowerCase() ?? "";
  const activeTargetIsTable = activeTargetKind === "table";
  const activeTargetIsList = activeTargetKind === "ul" || activeTargetKind === "ol";
  const activeTargetIsPill = activeTargetKind === "pill";
  const activeTargetUsesTextToolbar = activeTarget ? !activeTargetIsTable && !activeTargetIsList : false;
  const activeTargetPadding = Math.round(parsePxValue(activeTarget?.style.padding, 0));
  const activeTargetMargin = Math.round(parsePxValue(activeTarget?.style.margin, 0));
  const activeTargetBorderWidth = Math.round(parsePxValue(activeTarget?.style.border, 1));
  const activeTargetBorderColor = safeHexColor(activeTarget?.style.border?.match(/#[0-9a-fA-F]{6}/)?.[0], "#94a3b8");
  const activeTargetBorderRadius = Math.round(parsePxValue(activeTarget?.style.borderRadius, 0));
  const activeTargetFillColor = safeHexColor(activeTarget?.style.background?.match(/#[0-9a-fA-F]{6}/)?.[0], "#111827");
  const activeTargetListIndent = Math.round(parsePxValue(activeTarget?.style.paddingLeft, activeTargetKind === "ol" ? 36 : 28));

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

  const convertActiveTargetToList = useCallback((kind: "ordered" | "checklist") => {
    if (!activeTarget) return;
    void (async () => {
      setStatus(kind === "checklist" ? "Converting to checklist..." : "Converting to ordered list...");
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
      setStatus(kind === "checklist" ? "Converted to checklist." : "Converted to ordered list.");
      void loadSlides();
    })();
  }, [activeSlide, activeTarget, loadSlides, presentationId, recordSlideHistory]);

  const insertMarpBlock = useCallback(async (kind: MarpInsertKind) => {
    const before = fullMarkdownRef.current || fullMarkdown;
    if (!before) return;
    const block = buildMarpInsertBlock(kind);
    const { slides: currentSlides } = splitMarpDocument(before);
    const index = Math.min(Math.max(activeSlide, 1), currentSlides.length) - 1;
    const currentSlide = currentSlides[index] ?? "";
    const nextSlide = `${currentSlide.trimEnd()}\n\n${block}`.trim();
    const nextMarkdown = replaceMarpSlideBody(before, activeSlide, nextSlide);
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", nextMarkdown);
    setStatus("Inserting slide block...");
    await savePresentationMarkdownAction(form);
    recordSlideHistory(activeSlide, before, nextMarkdown);
    setFullMarkdown(nextMarkdown);
    setSelectedTargets([]);
    setActiveTargetId(null);
    setPreviewKey((value) => value + 1);
    setStatus("Slide block inserted.");
    void loadSlides();
  }, [activeSlide, fullMarkdown, loadSlides, presentationId, recordSlideHistory]);

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
    const result = await deletePresentationElementAction({ presentationId, slide: target.slide, text: target.text });
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
        if (targets.length > 0) selectAllPendingRef.current = false;
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
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
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
    const form = new FormData();
    form.set("presentationId", presentationId);
    form.set("markdown", markdown);
    setStatus("Importing Markdown and replacing slides...");
    await savePresentationMarkdownAction(form);
    if (previousMarkdown && previousMarkdown !== markdown) {
      recordSlideHistory(1, previousMarkdown, markdown);
    }
    setFullMarkdown(markdown);
    setActiveSlide(1);
    setSelectedTargets([]);
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
            {slides.map((s) => {
              const selected = s.index === activeSlide;
              const bg = getSlideValue(slideBackgrounds, s.index, DEFAULT_SLIDE_BG);
              const textColor = getSlideValue(slideTextColors, s.index, DEFAULT_SLIDE_TEXT);
              return (
                <div key={s.index} className={`presentation-slide-card group block w-full max-w-full rounded-xl border p-2 text-left transition ${selected ? "border-sky-400 bg-white/5 shadow-[0_0_0_1px_rgba(96,165,250,0.45)]" : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-white/5"} ${dropSlide === s.index && draggedSlide !== s.index ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-black" : ""} ${draggedSlide === s.index ? "cursor-grabbing opacity-55" : "cursor-grab"}`}
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
                    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title={activeTarget ? `Selected: ${activeTarget.tag}` : "Select an element on the slide"}>
                      <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => alignActiveTarget("left")} title="Align selected element left">
                        <AlignLeft className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => alignActiveTarget("center")} title="Align selected element center">
                        <AlignCenter className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => alignActiveTarget("right")} title="Align selected element right">
                        <AlignRight className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1" title="Convert selected element">
                      <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => convertActiveTargetToList("ordered")} title="Convert selected element to ordered list">
                        <ListOrdered className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" disabled={!activeTarget} onClick={() => convertActiveTargetToList("checklist")} title="Convert selected element to checklist">
                        <ListChecks className="size-4" />
                      </Button>
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
                        {GRADIENT_PRESETS.map((preset) => (
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
                    {GRADIENT_PRESETS.map((preset) => (
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
                  <div className="flex h-full min-h-full items-start justify-center p-6">
                    <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-md border border-white/10 bg-black" style={{ backgroundColor: activeBackground }}>
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