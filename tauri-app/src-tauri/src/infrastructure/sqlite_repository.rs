use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::entities::{LikeSyncItemDto, NewTrack, Playlist, PlaylistWithTracks, Track};
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::{PlaylistRepository, TrackRepository};

const SCHEMA_SQL: &str = r"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    published_at DATETIME NULL,
    file_extension TEXT NOT NULL,
    thumbnail_path TEXT NULL,
    synced BOOLEAN DEFAULT 0,
    liked BOOLEAN NULL,
    is_missing BOOLEAN DEFAULT 0,
    file_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    youtube_playlist_id TEXT UNIQUE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    FOREIGN KEY (playlist_id)
        REFERENCES playlists(id)
        ON DELETE CASCADE,
    FOREIGN KEY (track_id)
        REFERENCES tracks(id)
        ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_youtube_id ON tracks(youtube_id);
CREATE INDEX IF NOT EXISTS idx_tracks_is_missing ON tracks(is_missing);

CREATE TABLE IF NOT EXISTS download_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    url TEXT NOT NULL,
    youtube_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    audio_format TEXT NOT NULL,
    error_message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_download_history_created_at ON download_history(created_at);
";

/// Repositorio SQLite independiente por Workspace con `PRAGMA foreign_keys = ON` y transacciones ACID (SDD Sección 4).
pub struct SqliteWorkspaceStore {
    workspace_root: PathBuf,
    conn: Mutex<Connection>,
}

impl SqliteWorkspaceStore {
    /// Abre o inicializa la base de datos SQLite en `<workspace_root>/ytms-player.db`.
    pub fn open(workspace_root: &Path) -> DomainResult<Self> {
        let db_path = workspace_root.join("ytms-player.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| DomainError::PersistenceError(format!("Failed to open SQLite: {e}")))?;

        Self::init_connection(workspace_root.to_path_buf(), conn)
    }

    /// Crea un almacén SQLite en memoria para pruebas unitarias automatizadas.
    pub fn open_in_memory(workspace_root: &Path) -> DomainResult<Self> {
        let conn = Connection::open_in_memory().map_err(|e| {
            DomainError::PersistenceError(format!("Failed to open in-memory SQLite: {e}"))
        })?;

        Self::init_connection(workspace_root.to_path_buf(), conn)
    }

    fn init_connection(workspace_root: PathBuf, conn: Connection) -> DomainResult<Self> {
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .map_err(|e| DomainError::PersistenceError(format!("Failed to set PRAGMAs: {e}")))?;

        conn.execute_batch(SCHEMA_SQL).map_err(|e| {
            DomainError::PersistenceError(format!("Failed to initialize SQLite schema: {e}"))
        })?;

        Ok(Self {
            workspace_root,
            conn: Mutex::new(conn),
        })
    }

    fn map_row_to_track(&self, row: &rusqlite::Row<'_>) -> rusqlite::Result<Track> {
        let youtube_id: String = row.get(1)?;
        let file_extension: String = row.get(6)?;
        let audio_path = self
            .workspace_root
            .join("tracks")
            .join(format!("{youtube_id}.{file_extension}"))
            .to_string_lossy()
            .to_string();

        Ok(Track {
            id: row.get(0)?,
            youtube_id,
            title: row.get(2)?,
            artist: row.get(3)?,
            duration: row.get(4)?,
            published_at: row.get(5)?,
            file_extension,
            thumbnail_path: row.get(7)?,
            audio_path,
            synced: row.get(8)?,
            liked: row.get(9)?,
            is_missing: row.get(10)?,
            file_size: row.get(11)?,
            created_at: row.get(12)?,
        })
    }
}

impl TrackRepository for SqliteWorkspaceStore {
    fn upsert_track(&self, track: &NewTrack) -> DomainResult<Track> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        tx.execute(
            r"
            INSERT INTO tracks (
                youtube_id, title, artist, duration, published_at,
                file_extension, thumbnail_path, synced, liked, is_missing, file_size
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(youtube_id) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE tracks.duration END,
                published_at = COALESCE(excluded.published_at, tracks.published_at),
                file_extension = excluded.file_extension,
                thumbnail_path = COALESCE(excluded.thumbnail_path, tracks.thumbnail_path),
                is_missing = excluded.is_missing,
                file_size = CASE WHEN excluded.file_size > 0 THEN excluded.file_size ELSE tracks.file_size END
            ",
            params![
                track.youtube_id,
                track.title,
                track.artist,
                track.duration,
                track.published_at,
                track.file_extension,
                track.thumbnail_path,
                track.synced,
                track.liked,
                track.is_missing,
                track.file_size,
            ],
        )
        .map_err(|e| DomainError::PersistenceError(format!("Failed to upsert track: {e}")))?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))?;

