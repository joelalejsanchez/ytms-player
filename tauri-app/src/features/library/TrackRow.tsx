import {
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  Heart,
  ListPlus,
  Music,
  Play,
  Trash2,
} from "lucide-react";
import React from "react";
import { Badge, Button } from "@/components/ui/Primitives";
import { formatBytes, formatDuration, toAssetUrl } from "@/lib/utils";
import type { Playlist, Track } from "@/types/models";

export interface TrackRowProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  playlists: Playlist[];
  onPlay: (track: Track) => void;
  onEnqueue: (track: Track) => void;
  onToggleLike: (youtubeId: string, nextLiked: boolean | null) => void;
  onDelete: (youtubeId: string) => void;
  onAddToPlaylist: (playlistId: number, trackId: number) => void;
}

/**
 * Componente Stateless de fila de biblioteca envuelto en `React.memo`
 * para evitar re-renders cuando el reproductor global actualiza su tiempo actual (SDD 7.2).
 */
export const TrackRow = React.memo(
  ({
    track,
    isCurrent,
    isPlaying,
    playlists,
    onPlay,
    onEnqueue,
    onToggleLike,
    onDelete,
    onAddToPlaylist,
  }: TrackRowProps) => {
    const thumbUrl = toAssetUrl(track.thumbnail_path);

    return (
      <div
        className={`group flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 transition-colors ${
          track.is_missing
            ? "border-amber-800/50 bg-amber-950/15"
            : isCurrent
              ? "border-red-500/40 bg-red-950/20"
              : "border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/50"
        }`}
      >
        {/* Miniatura + Título + Artista */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-800">
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt={track.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-500">
                <Music className="h-4 w-4" />
              </div>
            )}
            {!track.is_missing && (
              <button
                type="button"
                onClick={() => onPlay(track)}
                aria-label={`Reproducir ${track.title}`}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Play className="h-4 w-4 fill-white text-white" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`truncate text-sm font-medium ${
                  isCurrent ? "text-red-400" : "text-slate-100"
                }`}
              >
                {track.title}
              </p>
              {isCurrent && isPlaying && (
                <Badge tone="info" className="text-[10px]">
                  Reproduciendo
                </Badge>
              )}
              {track.is_missing && (
                <Badge tone="warning" className="text-[10px]">
                  <AlertCircle className="h-3 w-3" />
                  Extraviado
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
              <span className="truncate">{track.artist}</span>
              <span>·</span>
              <code className="rounded bg-slate-800 px-1.5 py-0.2 text-[11px] text-slate-300">
                {track.youtube_id}
              </code>
            </div>
          </div>
        </div>

        {/* Metadatos técnicos */}
        <div className="hidden items-center gap-4 text-xs text-slate-400 md:flex">
          <Badge tone="default" className="uppercase">
            {track.file_extension}
          </Badge>
          <span className="w-16 text-right tabular-nums">
            {formatBytes(track.file_size)}
          </span>
          <span className="w-12 text-right tabular-nums">
            {formatDuration(track.duration)}
          </span>
          <span title={track.synced ? "Sincronizado con YouTube" : "Local"}>
            <CheckCircle2
              className={`h-4 w-4 ${
                track.synced ? "text-emerald-400" : "text-slate-600"
              }`}
            />
          </span>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleLike(track.youtube_id, !track.liked)}
            title={track.liked ? "Quitar Me gusta" : "Marcar Me gusta"}
          >
            <Heart
              className={`h-4 w-4 ${
                track.liked ? "fill-red-500 text-red-500" : "text-slate-400"
              }`}
            />
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

          {playlists.length > 0 && (
            <div className="relative">
              <select
                aria-label="Añadir a playlist"
                defaultValue=""
                onChange={(e) => {
                  const pid = Number(e.target.value);
                  if (pid > 0) {
                    onAddToPlaylist(pid, track.id);
                    e.target.value = "";
                  }
                }}
                className="h-8 cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="" disabled>
                  + Playlist
                </option>
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(track.youtube_id)}
            title="Eliminar track"
            className="hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  },
);
TrackRow.displayName = "TrackRow";

export { FolderPlus };
