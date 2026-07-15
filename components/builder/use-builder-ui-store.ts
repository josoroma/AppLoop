"use client";

import { create } from "zustand";
import type { ScreenshotAttachment, VisualSelection } from "@/lib/visual-selector/types";

type BuilderUiState = {
  inspectorEnabled: boolean;
  settingsOpen: boolean;
  hoveredElement: VisualSelection | null;
  selectedElements: VisualSelection[];
  attachedScreenshots: ScreenshotAttachment[];
  clearSelectedElements: () => void;
  setHoveredElement: (selection: VisualSelection | null) => void;
  toggleSelectedElement: (selection: VisualSelection) => void;
  updateSelectedElementRect: (preferredSelector: string, boundingRect: VisualSelection["boundingRect"]) => void;
  removeSelectedElement: (preferredSelector: string) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleInspector: () => void;
  attachInspectorScreenshot: (screenshot: ScreenshotAttachment) => void;
  attachClipboardImage: (screenshot: ScreenshotAttachment) => void;
  removeScreenshot: (id: string) => void;
  clearScreenshots: () => void;
};

export const useBuilderUiStore = create<BuilderUiState>((set) => ({
  inspectorEnabled: false,
  settingsOpen: false,
  hoveredElement: null,
  selectedElements: [],
  attachedScreenshots: [],
  clearSelectedElements: () => set({ hoveredElement: null, selectedElements: [] }),
  setHoveredElement: (selection) => set({ hoveredElement: selection }),
  toggleSelectedElement: (selection) =>
    set((state) => {
      const key = selection.preferredSelector;
      const exists = state.selectedElements.some((el) => el.preferredSelector === key);

      return {
        selectedElements: exists
          ? state.selectedElements.filter((el) => el.preferredSelector !== key)
          : [...state.selectedElements, selection],
      };
    }),
  updateSelectedElementRect: (preferredSelector, boundingRect) =>
    set((state) => ({
      selectedElements: state.selectedElements.map((el) =>
        el.preferredSelector === preferredSelector ? { ...el, boundingRect } : el,
      ),
    })),
  removeSelectedElement: (preferredSelector) =>
    set((state) => ({
      selectedElements: state.selectedElements.filter((el) => el.preferredSelector !== preferredSelector),
    })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleInspector: () =>
    set((state) => ({
      inspectorEnabled: !state.inspectorEnabled,
      hoveredElement: null,
      selectedElements: state.inspectorEnabled ? [] : state.selectedElements,
    })),
  attachInspectorScreenshot: (screenshot) =>
    set((state) => ({
      attachedScreenshots: [...state.attachedScreenshots, screenshot].slice(0, 5),
    })),
  attachClipboardImage: (screenshot) =>
    set((state) => ({
      attachedScreenshots: [...state.attachedScreenshots, screenshot].slice(0, 5),
    })),
  removeScreenshot: (id) =>
    set((state) => ({
      attachedScreenshots: state.attachedScreenshots.filter((s) => s.id !== id),
    })),
  clearScreenshots: () => set({ attachedScreenshots: [] }),
}));