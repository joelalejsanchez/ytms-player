package domain

import (
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	youtubeIDRegex      = regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)
	playlistIDRegex     = regexp.MustCompile(`^[a-zA-Z0-9_-]{10,64}$`)
	allowedYouTubeHosts = map[string]bool{
		"youtube.com":          true,
		"www.youtube.com":      true,
		"m.youtube.com":        true,
		"music.youtube.com":    true,
		"youtu.be":             true,
		"www.youtu.be":         true,
		"youtube-nocookie.com": true,
	}
)

// ValidateYouTubeID verifica que el identificador de video de YouTube tenga exactamente 11 caracteres válidos.
func ValidateYouTubeID(id string) error {
	if !youtubeIDRegex.MatchString(strings.TrimSpace(id)) {
		return ErrInvalidYouTubeID
	}
	return nil
}

// ValidatePlaylistID verifica que el identificador de playlist sea válido.
func ValidatePlaylistID(id string) error {
	if !playlistIDRegex.MatchString(strings.TrimSpace(id)) {
		return ErrInvalidYouTubeURL
	}
	return nil
}

// ValidateAudioFormat valida y normaliza el formato de audio solicitado.
func ValidateAudioFormat(format AudioFormat) (AudioFormat, error) {
	normalized := AudioFormat(strings.ToLower(strings.TrimSpace(string(format))))
	if normalized == "" {
		return FormatMP3, nil
	}
	switch normalized {
	case FormatMP3, FormatM4A, FormatOpus:
		return normalized, nil
	default:
		return "", ErrInvalidAudioFormat
	}
}

// ParseYouTubeURL analiza una URL de YouTube, determina si es un video o una playlist y extrae su identificador principal.
func ParseYouTubeURL(rawURL string) (ContentType, string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", "", ErrInvalidYouTubeURL
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", "", ErrInvalidYouTubeURL
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", "", ErrInvalidYouTubeURL
	}

	host := strings.ToLower(parsed.Hostname())
	if !allowedYouTubeHosts[host] {
		return "", "", ErrInvalidYouTubeURL
	}

	query := parsed.Query()
	path := strings.Trim(parsed.Path, "/")

	// Caso 1: URL dedicada de playlist (/playlist?list=...)
	if path == "playlist" {
		listID := query.Get("list")
		if err := ValidatePlaylistID(listID); err != nil {
			return "", "", ErrInvalidYouTubeURL
		}
		return ContentPlaylist, listID, nil
	}

	// Caso 2: Dominio corto youtu.be/<video_id>
	if host == "youtu.be" || host == "www.youtu.be" {
		segments := strings.Split(path, "/")
		if len(segments) == 0 || segments[0] == "" {
			return "", "", ErrInvalidYouTubeURL
		}
		videoID := segments[0]
		if err := ValidateYouTubeID(videoID); err != nil {
			return "", "", ErrInvalidYouTubeURL
		}
		return ContentVideo, videoID, nil
	}

	// Caso 3: /watch?v=<video_id> (con o sin list=...)
	if path == "watch" {
		videoID := query.Get("v")
		listID := query.Get("list")
		if videoID != "" {
			if err := ValidateYouTubeID(videoID); err != nil {
				return "", "", ErrInvalidYouTubeURL
			}
			return ContentVideo, videoID, nil
		}
		if listID != "" {
			if err := ValidatePlaylistID(listID); err != nil {
				return "", "", ErrInvalidYouTubeURL
			}
			return ContentPlaylist, listID, nil
		}
		return "", "", ErrInvalidYouTubeURL
	}

	// Caso 4: /shorts/<video_id> o /embed/<video_id> o /v/<video_id>
	segments := strings.Split(path, "/")
	if len(segments) >= 2 && (segments[0] == "shorts" || segments[0] == "embed" || segments[0] == "v") {
		videoID := segments[1]
		if err := ValidateYouTubeID(videoID); err != nil {
			return "", "", ErrInvalidYouTubeURL
		}
		return ContentVideo, videoID, nil
	}

	return "", "", ErrInvalidYouTubeURL
}

// ValidateSafePath comprueba que una ruta no sea vacía ni contenga secuencias de escape inseguras (multiplataforma Linux/Windows).
func ValidateSafePath(p string) error {
	trimmed := strings.TrimSpace(p)
	if trimmed == "" {
		return ErrInvalidWorkspacePath
	}
	normalized := strings.ReplaceAll(filepath.ToSlash(trimmed), "\\", "/")
	for _, part := range strings.Split(normalized, "/") {
		if part == ".." {
			return ErrInvalidWorkspacePath
		}
	}
	return nil
}

// ValidateDownloadRequest valida e inicializa los valores por defecto de una petición de descarga.
func ValidateDownloadRequest(req *DownloadRequest) (ContentType, string, error) {
	if req == nil {
		return "", "", ErrInvalidYouTubeURL
	}

	contentType, targetID, err := ParseYouTubeURL(req.URL)
	if err != nil {
		return "", "", err
	}

	format, err := ValidateAudioFormat(req.AudioFormat)
	if err != nil {
		return "", "", err
	}
	req.AudioFormat = format

	if req.WorkspacePath == "" && req.TracksDir == "" {
		return "", "", ErrInvalidWorkspacePath
	}

	if req.WorkspacePath != "" {
		if err := ValidateSafePath(req.WorkspacePath); err != nil {
			return "", "", err
		}
	}
	if req.TracksDir != "" {
		if err := ValidateSafePath(req.TracksDir); err != nil {
			return "", "", err
		}
	}
	if req.ThumbnailsDir != "" {
		if err := ValidateSafePath(req.ThumbnailsDir); err != nil {
			return "", "", err
		}
	}

	return contentType, targetID, nil
}
