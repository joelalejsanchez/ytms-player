package domain

import (
	"errors"
	"time"
)

// Errores de dominio independientes de infraestructura (SDD 5.1)
var (
	ErrInvalidYouTubeURL        = errors.New("invalid or unsupported youtube url")
	ErrInvalidYouTubeID         = errors.New("invalid youtube id format")
	ErrInvalidAudioFormat       = errors.New("unsupported audio format: must be mp3, m4a or opus")
	ErrInvalidWorkspacePath     = errors.New("invalid or unauthorized workspace directory path")
	ErrEmptyYouTubeIDList       = errors.New("youtube_ids list cannot be empty")
	ErrUnauthorizedOAuth        = errors.New("invalid or expired oauth 2.0 credentials")
	ErrOAuthClientNotConfigured = errors.New("oauth 2.0 client_id and client_secret are not configured in environment")
	ErrQueueFull                = errors.New("download worker queue is full, try again shortly")
	ErrDownloadFailed           = errors.New("media download failed")
	ErrProcessingFailed         = errors.New("audio processing failed")
)

// AudioFormat define los formatos de audio soportados por ytms-player.
type AudioFormat string

const (
	FormatMP3  AudioFormat = "mp3"
	FormatM4A  AudioFormat = "m4a"
	FormatOpus AudioFormat = "opus"
)

// DownloadStatus representa los estados del ciclo de vida de una tarea de descarga.
type DownloadStatus string

const (
	StatusQueued      DownloadStatus = "queued"
	StatusDownloading DownloadStatus = "downloading"
	StatusProcessing  DownloadStatus = "processing"
	StatusCompleted   DownloadStatus = "completed"
	StatusSkipped     DownloadStatus = "skipped"
	StatusFailed      DownloadStatus = "failed"
)

// ContentType identifica si una URL corresponde a un video individual o a una playlist.
type ContentType string

const (
	ContentVideo    ContentType = "video"
	ContentPlaylist ContentType = "playlist"
)

