"use client";

import { create } from "zustand";
import type { ScreenshotAttachment, VisualSelection } from "@/lib/visual-selector/types";

type BuilderUiState = {
  inspectorEnabled: boolean;
  settingsOpen: boolean;
  hoveredElement: VisualSelection | null;
  selectedElement: VisualSelection | null;
  attachedScreenshots: ScreenshotAttachment[];
  clearSelectedElement: () => void;
  setHoveredElement: (selection: VisualSelection | null) => void;
  setSelectedElement: (selection: VisualSelection | null) => void;
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
  selectedElement: null,
  attachedScreenshots: [],
  clearSelectedElement: () => set({ hoveredElement: null, selectedElement: null }),
  setHoveredElement: (selection) => set({ hoveredElement: selection }),
  setSelectedElement: (selection) => set({ selectedElement: selection }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleInspector: () => set((state) => ({ inspectorEnabled: !state.inspectorEnabled, hoveredElement: null, selectedElement: state.inspectorEnabled ? null : state.selectedElement })),
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