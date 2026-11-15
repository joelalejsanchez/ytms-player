import {
  AlertTriangle,
  CheckCircle2,
  DownloadCloud,
  FileAudio,
  PlusCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { Badge, Button } from "@/components/ui/Primitives";
import { formatBytes } from "@/lib/utils";
import { useLibraryStore } from "@/stores/useLibraryStore";

/**
 * Panel dedicado de recuperación de archivos extraviados (`is_missing = 1`, SDD 3.5)
 * y detección de archivos huérfanos en `/tracks`.
 */
export const MissingFilesView = React.memo(() => {
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  const missingTracks = useLibraryStore((s) => s.missingTracks);
  const orphanFiles = useLibraryStore((s) => s.orphanFiles);
  const lastReport = useLibraryStore((s) => s.lastIntegrityReport);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const verifyIntegrity = useLibraryStore((s) => s.verifyIntegrity);
  const recoverTrack = useLibraryStore((s) => s.recoverTrack);
  const adoptOrphanFile = useLibraryStore((s) => s.adoptOrphanFile);
  const deleteOrphanFile = useLibraryStore((s) => s.deleteOrphanFile);
  const deleteTrack = useLibraryStore((s) => s.deleteTrack);

  const handleRecover = useCallback(
    async (youtubeId: string) => {
      setRecoveringId(youtubeId);
      try {
        await recoverTrack(youtubeId);
      } finally {
        setRecoveringId(null);
      }
    },
    [recoverTrack],
  );

  return (
    <section className="flex h-full flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Panel de Recuperación de Archivos Extraviados
          </h2>
          <p className="text-xs text-slate-400">
            Reconciliación automática entre registros de SQLite y archivos físicos en{" "}
            <code className="text-slate-300">
              /tracks/&lt;youtube_id&gt;.&lt;ext&gt;
            </code>{" "}
            (SDD 3.5)
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => void verifyIntegrity()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Escanear Integridad Ahora
        </Button>
      </header>

      {lastReport && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
            <p className="text-xs text-slate-400">Registros Verificados</p>
            <p className="mt-1 text-xl font-bold text-white">
              {lastReport.checked_count}
            </p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3.5">
            <p className="text-xs text-amber-300">Nuevos Extraviados Detectados</p>
            <p className="mt-1 text-xl font-bold text-amber-400">
              {lastReport.newly_missing_ids.length}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3.5">
            <p className="text-xs text-emerald-300">Archivos Restaurados</p>
            <p className="mt-1 text-xl font-bold text-emerald-400">
              {lastReport.restored_ids.length}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        {missingTracks.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center text-center">
            <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-200">
              Integridad verificada: 0 archivos extraviados
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Todos los registros en SQLite cuentan con su archivo físico
              correspondiente en <code className="text-slate-300">/tracks</code>.
            </p>
          </div>
        ) : (
          missingTracks.map((track) => {
            const isRecoveringThis = recoveringId === track.youtube_id;
            return (
              <div
                key={track.youtube_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-800/50 bg-amber-950/15 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {track.title}
                    </span>
                    <Badge tone="warning">is_missing = 1</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Artista: {track.artist} · Ruta esperada:{" "}
                    <code className="text-amber-300">{track.audio_path}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isRecoveringThis || isLoading}
                    onClick={() => void handleRecover(track.youtube_id)}
                  >
                    <DownloadCloud className="h-4 w-4" />
                    {isRecoveringThis ? "Recuperando..." : "Re-descargar / Restaurar"}
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void deleteTrack(track.youtube_id, false)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar Registro
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sección de Archivos Huérfanos en /tracks (archivos físicos que no están en SQLite) */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileAudio className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">
              Archivos Huérfanos en /tracks ({orphanFiles.length})
            </h3>
          </div>
          <Badge tone={orphanFiles.length > 0 ? "warning" : "success"}>
            {orphanFiles.length > 0 ? "Requiere acción" : "Limpio"}
          </Badge>
        </div>

        {orphanFiles.length === 0 ? (
          <p className="py-2 text-xs text-slate-500">
            No hay archivos huérfanos. Todos los archivos de audio en el disco están
            registrados en la biblioteca.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              Se encontraron archivos en tu carpeta física que no figuran en tu
              biblioteca (por ejemplo descargas previas de Mixes). Puedes adoptarlos
              directamente o borrarlos para liberar espacio:
            </p>
            {orphanFiles.map((file) => (
              <div
                key={file.full_path}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{file.file_name}</span>
                    <Badge tone="default">.{file.file_extension}</Badge>
                    <span className="text-slate-500">{formatBytes(file.file_size)}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">{file.youtube_id}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isLoading}
                    onClick={() =>
                      void adoptOrphanFile(file.youtube_id, file.file_extension)
                    }
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Adoptar en Biblioteca
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isLoading}
                    onClick={() =>
                      void deleteOrphanFile(file.youtube_id, file.file_extension)
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar de Disco
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
});
MissingFilesView.displayName = "MissingFilesView";