        drop(conn);

        self.get_track_by_youtube_id(&track.youtube_id)?
            .ok_or_else(|| DomainError::TrackNotFound(track.youtube_id.clone()))
    }

    fn get_all_tracks(&self) -> DomainResult<Vec<Track>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let mut stmt = conn
            .prepare(
                r"
                SELECT id, youtube_id, title, artist, duration, published_at,
                       file_extension, thumbnail_path, synced, liked, is_missing,
                       file_size, created_at
                FROM tracks
                ORDER BY created_at DESC, id DESC
                ",
            )
            .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

        let rows = stmt
            .query_map([], |row| self.map_row_to_track(row))
            .map_err(|e| DomainError::PersistenceError(format!("Query tracks failed: {e}")))?;

        let mut tracks = Vec::new();
        for item in rows {
            tracks.push(
                item.map_err(|e| DomainError::PersistenceError(format!("Row parse error: {e}")))?,
            );
        }
        Ok(tracks)
    }

    fn get_track_by_youtube_id(&self, youtube_id: &str) -> DomainResult<Option<Track>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let mut stmt = conn
            .prepare(
                r"
                SELECT id, youtube_id, title, artist, duration, published_at,
                       file_extension, thumbnail_path, synced, liked, is_missing,
                       file_size, created_at
                FROM tracks
                WHERE youtube_id = ?1
                ",
            )
            .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

        stmt.query_row(params![youtube_id], |row| self.map_row_to_track(row))
            .optional()
            .map_err(|e| DomainError::PersistenceError(format!("Query track failed: {e}")))
    }

    fn get_missing_tracks(&self) -> DomainResult<Vec<Track>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let mut stmt = conn
            .prepare(
                r"
                SELECT id, youtube_id, title, artist, duration, published_at,
                       file_extension, thumbnail_path, synced, liked, is_missing,
                       file_size, created_at
                FROM tracks
                WHERE is_missing = 1
                ORDER BY created_at DESC, id DESC
                ",
            )
            .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

        let rows = stmt
            .query_map([], |row| self.map_row_to_track(row))
            .map_err(|e| {
                DomainError::PersistenceError(format!("Query missing tracks failed: {e}"))
            })?;

        let mut tracks = Vec::new();
        for item in rows {
            tracks.push(
                item.map_err(|e| DomainError::PersistenceError(format!("Row parse error: {e}")))?,
            );
        }
        Ok(tracks)
    }

    fn update_missing_status(
        &self,
        youtube_id: &str,
        is_missing: bool,
        file_size: Option<i64>,
    ) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        if let Some(size) = file_size {
            tx.execute(
                "UPDATE tracks SET is_missing = ?1, file_size = ?2 WHERE youtube_id = ?3",
                params![is_missing, size, youtube_id],
            )
        } else {
            tx.execute(
                "UPDATE tracks SET is_missing = ?1 WHERE youtube_id = ?2",
                params![is_missing, youtube_id],
            )
        }
        .map_err(|e| {
            DomainError::PersistenceError(format!("Failed to update is_missing status: {e}"))
        })?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }

    fn update_missing_status_batch(&self, updates: &[(String, bool, i64)]) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        {
            let mut stmt = tx
                .prepare("UPDATE tracks SET is_missing = ?1, file_size = ?2 WHERE youtube_id = ?3")
                .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

            for (youtube_id, is_missing, file_size) in updates {
                stmt.execute(params![is_missing, file_size, youtube_id])
                    .map_err(|e| {
                        DomainError::PersistenceError(format!(
                            "Batch update is_missing failed: {e}"
                        ))
                    })?;
            }
        }

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }

    fn set_track_liked(
        &self,
        youtube_id: &str,
        liked: Option<bool>,
        synced: bool,
    ) -> DomainResult<Track> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        let affected = tx
            .execute(
                "UPDATE tracks SET liked = ?1, synced = ?2 WHERE youtube_id = ?3",
                params![liked, synced, youtube_id],
            )
            .map_err(|e| DomainError::PersistenceError(format!("Update liked failed: {e}")))?;

        if affected == 0 {
            return Err(DomainError::TrackNotFound(youtube_id.to_string()));
        }

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))?;

        drop(conn);

        self.get_track_by_youtube_id(youtube_id)?
            .ok_or_else(|| DomainError::TrackNotFound(youtube_id.to_string()))
    }

    fn apply_synced_likes(&self, items: &[LikeSyncItemDto]) -> DomainResult<usize> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        let mut updated_count = 0usize;
        {
            let mut stmt = tx
                .prepare("UPDATE tracks SET liked = ?1, synced = 1 WHERE youtube_id = ?2")
                .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

            for item in items {
                let count = stmt
                    .execute(params![item.liked, item.youtube_id])
                    .map_err(|e| {
                        DomainError::PersistenceError(format!("Sync likes update failed: {e}"))
                    })?;
                updated_count += count;
            }
        }

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))?;

        Ok(updated_count)
    }

    fn delete_track(&self, youtube_id: &str) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        tx.execute(
            "DELETE FROM tracks WHERE youtube_id = ?1",
            params![youtube_id],
        )
        .map_err(|e| DomainError::PersistenceError(format!("Delete track failed: {e}")))?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }

    fn record_download_history(
        &self,
        task_id: &str,
        url: &str,
        youtube_id: &str,
        title: &str,
        status: &str,
        format: &str,
        error: Option<&str>,
    ) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        tx.execute(
            r"
            INSERT INTO download_history (task_id, url, youtube_id, title, status, audio_format, error_message)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ",
            params![task_id, url, youtube_id, title, status, format, error],
        )
        .map_err(|e| DomainError::PersistenceError(format!("Insert download history failed: {e}")))?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }

    fn get_download_history(&self, limit: usize) -> DomainResult<Vec<crate::domain::entities::DownloadHistoryEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let mut stmt = conn
            .prepare(
                r"
                SELECT id, task_id, url, youtube_id, title, status, audio_format, error_message, created_at
                FROM download_history
                ORDER BY id DESC
                LIMIT ?1
                ",
            )
            .map_err(|e| DomainError::PersistenceError(format!("Prepare history failed: {e}")))?;

        let rows = stmt
            .query_map(params![limit as i64], |row| {
                Ok(crate::domain::entities::DownloadHistoryEntry {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    url: row.get(2)?,
                    youtube_id: row.get(3)?,
                    title: row.get(4)?,
                    status: row.get(5)?,
                    audio_format: row.get(6)?,
                    error_message: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })
            .map_err(|e| DomainError::PersistenceError(format!("Query history failed: {e}")))?;

        let mut history = Vec::new();
        for r in rows {
            history.push(r.map_err(|e| DomainError::PersistenceError(e.to_string()))?);
        }
        Ok(history)
    }
}

