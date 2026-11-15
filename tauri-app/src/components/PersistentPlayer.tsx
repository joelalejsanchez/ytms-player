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
import { ActionMenu } from "@/components/ui/ActionMenu";
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
  const isLoadingTrack = usePlayerStore((s) => s.isLoadingTrack);

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

  const audioDataUrlCache = useRef<Map<string, string>>(new Map());
  const isChangingTrackRef = useRef(false);
  const currentTrackIdRef = useRef<string | null>(null);
  const prevIsPlayingRef = useRef(isPlaying);

  // Referencias para cálculo reactivo de volumen objetivo
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
  }, [volume, isMuted]);

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

  // Sincronizar cambio de pista
  useEffect(() => {
    let isCancelled = false;
    cancelFade();

    const audio = audioRef.current;
    if (!audio) return;

    // Pausar de inmediato la reproducción previa para silenciarla y detener el contador de tiempo
    audio.pause();

    if (!currentTrack || currentTrack.is_missing) {
      audio.removeAttribute("src");
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
        let src = audioDataUrlCache.current.get(currentTrack.audio_path);
        if (!src) {
          try {
            const dataUrl = await tauriApi.readAudioDataUrl(currentTrack.audio_path);
            if (dataUrl) {
              src = dataUrl;
              if (audioDataUrlCache.current.size >= 15) {
                const oldestKey = audioDataUrlCache.current.keys().next().value;
                if (oldestKey) audioDataUrlCache.current.delete(oldestKey);
              }
              audioDataUrlCache.current.set(currentTrack.audio_path, dataUrl);
            }
          } catch (err) {
            console.warn("readAudioDataUrl warning, falling back to toAssetUrl:", err);
          }
        }

        if (!src) {
          src = toAssetUrl(currentTrack.audio_path);
        }

        if (
          isCancelled ||
          !audioRef.current ||
          currentTrackIdRef.current !== currentTrack.youtube_id
        ) {
          return;
        }

        audio.src = src;
        audio.currentTime = 0;

        const tgtVol = getTargetVolume();
        audio.volume = tgtVol;
        audio.muted = isMutedRef.current;

        if (usePlayerStore.getState().isPlaying) {
          await audio.play();
        }
        preloadNextTrack();
      } catch (err) {
        if (!isCancelled && currentTrackIdRef.current === currentTrack.youtube_id) {
          console.error("Error al iniciar reproducción:", err);
          setPlaying(false);
          setIsLoadingTrack(false);
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
      audio.play().catch(() => {
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
  }, [setIsLoadingTrack]);

  const handleAudioError = useCallback(() => {
    setIsLoadingTrack(false);
  }, [setIsLoadingTrack]);

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
      if (isLoadingTrack || !currentTrack) return;
      seekTo(Number(e.target.value));
    },
    [isLoadingTrack, currentTrack, seekTo],
  );

  const handleVolumeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(Number(e.target.value));
    },
    [setVolume],
  );

  const thumbnailSrc = toAssetUrl(currentTrack?.thumbnail_path);

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const volumeValue = isMuted ? 0 : volume;
  const volumePercent = Math.min(100, Math.max(0, volumeValue * 100));

  return (
    <footer className="relative z-20 border-t border-border bg-card px-6 py-3 backdrop-blur">
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
        <div className="absolute bottom-full right-6 mb-2 w-96 rounded-xl border border-border bg-popover text-popover-foreground p-4 shadow-2xl">
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

      <div className="flex items-center justify-between gap-6">
        {/* Track actual */}
        <div className="flex min-w-[240px] max-w-[300px] items-center gap-3">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={currentTrack?.title ?? "Miniatura"}
              className="h-12 w-12 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Music className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {currentTrack ? currentTrack.title : "Sin pista seleccionada"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
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
              className={isShuffle ? "text-primary" : "text-muted-foreground"}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10 text-right tabular-nums">
              {formatDuration(currentTime)}
            </span>

            {/* Barra de progreso de pista con bloqueo durante carga de track, relleno exacto e indicador dinámico */}
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
                    isLoadingTrack
                      ? "bg-muted-foreground/40 animate-pulse"
                      : "bg-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Indicador / Thumb pequeño que crece cuando el ratón se acerca (bloqueado durante carga) */}
              <div
                className={`pointer-events-none absolute h-2 w-2 -translate-x-1/2 rounded-full shadow-md transition-all duration-150 ${
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
                value={currentTime}
                onChange={handleSeekInput}
                disabled={!currentTrack || isLoadingTrack}
                aria-label="Progreso de la canción"
                aria-disabled={!currentTrack || isLoadingTrack}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed disabled:pointer-events-none"
              />
            </div>

            <span className="w-10 tabular-nums">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Volumen y Cola */}
        <div className="flex min-w-[240px] items-center justify-end gap-3">
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

          {/* Selector de volumen con relleno visual exacto e indicador dinámico */}
          <div className="group relative flex h-4 w-28 cursor-pointer select-none items-center">
            {/* Pista de fondo */}
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover:h-1.5">
              {/* Relleno hasta el valor de volumen */}
              <div
                className="h-full bg-primary transition-none"
                style={{ width: `${volumePercent}%` }}
              />
            </div>

            {/* Indicador / Thumb pequeño que crece al acercar el ratón */}
            <div
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 rounded-full bg-foreground shadow-md transition-all duration-150 group-hover:h-3.5 group-hover:w-3.5 group-hover:bg-primary"
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
              aria-label="Control de volumen"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
            {Math.round(volumePercent)}%
          </span>

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
