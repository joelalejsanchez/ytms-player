import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Heart, Play, RefreshCw, Search, ShieldCheck } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Badge, Button, Input } from "@/components/ui/Primitives";
import { TrackRow } from "@/features/library/TrackRow";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import type { Track } from "@/types/models";

type SortField = "created_at" | "title" | "artist" | "duration" | "file_size";

export const LibraryView = React.memo(() => {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [onlyLiked, setOnlyLiked] = useState(false);
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const deleteTrack = useLibraryStore((s) => s.deleteTrack);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const verifyIntegrity = useLibraryStore((s) => s.verifyIntegrity);
  const syncLikes = useLibraryStore((s) => s.syncLikes);

  const currentTrackId = usePlayerStore((s) => s.currentTrack?.youtube_id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueTrack = usePlayerStore((s) => s.enqueueTrack);

  // Filtrado y ordenamiento memoizado (SDD 7.2 useMemo)
  const filteredTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = tracks.filter((track) => {
      if (onlyLiked && !track.liked) {
        return false;
      }
      if (formatFilter !== "all" && track.file_extension !== formatFilter) {
        return false;
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
  }, [tracks, searchQuery, onlyLiked, formatFilter, sortField, sortAsc]);

  // Callbacks estables para hijos memoizados (SDD 7.2 useCallback)
  const handlePlay = useCallback(
    (track: Track) => {
      playTrack(track, filteredTracks);
    },
    [playTrack, filteredTracks],
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
      void deleteTrack(youtubeId, true);
    },
    [deleteTrack],
  );

  const handleAddToPlaylist = useCallback(
    (playlistId: number, trackId: number) => {
      void addTrackToPlaylist(playlistId, trackId);
    },
    [addTrackToPlaylist],
  );

  const handlePlayAll = useCallback(() => {
    const firstPlayable = filteredTracks.find((t) => !t.is_missing);
    if (firstPlayable) {
      playTrack(firstPlayable, filteredTracks);
    }
  }, [filteredTracks, playTrack]);

  // Lista virtualizada para alto rendimiento con grandes bibliotecas (docs/skills/optimization.md)
  const rowVirtualizer = useVirtualizer({
    count: filteredTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Biblioteca Multimedia</h2>
          <p className="text-xs text-slate-400">
            Almacenamiento local indexado por{" "}
            <code className="text-slate-300">youtube_id</code> en SQLite
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void verifyIntegrity()}
            disabled={isLoading}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Verificar Integridad
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void syncLikes()}
            disabled={isLoading || tracks.length === 0}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Sincronizar Likes
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handlePlayAll}
            disabled={filteredTracks.length === 0}
          >
            <Play className="h-4 w-4" />
            Reproducir Todo ({filteredTracks.length})
          </Button>
        </div>
      </header>

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, artista o youtube_id..."
            className="pl-9"
          />
        </div>

        <Button
          variant={onlyLiked ? "primary" : "secondary"}
          size="sm"
          onClick={() => setOnlyLiked((prev) => !prev)}
        >
          <Heart className="h-3.5 w-3.5" />
          Favoritos
        </Button>

        <select
          aria-label="Filtrar por formato"
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200"
        >
          <option value="all">Todos los formatos</option>
          <option value="mp3">MP3</option>
          <option value="m4a">M4A</option>
          <option value="opus">OPUS</option>
        </select>

        <select
          aria-label="Ordenar por"
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200"
        >
          <option value="created_at">Fecha de registro</option>
          <option value="title">Título</option>
          <option value="artist">Artista</option>
          <option value="duration">Duración</option>
          <option value="file_size">Tamaño</option>
        </select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortAsc((prev) => !prev)}
          title="Invertir orden"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortAsc ? "ASC" : "DESC"}
        </Button>

        <Badge tone="default">{filteredTracks.length} pistas</Badge>
      </div>

      {/* Contenedor virtualizado */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-3"
      >
        {filteredTracks.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-300">
              No se encontraron pistas en la biblioteca
            </p>
            <p className="mt-1 text-xs text-slate-500">
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
                  }}
                >
                  <TrackRow
                    track={track}
                    isCurrent={currentTrackId === track.youtube_id}
                    isPlaying={isPlaying}
                    playlists={playlists}
                    onPlay={handlePlay}
                    onEnqueue={handleEnqueue}
                    onToggleLike={handleToggleLike}
                    onDelete={handleDelete}
                    onAddToPlaylist={handleAddToPlaylist}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});
LibraryView.displayName = "LibraryView";
