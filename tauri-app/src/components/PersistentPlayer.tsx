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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeAnimationRef = useRef<number | null>(null);
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

  // Referencias para cálculo reactivo de volumen objetivo
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
  }, [volume, isMuted]);

  const getTargetVolume = useCallback(() => {
    return isMutedRef.current ? 0 : volumeRef.current;
  }, []);

  const cancelFade = useCallback(() => {
    if (fadeAnimationRef.current !== null) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }
  }, []);

  // Precargar de forma anticipada la siguiente pista de la cola en caché de memoria
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
      if (
        nextTrack &&
        !nextTrack.is_missing &&
        !audioDataUrlCache.current.has(nextTrack.audio_path)
      ) {
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
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Sincronizar cambio de pista con micro-fade suave y garantía total de volumen activo
  useEffect(() => {
    let isCancelled = false;
    cancelFade();

    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack || currentTrack.is_missing) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }

    const loadAndPlayTrack = () => {
      if (isCancelled || !audioRef.current) return;

      const src = toAssetUrl(currentTrack.audio_path);
      if (!src) return;

      audio.src = src;
      audio.currentTime = 0;

      const tgtVol = getTargetVolume();
      audio.volume = tgtVol;
      audio.muted = isMutedRef.current;

      if (usePlayerStore.getState().isPlaying) {
        audio.play().catch(() => {
          if (!isCancelled) setPlaying(false);
        });
      }
      preloadNextTrack();
    };

    loadAndPlayTrack();

    return () => {
      isCancelled = true;
      cancelFade();
    };
  }, [
    currentTrack?.youtube_id,
    currentTrack?.audio_path,
    cancelFade,
    getTargetVolume,
    preloadNextTrack,
    setPlaying,
  ]);

  // Sincronizar manual play / pause con micro-fade de 70ms
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || !audio.src) {
      return;
    }

    const FADE_TIME_MS = 70;
    const targetVol = getTargetVolume();

    if (isPlaying && audio.paused) {
      audio.volume = 0;
      audio.muted = isMutedRef.current;
      void audio.play().then(() => {
        const startTime = performance.now();
        const stepIn = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / FADE_TIME_MS);
          const currentTgt = getTargetVolume();
          audio.volume = Math.max(0, Math.min(1, currentTgt * progress));
          if (progress < 1 && usePlayerStore.getState().isPlaying) {
            requestAnimationFrame(stepIn);
          } else {
            audio.volume = currentTgt;
          }
        };
        requestAnimationFrame(stepIn);
      }).catch(() => {
        setPlaying(false);
        audio.volume = targetVol;
      });
    } else if (!isPlaying && !audio.paused) {
      const startVol = audio.volume;
      const startTime = performance.now();
      const stepOut = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / FADE_TIME_MS);
        audio.volume = Math.max(0, Math.min(1, startVol * (1 - progress)));
        if (progress < 1 && !usePlayerStore.getState().isPlaying) {
          requestAnimationFrame(stepOut);
        } else {
          audio.pause();
          audio.volume = getTargetVolume();
        }
      };
      requestAnimationFrame(stepOut);
    }
  }, [isPlaying, currentTrack, getTargetVolume, setPlaying]);

  // Sincronizar volumen reactivo y modo silencio en todo momento
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeAnimationRef.current === null) {
      audio.volume = isMuted ? 0 : volume;
      audio.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Sincronizar operaciones de Seek manuales
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTarget === null) {
      return;
    }
    audio.currentTime = seekTarget;
    clearSeekTarget();
  }, [seekTarget, clearSeekTarget]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  }, [setDuration]);

  const handleEnded = useCallback(() => {
    const repeat = usePlayerStore.getState().repeatMode;
    if (repeat === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
    } else {
      playNext();
    }
  }, [playNext]);

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
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
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
