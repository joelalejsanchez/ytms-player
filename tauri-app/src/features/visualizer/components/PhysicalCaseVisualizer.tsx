import { Disc, Music2 } from "lucide-react";
import React, { useMemo } from "react";
import { toAssetUrl } from "@/lib/utils";
import type { VisualizerProps } from "../types";

/**
 * Visualizador de Estuche / Formato Físico (Physical Jewel Case).
 * Presentación estática coleccionable de alta gama inspirada en estuches físicos
 * de CD/Blu-ray y cartuchos: lomo izquierdo biselado, clips sujetadores de libreto,
 * reflejo plástico diagonal de acetato y sombra tridimensional sin deformación dinámica.
 */
export const PhysicalCaseVisualizer: React.FC<VisualizerProps> = React.memo(
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

        {/* Contenedor del Estuche Físico con perspectiva y sombra 3D */}
        <div
          className={`relative z-10 flex overflow-hidden rounded-2xl border border-white/20 bg-neutral-950 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.06)] transition-all duration-300 ${
            isExpanded
              ? "h-[360px] w-[360px] sm:h-[420px] sm:w-[420px] max-w-[90vw] max-h-[55vh]"
              : "h-72 w-72 sm:h-80 sm:w-80"
          }`}
        >
          {/* 1. Lomo Izquierdo (Spine) característico del estuche plástico */}
          <div className="relative flex w-6 sm:w-8 shrink-0 flex-col items-center justify-between border-r border-white/10 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900/90 py-4 shadow-inner">
            {/* Bisagra superior */}
            <div className="h-4 w-1.5 rounded-full bg-white/20 shadow-xs" />

            {/* Icono central de disco en el lomo */}
            <Disc className="h-3.5 w-3.5 text-white/40" />

            {/* Bisagra inferior */}
            <div className="h-4 w-1.5 rounded-full bg-white/20 shadow-xs" />
          </div>

          {/* 2. Compartimento Principal: Bandeja interior y Libreto (Inlay) */}
          <div className="relative flex flex-1 items-center justify-center p-2.5 sm:p-3 bg-neutral-900/80">
            {/* Libreto / Portada cuadrada interior */}
            <div className="relative h-full w-full overflow-hidden rounded-xl border border-black/40 bg-card shadow-md">
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={track?.title || "Carátula"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-4 text-center text-muted-foreground">
                  <Music2 className="h-10 w-10 text-primary/70 mb-2" />
                  <p className="text-sm font-semibold truncate max-w-[160px]">
                    {track?.title || "ytms-player"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {track?.artist || "Álbum Físico"}
                  </p>
                </div>
              )}

              {/* Pestañas sujetadoras de libreto (Tabs) en bordes superior e inferior */}
              <div className="absolute top-2 left-2 h-1.5 w-3 rounded-xs bg-white/40 shadow-xs pointer-events-none" />
              <div className="absolute bottom-2 left-2 h-1.5 w-3 rounded-xs bg-white/40 shadow-xs pointer-events-none" />
              <div className="absolute top-2 right-2 h-1.5 w-3 rounded-xs bg-white/40 shadow-xs pointer-events-none" />
              <div className="absolute bottom-2 right-2 h-1.5 w-3 rounded-xs bg-white/40 shadow-xs pointer-events-none" />
            </div>

            {/* Pestaña de apertura lateral derecha (Thumb tab) */}
            <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 h-12 w-1.5 rounded-l-md border-l border-white/20 bg-neutral-800/80 shadow-xs" />
          </div>

          {/* 3. Reflejo especular diagonal de acetato (Glass Plastic Sheen) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
            style={{
              background:
                "linear-gradient(125deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 20%, transparent 45%, rgba(255,255,255,0.15) 80%, transparent 100%)",
            }}
          />

          {/* Borde sutil biselado de acrílico */}
          <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
        </div>
      </div>
    );
  },
);

PhysicalCaseVisualizer.displayName = "PhysicalCaseVisualizer";

/**
 * Previsualización compacta de estuche para Ajustes -> Personalización.
 */
export const PhysicalCasePreview: React.FC<VisualizerProps> = React.memo(
  ({ track }) => {
    const thumbnailSrc = track?.thumbnail_path
      ? toAssetUrl(track.thumbnail_path)
      : null;

    return (
      <div className="group relative flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-card p-2 shadow-inner">
        {/* Mini estuche físico */}
        <div className="relative flex h-20 w-20 overflow-hidden rounded-lg border border-white/20 bg-neutral-950 shadow-md transition-transform duration-300 group-hover:scale-105">
          {/* Mini lomo */}
          <div className="w-2 shrink-0 border-r border-white/10 bg-neutral-900" />

          {/* Mini portada */}
          <div className="relative flex flex-1 items-center justify-center p-1 bg-neutral-900/60">
            <div className="h-full w-full overflow-hidden rounded-sm bg-muted">
              {thumbnailSrc ? (
                <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-primary">
                  <Music2 className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {/* Reflejo plástico */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
            style={{
              background:
                "linear-gradient(125deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(255,255,255,0.2) 100%)",
            }}
          />
        </div>
      </div>
    );
  },
);

PhysicalCasePreview.displayName = "PhysicalCasePreview";
