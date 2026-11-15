import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
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

export function getResolvedMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode, colorFamily: ColorFamily) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const resolved = getResolvedMode(mode);

  // Inyección de clase .light o .dark según requerimiento
  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  // Inyección de clase de familia de colores (.blue, .teal o .ember)
  root.classList.remove("blue", "teal", "ember");
  root.classList.add(colorFamily);

  root.style.colorScheme = resolved;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",
  colorFamily: "blue",

  initTheme: () => {
    if (typeof window === "undefined") return;

    const savedMode = (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) || "light";
    const savedColor = (localStorage.getItem(STORAGE_KEY_COLOR) as ColorFamily) || "blue";

    const validMode: ThemeMode =
      savedMode === "dark" || savedMode === "system" ? savedMode : "light";
    const validColor: ColorFamily =
      savedColor === "teal" || savedColor === "ember" ? savedColor : "blue";

    set({ mode: validMode, colorFamily: validColor });
    applyTheme(validMode, validColor);

    // Escuchar cambios de preferencia del sistema si está en modo "system"
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        if (get().mode === "system") {
          applyTheme("system", get().colorFamily);
        }
      });
    }
  },

  setMode: (mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
    set({ mode });
    applyTheme(mode, get().colorFamily);
  },

  toggleMode: () => {
    const currentResolved = getResolvedMode(get().mode);
    const nextMode: ThemeMode = currentResolved === "light" ? "dark" : "light";
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
