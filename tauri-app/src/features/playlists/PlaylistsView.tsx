import { ListMusic, Play, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Badge, Button, Input } from "@/components/ui/Primitives";
import { formatDuration } from "@/lib/utils";
import { playlistFormSchema } from "@/schemas/validation";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";

export const PlaylistsView = React.memo(() => {
  const [title, setTitle] = useState("");
  const [youtubePlaylistId, setYoutubePlaylistId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const playlists = useLibraryStore((s) => s.playlists);
  const activePlaylist = useLibraryStore((s) => s.activePlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const selectPlaylist = useLibraryStore((s) => s.selectPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);

  const playTrack = usePlayerStore((s) => s.playTrack);

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

      try {
        const created = await createPlaylist(
          parsed.data.title,
          parsed.data.youtubePlaylistId,
        );
        setTitle("");
        setYoutubePlaylistId("");
        await selectPlaylist(created.id);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "No se pudo crear la playlist",
        );
      }
    },
    [title, youtubePlaylistId, createPlaylist, selectPlaylist],
  );

  const handlePlayPlaylist = useCallback(() => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) {
      return;
    }
    const firstPlayable = activePlaylist.tracks.find((t) => !t.is_missing);
    if (firstPlayable) {
      playTrack(firstPlayable, activePlaylist.tracks);
    }
  }, [activePlaylist, playTrack]);

  return (
    <section className="flex h-full flex-col gap-5">
      <header>
        <h2 className="text-xl font-bold text-white">Gestión de Playlists</h2>
        <p className="text-xs text-slate-400">
          Relación muchos a muchos (
          <code className="text-slate-300">playlist_tracks</code>) con integridad
          referencial <code className="text-slate-300">ON DELETE CASCADE</code>
        </p>
      </header>

      {/* Formulario de nueva playlist */}
      <form
        onSubmit={(e) => void handleCreate(e)}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/75 p-4"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre de la nueva playlist..."
          className="min-w-[220px] flex-1"
        />
        <Input
          value={youtubePlaylistId}
          onChange={(e) => setYoutubePlaylistId(e.target.value)}
          placeholder="ID de Playlist de YouTube (opcional)"
          className="w-64"
        />
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Crear Playlist
        </Button>

        {formError && <p className="w-full text-xs text-rose-400">{formError}</p>}
      </form>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
        {/* Lista de Playlists */}
        <div className="space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          {playlists.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No hay playlists creadas todavía
            </p>
          ) : (
            playlists.map((pl) => {
              const isSelected = activePlaylist?.playlist.id === pl.id;
              return (
                <div
                  key={pl.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? "border-red-500/40 bg-red-950/20"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void selectPlaylist(pl.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ListMusic className="h-4 w-4 text-red-400" />
                      <span className="truncate text-sm font-semibold text-slate-100">
                        {pl.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>{pl.track_count} pistas</span>
                      {pl.youtube_playlist_id && (
                        <code className="rounded bg-slate-800 px-1 text-[10px]">
                          {pl.youtube_playlist_id}
                        </code>
                      )}
                    </div>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void deletePlaylist(pl.id)}
                    title="Eliminar playlist"
                  >
                    <Trash2 className="h-4 w-4 text-slate-400 hover:text-rose-400" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Detalle de la Playlist seleccionada */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
          {!activePlaylist ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              Selecciona una playlist para ver y reproducir sus pistas
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {activePlaylist.playlist.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activePlaylist.tracks.length} pistas asociadas
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePlayPlaylist}
                  disabled={activePlaylist.tracks.length === 0}
                >
                  <Play className="h-4 w-4" />
                  Reproducir Playlist
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {activePlaylist.tracks.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-500">
                    Esta playlist aún no tiene pistas. Puedes agregarlas desde la
                    Biblioteca.
                  </p>
                ) : (
                  activePlaylist.tracks.map((track) => (
                    <div
                      key={track.youtube_id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {track.title}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {track.artist} · {formatDuration(track.duration)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge tone="default">{track.file_extension}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={track.is_missing}
                          onClick={() => playTrack(track, activePlaylist.tracks)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            void removeTrackFromPlaylist(
                              activePlaylist.playlist.id,
                              track.id,
                            )
                          }
                          title="Quitar de la playlist"
                        >
                          <Trash2 className="h-4 w-4 text-rose-400" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
});
PlaylistsView.displayName = "PlaylistsView";
