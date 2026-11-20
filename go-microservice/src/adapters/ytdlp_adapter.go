package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"ytms-player/go-microservice/src/domain"
)

const progressPrefix = "YTMS_PLAYER_PROGRESS|"

// YtDlpAdapter implementa domain.DownloaderPort invocando yt-dlp de forma segura (SDD 5.3, 6.1 y 8.1).
type YtDlpAdapter struct {
	executor    CommandExecutor
	cookiesPath string
}

// NewYtDlpAdapter crea un nuevo adaptador de yt-dlp.
func NewYtDlpAdapter(executor CommandExecutor, cookiesPath string) *YtDlpAdapter {
	return &YtDlpAdapter{
		executor:    executor,
		cookiesPath: cookiesPath,
	}
}

type ytdlpJSONEntry struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Uploader      string  `json:"uploader"`
	Artist        string  `json:"artist"`
	Creator       string  `json:"creator"`
	Channel       string  `json:"channel"`
	Duration      float64 `json:"duration"`
	UploadDate    string  `json:"upload_date"`
	PlaylistID    string  `json:"playlist_id"`
	PlaylistTitle string  `json:"playlist_title"`
}

func (a *YtDlpAdapter) appendCookieArgs(args []string) []string {
	if a.cookiesPath != "" {
		if info, err := os.Stat(a.cookiesPath); err == nil && !info.IsDir() && info.Size() > 0 {
			return append(args, "--cookies", a.cookiesPath)
		}
	}
	// Fallback inteligente: buscar en /app/workspace/cookies.txt
	workspaceCookies := "/app/workspace/cookies.txt"
	if info, err := os.Stat(workspaceCookies); err == nil && !info.IsDir() && info.Size() > 0 {
		return append(args, "--cookies", workspaceCookies)
	}
	return args
}

// FetchMetadata obtiene los metadatos de un video o los elementos de una playlist sin exponer credenciales.
func (a *YtDlpAdapter) FetchMetadata(ctx context.Context, rawURL string) ([]domain.RawDownloadedItem, error) {
	args := []string{
		"--dump-json",
		"--flat-playlist",
		"--no-warnings",
		"--no-call-home",
	}
	args = a.appendCookieArgs(args)
	args = append(args, "--", rawURL)

	out, err := a.executor.Run(ctx, "yt-dlp", args...)
	if err != nil {
		return nil, err
	}

	lines := bytes.Split(bytes.TrimSpace(out), []byte("\n"))
	items := make([]domain.RawDownloadedItem, 0, len(lines))

	for _, line := range lines {
		trimmed := bytes.TrimSpace(line)
		if len(trimmed) == 0 {
			continue
		}
		var entry ytdlpJSONEntry
		if err := json.Unmarshal(trimmed, &entry); err != nil {
			continue
		}
		if entry.ID == "" {
			continue
		}
		artist := firstNonEmpty(entry.Artist, entry.Creator, entry.Uploader, entry.Channel, "Unknown Artist")
		items = append(items, domain.RawDownloadedItem{
			YouTubeID:     entry.ID,
			Title:         firstNonEmpty(entry.Title, entry.ID),
			Artist:        artist,
			Duration:      int(entry.Duration),
			UploadDate:    entry.UploadDate,
			PlaylistID:    entry.PlaylistID,
			PlaylistTitle: entry.PlaylistTitle,
		})
	}

	return items, nil
}

// SearchTracks busca canciones en YouTube utilizando ytsearch de yt-dlp y devuelve una lista ligera de resultados.
func (a *YtDlpAdapter) SearchTracks(ctx context.Context, query string, limit int) ([]domain.SearchResultItem, error) {
	if limit <= 0 || limit > 20 {
		limit = 8
	}
	searchArg := fmt.Sprintf("ytsearch%d:%s", limit, strings.TrimSpace(query))
	args := []string{
		"--dump-json",
		"--flat-playlist",
		"--no-warnings",
		"--no-call-home",
	}
	args = a.appendCookieArgs(args)
	args = append(args, "--", searchArg)

	out, err := a.executor.Run(ctx, "yt-dlp", args...)
	if err != nil {
		return nil, err
	}

	lines := bytes.Split(bytes.TrimSpace(out), []byte("\n"))
	items := make([]domain.SearchResultItem, 0, len(lines))

	for _, line := range lines {
		trimmed := bytes.TrimSpace(line)
		if len(trimmed) == 0 {
			continue
		}
		var entry ytdlpJSONEntry
		if err := json.Unmarshal(trimmed, &entry); err != nil {
			continue
		}
		if entry.ID == "" {
			continue
		}
		artist := firstNonEmpty(entry.Artist, entry.Creator, entry.Uploader, entry.Channel, "Unknown Artist")
		thumbURL := fmt.Sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", entry.ID)

		items = append(items, domain.SearchResultItem{
			YouTubeID:    entry.ID,
			Title:        firstNonEmpty(entry.Title, entry.ID),
			Artist:       artist,
			Duration:     int(entry.Duration),
			ThumbnailURL: thumbURL,
			UploadDate:   entry.UploadDate,
		})
	}

	return items, nil
}

