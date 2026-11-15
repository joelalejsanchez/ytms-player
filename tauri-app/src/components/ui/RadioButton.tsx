import React from "react";
import { cn } from "@/lib/utils";

export interface RadioButtonProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  checked?: boolean;
  containerClassName?: string;
}

export const RadioButton = React.memo(
  React.forwardRef<HTMLInputElement, RadioButtonProps>(
    (
      {
        className,
        containerClassName,
        checked = false,
        disabled = false,
        onChange,
        onClick,
        ...props
      },
      ref,
    ) => {
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
            type="radio"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            onClick={handleClick}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-150 select-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
              checked
                ? "border-primary bg-card"
                : "border-border bg-card hover:border-primary/60",
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            {checked && (
              <span className="h-2 w-2 rounded-full bg-primary animate-in zoom-in-50 duration-100" />
            )}
          </span>
        </span>
      );
    },
  ),
);
RadioButton.displayName = "RadioButton";
