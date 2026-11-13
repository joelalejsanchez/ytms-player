export type AudioFormat = "mp3" | "m4a" | "opus";

export type DownloadStatus =
  "queued" | "downloading" | "processing" | "completed" | "skipped" | "failed";

export type NavigationTab =
  "library" | "playlists" | "downloads" | "recovery" | "workspace";

export interface Track {
  id: number;
  youtube_id: string;
  title: string;
  artist: string;
  duration: number;
  published_at: string | null;
  file_extension: AudioFormat | string;
  thumbnail_path: string | null;
  audio_path: string;
  synced: boolean;
  liked: boolean | null;
  is_missing: boolean;
  file_size: number;
  created_at: string;
}

export interface NewTrack {
  youtube_id: string;
  title: string;
  artist: string;
  duration: number;
  published_at: string | null;
  file_extension: string;
  thumbnail_path: string | null;
  synced: boolean;
  liked: boolean | null;
  is_missing: boolean;
  file_size: number;
}

export interface Playlist {
  id: number;
  title: string;
  youtube_playlist_id: string | null;
  track_count: number;
  created_at: string;
}

export interface PlaylistWithTracks {
  playlist: Playlist;
  tracks: Track[];
}

export interface WorkspaceInfo {
  root_path: string;
  tracks_dir: string;
  thumbnails_dir: string;
  database_path: string;
  is_valid: boolean;
  total_tracks: number;
  missing_tracks: number;
}

export interface SavedWorkspaceEntry {
  path: string;
  name: string;
  last_opened_at: string;
  is_available: boolean;
}

export interface AppSettings {
  config_file_path: string;
  active_workspace: string | null;
  recent_workspaces: SavedWorkspaceEntry[];
  microservice_url: string;
  cookies_file_path: string | null;
}

export interface IntegrityReport {
  checked_count: number;
  newly_missing_ids: string[];
  restored_ids: string[];
  missing_tracks: Track[];
}

export interface DownloadCommandInput {
  url: string;
  audio_format: AudioFormat;
  force_overwrite: boolean;
  async_mode: boolean;
}

export interface MicroserviceTrackMetadata {
  youtube_id: string;
  title: string;
  artist: string;
  duration: number;
  published_at?: string | null;
  file_extension: string;
  thumbnail_path: string;
  audio_path: string;
  file_size: number;
  playlist_id?: string | null;
  playlist_title?: string | null;
}

export interface MicroserviceDownloadItem {
  youtube_id: string;
  status: DownloadStatus;
  metadata: MicroserviceTrackMetadata;
  audio_path: string;
  thumbnail_path: string;
  file_extension: string;
  file_size: number;
  skipped: boolean;
  error?: string;
}

export interface MicroserviceDownloadResponse {
  task_id: string;
  status: DownloadStatus;
  content_type: "video" | "playlist";
  youtube_id: string;
  playlist_id?: string;
  playlist_title?: string;
  items: MicroserviceDownloadItem[];
  message?: string;
}

export interface DownloadProgressEvent {
  task_id: string;
  youtube_id: string;
  status: DownloadStatus;
  progress: number;
  speed?: string;
  downloaded_size?: string;
  eta?: string;
  error?: string;
  metadata?: MicroserviceTrackMetadata;
}

export interface LikeSyncItemDto {
  youtube_id: string;
  liked: boolean;
  synced: boolean;
  synced_at: string;
}

export interface LikeSyncResponseDto {
  results: LikeSyncItemDto[];
  total_processed: number;
  synced_count: number;
}

export interface HealthStatusDto {
  status: string;
  service: string;
  version: string;
  dependencies?: Record<string, string>;
}
