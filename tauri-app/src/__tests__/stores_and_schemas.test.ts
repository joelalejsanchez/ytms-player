import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { formatBytes, formatDuration, formatHumanDuration } from "@/lib/utils";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { HomeView } from "@/features/home/HomeView";
import { TrackRow } from "@/features/library/TrackRow";
import { PlaylistsView } from "@/features/playlists/PlaylistsView";
import { NowPlayingView } from "@/features/visualizer/components/NowPlayingView";
import { useLibraryStore } from "@/stores/useLibraryStore";
import {
  downloadFormSchema,
  playlistFormSchema,
  progressEventSchema,
  workspaceConfigSchema,
  youtubeUrlSchema,
} from "@/schemas/validation";
import { tauriApi } from "@/services/tauriIpc";
import { buildTaskKey, useDownloadStore } from "@/stores/useDownloadStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { sortToastsByPriority, toast, useToastStore } from "@/stores/useToastStore";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { usePlayerControlTooltips } from "@/hooks/usePlayerControlTooltips";
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

  it("tracks activePlaylistId when playing a playlist queue and resets when playing individual queue", () => {
    usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack], 42);
    expect(usePlayerStore.getState().activePlaylistId).toBe(42);

    // Reproducir cola sin playlistId debe reiniciar activePlaylistId a null
    usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
    expect(usePlayerStore.getState().activePlaylistId).toBeNull();
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

  it("preserves advanced status when startDownloadTask resolves after SSE events", async () => {
    const store = useDownloadStore.getState();
    vi.spyOn(tauriApi, "startDownload").mockResolvedValueOnce({
      task_id: "task-race-1",
      status: "queued",
      content_type: "video",
      youtube_id: "race_track_1",
      items: [],
    });

    // 1. Simular que SSE emite "processing" antes o durante la resolución
    store.upsertProgressEvent({
      task_id: "task-race-1",
      youtube_id: "race_track_1",
      status: "processing",
      progress: 95,
    });

    // 2. Ejecutar startDownloadTask (que devuelve status: "queued")
    await store.startDownloadTask({
      url: "https://www.youtube.com/watch?v=race_track_1",
      audio_format: "mp3",
      force_overwrite: false,
      async_mode: true,
    });

    // 3. Verificar que no se degradó de "processing" a "queued"
    const key = buildTaskKey("task-race-1", "race_track_1");
    const task = useDownloadStore.getState().tasks[key];
    expect(task?.status).toBe("processing");
    expect(task?.progress).toBe(95);

    useDownloadStore.getState().clearAllTasks();
  });

  it("formats duration and byte sizes accurately", () => {
    expect(formatDuration(213)).toBe("03:33");
    expect(formatDuration(3665)).toBe("1:01:05");
    expect(formatBytes(1024 * 1024 * 3.5)).toBe("3.5 MB");
    expect(formatHumanDuration(0)).toBe("0 min");
    expect(formatHumanDuration(45 * 60)).toBe("45 min");
    expect(formatHumanDuration(3600 * 2 + 60 * 15)).toBe("2h 15m");
    expect(formatHumanDuration(86400 + 3600 * 3 + 60 * 5)).toBe("1d 3h 5m");
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

  it("renders ToastContainer with solid bg-card background and accessible role", () => {
    toast.info("Descarga completa", "Pista guardada correctamente");
    const { getByRole, getByText } = render(React.createElement(ToastContainer));
    const alert = getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.className).toContain("bg-card");
    expect(getByText("Descarga completa")).toBeInTheDocument();
    expect(getByText("Pista guardada correctamente")).toBeInTheDocument();
  });

  it("renders stacked cards with perimeter timer and suppresses circular countdown clock", () => {
    toast.info("Toast Uno", "Primer mensaje");
    toast.warning("Toast Dos", "Segundo mensaje");
    const { container, getAllByRole } = render(React.createElement(ToastContainer));

    // Debe renderizar ambas alertas
    const alerts = getAllByRole("alert");
    expect(alerts).toHaveLength(2);

    // 1. Supresión del reloj circular previo: ningún elemento debe tener id toast-clock-grad
    expect(container.querySelector('[id^="toast-clock-grad-"]')).toBeNull();

    // 2. Temporizador perimetral animado: debe existir <rect> con toast-perimeter
    const perimeterRects = container.querySelectorAll("rect[pathLength='100']");
    expect(perimeterRects.length).toBe(2);

    // 3. Tarjeta superior al frente (Toast Dos) y previa detrás con escala reducida
    const frontCard = alerts[1]; // Último añadido
    const backCard = alerts[0];
    expect(frontCard.style.transform).toContain("scale(1)");
    expect(backCard.style.transform).toContain("scale(0.94)");

    // 4. Al pasar el cursor (hover), la pila se expande
    const hoverContainer = container.querySelector(".pointer-events-auto");
    expect(hoverContainer).not.toBeNull();
    if (hoverContainer) {
      fireEvent.mouseEnter(hoverContainer);
      expect(backCard.style.transform).toContain("scale(1)");

      fireEvent.mouseLeave(hoverContainer);
      expect(backCard.style.transform).toContain("scale(0.94)");
    }
  });

  it("enforces strict visual limit of 3 visible cards, shows +N badge, and prioritizes by severity", () => {
    // Agregamos 5 toasts: 4 informativos y 1 de error crítico
    toast.info("Descarga 1", "Pista 1");
    toast.info("Descarga 2", "Pista 2");
    toast.info("Descarga 3", "Pista 3");
    toast.info("Descarga 4", "Pista 4");
    const errorId = toast.error("Fallo crítico", "Error en red");

    // En memoria el store debe retener los 5 toasts sin descartarlos prematuramente
    expect(useToastStore.getState().toasts).toHaveLength(5);

    const { getAllByRole, getByText } = render(React.createElement(ToastContainer));

    // Tope visual estricto: solo 3 tarjetas físicas en el DOM
    const visibleAlerts = getAllByRole("alert");
    expect(visibleAlerts).toHaveLength(3);

    // Priorización por severidad: la tarjeta de error debe situarse al frente (scale 1)
    const frontAlert = visibleAlerts[visibleAlerts.length - 1];
    expect(frontAlert).toHaveTextContent("Fallo crítico");
    expect(frontAlert.style.transform).toContain("scale(1)");

    // Badge numérico indicador (+2 más esperando en la cola)
    expect(getByText("+2 más")).toBeInTheDocument();

    // Drenaje secuencial: al descartar el error, el siguiente toast pasa al frente y el badge decrece a +1
    act(() => {
      toast.dismiss(errorId);
    });
    expect(useToastStore.getState().toasts).toHaveLength(4);
  });

  it("renders contextual action button, defaults duration to 7000ms, and executes callbacks on click", () => {
    let actionExecuted = false;
    let dismissCallbackExecuted = false;

    const id = toast.success("Descarga completada", "Canción lista en biblioteca", {
      action: {
        label: "Ver en biblioteca",
        onClick: () => {
          actionExecuted = true;
        },
      },
      onDismissCallback: () => {
        dismissCallbackExecuted = true;
      },
    });

    const toastItem = useToastStore.getState().toasts.find((t) => t.id === id);
    expect(toastItem).toBeDefined();
    expect(toastItem?.duration).toBe(7000);
    expect(toastItem?.action?.label).toBe("Ver en biblioteca");

    const { getByText } = render(React.createElement(ToastContainer));
    const actionBtn = getByText("Ver en biblioteca");
    expect(actionBtn).toBeInTheDocument();
    expect(actionBtn.tagName).toBe("BUTTON");

    // Al hacer clic en el botón de acción: ejecuta onClick, onDismissCallback y remueve el toast
    act(() => {
      fireEvent.click(actionBtn);
    });

    expect(actionExecuted).toBe(true);
    expect(dismissCallbackExecuted).toBe(true);
    expect(useToastStore.getState().toasts.some((t) => t.id === id)).toBe(false);
  });

  it("executes onDismissCallback when toast is dismissed manually", () => {
    let dismissCallbackCount = 0;
    const id = toast.info("Notificación con callback", "Detalle", {
      onDismissCallback: () => {
        dismissCallbackCount++;
      },
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => {
      toast.dismiss(id);
    });

    expect(dismissCallbackCount).toBe(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("sorts toasts by severity (error > warning > success > info) and then FIFO", () => {
    const list = [
      {
        id: "1",
        title: "Info 1",
        variant: "info" as const,
        duration: 3000,
        createdAt: 100,
      },
      {
        id: "2",
        title: "Success 1",
        variant: "success" as const,
        duration: 3000,
        createdAt: 200,
      },
      {
        id: "3",
        title: "Error 1",
        variant: "error" as const,
        duration: 3000,
        createdAt: 300,
      },
      {
        id: "4",
        title: "Warning 1",
        variant: "warning" as const,
        duration: 3000,
        createdAt: 400,
      },
      {
        id: "5",
        title: "Error 2",
        variant: "error" as const,
        duration: 3000,
        createdAt: 150,
      },
    ];

    const sorted = [...list].sort(sortToastsByPriority);
    // Errores primero ordenados por createdAt (150 antes de 300)
    expect(sorted[0].id).toBe("5"); // Error 2 (t=150)
    expect(sorted[1].id).toBe("3"); // Error 1 (t=300)
    expect(sorted[2].id).toBe("4"); // Warning 1
    expect(sorted[3].id).toBe("2"); // Success 1
    expect(sorted[4].id).toBe("1"); // Info 1
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
    expect(state.queue.map((t) => t.youtube_id)).toEqual([
      "track_A",
      "track_B",
      "track_C",
    ]);
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

  it("protects boundaries and avoids freezing isLoadingTrack on playNext", () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({ repeatMode: "off" });
    store.playTrack(sampleTrack, [sampleTrack]);
    store.setIsLoadingTrack(false);
    store.setCurrentTime(45);

    // 1. Con repeatMode "off" y cola de 1 pista, playNext debe ser no-op y no desincronizar
    expect(usePlayerStore.getState().repeatMode).toBe("off");
    store.playNext();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().currentTime).toBe(45);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(false);

    // 2. Con repeatMode "one", playNext debe reiniciar a tiempo 0 sin dejar isLoadingTrack en true
    usePlayerStore.setState({ repeatMode: "one" });
    store.playNext();
    expect(usePlayerStore.getState().currentTime).toBe(0);
    expect(usePlayerStore.getState().seekTarget).toBe(0);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(false);

    // 3. Con cola de varias pistas en repeatMode "all", playNext al final de la cola debe envolver al inicio
    usePlayerStore.setState({ repeatMode: "all" });
    store.playTrack(trackC, [trackA, trackB, trackC]);
    store.setIsLoadingTrack(false);
    expect(usePlayerStore.getState().currentIndex).toBe(2);

    store.playNext();
    expect(usePlayerStore.getState().currentIndex).toBe(0);
    expect(usePlayerStore.getState().currentTrack?.youtube_id).toBe("track_A");
    expect(usePlayerStore.getState().isLoadingTrack).toBe(true); // Nueva pista distinta
  });

  it("protects boundaries, rewinds when currentTime > 3s, and wraps on repeatMode all in playPrevious", () => {
    const store = usePlayerStore.getState();
    store.playTrack(trackA, [trackA, trackB, trackC]);
    store.setIsLoadingTrack(false);
    usePlayerStore.setState({ repeatMode: "off" });

    // 1. En la primera pista con tiempo <= 3s y repeatMode "off", playPrevious debe ser no-op
    store.setCurrentTime(2);
    store.playPrevious();
    expect(usePlayerStore.getState().currentIndex).toBe(0);
    expect(usePlayerStore.getState().currentTime).toBe(2);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(false);

    // 2. En la primera pista con tiempo > 3s, playPrevious debe reiniciar a 0 sin cambiar índice ni congelar
    store.setCurrentTime(15);
    store.playPrevious();
    expect(usePlayerStore.getState().currentIndex).toBe(0);
    expect(usePlayerStore.getState().currentTime).toBe(0);
    expect(usePlayerStore.getState().seekTarget).toBe(0);
    expect(usePlayerStore.getState().isLoadingTrack).toBe(false);

    // 3. En la primera pista con repeatMode "all" y tiempo <= 3s, playPrevious envuelve a la última pista
    usePlayerStore.setState({ repeatMode: "all" });
    store.setCurrentTime(1);
    store.playPrevious();
    expect(usePlayerStore.getState().currentIndex).toBe(2);
    expect(usePlayerStore.getState().currentTrack?.youtube_id).toBe("track_C");
    expect(usePlayerStore.getState().isLoadingTrack).toBe(true);

    // 4. En pista intermedia, playPrevious retrocede a la anterior
    store.playPrevious();
    expect(usePlayerStore.getState().currentIndex).toBe(1);
    expect(usePlayerStore.getState().currentTrack?.youtube_id).toBe("track_B");
  });
});

describe("Visualizer API and Registry", () => {
  it("initializes with all 6 built-in visualizer modules", () => {
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

    const physicalCase = getVisualizer("physical-case");
    expect(physicalCase).toBeDefined();
    expect(physicalCase?.metadata.id).toBe("physical-case");
    expect(physicalCase?.metadata.name).toContain("Estuche");

    const staticDisc = getVisualizer("static-disc");
    expect(staticDisc).toBeDefined();
    expect(staticDisc?.metadata.id).toBe("static-disc");
    expect(staticDisc?.metadata.name).toContain("Estático");

    expect(getAllVisualizers().length).toBe(6);
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
    const { useLogStore, logger, formatLogTimestamp } =
      await import("@/stores/useLogStore");
    const store = useLogStore.getState();
    store.clearLogs();
    expect(useLogStore.getState().logs).toHaveLength(0);

    // Formateador de fecha
    const ts = formatLogTimestamp(new Date("2026-11-16T12:00:00"));
    expect(ts).toBe("2026-11-16 12:00:00");

    // Registro mediante logger global
    logger.error(
      "Fallo de conexión",
      "El microservicio Go rechazó la petición",
      "streaming",
    );
    logger.warn("Poco espacio en disco", "Quedan menos de 500 MB", "system");
    logger.info("Sincronización iniciada", "Verificando integridad", "library");

    const currentLogs = useLogStore.getState().logs;
    expect(currentLogs).toHaveLength(3);
    expect(currentLogs[0].level).toBe("error");
    expect(currentLogs[0].context).toBe("streaming");
    expect(currentLogs[0].formattedTime).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );

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

  describe("Playlists Sequential Navigation (PlaylistsView)", () => {
    const samplePlaylist = {
      id: 101,
      title: "Synthwave Vibes",
      youtube_playlist_id: "PL1234567890",
      cover_path: "/workspace/thumbnails/cover.jpg",
      track_count: 1,
      created_at: "2026-11-18T10:00:00Z",
    };

    const samplePlaylist2 = {
      id: 102,
      title: "Lo-Fi Study",
      youtube_playlist_id: null,
      cover_path: null,
      track_count: 0,
      created_at: "2026-11-18T11:00:00Z",
    };

    beforeEach(() => {
      useLibraryStore.setState({
        playlists: [samplePlaylist, samplePlaylist2],
        activePlaylist: null,
        tracks: [sampleTrack],
        playlistTrackMap: { [sampleTrack.id]: [101] },
      });
    });

    it("renders main view with full-width playlist grid and metadata when activePlaylist is null", () => {
      render(React.createElement(PlaylistsView));

      expect(screen.getByText("Tus Playlists")).toBeInTheDocument();
      expect(screen.getByText("Synthwave Vibes")).toBeInTheDocument();
      expect(screen.getByText("Lo-Fi Study")).toBeInTheDocument();
      expect(screen.getByTitle("Sincronizada con YouTube")).toBeInTheDocument();
      expect(screen.queryByText("PL1234567890")).not.toBeInTheDocument();
      expect(screen.getByTitle("Vista en cuadrícula")).toBeInTheDocument();
      expect(screen.getByTitle("Vista en lista")).toBeInTheDocument();
    });

    it("filters playlists via search query in main view", () => {
      render(React.createElement(PlaylistsView));

      const searchInput = screen.getByPlaceholderText("Buscar playlist...");
      fireEvent.change(searchInput, { target: { value: "Synth" } });

      expect(screen.getByText("Synthwave Vibes")).toBeInTheDocument();
      expect(screen.queryByText("Lo-Fi Study")).not.toBeInTheDocument();
    });

    it("switches view mode between grid and list", () => {
      render(React.createElement(PlaylistsView));

      const listBtn = screen.getByTitle("Vista en lista");
      fireEvent.click(listBtn);

      expect(screen.getByText("Synthwave Vibes")).toBeInTheDocument();
      expect(screen.getByText("Lo-Fi Study")).toBeInTheDocument();
    });

    it("renders sequential detail view with return button and breadcrumbs when a playlist is active", () => {
      useLibraryStore.setState({
        activePlaylist: {
          playlist: samplePlaylist,
          tracks: [sampleTrack],
        },
      });

      render(React.createElement(PlaylistsView));

      expect(screen.getByText("Volver a Playlists")).toBeInTheDocument();
      expect(screen.getByText("Playlists")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: "Synthwave Vibes" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Never Gonna Give You Up")).toBeInTheDocument();
      expect(screen.getByText("Rick Astley")).toBeInTheDocument();
      expect(screen.getByText("Reproducir Playlist")).toBeInTheDocument();
    });

    it("returns to main playlists list view when clicking 'Volver a Playlists'", () => {
      useLibraryStore.setState({
        activePlaylist: {
          playlist: samplePlaylist,
          tracks: [sampleTrack],
        },
      });

      render(React.createElement(PlaylistsView));

      const backButton = screen.getByText("Volver a Playlists");
      fireEvent.click(backButton);

      expect(useLibraryStore.getState().activePlaylist).toBeNull();
    });
  });

  describe("HomeView Playlists Quick Play & Active State", () => {
    const pl1 = {
      id: 1,
      title: "Rock Classics",
      youtube_playlist_id: null,
      cover_path: null,
      track_count: 1,
      created_at: "2026-11-18T10:00:00Z",
    };
    const pl2 = {
      id: 2,
      title: "Best of 80s",
      youtube_playlist_id: null,
      cover_path: null,
      track_count: 1,
      created_at: "2026-11-18T10:00:00Z",
    };
    const plEmpty = {
      id: 3,
      title: "Empty Playlist",
      youtube_playlist_id: null,
      cover_path: null,
      track_count: 0,
      created_at: "2026-11-18T10:00:00Z",
    };

    beforeEach(() => {
      useLibraryStore.setState({
        playlists: [pl1, pl2, plEmpty],
        tracks: [sampleTrack],
        playlistTrackMap: { [sampleTrack.id]: [1, 2] },
      });
      usePlayerStore.getState().clearQueue();
    });

    it("does not falsely activate multiple playlist cards sharing the same track", () => {
      // Reproducir playlist 1
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack], 1);

      const onNavigate = vi.fn();
      render(React.createElement(HomeView, { onNavigate }));

      // Solo pl1 debe tener título 'Pausar playlist'
      const pl1Btn = screen.getByTitle("Pausar playlist");
      expect(pl1Btn).toBeInTheDocument();

      // pl2 NO debe tener 'Pausar playlist' sino 'Reproducir "Best of 80s"'
      const pl2Btn = screen.getByTitle('Reproducir "Best of 80s"');
      expect(pl2Btn).toBeInTheDocument();
    });

    it("switches playback to selected playlist instead of pausing when clicking another playlist sharing the track", () => {
      // Iniciar reproduciendo playlist 1
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack], 1);

      const onNavigate = vi.fn();
      render(React.createElement(HomeView, { onNavigate }));

      // Clic en Quick Play de playlist 2
      const pl2Btn = screen.getByTitle('Reproducir "Best of 80s"');
      fireEvent.click(pl2Btn);

      // Debe conmutar activePlaylistId a 2 en lugar de pausar
      expect(usePlayerStore.getState().activePlaylistId).toBe(2);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
    });

    it("renders disabled Quick Play button with feedback for empty playlists without screen jump", () => {
      const onNavigate = vi.fn();
      render(React.createElement(HomeView, { onNavigate }));

      const emptyBtn = screen.getByTitle("Esta playlist no tiene canciones");
      expect(emptyBtn).toBeInTheDocument();

      fireEvent.click(emptyBtn);
      // No debe redirigir a playlists
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("aligns playlist title and duration horizontally on first line and song count on second line", () => {
      const onNavigate = vi.fn();
      render(React.createElement(HomeView, { onNavigate }));

      // Buscar tarjeta de playlist 1 ("Rock Classics")
      const titleEl = screen.getByTitle("Rock Classics");
      expect(titleEl).toBeInTheDocument();

      // El contenedor padre debe tener flex items-baseline justify-between y contener la duración
      const headerRow = titleEl.closest("div");
      expect(headerRow).not.toBeNull();
      expect(headerRow?.className).toContain("flex");
      expect(headerRow?.className).toContain("items-baseline");
      expect(headerRow?.className).toContain("justify-between");

      // La duración acumulada debe estar en la misma fila horizontal
      const durationSpan = headerRow?.querySelector("span");
      expect(durationSpan).not.toBeNull();
      expect(durationSpan?.textContent).toBe(formatHumanDuration(sampleTrack.duration));

      // El conteo de canciones debe ubicarse como elemento hermano inmediatamente después
      const countEl = headerRow?.nextElementSibling;
      expect(countEl).not.toBeNull();
      expect(countEl?.tagName.toLowerCase()).toBe("p");
      expect(countEl?.textContent).toContain("1 canción");
    });
  });

  describe("Instant Seek & Volume Thumbs (PersistentPlayer & NowPlayingView)", () => {
    beforeEach(() => {
      usePlayerStore.getState().clearQueue();
    });

    it("renders PersistentPlayer seek bar and volume indicator thumbs with transition-none for instant positioning", () => {
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
      const { container } = render(React.createElement(PersistentPlayer));

      const thumbs = Array.from(container.querySelectorAll("div")).filter(
        (el) =>
          el.classList.contains("-translate-x-1/2") &&
          el.classList.contains("rounded-full") &&
          el.classList.contains("shadow-md") &&
          el.classList.contains("pointer-events-none"),
      );
      expect(thumbs.length).toBeGreaterThanOrEqual(2);
      for (const thumb of thumbs) {
        expect(thumb.className).toContain("transition-none");
        expect(thumb.className).not.toContain("transition-all");
      }
    });

    it("renders NowPlayingView seek bar and volume thumbs with transition-none", () => {
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
      usePlayerStore.setState({ isNowPlayingExpanded: true });
      const { container } = render(React.createElement(NowPlayingView));

      // Buscar thumbs de seek y volume en la barra inferior de controles
      const thumbs = Array.from(container.querySelectorAll("div")).filter(
        (el) =>
          el.classList.contains("-translate-x-1/2") &&
          el.classList.contains("rounded-full") &&
          el.classList.contains("shadow-md") &&
          el.classList.contains("pointer-events-none"),
      );
      expect(thumbs.length).toBeGreaterThanOrEqual(2);
      for (const thumb of thumbs) {
        expect(thumb.className).toContain("transition-none");
        expect(thumb.className).not.toContain("transition-all");
      }
    });
  });

  describe("Responsive PlayerBar (PersistentPlayer)", () => {
    beforeEach(() => {
      usePlayerStore.getState().clearQueue();
    });

    it("renders both stacked progress bar for compact mode and centered progress bar for desktop", () => {
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
      render(React.createElement(PersistentPlayer));

      const compactProgress = screen.getByLabelText("Progreso compacto de la canción");
      const desktopProgress = screen.getByLabelText("Progreso de la canción");

      expect(compactProgress).toBeInTheDocument();
      expect(desktopProgress).toBeInTheDocument();

      // Verificar que el contenedor compacto usa lg:hidden y el desktop usa hidden lg:flex
      const compactContainer = compactProgress.closest(".lg\\:hidden");
      expect(compactContainer).not.toBeNull();

      const desktopContainer = desktopProgress.closest(".hidden.lg\\:flex");
      expect(desktopContainer).not.toBeNull();
    });

    it("provides responsive volume controls with vertical floating popover on hover/click and desktop inline slider", () => {
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
      render(React.createElement(PersistentPlayer));

      // Botón trigger de volumen flotante en vista compacta
      const compactVolumeBtn = screen.getByLabelText("Ajustar volumen");
      expect(compactVolumeBtn).toBeInTheDocument();

      // Inicialmente el popover de volumen vertical flotante no está abierto
      expect(
        screen.queryByRole("dialog", { name: "Ajuste de volumen vertical flotante" }),
      ).toBeNull();

      // Al acercar el ratón (hover / mouseEnter) al contenedor de volumen compacto, se muestra el popover vertical flotante
      const volumeContainer = compactVolumeBtn.closest(".relative");
      expect(volumeContainer).not.toBeNull();
      fireEvent.mouseEnter(volumeContainer!);

      const volumePopover = screen.getByRole("dialog", {
        name: "Ajuste de volumen vertical flotante",
      });
      expect(volumePopover).toBeInTheDocument();

      // Dentro del popover se encuentra el slider de volumen vertical
      const verticalSlider = screen.getByLabelText("Control de volumen vertical");
      expect(verticalSlider).toBeInTheDocument();

      // Cerrar con Escape
      fireEvent.keyDown(window, { key: "Escape" });
      expect(
        screen.queryByRole("dialog", { name: "Ajuste de volumen vertical flotante" }),
      ).toBeNull();
    });

    it("prioritizes essential playback controls and applies responsive visibility to secondary controls", () => {
      const sampleTrack2: Track = {
        ...sampleTrack,
        id: 2,
        youtube_id: "dQw4w9WgXc2",
        title: "Track 2",
      };
      const sampleTrack3: Track = {
        ...sampleTrack,
        id: 3,
        youtube_id: "dQw4w9WgXc3",
        title: "Track 3",
      };
      usePlayerStore
        .getState()
        .playTrack(sampleTrack2, [sampleTrack, sampleTrack2, sampleTrack3]);
      usePlayerStore.setState({ isLoadingTrack: false, isPlaying: true });
      render(React.createElement(PersistentPlayer));

      // Controles esenciales: Play/Pause, Anterior, Siguiente siempre presentes en ambos layouts
      const playPauseBtns = screen.getAllByLabelText("Pausar");
      const prevBtns = screen.getAllByTitle("Anterior");
      const nextBtns = screen.getAllByTitle("Siguiente");

      expect(playPauseBtns.length).toBeGreaterThanOrEqual(2);
      expect(prevBtns.length).toBeGreaterThanOrEqual(2);
      expect(nextBtns.length).toBeGreaterThanOrEqual(2);

      // Controles secundarios (Repeat y Shuffle) en layout compacto tienen clases responsivas para pantallas pequeñas
      const repeatBtns = screen.getAllByTitle(/^Modo repetición:/);
      const shuffleBtns = screen.getAllByTitle(/^Modo aleatorio:/);

      expect(repeatBtns[0].className).toContain("hidden");
      expect(repeatBtns[0].className).toContain("sm:inline-flex");
      expect(shuffleBtns[0].className).toContain("hidden");
      expect(shuffleBtns[0].className).toContain("sm:inline-flex");
    });

    it("renders queue button in player bar and automatically closes queue popover on outside clicks or Escape", () => {
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
      const { container } = render(React.createElement(PersistentPlayer));

      // Botón de cola visible en vista de reproductor (en layout compacto y de escritorio)
      const queueBtns = screen.getAllByTitle("Mostrar cola de reproducción");
      expect(queueBtns.length).toBeGreaterThanOrEqual(2);

      // Abrir cola de reproducción mediante el primer botón
      fireEvent.click(queueBtns[0]);
      expect(screen.getByText(/Cola de Reproducción/i)).toBeInTheDocument();

      // Clic externo fuera del contenedor de la cola
      fireEvent.mouseDown(container);
      expect(screen.queryByText(/Cola de Reproducción/i)).toBeNull();

      // Volver a abrir y verificar cierre con Escape
      fireEvent.click(queueBtns[0]);
      expect(screen.getByText(/Cola de Reproducción/i)).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByText(/Cola de Reproducción/i)).toBeNull();
    });

    it("disables SkipForward and SkipBack conditionally based on queue position and repeatMode", () => {
      // 1. Cola de 1 sola pista, repeatMode off, currentTime <= 3s -> ambos deshabilitados con tooltips dinámicos explicativos
      usePlayerStore.getState().playTrack(sampleTrack, [sampleTrack]);
      usePlayerStore.setState({ repeatMode: "off", currentTime: 0 });
      const { rerender } = render(React.createElement(PersistentPlayer));

      const nextBtns = screen.getAllByTitle("Fin de la cola");
      const prevBtns = screen.getAllByTitle("Inicio de la cola");

      for (const btn of nextBtns) {
        expect(btn).toBeDisabled();
      }
      for (const btn of prevBtns) {
        expect(btn).toBeDisabled();
      }

      // 2. Misma pista pero currentTime > 3s -> SkipBack habilitado para reiniciar pista, SkipForward deshabilitado
      usePlayerStore.setState({ currentTime: 10 });
      rerender(React.createElement(PersistentPlayer));

      for (const btn of screen.getAllByTitle("Fin de la cola")) {
        expect(btn).toBeDisabled();
      }
      for (const btn of screen.getAllByTitle("Reiniciar canción")) {
        expect(btn).not.toBeDisabled();
      }

      // 3. Activar repeatMode "all" -> ambos habilitados con tooltips estándar
      usePlayerStore.setState({ repeatMode: "all", currentTime: 0 });
      rerender(React.createElement(PersistentPlayer));

      for (const btn of screen.getAllByTitle("Siguiente")) {
        expect(btn).not.toBeDisabled();
      }
      for (const btn of screen.getAllByTitle("Anterior")) {
        expect(btn).not.toBeDisabled();
      }
    });
  });

  describe("Track Origin Discrimination & Local Tracks Likes Handling (TrackRow & useLibraryStore)", () => {
    it("renders local tracks with 'Local' badge and local favorite tooltip without YouTube watch link", () => {
      const localTrack: Track = {
        ...sampleTrack,
        id: 99,
        youtube_id: "local_rec_01",
        title: "Audio Grabación Local",
        artist: "Artista Local",
        origin: "local",
        liked: true,
        synced: false,
      };

      const { container } = render(
        React.createElement(TrackRow, {
          track: localTrack,
          isCurrent: false,
          isPlaying: false,
          playlists: [],
          onPlay: vi.fn(),
          onEnqueue: vi.fn(),
          onToggleLike: vi.fn(),
          onDelete: vi.fn(),
          onTogglePlaylist: vi.fn(),
        }),
      );

      expect(screen.getByText("Local")).toBeInTheDocument();
      expect(screen.getByTitle("Me gusta (Archivo local)")).toBeInTheDocument();
      const heartIcon = container.querySelector("svg.lucide-heart");
      expect(heartIcon?.getAttribute("class")).toContain("fill-muted-foreground");
      expect(heartIcon?.getAttribute("class")).toContain("text-muted-foreground");
    });

    it("renders synced tracks with red filled heart when liked and red border when not liked", () => {
      const syncedTrack: Track = {
        ...sampleTrack,
        id: 101,
        youtube_id: "yt_synced_01",
        origin: "youtube",
        liked: false,
        synced: true,
      };

      const { container, rerender } = render(
        React.createElement(TrackRow, {
          track: syncedTrack,
          isCurrent: false,
          isPlaying: false,
          playlists: [],
          onPlay: vi.fn(),
          onEnqueue: vi.fn(),
          onToggleLike: vi.fn(),
          onDelete: vi.fn(),
          onTogglePlaylist: vi.fn(),
        }),
      );

      // Borde rojo si está sincronizado sin like
      let heartIcon = container.querySelector("svg.lucide-heart");
      expect(heartIcon?.getAttribute("class")).toContain("text-rose-500");
      expect(heartIcon?.getAttribute("class")).not.toContain(
        "fill-rose-500 text-rose-500",
      );

      // Rellenado rojo si está sincronizado con like
      rerender(
        React.createElement(TrackRow, {
          track: { ...syncedTrack, liked: true },
          isCurrent: false,
          isPlaying: false,
          playlists: [],
          onPlay: vi.fn(),
          onEnqueue: vi.fn(),
          onToggleLike: vi.fn(),
          onDelete: vi.fn(),
          onTogglePlaylist: vi.fn(),
        }),
      );

      heartIcon = container.querySelector("svg.lucide-heart");
      expect(heartIcon?.getAttribute("class")).toContain("fill-rose-500");
      expect(heartIcon?.getAttribute("class")).toContain("text-rose-500");
    });

    it("manages local track likes optimistically in useLibraryStore without YouTube error toast", async () => {
      const localTrack: Track = {
        ...sampleTrack,
        id: 100,
        youtube_id: "my_local_track_02",
        title: "Mi pista local",
        artist: "Desconocido",
        origin: "local",
        liked: false,
        synced: false,
      };

      useLibraryStore.setState({
        tracks: [localTrack],
        syncStatusByTrack: {},
      });

      // Simular respuesta de tauriApi.toggleTrackLike para pista local
      vi.spyOn(tauriApi, "toggleTrackLike").mockResolvedValueOnce({
        ...localTrack,
        liked: true,
        synced: false,
      });

      await useLibraryStore.getState().toggleLike("my_local_track_02", true);

      const updated = useLibraryStore
        .getState()
        .tracks.find((t) => t.youtube_id === "my_local_track_02");
      expect(updated?.liked).toBe(true);
      expect(
        useLibraryStore.getState().syncStatusByTrack["my_local_track_02"]?.status,
      ).toBe("local");
    });
  });

  describe("Instant Playback on Track Double Click (TrackRow & PlaylistsView)", () => {
    it("triggers onPlay when double clicking on the row container or title", () => {
      const onPlay = vi.fn();
      const { container } = render(
        React.createElement(TrackRow, {
          track: sampleTrack,
          isCurrent: false,
          isPlaying: false,
          playlists: [],
          onPlay,
          onEnqueue: vi.fn(),
          onToggleLike: vi.fn(),
          onDelete: vi.fn(),
          onTogglePlaylist: vi.fn(),
        }),
      );

      const titleElement = screen.getByText(sampleTrack.title);
      fireEvent.doubleClick(titleElement);
      expect(onPlay).toHaveBeenCalledTimes(1);
      expect(onPlay).toHaveBeenCalledWith(sampleTrack);

      const rowContainer = container.firstElementChild as HTMLElement;
      fireEvent.doubleClick(rowContainer);
      expect(onPlay).toHaveBeenCalledTimes(2);
    });

    it("does not trigger onPlay when double clicking interactive action controls (like, enqueue, playlist menu, action menu)", () => {
      const onPlay = vi.fn();
      const onToggleLike = vi.fn();
      const onEnqueue = vi.fn();

      render(
        React.createElement(TrackRow, {
          track: sampleTrack,
          isCurrent: false,
          isPlaying: false,
          playlists: [],
          onPlay,
          onEnqueue,
          onToggleLike,
          onDelete: vi.fn(),
          onTogglePlaylist: vi.fn(),
        }),
      );

      const likeBtn = screen.getByTitle("Me gusta (Sincronizado con YouTube)");
      fireEvent.doubleClick(likeBtn);
      expect(onPlay).not.toHaveBeenCalled();

      const enqueueBtn = screen.getByTitle("Añadir a la cola");
      fireEvent.doubleClick(enqueueBtn);
      expect(onPlay).not.toHaveBeenCalled();

      const bookmarkBtn = screen.getByTitle("Añadir a playlist");
      fireEvent.doubleClick(bookmarkBtn);
      expect(onPlay).not.toHaveBeenCalled();

      const actionMenuBtn = screen.getByTitle("Opciones de la canción");
      fireEvent.doubleClick(actionMenuBtn);
      expect(onPlay).not.toHaveBeenCalled();
    });

    it("does not trigger onPlay on double click when track is missing", () => {
      const onPlay = vi.fn();
      const missingTrack: Track = {
        ...sampleTrack,
        is_missing: true,
      };

      render(
        React.createElement(TrackRow, {
          track: missingTrack,
          isCurrent: false,
          isPlaying: false,
          playlists: [],
          onPlay,
          onEnqueue: vi.fn(),
          onToggleLike: vi.fn(),
          onDelete: vi.fn(),
          onTogglePlaylist: vi.fn(),
        }),
      );

      const titleElement = screen.getByText(missingTrack.title);
      fireEvent.doubleClick(titleElement);
      expect(onPlay).not.toHaveBeenCalled();
    });
  });

  describe("useMediaSession native OS integration", () => {
    function MediaSessionTestComponent({
      audioRef,
    }: {
      audioRef: React.RefObject<HTMLAudioElement | null>;
    }) {
      useMediaSession(audioRef);
      return null;
    }

    beforeEach(() => {
      usePlayerStore.getState().clearQueue();
      usePlayerStore.setState({
        currentTrack: null,
        isPlaying: false,
        isLoadingTrack: false,
        currentTime: 0,
        duration: 100,
        seekTarget: null,
      });
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    });

    it("publishes track metadata and fallback artwork to navigator.mediaSession", () => {
      const audioRef = { current: document.createElement("audio") };
      const { unmount } = render(
        React.createElement(MediaSessionTestComponent, { audioRef }),
      );

      // Sin pista activa: metadata es null y playbackState es none
      expect(navigator.mediaSession.metadata).toBeNull();
      expect(navigator.mediaSession.playbackState).toBe("none");

      // Establecemos pista sin thumbnail_path (debe usar fallback SVG)
      act(() => {
        usePlayerStore.setState({
          currentTrack: { ...sampleTrack, thumbnail_path: null },
          isPlaying: true,
          duration: 213,
          currentTime: 10,
        });
      });

      expect(navigator.mediaSession.metadata).not.toBeNull();
      expect(navigator.mediaSession.metadata?.title).toBe(sampleTrack.title);
      expect(navigator.mediaSession.metadata?.artist).toBe(sampleTrack.artist);
      expect(navigator.mediaSession.metadata?.artwork[0].src).toContain(
        "data:image/svg+xml",
      );
      expect(navigator.mediaSession.playbackState).toBe("playing");

      // Establecemos pista con thumbnail_path (debe usar resoluciones del cover)
      act(() => {
        usePlayerStore.setState({
          currentTrack: {
            ...sampleTrack,
            thumbnail_path: "/workspace/thumbnails/cover.jpg",
          },
        });
      });
      expect(navigator.mediaSession.metadata?.artwork[0].src).toContain("cover.jpg");

      unmount();
    });

    it("executes registered action handlers and respects conditional navigation blocking", () => {
      const audioEl = document.createElement("audio");
      const audioRef = { current: audioEl };
      render(React.createElement(MediaSessionTestComponent, { audioRef }));

      const handlers = (
        navigator.mediaSession as unknown as {
          _handlers: Map<string, (details?: unknown) => void>;
        }
      )._handlers;
      expect(handlers.has("play")).toBe(true);
      expect(handlers.has("pause")).toBe(true);
      expect(handlers.has("previoustrack")).toBe(true);
      expect(handlers.has("nexttrack")).toBe(true);
      expect(handlers.has("seekto")).toBe(true);

      // Play / Pause
      act(() => {
        handlers.get("play")!();
      });
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      act(() => {
        handlers.get("pause")!();
      });
      expect(usePlayerStore.getState().isPlaying).toBe(false);

      // SeekTo
      act(() => {
        handlers.get("seekto")!({ seekTime: 45 });
      });
      expect(usePlayerStore.getState().seekTarget).toBe(45);

      // Previous track con currentTime > 3: reinicia a 0
      audioEl.currentTime = 5;
      act(() => {
        handlers.get("previoustrack")!();
      });
      expect(audioEl.currentTime).toBe(0);
      expect(usePlayerStore.getState().currentTime).toBe(0);
    });
  });

  describe("playPlaylist complete queue synchronization and integrity", () => {
    const track1: Track = {
      ...sampleTrack,
      id: 101,
      youtube_id: "yt_101",
      title: "Tema 1",
    };
    const track2: Track = {
      ...sampleTrack,
      id: 102,
      youtube_id: "yt_102",
      title: "Tema 2",
    };
    const track3: Track = {
      ...sampleTrack,
      id: 103,
      youtube_id: "yt_103",
      title: "Tema 3",
    };

    beforeEach(() => {
      usePlayerStore.getState().clearQueue();
      useToastStore.getState().clear();
      usePlayerStore.setState({
        currentTrack: null,
        isPlaying: false,
        activePlaylistId: null,
        isShuffle: false,
      });
    });

    it("displays info toast and does nothing when playlist has no playable tracks", () => {
      usePlayerStore.getState().playPlaylist([], 99);
      expect(usePlayerStore.getState().queue).toHaveLength(0);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].title).toBe("Playlist sin canciones");
    });

    it("toggles play/pause when the queue is already complete and matches the playlist", () => {
      // Configuramos cola completa de 3 temas ya activa
      usePlayerStore.setState({
        queue: [track1, track2, track3],
        activePlaylistId: 77,
        isPlaying: false,
        currentTrack: track1,
      });

      usePlayerStore.getState().playPlaylist([track1, track2, track3], 77);
      // Solo debe alternar reproducción
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().queue).toHaveLength(3);
      // No debe emitir toast de cola sincronizada
      expect(useToastStore.getState().toasts).toHaveLength(0);

      usePlayerStore.getState().playPlaylist([track1, track2, track3], 77);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
    });

    it("populates missing tracks preserving currentTrack and emits feedback toast when queue is truncated", () => {
      // Sesión restaurada con solo 1 tema en cola de una playlist de 3
      usePlayerStore.setState({
        queue: [track2],
        activePlaylistId: 77,
        isPlaying: false,
        currentTrack: track2,
      });

      usePlayerStore.getState().playPlaylist([track1, track2, track3], 77);

      // Debe preservar track2 como activo e iniciar reproducción
      expect(usePlayerStore.getState().currentTrack?.youtube_id).toBe("yt_102");
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      // La cola debe estar completa con los 3 temas
      expect(usePlayerStore.getState().queue).toHaveLength(3);
      expect(usePlayerStore.getState().currentIndex).toBe(1); // track2 está en índice 1

      // Debe emitir toast de sincronización
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.title === "Cola sincronizada")).toBe(true);
    });

    it("preserves shuffle mode placing currentTrack at index 0 when completing truncated queue", () => {
      usePlayerStore.setState({
        queue: [track2],
        activePlaylistId: 77,
        isPlaying: false,
        currentTrack: track2,
        isShuffle: true,
      });

      usePlayerStore.getState().playPlaylist([track1, track2, track3], 77);

      expect(usePlayerStore.getState().queue).toHaveLength(3);
      expect(usePlayerStore.getState().queue[0].youtube_id).toBe("yt_102");
      expect(usePlayerStore.getState().currentIndex).toBe(0);
      expect(usePlayerStore.getState().originalQueue).toHaveLength(3);
    });

    it("switches cleanly starting from first track when currentTrack does not belong to playlist", () => {
      const otherTrack: Track = {
        ...sampleTrack,
        id: 999,
        youtube_id: "other_yt",
        title: "Otro",
      };
      usePlayerStore.setState({
        queue: [otherTrack],
        activePlaylistId: 55,
        isPlaying: true,
        currentTrack: otherTrack,
      });

      usePlayerStore.getState().playPlaylist([track1, track2, track3], 77);

      // Debe arrancar desde track1 de la nueva playlist
      expect(usePlayerStore.getState().currentTrack?.youtube_id).toBe("yt_101");
      expect(usePlayerStore.getState().activePlaylistId).toBe(77);
      expect(usePlayerStore.getState().queue).toHaveLength(3);
    });

    it("performs full Fisher-Yates random draw and preserves originalQueue when shuffle is active", () => {
      usePlayerStore.setState({
        currentTrack: null,
        queue: [],
        activePlaylistId: null,
        isPlaying: false,
        isShuffle: true,
      });

      // Simular random determinista para invertir orden: j siempre 0
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

      usePlayerStore.getState().playPlaylist([track1, track2, track3], 88);

      randomSpy.mockRestore();

      const state = usePlayerStore.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.activePlaylistId).toBe(88);
      expect(state.currentIndex).toBe(0);
      expect(state.queue).toHaveLength(3);
      // currentTrack debe coincidir exactamente con queue[0]
      expect(state.currentTrack?.youtube_id).toBe(state.queue[0].youtube_id);
      // originalQueue debe retener el orden canónico intacto
      expect(state.originalQueue.map((t) => t.youtube_id)).toEqual([
        "yt_101",
        "yt_102",
        "yt_103",
      ]);

      // Al desactivar shuffle, debe restaurarse la cola canónica manteniendo la pista activa
      state.toggleShuffle();
      const unshifted = usePlayerStore.getState();
      expect(unshifted.isShuffle).toBe(false);
      expect(unshifted.queue.map((t) => t.youtube_id)).toEqual([
        "yt_101",
        "yt_102",
        "yt_103",
      ]);
      expect(unshifted.queue[unshifted.currentIndex].youtube_id).toBe(
        state.currentTrack?.youtube_id,
      );
    });

    it("supports null playlistId from Library and emits contextual toast messages", () => {
      // Lista vacía sin playlistId especificado
      usePlayerStore.getState().playPlaylist([], null);
      expect(useToastStore.getState().toasts[0].title).toBe("Sin canciones");
      useToastStore.getState().clear();

      // Reproducción exitosa con playlistId = null
      usePlayerStore.getState().playPlaylist([track1, track2], null);
      const state = usePlayerStore.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.activePlaylistId).toBeNull();
      expect(state.queue).toHaveLength(2);
    });
  });

  describe("usePlayerControlTooltips dynamic tooltips and control states", () => {
    it("returns empty queue feedback when there is no currentTrack", () => {
      usePlayerStore.setState({
        currentTrack: null,
        queue: [],
        currentIndex: -1,
        isPlaying: false,
        isLoadingTrack: false,
      });

      const { result } = renderHook(() => usePlayerControlTooltips());
      expect(result.current.isNextDisabled).toBe(true);
      expect(result.current.isPreviousDisabled).toBe(true);
      expect(result.current.nextTooltip).toBe("Cola vacía");
      expect(result.current.previousTooltip).toBe("Cola vacía");
      expect(result.current.playPauseTooltip).toBe("Sin canciones en cola");
    });

    it("displays loading feedback on playPauseTooltip when loading track", () => {
      usePlayerStore.setState({
        currentTrack: sampleTrack,
        isLoadingTrack: true,
      });

      const { result } = renderHook(() => usePlayerControlTooltips());
      expect(result.current.playPauseTooltip).toBe("Cargando pista...");
    });

    it("displays Pausar when playing and Reanudar when paused with currentTime > 0", () => {
      usePlayerStore.setState({
        currentTrack: sampleTrack,
        isLoadingTrack: false,
        isPlaying: true,
        currentTime: 42,
      });

      const { result: playingRes } = renderHook(() => usePlayerControlTooltips());
      expect(playingRes.current.playPauseTooltip).toBe("Pausar");

      act(() => {
        usePlayerStore.setState({ isPlaying: false });
      });

      const { result: pausedRes } = renderHook(() => usePlayerControlTooltips());
      expect(pausedRes.current.playPauseTooltip).toBe("Reanudar");
    });

    it("computes accurate tooltips for repeat and shuffle modes", () => {
      usePlayerStore.setState({ repeatMode: "off", isShuffle: false });
      const { result: rOff } = renderHook(() => usePlayerControlTooltips());
      expect(rOff.current.repeatTooltip).toBe("Modo repetición: Desactivado");
      expect(rOff.current.shuffleTooltip).toBe("Modo aleatorio: Desactivado");

      act(() => {
        usePlayerStore.setState({ repeatMode: "one", isShuffle: true });
      });
      const { result: rOne } = renderHook(() => usePlayerControlTooltips());
      expect(rOne.current.repeatTooltip).toBe("Modo repetición: Una canción");
      expect(rOne.current.shuffleTooltip).toBe("Modo aleatorio: Activado");

      act(() => {
        usePlayerStore.setState({ repeatMode: "all" });
      });
      const { result: rAll } = renderHook(() => usePlayerControlTooltips());
      expect(rAll.current.repeatTooltip).toBe("Modo repetición: Todas");
    });
  });
});
