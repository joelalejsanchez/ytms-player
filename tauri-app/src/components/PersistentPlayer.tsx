import {
  ListMusic,
  Maximize2,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/Primitives";
import { ScrollableText } from "@/components/ui/ScrollableText";
import { useMediaSession } from "@/hooks/useMediaSession";
import { formatDuration, toAssetUrl } from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { toast } from "@/stores/useToastStore";

function dataUrlToBlobUrl(dataUrl: string): string {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  try {
    const parts = dataUrl.split(",");
    if (parts.length >= 2) {
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "audio/mp4";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn("Error converting Data URL to Blob URL:", err);
  }
  return dataUrl;
}

/**
 * Reproductor de audio persistente ubicado en la parte inferior de la aplicación (SDD 7.1).
 * Utiliza selectores granulares de Zustand para mantenerse desacoplado de la biblioteca visual (SDD 7.2).
 */
export const PersistentPlayer = React.memo(() => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useMediaSession(audioRef);
  const fadeAnimationRef = useRef<number | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  const [isSeekingLocally, setIsSeekingLocally] = useState(false);
  const [localSeekTime, setLocalSeekTime] = useState(0);

  const queueRef = useRef<HTMLDivElement | null>(null);
  const volumePopoverRef = useRef<HTMLDivElement | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVolumeMouseEnter = useCallback(() => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
      volumeTimeoutRef.current = null;
    }
    setShowVolumePopover(true);
  }, []);

  const handleVolumeMouseLeave = useCallback(() => {
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumePopover(false);
    }, 200);
  }, []);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const duration = usePlayerStore((s) => s.duration);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const seekTarget = usePlayerStore((s) => s.seekTarget);
  const queue = usePlayerStore((s) => s.queue);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const isLoadingTrack = usePlayerStore((s) => s.isLoadingTrack);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setIsLoadingTrack = usePlayerStore((s) => s.setIsLoadingTrack);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const clearSeekTarget = usePlayerStore((s) => s.clearSeekTarget);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrevious = usePlayerStore((s) => s.playPrevious);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleNowPlayingExpanded = usePlayerStore((s) => s.toggleNowPlayingExpanded);

  const isChangingTrackRef = useRef(false);
  const currentTrackIdRef = useRef<string | null>(null);
  const prevIsPlayingRef = useRef(isPlaying);
  const consecutiveFailuresRef = useRef(0);

  // Bloqueo condicional de controles de navegación según estado de cola y modo bucle
  const isNextDisabled =
    !currentTrack ||
    (repeatMode === "off" && (currentIndex >= queue.length - 1 || queue.length <= 1));

  const isPreviousDisabled =
    !currentTrack || (repeatMode === "off" && currentIndex <= 0 && currentTime <= 3);

  // Referencias para cálculo reactivo de volumen objetivo
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
  }, [volume, isMuted]);

  // Cierre de popovers flotantes al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!showVolumePopover && !showQueue) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        showVolumePopover &&
        volumePopoverRef.current &&
        !volumePopoverRef.current.contains(target)
      ) {
        setShowVolumePopover(false);
      }
      if (showQueue && queueRef.current && !queueRef.current.contains(target)) {
        const queueTrigger = document.querySelector('[data-queue-trigger="true"]');
        if (!queueTrigger || !queueTrigger.contains(target)) {
          setShowQueue(false);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowVolumePopover(false);
        setShowQueue(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showVolumePopover, showQueue]);

  const handleVerticalVolumePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = rect.bottom - e.clientY;
      const newVol = Math.max(0, Math.min(1, offsetY / rect.height));
      setVolume(newVol);
    },
    [setVolume],
  );

  // Conversión de volumen perceptual (curva cúbica de PulseAudio / PipeWire) a ganancia lineal para HTML5 Audio
  const toLinearGain = useCallback((perceptualVolume: number) => {
    const clamped = Math.max(0, Math.min(1, perceptualVolume));
    return Math.pow(clamped, 3);
  }, []);

  const getTargetVolume = useCallback(() => {
    return isMutedRef.current ? 0 : toLinearGain(volumeRef.current);
  }, [toLinearGain]);

  const cancelFade = useCallback(() => {
    if (fadeAnimationRef.current !== null) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }
  }, []);

  // Precargar de forma anticipada los metadatos de la siguiente pista de la cola mediante streaming HTTP nativo
  const preloadNextTrack = useCallback(() => {
    const state = usePlayerStore.getState();
    const current = state.currentTrack;
    if (!current) return;

    const currentQueue = state.queue;
    const currentIdx = currentQueue.findIndex(
      (item) => item.youtube_id === current.youtube_id,
    );
    const nextIdx =
      currentIdx >= 0 && currentIdx + 1 < currentQueue.length
        ? currentIdx + 1
        : state.repeatMode === "all" && currentQueue.length > 0
          ? 0
          : -1;

    if (nextIdx >= 0) {
      const nextTrack = currentQueue[nextIdx];
      if (nextTrack && !nextTrack.is_missing) {
        tauriApi
          .getAudioStreamUrl(nextTrack.audio_path)
          .then((streamUrl) => {
            if (streamUrl) {
              const probe = new Audio();
              probe.preload = "metadata";
              probe.src = streamUrl;
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Sincronizar cambio de pista
  useEffect(() => {
    let isCancelled = false;
    cancelFade();

    const audio = audioRef.current;
    if (!audio) return;

    // Pausar y resetear de inmediato la reproducción previa para silenciarla y purgar buffers residuales
    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    if (!currentTrack || currentTrack.is_missing) {
      currentTrackIdRef.current = null;
      isChangingTrackRef.current = false;
      setIsLoadingTrack(false);
      return;
    }

    currentTrackIdRef.current = currentTrack.youtube_id;
    isChangingTrackRef.current = true;
    setIsLoadingTrack(true);
    setCurrentTime(0);

    const loadAndPlayTrack = async () => {
      try {
        let playableSrc: string | null = null;
        try {
          // Streaming nativo HTTP 206 Partial Content (Byte-Range) desde el backend en Rust
          playableSrc = await tauriApi.getAudioStreamUrl(currentTrack.audio_path);
        } catch (streamErr) {
          console.warn(
            "getAudioStreamUrl warning, falling back to dataUrl/toAssetUrl:",
            streamErr,
          );
          try {
            const dataUrl = await tauriApi.readAudioDataUrl(currentTrack.audio_path);
            if (dataUrl) playableSrc = dataUrlToBlobUrl(dataUrl);
          } catch {
            playableSrc = toAssetUrl(currentTrack.audio_path);
          }
        }

        if (!playableSrc) {
          playableSrc = toAssetUrl(currentTrack.audio_path);
        }

        if (
          isCancelled ||
          !audioRef.current ||
          currentTrackIdRef.current !== currentTrack.youtube_id
        ) {
          return;
        }

        audio.src = playableSrc;

        const tgtVol = getTargetVolume();
        audio.volume = tgtVol;
        audio.muted = isMutedRef.current;

        // Esperar a que el nuevo recurso esté listo sin forzar seek artificial
        await new Promise<void>((resolve, reject) => {
          let handled = false;
          const onCanPlay = () => {
            if (handled) return;
            handled = true;
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("error", onError);
            // No llamar a audio.currentTime = 0; la nueva fuente ya inicia en 0.0s de forma nativa.
            // Asignar currentTime provocaba un seek asíncrono con vaciado de buffer (silenciado).
            resolve();
          };

          const onError = () => {
            if (handled) return;
            handled = true;
            audio.removeEventListener("canplay", onCanPlay);
            audio.removeEventListener("error", onError);
            const errCode = audio.error?.code ?? "UNKNOWN";
            const errMsg = audio.error?.message || "Error al decodificar audio";
            reject(new Error(`Code ${errCode}: ${errMsg}`));
          };

          audio.addEventListener("canplay", onCanPlay, { once: true });
          audio.addEventListener("error", onError, { once: true });
        });

        if (
          isCancelled ||
          !audioRef.current ||
          currentTrackIdRef.current !== currentTrack.youtube_id
        ) {
          return;
        }

        if (usePlayerStore.getState().isPlaying) {
          await audio.play();
        }
        consecutiveFailuresRef.current = 0;
        preloadNextTrack();
      } catch (err) {
        if (!isCancelled && currentTrackIdRef.current === currentTrack.youtube_id) {
          console.error("Error al iniciar reproducción:", err);
          setPlaying(false);
          setIsLoadingTrack(false);

          consecutiveFailuresRef.current += 1;
          const track = currentTrack;
          usePlayerStore.getState().markTrackCorrupted(track.youtube_id);

          const errorDetail = err instanceof Error ? err.message : String(err);
          toast.error(
            `Error al reproducir "${track.title}"`,
            `Archivo posiblemente dañado (${errorDetail}). Saltando a la siguiente...`,
            4000,
          );

          const {
            repeatMode: rMode,
            currentIndex: cIdx,
            queue: qList,
          } = usePlayerStore.getState();
          const canAdvance = rMode !== "off" || cIdx < qList.length - 1;

          if (consecutiveFailuresRef.current < 4 && canAdvance) {
            playNext();
          } else {
            consecutiveFailuresRef.current = 0;
            setPlaying(false);
            if (canAdvance) {
              toast.error(
                "Reproducción detenida",
                "Múltiples archivos consecutivos no se pudieron reproducir.",
                4000,
              );
            }
          }
        }
      } finally {
        if (!isCancelled) {
          isChangingTrackRef.current = false;
        }
      }
    };

    void loadAndPlayTrack();

    return () => {
      isCancelled = true;
      cancelFade();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTrack?.youtube_id,
    currentTrack?.audio_path,
    cancelFade,
    getTargetVolume,
    preloadNextTrack,
    setPlaying,
    setIsLoadingTrack,
    setCurrentTime,
  ]);

  // Sincronizar manual play / pause con respuesta inmediata sin interferir con el cambio de pista
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || !audio.src) {
      prevIsPlayingRef.current = isPlaying;
      return;
    }

    // Si se está cambiando de pista, Effect 1 gestiona la reproducción directamente
    if (isChangingTrackRef.current) {
      prevIsPlayingRef.current = isPlaying;
      return;
    }

    // Solo actuar si el estado isPlaying cambió deliberadamente
    if (prevIsPlayingRef.current === isPlaying) {
      return;
    }
    prevIsPlayingRef.current = isPlaying;

    const targetVol = getTargetVolume();

    if (isPlaying && audio.paused) {
      audio.volume = targetVol;
      audio.muted = isMutedRef.current;
      audio.play().catch((playErr) => {
        console.error("Manual audio.play() rejected:", playErr);
        setPlaying(false);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
      audio.volume = targetVol;
    }
  }, [isPlaying, currentTrack, getTargetVolume, setPlaying]);

  // Sincronizar volumen reactivo y modo silencio en todo momento con curva logarítmica/cúbica
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeAnimationRef.current === null) {
      audio.volume = isMuted ? 0 : toLinearGain(volume);
      audio.muted = isMuted;
    }
  }, [volume, isMuted, toLinearGain]);

  // Sincronizar operaciones de Seek manuales (bloqueadas durante carga)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTarget === null || isLoadingTrack) {
      return;
    }
    audio.currentTime = seekTarget;
    clearSeekTarget();
  }, [seekTarget, isLoadingTrack, clearSeekTarget]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && !isChangingTrackRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      consecutiveFailuresRef.current = 0;
    }
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
    setIsLoadingTrack(false);
  }, [setDuration, setIsLoadingTrack]);

  const handleCanPlay = useCallback(() => {
    setIsLoadingTrack(false);
    consecutiveFailuresRef.current = 0;
  }, [setIsLoadingTrack]);

  const handleAudioError = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      const audioEl = e.currentTarget;
      const track = usePlayerStore.getState().currentTrack;
      const errCode = audioEl.error?.code ?? "UNKNOWN";
      const errMsg = audioEl.error?.message || "Error al decodificar audio";
      console.error("Audio playback error event:", errCode, errMsg);
      setIsLoadingTrack(false);

      if (track) {
        usePlayerStore.getState().markTrackCorrupted(track.youtube_id);
        consecutiveFailuresRef.current += 1;

        toast.error(
          `Error al reproducir "${track.title}"`,
          `Archivo posiblemente dañado (Code ${errCode}: ${errMsg}). Saltando a la siguiente...`,
          4000,
        );

        const {
          repeatMode: rMode,
          currentIndex: cIdx,
          queue: qList,
        } = usePlayerStore.getState();
        const canAdvance = rMode !== "off" || cIdx < qList.length - 1;

        if (consecutiveFailuresRef.current < 4 && canAdvance) {
          playNext();
        } else {
          consecutiveFailuresRef.current = 0;
          setPlaying(false);
        }
      }
    },
    [setIsLoadingTrack, playNext, setPlaying],
  );

  const handleEnded = useCallback(() => {
    const {
      repeatMode: rMode,
      currentIndex: cIdx,
      queue: qList,
    } = usePlayerStore.getState();
    if (rMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
    } else if (rMode === "all" || cIdx < qList.length - 1) {
      playNext();
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setPlaying(false);
      setCurrentTime(0);
      clearSeekTarget();
    }
  }, [playNext, setPlaying, setCurrentTime, clearSeekTarget]);

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isLoadingTrack || !currentTrack) return;
      const val = Number(e.target.value);
      setLocalSeekTime(val);
      setIsSeekingLocally(true);
    },
    [isLoadingTrack, currentTrack],
  );

  const handleSeekCommit = useCallback(() => {
    if (isSeekingLocally && !isLoadingTrack) {
      setIsSeekingLocally(false);
      seekTo(localSeekTime);
      if (audioRef.current) {
        audioRef.current.currentTime = localSeekTime;
      }
    }
  }, [isSeekingLocally, localSeekTime, seekTo, isLoadingTrack]);

  const handleVolumeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(Number(e.target.value));
    },
    [setVolume],
  );

  const thumbnailSrc = toAssetUrl(currentTrack?.thumbnail_path);

  const displayTitle = useMemo(() => {
    if (!currentTrack) return "Sin pista seleccionada";
    return currentTrack.title.replace(/\.(mp3|m4a|opus|flac|wav|webm|aac|ogg)$/i, "");
  }, [currentTrack]);
  const displayArtist = currentTrack
    ? currentTrack.artist
    : "Selecciona un track de la biblioteca";

  const displayTime = isSeekingLocally ? localSeekTime : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const volumeValue = isMuted ? 0 : volume;
  const volumePercent = Math.min(100, Math.max(0, volumeValue * 100));

  // Renderizado reutilizable de la barra de progreso de reproducción
  const renderProgressBar = (compact = false) => (
    <div
      className={`group relative flex h-4 flex-1 select-none items-center ${
        !currentTrack || isLoadingTrack
          ? "cursor-not-allowed opacity-50 pointer-events-none"
          : "cursor-pointer"
      }`}
      title={isLoadingTrack ? "Cargando pista..." : undefined}
    >
      {/* Fondo de la barra */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover:h-1.5">
        {/* Relleno hasta el punto actual */}
        <div
          className={`h-full transition-none ${
            isLoadingTrack ? "bg-muted-foreground/40 animate-pulse" : "bg-primary"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Indicador / Thumb dinámico instantáneo */}
      <div
        className={`pointer-events-none absolute h-2 w-2 -translate-x-1/2 rounded-full shadow-md transition-none ${
          isLoadingTrack
            ? "bg-muted-foreground opacity-40"
            : "bg-foreground group-hover:h-3.5 group-hover:w-3.5 group-hover:bg-primary"
        }`}
        style={{ left: `${progressPercent}%` }}
      />

      {/* Input range transparente en primer plano para interacción nativa y fluida */}
      <input
        type="range"
        min={0}
        max={duration > 0 ? duration : 100}
        step={0.5}
        value={displayTime}
        onChange={handleSeekChange}
        onPointerDown={() => setIsSeekingLocally(true)}
        onPointerUp={handleSeekCommit}
        onKeyUp={handleSeekCommit}
        disabled={!currentTrack || isLoadingTrack}
        aria-label={
          compact ? "Progreso compacto de la canción" : "Progreso de la canción"
        }
        aria-disabled={!currentTrack || isLoadingTrack}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed disabled:pointer-events-none"
      />
    </div>
  );

  // Renderizado reutilizable del control de volumen
  const renderVolumeSlider = (compact = false) => (
    <div
      className={`group relative flex h-4 ${
        compact ? "w-24" : "w-24 lg:w-28"
      } cursor-pointer select-none items-center`}
    >
      {/* Pista de fondo */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover:h-1.5">
        {/* Relleno hasta el valor de volumen */}
        <div
          className="h-full bg-primary transition-none"
          style={{ width: `${volumePercent}%` }}
        />
      </div>

      {/* Indicador / Thumb pequeño instantáneo */}
      <div
        className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 rounded-full bg-foreground shadow-md transition-none group-hover:h-3.5 group-hover:w-3.5 group-hover:bg-primary"
        style={{ left: `${volumePercent}%` }}
      />

      {/* Input range transparente */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volumeValue}
        onChange={handleVolumeInput}
        aria-label={compact ? "Control de volumen flotante" : "Control de volumen"}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );

  return (
    <footer className="relative z-20 border-t border-border bg-card px-3 sm:px-6 py-2 sm:py-3 backdrop-blur select-none">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onError={handleAudioError}
        onEnded={handleEnded}
        preload="auto"
      />

      {showQueue && (
        <div
          ref={queueRef}
          className="absolute bottom-full right-2 sm:right-6 mb-2 w-[calc(100vw-1rem)] sm:w-96 max-w-sm rounded-xl border border-border bg-popover text-popover-foreground p-4 shadow-2xl z-50"
        >
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cola de Reproducción ({queue.length})
            </h3>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="text-xs text-destructive hover:opacity-80"
              >
                Vaciar cola
              </button>
            )}
          </div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {queue.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No hay pistas en la cola
              </p>
            ) : (
              queue.map((item) => {
                const isCurrent = item.youtube_id === currentTrack?.youtube_id;
                return (
                  <div
                    key={item.youtube_id}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                      isCurrent
                        ? "bg-primary/15 text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(item)}
                      className="flex-1 truncate text-left"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="ml-2 text-muted-foreground">{item.artist}</span>
                    </button>
                    <ActionMenu
                      title="Opciones de la cola"
                      direction="down"
                      triggerClassName="h-6 w-6 ml-2 text-muted-foreground hover:text-foreground"
                      items={[
                        {
                          label: "Quitar de la cola",
                          icon: <Trash2 className="h-3.5 w-3.5" />,
                          variant: "danger",
                          onClick: () => removeFromQueue(item.youtube_id),
                        },
                      ]}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------
          LAYOUT COMPACTO (< 1024px o modo pantalla dividida) (lg:hidden)
          - Row 1: Nombre de la pista centrado arriba con desplazamiento lineal: [titulo] - [autor]
          - Row 2: Timer ocupando TODO el ancho disponible de la barra
          - Row 3: Debajo del timer: Portada a la izquierda (solo portada), controles al centro, sonido vertical y cola a la derecha
          ------------------------------------------------------------------------ */}
      <div className="flex flex-col lg:hidden w-full gap-1.5">
        {/* Row 1: Nombre de la canción encima del autor en la parte superior del reproductor */}
        <div
          onClick={currentTrack ? toggleNowPlayingExpanded : undefined}
          title={
            currentTrack ? "Ampliar vista de visualización (Now Playing)" : undefined
          }
          className={`flex flex-col items-center justify-center w-full px-2 text-center min-w-0 ${
            currentTrack ? "cursor-pointer group" : ""
          }`}
        >
          <ScrollableText
            text={displayTitle}
            containerClassName="w-full text-center"
            className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors"
          />
          <ScrollableText
            text={displayArtist}
            containerClassName="w-full text-center"
            className="text-[11px] text-muted-foreground"
          />
        </div>

        {/* Row 2: Timer ocupando todo el ancho disponible de la barra */}
        <div className="flex w-full items-center gap-2.5 text-xs text-muted-foreground">
          <span className="w-10 text-right font-mono text-[11px] tabular-nums">
            {formatDuration(displayTime)}
          </span>
          {renderProgressBar(true)}
          <span className="w-10 font-mono text-[11px] tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Row 3: Fila inferior de controles con grid cols-[1fr_max-content_1fr] para centrado exacto */}
        <div className="grid grid-cols-[1fr_max-content_1fr] items-center w-full pt-0.5">
          {/* Lado izquierdo: ÚNICAMENTE la portada */}
          <div className="flex items-center justify-start min-w-0">
            <div
              onClick={currentTrack ? toggleNowPlayingExpanded : undefined}
              title={
                currentTrack
                  ? "Ampliar vista de visualización (Now Playing)"
                  : undefined
              }
              className={`shrink-0 ${currentTrack ? "cursor-pointer group" : ""}`}
            >
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={currentTrack?.title ?? "Miniatura"}
                  className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover ring-1 ring-border group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:scale-105 transition-transform">
                  <Music className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              )}
            </div>
          </div>

          {/* Centro: Controles de reproducción principales exactamente centrados */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleRepeatMode}
              title={`Modo repetición: ${repeatMode}`}
              className={`hidden sm:inline-flex ${repeatMode !== "off" ? "text-primary" : ""}`}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={playPrevious}
              disabled={isPreviousDisabled}
              title="Anterior"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="primary"
              size="icon"
              onClick={togglePlayPause}
              disabled={!currentTrack}
              aria-label={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={playNext}
              disabled={isNextDisabled}
              title="Siguiente"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              title={`Aleatorio: ${isShuffle ? "Activado" : "Desactivado"}`}
              className={`hidden sm:inline-flex ${isShuffle ? "text-primary" : "text-muted-foreground"}`}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>

          {/* Lado derecho: Sonido vertical flotante + Cola + Pantalla Completa */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            {/* Control de volumen flotante VERTICAL al acercar el ratón (hover) */}
            <div
              className="relative"
              ref={volumePopoverRef}
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <Button
                variant={showVolumePopover ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setShowVolumePopover((prev) => !prev)}
                title={
                  isMuted
                    ? "Volumen silenciado (acercar ratón para regular)"
                    : `Volumen: ${Math.round(volumePercent)}%`
                }
                aria-label="Ajustar volumen"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>

              {/* Slider flotante VERTICAL */}
              {showVolumePopover && (
                <div
                  role="dialog"
                  aria-label="Ajuste de volumen vertical flotante"
                  onMouseEnter={handleVolumeMouseEnter}
                  onMouseLeave={handleVolumeMouseLeave}
                  className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 flex flex-col items-center gap-2 rounded-xl border border-border bg-popover py-3 px-2 text-popover-foreground shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                    {Math.round(volumePercent)}%
                  </span>

                  <div
                    className="relative flex h-24 w-6 cursor-pointer select-none items-center justify-center"
                    onPointerDown={handleVerticalVolumePointer}
                  >
                    <div className="relative h-full w-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary transition-none"
                        style={{ height: `${volumePercent}%` }}
                      />
                    </div>

                    <div
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-foreground shadow-md transition-none"
                      style={{ bottom: `${volumePercent}%`, marginBottom: "-5px" }}
                    />

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volumeValue}
                      onChange={handleVolumeInput}
                      aria-label="Control de volumen vertical"
                      aria-orientation="vertical"
                      className="absolute cursor-pointer opacity-0"
                      style={{
                        transform: "rotate(-90deg)",
                        width: "96px",
                        height: "24px",
                      }}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    title={isMuted ? "Reactivar audio" : "Silenciar"}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Botón de Cola de reproducción */}
            <Button
              variant={showQueue ? "secondary" : "ghost"}
              size="sm"
              data-queue-trigger="true"
              onClick={() => setShowQueue((prev) => !prev)}
              title="Mostrar cola de reproducción"
              className="px-2.5 h-8 flex items-center gap-1.5"
            >
              <ListMusic className="h-4 w-4" />
              <span className="text-xs font-medium">{queue.length}</span>
            </Button>

            {/* Botón de Pantalla Completa */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleNowPlayingExpanded}
              disabled={!currentTrack}
              title="Expandir visualizador a pantalla completa"
              className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------
          LAYOUT COMPLETO DE ESCRITORIO (>= 1024px) (hidden lg:flex)
          - Left: Portada + Título y Autor separados con marquee
          - Center: Centered Seek Bar + Controles
          - Right: Horizontal Volume Slider + Cola + Pantalla Completa
          ------------------------------------------------------------------------ */}
      <div className="hidden lg:flex items-center justify-between gap-6 w-full">
        {/* Track actual / Portada a la izquierda */}
        <div
          onClick={currentTrack ? toggleNowPlayingExpanded : undefined}
          title={
            currentTrack ? "Ampliar vista de visualización (Now Playing)" : undefined
          }
          className={`flex items-center gap-3 shrink-0 max-w-[280px] xl:max-w-[320px] ${
            currentTrack ? "cursor-pointer group" : ""
          }`}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={currentTrack?.title ?? "Miniatura"}
              className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:scale-105 transition-transform">
              <Music className="h-5 w-5" />
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1">
            <ScrollableText
              text={displayTitle}
              containerClassName="w-full"
              className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors"
            />
            <ScrollableText
              text={displayArtist}
              containerClassName="w-full"
              className="text-[11px] text-muted-foreground"
            />
          </div>
        </div>

        {/* Controles centrales: Timer arriba + Botones abajo */}
        <div className="flex flex-1 max-w-xl flex-col items-center justify-center gap-1.5">
          <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10 text-right tabular-nums">
              {formatDuration(displayTime)}
            </span>
            {renderProgressBar(false)}
            <span className="w-10 tabular-nums">{formatDuration(duration)}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleRepeatMode}
              title={`Modo repetición: ${repeatMode}`}
              className={repeatMode !== "off" ? "text-primary" : ""}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={playPrevious}
              disabled={isPreviousDisabled}
              title="Anterior"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="primary"
              size="icon"
              onClick={togglePlayPause}
              disabled={!currentTrack}
              aria-label={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={playNext}
              disabled={isNextDisabled}
              title="Siguiente"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              title={`Aleatorio: ${isShuffle ? "Activado" : "Desactivado"}`}
              className={isShuffle ? "text-primary" : "text-muted-foreground"}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Lado derecho: Selector horizontal de volumen + Cola + Pantalla Completa */}
        <div className="flex items-center justify-end gap-3 min-w-[240px]">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              title={isMuted ? "Reactivar audio" : "Silenciar"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>

            {renderVolumeSlider(false)}

            <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {Math.round(volumePercent)}%
            </span>
          </div>

          <Button
            variant={showQueue ? "secondary" : "ghost"}
            size="sm"
            data-queue-trigger="true"
            onClick={() => setShowQueue((prev) => !prev)}
            title="Mostrar cola de reproducción"
            className="px-2.5 h-8 flex items-center gap-1.5"
          >
            <ListMusic className="h-4 w-4" />
            <span className="text-xs font-medium">{queue.length}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleNowPlayingExpanded}
            disabled={!currentTrack}
            title="Expandir visualizador a pantalla completa"
            className="text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </footer>
  );
});
PersistentPlayer.displayName = "PersistentPlayer";
