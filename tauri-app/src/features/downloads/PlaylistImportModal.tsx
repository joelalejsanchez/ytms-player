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
import { Badge, Button, Input } from "@/components/ui/Primitives";
import { formatDuration } from "@/lib/utils";
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

  const [destination, setDestination] = useState<"new" | "existing" | "library_only">("new");
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
        const titleToUse = newTitle.trim() || previewData.playlist_title?.trim() || "Playlist";
        const created = await tauriApi.createPlaylist(titleToUse, previewData.target_id);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ListMusic className="h-5 w-5 text-red-500" />
            <div>
              <h3 className="text-base font-semibold text-white">
                Previsualización e Importación de Lista
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona cómo organizar las canciones en tu biblioteca local
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Contenido principal */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-xs">
          {isLoadingPreview && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
              <p>Consultando lista de YouTube sin descargar audio...</p>
            </div>
          )}

          {previewError && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
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
                    <h4 className="font-semibold text-slate-200">
                      {previewData.playlist_title || "Lista sin título"} (
                      {previewData.items.length} canciones)
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <span className="font-medium text-emerald-400">
                        {downloadedCount} ya en biblioteca
                      </span>
                      {pendingCount > 0 ? (
                        <span> · <strong className="text-amber-400">{pendingCount}</strong> pendientes de descarga</span>
                      ) : selectedCount > 0 ? (
                        <span> · <strong className="text-emerald-300">Todas disponibles en local</strong></span>
                      ) : null}
                    </p>
                  </div>
                  <Badge tone={previewData.content_type === "mix" ? "warning" : "info"}>
                    {previewData.content_type === "mix" ? "Mix Autogenerado" : "Playlist"}
                  </Badge>
                </div>

                {/* Barra de selección rápida */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400">Seleccionar:</span>
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={selectUnder7Min}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    >
                      &lt; 7 min (Por defecto)
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    >
                      Ninguna
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    <strong className={selectedCount > 0 ? "text-slate-100" : "text-rose-400"}>
                      {selectedCount}
                    </strong>{" "}
                    de {previewData.items.length} seleccionadas
                  </span>
                </div>

                <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-2">
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
                            ? "bg-slate-900/90 hover:bg-slate-800/80"
                            : "opacity-50 hover:opacity-80 hover:bg-slate-900/40"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleTrack(item.youtube_id);
                            }}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900"
                          />
                          <span className="w-5 text-right font-mono text-[11px] text-slate-500">
                            {index + 1}.
                          </span>
                          <div className="truncate">
                            <p className={`truncate font-medium text-xs ${isSelected ? "text-slate-200" : "text-slate-400"}`}>
                              {item.title || item.youtube_id}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">{item.artist}</p>
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
                          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
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
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-semibold text-slate-200">Destino de las canciones:</h4>

                <div className="space-y-2">
                  {/* Opción 1: Crear nueva playlist */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-2.5 transition hover:bg-slate-900/60">
                    <input
                      type="radio"
                      name="destination"
                      value="new"
                      checked={destination === "new"}
                      onChange={() => setDestination("new")}
                      className="mt-1 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4 text-red-400" />
                        <span className="font-medium text-slate-200">
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
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-2.5 transition hover:bg-slate-900/60">
                    <input
                      type="radio"
                      name="destination"
                      value="existing"
                      checked={destination === "existing"}
                      onChange={() => setDestination("existing")}
                      className="mt-1 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <ListMusic className="h-4 w-4 text-sky-400" />
                        <span className="font-medium text-slate-200">
                          Agregar a una playlist existente
                        </span>
                      </div>
                      {destination === "existing" && (
                        <div>
                          {playlists.length === 0 ? (
                            <p className="text-[11px] text-amber-400">
                              No tienes playlists creadas todavía. Elige "Crear nueva playlist".
                            </p>
                          ) : (
                            <select
                              value={selectedPlaylistId ?? ""}
                              onChange={(e) => setSelectedPlaylistId(Number(e.target.value))}
                              className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-200 focus:border-red-500 focus:outline-none"
                            >
                              {playlists.map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {pl.title} ({pl.track_count} canciones)
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Opción 3: Solo biblioteca */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-2.5 transition hover:bg-slate-900/60">
                    <input
                      type="radio"
                      name="destination"
                      value="library_only"
                      checked={destination === "library_only"}
                      onChange={() => setDestination("library_only")}
                      className="mt-1 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Library className="h-4 w-4 text-emerald-400" />
                        <span className="font-medium text-slate-200">
                          Solo importar a mi biblioteca (sin playlist)
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Los audios se descargarán en tu biblioteca general sin asociarse a ninguna
                        lista.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sincronización y desvinculación bulk de eliminados */}
                {destination !== "library_only" && (
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                    <label className="flex cursor-pointer items-center gap-2.5 text-slate-300">
                      <input
                        type="checkbox"
                        checked={unlinkRemoved}
                        onChange={(e) => setUnlinkRemoved(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-red-600 focus:ring-red-500"
                      />
                      <span className="font-medium">
                        Sincronizar y desvincular canciones eliminadas de YouTube
                      </span>
                    </label>
                    <p className="mt-1 pl-6 text-[11px] text-slate-400">
                      Si una canción de tu playlist local ya no existe en la lista de YouTube, se
                      removerá de la lista (el archivo físico permanece seguro en tu biblioteca).
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <footer className="flex items-center justify-end gap-2.5 border-t border-slate-800 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!previewData || isLoadingPreview || isSubmitting || selectedCount === 0}
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
