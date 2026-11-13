import { create } from "zustand";
import { tauriApi } from "@/services/tauriIpc";
import type {
  DownloadCommandInput,
  DownloadProgressEvent,
  MicroserviceDownloadResponse,
} from "@/types/models";

export type SseConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface DownloadStoreState {
  microserviceUrl: string;
  connectionState: SseConnectionState;
  tasks: Record<string, DownloadProgressEvent>;
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
    const key = buildTaskKey(event.task_id, event.youtube_id);
    set((state) => ({
      tasks: {
        ...state.tasks,
        [key]: event,
      },
    }));
  },

  startDownloadTask: async (input) => {
    set({ isSubmitting: true, lastError: null });
    try {
      const response = await tauriApi.startDownload(input);
      if (response.items && response.items.length > 0) {
        set((state) => {
          const nextTasks = { ...state.tasks };
          for (const item of response.items) {
            const key = buildTaskKey(response.task_id, item.youtube_id);
            nextTasks[key] = {
              task_id: response.task_id,
              youtube_id: item.youtube_id,
              status: item.status,
              progress: item.status === "completed" || item.status === "skipped" ? 100 : 0,
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
