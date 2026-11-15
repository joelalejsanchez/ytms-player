import { create } from "zustand";
import type { Track } from "@/types/models";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  duration: number;
  currentTime: number;
  seekTarget: number | null;
  queue: Track[];
  currentIndex: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;

  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlayPause: () => void;
  setPlaying: (playing: boolean) => void;
  seekTo: (seconds: number) => void;
  clearSeekTarget: () => void;
  setCurrentTime: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  playNext: () => void;
  playPrevious: () => void;
  enqueueTrack: (track: Track) => void;
  removeFromQueue: (youtubeId: string) => void;
  clearQueue: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
}

const STORAGE_KEY = "ytms_player_preferences";

interface PersistedPlayerPreferences {
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  currentTrack: Track | null;
  currentTime: number;
}

function loadPersistedPreferences(): Partial<PersistedPlayerPreferences> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePersistedPreferences(data: Partial<PersistedPlayerPreferences>) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const current = loadPersistedPreferences();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }));
  } catch {
    // Ignorar excepciones de cuota de storage
  }
}

const savedPrefs = loadPersistedPreferences();

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: savedPrefs.currentTrack ?? null,
  isPlaying: false,
  volume: typeof savedPrefs.volume === "number" ? savedPrefs.volume : 0.85,
  isMuted: Boolean(savedPrefs.isMuted),
  duration: savedPrefs.currentTrack?.duration || 0,
  currentTime: savedPrefs.currentTime || 0,
  seekTarget: null,
  queue: savedPrefs.currentTrack ? [savedPrefs.currentTrack] : [],
  currentIndex: savedPrefs.currentTrack ? 0 : -1,
  repeatMode: savedPrefs.repeatMode ?? "off",
  isShuffle: Boolean(savedPrefs.isShuffle),

  playTrack: (track, newQueue) => {
    if (track.is_missing) {
      return;
    }
    const playableQueue = (newQueue ?? get().queue).filter((item) => !item.is_missing);
    const existingIndex = playableQueue.findIndex(
      (item) => item.youtube_id === track.youtube_id,
    );

    const updatedQueue = existingIndex >= 0 ? playableQueue : [...playableQueue, track];
    const nextIndex = existingIndex >= 0 ? existingIndex : updatedQueue.length - 1;

    savePersistedPreferences({ currentTrack: track, currentTime: 0 });

    set({
      currentTrack: track,
      isPlaying: true,
      currentTime: 0,
      duration: track.duration || 0,
      queue: updatedQueue,
      currentIndex: nextIndex,
    });
  },

  togglePlayPause: () => {
    const { currentTrack, isPlaying } = get();
    if (!currentTrack || currentTrack.is_missing) {
      return;
    }
    set({ isPlaying: !isPlaying });
  },

  setPlaying: (playing) => set({ isPlaying: playing }),

  seekTo: (seconds) => {
    const clamped = Math.max(0, Math.min(seconds, get().duration || seconds));
    savePersistedPreferences({ currentTime: clamped });
    set({ currentTime: clamped, seekTarget: clamped });
  },

  clearSeekTarget: () => set({ seekTarget: null }),

  setCurrentTime: (seconds) => set({ currentTime: seconds }),

  setDuration: (seconds) => set({ duration: seconds }),

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    savePersistedPreferences({ volume: clamped, isMuted: clamped === 0 });
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () =>
    set((state) => {
      const nextMuted = !state.isMuted;
      savePersistedPreferences({ isMuted: nextMuted });
      return { isMuted: nextMuted };
    }),

  playNext: () => {
    const { queue, currentIndex, repeatMode, currentTrack } = get();
    if (queue.length === 0) {
      set({ isPlaying: false });
      return;
    }

    if (repeatMode === "one" && currentTrack) {
      set({ currentTime: 0, seekTarget: 0, isPlaying: true });
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      set({
        currentTrack: nextTrack,
        currentIndex: nextIndex,
        currentTime: 0,
        duration: nextTrack.duration || 0,
        isPlaying: true,
      });
      return;
    }

    if (repeatMode === "all") {
      const firstTrack = queue[0];
      set({
        currentTrack: firstTrack,
        currentIndex: 0,
        currentTime: 0,
        duration: firstTrack.duration || 0,
        isPlaying: true,
      });
      return;
    }

    set({ isPlaying: false, currentTime: 0 });
  },

  playPrevious: () => {
    const { queue, currentIndex, currentTime } = get();
    if (queue.length === 0) {
      return;
    }

    if (currentTime > 3) {
      set({ currentTime: 0, seekTarget: 0, isPlaying: true });
      return;
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      set({
        currentTrack: prevTrack,
        currentIndex: prevIndex,
        currentTime: 0,
        duration: prevTrack.duration || 0,
        isPlaying: true,
      });
    }
  },

  enqueueTrack: (track) => {
    if (track.is_missing) {
      return;
    }
    set((state) => {
      if (state.queue.some((item) => item.youtube_id === track.youtube_id)) {
        return state;
      }
      const nextQueue = [...state.queue, track];
      if (!state.currentTrack) {
        return {
          queue: nextQueue,
          currentTrack: track,
          currentIndex: 0,
          duration: track.duration || 0,
        };
      }
      return { queue: nextQueue };
    });
  },

  removeFromQueue: (youtubeId) => {
    set((state) => {
      const nextQueue = state.queue.filter((item) => item.youtube_id !== youtubeId);
      const nextIndex = state.currentTrack
        ? nextQueue.findIndex(
            (item) => item.youtube_id === state.currentTrack?.youtube_id,
          )
        : -1;
      return {
        queue: nextQueue,
        currentIndex: nextIndex,
      };
    });
  },

  clearQueue: () =>
    set({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }),

  cycleRepeatMode: () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const next = modes[(modes.indexOf(get().repeatMode) + 1) % modes.length] ?? "off";
    savePersistedPreferences({ repeatMode: next });
    set({ repeatMode: next });
  },

  toggleShuffle: () => {
    const { isShuffle, queue, currentTrack } = get();
    const nextShuffle = !isShuffle;
    savePersistedPreferences({ isShuffle: nextShuffle });
    if (nextShuffle && queue.length > 1) {
      const rest = queue.filter((t) => t.youtube_id !== currentTrack?.youtube_id);
      // Algoritmo Fisher-Yates
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const shuffledQueue = currentTrack ? [currentTrack, ...rest] : rest;
      set({
        isShuffle: true,
        queue: shuffledQueue,
        currentIndex: currentTrack ? 0 : -1,
      });
    } else {
      set({ isShuffle: nextShuffle });
    }
  },
}));
