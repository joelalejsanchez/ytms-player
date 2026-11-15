import {
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  Heart,
  Link,
  ListPlus,
  Loader2,
  Music,
  Play,
  Trash2,
} from "lucide-react";
import React from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { PlaylistBookmarkMenu } from "@/components/ui/PlaylistBookmarkMenu";
import { Badge, Button } from "@/components/ui/Primitives";
import { formatDuration, toAssetUrl } from "@/lib/utils";
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
  onTogglePlaylist: (playlistId: number, trackId: number, willAdd: boolean) => void | Promise<void>;
  onAddToPlaylist?: (playlistId: number, trackId: number) => void;
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
  }: TrackRowProps) => {
    const thumbUrl = toAssetUrl(track.thumbnail_path);
    const isSyncingLike = syncStatus?.status === "loading";
    const isSyncError = syncStatus?.status === "error";
    const isSynced = track.synced || syncStatus?.status === "synced";

    return (
      <div
        className={`group flex h-[60px] max-h-[60px] box-border select-none items-center justify-between gap-4 rounded-xl border px-4 py-2 transition-colors hover:z-30 focus-within:z-40 ${
          track.is_missing
            ? "border-amber-500/50 bg-amber-500/10"
            : isCurrent
              ? "border-primary bg-card"
              : "border-border bg-card hover:border-primary/30 hover:bg-muted/60"
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
              {track.is_missing && (
                <Badge tone="warning" className="text-[10px]">
                  <AlertCircle className="h-3 w-3" />
                  Extraviado
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{track.artist}</span>
            </div>
          </div>
        </div>

        {/* Duración + Indicador de sincronización con YouTube */}
        <div className="hidden items-center gap-4 text-xs text-muted-foreground md:flex">
          <span className="w-12 text-right tabular-nums">
            {formatDuration(track.duration)}
          </span>

          {/* Indicador de sincronización (Carga: amarillo / Sincronizado: verde / Error: rojo / Solo local: gris) */}
          <div className="flex items-center justify-center w-5">
            {isSyncingLike ? (
              <span title="Sincronizando like con tu cuenta de YouTube...">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              </span>
            ) : isSyncError ? (
              <span
                title={`Error al sincronizar con YouTube: ${syncStatus?.error ?? "Fallo desconocido"}`}
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
              </span>
            ) : isSynced ? (
              <span title="Sincronizado con tu cuenta de YouTube (Algoritmo actualizado)">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </span>
            ) : (
              <span title="Solo local (no sincronizado con YouTube)">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            disabled={isSyncingLike}
            onClick={() => onToggleLike(track.youtube_id, !track.liked)}
            title={
              isSyncingLike
                ? "Sincronizando con YouTube..."
                : track.liked
                  ? "Quitar Me gusta"
                  : "Marcar Me gusta"
            }
          >
            {isSyncingLike ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Heart
                className={`h-4 w-4 ${
                  track.liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                }`}
              />
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
              {
                label: "Copiar enlace",
                icon: <Link className="h-3.5 w-3.5" />,
                onClick: async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `https://www.youtube.com/watch?v=${track.youtube_id}`,
                    );
                  } catch (err) {
                    console.error("No se pudo copiar el enlace al portapapeles:", err);
                  }
                },
              },
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
