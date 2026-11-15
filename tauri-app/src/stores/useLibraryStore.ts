import { create } from "zustand";
import { tauriApi } from "@/services/tauriIpc";
import type {
  AppSettings,
  DownloadHistoryEntry,
  HealthStatusDto,
  IntegrityReport,
  LikeSyncResponseDto,
  OAuthStatusDto,
  OrphanTrackFile,
  Playlist,
  PlaylistWithTracks,
  Track,
  WorkspaceInfo,
} from "@/types/models";

export type TrackSyncStatus = "idle" | "loading" | "synced" | "local" | "error";

export interface TrackSyncInfo {
  status: TrackSyncStatus;
  error?: string;
}

export interface LibraryStoreState {
  workspace: WorkspaceInfo | null;
  appSettings: AppSettings | null;
  tracks: Track[];
  missingTracks: Track[];
  orphanFiles: OrphanTrackFile[];
  downloadHistory: DownloadHistoryEntry[];
  playlists: Playlist[];
  playlistTrackMap: Record<number, number[]>;
  activePlaylist: PlaylistWithTracks | null;
  lastIntegrityReport: IntegrityReport | null;
  health: HealthStatusDto | null;
  oauthStatus: OAuthStatusDto | null;
  isLoading: boolean;
  error: string | null;
  syncStatusByTrack: Record<string, TrackSyncInfo>;

  selectWorkspace: (path: string) => Promise<WorkspaceInfo>;
  removeSavedWorkspace: (path: string) => Promise<void>;
  importCookiesFile: (sourcePath: string) => Promise<AppSettings>;
  setPreferredFormat: (format: string) => Promise<void>;
  loadInitialState: () => Promise<void>;
  refreshTracks: () => Promise<void>;
  refreshMissingTracks: () => Promise<void>;
  refreshDownloadHistory: () => Promise<void>;
  clearDownloadHistory: () => Promise<void>;
  verifyIntegrity: () => Promise<IntegrityReport>;
  recoverTrack: (youtubeId: string) => Promise<Track>;
  adoptOrphanFile: (
    youtubeId: string,
    fileExtension: string,
    title?: string,
  ) => Promise<void>;
  deleteOrphanFile: (youtubeId: string, fileExtension: string) => Promise<void>;
  toggleLike: (youtubeId: string, liked: boolean | null) => Promise<void>;
  deleteTrack: (youtubeId: string, deleteFiles: boolean) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  refreshPlaylistTrackMap: () => Promise<void>;
  selectPlaylist: (playlistId: number | null) => Promise<void>;
  createPlaylist: (title: string, youtubePlaylistId?: string) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  deletePlaylist: (playlistId: number) => Promise<void>;
  syncLikes: (accessToken?: string) => Promise<LikeSyncResponseDto>;
  checkHealth: () => Promise<void>;
  checkOAuthStatus: () => Promise<void>;
  openOAuthLogin: () => Promise<string>;
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
  orphanFiles: [],
  downloadHistory: [],
  playlists: [],
  playlistTrackMap: {},
  activePlaylist: null,
  lastIntegrityReport: null,
  health: null,
  oauthStatus: null,
  isLoading: false,
  error: null,
  syncStatusByTrack: {},