impl PlaylistRepository for SqliteWorkspaceStore {
    fn create_playlist(
        &self,
        title: &str,
        youtube_playlist_id: Option<&str>,
    ) -> DomainResult<Playlist> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        if let Some(yt_pl_id) = youtube_playlist_id.filter(|s| !s.trim().is_empty()) {
            tx.execute(
                r"
                INSERT INTO playlists (title, youtube_playlist_id)
                VALUES (?1, ?2)
                ON CONFLICT(youtube_playlist_id) DO UPDATE SET title = excluded.title
                ",
                params![title, yt_pl_id],
            )
            .map_err(|e| DomainError::PersistenceError(format!("Upsert playlist failed: {e}")))?;
        } else {
            tx.execute(
                "INSERT INTO playlists (title, youtube_playlist_id) VALUES (?1, NULL)",
                params![title],
            )
            .map_err(|e| DomainError::PersistenceError(format!("Insert playlist failed: {e}")))?;
        }

        let playlist_id: i64 = if let Some(yt_pl_id) =
            youtube_playlist_id.filter(|s| !s.trim().is_empty())
        {
            tx.query_row(
                "SELECT id FROM playlists WHERE youtube_playlist_id = ?1",
                params![yt_pl_id],
                |row| row.get(0),
            )
            .map_err(|e| DomainError::PersistenceError(format!("Fetch playlist id failed: {e}")))?
        } else {
            tx.last_insert_rowid()
        };

