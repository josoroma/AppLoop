"use client";

import { useEffect, useState, type ReactNode } from "react";

type InspectorParentMessage = {
  type?: string;
  enabled?: unknown;
  projectId?: unknown;
  previewNonce?: unknown;
};

type SelectionPayload = {
  projectId: string;
  previewNonce: string;
  route: string;
  tagName: string;
  classNames: string[];
  preferredSelector: string;
  inspectorId?: string;
  componentName?: string;
  textPreview?: string;
  ancestry: Array<{
    tagName: string;
    classNames: string[];
    inspectorId?: string;
  }>;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const SEMANTIC_CLASS_NAMES = new Set([
  "app-shell",
  "page-shell",
  "page-header",
  "page-content",
  "page-footer",
  "dashboard-shell",
  "dashboard-header",
  "dashboard-content",
  "dashboard-footer",
  "sidebar",
  "sidebar-header",
  "sidebar-content",
  "sidebar-footer",
  "left-column",
  "center-column",
  "right-column",
  "top-section",
  "main-section",
  "bottom-section",
  "hero-section",
  "features-section",
  "pricing-section",
  "form-section",
  "table-section",
  "analytics-card",
  "summary-card",
  "primary-actions",
  "secondary-actions",
  "template-default",
  "template-admin-luma",
  "template-ai-engineer-cv",
  "template-deep-research-paper",
  "template-luminous-rings",
  "metric-revenue",
  "metric-active-users",
  "metric-conversion",
  "metric-open-issues",
  "activity-panel",
  "health-panel",
  "admin-nav-link",
  "site-nav-link",
  "project-card",
  "site-theme-toggle",
  "admin-theme-toggle",
  "admin-hero-eyebrow",
  "not-found-eyebrow",
]);

const INSPECTABLE_SELECTOR = "[class]";

export function InspectorProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [enabled, setEnabled] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState<string | null>(null);

  useEffect(() => {
    const parentOrigin = getParentOrigin();

    if (!parentOrigin) {
      return;
    }

    const handleParentMessage = (event: MessageEvent<InspectorParentMessage>) => {
      if (event.origin !== parentOrigin) {
        return;
      }

      if (event.data?.type !== "apploop:inspector:set-enabled") {
        return;
      }

      setEnabled(Boolean(event.data.enabled));
      setProjectId(typeof event.data.projectId === "string" ? event.data.projectId : null);
      setPreviewNonce(typeof event.data.previewNonce === "string" ? event.data.previewNonce : null);
    };

    window.addEventListener("message", handleParentMessage);
    window.parent.postMessage({ type: "apploop:inspector-ready" }, parentOrigin);

    return () => window.removeEventListener("message", handleParentMessage);
  }, []);

  useEffect(() => {
    const parentOrigin = getParentOrigin();

    if (!parentOrigin) {
      return;
    }

    if (!projectId || !previewNonce) {
      return;
    }

    const publishRoute = () => {
      window.parent.postMessage({ type: "apploop:preview-route", projectId, previewNonce, route: `${window.location.pathname}${window.location.search}${window.location.hash}` }, parentOrigin);
    };

    const routePublishTimeouts = new Set<number>();
    const scheduleRoutePublish = () => {
      for (const delay of [0, 100]) {
        const timeoutId = window.setTimeout(() => {
          routePublishTimeouts.delete(timeoutId);
          publishRoute();
        }, delay);
        routePublishTimeouts.add(timeoutId);
      }
    };

    const handleLinkClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;

      if (!link) {
        return;
      }

      const href = link.getAttribute("href");

      if (!href) {
        return;
      }

      const nextUrl = new URL(href, window.location.href);

      if (nextUrl.origin === window.location.origin) {
        scheduleRoutePublish();
      }
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      originalPushState.apply(this, args);
      publishRoute();
    };

    window.history.replaceState = function replaceState(...args) {
      originalReplaceState.apply(this, args);
      publishRoute();
    };

    publishRoute();
    document.addEventListener("click", handleLinkClick, true);
    window.addEventListener("popstate", publishRoute);

    return () => {
      for (const timeoutId of routePublishTimeouts) {
        window.clearTimeout(timeoutId);
      }
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      document.removeEventListener("click", handleLinkClick, true);
      window.removeEventListener("popstate", publishRoute);
    };
  }, [previewNonce, projectId]);

  useEffect(() => {
    const parentOrigin = getParentOrigin();

    if (!enabled || !parentOrigin || !projectId || !previewNonce) {
      return;
    }

    const DISABLE_STYLE_ID = "apploop-inspector-disable-interactive";
    let disableStyle = document.getElementById(DISABLE_STYLE_ID);

    if (!disableStyle) {
      disableStyle = document.createElement("style");
      disableStyle.id = DISABLE_STYLE_ID;
      disableStyle.textContent = "a[href], button{pointer-events:none;}";
      document.head.appendChild(disableStyle);
    }

    const selectedElements = new Map<string, HTMLElement>();
    let hoveredElement: HTMLElement | null = null;
    let animationFrameId: number | null = null;
    let trackingIntervalId: number | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      hoveredElement = getInspectableElement(event.target);
      const selection = createSelectionPayload(hoveredElement, projectId, previewNonce);

      window.parent.postMessage({ type: "apploop:inspector-hover", projectId, previewNonce, selection }, parentOrigin);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const element = getInspectableElement(event.target);
      const selection = createSelectionPayload(element, projectId, previewNonce);

      if (!selection || !element) {
        return;
      }

      if (selectedElements.has(selection.preferredSelector)) {
        selectedElements.delete(selection.preferredSelector);
      } else {
        selectedElements.set(selection.preferredSelector, element);
      }

      window.parent.postMessage({ type: "apploop:inspector-select", projectId, previewNonce, selection }, parentOrigin);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      const actionable = target.closest<HTMLAnchorElement | HTMLButtonElement>("a[href], button");

      if (actionable) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const publishTrackedSelections = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;

        for (const [preferredSelector, element] of selectedElements) {
          if (!document.contains(element)) {
            selectedElements.delete(preferredSelector);
            continue;
          }

          const selection = createSelectionPayload(element, projectId, previewNonce);

          if (selection) {
            window.parent.postMessage({ type: "apploop:inspector-select", projectId, previewNonce, selection, update: true }, parentOrigin);
          }
        }

        if (hoveredElement && document.contains(hoveredElement)) {
          const selection = createSelectionPayload(hoveredElement, projectId, previewNonce);
          window.parent.postMessage({ type: "apploop:inspector-hover", projectId, previewNonce, selection }, parentOrigin);
        }
      });
    };

    trackingIntervalId = window.setInterval(publishTrackedSelections, 100);

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("scroll", publishTrackedSelections, true);
    window.addEventListener("scroll", publishTrackedSelections, true);
    window.addEventListener("resize", publishTrackedSelections);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (trackingIntervalId !== null) {
        window.clearInterval(trackingIntervalId);
      }
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("scroll", publishTrackedSelections, true);
      window.removeEventListener("scroll", publishTrackedSelections, true);
      window.removeEventListener("resize", publishTrackedSelections);
      document.getElementById(DISABLE_STYLE_ID)?.remove();
      window.parent.postMessage({ type: "apploop:inspector-hover", projectId, previewNonce, selection: null }, parentOrigin);
    };
  }, [enabled, previewNonce, projectId]);

  useEffect(() => {
    const parentOrigin = getParentOrigin();

    if (!enabled || !parentOrigin || !projectId || !previewNonce) {
      return;
    }

    let focusedIndex = -1;
    let focusedElement: HTMLElement | null = null;

    const publishKeyboardSelection = (direction: 1 | -1) => {
      const elements = getInspectableElements();

      if (elements.length === 0) {
        return;
      }

      focusedElement?.removeAttribute("data-apploop-keyboard-target");
      focusedIndex = (focusedIndex + direction + elements.length) % elements.length;
      focusedElement = elements[focusedIndex];
      focusedElement.dataset.apploopKeyboardTarget = "true";

      if (!focusedElement.hasAttribute("tabindex")) {
        focusedElement.tabIndex = -1;
      }

      focusedElement.focus({ preventScroll: false });
      const selection = createSelectionPayload(focusedElement, projectId, previewNonce);
      window.parent.postMessage({ type: "apploop:inspector-hover", projectId, previewNonce, selection }, parentOrigin);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== "]" && event.key !== "[")) {
        return;
      }

      event.preventDefault();
      publishKeyboardSelection(event.key === "]" ? 1 : -1);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      focusedElement?.removeAttribute("data-apploop-keyboard-target");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, previewNonce, projectId]);

  return (
    <>
      {children}
      <style>{`[data-apploop-keyboard-target="true"]{outline:3px solid var(--ring,#1f5f4a);outline-offset:3px;box-shadow:0 0 0 6px color-mix(in srgb,var(--ring,#1f5f4a) 20%,transparent);}`}</style>
    </>
  );
}

