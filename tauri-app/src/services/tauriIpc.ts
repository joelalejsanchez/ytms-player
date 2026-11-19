import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriEnvironment } from "@/lib/utils";
import type {
  AppSettings,
  DownloadCommandInput,
  DownloadHistoryEntry,
  HealthStatusDto,
  IntegrityReport,
  LikeSyncResponseDto,
  LogEntryPayload,
  MicroserviceDownloadItem,
  MicroserviceDownloadResponse,
  NewTrack,
  OAuthStatusDto,
  Playlist,
  PlaylistPreviewDto,
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
      title: "Seleccionar carpeta para Your Tracks Music Server",
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
      title: "Seleccionar archivo de cookies",
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

  confirmSseDownload(
    item: MicroserviceDownloadItem,
    targetPlaylistId?: number | null,
    skipPlaylist?: boolean | null,
  ): Promise<Track> {
    return safeInvoke<Track>("confirm_sse_download", {
      item,
      targetPlaylistId: targetPlaylistId ?? null,
      skipPlaylist: skipPlaylist ?? null,
    });
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

  getPlaylistTrackMap(): Promise<Record<number, number[]>> {
    return safeInvoke<Record<number, number[]>>("get_playlist_track_map");
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

  syncPlaylistTracks(
    playlistId: number,
    currentYoutubeIds: string[],
    unlinkRemoved: boolean,
  ): Promise<number> {
    return safeInvoke<number>("sync_playlist_tracks", {
      playlistId,
      currentYoutubeIds,
      unlinkRemoved,
    });
  },

  previewPlaylistUrl(url: string): Promise<PlaylistPreviewDto> {
    return safeInvoke<PlaylistPreviewDto>("preview_playlist_url", { url });
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

  logoutOAuth(): Promise<void> {
    return safeInvoke<void>("logout_oauth");
  },

  rateVideo(youtubeId: string, rating: string): Promise<void> {
    return safeInvoke<void>("rate_video", { youtubeId, rating });
  },

  refreshTrackMetadata(youtubeId: string): Promise<Track> {
    return safeInvoke<Track>("refresh_track_metadata", { youtubeId });
  },

  getAudioStreamUrl(filePath: string): Promise<string> {
    return safeInvoke<string>("get_audio_stream_url", { filePath });
  },

  readAudioDataUrl(filePath: string): Promise<string> {
    return safeInvoke<string>("read_audio_data_url", { filePath });
  },

  getDownloadHistory(limit?: number): Promise<DownloadHistoryEntry[]> {
    return safeInvoke<DownloadHistoryEntry[]>("get_download_history", { limit });
  },

  clearDownloadHistory(): Promise<void> {
    return safeInvoke<void>("clear_download_history");
  },

  setPreferredAudioFormat(format: string): Promise<AppSettings> {
    return safeInvoke<AppSettings>("set_preferred_audio_format", { format });
  },

  adoptOrphanFile(
    youtubeId: string,
    fileExtension: string,
    title?: string,
    artist?: string,
  ): Promise<Track> {
    return safeInvoke<Track>("adopt_orphan_file", {
      youtubeId,
      fileExtension,
      title: title || null,
      artist: artist || null,
    });
  },

  deleteOrphanFile(youtubeId: string, fileExtension: string): Promise<void> {
    return safeInvoke<void>("delete_orphan_file", { youtubeId, fileExtension });
  },

  appendLogEntry(entry: LogEntryPayload): Promise<void> {
    return safeInvoke<void>("append_log_entry", { entry });
  },

  clearLogFile(): Promise<void> {
    return safeInvoke<void>("clear_log_file");
  },

  openLogsFolder(): Promise<string> {
    return safeInvoke<string>("open_logs_folder");
  },
};
