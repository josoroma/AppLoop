"use client";

import { create } from "zustand";
import type { ScreenshotAttachment, VisualSelection } from "@/lib/visual-selector/types";

export type ChatCheckpoint = {
  id: string;
  name: string;
  createdAt: number;
  targets: VisualSelection[];
  screenshots: ScreenshotAttachment[];
  messageIds: string[];
  commitHash: string | null;
  /** True if this checkpoint represents a session boundary (visible in history). */
  isSessionBoundary: boolean;
};

type BuilderUiState = {
  inspectorEnabled: boolean;
  settingsOpen: boolean;
  hoveredElement: VisualSelection | null;
  selectedElements: VisualSelection[];
  attachedScreenshots: ScreenshotAttachment[];
  checkpoints: ChatCheckpoint[];
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
  saveCheckpoint: (name: string, messageIds: string[], commitHash?: string | null, isSessionBoundary?: boolean) => void;
  loadCheckpoint: (id: string) => ChatCheckpoint | undefined;
  removeCheckpoint: (id: string) => void;
};

let checkpointCounter = 0;

export const useBuilderUiStore = create<BuilderUiState>((set, get) => ({
  inspectorEnabled: false,
  settingsOpen: false,
  hoveredElement: null,
  selectedElements: [],
  attachedScreenshots: [],
  checkpoints: [],
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
  saveCheckpoint: (name, messageIds, commitHash = null, isSessionBoundary = false) =>
    set((state) => {
      checkpointCounter += 1;
      const checkpoint: ChatCheckpoint = {
        id: `cp-${Date.now()}-${checkpointCounter}`,
        name,
        createdAt: Date.now(),
        targets: [...state.selectedElements],
        screenshots: [...state.attachedScreenshots],
        messageIds,
        commitHash,
        isSessionBoundary,
      };

      return { checkpoints: [...state.checkpoints, checkpoint] };
    }),
  loadCheckpoint: (id) => {
    const checkpoint = get().checkpoints.find((cp) => cp.id === id);

    if (checkpoint) {
      set({
        selectedElements: [...checkpoint.targets],
        attachedScreenshots: [...checkpoint.screenshots],
      });
    }

    return checkpoint;
  },
  removeCheckpoint: (id) =>
    set((state) => ({
      checkpoints: state.checkpoints.filter((cp) => cp.id !== id),
    })),
}));