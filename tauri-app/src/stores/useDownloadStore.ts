import { create } from "zustand";
import { tauriApi } from "@/services/tauriIpc";
import type {
  DownloadCommandInput,
  DownloadProgressEvent,
  MicroserviceDownloadResponse,
} from "@/types/models";

export type SseConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface DownloadStoreState {
  microserviceUrl: string;
  connectionState: SseConnectionState;
  tasks: Record<string, DownloadProgressEvent>;
  taskDestinations: Record<
    string,
    { targetPlaylistId?: number | null; skipPlaylist?: boolean | null }
  >;
  isSubmitting: boolean;
  lastError: string | null;

  setMicroserviceUrl: (url: string) => Promise<void>;
  setConnectionState: (state: SseConnectionState) => void;
  upsertProgressEvent: (event: DownloadProgressEvent) => void;
  startDownloadTask: (
    input: DownloadCommandInput,
  ) => Promise<MicroserviceDownloadResponse>;
  removeTask: (taskKey: string) => void;
  clearCompletedTasks: () => void;
  clearError: () => void;
}

export function buildTaskKey(taskId: string, youtubeId: string): string {
  return `${taskId}:${youtubeId}`;
}

export const useDownloadStore = create<DownloadStoreState>((set) => ({
  microserviceUrl: "http://127.0.0.1:8080",
  connectionState: "disconnected",
  tasks: {},
  taskDestinations: {},
  isSubmitting: false,
  lastError: null,

  setMicroserviceUrl: async (url) => {
    const clean = url.trim().replace(/\/+$/, "");
    set({ microserviceUrl: clean, lastError: null });
    try {
      await tauriApi.setMicroserviceUrl(clean);
    } catch {
      // Permitir actualización en estado local incluso fuera del runtime nativo
    }
  },

  setConnectionState: (connectionState) => set({ connectionState }),

  upsertProgressEvent: (event) => {
    set((state) => {
      const nextTasks = { ...state.tasks };
      const canonicalKey = buildTaskKey(event.task_id, event.youtube_id);

      // Buscar si ya existía una tarea para este youtube_id (ej. precargada con otro task_id como el ID de la playlist)
      let existingKey: string | null = null;
      for (const k of Object.keys(nextTasks)) {
        if (nextTasks[k]?.youtube_id === event.youtube_id) {
          existingKey = k;
          break;
        }
      }

      const existingTask = existingKey ? nextTasks[existingKey] : null;

      // Preservar y fusionar metadatos para nunca perder playlist_id, playlist_title, título ni artista
      let mergedMetadata: DownloadProgressEvent["metadata"] = undefined;
      if (existingTask?.metadata || event.metadata) {
        mergedMetadata = {
          youtube_id: event.youtube_id,
          title:
            event.metadata?.title ||
            existingTask?.metadata?.title ||
            event.youtube_id,
          artist:
            event.metadata?.artist ||
            existingTask?.metadata?.artist ||
            "Unknown Artist",
          duration:
            event.metadata?.duration ??
            existingTask?.metadata?.duration ??
            0,
          published_at:
            event.metadata?.published_at ??
            existingTask?.metadata?.published_at ??
            null,
          file_extension:
            event.metadata?.file_extension ||
            existingTask?.metadata?.file_extension ||
            "mp3",
          thumbnail_path:
            event.metadata?.thumbnail_path ||
            existingTask?.metadata?.thumbnail_path ||
            "",
          audio_path:
            event.metadata?.audio_path ||
            existingTask?.metadata?.audio_path ||
            "",
          file_size:
            event.metadata?.file_size ??
            existingTask?.metadata?.file_size ??
            0,
          playlist_id:
            event.metadata?.playlist_id ||
            existingTask?.metadata?.playlist_id ||
            null,
          playlist_title:
            event.metadata?.playlist_title ||
            existingTask?.metadata?.playlist_title ||
            null,
        };
      }

      const updatedEvent: DownloadProgressEvent = {
        ...existingTask,
        ...event,
        metadata: mergedMetadata,
      };

      // Si la clave previa tenía otro task_id (ej. el ID de la playlist), eliminarla para evitar duplicación
      if (existingKey && existingKey !== canonicalKey) {
        delete nextTasks[existingKey];
      }

      nextTasks[canonicalKey] = updatedEvent;
      return { tasks: nextTasks };
    });
  },

  startDownloadTask: async (input) => {
    set({ isSubmitting: true, lastError: null });
    try {
      const response = await tauriApi.startDownload(input);
      set((state) => ({
        taskDestinations: {
          ...state.taskDestinations,
          [response.task_id]: {
            targetPlaylistId: input.target_playlist_id,
            skipPlaylist: input.skip_playlist,
          },
        },
      }));
      if (response.items && response.items.length > 0) {
        set((state) => {
          const nextTasks = { ...state.tasks };
          for (const item of response.items) {
            const key = buildTaskKey(response.task_id, item.youtube_id);
            nextTasks[key] = {
              task_id: response.task_id,
              youtube_id: item.youtube_id,
              status: item.status,
              progress:
                item.status === "completed" || item.status === "skipped" ? 100 : 0,
              error: item.error,
              metadata: item.metadata,
            };
          }
          return { tasks: nextTasks, isSubmitting: false };
        });
      } else {
        const key = buildTaskKey(response.task_id, response.youtube_id);
        set((state) => ({
          isSubmitting: false,
          tasks: {
            ...state.tasks,
            [key]: {
              task_id: response.task_id,
              youtube_id: response.youtube_id,
              status: response.status,
              progress: response.status === "completed" ? 100 : 0,
            },
          },
        }));
      }
      return response;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Error al iniciar la descarga";
      set({ isSubmitting: false, lastError: message });
      throw err;
    }
  },

  removeTask: (taskKey) => {
    set((state) => {
      const next = { ...state.tasks };
      delete next[taskKey];
      return { tasks: next };
    });
  },

  clearCompletedTasks: () => {
    set((state) => {
      const next: Record<string, DownloadProgressEvent> = {};
      for (const [key, task] of Object.entries(state.tasks)) {
        if (task.status !== "completed" && task.status !== "skipped") {
          next[key] = task;
        }
      }
      return { tasks: next };
    });
  },

  clearError: () => set({ lastError: null }),
}));
