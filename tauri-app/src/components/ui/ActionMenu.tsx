import { Loader2, MoreVertical } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerIcon?: React.ReactNode;
  triggerClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  direction?: "down" | "up";
  ariaLabel?: string;
  title?: string;
  isLoading?: boolean;
}

export const ActionMenu: React.FC<ActionMenuProps> = React.memo(
  ({
    items,
    triggerIcon,
    triggerClassName,
    menuClassName,
    align = "right",
    direction = "down",
    ariaLabel = "Opciones",
    title = "Más opciones",
    isLoading = false,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const toggleOpen = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLoading) return;
        setIsOpen((prev) => !prev);
      },
      [isLoading],
    );

    const closeMenu = useCallback(() => {
      setIsOpen(false);
      triggerRef.current?.focus();
    }, []);

    // Manejo accesible de teclado: Escape, flechas arriba/abajo y click fuera
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeMenu();
          return;
        }

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!menuRef.current) return;
          const buttons = Array.from(
            menuRef.current.querySelectorAll<HTMLButtonElement>(
              "button:not([disabled])",
            ),
          );
          if (buttons.length === 0) return;

          const currentIndex = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (e.key === "ArrowDown") {
            const next = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
            buttons[next]?.focus();
          } else {
            const prev = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
            buttons[prev]?.focus();
          }
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      // Enfocar automáticamente el primer elemento del menú
      const timer = setTimeout(() => {
        const firstBtn = menuRef.current?.querySelector<HTMLButtonElement>(
          "button:not([disabled])",
        );
        firstBtn?.focus();
      }, 30);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen, closeMenu]);

    return (
      <div
        ref={containerRef}
        className={cn("relative inline-block text-left", isOpen && "z-50")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleOpen}
          disabled={isLoading}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={title}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            isOpen && "bg-muted text-foreground",
            triggerClassName,
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            triggerIcon || <MoreVertical className="h-4 w-4" />
          )}
        </button>

        {isOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            className={cn(
              "absolute z-[100] min-w-[170px] rounded-lg border border-border bg-popover text-popover-foreground p-1 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100",
              align === "right" ? "right-0" : "left-0",
              direction === "down" ? "top-full mt-1" : "bottom-full mb-1",
              menuClassName,
            )}
          >
            {items.map((item, index) => {
              const isDanger = item.variant === "danger";
              return (
                <button
                  key={index}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={async (e) => {
                    e.stopPropagation();
                    closeMenu();
                    await item.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    isDanger
                      ? "text-destructive hover:bg-destructive/15 hover:text-destructive"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {item.icon && (
                    <span className="shrink-0 text-current">{item.icon}</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
ActionMenu.displayName = "ActionMenu";