function getInspectableElements() {
  return Array.from(document.querySelectorAll<HTMLElement>(INSPECTABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null && element.classList.length > 0 && element.dataset.apploopInspector !== "overlay",
  );
}

function getParentOrigin() {
  const ancestorOrigin = window.location.ancestorOrigins?.[0];

  if (ancestorOrigin) {
    return ancestorOrigin;
  }

  return document.referrer ? new URL(document.referrer).origin : null;
}

function createSelectionPayload(target: EventTarget | null, projectId: string, previewNonce: string): SelectionPayload | null {
  const element = getInspectableElement(target);

  if (!element || !(element instanceof HTMLElement) || element.classList.length === 0 || element.dataset.apploopInspector === "overlay") {
    return null;
  }

  const classNames = Array.from(element.classList).filter((className) => className.length > 0 && className.length <= 120).slice(0, 32);
  const semanticClassName = classNames.find((className) => SEMANTIC_CLASS_NAMES.has(className));
  const inspectorId = element.dataset.builderId;
  const rect = element.getBoundingClientRect();
  // Use the last classname (most specific / unique per-instance) as preferred selector.
  // Falls back to semantic classname then first classname.
  const lastClassName = classNames[classNames.length - 1];
  const preferredSelector = lastClassName ? `.${lastClassName}` : semanticClassName ? `.${semanticClassName}` : `.${classNames[0]}`;

  return {
    projectId,
    previewNonce,
    route: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    tagName: element.tagName.toLowerCase(),
    classNames,
    preferredSelector,
    inspectorId,
    componentName: element.dataset.builderComponent,
    textPreview: sanitizeText(element.textContent),
    ancestry: collectAncestry(element),
    boundingRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  };
}

function getInspectableElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>(INSPECTABLE_SELECTOR);
}

function collectAncestry(element: HTMLElement) {
  const ancestry = [];
  let current = element.parentElement;

  while (current && ancestry.length < 6) {
    ancestry.push({
      tagName: current.tagName.toLowerCase(),
      classNames: Array.from(current.classList),
      inspectorId: current.dataset.builderId,
    });
    current = current.parentElement;
  }

  return ancestry;
}

function sanitizeText(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim().slice(0, 240);

  if (!normalized) {
    return undefined;
  }

  if (/api[_-]?key|bearer\s+[a-z0-9._-]+|password|secret|token/i.test(normalized)) {
    return "[redacted]";
  }

  return normalized;
}