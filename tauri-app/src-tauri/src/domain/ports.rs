use std::path::{Path, PathBuf};

use crate::domain::entities::{
    HealthStatusDto, LikeSyncItemDto, LikeSyncResponseDto, MicroserviceDownloadRequest,
    MicroserviceDownloadResponse, NewTrack, Playlist, PlaylistWithTracks, Track, WorkspaceInfo,
};
use crate::domain::errors::DomainResult;

/// Puerto de persistencia para la tabla `tracks` en SQLite (SDD 4.1 y 5.1).
pub trait TrackRepository: Send + Sync {
    fn upsert_track(&self, track: &NewTrack) -> DomainResult<Track>;
    fn get_all_tracks(&self) -> DomainResult<Vec<Track>>;
    fn get_track_by_youtube_id(&self, youtube_id: &str) -> DomainResult<Option<Track>>;
    fn get_missing_tracks(&self) -> DomainResult<Vec<Track>>;
    fn update_missing_status(
        &self,
        youtube_id: &str,
        is_missing: bool,
        file_size: Option<i64>,
    ) -> DomainResult<()>;
    fn update_missing_status_batch(&self, updates: &[(String, bool, i64)]) -> DomainResult<()>;
    fn set_track_liked(
        &self,
        youtube_id: &str,
        liked: Option<bool>,
        synced: bool,
    ) -> DomainResult<Track>;
    fn apply_synced_likes(&self, items: &[LikeSyncItemDto]) -> DomainResult<usize>;
    fn delete_track(&self, youtube_id: &str) -> DomainResult<()>;
}

/// Puerto de persistencia para las tablas `playlists` y `playlist_tracks` en SQLite (SDD 4.2, 4.3 y 5.1).
pub trait PlaylistRepository: Send + Sync {
    fn create_playlist(
        &self,
        title: &str,
        youtube_playlist_id: Option<&str>,
    ) -> DomainResult<Playlist>;
    fn get_all_playlists(&self) -> DomainResult<Vec<Playlist>>;
    fn get_playlist_with_tracks(&self, playlist_id: i64) -> DomainResult<PlaylistWithTracks>;
    fn add_track_to_playlist(&self, playlist_id: i64, track_id: i64) -> DomainResult<()>;
    fn remove_track_from_playlist(&self, playlist_id: i64, track_id: i64) -> DomainResult<()>;
    fn delete_playlist(&self, playlist_id: i64) -> DomainResult<()>;
}

/// Puerto para la administración física del directorio Workspace y archivo `.localstream-workspace` (SDD Sección 3).
pub trait WorkspaceManagerPort: Send + Sync {
    fn initialize_or_validate(&self, root_path: &Path) -> DomainResult<WorkspaceInfo>;
    fn track_file_status(
        &self,
        root_path: &Path,
        youtube_id: &str,
        extension: &str,
    ) -> (bool, i64, PathBuf);
    fn resolve_thumbnail_path(&self, root_path: &Path, youtube_id: &str) -> Option<String>;
    fn delete_physical_files(
        &self,
        root_path: &Path,
        youtube_id: &str,
        extension: &str,
    ) -> DomainResult<()>;
}

/// Puerto de comunicación HTTP con el microservicio Go (SDD Sección 6).
pub trait MicroserviceClientPort: Send + Sync {
    fn trigger_download(
        &self,
        req: &MicroserviceDownloadRequest,
    ) -> DomainResult<MicroserviceDownloadResponse>;
    fn sync_likes(
        &self,
        youtube_ids: &[String],
        access_token: Option<&str>,
    ) -> DomainResult<LikeSyncResponseDto>;
    fn check_health(&self) -> DomainResult<HealthStatusDto>;
}
