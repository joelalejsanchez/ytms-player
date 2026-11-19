import {
  ArrowRight,
  Clock,
  Download,
  HardDrive,
  Heart,
  History,
  ListMusic,
  Music,
  Pause,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { Badge, Button } from "@/components/ui/Primitives";
import {
  cn,
  formatBytes,
  formatDuration,
  formatHumanDuration,
  toAssetUrl,
} from "@/lib/utils";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { toast } from "@/stores/useToastStore";
import type { NavigationTab, Track } from "@/types/models";

interface HomeViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = React.memo(({ onNavigate }) => {
  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const playlistTrackMap = useLibraryStore((s) => s.playlistTrackMap);
  const downloadHistory = useLibraryStore((s) => s.downloadHistory);
  const refreshDownloadHistory = useLibraryStore((s) => s.refreshDownloadHistory);
  const selectPlaylist = useLibraryStore((s) => s.selectPlaylist);
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  useEffect(() => {
    void refreshDownloadHistory();
  }, [refreshDownloadHistory]);

  // Saludo según la hora
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "Buenos días";
    if (hour >= 12 && hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  // Métricas globales
  const stats = useMemo(() => {
    let totalDuration = 0;
    let totalBytes = 0;
    let likedCount = 0;

    for (const t of tracks) {
      totalDuration += t.duration || 0;
      totalBytes += t.file_size || 0;
      if (t.liked) likedCount++;
    }

    return {
      totalTracks: tracks.length,
      totalDuration,
      totalBytes,
      likedCount,
    };
  }, [tracks]);

  // Playlists con duración y tracks calculados
  const enrichedPlaylists = useMemo(() => {
    return playlists.map((p) => {
      const playlistTracks: Track[] = [];
      let durationSecs = 0;

      for (const t of tracks) {
        const assigned = playlistTrackMap[t.id] || [];
        if (assigned.includes(p.id) && !t.is_missing) {
          playlistTracks.push(t);
          durationSecs += t.duration || 0;
        }
      }

      const isCurrentPlaylist = activePlaylistId === p.id;

      return {
        ...p,
        tracks: playlistTracks,
        computedDuration: durationSecs,
        isCurrentlyPlaying: isCurrentPlaylist && isPlaying,
      };
    });
  }, [playlists, tracks, playlistTrackMap, activePlaylistId, isPlaying]);

  // Pistas recientes agregadas (últimas 8)
  const recentTracks = useMemo(() => {
    return [...tracks]
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 8);
  }, [tracks]);

  // Manejo de reproducción rápida de playlist
  const handleQuickPlayPlaylist = (
    e: React.MouseEvent,
    playlistTracks: Track[],
    isCurrentlyPlaying: boolean,
    playlistId: number,
  ) => {
    e.stopPropagation();
    if (playlistTracks.length === 0) {
      toast.info(
        "Playlist sin canciones",
        "Esta playlist no tiene canciones para reproducir.",
      );
      return;
    }

    if (isCurrentlyPlaying) {
      togglePlayPause();
    } else if (activePlaylistId === playlistId) {
      // Misma playlist activa pero pausada: reanudar
      togglePlayPause();
    } else {
      // Conmutar reproducción hacia la playlist seleccionada
      const firstPlayable = playlistTracks.find((t) => !t.is_missing);
      if (firstPlayable) {
        playTrack(firstPlayable, playlistTracks, playlistId);
      }
    }
  };

  // Abrir playlist en su vista detallada
  const handleOpenPlaylist = async (playlistId: number) => {
    await selectPlaylist(playlistId);
    onNavigate("playlists");
  };

  // Reproducir una pista individual reciente
  const handlePlayTrack = (track: Track) => {
    if (track.is_missing) return;
    if (currentTrack?.youtube_id === track.youtube_id) {
      togglePlayPause();
    } else {
      playTrack(track, tracks, null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto pr-1">
      {/* 1. Header de Bienvenida */}
      <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" />
            <span>Dashboard Principal</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu colección de música local optimizada, sin interrupciones ni consumo
            innecesario de datos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("library")}
            className="gap-2"
          >
            <Music className="h-4 w-4" />
            Explorar biblioteca
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate("downloads")}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar música
          </Button>
        </div>
      </section>

      {/* 2. Métricas y Estadísticas de la Biblioteca */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Canciones */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Music className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Total Canciones</p>
            <p className="text-lg font-bold text-foreground">
              {stats.totalTracks.toLocaleString()}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {stats.totalTracks === 1 ? "Pista registrada" : "Pistas registradas"}
            </p>
          </div>
        </div>

        {/* Duración Acumulada */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Duración Total</p>
            <p className="text-lg font-bold text-foreground">
              {formatHumanDuration(stats.totalDuration)}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {formatDuration(stats.totalDuration)} en total
            </p>
          </div>
        </div>

        {/* Almacenamiento en Disco */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <HardDrive className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Almacenamiento</p>
            <p className="text-lg font-bold text-foreground">
              {formatBytes(stats.totalBytes)}
            </p>
            <p className="truncate text-2xs text-muted-foreground">Espacio en disco</p>
          </div>
        </div>

        {/* Favoritos */}
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
            <Heart className="h-5 w-5 fill-rose-500/30" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Favoritos</p>
            <p className="text-lg font-bold text-foreground">
              {stats.likedCount.toLocaleString()}
            </p>
            <p className="truncate text-2xs text-muted-foreground">Con Me Gusta</p>
          </div>
        </div>
      </section>

      {/* 3. Cuadrícula de Playlists con Reproducción Rápida */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Tus Playlists</h2>
            <p className="text-xs text-muted-foreground">
              Listas de reproducción personalizadas con conteo de canciones y duración
              acumulada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("playlists")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Ver todas</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {enrichedPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ListMusic className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No tienes playlists creadas aún
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Organiza tus canciones favoritas por género, estado de ánimo o álbumes.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => onNavigate("playlists")}
            >
              <Plus className="h-4 w-4" />
              Crear mi primera playlist
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {enrichedPlaylists.map((playlist) => {
              const coverUrl = toAssetUrl(playlist.cover_path);
              const hasTracks = playlist.tracks.length > 0;

              return (
                <div
                  key={playlist.id}
                  onClick={() => void handleOpenPlaylist(playlist.id)}
                  className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-3 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                >
                  {/* Contenedor de Portada */}
                  <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-muted shadow-inner">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={playlist.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-muted text-muted-foreground">
                        <ListMusic className="h-10 w-10 opacity-40" />
                      </div>
                    )}

                    {/* Botón flotante de Quick Play */}
                    {hasTracks ? (
                      <button
                        type="button"
                        onClick={(e) =>
                          handleQuickPlayPlaylist(
                            e,
                            playlist.tracks,
                            playlist.isCurrentlyPlaying,
                            playlist.id,
                          )
                        }
                        title={
                          playlist.isCurrentlyPlaying
                            ? "Pausar playlist"
                            : `Reproducir "${playlist.title}"`
                        }
                        className={cn(
                          "absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-110 active:scale-95",
                          playlist.isCurrentlyPlaying
                            ? "opacity-100 ring-2 ring-primary-foreground"
                            : "opacity-0 group-hover:opacity-100",
                        )}
                      >
                        {playlist.isCurrentlyPlaying ? (
                          <Pause className="h-5 w-5 fill-current" />
                        ) : (
                          <Play className="ml-0.5 h-5 w-5 fill-current" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(
                            "Playlist sin canciones",
                            "Esta playlist no tiene canciones para reproducir.",
                          );
                        }}
                        title="Esta playlist no tiene canciones"
                        className="absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 text-muted-foreground/50 border border-border/80 shadow-xs opacity-0 group-hover:opacity-100 cursor-not-allowed transition-all duration-200"
                      >
                        <Play className="ml-0.5 h-5 w-5 fill-current opacity-40" />
                      </button>
                    )}
                  </div>

                  {/* Título y Metadatos */}
                  <h3
                    className="truncate text-sm font-semibold text-foreground group-hover:text-primary"
                    title={playlist.title}
                  >
                    {playlist.title}
                  </h3>

                  <div className="mt-1 flex items-center justify-between text-2xs text-muted-foreground">
                    <span>
                      {playlist.track_count}{" "}
                      {playlist.track_count === 1 ? "canción" : "canciones"}
                    </span>
                    {playlist.computedDuration > 0 && (
                      <span className="font-medium text-foreground/80">
                        {formatHumanDuration(playlist.computedDuration)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Sección Inferior: Pistas Recientes + Actividad Reciente */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna Izquierda: Pistas Recientes */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Music className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">Pistas Recientes</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("library")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Ver todas</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {recentTracks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
              <Music className="mb-2 h-8 w-8 opacity-30" />
              <span>No hay canciones registradas en la biblioteca todavía.</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/60">
              {recentTracks.map((track) => {
                const isCurrent = currentTrack?.youtube_id === track.youtube_id;
                const isTrackPlaying = isCurrent && isPlaying;
                const thumbUrl = toAssetUrl(track.thumbnail_path);

                return (
                  <div
                    key={track.youtube_id}
                    onClick={() => handlePlayTrack(track)}
                    className={cn(
                      "group flex cursor-pointer items-center justify-between py-2.5 px-2 rounded-lg transition-colors hover:bg-muted/60",
                      isCurrent && "bg-primary/5 text-primary",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={track.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Music className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/40 text-white transition-opacity",
                            isTrackPlaying
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                        >
                          {isTrackPlaying ? (
                            <Pause className="h-4 w-4 fill-current" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4 fill-current" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-xs font-medium",
                            isCurrent
                              ? "text-primary font-semibold"
                              : "text-foreground",
                          )}
                          title={track.title}
                        >
                          {track.title}
                        </p>
                        <p className="truncate text-2xs text-muted-foreground">
                          {track.artist || "Desconocido"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pl-2">
                      <span className="text-2xs text-muted-foreground">
                        {formatDuration(track.duration)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleLike(track.youtube_id, !track.liked);
                        }}
                        title={track.liked ? "Quitar Me Gusta" : "Me Gusta"}
                        className="rounded p-1 text-muted-foreground hover:text-rose-500"
                      >
                        <Heart
                          className={cn(
                            "h-3.5 w-3.5",
                            track.liked
                              ? "fill-rose-500 text-rose-500"
                              : "text-muted-foreground/60",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Actividad Reciente */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
                <History className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Actividad Reciente
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("downloads")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Ir a descargas</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {downloadHistory.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
              <History className="mb-2 h-8 w-8 opacity-30" />
              <span>No hay actividad de descargas reciente en este espacio.</span>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => onNavigate("downloads")}
              >
                <Download className="h-3.5 w-3.5" />
                Iniciar una descarga
              </Button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/60">
              {downloadHistory.slice(0, 8).map((item) => {
                let badgeTone: "success" | "danger" | "warning" | "info" | "default" =
                  "default";
                let statusLabel = item.status;

                if (item.status === "completed") {
                  badgeTone = "success";
                  statusLabel = "Completado";
                } else if (item.status === "failed") {
                  badgeTone = "danger";
                  statusLabel = "Error";
                } else if (item.status === "skipped") {
                  badgeTone = "warning";
                  statusLabel = "Omitido";
                } else if (
                  item.status === "downloading" ||
                  item.status === "processing"
                ) {
                  badgeTone = "info";
                  statusLabel = "Procesando";
                }

                return (
                  <div
                    key={`${item.youtube_id}-${item.created_at}`}
                    className="flex items-center justify-between py-2.5 px-2 text-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <p
                        className="truncate font-medium text-foreground"
                        title={item.title}
                      >
                        {item.title}
                      </p>
                      <p className="text-2xs text-muted-foreground">
                        {item.created_at}
                        {item.audio_format
                          ? ` • ${item.audio_format.toUpperCase()}`
                          : ""}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <Badge tone={badgeTone}>{statusLabel}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

HomeView.displayName = "HomeView";
