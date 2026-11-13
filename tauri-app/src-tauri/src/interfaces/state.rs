use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use crate::domain::errors::{DomainError, DomainResult};
use crate::infrastructure::go_microservice_client::GoMicroserviceClient;
use crate::infrastructure::sqlite_repository::SqliteWorkspaceStore;
use crate::infrastructure::workspace_fs::LocalWorkspaceManager;

/// Contexto del Workspace activo cargado en memoria.
#[derive(Clone)]
pub struct ActiveWorkspaceContext {
    pub root_path: PathBuf,
    pub store: Arc<SqliteWorkspaceStore>,
}

/// Estado global compartido de Tauri (SDD 5.4).
pub struct AppState {
    pub workspace: RwLock<Option<ActiveWorkspaceContext>>,
    pub workspace_manager: LocalWorkspaceManager,
    pub microservice: RwLock<Arc<GoMicroserviceClient>>,
}

impl AppState {
    pub fn new(default_microservice_url: &str) -> DomainResult<Self> {
        let client = GoMicroserviceClient::new(default_microservice_url)?;
        Ok(Self {
            workspace: RwLock::new(None),
            workspace_manager: LocalWorkspaceManager::new(),
            microservice: RwLock::new(Arc::new(client)),
        })
    }

    pub fn active_workspace(&self) -> DomainResult<ActiveWorkspaceContext> {
        let guard = self
            .workspace
            .read()
            .map_err(|e| DomainError::PersistenceError(format!("Workspace lock error: {e}")))?;

        guard.clone().ok_or(DomainError::WorkspaceNotInitialized)
    }

    pub fn microservice_client(&self) -> DomainResult<Arc<GoMicroserviceClient>> {
        let guard = self
            .microservice
            .read()
            .map_err(|e| DomainError::MicroserviceError(format!("Microservice lock error: {e}")))?;

        Ok(Arc::clone(&guard))
    }
}
