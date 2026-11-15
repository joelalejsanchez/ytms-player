import { Link, ListMusic, Loader2, Music, Play, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Button, Input } from "@/components/ui/Primitives";
import { formatDuration, toAssetUrl } from "@/lib/utils";
import { playlistFormSchema } from "@/schemas/validation";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";

export const PlaylistsView = React.memo(() => {
  const [title, setTitle] = useState("");
  const [youtubePlaylistId, setYoutubePlaylistId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
  const activePlaylist = useLibraryStore((s) => s.activePlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const selectPlaylist = useLibraryStore((s) => s.selectPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
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

      setIsCreating(true);
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
      } finally {
        setIsCreating(false);
      }
    },
    [title, youtubePlaylistId, createPlaylist, selectPlaylist],
  );

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

  const handlePlayPlaylist = useCallback(() => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) {
      return;
    }
    const firstPlayable = activePlaylist.tracks.find((t) => !t.is_missing);
    if (firstPlayable) {
      playTrack(firstPlayable, activePlaylist.tracks);
    }
  }, [activePlaylist, playTrack]);

  const handlePlayPlaylistById = useCallback(
    async (playlistId: number) => {
      // Abre la playlist en la vista de detalle como al hacer click en la card
      await selectPlaylist(playlistId);
      const currentActive = useLibraryStore.getState().activePlaylist;
      const tracksToPlay =
        currentActive?.playlist.id === playlistId ? currentActive.tracks : [];
      const firstPlayable = tracksToPlay.find((t) => !t.is_missing);
      if (firstPlayable) {
        playTrack(firstPlayable, tracksToPlay);
      }
    },
    [playTrack, selectPlaylist],
  );

  return (
    <section className="flex h-full flex-col gap-5">
      {/* Formulario de nueva playlist */}
      <form
        onSubmit={(e) => void handleCreate(e)}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
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
        <Button type="submit" disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isCreating ? "Creando..." : "Crear Playlist"}
        </Button>

        {formError && <p className="w-full text-xs text-destructive">{formError}</p>}
      </form>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
        {/* Lista de Playlists */}
        <div className="space-y-2 overflow-y-auto rounded-xl border border-border bg-card/40 p-3">
          {playlists.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No hay playlists creadas todavía
            </p>
          ) : (
            playlists.map((pl) => {
              const isSelected = activePlaylist?.playlist.id === pl.id;
              return (
                <div
                  key={pl.id}
                  onClick={() => void selectPlaylist(pl.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-card"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/60"
                  }`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePlayPlaylistById(pl.id);
                    }}
                    title={`Reproducir playlist ${pl.title}`}
                    className={`mr-2 shrink-0 hover:bg-muted ${
                      isSelected ? "text-primary" : "text-foreground"
                    }`}
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </Button>

                  <div className="min-w-0 flex-1 text-left select-none">
                    <div className="flex items-center gap-2">
                      <ListMusic className="h-4 w-4 text-primary" />
                      <span
                        className={`truncate text-sm font-semibold ${
                          isSelected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {pl.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{pl.track_count} pistas</span>
                      {pl.youtube_playlist_id && (
                        <code className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                          {pl.youtube_playlist_id}
                        </code>
                      )}
                    </div>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      isLoading={deletingId === pl.id}
                      title="Opciones de la playlist"
                      items={[
                        {
                          label: "Eliminar playlist",
                          icon: <Trash2 className="h-3.5 w-3.5" />,
                          variant: "danger",
                          onClick: () => {
                            setConfirmModal({
                              isOpen: true,
                              title: "¿Estás seguro de eliminar esta playlist?",
                              description: `La playlist "${pl.title}" será eliminada de tu base de datos. Las canciones individuales seguirán en tu biblioteca.`,
                              confirmLabel: "Sí, eliminar playlist",
                              tone: "danger",
                              onConfirm: async () => {
                                await handleDeletePlaylist(pl.id);
                                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                              },
                            });
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detalle de la Playlist seleccionada */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 p-4 lg:col-span-2">
          {!activePlaylist ? (
            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
              Selecciona una playlist para ver y reproducir sus pistas
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {activePlaylist.playlist.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
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
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    Esta playlist aún no tiene pistas. Puedes agregarlas desde la
                    Biblioteca.
                  </p>
                ) : (
                  activePlaylist.tracks.map((track) => {
                    const thumbUrl = toAssetUrl(track.thumbnail_path);
                    const isCurrent = track.youtube_id === currentTrack?.youtube_id;
                    return (
                      <div
                        key={track.youtube_id}
                        className={`group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
                          track.is_missing
                            ? "border-amber-500/50 bg-amber-500/10"
                            : isCurrent
                              ? "border-primary bg-card"
                              : "border-border bg-card hover:border-primary/30 hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted transform-gpu">
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
                                onClick={() => playTrack(track, activePlaylist.tracks)}
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
                                  isCurrent ? "font-semibold text-primary" : "text-foreground"
                                }`}
                              >
                                {track.title}
                              </p>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {track.artist} · {formatDuration(track.duration)}
                            </p>
                          </div>
                        </div>

                      <div className="flex items-center gap-2">
                        <ActionMenu
                          isLoading={removingTrackId === track.id}
                          title="Opciones de la pista"
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
                              label: "Quitar de la playlist",
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              variant: "danger",
                              onClick: () => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: "¿Estás seguro de quitar esta canción?",
                                  description: `Se desvinculará "${track.title}" de la playlist "${activePlaylist.playlist.title}". Seguirá disponible en tu biblioteca.`,
                                  confirmLabel: "Sí, quitar de playlist",
                                  tone: "warning",
                                  onConfirm: async () => {
                                    await handleRemoveTrack(
                                      activePlaylist.playlist.id,
                                      track.id,
                                    );
                                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                  },
                                });
                              },
                            },
                          ]}
                        />
                      </div>
                    </div>
                  );
                }))}
              </div>
            </>
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
});
PlaylistsView.displayName = "PlaylistsView";
