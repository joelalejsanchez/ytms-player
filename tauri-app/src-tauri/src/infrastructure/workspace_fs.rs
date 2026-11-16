use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::entities::WorkspaceInfo;
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::WorkspaceManagerPort;

pub const WORKSPACE_CONTROL_FILENAME: &str = ".ytms-player-workspace";
pub const MAX_LOG_FILE_SIZE_BYTES: u64 = 1024 * 1024; // 1 MB límite por archivo de log con rotación

/// Implementación del gestor de sistema de archivos para Workspaces de ytms-player (SDD Sección 3).
#[derive(Debug, Default, Clone)]
pub struct LocalWorkspaceManager;

impl LocalWorkspaceManager {
    pub fn new() -> Self {
        Self
    }

    pub fn append_log_to_file(root_path: &Path, entry_line: &str) -> DomainResult<()> {
        let logs_dir = root_path.join("logs");
        if !logs_dir.is_dir() {
            fs::create_dir_all(&logs_dir).map_err(|e| {
                DomainError::FilesystemError(format!("Failed to create /logs directory: {e}"))
            })?;
        }

        let log_file = logs_dir.join("app.log");
        let old_file = logs_dir.join("app.log.old");

        let entry_bytes_len = entry_line.len() as u64 + 1;
        if let Ok(meta) = fs::metadata(&log_file) {
            if meta.len() + entry_bytes_len > MAX_LOG_FILE_SIZE_BYTES {
                let _ = fs::rename(&log_file, &old_file);
            }
        }

        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
            .map_err(|e| {
                DomainError::FilesystemError(format!("Failed to open log file for append: {e}"))
            })?;

        writeln!(file, "{}", entry_line).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to write to log file: {e}"))
        })?;

        Ok(())
    }

    pub fn clear_log_files(root_path: &Path) -> DomainResult<()> {
        let logs_dir = root_path.join("logs");
        let log_file = logs_dir.join("app.log");
        let old_file = logs_dir.join("app.log.old");

        if log_file.exists() {
            let _ = fs::remove_file(log_file);
        }
        if old_file.exists() {
            let _ = fs::remove_file(old_file);
        }
        Ok(())
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
        let logs_dir = root_path.join("logs");
        let control_file = root_path.join(WORKSPACE_CONTROL_FILENAME);
        let db_path = root_path.join("ytms-player.db");

        fs::create_dir_all(&tracks_dir).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to create /tracks directory: {e}"))
        })?;

        fs::create_dir_all(&thumbnails_dir).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to create /thumbnails directory: {e}"))
        })?;

        fs::create_dir_all(&logs_dir).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to create /logs directory: {e}"))
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

        let is_valid = control_file.is_file()
            && tracks_dir.is_dir()
            && thumbnails_dir.is_dir()
            && logs_dir.is_dir();

        Ok(WorkspaceInfo {
            root_path: root_path.to_string_lossy().to_string(),
            tracks_dir: tracks_dir.to_string_lossy().to_string(),
            thumbnails_dir: thumbnails_dir.to_string_lossy().to_string(),
            logs_dir: logs_dir.to_string_lossy().to_string(),
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

    fn scan_orphan_track_files(
        &self,
        root_path: &Path,
        known_youtube_ids: &[String],
    ) -> DomainResult<Vec<crate::domain::entities::OrphanTrackFile>> {
        let tracks_dir = root_path.join("tracks");
        if !tracks_dir.is_dir() {
            return Ok(Vec::new());
        }

        let id_set: std::collections::HashSet<&str> =
            known_youtube_ids.iter().map(|s| s.as_str()).collect();
        let mut orphans = Vec::new();

        if let Ok(entries) = fs::read_dir(tracks_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or_default()
                    .to_string();

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or_default()
                    .to_lowercase();

                if ext != "mp3" && ext != "m4a" && ext != "opus" {
                    continue;
                }

                let stem = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or_default()
                    .to_string();

                if !id_set.contains(stem.as_str()) {
                    let size = entry.metadata().map(|m| m.len() as i64).unwrap_or(0);
                    orphans.push(crate::domain::entities::OrphanTrackFile {
                        file_name,
                        youtube_id: stem,
                        file_extension: ext,
                        file_size: size,
                        full_path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }

        Ok(orphans)
    }

    fn append_log_entry(&self, root_path: &Path, entry_line: &str) -> DomainResult<()> {
        Self::append_log_to_file(root_path, entry_line)
    }

    fn clear_log_file(&self, root_path: &Path) -> DomainResult<()> {
        Self::clear_log_files(root_path)
    }
}
