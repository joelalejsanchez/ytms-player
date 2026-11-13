import {
  AlertTriangle,
  CheckCircle2,
  DownloadCloud,
  RefreshCw,
  Trash2,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { Badge, Button } from "@/components/ui/Primitives";
import { useLibraryStore } from "@/stores/useLibraryStore";

/**
 * Panel dedicado de recuperación de archivos extraviados (`is_missing = 1`, SDD 3.5).
 */
export const MissingFilesView = React.memo(() => {
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  const missingTracks = useLibraryStore((s) => s.missingTracks);
  const lastReport = useLibraryStore((s) => s.lastIntegrityReport);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const verifyIntegrity = useLibraryStore((s) => s.verifyIntegrity);
  const recoverTrack = useLibraryStore((s) => s.recoverTrack);
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
    </section>
  );
});
MissingFilesView.displayName = "MissingFilesView";
