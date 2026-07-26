import { Marp } from "@marp-team/marp-core";
import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideRoot } from "@/lib/security/paths";
import { buildPresentationInspectAssets } from "@/lib/presentations/inspect-editor-assets";
export {
  type MarpDocumentParts,
  splitMarpDocument,
  stripMarpFrontMatter,
  countMarpSlides,
  composeMarpSlideMarkdown,
  getMarpSlideBody,
  replaceMarpSlideBody,
  getMarpSlideSummaries,
} from "@/lib/presentations/marp-utils";

export type MarpRenderResult = {
  html: string;
  css: string;
  slideCountHint: number;
};

const DEFAULT_THEME_NAME = "apploop-presentation";

export function ensureMarpitThemeMeta(css: string, themeName = DEFAULT_THEME_NAME) {
  const trimmed = css.trim();
  if (!trimmed) return "";
  if (/@theme\s+[\w-]+/.test(trimmed)) return trimmed;
  return `/* @theme ${themeName} */\n${trimmed}\n`;
}

export async function renderMarpDeck(
  markdown: string,
  options: { themeCss?: string; slide?: number | "all" } = {},
): Promise<MarpRenderResult> {
  const marp = new Marp({ html: true, script: false });
  const themeCss = ensureMarpitThemeMeta(options.themeCss ?? "");
  if (themeCss) {
    try { marp.themeSet.add(themeCss); } catch { /* noop */ }
  }
  const { composeMarpSlideMarkdown: compose, countMarpSlides: count } = await import("@/lib/presentations/marp-utils");
  const source = typeof options.slide === "number" ? compose(markdown, options.slide) : markdown;
  const { html, css } = marp.render(source);
  return { html, css, slideCountHint: count(markdown) };
}

export type WrapMarpDocumentOptions = {
  title?: string;
  mode?: "deck" | "slide" | "filmstrip";
  activeSlide?: number;
  totalSlides?: number;
  hidePagination?: boolean;
  previewBackground?: string;
  slideBackground?: string;
  slideTextColor?: string;
  inspect?: boolean;
  slideMarkdown?: string;
};

