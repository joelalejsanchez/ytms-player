import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  ListMusic,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { CustomSelect, type SelectOption } from "@/components/ui/CustomSelect";
import { Button, Input } from "@/components/ui/Primitives";
import { MetadataSyncModal } from "@/features/library/MetadataSyncModal";
import { TrackRow } from "@/features/library/TrackRow";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import type { Track } from "@/types/models";

type SortField = "created_at" | "title" | "artist" | "duration" | "file_size";

const FORMAT_OPTIONS: SelectOption[] = [
  { value: "all", label: "Todos los formatos" },
  { value: "mp3", label: "MP3" },
  { value: "m4a", label: "M4A" },
  { value: "opus", label: "OPUS" },
];

const SORT_OPTIONS: SelectOption<SortField>[] = [
  { value: "created_at", label: "Fecha de registro" },
  { value: "title", label: "Título" },
  { value: "artist", label: "Artista" },
  { value: "duration", label: "Duración" },
  { value: "file_size", label: "Tamaño" },
];

export const LibraryView = React.memo(() => {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncingLikes, setIsSyncingLikes] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);

  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const playlistTrackMap = useLibraryStore((s) => s.playlistTrackMap);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const syncStatusByTrack = useLibraryStore((s) => s.syncStatusByTrack);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const deleteTrack = useLibraryStore((s) => s.deleteTrack);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);
  const verifyIntegrity = useLibraryStore((s) => s.verifyIntegrity);
  const syncLikes = useLibraryStore((s) => s.syncLikes);

  const currentTrackId = usePlayerStore((s) => s.currentTrack?.youtube_id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueTrack = usePlayerStore((s) => s.enqueueTrack);

  // Sincronizar selección si se elimina la playlist activa
  useEffect(() => {
    if (
      selectedPlaylistId !== "all" &&
      !playlists.some((p) => String(p.id) === selectedPlaylistId)
    ) {
      setSelectedPlaylistId("all");
    }
  }, [playlists, selectedPlaylistId]);

  // Opciones para el selector de filtrado por playlist
  const playlistOptions: SelectOption[] = useMemo(() => {
    return [
      {
        value: "all",
        label: "Todas las playlists",
        icon: <ListMusic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
      },
      ...playlists.map((pl) => ({
        value: String(pl.id),
        label: `${pl.title} (${pl.track_count})`,
        icon: <ListMusic className="h-3.5 w-3.5 text-primary shrink-0" />,
      })),
    ];
  }, [playlists]);

  // Filtrado y ordenamiento memoizado (SDD 7.2 useMemo)
  const filteredTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activePlaylistId =
      selectedPlaylistId !== "all" ? Number(selectedPlaylistId) : null;

    const filtered = tracks.filter((track) => {
      if (formatFilter !== "all" && track.file_extension !== formatFilter) {
        return false;
      }
      if (activePlaylistId !== null) {
        const assignedPlaylists = playlistTrackMap[track.id] || [];
        if (!assignedPlaylists.includes(activePlaylistId)) {
          return false;
        }
      }
      if (!query) {
        return true;
      }
      return (
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.youtube_id.toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "artist":
          comparison = a.artist.localeCompare(b.artist);
          break;
        case "duration":
          comparison = a.duration - b.duration;
          break;
        case "file_size":
          comparison = a.file_size - b.file_size;
          break;
        case "created_at":
        default:
          comparison = a.created_at.localeCompare(b.created_at);
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [
    tracks,
    searchQuery,
    formatFilter,
    selectedPlaylistId,
    playlistTrackMap,
    sortField,
    sortAsc,
  ]);

  // Callbacks estables para hijos memoizados (SDD 7.2 useCallback)
  const handlePlay = useCallback(
    (track: Track) => {
      const targetPlaylistId =
        selectedPlaylistId !== "all" ? Number(selectedPlaylistId) : null;
      playTrack(track, filteredTracks, targetPlaylistId);
    },
    [playTrack, filteredTracks, selectedPlaylistId],
  );

  const handleEnqueue = useCallback(
    (track: Track) => {
      enqueueTrack(track);
    },
    [enqueueTrack],
  );

  const handleToggleLike = useCallback(
    (youtubeId: string, nextLiked: boolean | null) => {
      void toggleLike(youtubeId, nextLiked);
    },
    [toggleLike],
  );

  const handleDelete = useCallback(
    (youtubeId: string) => {
      const found = tracks.find((t) => t.youtube_id === youtubeId);
      if (found) {
        setTrackToDelete(found);
      }
    },
    [tracks],
  );

  const handleVerifyIntegrity = useCallback(async () => {
    setIsVerifying(true);
    try {
      await verifyIntegrity();
    } finally {
      setIsVerifying(false);
    }
  }, [verifyIntegrity]);

  const handleSyncLikes = useCallback(async () => {
    setIsSyncingLikes(true);
    try {
      await syncLikes();
    } finally {
      setIsSyncingLikes(false);
    }
  }, [syncLikes]);

  const handleTogglePlaylist = useCallback(
    async (playlistId: number, trackId: number, willAdd: boolean) => {
      if (willAdd) {
        await addTrackToPlaylist(playlistId, trackId);
      } else {
        await removeTrackFromPlaylist(playlistId, trackId);
      }
    },
    [addTrackToPlaylist, removeTrackFromPlaylist],
  );

  const handlePlayAll = useCallback(() => {
    const playableFiltered = filteredTracks.filter((t) => !t.is_missing);
    if (playableFiltered.length === 0) return;

    const targetPlaylistId =
      selectedPlaylistId !== "all" ? Number(selectedPlaylistId) : null;

    usePlayerStore.getState().playPlaylist(playableFiltered, targetPlaylistId);
  }, [filteredTracks, selectedPlaylistId]);

  // Lista virtualizada para alto rendimiento con grandes bibliotecas (docs/skills/optimization.md)
  const rowVirtualizer = useVirtualizer({
    count: filteredTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  return (
    <section className="flex h-full flex-col gap-3">
      {/* 1. Contenedor transparente superior: Búsqueda + Filtro de Playlist + Menú dropdown de 3 puntos */}
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-2.5 w-full relative z-20">
        <div className="relative w-full min-w-0">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, artista o youtube_id..."
            className="h-9 w-full pl-9 bg-card"
          />
        </div>

        <CustomSelect
          value={selectedPlaylistId}
          onChange={setSelectedPlaylistId}
          options={playlistOptions}
          ariaLabel="Filtrar por playlist"
          className="w-full min-w-0"
          triggerClassName="w-full h-9 text-xs bg-card"
        />

        <ActionMenu
          title="Opciones de biblioteca"
          triggerClassName="h-9 w-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs shrink-0 flex items-center justify-center"
          items={[
            {
              label: "Actualizar información",
              icon: <Sparkles className="h-4 w-4 text-amber-500" />,
              onClick: () => setIsMetadataModalOpen(true),
              disabled:
                tracks.length === 0 || isLoading || isVerifying || isSyncingLikes,
            },
            {
              label: isVerifying ? "Comprobando..." : "Comprobar archivos",
              icon: isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              ),
              onClick: () => void handleVerifyIntegrity(),
              disabled: isLoading || isVerifying || isSyncingLikes,
            },
            {
              label: isSyncingLikes ? "Sincronizando..." : "Sincronizar Me gusta",
              icon: isSyncingLikes ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="h-4 w-4 text-sky-500" />
              ),
              onClick: () => void handleSyncLikes(),
              disabled:
                isLoading || isVerifying || isSyncingLikes || tracks.length === 0,
            },
          ]}
        />
      </div>

      {/* 2. Contenedor flex sin fondo: Reproducir todo a la izquierda + Filtros a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full relative z-10">
        <Button
          variant="primary"
          size="sm"
          onClick={handlePlayAll}
          disabled={filteredTracks.length === 0}
        >
          <Play className="h-4 w-4" />
          Reproducir Todo ({filteredTracks.length})
        </Button>

        <div className="flex items-center gap-2">
          <CustomSelect
            value={formatFilter}
            onChange={setFormatFilter}
            options={FORMAT_OPTIONS}
            ariaLabel="Filtrar por formato"
            className="w-40 shrink-0"
            triggerClassName="w-full bg-card"
          />

          <CustomSelect
            value={sortField}
            onChange={(v) => setSortField(v as SortField)}
            options={SORT_OPTIONS}
            ariaLabel="Ordenar por"
            className="w-44 shrink-0"
            triggerClassName="w-full bg-card"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortAsc((prev) => !prev)}
            title={`Orden: ${sortAsc ? "Ascendente" : "Descendente"}`}
            className="h-8 w-[72px] shrink-0 justify-center px-2 text-xs text-muted-foreground hover:text-foreground border border-border bg-card"
          >
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
            <span>{sortAsc ? "ASC" : "DESC"}</span>
          </Button>
        </div>
      </div>

      {/* Contenedor virtualizado */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/40 p-3 relative z-0"
      >
        {filteredTracks.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-foreground">
              No se encontraron pistas en la biblioteca
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Descarga contenido desde la pestaña Descargas o selecciona un Workspace
              existente.
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const track = filteredTracks[virtualRow.index];
              return (
                <div
                  key={track.youtube_id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: "8px",
                    zIndex: filteredTracks.length - virtualRow.index,
                  }}
                >
                  <TrackRow
                    track={track}
                    isCurrent={currentTrackId === track.youtube_id}
                    isPlaying={isPlaying}
                    playlists={playlists}
                    assignedPlaylistIds={playlistTrackMap[track.id] || []}
                    syncStatus={syncStatusByTrack[track.youtube_id]}
                    isDeleting={deletingId === track.youtube_id}
                    onPlay={handlePlay}
                    onEnqueue={handleEnqueue}
                    onToggleLike={handleToggleLike}
                    onDelete={handleDelete}
                    onTogglePlaylist={handleTogglePlaylist}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MetadataSyncModal
        isOpen={isMetadataModalOpen}
        onClose={() => setIsMetadataModalOpen(false)}
      />

      <ConfirmationModal
        isOpen={Boolean(trackToDelete)}
        title="¿Estás seguro de eliminar esta canción?"
        description={`La pista "${trackToDelete?.title ?? ""}" será eliminada de la biblioteca y sus archivos de audio y carátula se borrarán permanentemente del disco.`}
        confirmLabel="Sí, eliminar canción"
        tone="danger"
        isLoading={Boolean(deletingId)}
        onConfirm={async () => {
          if (!trackToDelete) return;
          setDeletingId(trackToDelete.youtube_id);
          try {
            await deleteTrack(trackToDelete.youtube_id, true);
          } finally {
            setDeletingId(null);
            setTrackToDelete(null);
          }
        }}
        onCancel={() => setTrackToDelete(null)}
      />
    </section>
  );
});
LibraryView.displayName = "LibraryView";
