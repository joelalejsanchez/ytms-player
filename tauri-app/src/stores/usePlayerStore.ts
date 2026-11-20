import { create } from "zustand";
import type { Track } from "@/types/models";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  currentTrack: Track | null;
  activePlaylistId: number | null;
  isPlaying: boolean;
  isLoadingTrack: boolean;
  volume: number;
  isMuted: boolean;
  duration: number;
  currentTime: number;
  seekTarget: number | null;
  queue: Track[];
  originalQueue: Track[];
  currentIndex: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  corruptedTrackIds: string[];
  isNowPlayingExpanded: boolean;

  setActivePlaylistId: (playlistId: number | null) => void;
  playTrack: (track: Track, newQueue?: Track[], playlistId?: number | null) => void;
  setQueuePreservingCurrent: (newQueue: Track[], playlistId?: number | null) => void;
  markTrackCorrupted: (youtubeId: string) => void;
  clearCorruptedTrack: (youtubeId: string) => void;
  setNowPlayingExpanded: (expanded: boolean) => void;
  toggleNowPlayingExpanded: () => void;
  togglePlayPause: () => void;
  setPlaying: (playing: boolean) => void;
  setIsLoadingTrack: (loading: boolean) => void;
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
  updateTrackMetadata: (track: Partial<Track> & { youtube_id: string }) => void;
}

const STORAGE_KEY = "ytms_player_preferences";

interface PersistedPlayerPreferences {
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  currentTrack: Track | null;
  currentTime: number;
  activePlaylistId: number | null;
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

function shuffleTracksWithFirst(tracks: Track[], firstTrack?: Track | null): Track[] {
  const rest = firstTrack
    ? tracks.filter((t) => t.youtube_id !== firstTrack.youtube_id)
    : [...tracks];
  // Algoritmo Fisher-Yates
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return firstTrack ? [firstTrack, ...rest] : rest;
}

const savedPrefs = loadPersistedPreferences();

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: savedPrefs.currentTrack ?? null,
  activePlaylistId: savedPrefs.activePlaylistId ?? null,
  isPlaying: false,
  isLoadingTrack: false,
  volume: typeof savedPrefs.volume === "number" ? savedPrefs.volume : 0.85,
  isMuted: Boolean(savedPrefs.isMuted),
  duration: savedPrefs.currentTrack?.duration || 0,
  currentTime: savedPrefs.currentTime || 0,
  seekTarget: null,
  queue: savedPrefs.currentTrack ? [savedPrefs.currentTrack] : [],
  originalQueue: savedPrefs.currentTrack ? [savedPrefs.currentTrack] : [],
  currentIndex: savedPrefs.currentTrack ? 0 : -1,
  repeatMode: savedPrefs.repeatMode ?? "off",
  isShuffle: Boolean(savedPrefs.isShuffle),
  corruptedTrackIds: [],
  isNowPlayingExpanded: false,

  setActivePlaylistId: (playlistId) => {
    savePersistedPreferences({ activePlaylistId: playlistId });
    set({ activePlaylistId: playlistId });
  },

  setNowPlayingExpanded: (expanded) => set({ isNowPlayingExpanded: expanded }),
  toggleNowPlayingExpanded: () =>
    set((state) => ({ isNowPlayingExpanded: !state.isNowPlayingExpanded })),

  markTrackCorrupted: (youtubeId) =>
    set((state) => ({
      corruptedTrackIds: state.corruptedTrackIds.includes(youtubeId)
        ? state.corruptedTrackIds
        : [...state.corruptedTrackIds, youtubeId],
    })),

  clearCorruptedTrack: (youtubeId) =>
    set((state) => ({
      corruptedTrackIds: state.corruptedTrackIds.filter((id) => id !== youtubeId),
    })),

  setQueuePreservingCurrent: (newQueue, playlistId) => {
    const { currentTrack, isShuffle } = get();
    const nextPlaylistId =
      playlistId !== undefined ? playlistId : get().activePlaylistId;
    savePersistedPreferences({ activePlaylistId: nextPlaylistId });
    const playable = newQueue.filter((t) => !t.is_missing);
    if (!currentTrack) {
      if (playable.length > 0) {
        get().playTrack(playable[0], playable, nextPlaylistId);
      }
      return;
    }

    const exists = playable.some((t) => t.youtube_id === currentTrack.youtube_id);
    if (!exists) {
      if (playable.length > 0) {
        get().playTrack(playable[0], playable, nextPlaylistId);
      }
      return;
    }

    // La pista actual pertenece al filtro: preservar reproducción y actualizar cola según estándar Spotify
    if (isShuffle) {
      const rest = playable.filter((t) => t.youtube_id !== currentTrack.youtube_id);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      set({
        queue: [currentTrack, ...rest],
        originalQueue: playable,
        currentIndex: 0,
        activePlaylistId: nextPlaylistId,
      });
    } else {
      const idx = playable.findIndex((t) => t.youtube_id === currentTrack.youtube_id);
      set({
        queue: playable,
        originalQueue: playable,
        currentIndex: idx >= 0 ? idx : 0,
        activePlaylistId: nextPlaylistId,
      });
    }
  },

