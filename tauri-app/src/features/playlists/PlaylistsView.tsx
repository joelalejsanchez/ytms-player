import {
  ArrowLeft,
  Clock,
  HardDrive,
  LayoutGrid,
  Link as LinkIcon,
  List,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Badge, Button, Input } from "@/components/ui/Primitives";
import {
  cn,
  formatBytes,
  formatDuration,
  formatHumanDuration,
  toAssetUrl,
} from "@/lib/utils";
import { playlistFormSchema } from "@/schemas/validation";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { toast } from "@/stores/useToastStore";
import type { Playlist, Track } from "@/types/models";

// ==========================================
// Subcomponente Memoizado: Tarjeta en Cuadrícula
// ==========================================
interface PlaylistCardProps {
  playlist: Playlist;
  duration: number;
  isCurrentlyPlaying: boolean;
  onSelect: (id: number) => void;
  onPlay: (id: number) => void;
  onDeleteRequest: (playlist: Playlist) => void;
}

const PlaylistCard = React.memo(
  ({
    playlist,
    duration,
    isCurrentlyPlaying,
    onSelect,
    onPlay,
    onDeleteRequest,
  }: PlaylistCardProps) => {
    const coverUrl = toAssetUrl(playlist.cover_path);

    return (
      <div
        onClick={() => onSelect(playlist.id)}
        className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-3 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
      >
        {/* Contenedor de Portada */}
        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-muted shadow-inner">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={playlist.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-muted text-muted-foreground">
              <ListMusic className="h-10 w-10 opacity-40" />
            </div>
          )}

          {/* Insignia indicadora de sincronización con YouTube */}
          {playlist.youtube_playlist_id && (
            <div
              className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[10px] font-medium text-red-400 border border-white/10 shadow-xs"
              title="Sincronizada con YouTube"
            >
              <Youtube className="h-3 w-3 fill-current text-red-500" />
              <span>YouTube</span>
            </div>
          )}

          {/* Botón flotante de Quick Play */}
          {playlist.track_count > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(playlist.id);
              }}
              title={
                isCurrentlyPlaying
                  ? "Pausar playlist"
                  : `Reproducir "${playlist.title}"`
              }
              className={cn(
                "absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-110 active:scale-95",
                isCurrentlyPlaying
                  ? "opacity-100 ring-2 ring-primary-foreground"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              {isCurrentlyPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.info(
                  "Playlist sin canciones",
                  "Esta playlist no tiene canciones para reproducir.",
                );
              }}
              title="Esta playlist no tiene canciones"
              className="absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 text-muted-foreground/50 border border-border/80 shadow-xs opacity-0 group-hover:opacity-100 cursor-not-allowed transition-all duration-200"
            >
              <Play className="ml-0.5 h-5 w-5 fill-current opacity-40" />
            </button>
          )}
        </div>

        {/* Fila superior: Título de la playlist y Duración acumulada en la misma línea + Menú de opciones */}
        <div className="flex items-start justify-between gap-1.5 min-w-0">
          <div className="flex items-baseline justify-between gap-2 min-w-0 flex-1">
            <h3
              className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors"
              title={playlist.title}
            >
              {playlist.title}
            </h3>
            {duration > 0 && (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {formatHumanDuration(duration)}
              </span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1">
            <ActionMenu
              title="Opciones de playlist"
              items={[
                {
                  label: "Eliminar playlist",
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  variant: "danger",
                  onClick: () => onDeleteRequest(playlist),
                },
              ]}
            />
          </div>
        </div>

        {/* Fila inferior: Conteo de canciones justo debajo */}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {playlist.track_count} {playlist.track_count === 1 ? "canción" : "canciones"}
        </p>
      </div>
    );
  },
);
PlaylistCard.displayName = "PlaylistCard";

// ==========================================
// Subcomponente Memoizado: Fila en Lista
// ==========================================
interface PlaylistRowProps {
  playlist: Playlist;
  duration: number;
  isCurrentlyPlaying: boolean;
  onSelect: (id: number) => void;
  onPlay: (id: number) => void;
  onDeleteRequest: (playlist: Playlist) => void;
}

