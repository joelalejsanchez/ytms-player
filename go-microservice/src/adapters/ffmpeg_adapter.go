package adapters

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"ytms-player/go-microservice/src/domain"
)

// FFmpegAdapter implementa domain.AudioProcessorPort para procesar el audio e incrustar tags ID3/Vorbis y miniaturas (SDD 6.1 pasos 6-10).
type FFmpegAdapter struct {
	executor CommandExecutor
}

// NewFFmpegAdapter crea una nueva instancia de FFmpegAdapter.
func NewFFmpegAdapter(executor CommandExecutor) *FFmpegAdapter {
	return &FFmpegAdapter{executor: executor}
}

// ProcessAndTag procesa el archivo de audio con FFmpeg, incrusta los metadatos según el formato y guarda el resultado final.
func (a *FFmpegAdapter) ProcessAndTag(
	ctx context.Context,
	rawAudioPath string,
	rawThumbPath string,
	destAudioPath string,
	destThumbPath string,
	meta domain.TrackMetadata,
) (int64, error) {
	if err := os.MkdirAll(filepath.Dir(destAudioPath), 0o755); err != nil {
		return 0, fmt.Errorf("%w: failed to create tracks directory: %v", domain.ErrProcessingFailed, err)
	}
	if err := os.MkdirAll(filepath.Dir(destThumbPath), 0o755); err != nil {
		return 0, fmt.Errorf("%w: failed to create thumbnails directory: %v", domain.ErrProcessingFailed, err)
	}

	// Guardar o normalizar la miniatura en /thumbnails/<youtube_id>.jpg
	thumbAvailable := false
	if rawThumbPath != "" {
		if info, err := os.Stat(rawThumbPath); err == nil && !info.IsDir() && info.Size() > 0 {
			if copyErr := copyFile(rawThumbPath, destThumbPath); copyErr == nil {
				thumbAvailable = true
			}
		}
	}

	args := []string{
		"-y",
		"-i", rawAudioPath,
	}

	ext := strings.ToLower(strings.TrimPrefix(meta.FileExtension, "."))
	if thumbAvailable && (ext == "mp3" || ext == "m4a") {
		args = append(args,
			"-i", destThumbPath,
			"-map", "0:a:0",
			"-map", "1:v:0",
			"-c:a", "copy",
			"-c:v", "mjpeg",
			"-disposition:v:0", "attached_pic",
		)
		if ext == "mp3" {
			args = append(args, "-id3v2_version", "3")
		}
	} else {
		args = append(args, "-vn", "-c:a", "copy")
	}

	if meta.Title != "" {
		args = append(args, "-metadata", "title="+meta.Title)
	}
	if meta.Artist != "" {
		args = append(args, "-metadata", "artist="+meta.Artist)
	}
	if meta.YouTubeID != "" {
		args = append(args, "-metadata", "comment=youtube_id:"+meta.YouTubeID)
	}
	if meta.PublishedAt != nil {
		args = append(args, "-metadata", "date="+meta.PublishedAt.Format("2006-01-02"))
	}

	args = append(args, destAudioPath)

	if _, err := a.executor.Run(ctx, "ffmpeg", args...); err != nil {
		return 0, fmt.Errorf("%w: %v", domain.ErrProcessingFailed, err)
	}

	info, err := os.Stat(destAudioPath)
	if err != nil {
		return 0, fmt.Errorf("%w: output file missing after ffmpeg processing: %v", domain.ErrProcessingFailed, err)
	}

	return info.Size(), nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() {
		_ = in.Close()
	}()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
	}()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
