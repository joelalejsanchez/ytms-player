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
  removePlaylistGroup: (groupKeyOrPlaylistId: string) => void;
  clearCompletedTasks: () => void;
  clearAllTasks: () => void;
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

      // Buscar cualquier tarea previa para este youtube_id, priorizando la que contenga metadatos de playlist
      let existingMetadata: DownloadProgressEvent["metadata"] = undefined;
      let existingTask: DownloadProgressEvent | null = null;
      const keysToDelete: string[] = [];

      for (const k of Object.keys(nextTasks)) {
        if (nextTasks[k]?.youtube_id === event.youtube_id) {
          if (nextTasks[k]?.metadata) {
            existingMetadata = nextTasks[k]?.metadata;
            existingTask = nextTasks[k];
          } else if (!existingTask) {
            existingTask = nextTasks[k];
          }
          if (k !== canonicalKey) {
            keysToDelete.push(k);
          }
        }
      }

      for (const k of keysToDelete) {
        delete nextTasks[k];
      }

      // Preservar y fusionar metadatos para nunca perder playlist_id, playlist_title, título ni artista
      let mergedMetadata: DownloadProgressEvent["metadata"] = undefined;
      if (existingMetadata || event.metadata) {
        mergedMetadata = {
          youtube_id: event.youtube_id,
          title: event.metadata?.title || existingMetadata?.title || event.youtube_id,
          artist:
            event.metadata?.artist || existingMetadata?.artist || "Unknown Artist",
          duration: event.metadata?.duration ?? existingMetadata?.duration ?? 0,
          published_at:
            event.metadata?.published_at ?? existingMetadata?.published_at ?? null,
          file_extension:
            event.metadata?.file_extension || existingMetadata?.file_extension || "mp3",
          thumbnail_path:
            event.metadata?.thumbnail_path || existingMetadata?.thumbnail_path || "",
          audio_path: event.metadata?.audio_path || existingMetadata?.audio_path || "",
          file_size: event.metadata?.file_size ?? existingMetadata?.file_size ?? 0,
          playlist_id:
            event.metadata?.playlist_id || existingMetadata?.playlist_id || null,
          playlist_title:
            event.metadata?.playlist_title || existingMetadata?.playlist_title || null,
        };
      }

      const updatedEvent: DownloadProgressEvent = {
        ...existingTask,
        ...event,
        metadata: mergedMetadata,
      };

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
            const prev = nextTasks[key];
            const isAdvanced =
              prev?.status === "downloading" ||
              prev?.status === "processing" ||
              prev?.status === "completed" ||
              prev?.status === "skipped" ||
              prev?.status === "failed";
            const finalStatus = isAdvanced ? prev.status : item.status;
            const finalProgress =
              finalStatus === "completed" || finalStatus === "skipped"
                ? 100
                : prev?.progress ?? (item.status === "completed" || item.status === "skipped" ? 100 : 0);

            nextTasks[key] = {
              task_id: response.task_id,
              youtube_id: item.youtube_id,
              status: finalStatus,
              progress: finalProgress,
              error: item.error || prev?.error,
              metadata: item.metadata || prev?.metadata,
            };
          }
          return { tasks: nextTasks, isSubmitting: false };
        });
      } else {
        const key = buildTaskKey(response.task_id, response.youtube_id);
        set((state) => {
          const nextTasks = { ...state.tasks };
          let existingMetadata: DownloadProgressEvent["metadata"] = undefined;
          let existingProgress = 0;
          let existingStatus: DownloadProgressEvent["status"] | undefined = undefined;
          let existingError: string | undefined = undefined;

          for (const k of Object.keys(nextTasks)) {
            if (nextTasks[k]?.youtube_id === response.youtube_id) {
              if (nextTasks[k]?.metadata) {
                existingMetadata = nextTasks[k]?.metadata;
              }
              if (
                typeof nextTasks[k]?.progress === "number" &&
                nextTasks[k]!.progress > existingProgress
              ) {
                existingProgress = nextTasks[k]!.progress;
              }
              if (nextTasks[k]?.status) {
                existingStatus = nextTasks[k]!.status;
              }
              if (nextTasks[k]?.error) {
                existingError = nextTasks[k]!.error;
              }
              if (k !== key) {
                delete nextTasks[k];
              }
            }
          }

          // Prevenir degradación del estado si el flujo SSE ya avanzó en tiempo real
          const isAdvancedStatus =
            existingStatus === "downloading" ||
            existingStatus === "processing" ||
            existingStatus === "completed" ||
            existingStatus === "skipped" ||
            existingStatus === "failed";

          const finalStatus = isAdvancedStatus
            ? existingStatus
            : response.status;

          const finalProgress =
            finalStatus === "completed" || finalStatus === "skipped"
              ? 100
              : existingProgress;

          nextTasks[key] = {
            task_id: response.task_id,
            youtube_id: response.youtube_id,
            status: finalStatus,
            progress: finalProgress,
            metadata: existingMetadata,
            error: existingError,
          };

          return {
            isSubmitting: false,
            tasks: nextTasks,
          };
        });
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

  removePlaylistGroup: (groupKeyOrPlaylistId) => {
    set((state) => {
      const next: Record<string, DownloadProgressEvent> = {};
      for (const [key, task] of Object.entries(state.tasks)) {
        const plId = task.metadata?.playlist_id;
        const plTitle = task.metadata?.playlist_title;
        const matchesGroup =
          plId === groupKeyOrPlaylistId ||
          plTitle === groupKeyOrPlaylistId ||
          task.youtube_id === groupKeyOrPlaylistId ||
          task.task_id === groupKeyOrPlaylistId;
        if (!matchesGroup) {
          next[key] = task;
        }
      }
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

  clearAllTasks: () => set({ tasks: {} }),

  clearError: () => set({ lastError: null }),
}));
