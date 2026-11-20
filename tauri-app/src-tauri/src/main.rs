#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interfaces;

use infrastructure::audio_streaming_server::AudioStreamingServer;
use interfaces::commands::{
    add_track_to_playlist, adopt_orphan_file, append_log_entry, check_microservice_health,
    clear_download_history, clear_log_file, confirm_sse_download, create_playlist,
    delete_orphan_file, delete_playlist, delete_track, get_app_settings, get_audio_stream_url,
    get_download_history, get_missing_tracks, get_oauth_status, get_playlist_details,
    get_playlist_track_map, get_playlists, get_tracks, get_workspace_info, import_cookies_file,
    logout_oauth, open_external_url, open_logs_folder, open_oauth_login, preview_playlist_url, rate_video,
    read_audio_data_url, recover_track, refresh_track_metadata, register_track,
    remove_saved_workspace, remove_track_from_playlist, search_youtube_tracks, select_workspace,
    set_microservice_url, set_preferred_audio_format, start_download, sync_likes,
    sync_playlist_tracks, toggle_track_like, verify_integrity,
};
use interfaces::state::AppState;

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Previene el interbloqueo de WebKitGTK 2.42+ en compositores acelerados por hardware en Wayland/Mesa
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }

        // Permite que WebKitGTK y GStreamer ubiquen los códecs y sumideros de audio (appsink, autoaudiosink)
        // del sistema anfitrión cuando la aplicación se ejecuta empaquetada como AppImage
        if std::env::var("APPIMAGE").is_ok() || std::env::var("APPDIR").is_ok() {
            let host_gst_paths = "/usr/lib/gstreamer-1.0:/usr/lib64/gstreamer-1.0:/usr/lib/x86_64-linux-gnu/gstreamer-1.0";

            // AppRun de linuxdeploy predefine GST_PLUGIN_SYSTEM_PATH_1_0 apuntando al AppDir interno (vacío de plugins).
            // Concatenamos las rutas del sistema anfitrión para que GStreamer encuentre los plugins del host.
            let plugin_path = match std::env::var("GST_PLUGIN_SYSTEM_PATH_1_0") {
                Ok(existing) if !existing.trim().is_empty() => {
                    format!("{}:{}", existing, host_gst_paths)
                }
                _ => host_gst_paths.to_string(),
            };
            std::env::set_var("GST_PLUGIN_SYSTEM_PATH_1_0", &plugin_path);
            std::env::set_var("GST_PLUGIN_SYSTEM_PATH", &plugin_path);

            let extra_plugin_path = match std::env::var("GST_PLUGIN_PATH_1_0") {
                Ok(existing) if !existing.trim().is_empty() => {
                    format!("{}:{}", existing, host_gst_paths)
                }
                _ => host_gst_paths.to_string(),
            };
            std::env::set_var("GST_PLUGIN_PATH_1_0", &extra_plugin_path);
            std::env::set_var("GST_PLUGIN_PATH", &extra_plugin_path);

            // Ubicar gst-plugin-scanner en el host para permitir el descubrimiento dinámico de códecs
            let scanner_candidates = [
                "/usr/lib/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/gst-plugin-scanner",
                "/usr/libexec/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib64/gstreamer-1.0/gst-plugin-scanner",
            ];
            for scanner in scanner_candidates {
                if std::path::Path::new(scanner).exists() {
                    std::env::set_var("GST_PLUGIN_SCANNER_1_0", scanner);
                    std::env::set_var("GST_PLUGIN_SCANNER", scanner);
                    break;
                }
            }
        }
    }

    let (server, std_listener) =
        AudioStreamingServer::bind().expect("Failed to bind native audio streaming server");
    let audio_server_port = server.port();

    let default_go_url =
        std::env::var("YTMS_PLAYER_GO_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".to_string());

    let app_state = AppState::new(&default_go_url, audio_server_port)
        .expect("Failed to initialize ytms-player application state");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |_app| {
            tauri::async_runtime::spawn(async move {
                AudioStreamingServer::run(std_listener).await;
            });
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_audio_stream_url,
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
            get_playlist_track_map,
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
            open_external_url,
            read_audio_data_url,
            get_download_history,
            clear_download_history,
            set_preferred_audio_format,
            adopt_orphan_file,
            delete_orphan_file,
            preview_playlist_url,
            sync_playlist_tracks,
            search_youtube_tracks,
            logout_oauth,
            rate_video,
            refresh_track_metadata,
            append_log_entry,
            clear_log_file,
            open_logs_folder,
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
        assert!(ws_dir.join("logs").is_dir());
        assert_eq!(info.logs_dir, ws_dir.join("logs").to_string_lossy());

        let _ = fs::remove_dir_all(&ws_dir);
    }


    #[test]
    fn test_workspace_log_file_append_and_rotation() {
        let ws_dir = temp_workspace_dir("logs");
        let manager = LocalWorkspaceManager::new();
        manager
            .initialize_or_validate(&ws_dir)
            .expect("init workspace");

        let log_file = ws_dir.join("logs").join("app.log");
        let old_file = ws_dir.join("logs").join("app.log.old");

        // 1. Escribir entrada de log
        manager
            .append_log_entry(
                &ws_dir,
                "[2026-11-16 12:00:00] [ERROR] [toast] Sample error",
            )
            .expect("append log");
        assert!(log_file.is_file());

        let content = fs::read_to_string(&log_file).expect("read log");
        assert!(content.contains("Sample error"));

        // 2. Simular rotación creando un archivo que supere el límite
        let huge_line = "A".repeat(1024 * 1024 + 10);
        manager
            .append_log_entry(&ws_dir, &huge_line)
            .expect("append huge line");

        // Tras superar el tamaño, el archivo anterior debió rotar a app.log.old
        assert!(old_file.is_file());
        assert!(log_file.is_file());

        // 3. Limpiar logs
        manager.clear_log_file(&ws_dir).expect("clear logs");
        assert!(!log_file.exists());
        assert!(!old_file.exists());

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
            origin: "youtube".to_string(),
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
                origin: "youtube".to_string(),
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
                origin: "youtube".to_string(),
            })
            .expect("insert second track");

        // Vincular track2 y desvincular track1 si no está en la lista remota
        let current_yt_ids = vec!["def456uvw12".to_string()];
        let synced_count =
            playlist_usecases::sync_playlist_tracks(playlist.id, &current_yt_ids, true, &store)
                .expect("sync playlist tracks");
        assert_eq!(synced_count, 1);

        let updated_details = playlist_usecases::get_playlist_with_tracks(playlist.id, &store)
            .expect("get updated playlist details");
        assert_eq!(updated_details.tracks.len(), 1);
        assert_eq!(updated_details.tracks[0].youtube_id, "def456uvw12");

        // El track1 debe seguir existiendo en la biblioteca local aunque se haya desvinculado de la playlist
        assert!(store
            .get_track_by_youtube_id("abc123xyz89")
            .expect("fetch")
            .is_some());

        let _ = fs::remove_dir_all(&ws_dir);
    }


    #[test]
    fn test_dynamic_playlist_covers_lifecycle() {
        let ws_dir = temp_workspace_dir("playlist-covers");
        let store = SqliteWorkspaceStore::open_in_memory(&ws_dir).expect("open sqlite");

        let t1 = store
            .upsert_track(&NewTrack {
                youtube_id: "yt_track_01".to_string(),
                title: "Track 1".to_string(),
                artist: "Artist 1".to_string(),
                duration: 180,
                published_at: None,
                file_extension: "mp3".to_string(),
                thumbnail_path: Some("/thumbnails/yt_track_01.jpg".to_string()),
                synced: false,
                liked: None,
                is_missing: false,
                file_size: 1000,
                origin: "youtube".to_string(),
            })
            .expect("insert t1");

        let t2 = store
            .upsert_track(&NewTrack {
                youtube_id: "yt_track_02".to_string(),
                title: "Track 2".to_string(),
                artist: "Artist 2".to_string(),
                duration: 200,
                published_at: None,
                file_extension: "mp3".to_string(),
                thumbnail_path: Some("/thumbnails/yt_track_02.jpg".to_string()),
                synced: false,
                liked: None,
                is_missing: false,
                file_size: 2000,
                origin: "youtube".to_string(),
            })
            .expect("insert t2");

        // 1. Crear playlist: inicialmente sin portada
        let pl = playlist_usecases::create_playlist("Mi Playlist Dinámica", None, &store)
            .expect("create playlist");
        assert_eq!(pl.cover_path, None);

        // 2. Insertar primera canción: la portada se asigna con la miniatura de la 1ra canción
        playlist_usecases::add_track_to_playlist(pl.id, t1.id, &store).expect("add t1");
        let pl_after_t1 = playlist_usecases::get_playlist_with_tracks(pl.id, &store)
            .expect("get pl details")
            .playlist;
        assert_eq!(
            pl_after_t1.cover_path,
            Some("/thumbnails/yt_track_01.jpg".to_string())
        );

        // 3. Insertar segunda canción: la portada se preserva con la de la 1ra canción
        playlist_usecases::add_track_to_playlist(pl.id, t2.id, &store).expect("add t2");
        let pl_after_t2 = playlist_usecases::get_playlist_with_tracks(pl.id, &store)
            .expect("get pl details")
            .playlist;
        assert_eq!(
            pl_after_t2.cover_path,
            Some("/thumbnails/yt_track_01.jpg".to_string())
        );

        // 4. Remover la segunda canción (no es la portada activa): la portada no cambia
        playlist_usecases::remove_track_from_playlist(pl.id, t2.id, &store).expect("remove t2");
        let pl_after_rem_t2 = playlist_usecases::get_playlist_with_tracks(pl.id, &store)
            .expect("get pl details")
            .playlist;
        assert_eq!(
            pl_after_rem_t2.cover_path,
            Some("/thumbnails/yt_track_01.jpg".to_string())
        );

        // 5. Re-agregar t2 y luego remover t1 (que es la portada activa): debe reasignar a t2
        playlist_usecases::add_track_to_playlist(pl.id, t2.id, &store).expect("re-add t2");
        playlist_usecases::remove_track_from_playlist(pl.id, t1.id, &store).expect("remove t1");
        let pl_after_rem_t1 = playlist_usecases::get_playlist_with_tracks(pl.id, &store)
            .expect("get pl details")
            .playlist;
        assert_eq!(
            pl_after_rem_t1.cover_path,
            Some("/thumbnails/yt_track_02.jpg".to_string())
        );

        // 6. Remover la última canción: debe restaurar a None (carátula genérica)
        playlist_usecases::remove_track_from_playlist(pl.id, t2.id, &store)
            .expect("remove t2 again");
        let pl_empty = playlist_usecases::get_playlist_with_tracks(pl.id, &store)
            .expect("get pl details")
            .playlist;
        assert_eq!(pl_empty.cover_path, None);

        let _ = fs::remove_dir_all(&ws_dir);
    }

    #[test]
    fn test_origin_discrimination_and_likes_sync_exclusion() {
        use std::sync::Mutex;
        use crate::application::download_sync_usecases;
        use crate::domain::entities::{HealthStatusDto, LikeSyncResponseDto, MicroserviceDownloadRequest, MicroserviceDownloadResponse, OAuthStatusDto, PlaylistPreviewDto, SearchResultItemDto};
        use crate::domain::errors::DomainResult;
        use crate::domain::ports::MicroserviceClientPort;

        struct MockLikesClient {
            sent_ids: Mutex<Vec<String>>,
        }

        impl MicroserviceClientPort for MockLikesClient {
            fn trigger_download(&self, _: &MicroserviceDownloadRequest) -> DomainResult<MicroserviceDownloadResponse> {
                unimplemented!()
            }
            fn sync_likes(&self, ids: &[String], _: Option<&str>) -> DomainResult<LikeSyncResponseDto> {
                let mut guard = self.sent_ids.lock().unwrap();
                guard.extend(ids.iter().cloned());
                Ok(LikeSyncResponseDto {
                    results: ids.iter().map(|id| LikeSyncItemDto {
                        youtube_id: id.clone(),
                        liked: true,
                        synced: true,
                        synced_at: "2026-11-20T00:00:00Z".to_string(),
                    }).collect(),
                    total_processed: ids.len(),
                    synced_count: ids.len(),
                })
            }
            fn check_health(&self) -> DomainResult<HealthStatusDto> { unimplemented!() }
            fn get_oauth_status(&self) -> DomainResult<OAuthStatusDto> { unimplemented!() }
            fn logout_oauth(&self) -> DomainResult<()> { unimplemented!() }
            fn rate_video(&self, _: &str, _: &str) -> DomainResult<()> { unimplemented!() }
            fn preview_url(&self, _: &str, _: Option<u32>, _: Option<u32>) -> DomainResult<PlaylistPreviewDto> { unimplemented!() }
            fn search_tracks(&self, _: &str) -> DomainResult<Vec<SearchResultItemDto>> { Ok(Vec::new()) }
        }

        let ws_dir = temp_workspace_dir("origin-test");
        let store = SqliteWorkspaceStore::open_in_memory(&ws_dir).expect("open sqlite");

        // 1. Insertar track proveniente de YouTube
        let yt_track = store
            .upsert_track(&NewTrack {
                youtube_id: "dQw4w9WgXcQ".to_string(),
                title: "YouTube Video".to_string(),
                artist: "Rick Astley".to_string(),
                duration: 213,
                published_at: None,
                file_extension: "mp3".to_string(),
                thumbnail_path: None,
                synced: false,
                liked: None,
                is_missing: false,
                file_size: 1000,
                origin: "youtube".to_string(),
            })
            .expect("insert youtube track");
        assert_eq!(yt_track.origin, "youtube");

        // 2. Insertar track local
        let local_track = store
            .upsert_track(&NewTrack {
                youtube_id: "my_local_track_file".to_string(),
                title: "Local Track".to_string(),
                artist: "Local Artist".to_string(),
                duration: 150,
                published_at: None,
                file_extension: "mp3".to_string(),
                thumbnail_path: None,
                synced: false,
                liked: None,
                is_missing: false,
                file_size: 2000,
                origin: "local".to_string(),
            })
            .expect("insert local track");
        assert_eq!(local_track.origin, "local");

        // 3. Ejecutar sincronización de likes
        let mock_client = MockLikesClient {
            sent_ids: Mutex::new(Vec::new()),
        };
        let sync_resp = download_sync_usecases::sync_likes_with_youtube(
            None,
            Some("fake_token".to_string()),
            &store,
            &mock_client,
        )
        .expect("sync likes");

        // 4. Comprobar que únicamente se envió el identificador de YouTube al microservicio
        let sent = mock_client.sent_ids.lock().unwrap().clone();
        assert_eq!(sent, vec!["dQw4w9WgXcQ"]);
        assert_eq!(sync_resp.total_processed, 1);

        // 5. Comprobar que el track local no fue alterado por la sincronización de YouTube
        let fetched_local = store
            .get_track_by_youtube_id("my_local_track_file")
            .expect("get local")
            .expect("exists");
        assert_eq!(fetched_local.liked, None);
        assert!(!fetched_local.synced);

        let _ = fs::remove_dir_all(&ws_dir);
    }
}