// DownloadTrack descarga el audio y la miniatura de un youtube_id específico emitiendo eventos de progreso en tiempo real.
func (a *YtDlpAdapter) DownloadTrack(
	ctx context.Context,
	youtubeID string,
	format domain.AudioFormat,
	workDir string,
	taskID string,
	onProgress domain.ProgressCallback,
) (domain.RawDownloadedItem, error) {
	if err := domain.ValidateYouTubeID(youtubeID); err != nil {
		return domain.RawDownloadedItem{}, err
	}

	outputTemplate := filepath.Join(workDir, "%(id)s.%(ext)s")
	progressTemplate := "download:" + progressPrefix + "%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._downloaded_bytes_str)s"
	targetURL := "https://www.youtube.com/watch?v=" + youtubeID

	args := []string{
		"--newline",
		"--no-playlist",
		"--no-warnings",
		"--extract-audio",
		"--audio-format", string(format),
		"--audio-quality", "0",
		"--write-thumbnail",
		"--convert-thumbnails", "jpg",
		"--write-info-json",
		"--progress-template", progressTemplate,
		"-o", outputTemplate,
	}
	args = a.appendCookieArgs(args)
	args = append(args, "--", targetURL)

	err := a.executor.RunStreaming(ctx, func(line string) {
		if ev, ok := ParseYtDlpProgressLine(line, taskID, youtubeID); ok && onProgress != nil {
			onProgress(ev)
		}
	}, "yt-dlp", args...)
	if err != nil {
		return domain.RawDownloadedItem{}, err
	}

	rawAudioPath := filepath.Join(workDir, fmt.Sprintf("%s.%s", youtubeID, format))
	rawThumbPath := filepath.Join(workDir, fmt.Sprintf("%s.jpg", youtubeID))
	infoJSONPath := filepath.Join(workDir, fmt.Sprintf("%s.info.json", youtubeID))

	result := domain.RawDownloadedItem{
		YouTubeID:        youtubeID,
		Title:            youtubeID,
		Artist:           "Unknown Artist",
		RawAudioPath:     rawAudioPath,
		RawThumbnailPath: rawThumbPath,
	}

	if data, readErr := os.ReadFile(infoJSONPath); readErr == nil {
		var entry ytdlpJSONEntry
		if jsonErr := json.Unmarshal(data, &entry); jsonErr == nil {
			result.Title = firstNonEmpty(entry.Title, youtubeID)
			result.Artist = firstNonEmpty(entry.Artist, entry.Creator, entry.Uploader, entry.Channel, "Unknown Artist")
			result.Duration = int(entry.Duration)
			result.UploadDate = entry.UploadDate
			result.PlaylistID = entry.PlaylistID
			result.PlaylistTitle = entry.PlaylistTitle
		}
	}

	return result, nil
}

// ParseYtDlpProgressLine analiza una línea de progreso de yt-dlp y la transforma en un ProgressEvent.
func ParseYtDlpProgressLine(line, taskID, youtubeID string) (domain.ProgressEvent, bool) {
	idx := strings.Index(line, progressPrefix)
	if idx == -1 {
		return domain.ProgressEvent{}, false
	}

	payload := strings.TrimSpace(line[idx+len(progressPrefix):])
	parts := strings.Split(payload, "|")
	if len(parts) < 3 {
		return domain.ProgressEvent{}, false
	}

	percentRaw := strings.TrimSuffix(strings.TrimSpace(parts[0]), "%")
	percent, err := strconv.ParseFloat(strings.TrimSpace(percentRaw), 64)
	if err != nil {
		percent = 0
	}

	speed := cleanProgressField(parts[1])
	eta := cleanProgressField(parts[2])
	var downloadedSize string
	if len(parts) >= 4 {
		downloadedSize = cleanProgressField(parts[3])
	}

	return domain.ProgressEvent{
		TaskID:         taskID,
		YouTubeID:      youtubeID,
		Status:         domain.StatusDownloading,
		Progress:       percent,
		Speed:          speed,
		ETA:            eta,
		DownloadedSize: downloadedSize,
	}, true
}

func cleanProgressField(val string) string {
	trimmed := strings.TrimSpace(val)
	if trimmed == "NA" || trimmed == "N/A" || trimmed == "Unknown" {
		return ""
	}
	return trimmed
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
