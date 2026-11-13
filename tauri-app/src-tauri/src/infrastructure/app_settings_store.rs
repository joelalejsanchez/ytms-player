use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::domain::entities::{AppSettings, SavedWorkspaceEntry};
use crate::domain::errors::{DomainError, DomainResult};

const APP_IDENTIFIER: &str = "com.localstream.desktop";
const SETTINGS_FILENAME: &str = "settings.json";

/// Gestiona la persistencia de configuración de la aplicación (Workspaces recordados, último activo,
/// URL del microservicio y ruta de `cookies.txt`) en la carpeta estándar del sistema operativo:
/// - **Linux:** `$XDG_CONFIG_HOME/com.localstream.desktop/settings.json` o `~/.config/com.localstream.desktop/settings.json`
/// - **Windows:** `%APPDATA%\com.localstream.desktop\settings.json` (`C:\Users\<User>\AppData\Roaming\...`)
/// - **macOS:** `~/Library/Application Support/com.localstream.desktop/settings.json`
#[derive(Debug, Clone)]
pub struct AppSettingsStore {
    settings_path: PathBuf,
    cookies_target_path: PathBuf,
}

impl AppSettingsStore {
    pub fn new() -> Self {
        let config_dir = Self::resolve_os_app_config_dir();
        let _ = fs::create_dir_all(&config_dir);
        let settings_path = config_dir.join(SETTINGS_FILENAME);
        let cookies_target_path = Self::resolve_default_cookies_target(&config_dir);

        Self {
            settings_path,
            cookies_target_path,
        }
    }

    pub fn with_custom_dir(base_dir: &Path) -> Self {
        let _ = fs::create_dir_all(base_dir);
        Self {
            settings_path: base_dir.join(SETTINGS_FILENAME),
            cookies_target_path: base_dir.join("cookies.txt"),
        }
    }

