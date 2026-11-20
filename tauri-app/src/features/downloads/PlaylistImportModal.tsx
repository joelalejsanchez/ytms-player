import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FolderPlus,
  Library,
  ListMusic,
  Loader2,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  RadioButton,
} from "@/components/ui/Primitives";
import { useModalA11y } from "@/hooks/useModalA11y";
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
  forceOverwrite?: boolean;
  onSuccess: () => Promise<void>;
}

export const ITEMS_PER_PAGE = 50;

export const PlaylistImportModal: React.FC<PlaylistImportModalProps> = ({
  isOpen,
  onClose,
  url,
  audioFormat,
  forceOverwrite = false,
  onSuccess,
}) => {
  const playlists = useLibraryStore((s) => s.playlists);
  const libraryTracks = useLibraryStore((s) => s.tracks);
  const startDownloadTask = useDownloadStore((s) => s.startDownloadTask);

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PlaylistPreviewDto | null>(null);

  const [destination, setDestination] = useState<"new" | "existing" | "library_only">(
    "existing",
  );
  const [newTitle, setNewTitle] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [unlinkRemoved, setUnlinkRemoved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen,
    onClose,
    containerRef: modalRef,
    closeOnEscape: !isSubmitting,
  });

  // Set de IDs ya descargados para consulta O(1)
  const existingTrackIds = useMemo(() => {
    return new Set(libraryTracks.map((t) => t.youtube_id));
  }, [libraryTracks]);

  // Mapa de índice original para mantener numeración consistente aun con filtros
  const itemIndexMap = useMemo(() => {
    if (!previewData) return new Map<string, number>();
    const map = new Map<string, number>();
    previewData.items.forEach((item, idx) => {
      map.set(item.youtube_id, idx + 1);
    });
    return map;
  }, [previewData]);

  // Filtrado de canciones por búsqueda interna
  const filteredItems = useMemo(() => {
    if (!previewData) return [];
    if (!searchQuery.trim()) return previewData.items;
    const q = searchQuery.toLowerCase().trim();
    return previewData.items.filter(
      (item) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.artist && item.artist.toLowerCase().includes(q)) ||
        (item.youtube_id && item.youtube_id.toLowerCase().includes(q)),
    );
  }, [previewData, searchQuery]);

  // Canciones visibles (coincidentes con la búsqueda sobre los elementos actualmente en memoria)
  const visibleItems = useMemo(() => {
    return filteredItems;
  }, [filteredItems]);

  // Carga remota incremental del siguiente bloque de 50 canciones sin saturar red ni memoria
  const handleLoadMore = useCallback(async () => {
    if (!previewData || isLoadingMore || !previewData.has_more) return;
    setIsLoadingMore(true);
    try {
      const nextStart = previewData.items.length + 1;
      const nextEnd = nextStart + ITEMS_PER_PAGE - 1;
      const nextBatch = await tauriApi.previewPlaylistUrl(
        url.trim(),
        nextStart,
        nextEnd,
      );

      if (nextBatch.items.length > 0) {
        setPreviewData((prev) => {
          if (!prev) return nextBatch;
          return {
            ...prev,
            items: [...prev.items, ...nextBatch.items],
            has_more: nextBatch.has_more ?? false,
            start_index: prev.start_index ?? 1,
            end_index:
              nextBatch.end_index ?? prev.items.length + nextBatch.items.length,
          };
        });

        setSelectedTrackIds((current) => {
          const next = new Set(current);
          nextBatch.items
            .filter((item) => (item.duration || 0) < 420)
            .forEach((item) => next.add(item.youtube_id));
          return next;
        });
      } else {
        setPreviewData((prev) => (prev ? { ...prev, has_more: false } : null));
      }
    } catch (err) {
      console.error("Error loading more preview tracks", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [previewData, isLoadingMore, url]);

  // Carga remota de todas las canciones restantes por demanda
  const handleLoadAll = useCallback(async () => {
    if (!previewData || isLoadingMore || !previewData.has_more) return;
    setIsLoadingMore(true);
    try {
      const nextStart = previewData.items.length + 1;
      const remainder = await tauriApi.previewPlaylistUrl(url.trim(), nextStart, 9999);

      if (remainder.items.length > 0) {
        setPreviewData((prev) => {
          if (!prev) return remainder;
          return {
            ...prev,
            items: [...prev.items, ...remainder.items],
            has_more: false,
          };
        });

        setSelectedTrackIds((current) => {
          const next = new Set(current);
          remainder.items
            .filter((item) => (item.duration || 0) < 420)
            .forEach((item) => next.add(item.youtube_id));
          return next;
        });
      } else {
        setPreviewData((prev) => (prev ? { ...prev, has_more: false } : null));
      }
    } catch (err) {
      console.error("Error loading all remaining preview tracks", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [previewData, isLoadingMore, url]);

  // Canciones actualmente seleccionadas por el usuario DENTRO del rango visible/cargado en pantalla
  const selectedItems = useMemo(() => {
    if (!previewData) return [];
    return visibleItems.filter((i) => selectedTrackIds.has(i.youtube_id));
  }, [previewData, visibleItems, selectedTrackIds]);

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

  // Acciones de selección masiva acotadas al conjunto cargado/visible
  const selectAll = useCallback(() => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((i) => next.add(i.youtube_id));
      return next;
    });
  }, [visibleItems]);

  const selectUnder15Min = useCallback(() => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      visibleItems
        .filter((i) => (i.duration || 0) < 900)
        .forEach((i) => next.add(i.youtube_id));
      return next;
    });
  }, [visibleItems]);

  const selectUnder7Min = useCallback(() => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      visibleItems
        .filter((i) => (i.duration || 0) < 420)
        .forEach((i) => next.add(i.youtube_id));
      return next;
    });
  }, [visibleItems]);

  const deselectAll = useCallback(() => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((i) => next.delete(i.youtube_id));
      return next;
    });
  }, [visibleItems]);

  const visibleTracksUnder7Min = useMemo(() => {
    return visibleItems.filter((i) => (i.duration || 0) < 420);
  }, [visibleItems]);

  const visibleTracksUnder15Min = useMemo(() => {
    return visibleItems.filter((i) => (i.duration || 0) < 900);
  }, [visibleItems]);

  // Precedencia de estilos evaluada exclusivamente sobre el rango cargado/visible
  const activePreset = useMemo<"none" | "all" | "7min" | "15min" | null>(() => {
    if (visibleItems.length === 0) return null;

    if (selectedCount === 0) {
      return "none";
    }

    if (selectedCount === visibleItems.length) {
      return "all";
    }

    if (
      visibleTracksUnder7Min.length > 0 &&
      selectedCount === visibleTracksUnder7Min.length &&
      visibleTracksUnder7Min.every((i) => selectedTrackIds.has(i.youtube_id))
    ) {
      return "7min";
    }

    if (
      visibleTracksUnder15Min.length > 0 &&
      selectedCount === visibleTracksUnder15Min.length &&
      visibleTracksUnder15Min.every((i) => selectedTrackIds.has(i.youtube_id))
    ) {
      return "15min";
    }

    return null;
  }, [
    visibleItems.length,
    selectedCount,
    visibleTracksUnder7Min,
    visibleTracksUnder15Min,
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
      const data = await tauriApi.previewPlaylistUrl(url.trim(), 1, ITEMS_PER_PAGE);
      setPreviewData(data);
      const defaultTitle = data.playlist_title?.trim() || "Nueva Playlist";
      setNewTitle(defaultTitle);

      // Canciones menores a 7 minutos (420 segundos) marcadas por defecto SOLO dentro del primer lote cargado
      const initialBatch = data.items.slice(0, ITEMS_PER_PAGE);
      const defaultSelected = new Set(
        initialBatch
          .filter((item) => (item.duration || 0) < 420)
          .map((item) => item.youtube_id),
      );
      setSelectedTrackIds(defaultSelected);

      // Si existe una playlist local asociada al mismo youtube_playlist_id o mismo título, seleccionarla
      const matched = playlists.find(
        (p) =>
          (data.target_id && p.youtube_playlist_id === data.target_id) ||
          (data.playlist_title &&
            p.title.trim().toLowerCase() === data.playlist_title.trim().toLowerCase()),
      );
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
    if (playlists.length > 0 && selectedPlaylistId === null) {
      const matching = previewData?.playlist_title
        ? playlists.find(
            (p) =>
              p.title.trim().toLowerCase() ===
              previewData.playlist_title?.trim().toLowerCase(),
          )
        : undefined;
      setSelectedPlaylistId(matching ? matching.id : playlists[0].id);
    }
  }, [playlists, selectedPlaylistId, previewData?.playlist_title]);

  const destinationSummary = useMemo(() => {
    if (destination === "existing") {
      const pl = playlists.find((p) => p.id === selectedPlaylistId);
      return pl ? pl.title : "Playlist existente";
    }
    if (destination === "new") {
      return newTitle.trim() || previewData?.playlist_title?.trim() || "Nueva Playlist";
    }
    return "Solo biblioteca (sin playlist)";
  }, [
    destination,
    playlists,
    selectedPlaylistId,
    newTitle,
    previewData?.playlist_title,
  ]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSearchQuery("");
      setIsLoadingMore(false);
      void loadPreview();
    } else {
      setPreviewData(null);
      setPreviewError(null);
      setSelectedTrackIds(new Set());
      setSearchQuery("");
      setIsLoadingMore(false);
      setIsSubmitting(false);
      setCurrentStep(1);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-import-modal-title"
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none"
      >
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ListMusic className="h-5 w-5 text-primary" />
            <div>
              <h3
                id="playlist-import-modal-title"
                className="text-base font-semibold text-foreground"
              >
                Previsualización e Importación de Lista
              </h3>
              <p className="text-xs text-muted-foreground">
                {currentStep === 1
                  ? "Paso 1 de 2: Revisa y selecciona las canciones a descargar"
                  : "Paso 2 de 2: Configura el destino y opciones de sincronización"}
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

        {/* Barra Stepper de 2 Pasos */}
        {previewData && !isLoadingPreview && (
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-6 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition",
                  currentStep === 1
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                    currentStep === 1
                      ? "bg-primary-foreground/25 text-primary-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground",
                  )}
                >
                  1
                </span>
                <span>1. Selección de canciones</span>
              </button>

              <div className="h-0.5 w-6 bg-border" />

              <button
                type="button"
                onClick={() => {
                  if (selectedCount > 0) setCurrentStep(2);
                }}
                disabled={selectedCount === 0}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition disabled:pointer-events-none disabled:opacity-40",
                  currentStep === 2
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                    currentStep === 2
                      ? "bg-primary-foreground/25 text-primary-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground",
                  )}
                >
                  2
                </span>
                <span>2. Destino y sincronización</span>
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground">
              <strong className="text-foreground">{selectedCount}</strong>{" "}
              {selectedCount === 1 ? "canción seleccionada" : "canciones seleccionadas"}
            </div>
          </div>
        )}

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
              {/* PASO 1: Selección y revisión de pistas */}
              {currentStep === 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {previewData.playlist_title || "Lista sin título"} (
                        {previewData.total_tracks
                          ? `${previewData.items.length} de ${previewData.total_tracks} canciones`
                          : `${previewData.items.length}${previewData.has_more ? "+" : ""} canciones cargadas`}
                        )
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
                    <Badge
                      tone={previewData.content_type === "mix" ? "warning" : "info"}
                    >
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
                      de {visibleItems.length} cargadas seleccionadas
                      {previewData?.total_tracks ? (
                        <span className="ml-1 font-normal text-muted-foreground/80">
                          (de {previewData.total_tracks} en total en la playlist)
                        </span>
                      ) : previewData?.has_more ? (
                        <span className="ml-1 font-normal text-muted-foreground/80">
                          (Mix continuo de YouTube)
                        </span>
                      ) : null}
                    </span>
                  </div>

                  {/* Buscador interno rápido */}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                      }}
                      placeholder="Filtrar canciones por título, artista o ID..."
                      className="h-8 bg-card/60 pl-8 pr-8 text-xs"
                      aria-label="Filtrar canciones de la previsualización"
                    />
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label="Limpiar filtro de previsualización"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Contenedor de lista con paginación progresiva */}
                  <div className="overflow-hidden rounded-lg border border-border bg-card/60">
                    <div className="max-h-56 space-y-1 overflow-y-auto p-2">
                      {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                          <Search className="mb-1.5 h-6 w-6 opacity-40" />
                          <p className="text-xs font-medium text-foreground">
                            No se encontraron canciones
                          </p>
                          <p className="text-[11px]">
                            Ningún tema coincide con &quot;{searchQuery}&quot;
                          </p>
                        </div>
                      ) : (
                        visibleItems.map((item) => {
                          const originalIndex = itemIndexMap.get(item.youtube_id) ?? 1;
                          const isAlreadyDownloaded = existingTrackIds.has(
                            item.youtube_id,
                          );
                          const isSelected = selectedTrackIds.has(item.youtube_id);
                          const isLong = (item.duration || 0) >= 420;

                          return (
                            <div
                              key={item.youtube_id}
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
                                <span className="w-6 text-right font-mono text-[11px] text-muted-foreground">
                                  {originalIndex}.
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
                                  <Badge
                                    tone="warning"
                                    className="px-1.5 py-0 text-[10px]"
                                  >
                                    &ge; 7 min
                                  </Badge>
                                )}
                                {isAlreadyDownloaded && (
                                  <Badge
                                    tone="success"
                                    className="px-1.5 py-0 text-[10px]"
                                  >
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
                        })
                      )}
                    </div>

                    {/* Barra inferior de paginación e información de carga remota progresiva */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span>
                          Mostrando{" "}
                          <strong className="text-foreground">
                            {visibleItems.length}
                          </strong>
                          {previewData?.total_tracks ? (
                            <>
                              {" "}
                              de{" "}
                              <strong className="text-foreground">
                                {previewData.total_tracks}
                              </strong>{" "}
                              canciones en total
                            </>
                          ) : (
                            <> canciones cargadas</>
                          )}
                          {searchQuery.trim() && previewData && (
                            <span className="ml-1 font-normal text-muted-foreground/80">
                              ({previewData.items.length} en memoria)
                            </span>
                          )}
                        </span>
                        {previewData?.total_tracks && previewData.total_tracks > 0 ? (
                          <span className="font-mono text-muted-foreground/75">
                            (
                            {Math.round(
                              (visibleItems.length / previewData.total_tracks) * 100,
                            )}
                            % cargado)
                          </span>
                        ) : !previewData?.has_more ? (
                          <span className="font-medium text-emerald-500">
                            · Lista completa obtenida
                          </span>
                        ) : (
                          <span className="font-medium text-amber-500">
                            · Mix continuo de YouTube
                          </span>
                        )}
                      </div>

                      {previewData?.has_more && !searchQuery.trim() && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleLoadMore()}
                            disabled={isLoadingMore}
                            className="h-6 gap-1 px-2.5 text-[11px] text-foreground"
                          >
                            {isLoadingMore ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            Cargar 50 más
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleLoadAll()}
                            disabled={isLoadingMore}
                            className="h-6 px-2 text-[11px] font-medium text-primary hover:text-primary"
                          >
                            {isLoadingMore ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            Cargar todas
                            {previewData?.total_tracks
                              ? ` (${previewData.total_tracks})`
                              : ""}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 2: Destino de guardado y confirmación */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Resumen de la selección */}
                  <div className="rounded-xl border border-border bg-card/60 p-3.5">
                    <h4 className="mb-2.5 text-xs font-semibold text-foreground">
                      Resumen de la Importación:
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div className="space-y-0.5 rounded-lg border border-border/60 bg-muted/30 p-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Seleccionadas
                        </p>
                        <p className="text-base font-bold text-foreground">
                          {selectedCount}
                        </p>
                      </div>
                      <div className="space-y-0.5 rounded-lg border border-border/60 bg-muted/30 p-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Pendientes de descarga
                        </p>
                        <p className="text-base font-bold text-amber-500">
                          {pendingCount}
                        </p>
                      </div>
                      <div className="space-y-0.5 rounded-lg border border-border/60 bg-muted/30 p-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Ya en biblioteca
                        </p>
                        <p className="text-base font-bold text-emerald-500">
                          {downloadedCount}
                        </p>
                      </div>
                      <div className="space-y-0.5 rounded-lg border border-border/60 bg-muted/30 p-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Destino configurado
                        </p>
                        <p
                          className="truncate text-xs font-semibold text-primary"
                          title={destinationSummary}
                        >
                          {destinationSummary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selector de destino */}
                  <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
                    <h4 className="font-semibold text-foreground">
                      Destino de las canciones:
                    </h4>

                    <div className="space-y-2">
                      {/* Opción 1 (Por defecto): Agregar a playlist existente */}
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
                              Agregar a una playlist existente (Predeterminado)
                            </span>
                          </div>
                          {destination === "existing" && (
                            <div>
                              {playlists.length === 0 ? (
                                <p className="text-[11px] text-amber-500">
                                  No tienes playlists creadas todavía. Elige "Crear
                                  nueva playlist" o "Solo biblioteca".
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

                      {/* Opción 2: Crear nueva playlist local */}
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
                            Los audios se descargarán en tu biblioteca general sin
                            asociarse a ninguna lista.
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
                          Si una canción ya no existe en la lista de YouTube, se quitará
                          de la playlist pero continuará guardada en tu biblioteca.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Acciones y Navegación del Wizard */}
        <footer className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>

          <div className="flex items-center gap-2.5">
            {currentStep === 2 ? (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
            ) : (
              <Button variant="outline" disabled={true} className="gap-1.5 opacity-50">
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
            )}

            {currentStep === 1 ? (
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!previewData || isLoadingPreview || selectedCount === 0}
                className="gap-1.5"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => void handleConfirm()}
                disabled={
                  !previewData ||
                  isLoadingPreview ||
                  isSubmitting ||
                  selectedCount === 0 ||
                  (destination === "existing" &&
                    (selectedPlaylistId === null || playlists.length === 0)) ||
                  (destination === "new" &&
                    !newTitle.trim() &&
                    !previewData.playlist_title?.trim())
                }
                className="gap-1.5"
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
                      : pendingCount === visibleItems.length
                        ? `Descargar ${pendingCount} cargadas y ${destination === "library_only" ? "Guardar" : "Sincronizar"}`
                        : `Descargar ${pendingCount} de ${visibleItems.length} y ${destination === "library_only" ? "Guardar" : "Sincronizar"}`}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
