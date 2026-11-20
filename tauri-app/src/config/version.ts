import pkg from "../../package.json";

/**
 * Versión de la aplicación sincronizada dinámicamente desde `package.json`
 * mediante Vite (`define.__APP_VERSION__`) con fallback directo a `pkg.version`.
 */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : pkg.version;

export const APP_INFO = {
  name: "Your Tracks Music Server",
  slug: "ytms-player",
  version: APP_VERSION,
  author: "Joel Alejandro Sanchez Valdez",
  email: "joelalejsanchez@gmail.com",
  github: "https://github.com/joelalejsanchez",
  license: "GPL-3.0",
} as const;
