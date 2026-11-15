import {
  ListMusic,
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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Primitives";
import { formatDuration, toAssetUrl } from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";
import { usePlayerStore } from "@/stores/usePlayerStore";

/**
 * Reproductor de audio persistente ubicado en la parte inferior de la aplicación (SDD 7.1).
 * Utiliza selectores granulares de Zustand para mantenerse desacoplado de la biblioteca visual (SDD 7.2).
 */
export const PersistentPlayer = React.memo(() => {
  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckKeyRef = useRef<"A" | "B">("A");
  const fadeAnimationRef = useRef<number | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const [showQueue, setShowQueue] = useState(false);

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

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
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

  const audioDataUrlCache = useRef<Map<string, string>>(new Map());

  // Referencias mutables para cálculo reactivo de volumen objetivo sin desincronizaciones
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
  }, [volume, isMuted]);

  const getTargetVolume = useCallback(() => {
    return isMutedRef.current ? 0 : volumeRef.current;
  }, []);

  const getActiveDeck = useCallback(() => {
    return activeDeckKeyRef.current === "A" ? deckARef.current : deckBRef.current;
  }, []);

  const getStandbyDeck = useCallback(() => {
    return activeDeckKeyRef.current === "A" ? deckBRef.current : deckARef.current;
  }, []);

  const cancelFade = useCallback(() => {
    if (fadeAnimationRef.current !== null) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }
  }, []);

  // Precargar de forma anticipada la siguiente pista de la cola en el deck en espera (standby deck)
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
        const standby =
          activeDeckKeyRef.current === "A" ? deckBRef.current : deckARef.current;

        const applyPreload = (src: string) => {
          if (standby && standby.src !== src) {
            standby.src = src;
            standby.volume = 0;
            standby.preload = "auto";
            standby.load();
          }
        };

        const cached = audioDataUrlCache.current.get(nextTrack.audio_path);
        if (cached) {
          applyPreload(cached);
        } else {
          tauriApi
            .readAudioDataUrl(nextTrack.audio_path)
            .then((dataUrl) => {
              if (dataUrl) {
                if (audioDataUrlCache.current.size >= 15) {
                  const oldestKey = audioDataUrlCache.current.keys().next().value;
                  if (oldestKey) {
                    audioDataUrlCache.current.delete(oldestKey);
                  }
                }
                audioDataUrlCache.current.set(nextTrack.audio_path, dataUrl);
                applyPreload(dataUrl);
              } else {
                applyPreload(toAssetUrl(nextTrack.audio_path));
              }
            })
            .catch(() => {
              applyPreload(toAssetUrl(nextTrack.audio_path));
            });
        }
      }
    }
  }, []);

  // Transición suave (crossfade) entre pistas y gestión de decks A/B
  useEffect(() => {
    let isCancelled = false;
    cancelFade();

    if (!currentTrack || currentTrack.is_missing) {
      const deckA = deckARef.current;
      const deckB = deckBRef.current;
      if (deckA) {
        deckA.pause();
        deckA.removeAttribute("src");
      }
      if (deckB) {
        deckB.pause();
        deckB.removeAttribute("src");
      }
      isTransitioningRef.current = false;
      return;
    }

    const outgoingDeck = getActiveDeck();
    const incomingDeckKey: "A" | "B" = activeDeckKeyRef.current === "A" ? "B" : "A";
    const incomingDeck = incomingDeckKey === "A" ? deckARef.current : deckBRef.current;

    const performTransition = async () => {
      // 1. Obtener URL de datos o asset de la nueva pista
      let src = audioDataUrlCache.current.get(currentTrack.audio_path);
      if (!src) {
        try {
          const dataUrl = await tauriApi.readAudioDataUrl(currentTrack.audio_path);
          if (dataUrl) {
            src = dataUrl;
            if (audioDataUrlCache.current.size >= 15) {
              const oldestKey = audioDataUrlCache.current.keys().next().value;
              if (oldestKey) {
                audioDataUrlCache.current.delete(oldestKey);
              }
            }
            audioDataUrlCache.current.set(currentTrack.audio_path, dataUrl);
          }
        } catch {
          // Fallback a toAssetUrl
        }
      }
      if (!src) {
        src = toAssetUrl(currentTrack.audio_path);
      }

      if (isCancelled) return;

      const shouldCrossfade =
        outgoingDeck &&
        !outgoingDeck.paused &&
        outgoingDeck.currentTime > 0 &&
        incomingDeck;

      if (shouldCrossfade && incomingDeck) {
        isTransitioningRef.current = true;
        // Asignar al deck entrante
        if (incomingDeck.src !== src) {
          incomingDeck.src = src;
          incomingDeck.load();
        }
        incomingDeck.currentTime = 0;
        incomingDeck.volume = 0;

        try {
          await incomingDeck.play();
        } catch {
          if (!isCancelled) setPlaying(false);
          isTransitioningRef.current = false;
          return;
        }

        if (isCancelled) return;

        // Animar crossfade de 400ms con curva de igual potencia
        const CROSSFADE_DURATION_MS = 400;
        const startTime = performance.now();

        const crossfadeStep = (now: number) => {
          if (isCancelled) return;
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / CROSSFADE_DURATION_MS);
          const currentTargetVol = getTargetVolume();

          // Curva de igual potencia (coseno / seno) para evitar caídas de volumen perceptibles
          const outVol = Math.max(
            0,
            Math.min(1, currentTargetVol * Math.cos((progress * Math.PI) / 2)),
          );
          const inVol = Math.max(
            0,
            Math.min(1, currentTargetVol * Math.sin((progress * Math.PI) / 2)),
          );

          if (outgoingDeck) outgoingDeck.volume = outVol;
          incomingDeck.volume = inVol;

          if (progress < 1) {
            fadeAnimationRef.current = requestAnimationFrame(crossfadeStep);
          } else {
            fadeAnimationRef.current = null;
            if (outgoingDeck) {
              outgoingDeck.pause();
              outgoingDeck.removeAttribute("src");
            }
            incomingDeck.volume = currentTargetVol;
            activeDeckKeyRef.current = incomingDeckKey;
            isTransitioningRef.current = false;
            // Precargar la siguiente canción en el deck ahora libre
            preloadNextTrack();
          }
        };

        fadeAnimationRef.current = requestAnimationFrame(crossfadeStep);
      } else {
        // Inicio directo o cambio en pausa sin crossfade requerido
        const targetDeck =
          incomingDeck && incomingDeck.src === src
            ? incomingDeck
            : (outgoingDeck ?? incomingDeck);
        if (targetDeck) {
          if (targetDeck === incomingDeck) {
            activeDeckKeyRef.current = incomingDeckKey;
          }
          if (targetDeck.src !== src) {
            targetDeck.src = src;
            targetDeck.load();
          }
          targetDeck.currentTime = 0;
          targetDeck.volume = getTargetVolume();

          if (usePlayerStore.getState().isPlaying) {
            void targetDeck.play().catch(() => {
              if (!isCancelled) setPlaying(false);
            });
          }
          preloadNextTrack();
        }
      }
    };

    void performTransition();

    return () => {
      isCancelled = true;
      cancelFade();
    };
  }, [
    currentTrack?.youtube_id,
    currentTrack?.audio_path,
    cancelFade,
    getActiveDeck,
    getTargetVolume,
    preloadNextTrack,
    setPlaying,
  ]);

  // Micro-fade suave (120ms) en transiciones manuales de Play / Pause para eliminar pops de audio
  useEffect(() => {
    const active = getActiveDeck();
    if (!active || !currentTrack || !active.src || isTransitioningRef.current) {
      return;
    }

    const FADE_TIME_MS = 120;

    if (isPlaying && active.paused) {
      // Micro-fade in
      active.volume = 0;
      void active
        .play()
        .then(() => {
          const startTime = performance.now();
          const stepIn = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / FADE_TIME_MS);
            const currentTgt = getTargetVolume();
            active.volume = Math.max(0, Math.min(1, currentTgt * progress));
            if (progress < 1 && usePlayerStore.getState().isPlaying) {
              requestAnimationFrame(stepIn);
            } else {
              active.volume = currentTgt;
            }
          };
          requestAnimationFrame(stepIn);
        })
        .catch(() => {
          setPlaying(false);
        });
    } else if (!isPlaying && !active.paused) {
      // Micro-fade out
      const startVol = active.volume;
      const startTime = performance.now();
      const stepOut = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / FADE_TIME_MS);
        active.volume = Math.max(0, Math.min(1, startVol * (1 - progress)));
        if (progress < 1 && !usePlayerStore.getState().isPlaying) {
          requestAnimationFrame(stepOut);
        } else {
          active.pause();
          active.volume = getTargetVolume();
        }
      };
      requestAnimationFrame(stepOut);
    }
  }, [isPlaying, currentTrack, getActiveDeck, getTargetVolume, setPlaying]);

  // Sincronizar volumen reactivo y modo silencio en decks
  useEffect(() => {
    if (fadeAnimationRef.current !== null) {
      return; // El loop de fade ajusta reactivamente según getTargetVolume()
    }
    const target = isMuted ? 0 : volume;
    const active = getActiveDeck();
    if (active) {
      active.volume = target;
      active.muted = isMuted;
    }
    const standby = getStandbyDeck();
    if (standby) {
      standby.volume = 0;
      standby.muted = isMuted;
    }
  }, [volume, isMuted, getActiveDeck, getStandbyDeck]);

  // Sincronizar operaciones de Seek manuales en el deck activo
  useEffect(() => {
    const audio = getActiveDeck();
    if (!audio || seekTarget === null) {
      return;
    }
    audio.currentTime = seekTarget;
    clearSeekTarget();
  }, [seekTarget, clearSeekTarget, getActiveDeck]);

  const handleTimeUpdate = useCallback(
    (deck: "A" | "B") => {
      if (activeDeckKeyRef.current === deck) {
        const audio = deck === "A" ? deckARef.current : deckBRef.current;
        if (audio) {
          setCurrentTime(audio.currentTime);
        }
      }
    },
    [setCurrentTime],
  );

  const handleLoadedMetadata = useCallback(
    (deck: "A" | "B") => {
      if (activeDeckKeyRef.current === deck) {
        const audio = deck === "A" ? deckARef.current : deckBRef.current;
        if (audio && Number.isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      }
    },
    [setDuration],
  );

  const handleEnded = useCallback(
    (deck: "A" | "B") => {
      if (activeDeckKeyRef.current === deck) {
        const repeat = usePlayerStore.getState().repeatMode;
        if (repeat === "one") {
          const audio = deck === "A" ? deckARef.current : deckBRef.current;
          if (audio) {
            audio.currentTime = 0;
            void audio.play();
          }
        } else {
          playNext();
        }
      }
    },
    [playNext],
  );

  const handleSeekInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seekTo(Number(e.target.value));
    },
    [seekTo],
  );

  const handleVolumeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(Number(e.target.value));
    },
    [setVolume],
  );

  const thumbnailSrc = toAssetUrl(currentTrack?.thumbnail_path);

  return (
    <footer className="relative z-20 border-t border-slate-800 bg-slate-900/95 px-6 py-3 backdrop-blur">
      {/* Decks duales A/B para crossfade fluido sin cortes y precarga continua (SDD 7.1) */}
      <audio
        ref={deckARef}
        onTimeUpdate={() => handleTimeUpdate("A")}
        onLoadedMetadata={() => handleLoadedMetadata("A")}
        onEnded={() => handleEnded("A")}
        preload="auto"
      />
      <audio
        ref={deckBRef}
        onTimeUpdate={() => handleTimeUpdate("B")}
        onLoadedMetadata={() => handleLoadedMetadata("B")}
        onEnded={() => handleEnded("B")}
        preload="auto"
      />

      {showQueue && (
        <div className="absolute bottom-full right-6 mb-2 w-96 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Cola de Reproducción ({queue.length})
            </h3>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Vaciar cola
              </button>
            )}
          </div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {queue.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
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
                        ? "bg-red-600/20 text-red-300"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(item)}
                      className="flex-1 truncate text-left"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="ml-2 text-slate-500">{item.artist}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromQueue(item.youtube_id)}
                      className="ml-2 text-slate-500 hover:text-rose-400"
                      title="Quitar de la cola"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-6">
        {/* Track actual */}
        <div className="flex min-w-[240px] max-w-[300px] items-center gap-3">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={currentTrack?.title ?? "Miniatura"}
              className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-700"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
              <Music className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">
              {currentTrack ? currentTrack.title : "Sin pista seleccionada"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {currentTrack
                ? `${currentTrack.artist} · .${currentTrack.file_extension}`
                : "Selecciona un track de la biblioteca"}
            </p>
          </div>
        </div>

        {/* Controles centrales + Barra de progreso */}
        <div className="flex max-w-xl flex-1 flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleRepeatMode}
              title={`Modo repetición: ${repeatMode}`}
              className={repeatMode !== "off" ? "text-red-400" : ""}
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
              disabled={!currentTrack}
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
              disabled={!currentTrack}
              title="Siguiente"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              title={`Aleatorio: ${isShuffle ? "Activado" : "Desactivado"}`}
              className={isShuffle ? "text-red-400" : "text-slate-400"}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex w-full items-center gap-3 text-xs text-slate-400">
            <span className="w-10 text-right tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.5}
              value={currentTime}
              onChange={handleSeekInput}
              disabled={!currentTrack}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-red-500"
            />
            <span className="w-10 tabular-nums">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Volumen y Cola */}
        <div className="flex min-w-[200px] items-center justify-end gap-3">
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

          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeInput}
            aria-label="Volumen"
            className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-red-500"
          />

          <Button
            variant={showQueue ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowQueue((prev) => !prev)}
            title="Mostrar cola de reproducción"
          >
            <ListMusic className="h-4 w-4" />
            <span>{queue.length}</span>
          </Button>
        </div>
      </div>
    </footer>
  );
});
PersistentPlayer.displayName = "PersistentPlayer";
