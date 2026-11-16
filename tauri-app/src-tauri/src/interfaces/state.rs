use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::WorkspaceManagerPort;
use crate::infrastructure::app_settings_store::AppSettingsStore;
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
    pub settings_store: AppSettingsStore,
    pub microservice: RwLock<Arc<GoMicroserviceClient>>,
    pub audio_server_port: u16,
}

impl AppState {
    pub fn new(default_microservice_url: &str, audio_server_port: u16) -> DomainResult<Self> {
        let settings_store = AppSettingsStore::new();
        let persisted = settings_store.load(default_microservice_url);
        let effective_url = if persisted.microservice_url.trim().is_empty() {
            default_microservice_url
        } else {
            persisted.microservice_url.as_str()
        };

        let client = GoMicroserviceClient::new(effective_url)?;
        let workspace_manager = LocalWorkspaceManager::new();

        // Restaurar automáticamente el último Workspace activo guardado en AppData / ~/.config
        let initial_workspace = persisted
            .active_workspace
            .as_deref()
            .map(PathBuf::from)
            .filter(|p| p.is_dir())
            .and_then(|root_path| {
                workspace_manager.initialize_or_validate(&root_path).ok()?;
                let store = SqliteWorkspaceStore::open(&root_path).ok()?;
                Some(ActiveWorkspaceContext {
                    root_path,
                    store: Arc::new(store),
                })
            });

        Ok(Self {
            workspace: RwLock::new(initial_workspace),
            workspace_manager,
            settings_store,
            microservice: RwLock::new(Arc::new(client)),
            audio_server_port,
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
