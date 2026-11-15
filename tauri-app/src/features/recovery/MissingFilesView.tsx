import {
  AlertTriangle,
  CheckCircle2,
  DownloadCloud,
  FileAudio,
  Loader2,
  Music2,
  PlusCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Badge, Button } from "@/components/ui/Primitives";
import { formatBytes, toAssetUrl } from "@/lib/utils";
import { useLibraryStore } from "@/stores/useLibraryStore";

const RecoveryThumbnail = React.memo(
  ({ src, alt }: { src?: string | null; alt: string }) => {
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
      return (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/50">
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
        className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
      />
    );
  },
);
RecoveryThumbnail.displayName = "RecoveryThumbnail";

/**
 * Panel dedicado de recuperación de archivos extraviados (`is_missing = 1`, SDD 3.5)
 * y detección de archivos huérfanos en `/tracks`.
 */
export const MissingFilesView = React.memo(() => {
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [isAdoptingAll, setIsAdoptingAll] = useState(false);
  const [deletingOrphanId, setDeletingOrphanId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
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

  const missingTracks = useLibraryStore((s) => s.missingTracks);
  const orphanFiles = useLibraryStore((s) => s.orphanFiles);
  const lastReport = useLibraryStore((s) => s.lastIntegrityReport);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const verifyIntegrity = useLibraryStore((s) => s.verifyIntegrity);
  const recoverTrack = useLibraryStore((s) => s.recoverTrack);
  const adoptOrphanFile = useLibraryStore((s) => s.adoptOrphanFile);
  const deleteOrphanFile = useLibraryStore((s) => s.deleteOrphanFile);
  const deleteTrack = useLibraryStore((s) => s.deleteTrack);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    try {
      await verifyIntegrity();
    } finally {
      setIsScanning(false);
    }
  }, [verifyIntegrity]);

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

  const handleAdoptOrphan = useCallback(
    async (youtubeId: string, fileExtension: string) => {
      setAdoptingId(youtubeId);
      try {
        await adoptOrphanFile(youtubeId, fileExtension);
      } finally {
        setAdoptingId(null);
      }
    },
    [adoptOrphanFile],
  );

  const handleAdoptAllOrphans = useCallback(async () => {
    if (orphanFiles.length === 0) return;
    setIsAdoptingAll(true);
    try {
      for (const file of orphanFiles) {
        await adoptOrphanFile(file.youtube_id, file.file_extension);
      }
    } finally {
      setIsAdoptingAll(false);
      await verifyIntegrity();
    }
  }, [orphanFiles, adoptOrphanFile, verifyIntegrity]);

  const handleDeleteOrphan = useCallback(
    async (youtubeId: string, fileExtension: string) => {
      setDeletingOrphanId(youtubeId);
      try {
        await deleteOrphanFile(youtubeId, fileExtension);
      } finally {
        setDeletingOrphanId(null);
      }
    },
    [deleteOrphanFile],
  );

  const handleDeleteTrack = useCallback(
    async (youtubeId: string) => {
      setDeletingTrackId(youtubeId);
      try {
        await deleteTrack(youtubeId, false);
      } finally {
        setDeletingTrackId(null);
      }
    },
    [deleteTrack],
  );

  return (
    <section className="flex h-full flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Recuperación de Archivos
          </h2>
          <p className="text-xs text-muted-foreground">
            Comprueba y restaura canciones faltantes o agrega archivos de música a tu biblioteca
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleScan()}
          disabled={isLoading || isScanning}
        >
          {isScanning || isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isScanning ? "Comprobando..." : "Comprobar archivos"}
        </Button>
      </header>

      {lastReport && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="text-xs text-muted-foreground">Canciones revisadas</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {lastReport.checked_count}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">Archivos no encontrados</p>
            <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
              {lastReport.newly_missing_ids.length}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Archivos restaurados</p>
            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {lastReport.restored_ids.length}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-border bg-card/40 p-4">
        {missingTracks.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center text-center">
            <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold text-foreground">
              Todas tus canciones están disponibles
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No hay archivos faltantes en tu biblioteca.
            </p>
          </div>
        ) : (
          missingTracks.map((track) => {
            const isRecoveringThis = recoveringId === track.youtube_id;
            const thumbSrc =
              toAssetUrl(track.thumbnail_path) ||
              (track.youtube_id
                ? `https://i.ytimg.com/vi/${track.youtube_id}/mqdefault.jpg`
                : null);

            return (
              <div
                key={track.youtube_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <RecoveryThumbnail src={thumbSrc} alt={track.title} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate text-sm font-semibold text-foreground">
                        {track.title}
                      </span>
                      <Badge tone="warning">No disponible</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Artista: {track.artist} · El archivo no se encuentra en el equipo
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isRecoveringThis || isLoading}
                    onClick={() => void handleRecover(track.youtube_id)}
                  >
                    {isRecoveringThis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DownloadCloud className="h-4 w-4" />
                    )}
                    {isRecoveringThis ? "Descargando..." : "Volver a descargar"}
                  </Button>

                  <ActionMenu
                    isLoading={deletingTrackId === track.youtube_id}
                    title="Opciones de archivo extraviado"
                    items={[
                      {
                        label: "Eliminar de la biblioteca",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        variant: "danger",
                        onClick: () => {
                          setConfirmModal({
                            isOpen: true,
                            title: "¿Eliminar de la biblioteca?",
                            description: `Se quitará "${track.title}" de tu biblioteca.`,
                            confirmLabel: "Sí, eliminar",
                            tone: "danger",
                            onConfirm: async () => {
                              await handleDeleteTrack(track.youtube_id);
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

      {/* Sección de Archivos no agregados */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FileAudio className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Archivos no agregados ({orphanFiles.length})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {orphanFiles.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                disabled={isAdoptingAll || isLoading}
                onClick={() => void handleAdoptAllOrphans()}
              >
                {isAdoptingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="h-3.5 w-3.5" />
                )}
                {isAdoptingAll
                  ? "Agregando todas..."
                  : `Agregar todas (${orphanFiles.length})`}
              </Button>
            )}
            <Badge tone={orphanFiles.length > 0 ? "warning" : "success"}>
              {orphanFiles.length > 0 ? "Pendientes" : "Al día"}
            </Badge>
          </div>
        </div>

        {orphanFiles.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No hay archivos sueltos. Todo el audio encontrado en tu carpeta está agregado a tu biblioteca.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Se encontraron canciones en tu carpeta que aún no figuran en tu biblioteca. Puedes agregarlas o eliminarlas del equipo para ahorrar espacio:
            </p>
            {orphanFiles.map((file) => {
              const thumbSrc =
                toAssetUrl(
                  file.full_path
                    .replace("/tracks/", "/thumbnails/")
                    .replace(/\.[^.]+$/, ".jpg"),
                ) ||
                (file.youtube_id
                  ? `https://i.ytimg.com/vi/${file.youtube_id}/mqdefault.jpg`
                  : null);

              return (
                <div
                  key={file.full_path}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3 text-xs hover:border-border/80"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <RecoveryThumbnail src={thumbSrc} alt={file.file_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">
                          {file.file_name}
                        </span>
                        <span className="text-muted-foreground">{formatBytes(file.file_size)}</span>
                      </div>
                    </div>
                  </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      adoptingId === file.youtube_id ||
                      deletingOrphanId === file.youtube_id ||
                      isLoading
                    }
                    onClick={() =>
                      void handleAdoptOrphan(file.youtube_id, file.file_extension)
                    }
                  >
                    {adoptingId === file.youtube_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlusCircle className="h-3.5 w-3.5" />
                    )}
                    {adoptingId === file.youtube_id
                      ? "Agregando..."
                      : "Agregar a biblioteca"}
                  </Button>
                  <ActionMenu
                    isLoading={deletingOrphanId === file.youtube_id}
                    title="Opciones de archivo"
                    items={[
                      {
                        label: "Eliminar del equipo",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        variant: "danger",
                        onClick: () => {
                          setConfirmModal({
                            isOpen: true,
                            title: "¿Eliminar archivo del equipo?",
                            description: `El archivo "${file.file_name}" (${formatBytes(file.file_size)}) se eliminará permanentemente de tu equipo.`,
                            confirmLabel: "Eliminar archivo",
                            tone: "danger",
                            onConfirm: async () => {
                              await handleDeleteOrphan(file.youtube_id, file.file_extension);
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
          })}
        </div>
      )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        tone={confirmModal.tone}
        isLoading={Boolean(deletingOrphanId || deletingTrackId)}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
});
MissingFilesView.displayName = "MissingFilesView";
