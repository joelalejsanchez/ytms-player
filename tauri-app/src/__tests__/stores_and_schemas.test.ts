import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { formatBytes, formatDuration } from "@/lib/utils";
import {
  downloadFormSchema,
  playlistFormSchema,
  progressEventSchema,
  workspaceConfigSchema,
  youtubeUrlSchema,
} from "@/schemas/validation";
import { buildTaskKey, useDownloadStore } from "@/stores/useDownloadStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { toast, useToastStore } from "@/stores/useToastStore";
import {
  getAllVisualizers,
  getVisualizer,
  registerVisualizer,
  useCoverDominantColor,
  useVisualizerStore,
  visualizerRegistry,
} from "@/features/visualizer";
import type { Track } from "@/types/models";

const sampleTrack: Track = {
  id: 1,
  youtube_id: "dQw4w9WgXcQ",
  title: "Never Gonna Give You Up",
  artist: "Rick Astley",
  duration: 213,
  published_at: "2009-10-25",
  file_extension: "mp3",
  thumbnail_path: "/workspace/thumbnails/dQw4w9WgXcQ.jpg",
  audio_path: "/workspace/tracks/dQw4w9WgXcQ.mp3",
  synced: true,
  liked: true,
  is_missing: false,
  file_size: 3456789,
  created_at: "2026-11-13T10:00:00Z",
};

const missingTrack: Track = {
  ...sampleTrack,
  id: 2,
  youtube_id: "abc123xyz89",
  title: "Missing Track",
  is_missing: true,
};

describe("Zod Schemas Validation", () => {
  it("validates YouTube video and playlist URLs", () => {
    expect(
      youtubeUrlSchema.safeParse("https://www.youtube.com/watch?v=dQw4w9WgXcQ").success,
    ).toBe(true);
    expect(youtubeUrlSchema.safeParse("https://youtu.be/dQw4w9WgXcQ").success).toBe(
      true,
    );
    expect(
      youtubeUrlSchema.safeParse(
        "https://www.youtube.com/playlist?list=PL1234567890ABCDEF",
      ).success,
    ).toBe(true);
    expect(
      youtubeUrlSchema.safeParse("https://evil.com/watch?v=dQw4w9WgXcQ").success,
    ).toBe(false);
  });

  it("validates download form, playlist form and SSE progress events", () => {
    const dl = downloadFormSchema.safeParse({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      audioFormat: "m4a",
      forceOverwrite: false,
      asyncMode: true,
      targetPlaylistId: 42,
      skipPlaylist: false,
    });
    expect(dl.success).toBe(true);
    if (dl.success) {
      expect(dl.data.targetPlaylistId).toBe(42);
      expect(dl.data.skipPlaylist).toBe(false);
    }

    const pl = playlistFormSchema.safeParse({
      title: "Synthwave Mix",
      youtubePlaylistId: "PL1234567890ABCDEF",
    });
    expect(pl.success).toBe(true);

    const ws = workspaceConfigSchema.safeParse({
      rootPath: "/home/user/workspace/../etc",
      microserviceUrl: "http://127.0.0.1:8080",
    });
    expect(ws.success).toBe(false);

    const sse = progressEventSchema.safeParse({
      task_id: "task-001",
      youtube_id: "dQw4w9WgXcQ",
      status: "downloading",
      progress: 65.4,
      speed: "2.5 MiB/s",
      eta: "00:00:18",
    });
    expect(sse.success).toBe(true);
  });
});

