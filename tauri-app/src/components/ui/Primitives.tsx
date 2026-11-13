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
          "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-sm",
        secondary:
          "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
        ghost: "bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white",
        danger:
          "bg-rose-950/80 text-rose-200 border border-rose-800/70 hover:bg-rose-900",
        outline:
          "bg-transparent border border-slate-700 text-slate-200 hover:bg-slate-800/50",
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
            "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50",
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
        "flex h-9 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )),
);
Input.displayName = "Input";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

export const Badge = React.memo(
  ({ className, tone = "default", ...props }: BadgeProps) => {
    const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
      default: "bg-slate-800 text-slate-300 border-slate-700",
      success: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
      warning: "bg-amber-950/80 text-amber-300 border-amber-800/60",
      danger: "bg-rose-950/80 text-rose-300 border-rose-800/60",
      info: "bg-sky-950/80 text-sky-300 border-sky-800/60",
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
}

export const ProgressBar = React.memo(({ value, className }: ProgressBarProps) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-slate-800",
        className,
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
});
ProgressBar.displayName = "ProgressBar";
