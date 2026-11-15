#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interfaces;

use interfaces::commands::{
    add_track_to_playlist, adopt_orphan_file, check_microservice_health, clear_download_history, confirm_sse_download,
    create_playlist, delete_orphan_file, delete_playlist, delete_track, get_app_settings,
    get_download_history, get_missing_tracks, get_oauth_status, get_playlist_details, get_playlists,
    get_tracks, get_workspace_info, import_cookies_file, logout_oauth, open_oauth_login,
    preview_playlist_url, rate_video, read_audio_data_url, recover_track, refresh_track_metadata,
    register_track, remove_saved_workspace, remove_track_from_playlist, select_workspace,
    set_microservice_url, set_preferred_audio_format, start_download, sync_likes,
    sync_playlist_tracks, toggle_track_like, verify_integrity,
};
use interfaces::state::AppState;

fn main() {
    let default_go_url =
        std::env::var("YTMS_PLAYER_GO_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".to_string());

    let app_state =
        AppState::new(&default_go_url).expect("Failed to initialize ytms-player application state");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            select_workspace,
            get_workspace_info,
            verify_integrity,
            get_tracks,
            get_missing_tracks,
            register_track,
            confirm_sse_download,
            toggle_track_like,
            delete_track,
            recover_track,
            create_playlist,
            get_playlists,
            get_playlist_details,
            add_track_to_playlist,
            remove_track_from_playlist,
            delete_playlist,
            start_download,
            sync_likes,
            check_microservice_health,
            set_microservice_url,
            get_app_settings,
            remove_saved_workspace,
            import_cookies_file,
            get_oauth_status,
            open_oauth_login,
            read_audio_data_url,
            get_download_history,
            clear_download_history,
            set_preferred_audio_format,
            adopt_orphan_file,
            delete_orphan_file,
            preview_playlist_url,
            sync_playlist_tracks,
            logout_oauth,
            rate_video,
            refresh_track_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running ytms-player Tauri application");
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use crate::application::{playlist_usecases, track_usecases, workspace_usecases};
    use crate::domain::entities::{LikeSyncItemDto, NewTrack};
    use crate::domain::ports::{TrackRepository, WorkspaceManagerPort};
    use crate::infrastructure::sqlite_repository::SqliteWorkspaceStore;
    use crate::infrastructure::workspace_fs::LocalWorkspaceManager;

    fn temp_workspace_dir(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("ytms-player-test-{label}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp workspace");
        dir
    }

    #[test]
    fn test_workspace_initialization_and_control_file() {
        let ws_dir = temp_workspace_dir("init");
        let manager = LocalWorkspaceManager::new();
        let store = SqliteWorkspaceStore::open_in_memory(&ws_dir).expect("open sqlite");

        let info = workspace_usecases::initialize_workspace(&ws_dir, &manager, &store)
            .expect("initialize workspace");

        assert!(info.is_valid);
        assert!(ws_dir.join(".ytms-player-workspace").is_file());
        assert!(ws_dir.join("tracks").is_dir());
        assert!(ws_dir.join("thumbnails").is_dir());

        let _ = fs::remove_dir_all(&ws_dir);
    }

    #[test]
    fn test_track_deduplication_and_missing_integrity() {
        let ws_dir = temp_workspace_dir("integrity");
        let manager = LocalWorkspaceManager::new();
        manager
            .initialize_or_validate(&ws_dir)
            .expect("init workspace");
        let store = SqliteWorkspaceStore::open_in_memory(&ws_dir).expect("open sqlite");

        let audio_file = ws_dir.join("tracks").join("dQw4w9WgXcQ.mp3");
        fs::write(&audio_file, b"mp3-binary-content").expect("write audio file");

        let input = NewTrack {
            youtube_id: "dQw4w9WgXcQ".to_string(),
            title: "Never Gonna Give You Up".to_string(),
            artist: "Rick Astley".to_string(),
            duration: 213,
            published_at: Some("2009-10-25".to_string()),
            file_extension: "mp3".to_string(),
            thumbnail_path: None,
            synced: false,
            liked: None,
            is_missing: false,
            file_size: 0,
        };

        let created =
            track_usecases::register_or_update_track(&ws_dir, input.clone(), &manager, &store)
                .expect("register track");
        assert!(!created.is_missing);
        assert_eq!(created.file_size, 18);

        // Upsert repetido con el mismo youtube_id no debe duplicar registros (SDD 4.4)
        let _updated = track_usecases::register_or_update_track(&ws_dir, input, &manager, &store)
            .expect("upsert duplicate");
        let all = store.get_all_tracks().expect("get all tracks");
        assert_eq!(all.len(), 1);

        // Eliminar el archivo físico y verificar que is_missing pase a 1 (SDD 3.5)
        fs::remove_file(&audio_file).expect("remove audio file");
        let report_missing =
            workspace_usecases::verify_workspace_integrity(&ws_dir, &manager, &store)
                .expect("verify integrity missing");
        assert_eq!(report_missing.newly_missing_ids, vec!["dQw4w9WgXcQ"]);
        assert_eq!(report_missing.missing_tracks.len(), 1);

        // Restaurar el archivo físico y verificar que is_missing vuelva a 0 (SDD 3.5)
        fs::write(&audio_file, b"restored-mp3-content").expect("restore audio file");
        let report_restored =
            workspace_usecases::verify_workspace_integrity(&ws_dir, &manager, &store)
                .expect("verify integrity restored");
        assert_eq!(report_restored.restored_ids, vec!["dQw4w9WgXcQ"]);
        assert!(report_restored.missing_tracks.is_empty());

        let _ = fs::remove_dir_all(&ws_dir);
    }

    #[test]
    fn test_playlists_and_likes_sync_transactions() {
        let ws_dir = temp_workspace_dir("playlists");
        let store = SqliteWorkspaceStore::open_in_memory(&ws_dir).expect("open sqlite");

        let track = store
            .upsert_track(&NewTrack {
                youtube_id: "abc123xyz89".to_string(),
                title: "Test Song".to_string(),
                artist: "Test Artist".to_string(),
                duration: 180,
                published_at: None,
                file_extension: "m4a".to_string(),
                thumbnail_path: None,
                synced: false,
                liked: None,
                is_missing: false,
                file_size: 1024,
            })
            .expect("insert track");

        let playlist = playlist_usecases::create_playlist("Favorites", Some("PL_FAV_01"), &store)
            .expect("create playlist");
        playlist_usecases::add_track_to_playlist(playlist.id, track.id, &store)
            .expect("add track to playlist");

        let details = playlist_usecases::get_playlist_with_tracks(playlist.id, &store)
            .expect("get playlist details");
        assert_eq!(details.tracks.len(), 1);
        assert_eq!(details.tracks[0].youtube_id, "abc123xyz89");

        // Sincronizar likes por lote
        let updated = store
            .apply_synced_likes(&[LikeSyncItemDto {
                youtube_id: "abc123xyz89".to_string(),
                liked: true,
                synced: true,
                synced_at: "2026-11-13T10:00:00Z".to_string(),
            }])
            .expect("apply synced likes");
        assert_eq!(updated, 1);

        let synced_track = store
            .get_track_by_youtube_id("abc123xyz89")
            .expect("fetch track")
            .expect("track exists");
        assert_eq!(synced_track.liked, Some(true));
        assert!(synced_track.synced);

        // Prueba de sincronización masiva y desvinculación sin N+1
        let _track2 = store
            .upsert_track(&NewTrack {
                youtube_id: "def456uvw12".to_string(),
                title: "Second Song".to_string(),
                artist: "Second Artist".to_string(),
                duration: 200,
                published_at: None,
                file_extension: "mp3".to_string(),
                thumbnail_path: None,
                synced: false,
                liked: None,
                is_missing: false,
                file_size: 2048,
            })
            .expect("insert second track");

        // Vincular track2 y desvincular track1 si no está en la lista remota
        let current_yt_ids = vec!["def456uvw12".to_string()];
        let synced_count = playlist_usecases::sync_playlist_tracks(
            playlist.id,
            &current_yt_ids,
            true,
            &store,
        )
        .expect("sync playlist tracks");
        assert_eq!(synced_count, 1);

        let updated_details = playlist_usecases::get_playlist_with_tracks(playlist.id, &store)
            .expect("get updated playlist details");
        assert_eq!(updated_details.tracks.len(), 1);
        assert_eq!(updated_details.tracks[0].youtube_id, "def456uvw12");

        // El track1 debe seguir existiendo en la biblioteca local aunque se haya desvinculado de la playlist
        assert!(store.get_track_by_youtube_id("abc123xyz89").expect("fetch").is_some());

        let _ = fs::remove_dir_all(&ws_dir);
    }
}
