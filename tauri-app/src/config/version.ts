/**
 * Versión de la aplicación sincronizada dinámicamente desde `package.json`
 * mediante Vite (`define.__APP_VERSION__`).
 */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.9.3";

export const APP_INFO = {
  name: "Your Tracks Music Server",
  slug: "ytms-player",
  version: APP_VERSION,
  author: "Joel Alejandro Sánchez Valdez",
  email: "joelalejsanchez@gmail.com",
  license: "GPL-3.0-or-later",
  stack: ["Tauri v2", "React 18", "Vite", "Rust", "SQLite"],
} as const;
