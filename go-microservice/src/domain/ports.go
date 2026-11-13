package domain

import "context"

// ProgressCallback permite notificar eventos de avance durante una descarga.
type ProgressCallback func(event ProgressEvent)

// RawDownloadedItem representa la salida cruda de yt-dlp antes del post-procesamiento FFmpeg.
type RawDownloadedItem struct {
	YouTubeID        string
	Title            string
	Artist           string
	Duration         int
	UploadDate       string
	RawAudioPath     string
	RawThumbnailPath string
	PlaylistID       string
	PlaylistTitle    string
}

// DownloaderPort define el contrato para el motor de extracción y descarga desde YouTube (yt-dlp).
type DownloaderPort interface {
	FetchMetadata(ctx context.Context, rawURL string) ([]RawDownloadedItem, error)
	DownloadTrack(
		ctx context.Context,
		youtubeID string,
		format AudioFormat,
		workDir string,
		taskID string,
		onProgress ProgressCallback,
	) (RawDownloadedItem, error)
}

// AudioProcessorPort define el contrato para el procesamiento de audio, incrustación de tags y miniaturas (FFmpeg).
type AudioProcessorPort interface {
	ProcessAndTag(
		ctx context.Context,
		rawAudioPath string,
		rawThumbPath string,
		destAudioPath string,
		destThumbPath string,
		meta TrackMetadata,
	) (int64, error)
}

// ProgressBrokerPort define el contrato para la emisión y suscripción de eventos SSE en tiempo real (SDD 6.2).
type ProgressBrokerPort interface {
	Publish(event ProgressEvent)
	Subscribe(ctx context.Context) (<-chan ProgressEvent, func())
	ClientCount() int
}

// LikesSyncPort define el contrato para la sincronización de likes mediante OAuth 2.0 y YouTube Data API v3 (SDD 6.3).
type LikesSyncPort interface {
	SyncLikes(ctx context.Context, youtubeIDs []string, accessToken string) ([]LikeSyncItem, error)
}

// PathResolverPort gestiona la resolución segura de rutas entre el Host (Tauri) y el Contenedor Docker (SDD 3.3 y 8.3).
type PathResolverPort interface {
	ResolveWorkspaceDirs(workspacePath, tracksDir, thumbnailsDir string) (resolvedWorkspace, resolvedTracks, resolvedThumbs string, err error)
	ToHostPath(containerPath string, originalWorkspacePath string) string
	FileExists(path string) (bool, int64)
}

// DependencyCheckerPort verifica la disponibilidad de binarios externos (yt-dlp, ffmpeg) para el healthcheck (SDD 6.4).
type DependencyCheckerPort interface {
	CheckDependencies(ctx context.Context) map[string]string
}
