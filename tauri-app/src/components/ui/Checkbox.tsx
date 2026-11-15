import { Check } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  containerClassName?: string;
}

export const Checkbox = React.memo(
  React.forwardRef<HTMLInputElement, CheckboxProps>(
    (
      {
        className,
        containerClassName,
        checked = false,
        disabled = false,
        onChange,
        onCheckedChange,
        onClick,
        ...props
      },
      ref,
    ) => {
      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e);
        onCheckedChange?.(e.target.checked);
      };

      const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onClick?.(e);
      };

      return (
        <span
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative inline-flex h-4 w-4 shrink-0 items-center justify-center",
            containerClassName,
          )}
        >
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={handleChange}
            onClick={handleClick}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 select-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
              checked
                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                : "border-border bg-card hover:border-primary/60",
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            {checked && <Check className="h-3 w-3 stroke-[3]" />}
          </span>
        </span>
      );
    },
  ),
);
Checkbox.displayName = "Checkbox";
