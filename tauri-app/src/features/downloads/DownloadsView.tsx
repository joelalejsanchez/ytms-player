import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  List,
  ListMusic,
  Loader2,
  Music2,
  RotateCcw,
  Trash2,
  Wifi,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Input, ProgressBar } from "@/components/ui/Primitives";
import { toAssetUrl } from "@/lib/utils";
import { downloadFormSchema } from "@/schemas/validation";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import type { AudioFormat, DownloadProgressEvent } from "@/types/models";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { PlaylistImportModal } from "./PlaylistImportModal";

function parseIsoDate(raw: string): Date {
  if (!raw) return new Date();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(raw) : d;
}

function getWhatsAppDayLabel(rawDate: string): string {
  const d = parseIsoDate(rawDate);
  if (isNaN(d.getTime())) return "Fecha desconocida";

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return "Hoy";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Ayer";

  const formatted = d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(rawDate: string): string {
  const d = parseIsoDate(rawDate);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ItemThumbnail = React.memo(
  ({ src, alt }: { src?: string | null; alt: string }) => {
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
      return (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400 ring-1 ring-slate-700/50">
          <Music2 className="h-5 w-5" />
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-700/50"
      />
    );
  },
);
ItemThumbnail.displayName = "ItemThumbnail";

export const DownloadsView = React.memo(() => {
  const appSettings = useLibraryStore((s) => s.appSettings);
  const setPreferredFormat = useLibraryStore((s) => s.setPreferredFormat);
  const downloadHistory = useLibraryStore((s) => s.downloadHistory);
  const tracks = useLibraryStore((s) => s.tracks);
  const refreshDownloadHistory = useLibraryStore((s) => s.refreshDownloadHistory);
  const clearDownloadHistory = useLibraryStore((s) => s.clearDownloadHistory);
  const refreshTracks = useLibraryStore((s) => s.refreshTracks);
  const refreshPlaylists = useLibraryStore((s) => s.refreshPlaylists);

  const initialFormat = (appSettings?.preferred_audio_format as AudioFormat) || "mp3";

  const [url, setUrl] = useState("");
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(initialFormat);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [asyncMode] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mixOption, setMixOption] = useState<"track" | "mix">("track");
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [collapsedPlaylists, setCollapsedPlaylists] = useState<Record<string, boolean>>({});

  const connectionState = useDownloadStore((s) => s.connectionState);
  const tasks = useDownloadStore((s) => s.tasks);
  const isSubmitting = useDownloadStore((s) => s.isSubmitting);
  const lastError = useDownloadStore((s) => s.lastError);
  const startDownloadTask = useDownloadStore((s) => s.startDownloadTask);
  const removeTask = useDownloadStore((s) => s.removeTask);
  const removePlaylistGroup = useDownloadStore((s) => s.removePlaylistGroup);
  const clearCompletedTasks = useDownloadStore((s) => s.clearCompletedTasks);
  const clearAllTasks = useDownloadStore((s) => s.clearAllTasks);

  // Sincronizar formato con preferencia persistente
  useEffect(() => {
    if (appSettings?.preferred_audio_format) {
      setAudioFormat(appSettings.preferred_audio_format as AudioFormat);
    }
    void refreshDownloadHistory();
  }, [appSettings?.preferred_audio_format, refreshDownloadHistory]);

  const handleFormatChange = useCallback(
    (newFormat: AudioFormat) => {
      setAudioFormat(newFormat);
      void setPreferredFormat(newFormat);
    },
    [setPreferredFormat],
  );

  // Mapa rápido de miniaturas desde la biblioteca
  const trackThumbnailMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const t of tracks) {
      map.set(t.youtube_id, t.thumbnail_path);
    }
    return map;
  }, [tracks]);

  // Detección automática de Mix / Radio de YouTube (list=RD...)
  const isMixUrl = useMemo(() => {
    return url.includes("list=RD") || url.includes("list=UL");
  }, [url]);

  const isPlaylistUrl = useMemo(() => {
    return url.includes("list=") && !url.includes("list=RD") && !url.includes("list=UL");
  }, [url]);

  const shouldOpenPlaylistModal = useMemo(() => {
    return isPlaylistUrl || (isMixUrl && mixOption === "mix");
  }, [isPlaylistUrl, isMixUrl, mixOption]);

  const taskEntries = useMemo(() => Object.entries(tasks).reverse(), [tasks]);

  const isTaskActive = useCallback((t: DownloadProgressEvent) => {
    return (
      t.status === "queued" ||
      t.status === "downloading" ||
      t.status === "processing"
    );
  }, []);

  const isPlaylistContainer = useCallback(
    (id: string, metadata?: DownloadProgressEvent["metadata"]) => {
      return (
        id.length > 11 ||
        id.startsWith("PL") ||
        id.startsWith("RD") ||
        id.startsWith("UL") ||
        id.startsWith("OLAK") ||
        id.startsWith("TL") ||
        id.startsWith("CL") ||
        id.startsWith("FL") ||
        Boolean(metadata?.playlist_id && metadata.playlist_id === id)
      );
    },
    [],
  );

  const { activePlaylistGroups, activeIndividualTasks } = useMemo(() => {
    const plMap: Record<
      string,
      {
        title: string;
        tasks: Array<{ key: string; task: (typeof tasks)[string] }>;
      }
    > = {};
    const singles: Array<{ key: string; task: (typeof tasks)[string] }> = [];

    for (const [key, task] of taskEntries) {
      // Ignorar tarea padre cruda de playlist si sus hijos ya están presentes
      if (isPlaylistContainer(task.youtube_id, task.metadata)) {
        continue;
      }

      const plId = task.metadata?.playlist_id;
      const plTitle = task.metadata?.playlist_title;
      if (plId || plTitle) {
        const groupKey = plId || plTitle || "playlist";
        if (!plMap[groupKey]) {
          plMap[groupKey] = {
            title: plTitle || plId || "Playlist",
            tasks: [],
          };
        }
        // Deduplicar tareas por youtube_id dentro del grupo para conteo exacto
        const existingIdx = plMap[groupKey].tasks.findIndex(
          (t) => t.task.youtube_id === task.youtube_id,
        );
        if (existingIdx >= 0) {
          const existing = plMap[groupKey].tasks[existingIdx];
          if (
            task.status === "completed" ||
            task.status === "skipped" ||
            task.status === "processing" ||
            (task.status === "downloading" && existing?.task.status === "queued") ||
            task.progress > (existing?.task.progress ?? 0)
          ) {
            plMap[groupKey].tasks[existingIdx] = { key, task };
          }
        } else {
          plMap[groupKey].tasks.push({ key, task });
        }
      } else {
        // Solo mostrar como activo si está en proceso o encolado
        if (isTaskActive(task)) {
          const existingIdx = singles.findIndex((s) => s.task.youtube_id === task.youtube_id);
          if (existingIdx >= 0) {
            singles[existingIdx] = { key, task };
          } else {
            singles.push({ key, task });
          }
        }
      }
    }

    // Mantener los grupos de playlist que tengan al menos una tarea activa y no hayan completado al 100%
    const activeGroups = Object.entries(plMap).filter(([_, group]) => {
      const completedCount = group.tasks.filter(
        (t) => t.task.status === "completed" || t.task.status === "skipped",
      ).length;
      const totalCount = group.tasks.length;
      if (totalCount > 0 && completedCount === totalCount) {
        return false;
      }
      return group.tasks.some(({ task }) => isTaskActive(task));
    });

    return {
      activePlaylistGroups: activeGroups,
      activeIndividualTasks: singles,
    };
  }, [taskEntries, isTaskActive, isPlaylistContainer]);

  const hasActiveDownloads =
    activePlaylistGroups.length > 0 || activeIndividualTasks.length > 0;

  const totalActiveTasksCount = useMemo(() => {
    let count = activeIndividualTasks.length;
    for (const [_, group] of activePlaylistGroups) {
      count += group.tasks.filter(({ task }) => isTaskActive(task)).length;
    }
    return count;
  }, [activeIndividualTasks, activePlaylistGroups, isTaskActive]);

  const togglePlaylistCollapse = useCallback((groupKey: string) => {
    setCollapsedPlaylists((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  // Agrupamiento de historial por día estilo WhatsApp
  const groupedHistory = useMemo(() => {
    const groups: Array<{
      label: string;
      items: typeof downloadHistory;
    }> = [];
    const map = new Map<string, typeof downloadHistory>();

    for (const item of downloadHistory) {
      const label = getWhatsAppDayLabel(item.created_at);
      let list = map.get(label);
      if (!list) {
        list = [];
        map.set(label, list);
        groups.push({ label, items: list });
      }
      list.push(item);
    }

    return groups;
  }, [downloadHistory]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      // Si es una playlist o un mix completo, abrir el modal de previsualización y destino
      if (shouldOpenPlaylistModal) {
        setIsPlaylistModalOpen(true);
        return;
      }

      // Si es un mix y el usuario eligió solo la canción, limpiar el parámetro list
      let finalUrl = url.trim();
      if (isMixUrl && mixOption === "track") {
        try {
          const parsedUrl = new URL(finalUrl);
          const videoId = parsedUrl.searchParams.get("v");
          if (videoId) {
            finalUrl = `https://www.youtube.com/watch?v=${videoId}`;
          }
        } catch {
          // Ignorar si no es URL estándar
        }
      }

      const parsed = downloadFormSchema.safeParse({
        url: finalUrl,
        audioFormat,
        forceOverwrite,
        asyncMode,
      });

      if (!parsed.success) {
        setValidationError(
          parsed.error.issues[0]?.message ?? "Datos de descarga inválidos",
        );
        return;
      }

      try {
        await startDownloadTask({
          url: parsed.data.url,
          audio_format: parsed.data.audioFormat,
          force_overwrite: parsed.data.forceOverwrite,
          async_mode: parsed.data.asyncMode,
        });
        setUrl("");
        await Promise.all([
          refreshTracks(),
          refreshPlaylists(),
          refreshDownloadHistory(),
        ]);
      } catch {
        // El error ya queda registrado en useDownloadStore
      }
    },
    [
      url,
      shouldOpenPlaylistModal,
      isMixUrl,
      mixOption,
      audioFormat,
      forceOverwrite,
      asyncMode,
      startDownloadTask,
      refreshTracks,
      refreshPlaylists,
      refreshDownloadHistory,
    ],
  );

  const handleConfirmClearHistory = useCallback(async () => {
    setIsClearingHistory(true);
    try {
      await clearDownloadHistory();
      setIsClearHistoryModalOpen(false);
    } catch (err) {
      console.error("Error al limpiar historial de descargas:", err);
    } finally {
      setIsClearingHistory(false);
    }
  }, [clearDownloadHistory]);

  return (
    <section className="flex h-full flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Gestor de Descargas & Stream SSE
          </h2>
          <p className="text-xs text-slate-400">
            Descargas activas en tiempo real e historial histórico unificado por día
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={connectionState === "connected" ? "success" : "warning"}>
            <Wifi className="h-3.5 w-3.5" />
            SSE: {connectionState}
          </Badge>
        </div>
      </header>

      {/* Formulario de descarga validado con Zod */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/75 p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ o URL de playlist..."
              aria-label="URL de YouTube"
            />
          </div>

          <select
            aria-label="Formato de audio"
            value={audioFormat}
            onChange={(e) => handleFormatChange(e.target.value as AudioFormat)}
            className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
          >
            <option value="mp3">MP3 (ID3v2 + Carátula)</option>
            <option value="m4a">M4A (AAC + Átomos iTunes)</option>
            <option value="opus">OPUS (Vorbis Comments)</option>
          </select>

          {shouldOpenPlaylistModal && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPlaylistModalOpen(true)}
            >
              <ListMusic className="h-4 w-4 text-red-500" />
              Previsualizar e Importar
            </Button>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar
          </Button>
        </div>

        {/* Alerta y Selector inteligente si se pega un Mix de YouTube (list=RD...) */}
        {isMixUrl && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span>Detectamos un Mix autogenerado de YouTube en la URL. ¿Qué deseas descargar?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMixOption("track")}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  mixOption === "track"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <Music2 className="mr-1 inline h-3 w-3" />
                Solo esta canción (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => setMixOption("mix")}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  mixOption === "mix"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <List className="mr-1 inline h-3 w-3" />
                Mix completo
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={forceOverwrite}
              onChange={(e) => setForceOverwrite(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 accent-red-500"
            />
            <span>Forzar re-descarga si el archivo ya existe en el Workspace</span>
          </label>
          <span className="text-[11px] text-slate-500">
            Descarga asíncrona mediante streaming SSE y transcodificación FFmpeg activa
          </span>
        </div>

        {(validationError || lastError) && (
          <div className="rounded-lg border border-rose-800/70 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            {validationError ?? lastError}
          </div>
        )}
      </form>

      {/* Panel unificado: Descargas en curso arriba + Historial por día abajo */}
      <div className="flex-1 space-y-6 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
        {/* SECCIÓN 1: Descargas en curso (solo si hay tareas activas) */}
        {hasActiveDownloads && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Descargas en curso ({totalActiveTasksCount})
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clearCompletedTasks()}
                  className="text-[11px] text-slate-400 transition hover:text-slate-200"
                  title="Limpiar descargas finalizadas"
                >
                  Limpiar finalizadas
                </button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => clearAllTasks()}
                  className="text-[11px] text-slate-400 transition hover:text-rose-400"
                  title="Eliminar todas las tareas de descargas"
                >
                  Eliminar lista
                </button>
              </div>
            </div>

            {/* Playlists agrupadas en tarjetas desplegables (Collapsible) */}
            {activePlaylistGroups.map(([groupKey, group]) => {
              const isCollapsed = Boolean(collapsedPlaylists[groupKey]);
              const completedCount = group.tasks.filter(
                (t) => t.task.status === "completed" || t.task.status === "skipped",
              ).length;
              const totalCount = group.tasks.length;
              const overallProgress =
                totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

              return (
                <div
                  key={groupKey}
                  className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-md transition"
                >
                  <div
                    onClick={() => togglePlaylistCollapse(groupKey)}
                    className="flex cursor-pointer items-center justify-between border-b border-slate-800/80 p-3.5 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <ListMusic className="h-4 w-4 text-red-500" />
                      <span className="font-semibold text-white">{group.title}</span>
                      <Badge tone={completedCount === totalCount ? "success" : "info"}>
                        {completedCount} de {totalCount} completadas
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs text-slate-400">
                        {overallProgress.toFixed(0)}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlaylistGroup(groupKey);
                        }}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                        title="Eliminar esta lista de descargas"
                        aria-label="Eliminar lista de descargas"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:text-white"
                        aria-label="Alternar vista de playlist"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-2 p-3">
                      {group.tasks.map(({ key: taskKey, task }) => {
                        const isProcessing =
                          task.status === "processing" ||
                          (task.progress >= 95 && task.status === "downloading");
                        const tone =
                          task.status === "completed" || task.status === "skipped"
                            ? "success"
                            : task.status === "failed"
                              ? "danger"
                              : isProcessing
                                ? "warning"
                                : "info";

                        const localThumb = trackThumbnailMap.get(task.youtube_id);
                        const thumbSrc =
                          toAssetUrl(task.metadata?.thumbnail_path) ||
                          (localThumb ? toAssetUrl(localThumb) : null) ||
                          (task.youtube_id
                            ? `https://i.ytimg.com/vi/${task.youtube_id}/mqdefault.jpg`
                            : null);

                        return (
                          <div
                            key={taskKey}
                            className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/70 p-2.5"
                          >
                            <ItemThumbnail
                              src={thumbSrc}
                              alt={task.metadata?.title ?? task.youtube_id}
                            />

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Badge tone={tone} className="text-[10px] uppercase">
                                    {isProcessing ? "FFmpeg" : task.status}
                                  </Badge>
                                  <span className="truncate text-xs font-medium text-slate-200">
                                    {task.metadata?.title ?? task.youtube_id}
                                  </span>
                                </div>

                                <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                                  {isProcessing ? (
                                    <span className="flex items-center gap-1 text-amber-300">
                                      <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                                      Post-procesando
                                    </span>
                                  ) : (
                                    <>
                                      {task.speed && <span>{task.speed}</span>}
                                      <span className="font-semibold text-slate-200">
                                        {task.progress.toFixed(0)}%
                                      </span>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeTask(taskKey);
                                    }}
                                    className="text-slate-500 hover:text-rose-400"
                                    title="Quitar de la lista"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <ProgressBar value={task.progress} />
                              {task.error && (
                                <p className="text-[11px] text-rose-400">{task.error}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Descargas individuales activas */}
            {activeIndividualTasks.map(({ key: taskKey, task }) => {
              const isProcessing =
                task.status === "processing" ||
                (task.progress >= 95 && task.status === "downloading");
              const tone =
                task.status === "completed" || task.status === "skipped"
                  ? "success"
                  : task.status === "failed"
                    ? "danger"
                    : isProcessing
                      ? "warning"
                      : "info";

              const localThumb = trackThumbnailMap.get(task.youtube_id);
              const thumbSrc =
                toAssetUrl(task.metadata?.thumbnail_path) ||
                (localThumb ? toAssetUrl(localThumb) : null) ||
                (task.youtube_id
                  ? `https://i.ytimg.com/vi/${task.youtube_id}/mqdefault.jpg`
                  : null);

              return (
                <div
                  key={taskKey}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                >
                  <ItemThumbnail
                    src={thumbSrc}
                    alt={task.metadata?.title ?? task.youtube_id}
                  />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={tone} className="text-[10px] uppercase">
                          {isProcessing ? "FFmpeg Post-procesando" : task.status}
                        </Badge>
                        <span className="truncate text-xs font-semibold text-slate-100">
                          {task.metadata?.title ?? task.youtube_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-400">
                        {isProcessing ? (
                          <span className="flex items-center gap-1 font-medium text-amber-300">
                            <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                            Transcodificando audio...
                          </span>
                        ) : (
                          <>
                            {task.speed && <span>{task.speed}</span>}
                            {task.eta && <span>ETA: {task.eta}</span>}
                            <span className="font-semibold text-slate-200">
                              {task.progress.toFixed(0)}%
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTask(taskKey)}
                          className="text-slate-500 hover:text-rose-400"
                          title="Quitar de la lista"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <ProgressBar value={task.progress} />
                    {task.error && <p className="text-xs text-rose-400">{task.error}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SECCIÓN 2: Historial completo unificado separado por día (Estilo WhatsApp) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <History className="h-3.5 w-3.5 text-slate-400" />
                Historial de Descargas ({downloadHistory.length})
              </h3>
              {downloadHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsClearHistoryModalOpen(true)}
                  className="h-6 gap-1.5 px-2 text-[11px] text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                  title="Limpiar todo el historial de descargas"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpiar historial
                </Button>
              )}
            </div>
            {hasActiveDownloads && (
              <span className="text-[11px] text-slate-400">
                Las descargas finalizadas se integran automáticamente aquí
              </span>
            )}
          </div>

          {groupedHistory.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              <p className="font-medium text-slate-400">
                Aún no hay descargas registradas en este Workspace.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Introduce una URL arriba para comenzar a descargar.
              </p>
            </div>
          ) : (
            groupedHistory.map((group) => (
              <div key={group.label} className="space-y-2">
                {/* Separador de fecha estilo WhatsApp */}
                <div className="my-3 flex items-center justify-center">
                  <span className="rounded-full border border-slate-700/80 bg-slate-800/90 px-3.5 py-1 text-[11px] font-semibold text-slate-200 shadow-sm backdrop-blur">
                    {group.label}
                  </span>
                </div>

                {/* Lista de descargas correspondientes a este día */}
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const localThumb = trackThumbnailMap.get(item.youtube_id);
                    const thumbSrc =
                      (localThumb ? toAssetUrl(localThumb) : null) ||
                      (item.youtube_id
                        ? `https://i.ytimg.com/vi/${item.youtube_id}/mqdefault.jpg`
                        : null);

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/60 p-2.5 transition hover:bg-slate-900/90"
                      >
                        <ItemThumbnail src={thumbSrc} alt={item.title} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-slate-100">
                              {item.title}
                            </span>
                            <Badge
                              tone={
                                item.status === "completed" || item.status === "skipped"
                                  ? "success"
                                  : item.status === "failed"
                                    ? "danger"
                                    : "info"
                              }
                              className="text-[10px]"
                            >
                              {item.status}
                            </Badge>
                            <span className="font-mono text-[10px] text-slate-400">
                              .{item.audio_format}
                            </span>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono text-[10px] text-slate-500">
                              {item.youtube_id}
                            </span>
                            <span>·</span>
                            <span>{formatTime(item.created_at)}</span>
                            {item.error_message && (
                              <>
                                <span>·</span>
                                <span className="truncate text-rose-400">
                                  {item.error_message}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {item.status === "failed" && item.url && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setUrl(item.url);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            title="Reintentar descarga con esta URL"
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Reintentar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <PlaylistImportModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        url={url}
        audioFormat={audioFormat}
        forceOverwrite={forceOverwrite}
        onSuccess={async () => {
          setUrl("");
          await Promise.all([
            refreshTracks(),
            refreshPlaylists(),
            refreshDownloadHistory(),
          ]);
        }}
      />

      <ConfirmationModal
        isOpen={isClearHistoryModalOpen}
        title="Limpiar Historial de Descargas"
        description="¿Estás seguro de que deseas eliminar todo el historial de descargas? Los archivos de audio ya descargados se conservarán intactos en tu biblioteca."
        confirmLabel="Limpiar historial"
        cancelLabel="Cancelar"
        tone="danger"
        isLoading={isClearingHistory}
        onConfirm={handleConfirmClearHistory}
        onCancel={() => setIsClearHistoryModalOpen(false)}
      />
    </section>
  );
});
DownloadsView.displayName = "DownloadsView";
