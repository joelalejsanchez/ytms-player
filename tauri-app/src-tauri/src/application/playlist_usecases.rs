use crate::domain::entities::{Playlist, PlaylistWithTracks};
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::PlaylistRepository;

/// Crea una nueva playlist local o asociada a un `youtube_playlist_id` (SDD 4.2).
pub fn create_playlist(
    title: &str,
    youtube_playlist_id: Option<&str>,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<Playlist> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(DomainError::ValidationError(
            "Playlist title cannot be empty".to_string(),
        ));
    }
    playlist_repo.create_playlist(trimmed, youtube_playlist_id)
}

/// Lista todas las playlists registradas en el workspace activo.
pub fn list_playlists(playlist_repo: &dyn PlaylistRepository) -> DomainResult<Vec<Playlist>> {
    playlist_repo.get_all_playlists()
}

/// Obtiene una playlist junto con todos los tracks asociados a ella (SDD 4.3).
pub fn get_playlist_with_tracks(
    playlist_id: i64,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<PlaylistWithTracks> {
    playlist_repo.get_playlist_with_tracks(playlist_id)
}

/// Asocia un track existente a una playlist manteniendo integridad referencial (SDD 4.3 y 4.4).
pub fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<()> {
    playlist_repo.add_track_to_playlist(playlist_id, track_id)
}

/// Desvincula un track de una playlist.
pub fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<()> {
    playlist_repo.remove_track_from_playlist(playlist_id, track_id)
}

/// Elimina una playlist (con `ON DELETE CASCADE` sobre `playlist_tracks`).
pub fn delete_playlist(
    playlist_id: i64,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<()> {
    playlist_repo.delete_playlist(playlist_id)
}
