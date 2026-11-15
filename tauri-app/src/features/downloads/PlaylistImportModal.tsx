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

  // Set de IDs ya descargados para consulta O(1)
  const existingTrackIds = useMemo(() => {
    return new Set(libraryTracks.map((t) => t.youtube_id));
  }, [libraryTracks]);

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
      setIsSubmitting(false);
    }
  }, [isOpen, loadPreview]);

  const handleConfirm = async () => {
    if (!previewData) return;
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

      const allIds = previewData.items.map((i) => i.youtube_id);

      // Sincronización bulk en SQLite: vincular temas ya existentes y opcionalmente desvincular eliminados
      if (targetId !== null) {
        await tauriApi.syncPlaylistTracks(targetId, allIds, unlinkRemoved);
      }

      // Iniciar descarga asíncrona de los archivos de audio
      await startDownloadTask({
        url: url.trim(),
        audio_format: audioFormat,
        force_overwrite: forceOverwrite,
        async_mode: true,
        target_playlist_id: targetId,
        skip_playlist: destination === "library_only",
      });

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
                  <h4 className="font-semibold text-slate-200">
                    {previewData.playlist_title || "Lista sin título"} (
                    {previewData.items.length} canciones)
                  </h4>
                  <Badge tone={previewData.content_type === "mix" ? "warning" : "info"}>
                    {previewData.content_type === "mix" ? "Mix Autogenerado" : "Playlist"}
                  </Badge>
                </div>

                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                  {previewData.items.map((item, index) => {
                    const isAlreadyDownloaded = existingTrackIds.has(item.youtube_id);
                    return (
                      <div
                        key={`${item.youtube_id}-${index}`}
                        className="flex items-center justify-between gap-3 rounded px-2.5 py-1.5 hover:bg-slate-900/80"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-5 text-right font-mono text-slate-500">
                            {index + 1}.
                          </span>
                          <div className="truncate">
                            <p className="truncate font-medium text-slate-200">
                              {item.title || item.youtube_id}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">{item.artist}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {isAlreadyDownloaded && (
                            <Badge tone="success">
                              <CheckCircle2 className="h-3 w-3" />
                              Descargada
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 font-mono text-slate-400">
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
            disabled={!previewData || isLoadingPreview || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Confirmar e Importar
          </Button>
        </footer>
      </div>
    </div>
  );
};
