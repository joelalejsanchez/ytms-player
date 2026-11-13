use std::path::PathBuf;
use std::sync::Arc;

use tauri::State;

use crate::application::{
    download_sync_usecases, playlist_usecases, track_usecases, workspace_usecases,
};
use crate::domain::entities::{
    DownloadCommandInput, HealthStatusDto, IntegrityReport, LikeSyncResponseDto,
    MicroserviceDownloadItem, MicroserviceDownloadResponse, NewTrack, Playlist, PlaylistWithTracks,
    Track, WorkspaceInfo,
};
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::{MicroserviceClientPort, TrackRepository};
use crate::infrastructure::go_microservice_client::GoMicroserviceClient;
use crate::infrastructure::sqlite_repository::SqliteWorkspaceStore;
use crate::interfaces::state::{ActiveWorkspaceContext, AppState};

/// Selecciona, inicializa o valida un directorio como Workspace de LocalStream (SDD 3.1 - 3.3).
#[tauri::command]
pub fn select_workspace(path: String, state: State<'_, AppState>) -> DomainResult<WorkspaceInfo> {
    let root_path = PathBuf::from(path.trim());
    let _initial_info = state.workspace_manager.initialize_or_validate(&root_path)?;
    let store = Arc::new(SqliteWorkspaceStore::open(&root_path)?);

    let info = workspace_usecases::initialize_workspace(
        &root_path,
        &state.workspace_manager,
        store.as_ref(),
    )?;

    let mut guard = state
        .workspace
        .write()
        .map_err(|e| DomainError::PersistenceError(format!("Workspace write lock error: {e}")))?;

    *guard = Some(ActiveWorkspaceContext { root_path, store });

    Ok(info)
}

/// Obtiene la información del Workspace actualmente seleccionado, si existe.
#[tauri::command]
pub fn get_workspace_info(state: State<'_, AppState>) -> DomainResult<Option<WorkspaceInfo>> {
    let guard = state
        .workspace
        .read()
        .map_err(|e| DomainError::PersistenceError(format!("Workspace read lock error: {e}")))?;

    let Some(ctx) = guard.as_ref() else {
        return Ok(None);
    };

    let mut info = state
        .workspace_manager
        .initialize_or_validate(&ctx.root_path)?;
    let all_tracks = ctx.store.get_all_tracks()?;
    let missing_tracks = ctx.store.get_missing_tracks()?;

    info.total_tracks = all_tracks.len();
    info.missing_tracks = missing_tracks.len();
    Ok(Some(info))
}

/// Ejecuta la verificación de integridad entre SQLite y los archivos físicos en `/tracks` (SDD 3.5).
#[tauri::command]
pub fn verify_integrity(state: State<'_, AppState>) -> DomainResult<IntegrityReport> {
    let ctx = state.active_workspace()?;
    workspace_usecases::verify_workspace_integrity(
        &ctx.root_path,
        &state.workspace_manager,
        ctx.store.as_ref(),
    )
}

/// Lista todos los tracks del Workspace activo.
#[tauri::command]
pub fn get_tracks(state: State<'_, AppState>) -> DomainResult<Vec<Track>> {
    let ctx = state.active_workspace()?;
    track_usecases::list_all_tracks(ctx.store.as_ref())
}

/// Lista los tracks cuyos archivos físicos están extraviados (`is_missing = 1`, SDD 3.5).
#[tauri::command]
pub fn get_missing_tracks(state: State<'_, AppState>) -> DomainResult<Vec<Track>> {
    let ctx = state.active_workspace()?;
    track_usecases::list_missing_tracks(ctx.store.as_ref())
}

/// Registra o actualiza manualmente un track en SQLite verificando su existencia en disco.
#[tauri::command]
pub fn register_track(input: NewTrack, state: State<'_, AppState>) -> DomainResult<Track> {
    let ctx = state.active_workspace()?;
    track_usecases::register_or_update_track(
        &ctx.root_path,
        input,
        &state.workspace_manager,
        ctx.store.as_ref(),
    )
}

/// Persiste en SQLite un ítem cuya descarga asíncrona por SSE ha concluido.
#[tauri::command]
pub fn confirm_sse_download(
    item: MicroserviceDownloadItem,
    state: State<'_, AppState>,
) -> DomainResult<Track> {
    let ctx = state.active_workspace()?;
    download_sync_usecases::persist_single_downloaded_item(
        &ctx.root_path,
        &item,
        &state.workspace_manager,
        ctx.store.as_ref(),
        ctx.store.as_ref(),
    )
}

/// Cambia el estado de `liked` de un track en la base de datos local.
#[tauri::command]
pub fn toggle_track_like(
    youtube_id: String,
    liked: Option<bool>,
    state: State<'_, AppState>,
) -> DomainResult<Track> {
    let ctx = state.active_workspace()?;
    track_usecases::set_track_like_state(&youtube_id, liked, ctx.store.as_ref())
}

