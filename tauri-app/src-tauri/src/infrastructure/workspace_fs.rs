use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::entities::WorkspaceInfo;
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::WorkspaceManagerPort;

pub const WORKSPACE_CONTROL_FILENAME: &str = ".ytms-player-workspace";

/// Implementación del gestor de sistema de archivos para Workspaces de ytms-player (SDD Sección 3).
#[derive(Debug, Default, Clone)]
pub struct LocalWorkspaceManager;

impl LocalWorkspaceManager {
    pub fn new() -> Self {
        Self
    }
}

impl WorkspaceManagerPort for LocalWorkspaceManager {
    fn initialize_or_validate(&self, root_path: &Path) -> DomainResult<WorkspaceInfo> {
        if root_path.as_os_str().is_empty() {
            return Err(DomainError::InvalidWorkspacePath(
                "Workspace path cannot be empty".to_string(),
            ));
        }

        fs::create_dir_all(root_path).map_err(|e| {
            DomainError::InvalidWorkspacePath(format!(
                "Failed to create workspace root {}: {e}",
                root_path.display()
            ))
        })?;

        let tracks_dir = root_path.join("tracks");
        let thumbnails_dir = root_path.join("thumbnails");
        let control_file = root_path.join(WORKSPACE_CONTROL_FILENAME);
        let db_path = root_path.join("ytms-player.db");

        fs::create_dir_all(&tracks_dir).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to create /tracks directory: {e}"))
        })?;

        fs::create_dir_all(&thumbnails_dir).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to create /thumbnails directory: {e}"))
        })?;

        if !control_file.exists() {
            let control_payload =
                r#"{"app":"ytms-player","schema_version":1,"workspace_type":"local"}"#;
            fs::write(&control_file, format!("{control_payload}\n")).map_err(|e| {
                DomainError::FilesystemError(format!(
                    "Failed to create {WORKSPACE_CONTROL_FILENAME}: {e}"
                ))
            })?;
        }

        let is_valid = control_file.is_file() && tracks_dir.is_dir() && thumbnails_dir.is_dir();

        Ok(WorkspaceInfo {
            root_path: root_path.to_string_lossy().to_string(),
            tracks_dir: tracks_dir.to_string_lossy().to_string(),
            thumbnails_dir: thumbnails_dir.to_string_lossy().to_string(),
            database_path: db_path.to_string_lossy().to_string(),
            is_valid,
            total_tracks: 0,
            missing_tracks: 0,
        })
    }

    fn track_file_status(
        &self,
        root_path: &Path,
        youtube_id: &str,
        extension: &str,
    ) -> (bool, i64, PathBuf) {
        let clean_ext = extension.trim().trim_start_matches('.');
        let file_path = root_path
            .join("tracks")
            .join(format!("{youtube_id}.{clean_ext}"));

        match fs::metadata(&file_path) {
            Ok(meta) if meta.is_file() && meta.len() > 0 => {
                let size = i64::try_from(meta.len()).unwrap_or(0);
                (true, size, file_path)
            }
            _ => (false, 0, file_path),
        }
    }

    fn resolve_thumbnail_path(&self, root_path: &Path, youtube_id: &str) -> Option<String> {
        let thumb_path = root_path
            .join("thumbnails")
            .join(format!("{youtube_id}.jpg"));
        if thumb_path.is_file() {
            Some(thumb_path.to_string_lossy().to_string())
        } else {
            None
        }
    }

    fn delete_physical_files(
        &self,
        root_path: &Path,
        youtube_id: &str,
        extension: &str,
    ) -> DomainResult<()> {
        let clean_ext = extension.trim().trim_start_matches('.');
        let audio_path = root_path
            .join("tracks")
            .join(format!("{youtube_id}.{clean_ext}"));
        let thumb_path = root_path
            .join("thumbnails")
            .join(format!("{youtube_id}.jpg"));

        if audio_path.exists() {
            fs::remove_file(&audio_path).map_err(|e| {
                DomainError::FilesystemError(format!("Failed to remove audio file: {e}"))
            })?;
        }
        if thumb_path.exists() {
            fs::remove_file(&thumb_path).map_err(|e| {
                DomainError::FilesystemError(format!("Failed to remove thumbnail file: {e}"))
            })?;
        }
        Ok(())
    }
}
