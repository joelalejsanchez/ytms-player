import { create } from "zustand";
import { tauriApi } from "@/services/tauriIpc";
import type {
  AppSettings,
  HealthStatusDto,
  IntegrityReport,
  LikeSyncResponseDto,
  Playlist,
  PlaylistWithTracks,
  Track,
  WorkspaceInfo,
} from "@/types/models";

export interface LibraryStoreState {
  workspace: WorkspaceInfo | null;
  appSettings: AppSettings | null;
  tracks: Track[];
  missingTracks: Track[];
  playlists: Playlist[];
  activePlaylist: PlaylistWithTracks | null;
  lastIntegrityReport: IntegrityReport | null;
  health: HealthStatusDto | null;
  isLoading: boolean;
  error: string | null;

  selectWorkspace: (path: string) => Promise<WorkspaceInfo>;
  removeSavedWorkspace: (path: string) => Promise<void>;
  importCookiesFile: (sourcePath: string) => Promise<AppSettings>;
  loadInitialState: () => Promise<void>;
  refreshTracks: () => Promise<void>;
  refreshMissingTracks: () => Promise<void>;
  verifyIntegrity: () => Promise<IntegrityReport>;
  recoverTrack: (youtubeId: string) => Promise<Track>;
  toggleLike: (youtubeId: string, liked: boolean | null) => Promise<void>;
  deleteTrack: (youtubeId: string, deleteFiles: boolean) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  selectPlaylist: (playlistId: number | null) => Promise<void>;
  createPlaylist: (title: string, youtubePlaylistId?: string) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  deletePlaylist: (playlistId: number) => Promise<void>;
  syncLikes: (accessToken?: string) => Promise<LikeSyncResponseDto>;
  checkHealth: () => Promise<void>;
  upsertTrackLocal: (track: Track) => void;
  clearError: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  workspace: null,
  appSettings: null,
  tracks: [],
  missingTracks: [],
  playlists: [],
  activePlaylist: null,
  lastIntegrityReport: null,
  health: null,
  isLoading: false,
  error: null,

