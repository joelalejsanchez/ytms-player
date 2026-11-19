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

/// Valida que el identificador de la pista sea seguro y no esté vacío.
pub fn validate_youtube_id(youtube_id: &str) -> DomainResult<()> {
    let trimmed = youtube_id.trim();
    if trimmed.is_empty() {
        return Err(DomainError::ValidationError(
            "Track identifier cannot be empty".to_string(),
        ));
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err(DomainError::ValidationError(format!(
            "Invalid track identifier: {youtube_id}"
        )));
    }
    Ok(())
}