  selectWorkspace: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const ws = await tauriApi.selectWorkspace(path);
      const [tracks, missingTracks, playlists, playlistTrackMap, appSettings] =
        await Promise.all([
          tauriApi.getTracks(),
          tauriApi.getMissingTracks(),
          tauriApi.getPlaylists(),
          tauriApi.getPlaylistTrackMap().catch(() => ({})),
          tauriApi.getAppSettings(),
        ]);
      set({
        workspace: ws,
        appSettings,
        tracks,
        missingTracks,
        playlists,
        playlistTrackMap: playlistTrackMap || {},
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
        const [tracks, missingTracks, playlists, playlistTrackMap] = await Promise.all([
          tauriApi.getTracks(),
          tauriApi.getMissingTracks(),
          tauriApi.getPlaylists(),
          tauriApi.getPlaylistTrackMap().catch(() => ({})),
        ]);
        set({
          workspace: ws,
          appSettings,
          tracks,
          missingTracks,
          playlists,
          playlistTrackMap: playlistTrackMap || {},
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

  setPreferredFormat: async (format: string) => {
    try {
      const appSettings = await tauriApi.setPreferredAudioFormat(format);
      set({ appSettings });
    } catch {
      // Ignorar
    }
  },

  refreshDownloadHistory: async () => {
    try {
      const history = await tauriApi.getDownloadHistory(50);
      set({ downloadHistory: history });
    } catch {
      // Ignorar si el workspace no está inicializado
    }
  },

  clearDownloadHistory: async () => {
    try {
      await tauriApi.clearDownloadHistory();
      set({ downloadHistory: [] });
    } catch (err) {
      console.error("Error al limpiar historial de descargas:", err);
      throw err;
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
        orphanFiles: report.orphan_files ?? [],
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

  adoptOrphanFile: async (youtubeId, fileExtension, title) => {
    set({ isLoading: true, error: null });
    try {
      await tauriApi.adoptOrphanFile(youtubeId, fileExtension, title);
      await get().verifyIntegrity();
      await get().refreshTracks();
      set({ isLoading: false });
    } catch (err) {
      const message = extractErrorMessage(
        err,
        "No se pudo adoptar el archivo huérfano",
      );
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  deleteOrphanFile: async (youtubeId, fileExtension) => {
    set({ isLoading: true, error: null });
    try {
      await tauriApi.deleteOrphanFile(youtubeId, fileExtension);
      await get().verifyIntegrity();
      set({ isLoading: false });
    } catch (err) {
      const message = extractErrorMessage(
        err,
        "No se pudo eliminar el archivo huérfano",
      );
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
    set((state) => ({
      syncStatusByTrack: {
        ...state.syncStatusByTrack,
        [youtubeId]: { status: "loading" },
      },
    }));

    try {
      const updated = await tauriApi.toggleTrackLike(youtubeId, liked);
      get().upsertTrackLocal(updated);
      set((state) => ({
        syncStatusByTrack: {
          ...state.syncStatusByTrack,
          [youtubeId]: {
            status: updated.synced ? "synced" : "local",
          },
        },
      }));
    } catch (err) {
      const message = extractErrorMessage(
        err,
        "No se pudo sincronizar el estado de like con YouTube",
      );
      await get().refreshTracks();
      set((state) => ({
        syncStatusByTrack: {
          ...state.syncStatusByTrack,
          [youtubeId]: {
            status: "error",
            error: message,
          },
        },
        error: message,
      }));
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
      const [playlists, map] = await Promise.all([
        tauriApi.getPlaylists(),
        tauriApi.getPlaylistTrackMap().catch(() => ({})),
      ]);
      set({ playlists, playlistTrackMap: map || {} });
    } catch (err) {
      set({ error: extractErrorMessage(err, "No se pudieron cargar las playlists") });
    }
  },

  refreshPlaylistTrackMap: async () => {
    try {
      const map = await tauriApi.getPlaylistTrackMap();
      set({ playlistTrackMap: map || {} });
    } catch {
      // Ignorar
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
    set((state) => {
      const current = state.playlistTrackMap[trackId] || [];
      if (current.includes(playlistId)) return state;
      return {
        playlistTrackMap: {
          ...state.playlistTrackMap,
          [trackId]: [...current, playlistId],
        },
      };
    });
    await tauriApi.addTrackToPlaylist(playlistId, trackId);
    await get().refreshPlaylists();
    if (get().activePlaylist?.playlist.id === playlistId) {
      await get().selectPlaylist(playlistId);
    }
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    set((state) => {
      const current = state.playlistTrackMap[trackId] || [];
      return {
        playlistTrackMap: {
          ...state.playlistTrackMap,
          [trackId]: current.filter((id) => id !== playlistId),
        },
      };
    });
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
      const [status, oauthStatus] = await Promise.all([
        tauriApi.checkMicroserviceHealth(),
        tauriApi.getOAuthStatus().catch(() => null),
      ]);
      set({ health: status, oauthStatus });
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

  checkOAuthStatus: async () => {
    try {
      const oauthStatus = await tauriApi.getOAuthStatus();
      set({ oauthStatus });
    } catch {
      // Ignore if microservice is offline
    }
  },

  openOAuthLogin: async () => {
    set({ error: null });
    try {
      return await tauriApi.openOAuthLogin();
    } catch (err) {
      const message = extractErrorMessage(
        err,
        "No se pudo abrir la pantalla de consentimiento OAuth 2.0 en el navegador",
      );
      set({ error: message });
      throw err;
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