const PlaylistRow = React.memo(
  ({
    playlist,
    duration,
    isCurrentlyPlaying,
    onSelect,
    onPlay,
    onDeleteRequest,
  }: PlaylistRowProps) => {
    const coverUrl = toAssetUrl(playlist.cover_path);

    return (
      <div
        onClick={() => onSelect(playlist.id)}
        className="group flex cursor-pointer select-none items-center justify-between gap-4 rounded-xl border border-border bg-card p-3 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-muted/60"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {/* Botón de reproducción rápida */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(playlist.id);
            }}
            disabled={playlist.track_count === 0}
            title={
              playlist.track_count === 0
                ? "Esta playlist no tiene canciones"
                : isCurrentlyPlaying
                  ? "Pausar playlist"
                  : `Reproducir "${playlist.title}"`
            }
            className={cn(
              "shrink-0 hover:bg-muted",
              isCurrentlyPlaying
                ? "text-primary"
                : "text-foreground hover:text-primary",
            )}
          >
            {isCurrentlyPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
          </Button>

          {/* Miniatura / Carátula */}
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center border border-border/60 shadow-xs">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={playlist.title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <ListMusic className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Título y metadatos */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {playlist.title}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-[10px]">
                {playlist.track_count}{" "}
                {playlist.track_count === 1 ? "canción" : "canciones"}
              </span>
              {duration > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[10px]">{formatHumanDuration(duration)}</span>
                </>
              )}
              {playlist.youtube_playlist_id && (
                <>
                  <span>·</span>
                  <span
                    className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500"
                    title="Sincronizada con YouTube"
                  >
                    <Youtube className="h-2.5 w-2.5 fill-current" />
                    <span>YouTube</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <ActionMenu
            title="Opciones de playlist"
            items={[
              {
                label: "Eliminar playlist",
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: "danger",
                onClick: () => onDeleteRequest(playlist),
              },
            ]}
          />
        </div>
      </div>
    );
  },
);
PlaylistRow.displayName = "PlaylistRow";

// ==========================================
// Subcomponente Memoizado: Fila de Canción en Detalle
// ==========================================
interface PlaylistTrackRowProps {
  index: number;
  track: Track;
  isCurrent: boolean;
  onPlay: (track: Track) => void;
  onRemove: (track: Track) => void;
}

const PlaylistTrackRow = React.memo(
  ({ index, track, isCurrent, onPlay, onRemove }: PlaylistTrackRowProps) => {
    const thumbUrl = toAssetUrl(track.thumbnail_path);

    const handleCopyLink = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(
          `https://www.youtube.com/watch?v=${track.youtube_id}`,
        );
        toast.info("Enlace copiado", "Se copió el enlace al portapapeles");
      } catch (err) {
        console.error("No se pudo copiar el enlace al portapapeles:", err);
      }
    }, [track.youtube_id]);

    const handleDoubleClick = useCallback(
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
        className={`group flex select-none items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
          track.is_missing
            ? "border-amber-500/50 bg-amber-500/10 cursor-not-allowed"
            : isCurrent
              ? "border-primary bg-primary/5 shadow-2xs cursor-pointer"
              : "border-border bg-card hover:border-primary/30 hover:bg-muted/60 cursor-pointer"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {/* Índice / Posición */}
          <span className="w-5 text-center text-xs font-semibold text-muted-foreground group-hover:hidden">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => onPlay(track)}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`Reproducir ${track.title}`}
            disabled={track.is_missing}
            className="hidden h-5 w-5 items-center justify-center text-primary group-hover:flex disabled:opacity-40"
          >
            <Play className="h-4 w-4 fill-current" />
          </button>

          {/* Miniatura */}
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/60">
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
          </div>

          {/* Título y Artista */}
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-sm font-medium ${
                isCurrent ? "font-semibold text-primary" : "text-foreground"
              }`}
              title={track.title}
            >
              {track.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
          </div>
        </div>

        {/* Duración y Badges */}
        <div
          className="flex items-center gap-3"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {track.is_missing && (
            <Badge tone="warning" className="text-[10px]">
              No disponible
            </Badge>
          )}

          <span className="text-xs text-muted-foreground font-mono">
            {formatDuration(track.duration)}
          </span>

          <ActionMenu
            title="Opciones de la pista"
            items={[
              {
                label: "Copiar enlace de YouTube",
                icon: <LinkIcon className="h-3.5 w-3.5" />,
                onClick: handleCopyLink,
              },
              {
                label: "Quitar de la playlist",
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: "danger",
                onClick: () => onRemove(track),
              },
            ]}
          />
        </div>
      </div>
    );
  },
);
PlaylistTrackRow.displayName = "PlaylistTrackRow";