  playTrack: (track, newQueue, playlistId) => {
    if (track.is_missing) {
      return;
    }
    const current = get().currentTrack;
    const isSameTrack = current?.youtube_id === track.youtube_id;

    const hasNewQueue = newQueue !== undefined;
    const playableQueue = (newQueue ?? get().queue).filter((item) => !item.is_missing);
    const resolvedOriginalQueue = hasNewQueue
      ? playableQueue
      : get().originalQueue.length > 0
        ? get().originalQueue
        : playableQueue;

    let updatedQueue: Track[];
    let nextIndex: number;

    // Si el modo aleatorio está activo y se cargó una nueva lista (o la cola estaba vacía),
    // colocar la canción seleccionada al inicio y barajar el resto con Fisher-Yates
    if (get().isShuffle && (hasNewQueue || get().queue.length === 0)) {
      updatedQueue = shuffleTracksWithFirst(playableQueue, track);
      nextIndex = 0;
    } else {
      const existingIndex = playableQueue.findIndex(
        (item) => item.youtube_id === track.youtube_id,
      );
      updatedQueue = existingIndex >= 0 ? playableQueue : [...playableQueue, track];
      nextIndex = existingIndex >= 0 ? existingIndex : updatedQueue.length - 1;
    }

    const nextPlaylistId =
      playlistId !== undefined
        ? playlistId
        : hasNewQueue
          ? null
          : get().activePlaylistId;

    savePersistedPreferences({
      currentTrack: track,
      currentTime: isSameTrack ? get().currentTime : 0,
      activePlaylistId: nextPlaylistId,
    });

    set({
      currentTrack: track,
      activePlaylistId: nextPlaylistId,
      isPlaying: true,
      isLoadingTrack: !isSameTrack,
      currentTime: isSameTrack ? get().currentTime : 0,
      duration: track.duration || 0,
      queue: updatedQueue,
      originalQueue: resolvedOriginalQueue,
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

  setIsLoadingTrack: (loading) => set({ isLoadingTrack: loading }),

  seekTo: (seconds) => {
    if (get().isLoadingTrack) {
      return;
    }
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
    const { queue, currentIndex, repeatMode, currentTrack, isShuffle } = get();
    if (queue.length === 0 || !currentTrack) {
      set({ isPlaying: false, isLoadingTrack: false });
      return;
    }

    if (repeatMode === "one") {
      set({ currentTime: 0, seekTarget: 0, isPlaying: true });
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      const isSameTrack = currentTrack.youtube_id === nextTrack.youtube_id;
      set({
        currentTrack: nextTrack,
        currentIndex: nextIndex,
        currentTime: 0,
        seekTarget: 0,
        duration: nextTrack.duration || 0,
        isPlaying: true,
        isLoadingTrack: !isSameTrack,
      });
      return;
    }

    if (repeatMode === "all") {
      if (isShuffle && queue.length > 1) {
        const reshuffled = shuffleTracksWithFirst(queue);
        const firstTrack = reshuffled[0];
        const isSameTrack = currentTrack.youtube_id === firstTrack.youtube_id;
        set({
          currentTrack: firstTrack,
          queue: reshuffled,
          currentIndex: 0,
          currentTime: 0,
          seekTarget: 0,
          duration: firstTrack.duration || 0,
          isPlaying: true,
          isLoadingTrack: !isSameTrack,
        });
        return;
      }
      const firstTrack = queue[0];
      const isSameTrack = currentTrack.youtube_id === firstTrack.youtube_id;
      set({
        currentTrack: firstTrack,
        currentIndex: 0,
        currentTime: 0,
        seekTarget: 0,
        duration: firstTrack.duration || 0,
        isPlaying: true,
        isLoadingTrack: !isSameTrack,
      });
      return;
    }

    // Si repeatMode === "off" y se alcanzó el final de la lista,
    // validar los límites y proteger el estado sin desincronizar el reproductor ni congelar la UI
    return;
  },

  playPrevious: () => {
    const { queue, currentIndex, currentTime, repeatMode, currentTrack } = get();
    if (queue.length === 0 || !currentTrack) {
      return;
    }

    if (currentTime > 3) {
      set({ currentTime: 0, seekTarget: 0, isPlaying: true });
      return;
    }

    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevTrack = queue[prevIndex];
      if (prevTrack) {
        const isSameTrack = currentTrack.youtube_id === prevTrack.youtube_id;
        set({
          currentTrack: prevTrack,
          currentIndex: prevIndex,
          currentTime: 0,
          seekTarget: 0,
          duration: prevTrack.duration || 0,
          isPlaying: true,
          isLoadingTrack: !isSameTrack,
        });
      }
      return;
    }

    // currentIndex === 0 y currentTime <= 3
    if (repeatMode === "all" && queue.length > 0) {
      const lastIndex = queue.length - 1;
      const lastTrack = queue[lastIndex];
      if (lastTrack) {
        const isSameTrack = currentTrack.youtube_id === lastTrack.youtube_id;
        set({
          currentTrack: lastTrack,
          currentIndex: lastIndex,
          currentTime: 0,
          seekTarget: 0,
          duration: lastTrack.duration || 0,
          isPlaying: true,
          isLoadingTrack: !isSameTrack,
        });
      }
      return;
    }

    if (repeatMode === "one") {
      set({ currentTime: 0, seekTarget: 0, isPlaying: true });
      return;
    }

    // repeatMode === "off" y al inicio de la lista: proteger límites
    return;
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
      const nextOrig = [...state.originalQueue, track];
      if (!state.currentTrack) {
        return {
          queue: nextQueue,
          originalQueue: nextOrig,
          currentTrack: track,
          currentIndex: 0,
          duration: track.duration || 0,
        };
      }
      return { queue: nextQueue, originalQueue: nextOrig };
    });
  },

