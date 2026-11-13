use std::path::Path;

use crate::domain::entities::{NewTrack, Track};
use crate::domain::errors::{validate_youtube_id, DomainError, DomainResult};
use crate::domain::ports::{TrackRepository, WorkspaceManagerPort};

/// Registra o actualiza un track verificando que el `youtube_id` sea válido y comprobando su archivo físico (SDD 4.1 y 4.4).
pub fn register_or_update_track(
    workspace_path: &Path,
    mut input: NewTrack,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
) -> DomainResult<Track> {
    validate_youtube_id(&input.youtube_id)?;

    if input.title.trim().is_empty() {
        input.title = input.youtube_id.clone();
    }
    if input.artist.trim().is_empty() {
        input.artist = "Unknown Artist".to_string();
    }

    let ext = input
        .file_extension
        .trim()
        .trim_start_matches('.')
        .to_lowercase();
    if ext.is_empty() {
        return Err(DomainError::ValidationError(
            "file_extension cannot be empty".to_string(),
        ));
    }
    input.file_extension = ext;

    let (exists, size, _path) = workspace_manager.track_file_status(
        workspace_path,
        &input.youtube_id,
        &input.file_extension,
    );
    input.is_missing = !exists;
    if exists && size > 0 {
        input.file_size = size;
    }

    if input.thumbnail_path.is_none() {
        input.thumbnail_path =
            workspace_manager.resolve_thumbnail_path(workspace_path, &input.youtube_id);
    }

    track_repo.upsert_track(&input)
}

/// Obtiene todos los tracks registrados en el workspace activo.
pub fn list_all_tracks(track_repo: &dyn TrackRepository) -> DomainResult<Vec<Track>> {
    track_repo.get_all_tracks()
}

/// Obtiene los tracks marcados con `is_missing = 1` para el panel de recuperación de archivos (SDD 3.5).
pub fn list_missing_tracks(track_repo: &dyn TrackRepository) -> DomainResult<Vec<Track>> {
    track_repo.get_missing_tracks()
}

/// Actualiza el estado de `liked` de un track y marca `synced = false` hasta la próxima sincronización con YouTube.
pub fn set_track_like_state(
    youtube_id: &str,
    liked: Option<bool>,
    track_repo: &dyn TrackRepository,
) -> DomainResult<Track> {
    validate_youtube_id(youtube_id)?;
    track_repo.set_track_liked(youtube_id, liked, false)
}

/// Elimina un track de SQLite y opcionalmente borra sus archivos físicos en `/tracks` y `/thumbnails`.
pub fn remove_track(
    workspace_path: &Path,
    youtube_id: &str,
    delete_files: bool,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
) -> DomainResult<()> {
    validate_youtube_id(youtube_id)?;
    if let Some(existing) = track_repo.get_track_by_youtube_id(youtube_id)? {
        if delete_files {
            workspace_manager.delete_physical_files(
                workspace_path,
                &existing.youtube_id,
                &existing.file_extension,
            )?;
        }
    }
    track_repo.delete_track(youtube_id)
}
