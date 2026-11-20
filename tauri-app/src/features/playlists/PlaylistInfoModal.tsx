import {
  Calendar,
  Check,
  Clock,
  Copy,
  HardDrive,
  ListMusic,
  X,
  Youtube,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui/Primitives";
import { useModalA11y } from "@/hooks/useModalA11y";
import {
  formatBytes,
  formatDuration,
  formatHumanDuration,
  toAssetUrl,
} from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";
import { toast } from "@/stores/useToastStore";
import type { Playlist, Track } from "@/types/models";

export interface PlaylistInfoModalProps {
  playlist: Playlist | null;
  tracks?: Track[];
  isOpen: boolean;
  onClose: () => void;
}

export const PlaylistInfoModal: React.FC<PlaylistInfoModalProps> = ({
  playlist,
  tracks,
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [internalTracks, setInternalTracks] = useState<Track[] | null>(null);

  useModalA11y({
    isOpen,
    onClose,
    containerRef: modalRef,
    closeOnEscape: true,
  });

  // Si no se pasaron tracks explícitos, cargar los detalles de la playlist para calcular duración y tamaño
  useEffect(() => {
    if (!isOpen || !playlist) {
      setInternalTracks(null);
      return;
    }

    if (tracks) {
      setInternalTracks(tracks);
      return;
    }

    let isMounted = true;
    tauriApi
      .getPlaylistDetails(playlist.id)
      .then((details) => {
        if (isMounted) {
          setInternalTracks(details.tracks);
        }
      })
      .catch((err) => {
        console.error("Error al obtener detalles de la playlist:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, playlist, tracks]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success("Copiado al portapapeles", `${label} copiado exitosamente`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  }, []);

  const effectiveTracks = tracks || internalTracks;

  const totalDuration = useMemo(() => {
    if (!effectiveTracks) return 0;
    return effectiveTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  }, [effectiveTracks]);

  const totalSize = useMemo(() => {
    if (!effectiveTracks) return 0;
    return effectiveTracks.reduce((acc, t) => acc + (t.file_size || 0), 0);
  }, [effectiveTracks]);

  if (!isOpen || !playlist) return null;

  const coverUrl = toAssetUrl(playlist.cover_path);
  const isYoutube = Boolean(playlist.youtube_playlist_id);
  const youtubeUrl = isYoutube
    ? `https://www.youtube.com/playlist?list=${playlist.youtube_playlist_id}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="playlist-info-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
    >
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={playlist.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ListMusic className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="playlist-info-title"
                className="text-base font-bold text-foreground truncate"
                title={playlist.title}
              >
                {playlist.title}
              </h2>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <Badge
                  tone={isYoutube ? "info" : "default"}
                  className="text-[10px] uppercase font-semibold"
                >
                  {isYoutube ? "YouTube" : "Local"}
                </Badge>
                <Badge tone="default" className="text-[10px]">
                  {playlist.track_count}{" "}
                  {playlist.track_count === 1 ? "canción" : "canciones"}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            title="Cerrar ventana"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Grilla de Métricas y Estadísticas */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Recuento de canciones */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3">
            <ListMusic className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">
                Total de canciones
              </p>
              <p className="font-semibold text-foreground">
                {playlist.track_count}{" "}
                <span className="text-[11px] text-muted-foreground font-normal">
                  {playlist.track_count === 1 ? "tema" : "temas"}
                </span>
              </p>
            </div>
          </div>

          {/* Duración acumulada */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3">
            <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">
                Duración acumulada
              </p>
              <p className="font-semibold text-foreground">
                {totalDuration > 0 ? (
                  <>
                    {formatDuration(totalDuration)}{" "}
                    <span className="text-[11px] text-muted-foreground font-normal">
                      ({formatHumanDuration(totalDuration)})
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          {/* Tamaño estimado en disco */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3">
            <HardDrive className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">
                Espacio en disco
              </p>
              <p className="font-semibold text-foreground font-mono">
                {totalSize > 0 ? formatBytes(totalSize) : "—"}
              </p>
            </div>
          </div>

          {/* Fecha de creación */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3">
            <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">
                Fecha de creación
              </p>
              <p className="font-semibold text-foreground font-mono text-[11px]">
                {playlist.created_at}
              </p>
            </div>
          </div>
        </div>

        {/* Enlace y datos de sincronización de YouTube si aplica */}
        {youtubeUrl && (
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-[11px]">
                <Youtube className="h-3.5 w-3.5 text-red-500" />
                Enlace de YouTube ({playlist.youtube_playlist_id})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(youtubeUrl, "Enlace de Playlist")}
                className="h-6 px-2 text-[10px] gap-1"
                title="Copiar enlace al portapapeles"
              >
                {copiedField === "Enlace de Playlist" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </Button>
            </div>
            <p
              className="font-mono text-[11px] text-primary/90 bg-background/60 p-2 rounded-lg border border-border/40 break-all select-all"
              title={youtubeUrl}
            >
              {youtubeUrl}
            </p>
          </div>
        )}

        {/* Pie de modal */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
