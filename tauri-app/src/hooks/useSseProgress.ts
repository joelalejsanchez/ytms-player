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
            return;
          }

          const ev = validated.data;
          upsertProgressEvent(ev);

          if (ev.status === "completed" && ev.metadata) {
            void tauriApi
              .confirmSseDownload({
                youtube_id: ev.youtube_id,
                status: "completed",
                metadata: {
                  youtube_id: ev.metadata.youtube_id,
                  title: ev.metadata.title,
                  artist: ev.metadata.artist,
                  duration: ev.metadata.duration,
                  published_at: ev.metadata.published_at ?? null,
                  file_extension: ev.metadata.file_extension,
                  thumbnail_path: ev.metadata.thumbnail_path,
                  audio_path: ev.metadata.audio_path,
                  file_size: ev.metadata.file_size,
                  playlist_id: ev.metadata.playlist_id ?? null,
                  playlist_title: ev.metadata.playlist_title ?? null,
                },
                audio_path: ev.metadata.audio_path,
                thumbnail_path: ev.metadata.thumbnail_path,
                file_extension: ev.metadata.file_extension,
                file_size: ev.metadata.file_size,
                skipped: false,
              })
              .then((savedTrack) => {
                upsertTrackLocal(savedTrack);
              })
              .catch(() => {
                void refreshTracks();
              });
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
