import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Input } from "@/components/ui/Primitives";
import { useModalA11y } from "@/hooks/useModalA11y";
import { formatDuration } from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";
import { useLibraryStore } from "@/stores/useLibraryStore";

export interface MetadataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MetadataSyncModal: React.FC<MetadataSyncModalProps> = ({
  isOpen,
  onClose,
}) => {
  const tracks = useLibraryStore((s) => s.tracks);
  const upsertTrackLocal = useLibraryStore((s) => s.upsertTrackLocal);
  const refreshTracks = useLibraryStore((s) => s.refreshTracks);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen,
    onClose,
    containerRef: modalRef,
    closeOnEscape: !isProcessing,
  });

  // Filtrar pistas
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.youtube_id.toLowerCase().includes(q),
    );
  }, [tracks, search]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.youtube_id)));
    }
  }, [selectedIds, filtered]);

  const toggleSelectOne = useCallback((youtubeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(youtubeId)) {
        next.delete(youtubeId);
      } else {
        next.add(youtubeId);
      }
      return next;
    });
  }, []);

  const handleStartRefresh = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessedCount(0);

    const ids = Array.from(selectedIds);
    let success = 0;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!id) continue;
      try {
        const updated = await tauriApi.refreshTrackMetadata(id);
        upsertTrackLocal(updated);
        success++;
      } catch {
        // Continuar con los siguientes tracks si uno falla
      }
      setProcessedCount(i + 1);
    }

    await refreshTracks();
    setIsProcessing(false);
    setSuccessMsg(
      `Se actualizó la información de ${success} canción(es) correctamente.`,
    );
    setSelectedIds(new Set());
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-sync-modal-title"
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none"
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <h3
                id="metadata-sync-modal-title"
                className="text-base font-semibold text-foreground"
              >
                Actualizar información de canciones
              </h3>
              <p className="text-xs text-muted-foreground">
                Sincroniza título, artista y duración desde YouTube o desde el archivo
                local
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-xs">
          {/* Mensajes informativos */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-foreground">
            <p>
              Actualiza los nombres, artistas y duración de las canciones seleccionadas
              consultando YouTube o leyendo los metadatos del archivo de audio local.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/15 p-3 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-emerald-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Barra de búsqueda y selector masivo */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en tus canciones registradas..."
                className="pl-8 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={toggleSelectAll}
              disabled={isProcessing || filtered.length === 0}
            >
              {selectedIds.size === filtered.length && filtered.length > 0
                ? "Deseleccionar todas"
                : "Seleccionar todas"}
            </Button>
          </div>

          {/* Lista de canciones */}
          <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-card/60 p-2">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No se encontraron canciones que coincidan con la búsqueda.
              </p>
            ) : (
              filtered.map((track) => {
                const isSelected = selectedIds.has(track.youtube_id);
                return (
                  <label
                    key={track.youtube_id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 transition ${
                      isSelected
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelectOne(track.youtube_id)}
                        disabled={isProcessing}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {track.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {track.artist} ·{" "}
                          <span className="font-mono text-muted-foreground">
                            {track.youtube_id}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-muted-foreground font-mono text-[11px]">
                      <Clock className="h-3 w-3" />
                      {formatDuration(track.duration)}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} canción(es) seleccionada(s)
          </span>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleStartRefresh()}
              disabled={isProcessing || selectedIds.size === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                  Actualizando ({processedCount}/{selectedIds.size})...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar Seleccionadas ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