describe("usePlayerStore", () => {
  beforeEach(() => {
    usePlayerStore.getState().clearQueue();
  });

  it("plays a valid track and refuses to play missing tracks", () => {
    usePlayerStore.getState().playTrack(missingTrack);
    expect(usePlayerStore.getState().currentTrack).toBeNull();

    usePlayerStore.getState().playTrack(sampleTrack);
    expect(usePlayerStore.getState().currentTrack?.youtube_id).toBe("dQw4w9WgXcQ");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("toggles play/pause, volume and repeat mode", () => {
    usePlayerStore.getState().playTrack(sampleTrack);
    usePlayerStore.getState().togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    usePlayerStore.getState().setVolume(0.4);
    expect(usePlayerStore.getState().volume).toBe(0.4);

    usePlayerStore.getState().cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("all");
  });

  it("blocks seekTo while track is loading and unlocks when loaded", () => {
    usePlayerStore.getState().playTrack(sampleTrack);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(true);

    // Intentar buscar mientras carga debe ser ignorado
    usePlayerStore.getState().seekTo(80);
    expect(usePlayerStore.getState().seekTarget).toBeNull();
    expect(usePlayerStore.getState().currentTime).toBe(0);

    // Al finalizar carga se desbloquea
    usePlayerStore.getState().setIsLoadingTrack(false);
    usePlayerStore.getState().seekTo(80);
    expect(usePlayerStore.getState().seekTarget).toBe(80);
    expect(usePlayerStore.getState().currentTime).toBe(80);
  });

  it("preserves shuffle mode when playing a new playlist queue", () => {
    const track2: Track = { ...sampleTrack, id: 3, youtube_id: "track_2" };
    const track3: Track = { ...sampleTrack, id: 4, youtube_id: "track_3" };
    const track4: Track = { ...sampleTrack, id: 5, youtube_id: "track_4" };

    usePlayerStore.setState({ isShuffle: true });
    usePlayerStore.getState().playTrack(track2, [sampleTrack, track2, track3, track4]);

    const state = usePlayerStore.getState();
    expect(state.currentTrack?.youtube_id).toBe("track_2");
    expect(state.currentIndex).toBe(0);
    expect(state.queue[0].youtube_id).toBe("track_2");
    expect(state.queue.length).toBe(4);
    expect(state.isShuffle).toBe(true);
  });
});

describe("useDownloadStore & Utility Helpers", () => {
  it("upserts SSE progress events and clears completed tasks", () => {
    const store = useDownloadStore.getState();
    store.upsertProgressEvent({
      task_id: "task-001",
      youtube_id: "dQw4w9WgXcQ",
      status: "completed",
      progress: 100,
    });

    const key = buildTaskKey("task-001", "dQw4w9WgXcQ");
    expect(useDownloadStore.getState().tasks[key]?.progress).toBe(100);

    useDownloadStore.getState().clearCompletedTasks();
    expect(useDownloadStore.getState().tasks[key]).toBeUndefined();
  });

  it("updates precached playlist item with worker task event without duplicating entries", () => {
    const store = useDownloadStore.getState();
    // 1. Precarga desde modal de playlist
    store.upsertProgressEvent({
      task_id: "PL123456789",
      youtube_id: "track_abc123",
      status: "queued",
      progress: 0,
      metadata: {
        youtube_id: "track_abc123",
        title: "Test Song",
        artist: "Test Artist",
        duration: 180,
        file_extension: "mp3",
        thumbnail_path: "",
        audio_path: "",
        file_size: 0,
        playlist_id: "PL123456789",
        playlist_title: "My Rock Playlist",
      },
    });

    const precachedKey = buildTaskKey("PL123456789", "track_abc123");
    expect(useDownloadStore.getState().tasks[precachedKey]?.status).toBe("queued");

    // 2. Llega evento de descarga del worker con task_id generado
    store.upsertProgressEvent({
      task_id: "task-999",
      youtube_id: "track_abc123",
      status: "completed",
      progress: 100,
    });

    const activeTasks = Object.values(useDownloadStore.getState().tasks);
    const matching = activeTasks.filter((t) => t.youtube_id === "track_abc123");
    expect(matching.length).toBe(1);
    expect(matching[0]?.status).toBe("completed");
    expect(matching[0]?.progress).toBe(100);
    expect(matching[0]?.metadata?.playlist_id).toBe("PL123456789");
    expect(matching[0]?.metadata?.title).toBe("Test Song");

    useDownloadStore.getState().clearCompletedTasks();
  });

  it("formats duration and byte sizes accurately", () => {
    expect(formatDuration(213)).toBe("03:33");
    expect(formatDuration(3665)).toBe("1:01:05");
    expect(formatBytes(1024 * 1024 * 3.5)).toBe("3.5 MB");
  });

  it("filters songs under 7 minutes (420 seconds) by default for playlist imports", () => {
    const previewItems = [
      { youtube_id: "short_1", title: "Single 1", artist: "Artist", duration: 180 },
      { youtube_id: "long_mix", title: "1 Hour DJ Mix", artist: "DJ", duration: 3600 },
      {
        youtube_id: "edge_case",
        title: "7 Min Exact",
        artist: "Artist",
        duration: 420,
      },
      { youtube_id: "short_2", title: "Single 2", artist: "Artist", duration: 419 },
    ];

    const defaultSelected = new Set(
      previewItems.filter((i) => (i.duration || 0) < 420).map((i) => i.youtube_id),
    );

    expect(defaultSelected.has("short_1")).toBe(true);
    expect(defaultSelected.has("short_2")).toBe(true);
    expect(defaultSelected.has("long_mix")).toBe(false);
    expect(defaultSelected.has("edge_case")).toBe(false);
    expect(defaultSelected.size).toBe(2);
  });
});

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("initializes with default light mode and blue color family", () => {
    useThemeStore.getState().initTheme();
    const state = useThemeStore.getState();
    expect(state.mode).toBe("light");
    expect(state.colorFamily).toBe("blue");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("blue")).toBe(true);
  });

  it("switches theme mode and color family dynamically injecting classes on root", () => {
    const store = useThemeStore.getState();

    store.setMode("dark");
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);

    store.setColorFamily("teal");
    expect(useThemeStore.getState().colorFamily).toBe("teal");
    expect(document.documentElement.classList.contains("teal")).toBe(true);
    expect(document.documentElement.classList.contains("blue")).toBe(false);

    store.setColorFamily("ember");
    expect(useThemeStore.getState().colorFamily).toBe("ember");
    expect(document.documentElement.classList.contains("ember")).toBe(true);
    expect(document.documentElement.classList.contains("teal")).toBe(false);
    expect(document.documentElement.classList.contains("blue")).toBe(false);

    store.setColorFamily("midnight");
    expect(useThemeStore.getState().colorFamily).toBe("midnight");
    expect(document.documentElement.classList.contains("midnight")).toBe(true);
    expect(document.documentElement.classList.contains("ember")).toBe(false);

    store.setColorFamily("amber");
    expect(useThemeStore.getState().colorFamily).toBe("amber");
    expect(document.documentElement.classList.contains("amber")).toBe(true);
    expect(document.documentElement.classList.contains("midnight")).toBe(false);

    store.toggleMode();
    expect(useThemeStore.getState().mode).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("amber")).toBe(true);

    store.setMode("system");
    expect(useThemeStore.getState().mode).toBe("system");
    // Resolved mode injects either light or dark depending on matchMedia
    expect(
      document.documentElement.classList.contains("light") ||
        document.documentElement.classList.contains("dark"),
    ).toBe(true);
  });
});

