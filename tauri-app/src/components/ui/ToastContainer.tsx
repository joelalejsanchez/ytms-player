import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import React, { useEffect } from "react";
import { type ToastItem, useToastStore } from "@/stores/useToastStore";

const ToastRow: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> =
  React.memo(({ toast, onDismiss }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    // Circunferencia para radio r=10: 2 * PI * 10 ≈ 62.83
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const gradientId = `toast-clock-grad-${toast.id}`;

    const variantStyles = {
      info: "border-border/80 bg-card/95 text-card-foreground",
      success: "border-emerald-600/40 bg-card/95 text-card-foreground",
      warning: "border-amber-500/50 bg-card/95 text-card-foreground",
      error: "border-destructive/60 bg-card/95 text-card-foreground",
    }[toast.variant];

    const variantIcon = {
      info: <Info className="h-4 w-4 text-primary shrink-0" />,
      success: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
      warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
      error: <AlertCircle className="h-4 w-4 text-destructive shrink-0" />,
    }[toast.variant];

    return (
      <div
        role="alert"
        className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[280px] max-w-sm ${variantStyles}`}
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {variantIcon}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight text-foreground truncate">
              {toast.title}
            </p>
            {toast.description && (
              <p className="mt-1 text-[11px] leading-normal text-muted-foreground break-words">
                {toast.description}
              </p>
            )}
          </div>
        </div>

        {/* Reloj con animación de reducción de tiempo mediante gradiente circular */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative h-6 w-6 shrink-0 flex items-center justify-center">
            <svg
              className="h-6 w-6 -rotate-90 transform-gpu"
              viewBox="0 0 28 28"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--accent)" />
                </linearGradient>
              </defs>
              {/* Círculo base de fondo */}
              <circle
                cx="14"
                cy="14"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-muted/30"
              />
              {/* Círculo animado en cuenta regresiva con gradiente circular */}
              <circle
                cx="14"
                cy="14"
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={0}
                style={{
                  animation: `toast-countdown ${toast.duration}ms linear forwards`,
                }}
              />
            </svg>
          </div>

          {/* Botón rápido de cierre "X" */}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  });

ToastRow.displayName = "ToastRow";

/**
 * Contenedor flotante para notificaciones toast en la esquina inferior derecha.
 * Ubicado justo por encima del reproductor persistente sin empujar la UI.
 */
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 right-6 z-50 flex flex-col gap-2.5 pointer-events-none select-none max-w-sm"
    >
      {toasts.map((item) => (
        <ToastRow key={item.id} toast={item} onDismiss={dismiss} />
      ))}
    </div>
  );
};
