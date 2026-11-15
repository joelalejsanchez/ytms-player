use std::path::Path;

use crate::domain::entities::{IntegrityReport, WorkspaceInfo};
use crate::domain::errors::DomainResult;
use crate::domain::ports::{TrackRepository, WorkspaceManagerPort};

/// Inicializa o valida un directorio como Workspace de ytms-player (`.ytms-player-workspace`, `/tracks`, `/thumbnails`)
/// y ejecuta la reconciliación de integridad inicial con SQLite (SDD 3.1 - 3.5).
pub fn initialize_workspace(
    workspace_path: &Path,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
) -> DomainResult<WorkspaceInfo> {
    let mut info = workspace_manager.initialize_or_validate(workspace_path)?;
    let report = verify_workspace_integrity(workspace_path, workspace_manager, track_repo)?;
    let all_tracks = track_repo.get_all_tracks()?;

    info.total_tracks = all_tracks.len();
    info.missing_tracks = report.missing_tracks.len();
    Ok(info)
}

/// Verifica la correspondencia física entre los registros de `tracks` en SQLite y los archivos en `/tracks` (SDD 3.5).
///
/// Regla de negocio SDD 3.5:
/// - Si un registro no encuentra su archivo físico: `UPDATE tracks SET is_missing = 1 WHERE youtube_id = ?`
/// - Si el archivo vuelve a estar disponible: `UPDATE tracks SET is_missing = 0 WHERE youtube_id = ?`
pub fn verify_workspace_integrity(
    workspace_path: &Path,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
) -> DomainResult<IntegrityReport> {
    let tracks = track_repo.get_all_tracks()?;
    let mut updates: Vec<(String, bool, i64)> = Vec::new();
    let mut newly_missing_ids: Vec<String> = Vec::new();
    let mut restored_ids: Vec<String> = Vec::new();

    for track in &tracks {
        let (exists, size, _path) = workspace_manager.track_file_status(
            workspace_path,
            &track.youtube_id,
            &track.file_extension,
        );
        let should_be_missing = !exists;

        if should_be_missing != track.is_missing || (exists && size != track.file_size && size > 0)
        {
            let updated_size = if exists { size } else { track.file_size };
            updates.push((track.youtube_id.clone(), should_be_missing, updated_size));

            if should_be_missing && !track.is_missing {
                newly_missing_ids.push(track.youtube_id.clone());
            } else if !should_be_missing && track.is_missing {
                restored_ids.push(track.youtube_id.clone());
            }
        }
    }

    if !updates.is_empty() {
        track_repo.update_missing_status_batch(&updates)?;
    }

    let missing_tracks = track_repo.get_missing_tracks()?;
    let known_ids: Vec<String> = tracks.iter().map(|t| t.youtube_id.clone()).collect();
    let orphan_files = workspace_manager.scan_orphan_track_files(workspace_path, &known_ids)?;

    Ok(IntegrityReport {
        checked_count: tracks.len(),
        newly_missing_ids,
        restored_ids,
        missing_tracks,
        orphan_files,
    })
}