describe("useToastStore and toast API", () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  it("adds, displays and dismisses toasts cleanly", () => {
    const id = toast.info("Probando info", "Detalle de prueba");
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe("Probando info");
    expect(useToastStore.getState().toasts[0].variant).toBe("info");

    toast.warning("Alerta de prueba");
    toast.error("Error crítico");
    expect(useToastStore.getState().toasts).toHaveLength(3);

    toast.dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(2);
    expect(useToastStore.getState().toasts.some((t) => t.id === id)).toBe(false);

    useToastStore.getState().clear();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe("usePlayerStore - queue preservation and corrupted tracks", () => {
  const trackA: Track = { ...sampleTrack, id: 10, youtube_id: "track_A", title: "A" };
  const trackB: Track = { ...sampleTrack, id: 20, youtube_id: "track_B", title: "B" };
  const trackC: Track = { ...sampleTrack, id: 30, youtube_id: "track_C", title: "C" };

  beforeEach(() => {
    usePlayerStore.getState().clearQueue();
  });

  it("preserves currently playing track and updates queue according to Spotify standard in shuffle mode", () => {
    const store = usePlayerStore.getState();
    store.playTrack(trackB, [trackA, trackB, trackC]);
    if (!store.isShuffle) {
      store.toggleShuffle();
    }
    expect(usePlayerStore.getState().isShuffle).toBe(true);

    // Reproducir todos con filtro [trackA, trackB, trackC]
    usePlayerStore.getState().setQueuePreservingCurrent([trackA, trackB, trackC]);
    const updated = usePlayerStore.getState();
    // Canción actual debe mantenerse en la posición #0 en shuffle
    expect(updated.queue[0].youtube_id).toBe("track_B");
    expect(updated.currentIndex).toBe(0);
    expect(updated.queue).toHaveLength(3);
  });

  it("preserves currently playing track and places index in order when shuffle is off", () => {
    const store = usePlayerStore.getState();
    if (store.isShuffle) {
      store.toggleShuffle();
    }
    expect(usePlayerStore.getState().isShuffle).toBe(false);

    store.playTrack(trackB, [trackA, trackB, trackC]);
    usePlayerStore.getState().setQueuePreservingCurrent([trackA, trackB, trackC]);
    const updated = usePlayerStore.getState();
    expect(updated.currentIndex).toBe(1);
    expect(updated.queue[1].youtube_id).toBe("track_B");
  });

  it("marks and unmarks corrupted tracks", () => {
    const store = usePlayerStore.getState();
    expect(store.corruptedTrackIds).toEqual([]);

    store.markTrackCorrupted("corrupt_1");
    expect(usePlayerStore.getState().corruptedTrackIds).toContain("corrupt_1");

    store.markTrackCorrupted("corrupt_1"); // idempotente
    expect(usePlayerStore.getState().corruptedTrackIds).toHaveLength(1);

    store.clearCorruptedTrack("corrupt_1");
    expect(usePlayerStore.getState().corruptedTrackIds).toHaveLength(0);
  });

  it("does not leave isLoadingTrack stuck on true when playing the already active track", () => {
    const store = usePlayerStore.getState();
    store.playTrack(trackA, [trackA, trackB]);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(true);

    // Simular que el audio ya terminó de cargar
    store.setIsLoadingTrack(false);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(false);

    // Re-invocar playTrack sobre la misma canción
    usePlayerStore.getState().playTrack(trackA);
    // No debe ponerse en true si es la misma canción ya cargada
    expect(usePlayerStore.getState().isLoadingTrack).toBe(false);
  });

  it("restores original normal queue and sets correct index when toggling shuffle off", () => {
    const store = usePlayerStore.getState();
    // Iniciar con lista ordenada A, B, C
    store.playTrack(trackA, [trackA, trackB, trackC]);
    // Activar shuffle
    if (!usePlayerStore.getState().isShuffle) {
      store.toggleShuffle();
    }
    expect(usePlayerStore.getState().isShuffle).toBe(true);

    // Desactivar shuffle: debe volver al orden normal [A, B, C]
    store.toggleShuffle();
    const state = usePlayerStore.getState();
    expect(state.isShuffle).toBe(false);
    expect(state.queue.map((t) => t.youtube_id)).toEqual(["track_A", "track_B", "track_C"]);
    expect(state.currentIndex).toBe(0);
  });

  it("toggles and sets Now Playing expansion state", () => {
    const store = usePlayerStore.getState();
    expect(store.isNowPlayingExpanded).toBe(false);

    store.setNowPlayingExpanded(true);
    expect(usePlayerStore.getState().isNowPlayingExpanded).toBe(true);

    store.toggleNowPlayingExpanded();
    expect(usePlayerStore.getState().isNowPlayingExpanded).toBe(false);
  });

  it("updates track metadata reactively on currentTrack and queue", () => {
    const store = usePlayerStore.getState();
    store.playTrack(sampleTrack, [sampleTrack]);
    expect(usePlayerStore.getState().currentTrack?.liked).toBe(true);

    store.updateTrackMetadata({ youtube_id: sampleTrack.youtube_id, liked: false });
    expect(usePlayerStore.getState().currentTrack?.liked).toBe(false);
    expect(usePlayerStore.getState().queue[0].liked).toBe(false);
  });
});

describe("Visualizer API and Registry", () => {
  it("initializes with all 4 built-in visualizer modules", () => {
    const vinyl = getVisualizer("vinyl");
    expect(vinyl).toBeDefined();
    expect(vinyl?.metadata.id).toBe("vinyl");
    expect(vinyl?.metadata.name).toContain("Vinilo");

    const spectrum = getVisualizer("spectrum");
    expect(spectrum).toBeDefined();
    expect(spectrum?.metadata.id).toBe("spectrum");

    const ambientAura = getVisualizer("ambient-aura");
    expect(ambientAura).toBeDefined();
    expect(ambientAura?.metadata.id).toBe("ambient-aura");

    const coverWaves = getVisualizer("cover-waves");
    expect(coverWaves).toBeDefined();
    expect(coverWaves?.metadata.id).toBe("cover-waves");

    expect(getAllVisualizers().length).toBe(4);
  });

  it("allows registering and unregistering custom visualizer modules (Export API)", () => {
    const DummyComponent = () => null;

    registerVisualizer({
      metadata: {
        id: "custom-neon-wave",
        name: "Onda Neón Personalizada",
        description: "Visualizador de prueba creado mediante la API pública",
        version: "1.0.0",
      },
      Component: DummyComponent,
    });

    const registered = getVisualizer("custom-neon-wave");
    expect(registered).toBeDefined();
    expect(registered?.metadata.name).toBe("Onda Neón Personalizada");

    visualizerRegistry.unregister("custom-neon-wave");
    expect(getVisualizer("custom-neon-wave")).toBeUndefined();
  });

  it("manages active visualizer selection and persistence in useVisualizerStore", () => {
    const store = useVisualizerStore.getState();
    expect(store.activeVisualizerId).toBe("vinyl");

    store.setActiveVisualizer("custom_mode");
    expect(useVisualizerStore.getState().activeVisualizerId).toBe("custom_mode");
    expect(window.localStorage.getItem("ytms_active_visualizer")).toBe("custom_mode");

    // Restaurar a vinyl
    store.setActiveVisualizer("vinyl");
  });

  it("handles null and empty image URLs gracefully in useCoverDominantColor", () => {
    const { result } = renderHook(() => useCoverDominantColor(null));
    expect(result.current).toBeNull();

    const { result: emptyResult } = renderHook(() => useCoverDominantColor(""));
    expect(emptyResult.current).toBeNull();
  });
});

describe("Error Logs and Diagnostics Subsystem (useLogStore & logger)", () => {
  it("records logs with timestamps and formats text export accurately", async () => {
    const { useLogStore, logger, formatLogTimestamp } = await import("@/stores/useLogStore");
    const store = useLogStore.getState();
    store.clearLogs();
    expect(useLogStore.getState().logs).toHaveLength(0);

    // Formateador de fecha
    const ts = formatLogTimestamp(new Date("2026-11-16T12:00:00"));
    expect(ts).toBe("2026-11-16 12:00:00");

    // Registro mediante logger global
    logger.error("Fallo de conexión", "El microservicio Go rechazó la petición", "streaming");
    logger.warn("Poco espacio en disco", "Quedan menos de 500 MB", "system");
    logger.info("Sincronización iniciada", "Verificando integridad", "library");

    const currentLogs = useLogStore.getState().logs;
    expect(currentLogs).toHaveLength(3);
    expect(currentLogs[0].level).toBe("error");
    expect(currentLogs[0].context).toBe("streaming");
    expect(currentLogs[0].formattedTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // Exportación de reporte
    const report = useLogStore.getState().exportLogsAsText();
    expect(report).toContain("REPORTE DE ERRORES Y DIAGNÓSTICO");
    expect(report).toContain("Fallo de conexión");
    expect(report).toContain("[ERROR]");
    expect(report).toContain("[streaming]");

    // Limpieza
    store.clearLogs();
    expect(useLogStore.getState().logs).toHaveLength(0);
  });

  it("automatically intercepts toast.error and toast.warning into useLogStore", async () => {
    const { useLogStore } = await import("@/stores/useLogStore");
    const { toast } = await import("@/stores/useToastStore");

    useLogStore.getState().clearLogs();

    toast.error("Error de descarga", "404 Video Unavailable");
    toast.warning("Aviso de red", "Conexión lenta detectada");

    const captured = useLogStore.getState().logs;
    expect(captured).toHaveLength(2);
    expect(captured[0].title).toBe("Error de descarga");
    expect(captured[0].level).toBe("error");
    expect(captured[0].context).toBe("toast");

    expect(captured[1].title).toBe("Aviso de red");
    expect(captured[1].level).toBe("warn");
    expect(captured[1].context).toBe("toast");

    useLogStore.getState().clearLogs();
  });
});
