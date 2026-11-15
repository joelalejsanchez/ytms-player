import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FolderPlus,
  Library,
  ListMusic,
  Loader2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  RadioButton,
} from "@/components/ui/Primitives";
import { cn, formatDuration } from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import type { AudioFormat, PlaylistPreviewDto } from "@/types/models";

export interface PlaylistImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  audioFormat: AudioFormat;
  forceOverwrite: boolean;
  onSuccess: () => Promise<void>;
}

export const PlaylistImportModal: React.FC<PlaylistImportModalProps> = ({
  isOpen,
  onClose,
  url,
  audioFormat,
  forceOverwrite,
  onSuccess,
}) => {
  const playlists = useLibraryStore((s) => s.playlists);
  const libraryTracks = useLibraryStore((s) => s.tracks);
  const startDownloadTask = useDownloadStore((s) => s.startDownloadTask);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PlaylistPreviewDto | null>(null);

  const [destination, setDestination] = useState<"new" | "existing" | "library_only">(
    "new",
  );
  const [newTitle, setNewTitle] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [unlinkRemoved, setUnlinkRemoved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());

  // Set de IDs ya descargados para consulta O(1)
  const existingTrackIds = useMemo(() => {
    return new Set(libraryTracks.map((t) => t.youtube_id));
  }, [libraryTracks]);

  // Canciones actualmente seleccionadas por el usuario
  const selectedItems = useMemo(() => {
    if (!previewData) return [];
    return previewData.items.filter((i) => selectedTrackIds.has(i.youtube_id));
  }, [previewData, selectedTrackIds]);

  const selectedCount = selectedItems.length;

  const downloadedCount = useMemo(() => {
    return selectedItems.filter((i) => existingTrackIds.has(i.youtube_id)).length;
  }, [selectedItems, existingTrackIds]);

  const pendingItems = useMemo(() => {
    return forceOverwrite
      ? selectedItems
      : selectedItems.filter((i) => !existingTrackIds.has(i.youtube_id));
  }, [selectedItems, forceOverwrite, existingTrackIds]);

  const pendingCount = pendingItems.length;

  // Acciones de selección masiva
  const selectAll = useCallback(() => {
    if (!previewData) return;
    setSelectedTrackIds(new Set(previewData.items.map((i) => i.youtube_id)));
  }, [previewData]);

  const selectUnder15Min = useCallback(() => {
    if (!previewData) return;
    setSelectedTrackIds(
      new Set(
        previewData.items
          .filter((i) => (i.duration || 0) < 900)
          .map((i) => i.youtube_id),
      ),
    );
  }, [previewData]);

  const selectUnder7Min = useCallback(() => {
    if (!previewData) return;
    setSelectedTrackIds(
      new Set(
        previewData.items
          .filter((i) => (i.duration || 0) < 420)
          .map((i) => i.youtube_id),
      ),
    );
  }, [previewData]);

  const deselectAll = useCallback(() => {
    setSelectedTrackIds(new Set());
  }, []);

  const totalTracks = previewData?.items.length ?? 0;

  const tracksUnder7Min = useMemo(() => {
    if (!previewData) return [];
    return previewData.items.filter((i) => (i.duration || 0) < 420);
  }, [previewData]);

  const tracksUnder15Min = useMemo(() => {
    if (!previewData) return [];
    return previewData.items.filter((i) => (i.duration || 0) < 900);
  }, [previewData]);

  // Precedencia de estilos: Ninguna si 0; Todas si coincide con el total; luego < 7 min o < 15 min
  const activePreset = useMemo<"none" | "all" | "7min" | "15min" | null>(() => {
    if (!previewData || totalTracks === 0) return null;

    if (selectedCount === 0) {
      return "none";
    }

    if (selectedCount === totalTracks) {
      return "all";
    }

    if (
      tracksUnder7Min.length > 0 &&
      selectedCount === tracksUnder7Min.length &&
      tracksUnder7Min.every((i) => selectedTrackIds.has(i.youtube_id))
    ) {
      return "7min";
    }

    if (
      tracksUnder15Min.length > 0 &&
      selectedCount === tracksUnder15Min.length &&
      tracksUnder15Min.every((i) => selectedTrackIds.has(i.youtube_id))
    ) {
      return "15min";
    }

    return null;
  }, [
    previewData,
    totalTracks,
    selectedCount,
    tracksUnder7Min,
    tracksUnder15Min,
    selectedTrackIds,
  ]);

  const toggleTrack = useCallback((youtubeId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(youtubeId)) {
        next.delete(youtubeId);
      } else {
        next.add(youtubeId);
      }
      return next;
    });
  }, []);

  // Cargar preview masivo al abrir el modal
  const loadPreview = useCallback(async () => {
    if (!url.trim()) return;
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const data = await tauriApi.previewPlaylistUrl(url.trim());
      setPreviewData(data);
      const defaultTitle = data.playlist_title?.trim() || "Nueva Playlist";
      setNewTitle(defaultTitle);

      // Canciones menores a 7 minutos (420 segundos) marcadas por defecto
      const defaultSelected = new Set(
        data.items
          .filter((item) => (item.duration || 0) < 420)
          .map((item) => item.youtube_id),
      );
      setSelectedTrackIds(defaultSelected);

      // Si existe una playlist local asociada al mismo youtube_playlist_id, sugerir vincularla
      const matched = playlists.find((p) => p.youtube_playlist_id === data.target_id);
      if (matched) {
        setDestination("existing");
        setSelectedPlaylistId(matched.id);
      } else if (playlists.length > 0) {
        setSelectedPlaylistId(playlists[0]?.id ?? null);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "No se pudo obtener la previsualización de la playlist";
      setPreviewError(msg);
      setSelectedTrackIds(new Set());
    } finally {
      setIsLoadingPreview(false);
    }
  }, [url, playlists]);

  useEffect(() => {
    if (isOpen) {
      void loadPreview();
    } else {
      setPreviewData(null);
      setPreviewError(null);
      setSelectedTrackIds(new Set());
      setIsSubmitting(false);
    }
  }, [isOpen, loadPreview]);

  const handleConfirm = async () => {
    if (!previewData || selectedCount === 0) return;
    setIsSubmitting(true);

    try {
      let targetId: number | null = null;

      if (destination === "new") {
        const titleToUse =
          newTitle.trim() || previewData.playlist_title?.trim() || "Playlist";
        const created = await tauriApi.createPlaylist(
          titleToUse,
          previewData.target_id,
        );
        targetId = created.id;
      } else if (destination === "existing") {
        targetId = selectedPlaylistId;
      }

      const allIds = selectedItems.map((i) => i.youtube_id);

      // Sincronización bulk en SQLite: vincular temas ya existentes y opcionalmente desvincular eliminados
      if (targetId !== null) {
        await tauriApi.syncPlaylistTracks(targetId, allIds, unlinkRemoved);
      }

      // Si todas las canciones de la lista ya estaban descargadas:
      // Se vinculan inmediatamente a la playlist sin lanzar descargas ni registrar duplicados en el historial
      if (pendingItems.length === 0) {
        await onSuccess();
        onClose();
        return;
      }

      // Encolar y descargar únicamente los temas verdaderamente pendientes
      for (const item of pendingItems) {
        useDownloadStore.getState().upsertProgressEvent({
          task_id: previewData.target_id,
          youtube_id: item.youtube_id,
          status: "queued",
          progress: 0,
          metadata: {
            youtube_id: item.youtube_id,
            title: item.title,
            artist: item.artist,
            duration: item.duration,
            file_extension: audioFormat,
            thumbnail_path: "",
            audio_path: "",
            file_size: 0,
            playlist_id: previewData.target_id,
            playlist_title: previewData.playlist_title || "Playlist",
          },
        });

        await startDownloadTask({
          url: `https://www.youtube.com/watch?v=${item.youtube_id}`,
          audio_format: audioFormat,
          force_overwrite: forceOverwrite,
          async_mode: true,
          target_playlist_id: targetId,
          skip_playlist: targetId === null,
        });
      }

      await onSuccess();
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Error al procesar la playlist";
      setPreviewError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ListMusic className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Previsualización e Importación de Lista
              </h3>
              <p className="text-xs text-muted-foreground">
                Selecciona cómo organizar las canciones en tu biblioteca local
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Contenido principal */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-xs">
          {isLoadingPreview && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Consultando lista de YouTube sin descargar audio...</p>
            </div>
          )}

          {previewError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/15 p-4 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-2">
                <p>{previewError}</p>
                <Button variant="outline" size="sm" onClick={() => void loadPreview()}>
                  Reintentar
                </Button>
              </div>
            </div>
          )}

          {previewData && !isLoadingPreview && (
            <>
              {/* Información y lista de canciones */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {previewData.playlist_title || "Lista sin título"} (
                      {previewData.items.length} canciones)
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-emerald-500">
                        {downloadedCount} ya en biblioteca
                      </span>
                      {pendingCount > 0 ? (
                        <span>
                          {" "}
                          · <strong className="text-amber-500">
                            {pendingCount}
                          </strong>{" "}
                          pendientes de descarga
                        </span>
                      ) : selectedCount > 0 ? (
                        <span>
                          {" "}
                          ·{" "}
                          <strong className="text-emerald-500">
                            Todas descargadas
                          </strong>
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Badge tone={previewData.content_type === "mix" ? "warning" : "info"}>
                    {previewData.content_type === "mix" ? "Mix" : "Playlist"}
                  </Badge>
                </div>

                {/* Barra de selección rápida */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Seleccionar:
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreset === "all" ? "outline" : "ghost"}
                      onClick={selectAll}
                      className={cn(
                        "h-6 px-2 text-[11px]",
                        activePreset === "all" &&
                          "border-primary text-primary font-semibold shadow-xs",
                      )}
                    >
                      Todas
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreset === "15min" ? "outline" : "ghost"}
                      onClick={selectUnder15Min}
                      className={cn(
                        "h-6 px-2 text-[11px]",
                        activePreset === "15min" &&
                          "border-primary text-primary font-semibold shadow-xs",
                      )}
                    >
                      &lt; 15 min
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreset === "7min" ? "outline" : "ghost"}
                      onClick={selectUnder7Min}
                      className={cn(
                        "h-6 px-2 text-[11px]",
                        activePreset === "7min" &&
                          "border-primary text-primary font-semibold shadow-xs",
                      )}
                    >
                      &lt; 7 min
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreset === "none" ? "outline" : "ghost"}
                      onClick={deselectAll}
                      className={cn(
                        "h-6 px-2 text-[11px]",
                        activePreset === "none" &&
                          "border-primary text-primary font-semibold shadow-xs",
                      )}
                    >
                      Ninguna
                    </Button>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    <strong
                      className={
                        selectedCount > 0 ? "text-foreground" : "text-destructive"
                      }
                    >
                      {selectedCount}
                    </strong>{" "}
                    de {previewData.items.length} seleccionadas
                  </span>
                </div>

                <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border bg-card/60 p-2">
                  {previewData.items.map((item, index) => {
                    const isAlreadyDownloaded = existingTrackIds.has(item.youtube_id);
                    const isSelected = selectedTrackIds.has(item.youtube_id);
                    const isLong = (item.duration || 0) >= 420;

                    return (
                      <div
                        key={`${item.youtube_id}-${index}`}
                        onClick={() => toggleTrack(item.youtube_id)}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-1.5 transition select-none ${
                          isSelected
                            ? "bg-primary/10 hover:bg-primary/15"
                            : "opacity-60 hover:opacity-100 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex shrink-0 items-center"
                          >
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggleTrack(item.youtube_id)}
                            />
                          </div>
                          <span className="w-5 text-right font-mono text-[11px] text-muted-foreground">
                            {index + 1}.
                          </span>
                          <div className="truncate">
                            <p
                              className={`truncate font-medium text-xs ${isSelected ? "text-primary font-semibold" : "text-foreground"}`}
                            >
                              {item.title || item.youtube_id}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {item.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {isLong && (
                            <Badge tone="warning" className="text-[10px] px-1.5 py-0">
                              &ge; 7 min
                            </Badge>
                          )}
                          {isAlreadyDownloaded && (
                            <Badge tone="success" className="text-[10px] px-1.5 py-0">
                              <CheckCircle2 className="h-3 w-3" />
                              Descargada
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(item.duration)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selector de destino */}
              <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
                <h4 className="font-semibold text-foreground">
                  Destino de las canciones:
                </h4>

                <div className="space-y-2">
                  {/* Opción 1: Crear nueva playlist */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted/50">
                    <RadioButton
                      name="destination"
                      value="new"
                      checked={destination === "new"}
                      onChange={() => setDestination("new")}
                      containerClassName="mt-0.5"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">
                          Crear nueva playlist local
                        </span>
                      </div>
                      {destination === "new" && (
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Nombre de la nueva playlist..."
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  </label>

                  {/* Opción 2: Agregar a playlist existente */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted/50">
                    <RadioButton
                      name="destination"
                      value="existing"
                      checked={destination === "existing"}
                      onChange={() => setDestination("existing")}
                      containerClassName="mt-0.5"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <ListMusic className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">
                          Agregar a una playlist existente
                        </span>
                      </div>
                      {destination === "existing" && (
                        <div>
                          {playlists.length === 0 ? (
                            <p className="text-[11px] text-amber-500">
                              No tienes playlists creadas todavía. Elige "Crear nueva
                              playlist".
                            </p>
                          ) : (
                            <CustomSelect
                              value={
                                selectedPlaylistId ? String(selectedPlaylistId) : ""
                              }
                              onChange={(val) => setSelectedPlaylistId(Number(val))}
                              options={playlists.map((pl) => ({
                                value: String(pl.id),
                                label: `${pl.title} (${pl.track_count} canciones)`,
                              }))}
                              placeholder="Selecciona una playlist..."
                              className="w-full"
                              triggerClassName="h-8 w-full text-xs"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Opción 3: Solo biblioteca */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted/50">
                    <RadioButton
                      name="destination"
                      value="library_only"
                      checked={destination === "library_only"}
                      onChange={() => setDestination("library_only")}
                      containerClassName="mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Library className="h-4 w-4 text-emerald-500" />
                        <span className="font-medium text-foreground">
                          Solo importar a mi biblioteca (sin playlist)
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Los audios se descargarán en tu biblioteca general sin asociarse
                        a ninguna lista.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sincronización y desvinculación bulk de eliminados */}
                {destination !== "library_only" && (
                  <div className="mt-3 rounded-lg border border-border bg-card/60 p-3">
                    <label className="flex cursor-pointer items-center gap-2.5 text-foreground">
                      <Checkbox
                        checked={unlinkRemoved}
                        onChange={(e) => setUnlinkRemoved(e.target.checked)}
                      />
                      <span className="font-medium">
                        Desvincular canciones que ya no estén en YouTube
                      </span>
                    </label>
                    <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
                      Si una canción ya no existe en la lista de YouTube, se quitará de
                      la playlist pero continuará guardada en tu biblioteca.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <footer className="flex items-center justify-end gap-2.5 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={
              !previewData || isLoadingPreview || isSubmitting || selectedCount === 0
            }
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : selectedCount === 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : pendingCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isSubmitting
              ? "Sincronizando..."
              : selectedCount === 0
                ? "Selecciona canciones"
                : pendingCount === 0
                  ? destination === "library_only"
                    ? "Ya en biblioteca (0 descargas)"
                    : "Sincronizar a Playlist (0 descargas)"
                  : `Descargar ${pendingCount} y ${destination === "library_only" ? "Guardar" : "Sincronizar"}`}
          </Button>
        </footer>
      </div>
    </div>
  );
};
