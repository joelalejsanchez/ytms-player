import { useEffect } from "react";
import { toAssetUrl } from "@/lib/utils";
import { usePlayerStore } from "@/stores/usePlayerStore";

/**
 * Carátula de respaldo en formato SVG Data URL cuando la pista no dispone de cover_path físico.
 */
export const DEFAULT_MEDIA_ARTWORK = [
  {
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M9 18V5l12-2v13'/><circle cx='6' cy='18' r='3'/><circle cx='18' cy='16' r='3'/></svg>",
    sizes: "512x512",
    type: "image/svg+xml",
  },
];

/**
 * Registra un manejador de acción de MediaSession de forma tolerante a fallos
 * en navegadores o entornos que no soporten ciertas acciones específicas.
 */
function safeSetActionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Silenciosamente ignorado si el entorno no admite la acción requerida
  }
}

/**
 * Hook de integración nativa con la MediaSession API del sistema operativo (Linux MPRIS, Windows Media Controls, etc.)
 * Publica metadatos, sincroniza estados de reproducción y posición, y vincula controles multimedia externos.
 */
export function useMediaSession(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  // 1. Sincronización de Metadatos y Artwork (con fallback ante ausencia de carátula)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    const artwork = currentTrack.thumbnail_path
      ? [
          {
            src: toAssetUrl(currentTrack.thumbnail_path),
            sizes: "96x96",
            type: "image/jpeg",
          },
          {
            src: toAssetUrl(currentTrack.thumbnail_path),
            sizes: "128x128",
            type: "image/jpeg",
          },
          {
            src: toAssetUrl(currentTrack.thumbnail_path),
            sizes: "256x256",
            type: "image/jpeg",
          },
          {
            src: toAssetUrl(currentTrack.thumbnail_path),
            sizes: "512x512",
            type: "image/jpeg",
          },
        ]
      : DEFAULT_MEDIA_ARTWORK;

    if (typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || "Artista Desconocido",
        album: "ytms-player",
        artwork,
      });
    }
  }, [currentTrack]);

  // 2. Sincronización del estado de reproducción (playbackState)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.playbackState = "none";
    } else {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying, currentTrack]);

  // 3. Sincronización de posición temporal (setPositionState)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== "function") return;
    if (!currentTrack || !Number.isFinite(duration) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0.1, duration),
        playbackRate: 1,
        position: Math.max(0, Math.min(duration, currentTime)),
      });
    } catch {
      // Ignorar discrepancias menores de precisión en el motor de audio
    }
  }, [currentTime, duration, currentTrack]);

  // 4. Registro y vinculación de manejadores de eventos multimedia externos
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    safeSetActionHandler("play", () => {
      usePlayerStore.getState().setPlaying(true);
    });

    safeSetActionHandler("pause", () => {
      usePlayerStore.getState().setPlaying(false);
    });

    safeSetActionHandler("previoustrack", () => {
      const audio = audioRef?.current;
      // Si la reproducción avanzó más de 3 segundos, reiniciar la pista activa
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        usePlayerStore.getState().setCurrentTime(0);
        return;
      }

      const {
        currentTrack: track,
        repeatMode,
        currentIndex,
        currentTime: curTime,
      } = usePlayerStore.getState();
      const isPreviousDisabled =
        !track || (repeatMode === "off" && currentIndex <= 0 && curTime <= 3);

      if (!isPreviousDisabled) {
        usePlayerStore.getState().playPrevious();
      }
    });

    safeSetActionHandler("nexttrack", () => {
      const {
        currentTrack: track,
        repeatMode,
        currentIndex,
        queue,
      } = usePlayerStore.getState();
      const isNextDisabled =
        !track ||
        (repeatMode === "off" &&
          (currentIndex >= queue.length - 1 || queue.length <= 1));

      if (!isNextDisabled) {
        usePlayerStore.getState().playNext();
      }
    });

    safeSetActionHandler("seekto", (details) => {
      if (
        details &&
        typeof details.seekTime === "number" &&
        Number.isFinite(details.seekTime)
      ) {
        if (audioRef?.current) {
          audioRef.current.currentTime = details.seekTime;
        }
        usePlayerStore.getState().seekTo(details.seekTime);
      }
    });

    safeSetActionHandler("seekbackward", (details) => {
      const offset = details?.seekOffset || 10;
      const cur =
        audioRef?.current?.currentTime ?? usePlayerStore.getState().currentTime;
      usePlayerStore.getState().seekTo(Math.max(0, cur - offset));
    });

    safeSetActionHandler("seekforward", (details) => {
      const offset = details?.seekOffset || 10;
      const dur = usePlayerStore.getState().duration;
      const cur =
        audioRef?.current?.currentTime ?? usePlayerStore.getState().currentTime;
      usePlayerStore.getState().seekTo(Math.min(dur, cur + offset));
    });

    safeSetActionHandler("stop", () => {
      usePlayerStore.getState().setPlaying(false);
    });

    return () => {
      safeSetActionHandler("play", null);
      safeSetActionHandler("pause", null);
      safeSetActionHandler("previoustrack", null);
      safeSetActionHandler("nexttrack", null);
      safeSetActionHandler("seekto", null);
      safeSetActionHandler("seekbackward", null);
      safeSetActionHandler("seekforward", null);
      safeSetActionHandler("stop", null);
    };
  }, [audioRef]);
}
