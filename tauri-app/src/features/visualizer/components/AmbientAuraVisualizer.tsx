import { Music2, Sparkles } from "lucide-react";
import React, { useMemo } from "react";
import { toAssetUrl } from "@/lib/utils";
import { useAudioDynamics } from "../hooks/useAudioDynamics";
import type { VisualizerProps } from "../types";

/**
 * Visualizador de Aura Líquida / Onda Resonante Ambiental.
 * Crea anillos orgánicos fluidos concéntricos y ondas de resplandor ambiental
 * que respiran y pulsan armónicamente con el ritmo y la intensidad del audio.
 */
export const AmbientAuraVisualizer: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, volume, audioElement, isExpanded = false }) => {
    const dynamics = useAudioDynamics(audioElement, isPlaying, volume, 16);

    // Calcular energía promedio y energía de graves (primeras bandas)
    const bassEnergy = useMemo(() => {
      const bassSlice = dynamics.slice(0, 4);
      const sum = bassSlice.reduce((acc, v) => acc + v, 0);
      return Math.min(1.0, (sum / (bassSlice.length || 1)) * 1.3);
    }, [dynamics]);

    const thumbnailSrc = useMemo(() => {
      return track?.thumbnail_path ? toAssetUrl(track.thumbnail_path) : null;
    }, [track?.thumbnail_path]);

    return (
      <div className="relative flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        {/* Anillos concéntricos de pulso fluido */}
        <div className="relative flex items-center justify-center h-80 w-80 sm:h-96 sm:w-96">
          {/* Anillo exterior 3 (Onda más expandida) */}
          <div
            className="absolute rounded-full border border-primary/30 bg-primary opacity-10 transition-transform duration-150 ease-out"
            style={{
              width: `${240 + bassEnergy * 110}px`,
              height: `${240 + bassEnergy * 110}px`,
              transform: `scale(${1 + bassEnergy * 0.15})`,
            }}
          />

          {/* Anillo intermedio 2 */}
          <div
            className="absolute rounded-full border border-primary/50 bg-primary opacity-15 blur-sm transition-transform duration-100 ease-out"
            style={{
              width: `${190 + bassEnergy * 70}px`,
              height: `${190 + bassEnergy * 70}px`,
              transform: `scale(${1 + bassEnergy * 0.1})`,
            }}
          />

          {/* Anillo interior 1 (Resplandor cercano) */}
          <div
            className="absolute rounded-full bg-primary opacity-20 blur-md transition-transform duration-75"
            style={{
              width: `${140 + bassEnergy * 40}px`,
              height: `${140 + bassEnergy * 40}px`,
            }}
          />

          {/* Núcleo central con la carátula */}
          <div
            className={`relative z-10 flex items-center justify-center overflow-hidden rounded-full border-4 border-card bg-card shadow-2xl transition-transform duration-100 ${
              isExpanded ? "h-44 w-44 sm:h-52 sm:w-52" : "h-36 w-36"
            }`}
            style={{
              transform: `scale(${1 + bassEnergy * 0.06})`,
            }}
          >
            {thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                alt={track?.title || "Carátula"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-3 text-center text-muted-foreground">
                <Music2 className="h-8 w-8 text-primary mb-1" />
                <span className="text-xs font-semibold truncate max-w-[120px]">
                  {track?.title || "ytms-player"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

AmbientAuraVisualizer.displayName = "AmbientAuraVisualizer";

/**
 * Previsualización compacta para Ajustes -> Personalización.
 */
export const AmbientAuraPreview: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, volume, audioElement }) => {
    const dynamics = useAudioDynamics(audioElement, isPlaying, volume, 8);
    const pulse = (dynamics[0] || 0) * 0.4;

    const thumbnailSrc = track?.thumbnail_path
      ? toAssetUrl(track.thumbnail_path)
      : null;

    return (
      <div className="group relative flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-card p-2 shadow-inner">
        {/* Anillo de pulso */}
        <div
          className="absolute rounded-full border border-primary bg-primary opacity-20 transition-transform duration-150"
          style={{
            width: `${50 + pulse * 25}px`,
            height: `${50 + pulse * 25}px`,
          }}
        />

        {/* Mini centro */}
        <div className="relative z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted">
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
        </div>
      </div>
    );
  },
);

AmbientAuraPreview.displayName = "AmbientAuraPreview";
