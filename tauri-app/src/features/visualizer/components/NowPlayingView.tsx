import {
  ChevronDown,
  Heart,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Primitives";
import { formatDuration } from "@/lib/utils";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { visualizerRegistry } from "../registry";
import { useVisualizerStore } from "../useVisualizerStore";

/**
 * Vista de Pantalla Completa de la Aplicación (Now Playing View).
 * Despliega el visualizador animado seleccionado en la parte superior
 * y los controles de reproducción centrados en la parte inferior, con
 * la barra de tiempo posicionada por encima de los botones.
 */
export const NowPlayingView: React.FC = () => {
  const isNowPlayingExpanded = usePlayerStore((s) => s.isNowPlayingExpanded);
  const setNowPlayingExpanded = usePlayerStore((s) => s.setNowPlayingExpanded);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const duration = usePlayerStore((s) => s.duration);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const isLoadingTrack = usePlayerStore((s) => s.isLoadingTrack);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrevious = usePlayerStore((s) => s.playPrevious);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const activeVisualizerId = useVisualizerStore((s) => s.activeVisualizerId);

  // Estado local para scrubbing de tiempo fluido a 60 FPS
  const [isSeekingLocally, setIsSeekingLocally] = useState(false);
  const [localSeekTime, setLocalSeekTime] = useState(0);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isNowPlayingExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNowPlayingExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNowPlayingExpanded, setNowPlayingExpanded]);

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isLoadingTrack || !currentTrack) return;
      setLocalSeekTime(Number(e.target.value));
      setIsSeekingLocally(true);
    },
    [isLoadingTrack, currentTrack],
  );

  const handleSeekCommit = useCallback(() => {
    if (isSeekingLocally && !isLoadingTrack) {
      setIsSeekingLocally(false);
      seekTo(localSeekTime);
    }
  }, [isSeekingLocally, localSeekTime, seekTo, isLoadingTrack]);

  const handleVolumeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(Number(e.target.value));
    },
    [setVolume],
  );

  const activeModule =
    visualizerRegistry.get(activeVisualizerId) || visualizerRegistry.get("vinyl")!;
  const ActiveVisualizerComponent = activeModule.Component;

  const displayTime = isSeekingLocally ? localSeekTime : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const volumeValue = isMuted ? 0 : volume;
  const volumePercent = Math.min(100, Math.max(0, volumeValue * 100));

  const isLiked = Boolean(currentTrack?.liked);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista En Reproducción a Pantalla Completa"
      style={{ backgroundColor: "var(--background)" }}
      className={`fixed inset-0 z-40 flex flex-col bg-background text-foreground transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
        isNowPlayingExpanded
          ? "translate-y-0 opacity-100 pointer-events-auto shadow-2xl"
          : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      {/* Barra Superior de la Vista Expandida con fondo sólido y borde */}
      <header
        style={{ backgroundColor: "var(--card)" }}
        className="flex items-center justify-between px-8 py-5 border-b border-border bg-card"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNowPlayingExpanded(false)}
          title="Minimizar vista (Esc)"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-5 w-5" />
          <span className="text-xs font-semibold">Minimizar</span>
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold tracking-widest text-primary uppercase">
            Vista En Reproducción
          </span>
          <span className="text-xs text-muted-foreground">
            {activeModule.metadata.name}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNowPlayingExpanded(false)}
          title="Cerrar (Esc)"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      {/* Área Central: Visualizador Animado Activo */}
      <main className="flex flex-1 items-center justify-center p-4 min-h-0 overflow-hidden">
        {currentTrack ? (
          <ActiveVisualizerComponent
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={displayTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            isExpanded={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <Music className="h-16 w-16 mb-4 text-muted-foreground/40 animate-pulse" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No hay música en reproducción
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Selecciona una canción de tu biblioteca para activar la visualización interactiva.
            </p>
          </div>
        )}
      </main>

      {/* Área Inferior: Metadatos y Controles Centrados con fondo sólido */}
      <footer
        style={{ backgroundColor: "var(--card)" }}
        className="w-full border-t border-border bg-card px-8 py-6 shadow-lg"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4">
          {/* Título, Artista y Acción de Like */}
          <div className="flex w-full items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {currentTrack?.title || "Sin pista activa"}
              </h2>
              <p className="text-sm font-medium text-muted-foreground truncate">
                {currentTrack?.artist || "YouTube Desktop Player"}
              </p>
            </div>

            {currentTrack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void toggleLike(currentTrack.youtube_id, currentTrack.liked)}
                title={isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
                className="shrink-0 h-10 w-10"
              >
                <Heart
                  className={`h-6 w-6 transition-transform hover:scale-110 active:scale-90 ${
                    isLiked
                      ? "fill-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                />
              </Button>
            )}
          </div>

          {/* Barra de Tiempo (Ubicada por encima de los controles) */}
          <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
            <span className="w-12 text-right tabular-nums font-mono">
              {formatDuration(displayTime)}
            </span>

            <div
              className={`group relative flex h-5 flex-1 select-none items-center ${
                !currentTrack || isLoadingTrack
                  ? "cursor-not-allowed opacity-50 pointer-events-none"
                  : "cursor-pointer"
              }`}
            >
              {/* Fondo del carril */}
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/80 transition-all group-hover:h-2">
                <div
                  className={`h-full transition-none ${
                    isLoadingTrack ? "bg-muted-foreground/40 animate-pulse" : "bg-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Indicador / Thumb de posición */}
              <div
                className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full shadow-md transition-all duration-150 ${
                  isLoadingTrack
                    ? "bg-muted-foreground opacity-40"
                    : "bg-foreground group-hover:h-4 group-hover:w-4 group-hover:bg-primary"
                }`}
                style={{ left: `${progressPercent}%` }}
              />

              {/* Input range transparente */}
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
                aria-label="Progreso de la canción"
                aria-disabled={!currentTrack || isLoadingTrack}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed disabled:pointer-events-none"
              />
            </div>

            <span className="w-12 tabular-nums font-mono">{formatDuration(duration)}</span>
          </div>

          {/* Fila de Controles de Reproducción y Volumen */}
          <div className="flex w-full items-center justify-between gap-4 pt-1">
            {/* Espaciador izquierdo para centrar controles */}
            <div className="hidden sm:block w-36" />

            {/* Controles Principales Centrados */}
            <div className="flex items-center gap-4 sm:gap-6 mx-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleRepeatMode}
                title={`Repetición: ${repeatMode}`}
                className={repeatMode !== "off" ? "text-primary" : "text-muted-foreground"}
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="h-5 w-5" />
                ) : (
                  <Repeat className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={playPrevious}
                disabled={!currentTrack}
                title="Pista anterior"
                className="h-10 w-10 text-foreground"
              >
                <SkipBack className="h-6 w-6" />
              </Button>

              <Button
                variant="primary"
                size="icon"
                onClick={togglePlayPause}
                disabled={!currentTrack}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                className="h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={playNext}
                disabled={!currentTrack}
                title="Pista siguiente"
                className="h-10 w-10 text-foreground"
              >
                <SkipForward className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleShuffle}
                title={`Aleatorio: ${isShuffle ? "Activado" : "Desactivado"}`}
                className={isShuffle ? "text-primary" : "text-muted-foreground"}
              >
                <Shuffle className="h-5 w-5" />
              </Button>
            </div>

            {/* Control de Volumen en Esquina Derecha */}
            <div className="hidden sm:flex w-36 items-center justify-end gap-2 text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                title={isMuted ? "Reactivar sonido" : "Silenciar"}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>

              <div className="relative flex h-3 w-20 items-center">
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${volumePercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumeValue}
                  onChange={handleVolumeInput}
                  aria-label="Volumen"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
