import { Activity, Music2 } from "lucide-react";
import React, { useMemo } from "react";
import { toAssetUrl } from "@/lib/utils";
import { useAudioDynamics } from "../hooks/useAudioDynamics";
import type { VisualizerProps } from "../types";

/**
 * Visualizador de Barras Dinámicas de Espectro (Equalizer Spectrum).
 * Representa la dinámica y frecuencias del audio en tiempo real mediante barras verticales
 * reactivas con gradiente de color del tema, picos de amortiguación y reflejo inferior.
 */
export const SpectrumVisualizer: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, volume, audioElement, isExpanded = false }) => {
    const barCount = isExpanded ? 36 : 24;
    const frequencyData = useAudioDynamics(audioElement, isPlaying, volume, barCount);

    const thumbnailSrc = useMemo(() => {
      return track?.thumbnail_path ? toAssetUrl(track.thumbnail_path) : null;
    }, [track?.thumbnail_path]);

    return (
      <div className="relative flex flex-col items-center justify-center p-6 select-none overflow-hidden w-full max-w-4xl">
        {/* Halo reactivo al promedio de frecuencias */}
        <div
          className={`absolute h-72 w-72 rounded-full bg-primary blur-3xl transition-opacity duration-300 ${
            isPlaying ? "opacity-20 scale-105" : "opacity-5 scale-90"
          }`}
          aria-hidden="true"
        />

        {/* Tarjeta de Miniatura flotante compacta superior */}
        <div className="relative z-10 mb-8 flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-xl backdrop-blur-md">
          <div className="h-16 w-16 overflow-hidden rounded-xl bg-muted border border-border shrink-0 shadow-inner">
            {thumbnailSrc ? (
              <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <Music2 className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 pr-3">
            <h4 className="text-sm font-bold text-foreground truncate max-w-xs">
              {track?.title || "Sin pista activa"}
            </h4>
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {track?.artist || "Your Tracks Music Server"}
            </p>
          </div>
        </div>

        {/* Contenedor del Ecualizador de Espectro */}
        <div className="relative z-10 flex items-end justify-center gap-1.5 sm:gap-2 h-44 sm:h-56 w-full px-4">
          {frequencyData.map((val, idx) => {
            const heightPercent = Math.max(4, Math.min(94, Math.round(val * 100)));
            return (
              <div
                key={idx}
                className="relative flex flex-col items-center justify-end h-full flex-1 max-w-[18px]"
              >
                {/* Marcador de pico superior */}
                <div
                  className="w-full h-1 rounded-full bg-foreground shadow-xs transition-transform duration-75 mb-1"
                  style={{
                    transform: `translateY(-${Math.max(0, heightPercent - 4)}%)`,
                    opacity: val > 0.1 ? 0.9 : 0.3,
                  }}
                />

                {/* Barra vertical principal con gradiente del tema */}
                <div
                  className="w-full rounded-t-md bg-primary transition-all duration-75 shadow-xs"
                  style={{
                    height: `${heightPercent}%`,
                  }}
                />

                {/* Reflejo inferior atenuado */}
                <div
                  className="w-full rounded-b-md bg-primary opacity-20 transition-all duration-75 blur-[0.5px] mt-1"
                  style={{
                    height: `${Math.round(heightPercent * 0.28)}%`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Indicador de estado */}
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Activity
            className={`h-4 w-4 text-primary ${isPlaying ? "animate-pulse" : ""}`}
          />
          <span className="text-[11px] uppercase tracking-wider">
            {isPlaying ? "Espectro de frecuencia reactivo (36 bandas)" : "En pausa"}
          </span>
        </div>
      </div>
    );
  },
);

SpectrumVisualizer.displayName = "SpectrumVisualizer";

/**
 * Previsualización compacta para Ajustes -> Personalización.
 */
export const SpectrumPreview: React.FC<VisualizerProps> = React.memo(
  ({ isPlaying, volume, audioElement }) => {
    const bars = useAudioDynamics(audioElement, isPlaying, volume, 12);

    return (
      <div className="group relative flex h-28 w-28 flex-col items-center justify-center rounded-2xl border border-border bg-card p-3 shadow-inner">
        <div className="flex items-end justify-center gap-1 h-14 w-full">
          {bars.map((val, idx) => {
            const h = Math.max(8, Math.round(val * 100));
            return (
              <div
                key={idx}
                className="w-1.5 rounded-t-sm bg-primary transition-all duration-75"
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <span className="mt-2 text-[10px] font-mono text-muted-foreground">EQ</span>
      </div>
    );
  },
);

SpectrumPreview.displayName = "SpectrumPreview";
