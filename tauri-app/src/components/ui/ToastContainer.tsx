import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  sortToastsByPriority,
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
  isFront: boolean;
  hiddenCount: number;
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
    isFront,
    hiddenCount,
    onDismiss,
    onHeightMeasured,
  }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const remainingTimeRef = useRef(toast.duration);
    const lastStartRef = useRef(Date.now());
    const [isRowHovered, setIsRowHovered] = useState(false);

    const isEffectivelyHovered = isHovered || isRowHovered;

    // Medir altura del toast para la expansión fluida en hover
    useEffect(() => {
      if (rowRef.current) {
        onHeightMeasured(toast.id, rowRef.current.offsetHeight);
      }
    }, [
      toast.id,
      toast.title,
      toast.description,
      toast.action?.label,
      onHeightMeasured,
    ]);

    // Gestión del temporizador: solo corre cuando la tarjeta está al frente (isFront) y no está en hover (!isEffectivelyHovered)
    useEffect(() => {
      if (isEffectivelyHovered || !isFront) {
        const elapsed = Date.now() - lastStartRef.current;
        remainingTimeRef.current = Math.max(500, remainingTimeRef.current - elapsed);
        return;
      }

      lastStartRef.current = Date.now();
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, remainingTimeRef.current);

      return () => clearTimeout(timer);
    }, [toast.id, onDismiss, isEffectivelyHovered, isFront]);

    return (
      <div
        ref={rowRef}
        role="alert"
        aria-live="assertive"
        onMouseEnter={() => setIsRowHovered(true)}
        onMouseLeave={() => setIsRowHovered(false)}
        style={{
          transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
          transformOrigin: "bottom center",
          opacity,
          zIndex,
          pointerEvents,
          transition:
            "transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease",
        }}
        className="absolute bottom-0 right-0 left-0 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-2xl backdrop-blur-md select-none"
      >
        {/* Badge indicador numérico (+N más) anclado a la tarjeta al frente */}
        {isFront && hiddenCount > 0 && (
          <div
            className="absolute -top-2.5 right-4 z-30 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md ring-2 ring-background animate-in fade-in zoom-in-95 duration-200"
            title={`${hiddenCount} ${hiddenCount === 1 ? "notificación adicional" : "notificaciones adicionales"} en cola`}
            aria-label={`+${hiddenCount} más`}
          >
            <span>+{hiddenCount} más</span>
          </div>
        )}
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
              animationPlayState:
                isEffectivelyHovered || !isFront ? "paused" : "running",
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

        {/* Botón de acción interactiva contextual si existe */}
        {toast.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              try {
                toast.action?.onClick();
              } finally {
                onDismiss(toast.id);
              }
            }}
            className={cn(
              "relative z-10 shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md transition-all duration-150 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
              toast.variant === "error"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : toast.variant === "warning"
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : toast.variant === "success"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {toast.action.label}
          </button>
        )}

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

  // Ordenamos por severidad y antigüedad (priorización estricta)
  const sorted = [...toasts].sort(sortToastsByPriority);
  // Tope estricto de hasta 3 tarjetas físicas visibles simultáneas en el DOM
  const candidates = sorted.slice(0, 3);
  // Conteo de notificaciones acumuladas en cola no visibles aún
  const hiddenCount = Math.max(0, toasts.length - candidates.length);
  // Invertimos para que el elemento de mayor prioridad (candidato 0) sea el último del array,
  // quedando al frente de la pila (reversedIndex === 0) y encima en el DOM
  const visibleToasts = [...candidates].reverse();
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
          const isFront = reversedIndex === 0;

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
            } else {
              translateY = -24;
              scale = 0.88;
              opacity = 0.65;
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
              isFront={isFront}
              hiddenCount={hiddenCount}
              onDismiss={dismiss}
              onHeightMeasured={handleHeightMeasured}
            />
          );
        })}
      </div>
    </div>
  );
};
