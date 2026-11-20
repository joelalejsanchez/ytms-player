import { useMemo } from "react";
import { usePlayerStore } from "@/stores/usePlayerStore";

export interface PlayerControlTooltips {
  isNextDisabled: boolean;
  isPreviousDisabled: boolean;
  nextTooltip: string;
  previousTooltip: string;
  playPauseTooltip: string;
  repeatTooltip: string;
  shuffleTooltip: string;
}

/**
 * Hook centralizado para calcular de forma reactiva los tooltips dinámicos
 * y los estados de bloqueo condicional en los controles del reproductor (PersistentPlayer y NowPlayingView).
 */
export function usePlayerControlTooltips(): PlayerControlTooltips {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoadingTrack = usePlayerStore((s) => s.isLoadingTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);

  return useMemo(() => {
    // 1. Bloqueo condicional estricto
    const isNextDisabled =
      !currentTrack ||
      (repeatMode === "off" && (currentIndex >= queue.length - 1 || queue.length <= 1));

    const isPreviousDisabled =
      !currentTrack || (repeatMode === "off" && currentIndex <= 0 && currentTime <= 3);

    // 2. Tooltip dinámico para navegación hacia atrás (SkipBack)
    let previousTooltip = "Anterior";
    if (!currentTrack) {
      previousTooltip = "Cola vacía";
    } else if (currentTime > 3) {
      previousTooltip = "Reiniciar canción";
    } else if (repeatMode === "off" && currentIndex <= 0) {
      previousTooltip = "Inicio de la cola";
    }

    // 3. Tooltip dinámico para navegación hacia adelante (SkipForward)
    let nextTooltip = "Siguiente";
    if (!currentTrack) {
      nextTooltip = "Cola vacía";
    } else if (
      repeatMode === "off" &&
      (currentIndex >= queue.length - 1 || queue.length <= 1)
    ) {
      nextTooltip = "Fin de la cola";
    }

    // 4. Tooltip dinámico para Play / Pause
    let playPauseTooltip = "Reproducir";
    if (isLoadingTrack) {
      playPauseTooltip = "Cargando pista...";
    } else if (!currentTrack) {
      playPauseTooltip = "Sin canciones en cola";
    } else if (isPlaying) {
      playPauseTooltip = "Pausar";
    } else if (currentTime > 0) {
      playPauseTooltip = "Reanudar";
    }

    // 5. Tooltip dinámico para Modo Repetición
    let repeatTooltip = "Modo repetición: Desactivado";
    if (repeatMode === "one") {
      repeatTooltip = "Modo repetición: Una canción";
    } else if (repeatMode === "all") {
      repeatTooltip = "Modo repetición: Todas";
    }

    // 6. Tooltip dinámico para Modo Aleatorio
    const shuffleTooltip = `Modo aleatorio: ${isShuffle ? "Activado" : "Desactivado"}`;

    return {
      isNextDisabled,
      isPreviousDisabled,
      nextTooltip,
      previousTooltip,
      playPauseTooltip,
      repeatTooltip,
      shuffleTooltip,
    };
  }, [
    currentTrack,
    isPlaying,
    isLoadingTrack,
    currentTime,
    queue.length,
    currentIndex,
    repeatMode,
    isShuffle,
  ]);
}
