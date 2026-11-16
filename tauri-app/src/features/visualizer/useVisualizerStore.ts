import { create } from "zustand";

interface VisualizerStoreState {
  activeVisualizerId: string;
  setActiveVisualizer: (id: string) => void;
}

const STORAGE_KEY = "ytms_active_visualizer";

export const useVisualizerStore = create<VisualizerStoreState>((set) => ({
  activeVisualizerId:
    (typeof window !== "undefined" && window.localStorage?.getItem(STORAGE_KEY)) ||
    "vinyl",

  setActiveVisualizer: (id: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    set({ activeVisualizerId: id });
  },
}));