    /// Determina el directorio nativo de configuración según el sistema operativo (Linux XDG / Windows AppData / macOS).
    pub fn resolve_os_app_config_dir() -> PathBuf {
        if let Ok(custom) = std::env::var("LOCALSTREAM_CONFIG_DIR") {
            let trimmed = custom.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                return PathBuf::from(appdata).join(APP_IDENTIFIER);
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(home)
                    .join("Library")
                    .join("Application Support")
                    .join(APP_IDENTIFIER);
            }
        }

        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            let trimmed = xdg.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed).join(APP_IDENTIFIER);
            }
        }

        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(".config").join(APP_IDENTIFIER);
        }

        std::env::temp_dir().join(APP_IDENTIFIER)
    }

    fn resolve_default_cookies_target(config_dir: &Path) -> PathBuf {
        if let Ok(env_path) = std::env::var("LOCALSTREAM_COOKIES_HOST_PATH") {
            let trimmed = env_path.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
        // Si existe la carpeta ./config o ../config del monorepo para el volumen Docker, sincronizar también allí
        let candidates = [
            PathBuf::from("../config/cookies.txt"),
            PathBuf::from("./config/cookies.txt"),
        ];
        for candidate in candidates {
            if let Some(parent) = candidate.parent() {
                if parent.is_dir() {
                    return candidate;
                }
            }
        }
        config_dir.join("cookies.txt")
    }

    pub fn load(&self, default_microservice_url: &str) -> AppSettings {
        let mut settings = if let Ok(raw) = fs::read_to_string(&self.settings_path) {
            serde_json::from_str::<AppSettings>(&raw)
                .unwrap_or_else(|_| self.default_settings(default_microservice_url))
        } else {
            self.default_settings(default_microservice_url)
        };

        settings.config_file_path = self.settings_path.to_string_lossy().to_string();
        for entry in &mut settings.recent_workspaces {
            entry.is_available = Path::new(&entry.path).is_dir();
        }
        if settings.cookies_file_path.is_none() && self.cookies_target_path.is_file() {
            settings.cookies_file_path =
                Some(self.cookies_target_path.to_string_lossy().to_string());
        }
        settings
    }

    pub fn save(&self, settings: &AppSettings) -> DomainResult<()> {
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                DomainError::FilesystemError(format!("Failed to create app config dir: {e}"))
            })?;
        }
        let serialized = serde_json::to_string_pretty(settings).map_err(|e| {
            DomainError::PersistenceError(format!("Failed to serialize settings.json: {e}"))
        })?;
        fs::write(&self.settings_path, serialized).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to write settings.json: {e}"))
        })
    }

    pub fn record_workspace_opened(
        &self,
        workspace_path: &Path,
        default_microservice_url: &str,
    ) -> DomainResult<AppSettings> {
        let mut settings = self.load(default_microservice_url);
        let normalized = workspace_path.to_string_lossy().to_string();
        let folder_name = workspace_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| normalized.clone());

        let now = Utc::now().to_rfc3339();

        settings
            .recent_workspaces
            .retain(|item| item.path != normalized);
        settings.recent_workspaces.insert(
            0,
            SavedWorkspaceEntry {
                path: normalized.clone(),
                name: folder_name,
                last_opened_at: now,
                is_available: workspace_path.is_dir(),
            },
        );

        settings.active_workspace = Some(normalized);
        self.save(&settings)?;
        Ok(settings)
    }

    pub fn remove_workspace(
        &self,
        path_to_remove: &str,
        default_microservice_url: &str,
    ) -> DomainResult<AppSettings> {
        let mut settings = self.load(default_microservice_url);
        let trimmed = path_to_remove.trim();
        settings.recent_workspaces.retain(|w| w.path != trimmed);
        if settings.active_workspace.as_deref() == Some(trimmed) {
            settings.active_workspace = settings
                .recent_workspaces
                .first()
                .map(|first| first.path.clone());
        }
        self.save(&settings)?;
        Ok(settings)
    }

    pub fn update_microservice_url(
        &self,
        new_url: &str,
        default_microservice_url: &str,
    ) -> DomainResult<AppSettings> {
        let mut settings = self.load(default_microservice_url);
        settings.microservice_url = new_url.trim().to_string();
        self.save(&settings)?;
        Ok(settings)
    }

    /// Importa un archivo `cookies.txt` seleccionado desde la interfaz de Tauri hacia la ruta compartida con Docker
    /// sin exponer su contenido al frontend y restringiendo sus permisos en el host (SDD 8.1).
    pub fn import_cookies_file(
        &self,
        source_path: &Path,
        default_microservice_url: &str,
    ) -> DomainResult<AppSettings> {
        if !source_path.is_file() {
            return Err(DomainError::ValidationError(format!(
                "Selected cookies file does not exist: {}",
                source_path.display()
            )));
        }

        let content = fs::read_to_string(source_path).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to read cookies file: {e}"))
        })?;

        if content.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "The selected cookies.txt file is empty".to_string(),
            ));
        }

        if let Some(parent) = self.cookies_target_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                DomainError::FilesystemError(format!("Failed to create config directory: {e}"))
            })?;
        }

        fs::write(&self.cookies_target_path, content.as_bytes()).map_err(|e| {
            DomainError::FilesystemError(format!("Failed to save cookies.txt: {e}"))
        })?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ =
                fs::set_permissions(&self.cookies_target_path, fs::Permissions::from_mode(0o600));
        }

        let mut settings = self.load(default_microservice_url);
        settings.cookies_file_path = Some(self.cookies_target_path.to_string_lossy().to_string());
        self.save(&settings)?;
        Ok(settings)
    }

    fn default_settings(&self, default_microservice_url: &str) -> AppSettings {
        AppSettings {
            config_file_path: self.settings_path.to_string_lossy().to_string(),
            active_workspace: None,
            recent_workspaces: Vec::new(),
            microservice_url: default_microservice_url.to_string(),
            cookies_file_path: None,
        }
    }
}

impl Default for AppSettingsStore {
    fn default() -> Self {
        Self::new()
    }
}
