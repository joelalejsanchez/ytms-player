use std::path::Path;

use crate::application::track_usecases::register_or_update_track;
use crate::domain::entities::{
    DownloadCommandInput, LikeSyncResponseDto, MicroserviceDownloadItem,
    MicroserviceDownloadRequest, MicroserviceDownloadResponse, NewTrack, Track,
};
use crate::domain::errors::{validate_youtube_id, DomainError, DomainResult};
use crate::domain::ports::{
    MicroserviceClientPort, PlaylistRepository, TrackRepository, WorkspaceManagerPort,
};

/// Orquesta una descarga a través del microservicio Go y persiste automáticamente los metadatos en SQLite (SDD 6.1).
pub fn execute_download_and_persist(
    workspace_path: &Path,
    input: &DownloadCommandInput,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
    playlist_repo: &dyn PlaylistRepository,
    microservice: &dyn MicroserviceClientPort,
) -> DomainResult<MicroserviceDownloadResponse> {
    if input.url.trim().is_empty() {
        return Err(DomainError::ValidationError(
            "YouTube URL cannot be empty".to_string(),
        ));
    }

    let ws_info = workspace_manager.initialize_or_validate(workspace_path)?;
    let format = if input.audio_format.trim().is_empty() {
        "mp3".to_string()
    } else {
        input.audio_format.trim().to_lowercase()
    };

    let req = MicroserviceDownloadRequest {
        url: input.url.trim().to_string(),
        audio_format: format.clone(),
        workspace_path: ws_info.root_path,
        tracks_dir: ws_info.tracks_dir,
        thumbnails_dir: ws_info.thumbnails_dir,
        force_overwrite: input.force_overwrite,
        async_mode: input.async_mode,
    };

    let response = microservice.trigger_download(&req)?;

    if !response.items.is_empty() {
        persist_downloaded_items(
            workspace_path,
            &response,
            input.target_playlist_id,
            input.skip_playlist.unwrap_or(false),
            workspace_manager,
            track_repo,
            playlist_repo,
        )?;
        for item in &response.items {
            if item.status == "skipped" || item.skipped {
                continue;
            }
            let _ = track_repo.record_download_history(
                &response.task_id,
                &input.url,
                &item.youtube_id,
                &item.metadata.title,
                &item.status,
                &item.file_extension,
                item.error.as_deref(),
            );
        }
    } else {
        if response.status != "skipped" {
            let _ = track_repo.record_download_history(
                &response.task_id,
                &input.url,
                &response.youtube_id,
                &response.youtube_id,
                &response.status,
                &format,
                response.message.as_deref(),
            );
        }
    }

    Ok(response)
}

