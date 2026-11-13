use serde::{Deserialize, Serialize};

/// Entidad principal de un contenido multimedia local (SDD 4.1 Tabla `tracks`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Track {
    pub id: i64,
    pub youtube_id: String,
    pub title: String,
    pub artist: String,
    pub duration: i64,
    pub published_at: Option<String>,
    pub file_extension: String,
    pub thumbnail_path: Option<String>,
    pub audio_path: String,
    pub synced: bool,
    pub liked: Option<bool>,
    pub is_missing: bool,
    pub file_size: i64,
    pub created_at: String,
}

/// Datos requeridos para registrar o actualizar un Track en SQLite.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTrack {
    pub youtube_id: String,
    pub title: String,
    pub artist: String,
    pub duration: i64,
    pub published_at: Option<String>,
    pub file_extension: String,
    pub thumbnail_path: Option<String>,
    pub synced: bool,
    pub liked: Option<bool>,
    pub is_missing: bool,
    pub file_size: i64,
}

/// Entidad de Playlist creada o importada por el usuario (SDD 4.2 Tabla `playlists`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Playlist {
    pub id: i64,
    pub title: String,
    pub youtube_playlist_id: Option<String>,
    pub track_count: usize,
    pub created_at: String,
}

/// Playlist junto con el listado completo de sus tracks asociados (SDD 4.3 `playlist_tracks`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistWithTracks {
    pub playlist: Playlist,
    pub tracks: Vec<Track>,
}

/// Información del Workspace activo de LocalStream (SDD Sección 3).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub root_path: String,
    pub tracks_dir: String,
    pub thumbnails_dir: String,
    pub database_path: String,
    pub is_valid: bool,
    pub total_tracks: usize,
    pub missing_tracks: usize,
}

/// Entrada de un Workspace guardado en la memoria persistente de la aplicación (`settings.json`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SavedWorkspaceEntry {
    pub path: String,
    pub name: String,
    pub last_opened_at: String,
    pub is_available: bool,
}

/// Configuración persistente de la aplicación almacenada en el directorio de datos del SO
/// (`~/.config/com.localstream.desktop` en Linux, `%APPDATA%\com.localstream.desktop` en Windows).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub config_file_path: String,
    pub active_workspace: Option<String>,
    pub recent_workspaces: Vec<SavedWorkspaceEntry>,
    pub microservice_url: String,
    pub cookies_file_path: Option<String>,
}

/// Reporte de verificación de integridad entre SQLite y el sistema de archivos físico (SDD 3.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityReport {
    pub checked_count: usize,
    pub newly_missing_ids: Vec<String>,
    pub restored_ids: Vec<String>,
    pub missing_tracks: Vec<Track>,
}

/// Petición de descarga enviada desde el frontend hacia Tauri y delegada al microservicio Go (SDD 6.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadCommandInput {
    pub url: String,
    pub audio_format: String,
    pub force_overwrite: bool,
    pub async_mode: bool,
}

/// Payload enviado al microservicio Go en `POST /api/download`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroserviceDownloadRequest {
    pub url: String,
    pub audio_format: String,
    pub workspace_path: String,
    pub tracks_dir: String,
    pub thumbnails_dir: String,
    pub force_overwrite: bool,
    #[serde(rename = "async")]
    pub async_mode: bool,
}

/// Metadatos devueltos por el microservicio Go tras una descarga.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroserviceTrackMetadata {
    pub youtube_id: String,
    pub title: String,
    pub artist: String,
    pub duration: i64,
    pub published_at: Option<String>,
    pub file_extension: String,
    pub thumbnail_path: String,
    pub audio_path: String,
    pub file_size: i64,
    pub playlist_id: Option<String>,
    pub playlist_title: Option<String>,
}

/// Resultado de un ítem individual descargado por el microservicio Go.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroserviceDownloadItem {
    pub youtube_id: String,
    pub status: String,
    pub metadata: MicroserviceTrackMetadata,
    pub audio_path: String,
    pub thumbnail_path: String,
    pub file_extension: String,
    pub file_size: i64,
    pub skipped: bool,
    pub error: Option<String>,
}

/// Respuesta general de `POST /api/download` del microservicio Go.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroserviceDownloadResponse {
    pub task_id: String,
    pub status: String,
    pub content_type: String,
    pub youtube_id: String,
    pub playlist_id: Option<String>,
    pub playlist_title: Option<String>,
    #[serde(default)]
    pub items: Vec<MicroserviceDownloadItem>,
    pub message: Option<String>,
}

/// Elemento individual de sincronización de likes devuelto por Go (`POST /api/sync-likes`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LikeSyncItemDto {
    pub youtube_id: String,
    pub liked: bool,
    pub synced: bool,
    pub synced_at: String,
}

/// Respuesta del microservicio Go en `POST /api/sync-likes` (SDD 6.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LikeSyncResponseDto {
    pub results: Vec<LikeSyncItemDto>,
    pub total_processed: usize,
    pub synced_count: usize,
}

/// Estado de salud del microservicio Go en `GET /api/health` (SDD 6.4).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatusDto {
    pub status: String,
    pub service: String,
    pub version: String,
    pub dependencies: Option<std::collections::HashMap<String, String>>,
}
