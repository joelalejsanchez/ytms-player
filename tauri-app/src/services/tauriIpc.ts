import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriEnvironment } from "@/lib/utils";
import type {
  AppSettings,
  DownloadCommandInput,
  HealthStatusDto,
  IntegrityReport,
  LikeSyncResponseDto,
  MicroserviceDownloadItem,
  MicroserviceDownloadResponse,
  NewTrack,
  OAuthStatusDto,
  Playlist,
  PlaylistWithTracks,
  Track,
  WorkspaceInfo,
} from "@/types/models";

async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error(
      `Tauri IPC command '${command}' requires the Tauri desktop runtime.`,
    );
  }
  return invoke<T>(command, args);
}

export const tauriApi = {
  async pickWorkspaceFolder(): Promise<string | null> {
    if (!isTauriEnvironment()) {
      return null;
    }
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Seleccionar directorio raíz del Workspace ytms-player",
    });
    return typeof selected === "string" ? selected : null;
  },

  async pickCookiesFile(): Promise<string | null> {
    if (!isTauriEnvironment()) {
      return null;
    }
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Seleccionar archivo cookies.txt (Netscape format)",
      filters: [{ name: "Cookies File", extensions: ["txt"] }],
    });
    return typeof selected === "string" ? selected : null;
  },

  getAppSettings(): Promise<AppSettings> {
    return safeInvoke<AppSettings>("get_app_settings");
  },

  removeSavedWorkspace(path: string): Promise<AppSettings> {
    return safeInvoke<AppSettings>("remove_saved_workspace", { path });
  },

  importCookiesFile(sourcePath: string): Promise<AppSettings> {
    return safeInvoke<AppSettings>("import_cookies_file", { sourcePath });
  },

  selectWorkspace(path: string): Promise<WorkspaceInfo> {
    return safeInvoke<WorkspaceInfo>("select_workspace", { path });
  },

  getWorkspaceInfo(): Promise<WorkspaceInfo | null> {
    return safeInvoke<WorkspaceInfo | null>("get_workspace_info");
  },

  verifyIntegrity(): Promise<IntegrityReport> {
    return safeInvoke<IntegrityReport>("verify_integrity");
  },

  getTracks(): Promise<Track[]> {
    return safeInvoke<Track[]>("get_tracks");
  },

  getMissingTracks(): Promise<Track[]> {
    return safeInvoke<Track[]>("get_missing_tracks");
  },

  registerTrack(input: NewTrack): Promise<Track> {
    return safeInvoke<Track>("register_track", { input });
  },

  confirmSseDownload(item: MicroserviceDownloadItem): Promise<Track> {
    return safeInvoke<Track>("confirm_sse_download", { item });
  },

  toggleTrackLike(youtubeId: string, liked: boolean | null): Promise<Track> {
    return safeInvoke<Track>("toggle_track_like", { youtubeId, liked });
  },

  deleteTrack(youtubeId: string, deleteFiles: boolean): Promise<void> {
    return safeInvoke<void>("delete_track", { youtubeId, deleteFiles });
  },

  recoverTrack(youtubeId: string): Promise<Track> {
    return safeInvoke<Track>("recover_track", { youtubeId });
  },

  createPlaylist(title: string, youtubePlaylistId?: string): Promise<Playlist> {
    return safeInvoke<Playlist>("create_playlist", {
      title,
      youtubePlaylistId: youtubePlaylistId || null,
    });
  },

  getPlaylists(): Promise<Playlist[]> {
    return safeInvoke<Playlist[]>("get_playlists");
  },

  getPlaylistDetails(playlistId: number): Promise<PlaylistWithTracks> {
    return safeInvoke<PlaylistWithTracks>("get_playlist_details", { playlistId });
  },

  addTrackToPlaylist(playlistId: number, trackId: number): Promise<void> {
    return safeInvoke<void>("add_track_to_playlist", { playlistId, trackId });
  },

  removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<void> {
    return safeInvoke<void>("remove_track_from_playlist", { playlistId, trackId });
  },

  deletePlaylist(playlistId: number): Promise<void> {
    return safeInvoke<void>("delete_playlist", { playlistId });
  },

  startDownload(input: DownloadCommandInput): Promise<MicroserviceDownloadResponse> {
    return safeInvoke<MicroserviceDownloadResponse>("start_download", { input });
  },

  syncLikes(youtubeIds?: string[], accessToken?: string): Promise<LikeSyncResponseDto> {
    return safeInvoke<LikeSyncResponseDto>("sync_likes", {
      youtubeIds: youtubeIds ?? null,
      accessToken: accessToken ?? null,
    });
  },

  checkMicroserviceHealth(): Promise<HealthStatusDto> {
    return safeInvoke<HealthStatusDto>("check_microservice_health");
  },

  setMicroserviceUrl(url: string): Promise<string> {
    return safeInvoke<string>("set_microservice_url", { url });
  },

  getOAuthStatus(): Promise<OAuthStatusDto> {
    return safeInvoke<OAuthStatusDto>("get_oauth_status");
  },

  openOAuthLogin(): Promise<string> {
    return safeInvoke<string>("open_oauth_login");
  },

  readAudioDataUrl(filePath: string): Promise<string> {
    return safeInvoke<string>("read_audio_data_url", { filePath });
  },
};
