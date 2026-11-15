import { create } from "zustand";

export type ThemeMode = "light" | "dark";
export type ColorFamily = "blue" | "teal" | "ember";

export interface ThemeState {
  mode: ThemeMode;
  colorFamily: ColorFamily;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setColorFamily: (family: ColorFamily) => void;
  initTheme: () => void;
}

const STORAGE_KEY_MODE = "ytms_theme_mode";
const STORAGE_KEY_COLOR = "ytms_theme_color";

export function applyTheme(mode: ThemeMode, colorFamily: ColorFamily) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Inyección de clase .light o .dark según requerimiento
  root.classList.remove("light", "dark");
  root.classList.add(mode);

  // Inyección de clase de familia de colores (.blue, .teal o .ember)
  root.classList.remove("blue", "teal", "ember");
  root.classList.add(colorFamily);

  root.style.colorScheme = mode;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",
  colorFamily: "blue",

  initTheme: () => {
    if (typeof window === "undefined") return;

    const savedMode = (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) || "light";
    const savedColor = (localStorage.getItem(STORAGE_KEY_COLOR) as ColorFamily) || "blue";

    const validMode: ThemeMode = savedMode === "dark" ? "dark" : "light";
    const validColor: ColorFamily =
      savedColor === "teal" || savedColor === "ember" ? savedColor : "blue";

    set({ mode: validMode, colorFamily: validColor });
    applyTheme(validMode, validColor);
  },

  setMode: (mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    set({ mode });
    applyTheme(mode, get().colorFamily);
  },

  toggleMode: () => {
    const nextMode: ThemeMode = get().mode === "light" ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY_MODE, nextMode);
    set({ mode: nextMode });
    applyTheme(nextMode, get().colorFamily);
  },

  setColorFamily: (colorFamily: ColorFamily) => {
    localStorage.setItem(STORAGE_KEY_COLOR, colorFamily);
    set({ colorFamily });
    applyTheme(get().mode, colorFamily);
  },
}));