/// Persiste en SQLite un ítem descargado (invocado al completar una descarga síncrona o un evento SSE `completed`).
pub fn persist_single_downloaded_item(
    workspace_path: &Path,
    item: &MicroserviceDownloadItem,
    target_playlist_id: Option<i64>,
    skip_playlist: bool,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<Track> {
    let thumb = if item.thumbnail_path.trim().is_empty() {
        workspace_manager.resolve_thumbnail_path(workspace_path, &item.youtube_id)
    } else {
        Some(item.thumbnail_path.clone())
    };

    let new_track = NewTrack {
        youtube_id: item.youtube_id.clone(),
        title: item.metadata.title.clone(),
        artist: item.metadata.artist.clone(),
        duration: item.metadata.duration,
        published_at: item.metadata.published_at.clone(),
        file_extension: item.file_extension.clone(),
        thumbnail_path: thumb,
        synced: false,
        liked: None,
        is_missing: false,
        file_size: item.file_size,
    };

    let saved_track =
        register_or_update_track(workspace_path, new_track, workspace_manager, track_repo)?;

    if item.status != "skipped" && !item.skipped {
        let _ = track_repo.record_download_history(
            "sse-task",
            "",
            &item.youtube_id,
            &item.metadata.title,
            &item.status,
            &item.file_extension,
            item.error.as_deref(),
        );
    }

    if !skip_playlist {
        if let Some(target_id) = target_playlist_id {
            let _ = playlist_repo.add_track_to_playlist(target_id, saved_track.id);
        } else if let Some(yt_playlist_id) = &item.metadata.playlist_id {
            if !yt_playlist_id.trim().is_empty() {
                let title = item
                    .metadata
                    .playlist_title
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or(yt_playlist_id.as_str());
                let playlist = playlist_repo.create_playlist(title, Some(yt_playlist_id.as_str()))?;
                playlist_repo.add_track_to_playlist(playlist.id, saved_track.id)?;
            }
        }
    }

    Ok(saved_track)
}

fn persist_downloaded_items(
    workspace_path: &Path,
    response: &MicroserviceDownloadResponse,
    target_playlist_id: Option<i64>,
    skip_playlist: bool,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
    playlist_repo: &dyn PlaylistRepository,
) -> DomainResult<Vec<Track>> {
    let maybe_playlist = if skip_playlist {
        None
    } else if let Some(target_id) = target_playlist_id {
        Some(target_id)
    } else if let Some(pl_id) = &response.playlist_id {
        if pl_id.trim().is_empty() {
            None
        } else {
            let title = response
                .playlist_title
                .as_deref()
                .filter(|t| !t.trim().is_empty())
                .unwrap_or(pl_id.as_str());
            Some(playlist_repo.create_playlist(title, Some(pl_id.as_str()))?.id)
        }
    } else {
        None
    };

    let mut saved_tracks = Vec::new();
    for item in &response.items {
        if item.status == "completed" || item.status == "skipped" {
            let track = persist_single_downloaded_item(
                workspace_path,
                item,
                maybe_playlist,
                skip_playlist,
                workspace_manager,
                track_repo,
                playlist_repo,
            )?;
            saved_tracks.push(track);
        }
    }

    Ok(saved_tracks)
}

/// Recupera un archivo extraviado (`is_missing = 1`) re-descargándolo desde `YouTube` y restaurando `is_missing = 0` (SDD 3.5).
pub fn recover_missing_track(
    workspace_path: &Path,
    youtube_id: &str,
    workspace_manager: &dyn WorkspaceManagerPort,
    track_repo: &dyn TrackRepository,
    playlist_repo: &dyn PlaylistRepository,
    microservice: &dyn MicroserviceClientPort,
) -> DomainResult<Track> {
    validate_youtube_id(youtube_id)?;

    let existing = track_repo
        .get_track_by_youtube_id(youtube_id)?
        .ok_or_else(|| DomainError::TrackNotFound(youtube_id.to_string()))?;

    // Primero verificar si el archivo ya volvió a colocarse manualmente en /tracks
    let (exists, size, _path) = workspace_manager.track_file_status(
        workspace_path,
        &existing.youtube_id,
        &existing.file_extension,
    );
    if exists && size > 0 {
        track_repo.update_missing_status(youtube_id, false, Some(size))?;
        return track_repo
            .get_track_by_youtube_id(youtube_id)?
            .ok_or_else(|| DomainError::TrackNotFound(youtube_id.to_string()));
    }

    let input = DownloadCommandInput {
        url: format!("https://www.youtube.com/watch?v={youtube_id}"),
        audio_format: existing.file_extension,
        force_overwrite: true,
        async_mode: false,
        target_playlist_id: None,
        skip_playlist: None,
    };

    execute_download_and_persist(
        workspace_path,
        &input,
        workspace_manager,
        track_repo,
        playlist_repo,
        microservice,
    )?;

    track_repo
        .get_track_by_youtube_id(youtube_id)?
        .ok_or_else(|| DomainError::TrackNotFound(youtube_id.to_string()))
}

/// Sincroniza el estado de likes con el microservicio Go y actualiza SQLite mediante transacciones (SDD 6.3).
pub fn sync_likes_with_youtube(
    youtube_ids: Option<Vec<String>>,
    access_token: Option<String>,
    track_repo: &dyn TrackRepository,
    microservice: &dyn MicroserviceClientPort,
) -> DomainResult<LikeSyncResponseDto> {
    let target_ids: Vec<String> = match youtube_ids {
        Some(ids) if !ids.is_empty() => ids,
        _ => track_repo
            .get_all_tracks()?
            .into_iter()
            .map(|t| t.youtube_id)
            .collect(),
    };

    if target_ids.is_empty() {
        return Ok(LikeSyncResponseDto {
            results: Vec::new(),
            total_processed: 0,
            synced_count: 0,
        });
    }

    let response = microservice.sync_likes(&target_ids, access_token.as_deref())?;
    track_repo.apply_synced_likes(&response.results)?;

    Ok(response)
}
