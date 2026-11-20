import { ChevronDown } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  preview?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = React.memo(
  ({
    id,
    title,
    subtitle,
    isOpen,
    onToggle,
    preview,
    children,
    className,
    headerClassName,
  }) => {
    const generatedId = React.useId();
    const sectionId = id || generatedId;
    const contentId = `${sectionId}-content`;

    return (
      <div className={cn("rounded-lg transition-colors", className)}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
          className={cn(
            "flex w-full items-center justify-between gap-3 text-left transition select-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1 -m-1",
            headerClassName,
          )}
        >
          <div className="min-w-0 pr-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {preview && (
              <div
                className={cn(
                  "transition-opacity duration-200",
                  isOpen ? "opacity-70 group-hover:opacity-100" : "opacity-100",
                )}
              >
                {preview}
              </div>
            )}
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/30 group-hover:bg-muted group-hover:border-border transition-colors">
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
            </div>
          </div>
        </button>

        <div
          id={contentId}
          role="region"
          aria-labelledby={sectionId}
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            isOpen
              ? "grid-rows-[1fr] opacity-100 mt-3"
              : "grid-rows-[0fr] opacity-0 pointer-events-none",
          )}
        >
          <div className="overflow-hidden">{children}</div>
        </div>
      </div>
    );
  },
);

CollapsibleSection.displayName = "CollapsibleSection";
