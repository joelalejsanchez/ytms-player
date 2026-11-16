import { AudioWaveform, Music2 } from "lucide-react";
import React, { useMemo } from "react";
import { toAssetUrl } from "@/lib/utils";
import { useAudioDynamics } from "../hooks/useAudioDynamics";
import type { VisualizerProps } from "../types";

/**
 * Visualizador de Carátula con Ondas Sonoras (Cover & Waveforms).
 * Muestra la portada estática de la canción en un cuadro enmarcado moderno
 * y ondas visuales directamente debajo que representan la dinámica del sonido.
 */
export const CoverWavesVisualizer: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, volume, audioElement, isExpanded = false }) => {
    const waveCount = isExpanded ? 32 : 20;
    const waveData = useAudioDynamics(audioElement, isPlaying, volume, waveCount);

    const thumbnailSrc = useMemo(() => {
      return track?.thumbnail_path ? toAssetUrl(track.thumbnail_path) : null;
    }, [track?.thumbnail_path]);

    return (
      <div className="relative flex flex-col items-center justify-center p-6 select-none overflow-hidden max-w-lg w-full">
        {/* Resplandor ambiental suave detrás del cuadro */}
        <div
          className={`absolute h-72 w-72 rounded-full bg-primary blur-3xl transition-opacity duration-700 ${
            isPlaying ? "opacity-15 scale-105" : "opacity-5 scale-90"
          }`}
          aria-hidden="true"
        />

        {/* Portada estática en cuadro enmarcado */}
        <div
          className={`relative z-10 overflow-hidden rounded-3xl border-2 border-border bg-card shadow-2xl transition-all duration-300 ${
            isExpanded
              ? "h-64 w-64 sm:h-72 sm:w-72"
              : "h-52 w-52"
          }`}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={track?.title || "Carátula"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-6 text-center text-muted-foreground">
              <Music2 className="h-12 w-12 text-primary/70 mb-2" />
              <p className="text-sm font-semibold truncate max-w-[180px]">
                {track?.title || "ytms-player"}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {track?.artist || "YouTube Desktop"}
              </p>
            </div>
          )}
        </div>

        {/* Ondas sonoras visuales directamente debajo de la carátula */}
        <div className="relative z-10 mt-6 flex items-center justify-center gap-1.5 h-16 w-full max-w-xs sm:max-w-sm px-4">
          {waveData.map((val, idx) => {
            // Altura simétrica centrada tipo onda sonora de voz/música
            const heightPercent = Math.max(8, Math.round(val * 100));
            return (
              <div
                key={idx}
                className="flex items-center justify-center h-full flex-1"
              >
                <div
                  className="w-full max-w-[6px] rounded-full bg-primary shadow-xs transition-all duration-75"
                  style={{
                    height: `${heightPercent}%`,
                    opacity: isPlaying ? 0.4 + val * 0.6 : 0.2,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Indicador de estado */}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <AudioWaveform className={`h-4 w-4 text-primary ${isPlaying ? "animate-pulse" : ""}`} />
          <span className="text-[11px] uppercase tracking-wider">
            {isPlaying ? "Ondas de sonido reactivas" : "En pausa"}
          </span>
        </div>
      </div>
    );
  },
);

CoverWavesVisualizer.displayName = "CoverWavesVisualizer";

/**
 * Previsualización compacta para Ajustes -> Personalización.
 */
export const CoverWavesPreview: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, volume, audioElement }) => {
    const waves = useAudioDynamics(audioElement, isPlaying, volume, 10);
    const thumbnailSrc = track?.thumbnail_path
      ? toAssetUrl(track.thumbnail_path)
      : null;

    return (
      <div className="group relative flex h-28 w-28 flex-col items-center justify-center rounded-2xl border border-border bg-card p-2 shadow-inner">
        {/* Mini cuadro */}
        <div className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted shadow-xs">
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary">
              <Music2 className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Mini ondas debajo */}
        <div className="mt-2 flex items-center justify-center gap-0.5 h-6 w-full px-2">
          {waves.map((val, idx) => (
            <div
              key={idx}
              className="w-1 rounded-full bg-primary transition-all duration-75"
              style={{ height: `${Math.max(15, Math.round(val * 100))}%` }}
            />
          ))}
        </div>
      </div>
    );
  },
);

CoverWavesPreview.displayName = "CoverWavesPreview";
