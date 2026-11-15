import { useEffect, useRef } from "react";
import { progressEventSchema } from "@/schemas/validation";
import { tauriApi } from "@/services/tauriIpc";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";

/**
 * Mantiene una única conexión persistente Server-Sent Events (SSE) con `/api/progress/stream`
 * sin realizar polling en reposo y gestionando reconexiones con backoff exponencial (SDD 6.2 y 7.1).
 */
export function useSseProgress(): void {
  const microserviceUrl = useDownloadStore((s) => s.microserviceUrl);
  const setConnectionState = useDownloadStore((s) => s.setConnectionState);
  const upsertProgressEvent = useDownloadStore((s) => s.upsertProgressEvent);
  const upsertTrackLocal = useLibraryStore((s) => s.upsertTrackLocal);
  const refreshTracks = useLibraryStore((s) => s.refreshTracks);

  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    let eventSource: EventSource | null = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) {
        return;
      }

      setConnectionState("connecting");
      const streamUrl = `${microserviceUrl.replace(/\/+$/, "")}/api/progress/stream`;
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        if (!isDisposed) {
          retryCountRef.current = 0;
          setConnectionState("connected");
        }
      };

      eventSource.addEventListener("connected", () => {
        if (!isDisposed) {
          retryCountRef.current = 0;
          setConnectionState("connected");
        }
      });

      eventSource.addEventListener("download_progress", (rawEvent: MessageEvent) => {
        if (isDisposed) {
          return;
        }
        try {
          const parsedJson: unknown = JSON.parse(String(rawEvent.data));
          const validated = progressEventSchema.safeParse(parsedJson);
          if (!validated.success) {
            console.warn(
              "SSE event validation warning:",
              validated.error,
              rawEvent.data,
            );
            return;
          }

          const ev = validated.data;
          upsertProgressEvent(ev);

          if (ev.status === "completed" || ev.status === "skipped") {
            const currentTasks = useDownloadStore.getState().tasks;
            const existingTask = Object.values(currentTasks).find(
              (t) => t.youtube_id === ev.youtube_id,
            );
            const meta = ev.metadata || existingTask?.metadata;
            const title = meta?.title || ev.youtube_id;
            const artist = meta?.artist || "Unknown Artist";
            const ext = meta?.file_extension || "mp3";
            const dest = useDownloadStore.getState().taskDestinations[ev.task_id];

            void tauriApi
              .confirmSseDownload(
                {
                  youtube_id: ev.youtube_id,
                  status: ev.status,
                  metadata: {
                    youtube_id: ev.youtube_id,
                    title,
                    artist,
                    duration: meta?.duration || 0,
                    published_at: meta?.published_at ?? null,
                    file_extension: ext,
                    thumbnail_path: meta?.thumbnail_path || "",
                    audio_path: meta?.audio_path || "",
                    file_size: meta?.file_size || 0,
                    playlist_id: meta?.playlist_id ?? null,
                    playlist_title: meta?.playlist_title ?? null,
                  },
                  audio_path: meta?.audio_path || "",
                  thumbnail_path: meta?.thumbnail_path || "",
                  file_extension: ext,
                  file_size: meta?.file_size || 0,
                  skipped: ev.status === "skipped",
                },
                dest?.targetPlaylistId,
                dest?.skipPlaylist,
              )
              .then((savedTrack) => {
                upsertTrackLocal(savedTrack);
                void useLibraryStore.getState().refreshDownloadHistory();
                void useLibraryStore.getState().refreshTracks();
                void useLibraryStore.getState().refreshMissingTracks();
                void useLibraryStore.getState().refreshPlaylists();
              })
              .catch((err) => {
                console.error("confirmSseDownload error:", err);
                void refreshTracks();
                void useLibraryStore.getState().refreshDownloadHistory();
                void useLibraryStore.getState().refreshMissingTracks();
                void useLibraryStore.getState().refreshPlaylists();
              });
          } else if (ev.status === "failed") {
            void useLibraryStore.getState().refreshDownloadHistory();
          }
        } catch {
          // Ignorar eventos malformados sin interrumpir el stream SSE
        }
      });

      eventSource.onerror = () => {
        if (isDisposed) {
          return;
        }
        setConnectionState("error");
        eventSource?.close();

        const backoffMs = Math.min(15000, 1500 * 2 ** retryCountRef.current);
        retryCountRef.current = Math.min(retryCountRef.current + 1, 5);
        reconnectTimerRef.current = setTimeout(connect, backoffMs);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      eventSource?.close();
      setConnectionState("disconnected");
    };
  }, [
    microserviceUrl,
    setConnectionState,
    upsertProgressEvent,
    upsertTrackLocal,
    refreshTracks,
  ]);
}
