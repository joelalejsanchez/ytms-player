import { Bookmark, Check, ListMusic } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn, toAssetUrl } from "@/lib/utils";
import type { Playlist } from "@/types/models";

export interface PlaylistBookmarkMenuProps {
  trackId: number;
  playlists: Playlist[];
  assignedPlaylistIds?: number[];
  onTogglePlaylist: (
    playlistId: number,
    trackId: number,
    willAdd: boolean,
  ) => void | Promise<void>;
  className?: string;
  triggerClassName?: string;
}

export const PlaylistBookmarkMenu = React.memo(
  ({
    trackId,
    playlists,
    assignedPlaylistIds = [],
    onTogglePlaylist,
    className,
    triggerClassName,
  }: PlaylistBookmarkMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggleOpen = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen((prev) => !prev);
    }, []);

    const closeMenu = useCallback(() => {
      setIsOpen(false);
    }, []);

    // Cerrar al hacer clic fuera o presionar Escape
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

    const isAssignedAny = assignedPlaylistIds.length > 0;

    return (
      <div
        ref={containerRef}
        className={cn("relative inline-block text-left", isOpen && "z-50", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Gestionar playlists"
          aria-expanded={isOpen}
          title={
            isAssignedAny
              ? `En ${assignedPlaylistIds.length} playlist(s)`
              : "Añadir a playlist"
          }
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isAssignedAny
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            isOpen && "bg-muted text-foreground",
            triggerClassName,
          )}
        >
          <Bookmark
            className={cn(
              "h-4 w-4 transition-transform",
              isAssignedAny && "fill-primary/25",
            )}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 top-full mt-1.5 z-[100] min-w-[210px] max-w-[280px] rounded-lg border border-border bg-popover text-popover-foreground p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ListMusic className="h-3.5 w-3.5" />
                Playlists
              </span>
              <span className="font-mono text-[10px]">
                {assignedPlaylistIds.length}/{playlists.length}
              </span>
            </div>

            {playlists.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-muted-foreground">
                No tienes playlists creadas. Crea una en la pestaña Playlists.
              </p>
            ) : (
              <div className="max-h-56 space-y-0.5 overflow-y-auto py-1">
                {playlists.map((pl) => {
                  const isAssigned = assignedPlaylistIds.includes(pl.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={isAssigned}
                      onClick={(e) => {
                        e.stopPropagation();
                        // NO se cierra al hacer clic para permitir marcar/desmarcar múltiples
                        void onTogglePlaylist(pl.id, trackId, !isAssigned);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-left",
                        isAssigned &&
                          "bg-primary/10 text-primary font-semibold hover:bg-primary/15",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            isAssigned
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-transparent",
                          )}
                        >
                          {isAssigned && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center border border-border/50">
                          {pl.cover_path ? (
                            <img
                              src={toAssetUrl(pl.cover_path)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ListMusic className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <span className="truncate">{pl.title}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {pl.track_count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
PlaylistBookmarkMenu.displayName = "PlaylistBookmarkMenu";
