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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Primitives";
import { usePlayerControlTooltips } from "@/hooks/usePlayerControlTooltips";
import { formatDuration, toAssetUrl } from "@/lib/utils";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useCoverDominantColor } from "../hooks/useCoverDominantColor";
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

  const currentTrackFromPlayer = usePlayerStore((s) => s.currentTrack);
  const liveTrackFromLibrary = useLibraryStore(
    useCallback(
      (s) => s.tracks.find((t) => t.youtube_id === currentTrackFromPlayer?.youtube_id),
      [currentTrackFromPlayer?.youtube_id],
    ),
  );
  const currentTrack = liveTrackFromLibrary ?? currentTrackFromPlayer;
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
  const syncStatusByTrack = useLibraryStore((s) => s.syncStatusByTrack);

  const activeVisualizerId = useVisualizerStore((s) => s.activeVisualizerId);

  // Tooltips contextuales dinámicos y estados de bloqueo condicional
  const {
    isNextDisabled,
    isPreviousDisabled,
    nextTooltip,
    previousTooltip,
    playPauseTooltip,
    repeatTooltip,
    shuffleTooltip,
  } = usePlayerControlTooltips();

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

  // Estado unificado de Like y Sincronización con YouTube (idéntico a la vista general TrackRow)
  const syncStatus = currentTrack
    ? syncStatusByTrack[currentTrack.youtube_id]
    : undefined;
  const isLocal = currentTrack?.origin === "local";
  const isSyncingLike = !isLocal && syncStatus?.status === "loading";
  const isSynced =
    !isLocal && Boolean(currentTrack?.synced || syncStatus?.status === "synced");

  const likeButtonTitle = !currentTrack
    ? ""
    : isLocal
      ? currentTrack.liked
        ? "Me gusta (Archivo local)"
        : "Sin Me gusta (Archivo local)"
      : isSyncingLike
        ? "Sincronizando con YouTube..."
        : currentTrack.liked
          ? isSynced
            ? "Me gusta (Sincronizado con YouTube)"
            : "Me gusta (Guardado local / No sincronizado)"
          : isSynced
            ? "Sin Me gusta (Sincronizado con YouTube)"
            : "Sin Me gusta (Guardado local / No sincronizado)";

  const heartIconClass = !currentTrack
    ? ""
    : isSynced
      ? currentTrack.liked
        ? "fill-rose-500 text-rose-500" // Rellenado rojo (sincronizado)
        : "text-rose-500 hover:fill-rose-500/20" // Borde rojo (sincronizado)
      : currentTrack.liked
        ? "fill-muted-foreground text-muted-foreground" // Rellenado gris (local)
        : "text-muted-foreground/60 hover:text-muted-foreground hover:fill-muted-foreground/20"; // Borde gris (local)

  // Extraer color dominante de la carátula para iluminación ambiental en el fondo del visualizador
  const thumbnailSrc = useMemo(() => {
    return currentTrack?.thumbnail_path
      ? toAssetUrl(currentTrack.thumbnail_path)
      : null;
  }, [currentTrack?.thumbnail_path]);
  const dominantColor = useCoverDominantColor(thumbnailSrc);

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
      <main className="relative flex flex-1 items-center justify-center p-4 min-h-0 overflow-hidden">
        {/* Iluminación ambiental reactiva exclusiva para el fondo del visualizador */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-out"
          style={{
            background: dominantColor
              ? `radial-gradient(circle at 50% 45%, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.38) 0%, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.12) 50%, transparent 80%)`
              : "radial-gradient(circle at 50% 45%, rgba(var(--primary-rgb, 59, 130, 246), 0.12) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

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
              Selecciona una canción de tu biblioteca para activar la visualización
              interactiva.
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
                {currentTrack?.artist || "Your Tracks Music Server"}
              </p>
            </div>

            {currentTrack && (
              <Button
                variant="ghost"
                size="icon"
                disabled={isSyncingLike}
                onClick={() =>
                  void toggleLike(currentTrack.youtube_id, !currentTrack.liked)
                }
                title={likeButtonTitle}
                className={`shrink-0 h-10 w-10 transition-colors ${
                  !currentTrack.liked && isSynced ? "hover:bg-emerald-500/10" : ""
                }`}
              >
                {isSyncingLike ? (
                  <Heart className="h-6 w-6 text-amber-500 fill-amber-500/40 animate-heart-pulse transform-gpu" />
                ) : (
                  <Heart className={`h-6 w-6 transition-colors ${heartIconClass}`} />
                )}
              </Button>
            )}
          </div>

          {/* Barra de Tiempo (Ubicada por encima de los controles) */}
          <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
            <span className="w-12 text-right tabular-nums font-mono">
              {formatDuration(displayTime)}
            </span>

            {/* Barra de progreso de pista con fondo sólido visible al 100% */}
            <div
              className={`group relative flex h-4 flex-1 select-none items-center ${
                !currentTrack || isLoadingTrack
                  ? "cursor-not-allowed opacity-50 pointer-events-none"
                  : "cursor-pointer"
              }`}
              title={isLoadingTrack ? "Cargando pista..." : undefined}
            >
              {/* Fondo sólido visible de la barra completa */}
              <div
                style={{ backgroundColor: "var(--muted)" }}
                className="relative h-1 w-full overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover:h-1.5"
              >
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

              {/* Indicador / Thumb dinámico */}
              <div
                className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full shadow-md transition-none ${
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
                aria-label="Progreso de la canción"
                aria-disabled={!currentTrack || isLoadingTrack}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed disabled:pointer-events-none"
              />
            </div>

            <span className="w-12 tabular-nums font-mono">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Fila de Controles de Reproducción y Volumen */}
          <div className="flex w-full items-center justify-between gap-4 pt-1">
            {/* Espaciador izquierdo para centrar controles principales simétricamente */}
            <div className="hidden sm:block min-w-[200px]" />

            {/* Controles Principales Centrados */}
            <div className="flex items-center gap-4 sm:gap-6 mx-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleRepeatMode}
                title={repeatTooltip}
                className={
                  repeatMode !== "off" ? "text-primary" : "text-muted-foreground"
                }
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
                disabled={isPreviousDisabled}
                title={previousTooltip}
                className="h-10 w-10 text-foreground"
              >
                <SkipBack className="h-6 w-6" />
              </Button>

              <Button
                variant="primary"
                size="icon"
                onClick={togglePlayPause}
                disabled={!currentTrack}
                title={playPauseTooltip}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                className="h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={playNext}
                disabled={isNextDisabled}
                title={nextTooltip}
                className="h-10 w-10 text-foreground"
              >
                <SkipForward className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleShuffle}
                title={shuffleTooltip}
                className={isShuffle ? "text-primary" : "text-muted-foreground"}
              >
                <Shuffle className="h-5 w-5" />
              </Button>
            </div>

            {/* Control de Volumen en Esquina Derecha con estilos unificados */}
            <div className="hidden sm:flex min-w-[200px] items-center justify-end gap-3 text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                title={isMuted ? "Reactivar audio" : "Silenciar"}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>

              {/* Selector de volumen con relleno visual exacto en color primario e indicador dinámico */}
              <div className="group relative flex h-4 w-24 cursor-pointer select-none items-center">
                {/* Pista de fondo sólida */}
                <div
                  style={{ backgroundColor: "var(--muted)" }}
                  className="relative h-1 w-full overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover:h-1.5"
                >
                  {/* Relleno hasta el valor de volumen con color primario del tema */}
                  <div
                    className="h-full bg-primary transition-none"
                    style={{ width: `${volumePercent}%` }}
                  />
                </div>

                {/* Indicador / Thumb pequeño que crece al acercar el ratón */}
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
                  aria-label="Control de volumen"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>

              <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {Math.round(volumePercent)}%
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
