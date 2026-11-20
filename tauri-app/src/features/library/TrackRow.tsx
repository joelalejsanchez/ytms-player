import {
  AlertCircle,
  AlertTriangle,
  FolderPlus,
  Heart,
  Info,
  Link,
  ListPlus,
  Music,
  Play,
  Trash2,
} from "lucide-react";
import React from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { PlaylistBookmarkMenu } from "@/components/ui/PlaylistBookmarkMenu";
import { Badge, Button } from "@/components/ui/Primitives";
import { formatDuration, toAssetUrl } from "@/lib/utils";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { toast } from "@/stores/useToastStore";
import type { TrackSyncInfo } from "@/stores/useLibraryStore";
import type { Playlist, Track } from "@/types/models";

export interface TrackRowProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  playlists: Playlist[];
  assignedPlaylistIds?: number[];
  syncStatus?: TrackSyncInfo;
  isDeleting?: boolean;
  onPlay: (track: Track) => void;
  onEnqueue: (track: Track) => void;
  onToggleLike: (youtubeId: string, nextLiked: boolean | null) => void;
  onDelete: (youtubeId: string) => void;
  onTogglePlaylist: (
    playlistId: number,
    trackId: number,
    willAdd: boolean,
  ) => void | Promise<void>;
  onAddToPlaylist?: (playlistId: number, trackId: number) => void;
  onShowInfo?: (track: Track) => void;
}

/**
 * Componente Stateless de fila de biblioteca envuelto en `React.memo`
 * para evitar re-renders cuando el reproductor global actualiza su tiempo actual (SDD 7.2).
 */