/// Elimina un track de SQLite y opcionalmente sus archivos en `/tracks` y `/thumbnails`.
#[tauri::command]
pub fn delete_track(
    youtube_id: String,
    delete_files: bool,
    state: State<'_, AppState>,
) -> DomainResult<()> {
    let ctx = state.active_workspace()?;
    track_usecases::remove_track(
        &ctx.root_path,
        &youtube_id,
        delete_files,
        &state.workspace_manager,
        ctx.store.as_ref(),
    )
}

/// Recupera un archivo extraviado re-descargándolo o re-validándolo en `/tracks` (SDD 3.5).
#[tauri::command]
pub fn recover_track(youtube_id: String, state: State<'_, AppState>) -> DomainResult<Track> {
    let ctx = state.active_workspace()?;
    let client = state.microservice_client()?;
    download_sync_usecases::recover_missing_track(
        &ctx.root_path,
        &youtube_id,
        &state.workspace_manager,
        ctx.store.as_ref(),
        ctx.store.as_ref(),
        client.as_ref(),
    )
}

/// Crea una nueva playlist en el Workspace activo (SDD 4.2).
#[tauri::command]
pub fn create_playlist(
    title: String,
    youtube_playlist_id: Option<String>,
    state: State<'_, AppState>,
) -> DomainResult<Playlist> {
    let ctx = state.active_workspace()?;
    playlist_usecases::create_playlist(&title, youtube_playlist_id.as_deref(), ctx.store.as_ref())
}

/// Obtiene todas las playlists del Workspace activo.
#[tauri::command]
pub fn get_playlists(state: State<'_, AppState>) -> DomainResult<Vec<Playlist>> {
    let ctx = state.active_workspace()?;
    playlist_usecases::list_playlists(ctx.store.as_ref())
}

/// Obtiene el detalle de una playlist junto con sus tracks asociados (SDD 4.3).
#[tauri::command]
pub fn get_playlist_details(
    playlist_id: i64,
    state: State<'_, AppState>,
) -> DomainResult<PlaylistWithTracks> {
    let ctx = state.active_workspace()?;
    playlist_usecases::get_playlist_with_tracks(playlist_id, ctx.store.as_ref())
}

/// Añade un track a una playlist.
#[tauri::command]
pub fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> DomainResult<()> {
    let ctx = state.active_workspace()?;
    playlist_usecases::add_track_to_playlist(playlist_id, track_id, ctx.store.as_ref())
}

/// Elimina un track de una playlist.
#[tauri::command]
pub fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> DomainResult<()> {
    let ctx = state.active_workspace()?;
    playlist_usecases::remove_track_from_playlist(playlist_id, track_id, ctx.store.as_ref())
}

/// Elimina una playlist completa.
#[tauri::command]
pub fn delete_playlist(playlist_id: i64, state: State<'_, AppState>) -> DomainResult<()> {
    let ctx = state.active_workspace()?;
    playlist_usecases::delete_playlist(playlist_id, ctx.store.as_ref())
}

/// Inicia una descarga de video o playlist delegando en `POST /api/download` del microservicio Go (SDD 6.1).
#[tauri::command]
pub fn start_download(
    input: DownloadCommandInput,
    state: State<'_, AppState>,
) -> DomainResult<MicroserviceDownloadResponse> {
    let ctx = state.active_workspace()?;
    let client = state.microservice_client()?;
    download_sync_usecases::execute_download_and_persist(
        &ctx.root_path,
        &input,
        &state.workspace_manager,
        ctx.store.as_ref(),
        ctx.store.as_ref(),
        client.as_ref(),
    )
}

/// Sincroniza los estados de likes mediante `POST /api/sync-likes` en Go y actualiza SQLite transaccionalmente (SDD 6.3).
#[tauri::command]
pub fn sync_likes(
    youtube_ids: Option<Vec<String>>,
    access_token: Option<String>,
    state: State<'_, AppState>,
) -> DomainResult<LikeSyncResponseDto> {
    let ctx = state.active_workspace()?;
    let client = state.microservice_client()?;
    download_sync_usecases::sync_likes_with_youtube(
        youtube_ids,
        access_token,
        ctx.store.as_ref(),
        client.as_ref(),
    )
}

/// Consulta `GET /api/health` del microservicio Go (SDD 6.4).
#[tauri::command]
pub fn check_microservice_health(state: State<'_, AppState>) -> DomainResult<HealthStatusDto> {
    let client = state.microservice_client()?;
    client.check_health()
}

/// Permite actualizar la URL base del microservicio Go en tiempo de ejecución.
#[tauri::command]
pub fn set_microservice_url(url: String, state: State<'_, AppState>) -> DomainResult<String> {
    let new_client = Arc::new(GoMicroserviceClient::new(&url)?);
    let base = new_client.base_url().to_string();

    let mut guard = state.microservice.write().map_err(|e| {
        DomainError::MicroserviceError(format!("Microservice write lock error: {e}"))
    })?;

    *guard = new_client;
    Ok(base)
}
