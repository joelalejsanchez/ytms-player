import { useEffect, useRef } from "react";

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose?: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
}

// Contador global de modales activos para permitir modales concurrentes o anidados sin desincronizar el scroll lock
let activeModalCount = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hook reutilizable para accesibilidad completa WAI-ARIA en modales y diálogos emergentes:
 * 1. Bloqueo de scroll con compensación de scrollbar (previene layout shift).
 * 2. Trampa de foco (Focus Trap) confinada en el contenedor.
 * 3. Auto-enfoque al montar (en initialFocusRef o primer elemento interactivo).
 * 4. Restauración del foco al elemento detonante previo al desmontar.
 * 5. Descarte accesible mediante la tecla Escape.
 */
export function useModalA11y({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef,
  closeOnEscape = true,
  lockScroll = true,
}: UseModalA11yOptions): void {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // 1. Bloqueo de scroll con compensación de barra de desplazamiento
  useEffect(() => {
    if (!isOpen || !lockScroll) return;

    if (activeModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalBodyPaddingRight = document.body.style.paddingRight;

      // Calcular anchura de la barra de desplazamiento
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";
    }

    activeModalCount++;

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.paddingRight = originalBodyPaddingRight;
      }
    };
  }, [isOpen, lockScroll]);

  // 2. Trampa de foco, auto-enfoque y restauración de foco
  useEffect(() => {
    if (!isOpen) return;

    // Almacenar el elemento actualmente enfocado antes de que el modal capture la interacción
    if (document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    const container = containerRef.current;
    if (!container) return;

    // Auto-enfoque en initialFocusRef o primer control disponible
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0]?.focus();
        } else {
          container.focus();
        }
      }
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key === "Tab") {
        const currentContainer = containerRef.current;
        if (!currentContainer) return;

        const focusable = Array.from(
          currentContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(
          (el) =>
            el.offsetParent !== null ||
            el === document.activeElement ||
            window.getComputedStyle(el).display !== "none",
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !currentContainer.contains(document.activeElement)
          ) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (
            document.activeElement === last ||
            !currentContainer.contains(document.activeElement)
          ) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);

      // Restaurar foco al elemento detonante previo
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === "function"
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, closeOnEscape, containerRef, initialFocusRef]);
}
