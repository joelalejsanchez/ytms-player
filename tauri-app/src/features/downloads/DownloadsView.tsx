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
  Trash2,
  Wifi,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Input, ProgressBar } from "@/components/ui/Primitives";
import { downloadFormSchema } from "@/schemas/validation";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import type { AudioFormat } from "@/types/models";
import { PlaylistImportModal } from "./PlaylistImportModal";

export const DownloadsView = React.memo(() => {
  const appSettings = useLibraryStore((s) => s.appSettings);
  const setPreferredFormat = useLibraryStore((s) => s.setPreferredFormat);
  const downloadHistory = useLibraryStore((s) => s.downloadHistory);
  const refreshDownloadHistory = useLibraryStore((s) => s.refreshDownloadHistory);

  const initialFormat = (appSettings?.preferred_audio_format as AudioFormat) || "mp3";

  const [url, setUrl] = useState("");
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(initialFormat);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [asyncMode] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mixOption, setMixOption] = useState<"track" | "mix">("track");
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [collapsedPlaylists, setCollapsedPlaylists] = useState<Record<string, boolean>>({});

  const connectionState = useDownloadStore((s) => s.connectionState);
  const tasks = useDownloadStore((s) => s.tasks);
  const isSubmitting = useDownloadStore((s) => s.isSubmitting);
  const lastError = useDownloadStore((s) => s.lastError);
  const startDownloadTask = useDownloadStore((s) => s.startDownloadTask);
  const clearCompletedTasks = useDownloadStore((s) => s.clearCompletedTasks);
  const removeTask = useDownloadStore((s) => s.removeTask);

  const refreshTracks = useLibraryStore((s) => s.refreshTracks);
  const refreshPlaylists = useLibraryStore((s) => s.refreshPlaylists);

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

  const { playlistGroups, individualTasks } = useMemo(() => {
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
      if (task.youtube_id.startsWith("PL") || task.youtube_id.startsWith("RD") || task.youtube_id.startsWith("UL")) {
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
        plMap[groupKey].tasks.push({ key, task });
      } else {
        singles.push({ key, task });
      }
    }

    return { playlistGroups: Object.entries(plMap), individualTasks: singles };
  }, [taskEntries]);

  const togglePlaylistCollapse = useCallback((groupKey: string) => {
    setCollapsedPlaylists((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

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

  return (
    <section className="flex h-full flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Gestor de Descargas & Stream SSE
          </h2>
          <p className="text-xs text-slate-400">
            Descarga videos individuales o playlists completas con conversión FFmpeg e
            incrustación de tags ID3/Vorbis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showHistory ? "primary" : "secondary"}
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
          >
            <History className="h-3.5 w-3.5" />
            Historial ({downloadHistory.length})
          </Button>
          <Badge tone={connectionState === "connected" ? "success" : "warning"}>
            <Wifi className="h-3.5 w-3.5" />
            SSE: {connectionState}
          </Badge>
          {taskEntries.length > 0 && (
            <Button variant="secondary" size="sm" onClick={clearCompletedTasks}>
              Limpiar completadas
            </Button>
          )}
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

        {/* Panel colapsable de Historial de descargas */}
        {showHistory && (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/95 p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Historial de descargas recientes ({downloadHistory.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                Cerrar
              </Button>
            </div>
            {downloadHistory.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
                Aún no hay descargas registradas en este Workspace.
              </p>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {downloadHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-100">
                          {item.title}
                        </span>
                        <Badge
                          tone={
                            item.status === "completed"
                              ? "success"
                              : item.status === "failed"
                                ? "danger"
                                : "info"
                          }
                        >
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          .{item.audio_format}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {item.youtube_id} · {item.created_at}
                      </span>
                    </div>
                    {item.status === "failed" && item.url && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setUrl(item.url);
                          setShowHistory(false);
                        }}
                      >
                        Reintentar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
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

      {/* Cola de progreso en tiempo real (Con soporte para Playlists agrupadas) */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
        {playlistGroups.length === 0 && individualTasks.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center text-slate-500">
            <p className="text-sm font-medium text-slate-400">
              No hay tareas de descarga activas
            </p>
            <p className="mt-1 text-xs">
              Los eventos emitidos por{" "}
              <code className="text-slate-300">/api/progress/stream</code> aparecerán
              aquí en tiempo real.
            </p>
          </div>
        ) : (
          <>
            {/* Playlists agrupadas en tarjetas desplegables (Collapsible) */}
            {playlistGroups.map(([groupKey, group]) => {
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
                  {/* Encabezado colapsable de Playlist */}
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

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400">
                        {overallProgress.toFixed(0)}%
                      </span>
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

                  {/* Lista de temas de la playlist */}
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

                        return (
                          <div
                            key={taskKey}
                            className="space-y-1.5 rounded-lg border border-slate-800/70 bg-slate-950/70 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <Badge tone={tone} className="uppercase text-[10px]">
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Descargas individuales (sin playlist) */}
            {individualTasks.map(({ key: taskKey, task }) => {
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

              return (
                <div
                  key={taskKey}
                  className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Badge tone={tone} className="uppercase">
                        {isProcessing ? "FFmpeg Post-procesando" : task.status}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-100">
                        {task.metadata?.title ?? task.youtube_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {isProcessing ? (
                        <span className="flex items-center gap-1.5 font-medium text-amber-300">
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                          Transcodificando audio e incrustando carátula/tags con FFmpeg...
                        </span>
                      ) : (
                        <>
                          {task.speed && <span>Velocidad: {task.speed}</span>}
                          {task.eta && <span>ETA: {task.eta}</span>}
                          <span className="font-semibold text-slate-200">
                            {task.progress.toFixed(1)}%
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
              );
            })}
          </>
        )}
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
    </section>
  );
});
DownloadsView.displayName = "DownloadsView";
