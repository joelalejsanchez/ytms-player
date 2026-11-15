import { beforeEach, describe, expect, it } from "vitest";
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
      { youtube_id: "edge_case", title: "7 Min Exact", artist: "Artist", duration: 420 },
      { youtube_id: "short_2", title: "Single 2", artist: "Artist", duration: 419 },
    ];

    const defaultSelected = new Set(
      previewItems
        .filter((i) => (i.duration || 0) < 420)
        .map((i) => i.youtube_id),
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

    store.toggleMode();
    expect(useThemeStore.getState().mode).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("ember")).toBe(true);
  });
});