export function wrapMarpDocument(html: string, css: string, options: WrapMarpDocumentOptions | string = {}) {
  const resolved = typeof options === "string" ? { title: options } : options;
  const title = resolved.title ?? "Presentation";
  const mode = resolved.mode ?? "deck";
  const activeSlide = resolved.activeSlide ?? 1;
  const totalSlides = resolved.totalSlides ?? 1;
  const hidePagination = resolved.hidePagination ?? false;
  const previewBackground = sanitizeCssColor(resolved.previewBackground) ?? "var(--bg, #000)";
  const slideBackground = sanitizeCssColor(resolved.slideBackground);
  const slideTextColor = sanitizeCssColor(resolved.slideTextColor);
  const inspectAssets = resolved.inspect && mode === "slide"
    ? buildPresentationInspectAssets({ activeSlide, totalSlides, slideMarkdown: resolved.slideMarkdown })
    : null;
  const safeTitle = escapeHtml(title);

  const modeCss = `
      html, body { margin: 0; width: 100%; height: 100%; background: ${previewBackground}; }
      body { overflow: hidden; }
      div.marpit { width: 100%; height: 100%; background: ${previewBackground}; }
      div.marpit section img { max-width: 100% !important; height: auto; }
    `;
  const listMarkerCss = `
      div.marpit section li::marker { color: currentColor !important; }
      div.marpit section li input[type="checkbox"] { accent-color: currentColor; }
      div.marpit section [class^="_listItemChecked_"]::before,
      div.marpit section [class*=" _listItemChecked_"]::before,
      div.marpit section [class^="_listItemUnchecked_"]::before,
      div.marpit section [class*=" _listItemUnchecked_"]::before { border-color: currentColor !important; top: 0.8em !important; transform: translateY(-50%); }
      div.marpit section [class^="_listItemChecked_"]::before,
      div.marpit section [class*=" _listItemChecked_"]::before { background-color: currentColor !important; }
      div.marpit section [class^="_listItemChecked_"]::after,
      div.marpit section [class*=" _listItemChecked_"]::after { border-color: currentColor !important; top: calc(0.8em - 0.25rem) !important; transform: rotate(45deg) translateY(-50%) !important; }
    `;
  const paginationCss = hidePagination
    ? `
      div.marpit section::after { content: none !important; display: none !important; }
    `
    : "";
  const slideOverrideCss = mode === "slide"
    ? `
      ${slideBackground ? `div.marpit section { background: ${slideBackground} !important; background-color: ${slideBackground} !important; }
      div.marpit section :where(*, *::before, *::after) { background-color: ${slideBackground} !important; }` : ""}
      ${slideTextColor ? `div.marpit section, div.marpit section :where(*) { color: ${slideTextColor} !important; border-color: ${slideTextColor} !important; text-decoration-color: ${slideTextColor} !important; }
      div.marpit section :where(*) { -webkit-text-fill-color: ${slideTextColor} !important; background-image: none !important; text-shadow: none !important; }
      div.marpit section :where(li)::marker { color: ${slideTextColor} !important; }
      div.marpit section :where(svg, svg *) { fill: ${slideTextColor} !important; stroke: ${slideTextColor} !important; }` : ""}
    `
    : "";
  const modeOverrides =
    mode === "filmstrip"
      ? `
      div.marpit > svg[data-marpit-svg] { display: block !important; width: 100% !important; height: auto !important; max-width: 100% !important; max-height: none !important; min-height: 0 !important; aspect-ratio: 16 / 9 !important; border-radius: 8px; overflow: hidden; cursor: pointer; box-shadow: 0 0 0 1px rgba(255,255,255,0.14); background: #000; flex: 0 0 auto !important; }
      div.marpit > svg[data-marpit-svg][data-active="true"] { box-shadow: 0 0 0 2px #60a5fa, 0 0 0 1px rgba(255,255,255,0.2); }
      @media print { div.marpit > svg[data-marpit-svg] { width: 100% !important; height: auto !important; } }
    `
      : mode === "slide"
        ? `
      div.marpit { display: flex !important; align-items: flex-start !important; justify-content: center !important; }
      div.marpit > svg[data-marpit-svg] { display: block !important; width: min(100vw, calc(100vh * 16 / 9)) !important; height: auto !important; max-width: 100% !important; max-height: 100% !important; aspect-ratio: 16 / 9 !important; background: #000; }
      @media print { div.marpit > svg[data-marpit-svg] { width: min(100vw, calc(100vh * 16 / 9)) !important; height: auto !important; } }
    `
        : `
      div.marpit > svg[data-marpit-svg] { display: block !important; width: 100% !important; height: auto !important; }
    `;

  const filmstripScript =
    mode === "filmstrip"
      ? `
      <script>
        (function () {
          var slides = Array.prototype.slice.call(document.querySelectorAll('div.marpit > svg[data-marpit-svg]'));
          if (!slides.length) { slides = Array.prototype.slice.call(document.querySelectorAll('section')).map(function (s) { return s.closest('svg') || s; }); }
          slides.forEach(function (node, index) {
            var slide = index + 1;
            node.setAttribute('data-slide-index', String(slide));
            node.setAttribute('data-active', slide === ${activeSlide} ? 'true' : 'false');
            node.style.cursor = 'pointer';
            node.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); window.parent.postMessage({ type: 'apploop-presentation-select-slide', slide: slide, totalSlides: ${totalSlides} }, '*'); }, true);
          });
          window.parent.postMessage({ type: 'apploop-presentation-filmstrip-ready', totalSlides: slides.length || ${totalSlides}, activeSlide: ${activeSlide} }, '*');
        })();
      </script>
    `
      : "";
  const script = `${filmstripScript}${inspectAssets?.script ?? ""}`;

  return [
    "<!doctype html>", '<html lang="en">', "  <head>",
    '    <meta charset="utf-8" />', '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${safeTitle}</title>`,
    "    <style>", modeCss, `      ${css}`, listMarkerCss, inspectAssets?.css ?? "", paginationCss, slideOverrideCss, modeOverrides, "    </style>",
    "  </head>", "  <body>", `    ${html}`, script, "  </body>", "</html>",
  ].join("\n");
}

export async function loadOptionalThemeCss(workspacePath: string) {
  try { return await fs.readFile(assertInsideRoot(workspacePath, path.join(workspacePath, "theme.css")), "utf8"); }
  catch { return ""; }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sanitizeCssColor(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : undefined;
}
