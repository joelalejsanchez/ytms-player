import { create } from "zustand";
import { logger } from "@/stores/useLogStore";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number; // Duración en ms, por defecto 3000
  createdAt: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (toast: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: ({ title, description, variant = "info", duration = 3000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = {
      id,
      title,
      description,
      variant,
      duration,
      createdAt: Date.now(),
    };

    // Registrar automáticamente errores y advertencias en el registro de sesión
    if (variant === "error") {
      logger.error(title, description, "toast");
    } else if (variant === "warning") {
      logger.warn(title, description, "toast");
    }

    set((state) => ({
      toasts: [...state.toasts.slice(-4), newItem],
    }));
    return id;
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clear: () => set({ toasts: [] }),
}));

/**
 * API global reutilizable para emitir notificaciones toast flotantes desde cualquier componente o servicio.
 */
export const toast = {
  show: (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => useToastStore.getState().show(opts),
  info: (title: string, description?: string, duration = 3000) =>
    useToastStore.getState().show({ title, description, variant: "info", duration }),
  success: (title: string, description?: string, duration = 3000) =>
    useToastStore.getState().show({ title, description, variant: "success", duration }),
  warning: (title: string, description?: string, duration = 3000) =>
    useToastStore.getState().show({ title, description, variant: "warning", duration }),
  error: (title: string, description?: string, duration = 3000) =>
    useToastStore.getState().show({ title, description, variant: "error", duration }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
