import { Music2 } from "lucide-react";
import React, { useMemo } from "react";
import { toAssetUrl } from "@/lib/utils";
import type { VisualizerProps } from "../types";

/**
 * Visualizador de Disco de Vinilo (33 RPM).
 * Recrea un tocadiscos analógico con disco de acetato, surcos reflexivos,
 * carátula central giratoria, brazo de aguja móvil y halo ambiental reactivo.
 */
export const VinylVisualizer: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying, isExpanded = false }) => {
    const thumbnailSrc = useMemo(() => {
      return track?.thumbnail_path ? toAssetUrl(track.thumbnail_path) : null;
    }, [track?.thumbnail_path]);

    return (
      <div className="relative flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        {/* Halo de resplandor ambiental reactivo de fondo */}
        <div
          className={`absolute h-80 w-80 rounded-full bg-primary blur-3xl transition-all duration-1000 ${
            isPlaying ? "scale-110 opacity-25" : "scale-95 opacity-10"
          }`}
          aria-hidden="true"
        />

        {/* Chasis / Contenedor del tocadiscos */}
        <div
          className={`relative flex items-center justify-center rounded-3xl border border-border bg-card shadow-2xl transition-all duration-500 ${
            isExpanded
              ? "h-[420px] w-[420px] max-w-[90vw] max-h-[50vh] sm:h-[460px] sm:w-[460px]"
              : "h-80 w-80"
          }`}
        >
          {/* Disco de Vinilo */}
          <div
            className={`relative flex items-center justify-center rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.6)] transition-transform ease-linear ${
              isExpanded ? "h-[340px] w-[340px] sm:h-[380px] sm:w-[380px]" : "h-64 w-64"
            }`}
            style={{
              animation: isPlaying ? "spin 3.6s linear infinite" : "none",
              background:
                "radial-gradient(circle, #1a1a1e 0%, #0d0d10 40%, #050507 70%, #0a0a0d 100%)",
            }}
          >
            {/* Surcos concéntricos del acetato de vinilo */}
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

            {/* Borde exterior biselado */}
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

              {/* Orificio central del tocadiscos con anillo metálico */}
              <div className="absolute h-5 w-5 rounded-full border-2 border-neutral-400 bg-neutral-900 shadow-inner" />
            </div>
          </div>

          {/* Brazo de aguja (Tonearm) analógico en la esquina superior derecha */}
          <div
            className="pointer-events-none absolute -right-2 top-3 h-48 w-28 origin-[70px_20px] transition-transform duration-700 ease-out z-20"
            style={{
              transform: isPlaying ? "rotate(24deg)" : "rotate(0deg)",
            }}
          >
            {/* Base de pivote circular del brazo */}
            <div className="absolute right-4 top-2 h-10 w-10 rounded-full border-2 border-neutral-600 bg-neutral-800 shadow-lg">
              <div className="absolute inset-1.5 rounded-full bg-neutral-700 border border-neutral-500" />
              <div className="absolute inset-3 rounded-full bg-neutral-900" />
            </div>

            {/* Brazo metálico curvo */}
            <div className="absolute right-8 top-10 h-28 w-1.5 rounded-full bg-gradient-to-b from-neutral-400 via-neutral-200 to-neutral-400 shadow-sm" />

            {/* Cabezal de aguja (Cartridge / Stylus) */}
            <div className="absolute right-6 top-36 h-6 w-3.5 rotate-[-20deg] rounded-sm border border-neutral-700 bg-neutral-900 shadow-md">
              <div className="absolute bottom-0 left-1/2 h-1.5 w-1 -translate-x-1/2 rounded-full bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

VinylVisualizer.displayName = "VinylVisualizer";

/**
 * Versión compacta para previsualización interactiva en el panel de Ajustes (hover).
 */
export const VinylPreview: React.FC<VisualizerProps> = React.memo(
  ({ track, isPlaying }) => {
    const thumbnailSrc = track?.thumbnail_path
      ? toAssetUrl(track.thumbnail_path)
      : null;

    return (
      <div className="group relative flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-card p-2 shadow-inner">
        {/* Halo dinámico en hover */}
        <div className="absolute inset-2 rounded-full bg-primary blur-md transition-opacity opacity-0 group-hover:opacity-20" />

        {/* Mini disco */}
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-full shadow-md transition-transform duration-300 group-hover:scale-105"
          style={{
            animation: isPlaying ? "spin 3s linear infinite" : "none",
            background:
              "radial-gradient(circle, #1a1a1e 0%, #0d0d10 40%, #050507 70%, #0a0a0d 100%)",
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

VinylPreview.displayName = "VinylPreview";