// ==========================================
// Componente Principal: PlaylistsView
// ==========================================
export const PlaylistsView = React.memo(() => {
  const [title, setTitle] = useState("");
  const [youtubePlaylistId, setYoutubePlaylistId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackSearchQuery, setTrackSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [removingTrackId, setRemovingTrackId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: "danger" | "warning";
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    tone: "danger",
    onConfirm: async () => {},
  });

  const playlists = useLibraryStore((s) => s.playlists);
  const tracks = useLibraryStore((s) => s.tracks);
  const playlistTrackMap = useLibraryStore((s) => s.playlistTrackMap);
  const activePlaylist = useLibraryStore((s) => s.activePlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const selectPlaylist = useLibraryStore((s) => s.selectPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  // Mapa de duraciones acumuladas por playlist
  const playlistDurations = useMemo(() => {
    const map: Record<number, number> = {};
    for (const track of tracks) {
      const assigned = playlistTrackMap[track.id] || [];
      for (const plId of assigned) {
        map[plId] = (map[plId] || 0) + (track.duration || 0);
      }
    }
    return map;
  }, [tracks, playlistTrackMap]);

  // Filtrado de playlists para la vista principal
  const filteredPlaylists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter(
      (pl) =>
        pl.title.toLowerCase().includes(q) ||
        (pl.youtube_playlist_id && pl.youtube_playlist_id.toLowerCase().includes(q)),
    );
  }, [playlists, searchQuery]);

  // Estadísticas de la playlist activa
  const { totalDuration, totalBytes } = useMemo(() => {
    if (!activePlaylist) return { totalDuration: 0, totalBytes: 0 };
    let duration = 0;
    let bytes = 0;
    for (const t of activePlaylist.tracks) {
      duration += t.duration || 0;
      bytes += t.file_size || 0;
    }
    return { totalDuration: duration, totalBytes: bytes };
  }, [activePlaylist]);

  // Filtrado de canciones dentro de la playlist activa
  const filteredActiveTracks = useMemo(() => {
    if (!activePlaylist) return [];
    const q = trackSearchQuery.trim().toLowerCase();
    if (!q) return activePlaylist.tracks;
    return activePlaylist.tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  }, [activePlaylist, trackSearchQuery]);

  // Manejo de creación de playlist
  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const parsed = playlistFormSchema.safeParse({
        title,
        youtubePlaylistId: youtubePlaylistId || undefined,
      });

      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Datos de playlist inválidos");
        return;
      }

      setIsCreating(true);
      try {
        const created = await createPlaylist(
          parsed.data.title,
          parsed.data.youtubePlaylistId,
        );
        setTitle("");
        setYoutubePlaylistId("");
        setIsCreateOpen(false);
        await selectPlaylist(created.id);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "No se pudo crear la playlist",
        );
      } finally {
        setIsCreating(false);
      }
    },
    [title, youtubePlaylistId, createPlaylist, selectPlaylist],
  );

  // Manejo de eliminación de playlist
  const handleDeletePlaylist = useCallback(
    async (id: number) => {
      setDeletingId(id);
      try {
        await deletePlaylist(id);
      } finally {
        setDeletingId(null);
      }
    },
    [deletePlaylist],
  );

  const requestDeletePlaylist = useCallback(
    (pl: Playlist) => {
      setConfirmModal({
        isOpen: true,
        title: "¿Estás seguro de eliminar esta playlist?",
        description: `La playlist "${pl.title}" será eliminada de tu base de datos. Las canciones individuales seguirán disponibles en tu biblioteca.`,
        confirmLabel: "Sí, eliminar playlist",
        tone: "danger",
        onConfirm: async () => {
          await handleDeletePlaylist(pl.id);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [handleDeletePlaylist],
  );

  // Manejo de quitar pista de la playlist activa
  const handleRemoveTrack = useCallback(
    async (playlistId: number, trackId: number) => {
      setRemovingTrackId(trackId);
      try {
        await removeTrackFromPlaylist(playlistId, trackId);
      } finally {
        setRemovingTrackId(null);
      }
    },
    [removeTrackFromPlaylist],
  );

  const requestRemoveTrack = useCallback(
    (track: Track) => {
      if (!activePlaylist) return;
      setConfirmModal({
        isOpen: true,
        title: "¿Estás seguro de quitar esta canción?",
        description: `Se desvinculará "${track.title}" de la playlist "${activePlaylist.playlist.title}". Seguirá disponible en tu biblioteca.`,
        confirmLabel: "Sí, quitar de playlist",
        tone: "warning",
        onConfirm: async () => {
          await handleRemoveTrack(activePlaylist.playlist.id, track.id);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [activePlaylist, handleRemoveTrack],
  );

  // Reproducción de playlist completa
  const handlePlayPlaylist = useCallback(() => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) {
      return;
    }
    if (activePlaylistId === activePlaylist.playlist.id) {
      togglePlayPause();
      return;
    }
    const firstPlayable = activePlaylist.tracks.find((t) => !t.is_missing);
    if (firstPlayable) {
      playTrack(firstPlayable, activePlaylist.tracks, activePlaylist.playlist.id);
    }
  }, [activePlaylist, activePlaylistId, playTrack, togglePlayPause]);

  // Reproducción rápida por ID desde la vista de lista/cuadrícula
  const handlePlayPlaylistById = useCallback(
    async (playlistId: number) => {
      if (activePlaylistId === playlistId) {
        togglePlayPause();
        return;
      }
      await selectPlaylist(playlistId);
      const currentActive = useLibraryStore.getState().activePlaylist;
      const tracksToPlay =
        currentActive?.playlist.id === playlistId ? currentActive.tracks : [];
      const firstPlayable = tracksToPlay.find((t) => !t.is_missing);
      if (firstPlayable) {
        playTrack(firstPlayable, tracksToPlay, playlistId);
      }
    },
    [activePlaylistId, playTrack, selectPlaylist, togglePlayPause],
  );

  // Navegación de retorno hacia la vista general de todas las playlists
  const handleBackToPlaylists = useCallback(() => {
    void selectPlaylist(null);
    setTrackSearchQuery("");
  }, [selectPlaylist]);

  // ==========================================
  // Render: Pantalla de Detalle de Playlist
  // ==========================================
  if (activePlaylist) {
    const coverUrl = toAssetUrl(activePlaylist.playlist.cover_path);

    return (
      <section className="flex h-full flex-col overflow-hidden">
        {/* Barra superior de navegación y retorno */}
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToPlaylists}
            className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Playlists</span>
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={handleBackToPlaylists}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Playlists
            </button>
            <span>/</span>
            <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {activePlaylist.playlist.title}
            </span>
          </div>
        </div>

        {/* Contenido scrolleable de la vista de detalle */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {/* Hero Banner de la Playlist */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 rounded-2xl border border-border bg-gradient-to-b from-card/90 to-card p-6 shadow-xs">
            {/* Portada Principal */}
            <div className="relative h-40 w-40 sm:h-48 sm:w-48 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-md flex items-center justify-center">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={activePlaylist.playlist.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ListMusic className="h-16 w-16 text-muted-foreground/50" />
              )}
            </div>

            {/* Información y Estadísticas */}
            <div className="flex min-w-0 flex-1 flex-col justify-end text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {activePlaylist.playlist.youtube_playlist_id
                  ? "Playlist vinculada a YouTube"
                  : "Playlist"}
              </span>

              <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight break-words">
                {activePlaylist.playlist.title}
              </h1>

              {/* Estadísticas de la playlist */}
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {activePlaylist.tracks.length}{" "}
                  {activePlaylist.tracks.length === 1 ? "canción" : "canciones"}
                </span>
                {totalDuration > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatHumanDuration(totalDuration)}
                    </span>
                  </>
                )}
                {totalBytes > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      {formatBytes(totalBytes)}
                    </span>
                  </>
                )}
                {activePlaylist.playlist.youtube_playlist_id && (
                  <>
                    <span>·</span>
                    <span
                      className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500"
                      title="Sincronizada con YouTube"
                    >
                      <Youtube className="h-3 w-3 fill-current" />
                      <span>YouTube</span>
                    </span>
                  </>
                )}
              </div>

              {/* Botones de acción de la playlist */}
              <div className="mt-5 flex items-center justify-center sm:justify-start gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handlePlayPlaylist}
                  disabled={activePlaylist.tracks.length === 0}
                  className="gap-2 shadow-sm font-semibold"
                >
                  {activePlaylistId === activePlaylist.playlist.id && isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 fill-current" />
                      Pausar Playlist
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      Reproducir Playlist
                    </>
                  )}
                </Button>

                <ActionMenu
                  title="Opciones de la playlist"
                  items={[
                    {
                      label: "Eliminar playlist",
                      icon: <Trash2 className="h-3.5 w-3.5" />,
                      variant: "danger",
                      onClick: () => requestDeletePlaylist(activePlaylist.playlist),
                    },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Sección de Canciones de la Playlist */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Canciones ({activePlaylist.tracks.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Listado completo de temas asociados a esta lista de reproducción.
                </p>
              </div>

              {activePlaylist.tracks.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={trackSearchQuery}
                    onChange={(e) => setTrackSearchQuery(e.target.value)}
                    placeholder="Filtrar canciones..."
                    className="pl-8 text-xs h-8"
                  />
                  {trackSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTrackSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Listado de Pistas */}
            {activePlaylist.tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Music className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Esta playlist aún no tiene canciones
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Ve a la Biblioteca para agregar tus temas preferidos utilizando el
                  menú de opciones de cada pista.
                </p>
              </div>
            ) : filteredActiveTracks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No se encontraron canciones que coincidan con &quot;{trackSearchQuery}
                &quot;
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActiveTracks.map((track, index) => (
                  <PlaylistTrackRow
                    key={track.youtube_id}
                    index={index}
                    track={track}
                    isCurrent={track.youtube_id === currentTrack?.youtube_id}
                    onPlay={(t) =>
                      playTrack(t, activePlaylist.tracks, activePlaylist.playlist.id)
                    }
                    onRemove={requestRemoveTrack}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          description={confirmModal.description}
          confirmLabel={confirmModal.confirmLabel}
          tone={confirmModal.tone}
          isLoading={Boolean(deletingId || removingTrackId)}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        />
      </section>
    );
  }

  // ==========================================
  // Render: Pantalla Principal (Todas las Playlists)
  // ==========================================
  return (
    <section className="flex h-full flex-col overflow-hidden">
      {/* Cabecera Principal */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Tus Playlists
            </h1>
            <Badge tone="default">{playlists.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Colecciones de música organizadas en tu biblioteca personal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Buscador de Playlists */}
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar playlist..."
              className="pl-8 text-xs h-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Selector de modo de vista: Cuadrícula / Lista */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista en cuadrícula"
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="Vista en lista"
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Botón para desplegar formulario de creación */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen((prev) => !prev)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nueva Playlist</span>
          </Button>
        </div>
      </div>

      {/* Formulario desplegable para nueva playlist */}
      {isCreateOpen && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs shrink-0 animate-in fade-in duration-150"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de la nueva playlist..."
            className="min-w-[220px] flex-1"
            autoFocus
          />
          <Input
            value={youtubePlaylistId}
            onChange={(e) => setYoutubePlaylistId(e.target.value)}
            placeholder="ID de Playlist de YouTube (opcional)"
            className="w-64"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isCreating ? "Creando..." : "Crear Playlist"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCreateOpen(false);
                setFormError(null);
              }}
            >
              Cancelar
            </Button>
          </div>

          {formError && <p className="w-full text-xs text-destructive">{formError}</p>}
        </form>
      )}

      {/* Contenedor scrolleable a ancho completo */}
      <div className="flex-1 overflow-y-auto pr-1">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ListMusic className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              No hay playlists creadas todavía
            </h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Crea tu primera lista de reproducción para agrupar tus canciones favoritas
              por géneros o álbumes.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-2"
            >
              <Plus className="h-4 w-4" />
              Crear mi primera playlist
            </Button>
          </div>
        ) : filteredPlaylists.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              No se encontraron playlists
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ninguna playlist coincide con el término &quot;{searchQuery}&quot;
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-3 text-xs"
            >
              Limpiar filtro
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 pb-4">
            {filteredPlaylists.map((pl) => (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                duration={playlistDurations[pl.id] || 0}
                isCurrentlyPlaying={activePlaylistId === pl.id && isPlaying}
                onSelect={(id) => void selectPlaylist(id)}
                onPlay={(id) => void handlePlayPlaylistById(id)}
                onDeleteRequest={requestDeletePlaylist}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {filteredPlaylists.map((pl) => (
              <PlaylistRow
                key={pl.id}
                playlist={pl}
                duration={playlistDurations[pl.id] || 0}
                isCurrentlyPlaying={activePlaylistId === pl.id && isPlaying}
                onSelect={(id) => void selectPlaylist(id)}
                onPlay={(id) => void handlePlayPlaylistById(id)}
                onDeleteRequest={requestDeletePlaylist}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        tone={confirmModal.tone}
        isLoading={Boolean(deletingId || removingTrackId)}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
});
PlaylistsView.displayName = "PlaylistsView";