export const TrackRow = React.memo(
  ({
    track,
    isCurrent,
    isPlaying: _isPlaying,
    playlists,
    assignedPlaylistIds = [],
    syncStatus,
    isDeleting = false,
    onPlay,
    onEnqueue,
    onToggleLike,
    onDelete,
    onTogglePlaylist,
    onShowInfo,
  }: TrackRowProps) => {
    const thumbUrl = toAssetUrl(track.thumbnail_path);
    const isLocal = track.origin === "local";
    const isSyncingLike = !isLocal && syncStatus?.status === "loading";
    const isSynced = !isLocal && (track.synced || syncStatus?.status === "synced");
    const isCorrupted = usePlayerStore((s) =>
      s.corruptedTrackIds.includes(track.youtube_id),
    );

    // Unificación de estado de Like y Sincronización en el botón de corazón
    const likeButtonTitle = isLocal
      ? track.liked
        ? "Me gusta (Archivo local)"
        : "Sin Me gusta (Archivo local)"
      : isSyncingLike
        ? "Sincronizando con YouTube..."
        : track.liked
          ? isSynced
            ? "Me gusta (Sincronizado con YouTube)"
            : "Me gusta (Guardado local / No sincronizado)"
          : isSynced
            ? "Sin Me gusta (Sincronizado con YouTube)"
            : "Sin Me gusta (Guardado local / No sincronizado)";

    // Estilos de acuerdo al requerimiento:
    // - borde rojo o rellenado rojo: sincronizado
    // - borde gris, rellenado gris: local
    const heartIconClass = isSynced
      ? track.liked
        ? "fill-rose-500 text-rose-500" // Rellenado rojo (sincronizado)
        : "text-rose-500 hover:fill-rose-500/20" // Borde rojo (sincronizado)
      : track.liked
        ? "fill-muted-foreground text-muted-foreground" // Rellenado gris (local)
        : "text-muted-foreground/60 hover:text-muted-foreground hover:fill-muted-foreground/20"; // Borde gris (local)

    // Manejo de reproducción instantánea con doble clic protegiendo controles interactivos
    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (track.is_missing) return;
        const target = e.target as HTMLElement | null;
        if (
          target?.closest(
            "button, [role='button'], [role='menuitem'], a, input, select, textarea",
          )
        ) {
          return;
        }
        onPlay(track);
      },
      [track, onPlay],
    );

    return (
      <div
        onDoubleClick={handleDoubleClick}
        className={`group flex h-[60px] max-h-[60px] box-border select-none items-center justify-between gap-4 rounded-xl border px-4 py-2 transition-colors hover:z-30 focus-within:z-40 ${
          track.is_missing
            ? "border-amber-500/50 bg-amber-500/10 cursor-not-allowed"
            : isCorrupted
              ? "border-destructive/50 bg-destructive/10 cursor-pointer"
              : isCurrent
                ? "border-primary bg-card cursor-pointer"
                : "border-border bg-card hover:border-primary/30 hover:bg-muted/60 cursor-pointer"
        }`}
      >
        {/* Miniatura + Título + Artista */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted transform-gpu">
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt={track.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Music className="h-4 w-4" />
              </div>
            )}
            {!track.is_missing && (
              <button
                type="button"
                onClick={() => onPlay(track)}
                onDoubleClick={(e) => e.stopPropagation()}
                aria-label={`Reproducir ${track.title}`}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-150 transform-gpu will-change-opacity group-hover:opacity-100"
              >
                <Play className="h-4 w-4 fill-white text-white" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`truncate text-sm font-medium ${
                  isCurrent ? "text-primary" : "text-foreground"
                }`}
              >
                {track.title}
              </p>
              {isLocal && (
                <Badge tone="default" className="text-[10px] px-1.5 py-0 font-normal">
                  Local
                </Badge>
              )}
              {track.is_missing && (
                <Badge tone="warning" className="text-[10px]">
                  <AlertCircle className="h-3 w-3" />
                  Extraviado
                </Badge>
              )}
              {isCorrupted && (
                <Badge tone="danger" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3" />
                  Dañado
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{track.artist}</span>
            </div>
          </div>
        </div>

        {/* Duración */}
        <div className="hidden items-center text-xs text-muted-foreground md:flex">
          <span className="w-12 text-right tabular-nums">
            {formatDuration(track.duration)}
          </span>
        </div>

        {/* Acciones */}
        <div
          className="flex items-center gap-1.5"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            disabled={isSyncingLike}
            onClick={() => onToggleLike(track.youtube_id, !track.liked)}
            title={likeButtonTitle}
            className={`transition-colors ${
              isSynced ? "hover:bg-rose-500/10" : "hover:bg-muted"
            }`}
          >
            {isSyncingLike ? (
              <Heart className="h-4 w-4 text-amber-500 fill-amber-500/40 animate-heart-pulse transform-gpu" />
            ) : (
              <Heart className={`h-4 w-4 transition-colors ${heartIconClass}`} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={track.is_missing}
            onClick={() => onEnqueue(track)}
            title="Añadir a la cola"
          >
            <ListPlus className="h-4 w-4" />
          </Button>

          {/* Selector de Playlists desplegable estilo marcador */}
          <PlaylistBookmarkMenu
            trackId={track.id}
            playlists={playlists}
            assignedPlaylistIds={assignedPlaylistIds}
            onTogglePlaylist={onTogglePlaylist}
          />

          <ActionMenu
            isLoading={isDeleting}
            title="Opciones de la canción"
            items={[
              ...(onShowInfo
                ? [
                    {
                      label: "Información de la pista",
                      icon: <Info className="h-3.5 w-3.5 text-primary" />,
                      onClick: () => onShowInfo(track),
                    },
                  ]
                : []),
              ...(!isLocal
                ? [
                    {
                      label: "Copiar enlace de YouTube",
                      icon: <Link className="h-3.5 w-3.5" />,
                      onClick: async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `https://www.youtube.com/watch?v=${track.youtube_id}`,
                          );
                          toast.success(
                            "Enlace copiado",
                            "Enlace de YouTube copiado al portapapeles",
                          );
                        } catch (err) {
                          console.error(
                            "No se pudo copiar el enlace al portapapeles:",
                            err,
                          );
                        }
                      },
                    },
                  ]
                : []),
              {
                label: "Eliminar canción",
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: "danger",
                onClick: () => onDelete(track.youtube_id),
              },
            ]}
          />
        </div>
      </div>
    );
  },
);
TrackRow.displayName = "TrackRow";

export { FolderPlus };