// PlaylistPreviewResponse entrega la lista rápida de elementos de una playlist para previsualizar antes de descargar.
type PlaylistPreviewItem struct {
	YouTubeID string `json:"youtube_id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Duration  int    `json:"duration"`
}

type PlaylistPreviewResponse struct {
	ContentType   ContentType           `json:"content_type"`
	TargetID      string                `json:"target_id"`
	PlaylistTitle string                `json:"playlist_title,omitempty"`
	Items         []PlaylistPreviewItem `json:"items"`
	HasMore       bool                  `json:"has_more"`
	StartIndex    int                   `json:"start_index"`
	EndIndex      int                   `json:"end_index"`
	TotalTracks   *int                  `json:"total_tracks,omitempty"`
}

// SearchResultItem representa un resultado de búsqueda de canciones en YouTube.
type SearchResultItem struct {
	YouTubeID    string `json:"youtube_id"`
	Title        string `json:"title"`
	Artist       string `json:"artist"`
	Duration     int    `json:"duration"`
	ThumbnailURL string `json:"thumbnail_url"`
	UploadDate   string `json:"upload_date,omitempty"`
}

// SearchResponse encapsula la respuesta devuelta por GET /api/search?q=...
type SearchResponse struct {
	Query   string             `json:"query"`
	Results []SearchResultItem `json:"results"`
}

// DownloadRequest encapsula los parámetros de entrada para POST /api/download (SDD 6.1).
type DownloadRequest struct {
	URL            string      `json:"url"`
	AudioFormat    AudioFormat `json:"audio_format"`
	WorkspacePath  string      `json:"workspace_path"`
	TracksDir      string      `json:"tracks_dir,omitempty"`
	ThumbnailsDir  string      `json:"thumbnails_dir,omitempty"`
	ForceOverwrite bool        `json:"force_overwrite,omitempty"`
	Async          bool        `json:"async,omitempty"`
}

// TrackMetadata contiene los metadatos extraídos de YouTube para un track (SDD 4.1 y 6.1).
type TrackMetadata struct {
	YouTubeID     string     `json:"youtube_id"`
	Title         string     `json:"title"`
	Artist        string     `json:"artist"`
	Duration      int        `json:"duration"`
	PublishedAt   *time.Time `json:"published_at,omitempty"`
	FileExtension string     `json:"file_extension"`
	ThumbnailPath string     `json:"thumbnail_path"`
	AudioPath     string     `json:"audio_path"`
	FileSize      int64      `json:"file_size"`
	PlaylistID    string     `json:"playlist_id,omitempty"`
	PlaylistTitle string     `json:"playlist_title,omitempty"`
}

// DownloadItemResult representa el resultado de descarga de un track individual.
type DownloadItemResult struct {
	YouTubeID     string         `json:"youtube_id"`
	Status        DownloadStatus `json:"status"`
	Metadata      TrackMetadata  `json:"metadata"`
	AudioPath     string         `json:"audio_path"`
	ThumbnailPath string         `json:"thumbnail_path"`
	FileExtension string         `json:"file_extension"`
	FileSize      int64          `json:"file_size"`
	Skipped       bool           `json:"skipped"`
	ErrorMessage  string         `json:"error,omitempty"`
}

// DownloadResponse representa la respuesta de POST /api/download (SDD 6.1).
type DownloadResponse struct {
	TaskID        string               `json:"task_id"`
	Status        DownloadStatus       `json:"status"`
	ContentType   ContentType          `json:"content_type"`
	TargetID      string               `json:"youtube_id"`
	PlaylistID    string               `json:"playlist_id,omitempty"`
	PlaylistTitle string               `json:"playlist_title,omitempty"`
	Items         []DownloadItemResult `json:"items,omitempty"`
	Message       string               `json:"message,omitempty"`
}

// ProgressEvent representa el payload emitido por SSE en GET /api/progress/stream (SDD 6.2).
type ProgressEvent struct {
	TaskID         string         `json:"task_id"`
	YouTubeID      string         `json:"youtube_id"`
	Status         DownloadStatus `json:"status"`
	Progress       float64        `json:"progress"`
	Speed          string         `json:"speed,omitempty"`
	DownloadedSize string         `json:"downloaded_size,omitempty"`
	ETA            string         `json:"eta,omitempty"`
	Error          string         `json:"error,omitempty"`
	Metadata       *TrackMetadata `json:"metadata,omitempty"`
}

// LikeSyncRequest representa la petición para POST /api/sync-likes (SDD 6.3).
type LikeSyncRequest struct {
	YouTubeIDs  []string `json:"youtube_ids"`
	AccessToken string   `json:"access_token,omitempty"`
}

// LikeSyncItem indica el estado de like de un contenido individual en YouTube.
type LikeSyncItem struct {
	YouTubeID string    `json:"youtube_id"`
	Liked     bool      `json:"liked"`
	Synced    bool      `json:"synced"`
	SyncedAt  time.Time `json:"synced_at"`
}

// LikeSyncResponse representa el resultado de POST /api/sync-likes (SDD 6.3).
type LikeSyncResponse struct {
	Results        []LikeSyncItem `json:"results"`
	TotalProcessed int            `json:"total_processed"`
	SyncedCount    int            `json:"synced_count"`
}

// HealthStatus representa la respuesta de GET /api/health (SDD 6.4).
type HealthStatus struct {
	Status       string            `json:"status"`
	Service      string            `json:"service"`
	Version      string            `json:"version"`
	Dependencies map[string]string `json:"dependencies,omitempty"`
}

// OAuthStatus informa a la aplicación Tauri el estado de autenticación OAuth 2.0 sin exponer tokens en texto plano (SDD 8.2).
type OAuthStatus struct {
	Authenticated    bool   `json:"authenticated"`
	MockMode         bool   `json:"mock_mode"`
	ClientConfigured bool   `json:"client_configured"`
	RedirectURI      string `json:"redirect_uri,omitempty"`
	ExpiresAt        string `json:"expires_at,omitempty"`
}
