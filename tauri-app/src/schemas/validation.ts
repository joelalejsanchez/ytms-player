import { z } from "zod";

const ALLOWED_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
]);

export const youtubeIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_-]{11}$/,
    "El YouTube ID debe tener exactamente 11 caracteres válidos",
  );

export const audioFormatSchema = z.enum(["mp3", "m4a", "opus"]);

export const youtubeUrlSchema = z
  .string()
  .trim()
  .min(1, "La URL de YouTube es obligatoria")
  .refine((raw) => {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      if (!ALLOWED_YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) {
        return false;
      }
      const v = parsed.searchParams.get("v");
      const list = parsed.searchParams.get("list");
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return true;
      }
      if (list && /^[a-zA-Z0-9_-]{10,64}$/.test(list)) {
        return true;
      }
      if (
        (parsed.hostname === "youtu.be" || parsed.hostname === "www.youtu.be") &&
        pathParts[0] &&
        /^[a-zA-Z0-9_-]{11}$/.test(pathParts[0])
      ) {
        return true;
      }
      if (
        pathParts.length >= 2 &&
        (pathParts[0] === "shorts" || pathParts[0] === "embed") &&
        /^[a-zA-Z0-9_-]{11}$/.test(pathParts[1])
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, "Introduce una URL válida de video o playlist de YouTube");

export const downloadFormSchema = z.object({
  url: youtubeUrlSchema,
  audioFormat: audioFormatSchema.default("mp3"),
  forceOverwrite: z.boolean().default(false),
  asyncMode: z.boolean().default(false),
});

export type DownloadFormValues = z.infer<typeof downloadFormSchema>;

export const playlistFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título de la playlist no puede estar vacío")
    .max(100, "El título no puede superar los 100 caracteres"),
  youtubePlaylistId: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[a-zA-Z0-9_-]{10,64}$/.test(val),
      "El ID de playlist de YouTube no tiene un formato válido",
    ),
});

export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;

export const workspaceConfigSchema = z.object({
  rootPath: z
    .string()
    .trim()
    .min(1, "Debes seleccionar un directorio raíz para el Workspace")
    .refine((val) => !val.includes(".."), "La ruta no puede contener secuencias '..'"),
  microserviceUrl: z
    .string()
    .trim()
    .url("Introduce una URL HTTP válida para el microservicio Go"),
});

export type WorkspaceConfigValues = z.infer<typeof workspaceConfigSchema>;

export const progressEventSchema = z.object({
  task_id: z.string(),
  youtube_id: z.string(),
  status: z.enum([
    "queued",
    "downloading",
    "processing",
    "completed",
    "skipped",
    "failed",
  ]),
  progress: z.number().min(0).max(100),
  speed: z.string().optional(),
  downloaded_size: z.string().optional(),
  eta: z.string().optional(),
  error: z.string().optional(),
  metadata: z
    .object({
      youtube_id: z.string(),
      title: z.string(),
      artist: z.string(),
      duration: z.number(),
      published_at: z.string().nullable().optional(),
      file_extension: z.string(),
      thumbnail_path: z.string(),
      audio_path: z.string(),
      file_size: z.number(),
      playlist_id: z.string().nullable().optional(),
      playlist_title: z.string().nullable().optional(),
    })
    .optional(),
});