  removeFromQueue: (youtubeId) => {
    set((state) => {
      const nextQueue = state.queue.filter((item) => item.youtube_id !== youtubeId);
      const nextOrig = state.originalQueue.filter(
        (item) => item.youtube_id !== youtubeId,
      );
      const nextIndex = state.currentTrack
        ? nextQueue.findIndex(
            (item) => item.youtube_id === state.currentTrack?.youtube_id,
          )
        : -1;
      return {
        queue: nextQueue,
        originalQueue: nextOrig,
        currentIndex: nextIndex,
      };
    });
  },

  clearQueue: () => {
    savePersistedPreferences({
      currentTrack: null,
      currentTime: 0,
      activePlaylistId: null,
    });
    set({
      queue: [],
      originalQueue: [],
      currentIndex: -1,
      currentTrack: null,
      activePlaylistId: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    });
  },

  cycleRepeatMode: () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const next = modes[(modes.indexOf(get().repeatMode) + 1) % modes.length] ?? "off";
    savePersistedPreferences({ repeatMode: next });
    set({ repeatMode: next });
  },

  toggleShuffle: () => {
    const { isShuffle, queue, originalQueue, currentTrack } = get();
    const nextShuffle = !isShuffle;
    savePersistedPreferences({ isShuffle: nextShuffle });
    if (nextShuffle) {
      const baseList = originalQueue.length > 0 ? originalQueue : queue;
      if (baseList.length > 1) {
        const shuffledQueue = shuffleTracksWithFirst(baseList, currentTrack);
        set({
          isShuffle: true,
          queue: shuffledQueue,
          originalQueue: baseList,
          currentIndex: currentTrack ? 0 : -1,
        });
      } else {
        set({ isShuffle: true });
      }
    } else {
      // Al desactivar aleatorio, continuar en el orden "normal" (filtro original de biblioteca)
      const normalQueue = originalQueue.length > 0 ? originalQueue : [...queue];
      const normalIndex = currentTrack
        ? normalQueue.findIndex((t) => t.youtube_id === currentTrack.youtube_id)
        : -1;
      set({
        isShuffle: false,
        queue: normalQueue,
        currentIndex: normalIndex >= 0 ? normalIndex : 0,
      });
    }
  },

  updateTrackMetadata: (updated) => {
    set((state) => {
      let nextCurrent = state.currentTrack;
      if (state.currentTrack && state.currentTrack.youtube_id === updated.youtube_id) {
        nextCurrent = { ...state.currentTrack, ...updated };
      }
      const updateList = (list: Track[]) =>
        list.map((item) =>
          item.youtube_id === updated.youtube_id ? { ...item, ...updated } : item,
        );
      return {
        currentTrack: nextCurrent,
        queue: updateList(state.queue),
        originalQueue: updateList(state.originalQueue),
      };
    });
  },
}));
