use serde::Serialize;
use thiserror::Error;

/// Errores de dominio independientes de frameworks externos (SDD 5.1).
#[derive(Debug, Error, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "code", content = "message")]
pub enum DomainError {
    #[error(
        "No active workspace has been initialized. Please select a workspace directory first."
    )]
    WorkspaceNotInitialized,

    #[error("Invalid workspace directory: {0}")]
    InvalidWorkspacePath(String),

    #[error("Invalid YouTube identifier: {0}")]
    InvalidYouTubeId(String),

    #[error("Invalid input parameter: {0}")]
    ValidationError(String),

    #[error("Track not found for YouTube ID: {0}")]
    TrackNotFound(String),

    #[error("Playlist not found for ID: {0}")]
    PlaylistNotFound(i64),

    #[error("Database persistence error: {0}")]
    PersistenceError(String),

    #[error("Filesystem operation error: {0}")]
    FilesystemError(String),

    #[error("Go microservice communication error: {0}")]
    MicroserviceError(String),
}

pub type DomainResult<T> = Result<T, DomainError>;

/// Valida que un `youtube_id` cumpla con el estándar de 11 caracteres alfanuméricos, guiones o guiones bajos.
pub fn validate_youtube_id(youtube_id: &str) -> DomainResult<()> {
    let trimmed = youtube_id.trim();
    if trimmed.len() != 11 {
        return Err(DomainError::InvalidYouTubeId(youtube_id.to_string()));
    }
    let is_valid = trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !is_valid {
        return Err(DomainError::InvalidYouTubeId(youtube_id.to_string()));
    }
    Ok(())
}
