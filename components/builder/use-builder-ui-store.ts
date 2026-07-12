"use client";

import { create } from "zustand";
import type { VisualSelection } from "@/lib/visual-selector/types";

type BuilderUiState = {
  inspectorEnabled: boolean;
  settingsOpen: boolean;
  hoveredElement: VisualSelection | null;
  selectedElement: VisualSelection | null;
  clearSelectedElement: () => void;
  setHoveredElement: (selection: VisualSelection | null) => void;
  setSelectedElement: (selection: VisualSelection | null) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleInspector: () => void;
};

export const useBuilderUiStore = create<BuilderUiState>((set) => ({
  inspectorEnabled: false,
  settingsOpen: false,
  hoveredElement: null,
  selectedElement: null,
  clearSelectedElement: () => set({ hoveredElement: null, selectedElement: null }),
  setHoveredElement: (selection) => set({ hoveredElement: selection }),
  setSelectedElement: (selection) => set({ selectedElement: selection }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleInspector: () => set((state) => ({ inspectorEnabled: !state.inspectorEnabled, hoveredElement: null, selectedElement: state.inspectorEnabled ? null : state.selectedElement })),
}));