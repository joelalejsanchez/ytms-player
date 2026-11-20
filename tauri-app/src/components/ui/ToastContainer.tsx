import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type ToastItem,
  type ToastVariant,
  useToastStore,
} from "@/stores/useToastStore";

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-primary shrink-0" />,
  success: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
  error: <AlertCircle className="h-4 w-4 text-destructive shrink-0" />,
};

const variantPerimeterColors: Record<ToastVariant, string> = {
  info: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-destructive",
};

interface ToastRowProps {
  toast: ToastItem;
  stackIndex: number;
  translateY: number;
  scale: number;
  opacity: number;
  zIndex: number;
  pointerEvents: "auto" | "none";
  isHovered: boolean;
  onDismiss: (id: string) => void;
  onHeightMeasured: (id: string, height: number) => void;
}

const ToastRow: React.FC<ToastRowProps> = React.memo(
  ({
    toast,
    translateY,
    scale,
    opacity,
    zIndex,
    pointerEvents,
    isHovered,
    onDismiss,
    onHeightMeasured,
  }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const remainingTimeRef = useRef(toast.duration);
    const lastStartRef = useRef(Date.now());

    // Medir altura del toast para la expansión fluida en hover
    useEffect(() => {
      if (rowRef.current) {
        onHeightMeasured(toast.id, rowRef.current.offsetHeight);
      }
    }, [toast.id, toast.title, toast.description, onHeightMeasured]);

    // Gestión del temporizador con pausa automática al pasar el cursor (hover)
    useEffect(() => {
      if (isHovered) {
        const elapsed = Date.now() - lastStartRef.current;
        remainingTimeRef.current = Math.max(500, remainingTimeRef.current - elapsed);
        return;
      }

      lastStartRef.current = Date.now();
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, remainingTimeRef.current);

      return () => clearTimeout(timer);
    }, [toast.id, onDismiss, isHovered]);

    return (
      <div
        ref={rowRef}
        role="alert"
        aria-live="assertive"
        style={{
          transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
          transformOrigin: "bottom center",
          opacity,
          zIndex,
          pointerEvents,
          transition:
            "transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease",
        }}
        className="absolute bottom-0 right-0 left-0 flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-2xl backdrop-blur-md select-none"
      >
        {/* Temporizador perimetral animado (SVG con pathLength=100) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full rounded-xl overflow-hidden"
          aria-hidden="true"
        >
          {/* Pista perimetral base sutil */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-border/20"
          />
          {/* Recorrido perimetral animado en cuenta regresiva según duración */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset="0"
            className={variantPerimeterColors[toast.variant]}
            style={{
              animation: `toast-perimeter ${toast.duration}ms linear forwards`,
              animationPlayState: isHovered ? "paused" : "running",
            }}
          />
        </svg>

        {/* Contenido: Icono de variante + Título y Descripción */}
        <div className="relative z-10 flex min-w-0 flex-1 items-start gap-2.5">
          {variantIcons[toast.variant]}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight text-foreground truncate">
              {toast.title}
            </p>
            {toast.description && (
              <p className="mt-1 text-[11px] leading-normal text-muted-foreground break-words line-clamp-2">
                {toast.description}
              </p>
            )}
          </div>
        </div>

        {/* Botón rápido de cierre "X" */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          aria-label="Cerrar notificación"
          className="relative z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  },
);

ToastRow.displayName = "ToastRow";

/**
 * Contenedor flotante para notificaciones toast estilo hojas superpuestas (Stacked Cards estilo Sonner).
 * Ubicado en la esquina inferior derecha por encima del reproductor persistente.
 */
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const [isHovered, setIsHovered] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});

  const handleHeightMeasured = useCallback((id: string, height: number) => {
    setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  if (toasts.length === 0) return null;

  // Mostramos hasta 4 toasts en la pila visual
  const visibleToasts = toasts.slice(-4);
  const frontToast = visibleToasts[visibleToasts.length - 1];
  const frontHeight = frontToast ? heights[frontToast.id] || 64 : 64;

  let totalExpandedHeight = 0;
  for (const item of visibleToasts) {
    totalExpandedHeight += (heights[item.id] || 64) + 10;
  }

  const containerHeight = isHovered
    ? Math.max(frontHeight, totalExpandedHeight)
    : frontHeight + 28;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 right-6 z-50 pointer-events-none select-none w-full max-w-sm sm:max-w-md"
    >
      <div
        style={{ height: containerHeight }}
        className="relative w-full pointer-events-auto transition-[height] duration-300 ease-out"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {visibleToasts.map((item, index) => {
          const reversedIndex = visibleToasts.length - 1 - index;

          let translateY = 0;
          let scale = 1;
          let opacity = 1;
          const zIndex = 50 - reversedIndex;
          let pointerEvents: "auto" | "none" = "auto";

          if (!isHovered) {
            // Modo apilado (Stacked sheets):
            if (reversedIndex === 0) {
              translateY = 0;
              scale = 1;
              opacity = 1;
              pointerEvents = "auto";
            } else if (reversedIndex === 1) {
              translateY = -12;
              scale = 0.94;
              opacity = 0.9;
              pointerEvents = "auto";
            } else if (reversedIndex === 2) {
              translateY = -24;
              scale = 0.88;
              opacity = 0.65;
              pointerEvents = "none";
            } else {
              translateY = -36;
              scale = 0.82;
              opacity = 0;
              pointerEvents = "none";
            }
          } else {
            // Modo expandido interactivo:
            let accumulatedHeight = 0;
            for (let j = visibleToasts.length - 1; j > index; j--) {
              const prevItem = visibleToasts[j];
              accumulatedHeight += (heights[prevItem.id] || 64) + 10;
            }
            translateY = -accumulatedHeight;
            scale = 1;
            opacity = 1;
            pointerEvents = "auto";
          }

          return (
            <ToastRow
              key={item.id}
              toast={item}
              stackIndex={reversedIndex}
              translateY={translateY}
              scale={scale}
              opacity={opacity}
              zIndex={zIndex}
              pointerEvents={pointerEvents}
              isHovered={isHovered}
              onDismiss={dismiss}
              onHeightMeasured={handleHeightMeasured}
            />
          );
        })}
      </div>
    </div>
  );
};
