import { Check, ChevronDown } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
  direction?: "up" | "down";
}

export const CustomSelect = <T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className,
  triggerClassName,
  menuClassName,
  ariaLabel,
  disabled = false,
  direction = "down",
}: CustomSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (val: T, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(val);
      closeMenu();
    },
    [onChange, closeMenu],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeMenu]);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left select-none", isOpen && "z-[100]", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggleOpen}
        className={cn(
          "flex h-8 items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-primary/60 ring-1 ring-primary/40",
          triggerClassName,
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 text-current">{selectedOption.icon}</span>
          )}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180 text-foreground",
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={cn(
            "absolute right-0 z-[150] min-w-full w-max max-w-[260px] rounded-lg border border-border bg-popover text-popover-foreground p-1 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100",
            direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            menuClassName,
          )}
        >
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => handleSelect(opt.value, e)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
CustomSelect.displayName = "CustomSelect";
