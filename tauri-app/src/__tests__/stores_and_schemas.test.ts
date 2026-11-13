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
    });
    expect(dl.success).toBe(true);

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

  it("formats duration and byte sizes accurately", () => {
    expect(formatDuration(213)).toBe("03:33");
    expect(formatDuration(3665)).toBe("1:01:05");
    expect(formatBytes(1024 * 1024 * 3.5)).toBe("3.5 MB");
  });
});