        let playlist = tx
            .query_row(
                r"
                SELECT p.id, p.title, p.youtube_playlist_id,
                       COUNT(pt.track_id) as track_count, p.created_at
                FROM playlists p
                LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
                WHERE p.id = ?1
                GROUP BY p.id
                ",
                params![playlist_id],
                |row| {
                    let count: i64 = row.get(3)?;
                    Ok(Playlist {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        youtube_playlist_id: row.get(2)?,
                        track_count: usize::try_from(count).unwrap_or(0),
                        created_at: row.get(4)?,
                    })
                },
            )
            .map_err(|e| DomainError::PersistenceError(format!("Fetch playlist failed: {e}")))?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))?;

        Ok(playlist)
    }

    fn get_all_playlists(&self) -> DomainResult<Vec<Playlist>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let mut stmt = conn
            .prepare(
                r"
                SELECT p.id, p.title, p.youtube_playlist_id,
                       COUNT(pt.track_id) as track_count, p.created_at
                FROM playlists p
                LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
                GROUP BY p.id
                ORDER BY p.created_at DESC, p.id DESC
                ",
            )
            .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

        let rows = stmt
            .query_map([], |row| {
                let count: i64 = row.get(3)?;
                Ok(Playlist {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    youtube_playlist_id: row.get(2)?,
                    track_count: usize::try_from(count).unwrap_or(0),
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| DomainError::PersistenceError(format!("Query playlists failed: {e}")))?;

        let mut playlists = Vec::new();
        for item in rows {
            playlists.push(
                item.map_err(|e| DomainError::PersistenceError(format!("Row parse error: {e}")))?,
            );
        }
        Ok(playlists)
    }

    fn get_playlist_with_tracks(&self, playlist_id: i64) -> DomainResult<PlaylistWithTracks> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let playlist = conn
            .query_row(
                r"
                SELECT p.id, p.title, p.youtube_playlist_id,
                       COUNT(pt.track_id) as track_count, p.created_at
                FROM playlists p
                LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
                WHERE p.id = ?1
                GROUP BY p.id
                ",
                params![playlist_id],
                |row| {
                    let count: i64 = row.get(3)?;
                    Ok(Playlist {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        youtube_playlist_id: row.get(2)?,
                        track_count: usize::try_from(count).unwrap_or(0),
                        created_at: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(|e| DomainError::PersistenceError(format!("Query playlist failed: {e}")))?
            .ok_or(DomainError::PlaylistNotFound(playlist_id))?;

        let mut stmt = conn
            .prepare(
                r"
                SELECT t.id, t.youtube_id, t.title, t.artist, t.duration, t.published_at,
                       t.file_extension, t.thumbnail_path, t.synced, t.liked, t.is_missing,
                       t.file_size, t.created_at
                FROM tracks t
                INNER JOIN playlist_tracks pt ON pt.track_id = t.id
                WHERE pt.playlist_id = ?1
                ORDER BY t.created_at DESC, t.id DESC
                ",
            )
            .map_err(|e| DomainError::PersistenceError(format!("Prepare failed: {e}")))?;

        let rows = stmt
            .query_map(params![playlist_id], |row| self.map_row_to_track(row))
            .map_err(|e| {
                DomainError::PersistenceError(format!("Query playlist tracks failed: {e}"))
            })?;

        let mut tracks = Vec::new();
        for item in rows {
            tracks.push(
                item.map_err(|e| DomainError::PersistenceError(format!("Row parse error: {e}")))?,
            );
        }

        Ok(PlaylistWithTracks { playlist, tracks })
    }

    fn add_track_to_playlist(&self, playlist_id: i64, track_id: i64) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        tx.execute(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?1, ?2)",
            params![playlist_id, track_id],
        )
        .map_err(|e| {
            DomainError::PersistenceError(format!("Failed to add track to playlist: {e}"))
        })?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }

    fn remove_track_from_playlist(&self, playlist_id: i64, track_id: i64) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        tx.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
        )
        .map_err(|e| {
            DomainError::PersistenceError(format!("Failed to remove track from playlist: {e}"))
        })?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }

    fn delete_playlist(&self, playlist_id: i64) -> DomainResult<()> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| DomainError::PersistenceError(format!("Mutex poisoned: {e}")))?;

        let tx = conn
            .transaction()
            .map_err(|e| DomainError::PersistenceError(format!("Transaction error: {e}")))?;

        tx.execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
            .map_err(|e| DomainError::PersistenceError(format!("Delete playlist failed: {e}")))?;

        tx.commit()
            .map_err(|e| DomainError::PersistenceError(format!("Commit failed: {e}")))
    }
}
