import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.memo(
  React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {
      const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary:
          "bg-primary text-primary-foreground hover:opacity-90 active:opacity-100 shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:opacity-90 border border-border shadow-xs",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        danger:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm border border-red-700",
        outline:
          "bg-transparent border border-border text-foreground hover:bg-muted hover:text-foreground",
      };

      const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
        sm: "h-8 px-3 text-xs rounded-md",
        md: "h-9 px-4 text-sm rounded-lg",
        lg: "h-11 px-5 text-base rounded-lg",
        icon: "h-9 w-9 rounded-lg flex items-center justify-center p-0",
      };

      return (
        <button
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            variants[variant],
            sizes[size],
            className,
          )}
          {...props}
        />
      );
    },
  ),
);
Button.displayName = "Button";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.memo(
  React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )),
);
Input.displayName = "Input";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warning" | "danger" | "info" | "primary";
}

export const Badge = React.memo(
  ({ className, tone = "default", ...props }: BadgeProps) => {
    const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
      default: "bg-muted text-muted-foreground border-border",
      info: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      success:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      warning:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      danger: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
      primary: "bg-primary/15 text-primary border-primary/30",
    };

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
          tones[tone],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export interface ProgressBarProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
  tone?: "primary" | "info" | "success" | "warning" | "danger";
}

export const ProgressBar = React.memo(
  ({ value, className, indicatorClassName, tone = "primary" }: ProgressBarProps) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const toneClasses: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
      primary: "bg-primary",
      info: "bg-sky-500",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      danger: "bg-red-500",
    };

    return (
      <div
        className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      >
        <div
          className={cn(
            "h-full transition-all duration-200",
            toneClasses[tone],
            indicatorClassName,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";
