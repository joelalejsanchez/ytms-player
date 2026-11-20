import { create } from "zustand";
import { logger } from "@/stores/useLogStore";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
  onDismissCallback?: () => void;
}

export const TOAST_SEVERITY_WEIGHT: Record<ToastVariant, number> = {
  error: 4,
  warning: 3,
  success: 2,
  info: 1,
};

/**
 * Función de ordenamiento por severidad y antigüedad para la cola de notificaciones.
 * Prioriza severidades mayores (error > warning > success > info).
 * Ante igual severidad, aplica FIFO (la más antigua primero).
 */
export function sortToastsByPriority(a: ToastItem, b: ToastItem): number {
  const weightA = TOAST_SEVERITY_WEIGHT[a.variant] ?? 1;
  const weightB = TOAST_SEVERITY_WEIGHT[b.variant] ?? 1;
  if (weightA !== weightB) {
    return weightB - weightA;
  }
  return a.createdAt - b.createdAt;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number; // Duración en ms, por defecto 3000 (o 7000 si action está presente)
  createdAt: number;
  action?: ToastAction;
  onDismissCallback?: () => void;
}

const MAX_STORED_TOASTS = 40;

interface ToastState {
  toasts: ToastItem[];
  show: (toast: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
    action?: ToastAction;
    onDismissCallback?: () => void;
  }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({
    title,
    description,
    variant = "info",
    duration,
    action,
    onDismissCallback,
  }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const effectiveDuration = duration ?? (action ? 7000 : 3000);
    const newItem: ToastItem = {
      id,
      title,
      description,
      variant,
      duration: effectiveDuration,
      createdAt: Date.now(),
      action,
      onDismissCallback,
    };

    // Registrar automáticamente errores y advertencias en el registro de sesión
    if (variant === "error") {
      logger.error(title, description, "toast");
    } else if (variant === "warning") {
      logger.warn(title, description, "toast");
    }

    set((state) => {
      const nextToasts = [...state.toasts, newItem];
      if (nextToasts.length > MAX_STORED_TOASTS) {
        return { toasts: nextToasts.slice(-MAX_STORED_TOASTS) };
      }
      return { toasts: nextToasts };
    });
    return id;
  },
  dismiss: (id) => {
    const item = get().toasts.find((t) => t.id === id);
    if (item?.onDismissCallback) {
      try {
        item.onDismissCallback();
      } catch (err) {
        console.error("Error al ejecutar onDismissCallback del toast:", err);
      }
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clear: () => set({ toasts: [] }),
}));

function parseToastArgs(
  title: string,
  description?: string,
  optionsOrDuration?: number | ToastOptions,
  variant: ToastVariant = "info",
) {
  let duration: number | undefined;
  let action: ToastAction | undefined;
  let onDismissCallback: (() => void) | undefined;

  if (typeof optionsOrDuration === "number") {
    duration = optionsOrDuration;
  } else if (optionsOrDuration && typeof optionsOrDuration === "object") {
    duration = optionsOrDuration.duration;
    action = optionsOrDuration.action;
    onDismissCallback = optionsOrDuration.onDismissCallback;
  }

  return {
    title,
    description,
    variant,
    duration,
    action,
    onDismissCallback,
  };
}

/**
 * API global reutilizable para emitir notificaciones toast flotantes desde cualquier componente o servicio.
 */
export const toast = {
  show: (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
    action?: ToastAction;
    onDismissCallback?: () => void;
  }) => useToastStore.getState().show(opts),
  info: (title: string, description?: string, options?: number | ToastOptions) =>
    useToastStore.getState().show(parseToastArgs(title, description, options, "info")),
  success: (title: string, description?: string, options?: number | ToastOptions) =>
    useToastStore
      .getState()
      .show(parseToastArgs(title, description, options, "success")),
  warning: (title: string, description?: string, options?: number | ToastOptions) =>
    useToastStore
      .getState()
      .show(parseToastArgs(title, description, options, "warning")),
  error: (title: string, description?: string, options?: number | ToastOptions) =>
    useToastStore.getState().show(parseToastArgs(title, description, options, "error")),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