  selectWorkspace: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const ws = await tauriApi.selectWorkspace(path);
      const [tracks, missingTracks, playlists, appSettings] = await Promise.all([
        tauriApi.getTracks(),
        tauriApi.getMissingTracks(),
        tauriApi.getPlaylists(),
        tauriApi.getAppSettings(),
      ]);
      set({
        workspace: ws,
        appSettings,
        tracks,
        missingTracks,
        playlists,
        activePlaylist: null,
        isLoading: false,
      });
      return ws;
    } catch (err) {
      const message = extractErrorMessage(err, "No se pudo inicializar el Workspace");
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  removeSavedWorkspace: async (path) => {
    try {
      const appSettings = await tauriApi.removeSavedWorkspace(path);
      set({ appSettings });
    } catch (err) {
      set({ error: extractErrorMessage(err, "No se pudo olvidar el Workspace") });
    }
  },

  importCookiesFile: async (sourcePath) => {
    set({ isLoading: true, error: null });
    try {
      const appSettings = await tauriApi.importCookiesFile(sourcePath);
      set({ appSettings, isLoading: false });
      return appSettings;
    } catch (err) {
      const message = extractErrorMessage(err, "No se pudo importar cookies.txt");
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  loadInitialState: async () => {
    set({ isLoading: true, error: null });
    try {
      const [ws, appSettings] = await Promise.all([
        tauriApi.getWorkspaceInfo(),
        tauriApi.getAppSettings(),
      ]);
      if (ws) {
        const [tracks, missingTracks, playlists] = await Promise.all([
          tauriApi.getTracks(),
          tauriApi.getMissingTracks(),
          tauriApi.getPlaylists(),
        ]);
        set({
          workspace: ws,
          appSettings,
          tracks,
          missingTracks,
          playlists,
          isLoading: false,
        });
      } else {
        set({ appSettings, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  refreshTracks: async () => {
    try {
      const [tracks, missingTracks, ws] = await Promise.all([
        tauriApi.getTracks(),
        tauriApi.getMissingTracks(),
        tauriApi.getWorkspaceInfo(),
      ]);
      set({ tracks, missingTracks, workspace: ws });
    } catch (err) {
      set({ error: extractErrorMessage(err, "Error al cargar la biblioteca") });
    }
  },

  refreshMissingTracks: async () => {
    try {
      const missingTracks = await tauriApi.getMissingTracks();
      set({ missingTracks });
    } catch (err) {
      set({
        error: extractErrorMessage(err, "Error al consultar archivos extraviados"),
      });
    }
  },

  verifyIntegrity: async () => {
    set({ isLoading: true, error: null });
    try {
      const report = await tauriApi.verifyIntegrity();
      const [tracks, ws] = await Promise.all([
        tauriApi.getTracks(),
        tauriApi.getWorkspaceInfo(),
      ]);
      set({
        lastIntegrityReport: report,
        missingTracks: report.missing_tracks,
        tracks,
        workspace: ws,
        isLoading: false,
      });
      return report;
    } catch (err) {
      const message = extractErrorMessage(err, "Error al verificar la integridad");
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  recoverTrack: async (youtubeId) => {
    set({ isLoading: true, error: null });
    try {
      const recovered = await tauriApi.recoverTrack(youtubeId);
      await get().refreshTracks();
      set({ isLoading: false });
      return recovered;
    } catch (err) {
      const message = extractErrorMessage(err, "No se pudo recuperar el archivo");
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  toggleLike: async (youtubeId, liked) => {
    try {
      const updated = await tauriApi.toggleTrackLike(youtubeId, liked);
      get().upsertTrackLocal(updated);
    } catch (err) {
      set({
        error: extractErrorMessage(err, "No se pudo actualizar el estado de like"),
      });
    }
  },

  deleteTrack: async (youtubeId, deleteFiles) => {
    try {
      await tauriApi.deleteTrack(youtubeId, deleteFiles);
      await get().refreshTracks();
    } catch (err) {
      set({ error: extractErrorMessage(err, "No se pudo eliminar el track") });
    }
  },

  refreshPlaylists: async () => {
    try {
      const playlists = await tauriApi.getPlaylists();
      set({ playlists });
    } catch (err) {
      set({ error: extractErrorMessage(err, "No se pudieron cargar las playlists") });
    }
  },

  selectPlaylist: async (playlistId) => {
    if (playlistId === null) {
      set({ activePlaylist: null });
      return;
    }
    try {
      const details = await tauriApi.getPlaylistDetails(playlistId);
      set({ activePlaylist: details });
    } catch (err) {
      set({ error: extractErrorMessage(err, "No se pudo abrir la playlist") });
    }
  },

  createPlaylist: async (title, youtubePlaylistId) => {
    const created = await tauriApi.createPlaylist(title, youtubePlaylistId);
    await get().refreshPlaylists();
    return created;
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    await tauriApi.addTrackToPlaylist(playlistId, trackId);
    await get().refreshPlaylists();
    if (get().activePlaylist?.playlist.id === playlistId) {
      await get().selectPlaylist(playlistId);
    }
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    await tauriApi.removeTrackFromPlaylist(playlistId, trackId);
    await get().refreshPlaylists();
    if (get().activePlaylist?.playlist.id === playlistId) {
      await get().selectPlaylist(playlistId);
    }
  },

  deletePlaylist: async (playlistId) => {
    await tauriApi.deletePlaylist(playlistId);
    if (get().activePlaylist?.playlist.id === playlistId) {
      set({ activePlaylist: null });
    }
    await get().refreshPlaylists();
  },

  syncLikes: async (accessToken) => {
    set({ isLoading: true, error: null });
    try {
      const result = await tauriApi.syncLikes(undefined, accessToken);
      await get().refreshTracks();
      set({ isLoading: false });
      return result;
    } catch (err) {
      const message = extractErrorMessage(
        err,
        "Error al sincronizar likes con YouTube",
      );
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  checkHealth: async () => {
    try {
      const status = await tauriApi.checkMicroserviceHealth();
      set({ health: status });
    } catch {
      set({
        health: {
          status: "offline",
          service: "ytms-player-go",
          version: "1.0.0",
        },
      });
    }
  },

  upsertTrackLocal: (track) => {
    set((state) => {
      const index = state.tracks.findIndex((t) => t.youtube_id === track.youtube_id);
      const nextTracks =
        index >= 0
          ? state.tracks.map((item, i) => (i === index ? track : item))
          : [track, ...state.tracks];
      const nextMissing = nextTracks.filter((t) => t.is_missing);
      return {
        tracks: nextTracks,
        missingTracks: nextMissing,
      };
    });
  },

  clearError: () => set({ error: null }),
}));
