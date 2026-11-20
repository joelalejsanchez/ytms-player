import { Music2 } from "lucide-react";
import React, { useMemo } from "react";
import { toAssetUrl } from "@/lib/utils";
import type { VisualizerProps } from "../types";

/**
 * Visualizador de Disco Analógico Estático (Static Vinyl / Disc).
 * Ofrece la estética clásica y acabados de alta fidelidad del vinilo de acetato
 * (surcos concéntricos, reflejo cónico y etiqueta central) pero prescinde de la rotación
 * continua y animaciones complejas, garantizando cero consumo innecesario de GPU/CPU
 * y una experiencia visual sobria y elegante.
 */
export const StaticDiscVisualizer: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, isExpanded = false }) => {
    const thumbnailSrc = useMemo(() => {
      return track?.thumbnail_path ? toAssetUrl(track.thumbnail_path) : null;
    }, [track?.thumbnail_path]);

    return (
      <div className="relative flex flex-col items-center justify-center p-6 select-none overflow-hidden max-w-full">
        {/* Halo de resplandor ambiental suave de fondo */}
        <div
          className={`absolute h-80 w-80 rounded-full bg-primary blur-3xl transition-opacity duration-700 ${
            isPlaying ? "opacity-20 scale-105" : "opacity-5 scale-95"
          }`}
          aria-hidden="true"
        />

        {/* Chasis / Base sobria del disco */}
        <div
          className={`relative z-10 flex items-center justify-center rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 ${
            isExpanded
              ? "h-[380px] w-[380px] sm:h-[440px] sm:w-[440px] max-w-[90vw] max-h-[55vh]"
              : "h-80 w-80"
          }`}
        >
          {/* Disco de Vinilo Estático (Sin rotación, cero consumo de GPU) */}
          <div
            className={`relative flex items-center justify-center rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.65)] ${
              isExpanded ? "h-[320px] w-[320px] sm:h-[370px] sm:w-[370px]" : "h-64 w-64"
            }`}
            style={{
              background:
                "radial-gradient(circle, #1c1c20 0%, #0e0e12 40%, #050507 70%, #0c0c10 100%)",
            }}
          >
            {/* Surcos concéntricos del acetato */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  "repeating-radial-gradient(circle, transparent, transparent 3px, rgba(255, 255, 255, 0.05) 4px, transparent 5px)",
              }}
            />

            {/* Brillo especular y reflejo de luz cónico en el acetato */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-overlay"
              style={{
                background:
                  "conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.4) 40deg, transparent 80deg, transparent 180deg, rgba(255,255,255,0.4) 220deg, transparent 260deg)",
              }}
            />

            {/* Bordes biselados del disco */}
            <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute inset-2.5 rounded-full border border-black/80 pointer-events-none" />

            {/* Etiqueta circular central (Label) */}
            <div
              className={`relative z-10 flex items-center justify-center overflow-hidden rounded-full border-4 border-neutral-900 bg-neutral-950 shadow-inner ${
                isExpanded ? "h-36 w-36 sm:h-40 sm:w-40" : "h-28 w-28"
              }`}
            >
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={track?.title || "Carátula"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-2 text-center text-muted-foreground">
                  <Music2 className="h-7 w-7 text-primary/70 mb-1" />
                  <span className="text-[10px] font-semibold leading-tight line-clamp-1">
                    {track?.title || "ytms-player"}
                  </span>
                </div>
              )}

              {/* Orificio central metálico */}
              <div className="absolute h-5 w-5 rounded-full border-2 border-neutral-400 bg-neutral-900 shadow-inner" />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

StaticDiscVisualizer.displayName = "StaticDiscVisualizer";

/**
 * Previsualización compacta para Ajustes -> Personalización.
 */
export const StaticDiscPreview: React.FC<VisualizerProps> = React.memo(
  ({ track }) => {
    const thumbnailSrc = track?.thumbnail_path
      ? toAssetUrl(track.thumbnail_path)
      : null;

    return (
      <div className="group relative flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-card p-2 shadow-inner">
        {/* Mini disco estático */}
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-full shadow-md transition-transform duration-300 group-hover:scale-105"
          style={{
            background:
              "radial-gradient(circle, #1c1c20 0%, #0e0e12 40%, #050507 70%, #0c0c10 100%)",
          }}
        >
          {/* Surcos miniatura */}
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle, transparent, transparent 2px, rgba(255, 255, 255, 0.08) 3px)",
            }}
          />

          {/* Centro */}
          <div className="relative z-10 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-neutral-900 bg-neutral-950">
            {thumbnailSrc ? (
              <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <Music2 className="h-3.5 w-3.5 text-primary" />
            )}
            <div className="absolute h-1.5 w-1.5 rounded-full bg-neutral-900 border border-neutral-400" />
          </div>
        </div>
      </div>
    );
  },
);

StaticDiscPreview.displayName = "StaticDiscPreview";
