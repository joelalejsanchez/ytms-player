package usecases

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"ytms-player/go-microservice/src/domain"
)

type downloadJob struct {
	ctx    context.Context
	taskID string
	req    domain.DownloadRequest
}

// SearchTracks busca canciones en YouTube utilizando yt-dlp con límite acotado de resultados.
func (uc *DownloadUseCase) SearchTracks(ctx context.Context, query string, limit int) ([]domain.SearchResultItem, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []domain.SearchResultItem{}, nil
	}
	if limit <= 0 || limit > 20 {
		limit = 8
	}
	return uc.downloader.SearchTracks(ctx, trimmed, limit)
}

// PreviewURL extrae la lista de temas en una sola operación bulk de yt-dlp sin descargar audio.
func (uc *DownloadUseCase) PreviewURL(ctx context.Context, rawURL string) (*domain.PlaylistPreviewResponse, error) {
	contentType, targetID, err := domain.ParseYouTubeURL(rawURL)
	if err != nil {
		return nil, err
	}

	items, err := uc.downloader.FetchMetadata(ctx, rawURL)
	if err != nil {
		return nil, fmt.Errorf("failed to preview url: %w", err)
	}

	previewItems := make([]domain.PlaylistPreviewItem, 0, len(items))
	playlistTitle := ""

	for _, item := range items {
		if playlistTitle == "" && item.PlaylistTitle != "" {
			playlistTitle = item.PlaylistTitle
		}
		previewItems = append(previewItems, domain.PlaylistPreviewItem{
			YouTubeID: item.YouTubeID,
			Title:     item.Title,
			Artist:    item.Artist,
			Duration:  item.Duration,
		})
	}

	return &domain.PlaylistPreviewResponse{
		ContentType:   contentType,
		TargetID:      targetID,
		PlaylistTitle: playlistTitle,
		Items:         previewItems,
	}, nil
}

type DownloadUseCase struct {
	downloader   domain.DownloaderPort
	processor    domain.AudioProcessorPort
	broker       domain.ProgressBrokerPort
	pathResolver domain.PathResolverPort
	workerSem    chan struct{}
	jobQueue     chan downloadJob
	wg           sync.WaitGroup
	taskCounter  uint64
	closeOnce    sync.Once
}

// NewDownloadUseCase crea una instancia de DownloadUseCase con un Worker Pool acotado (docs/skills/optimization.md).
func NewDownloadUseCase(
	downloader domain.DownloaderPort,
	processor domain.AudioProcessorPort,
	broker domain.ProgressBrokerPort,
	pathResolver domain.PathResolverPort,
	maxWorkers int,
	queueSize int,
) *DownloadUseCase {
	if maxWorkers <= 0 {
		maxWorkers = 3
	}
	if queueSize <= 0 {
		queueSize = 64
	}

	uc := &DownloadUseCase{
		downloader:   downloader,
		processor:    processor,
		broker:       broker,
		pathResolver: pathResolver,
		workerSem:    make(chan struct{}, maxWorkers),
		jobQueue:     make(chan downloadJob, queueSize),
	}

	for i := 0; i < maxWorkers; i++ {
		uc.wg.Add(1)
		go uc.workerLoop()
	}

	return uc
}

func (uc *DownloadUseCase) workerLoop() {
	defer uc.wg.Done()
	for job := range uc.jobQueue {
		log.Printf("[worker] starting download job task=%s url=%q", job.taskID, job.req.URL)
		_, _ = uc.executeDownload(job.ctx, job.taskID, job.req)
	}
}

// Shutdown cierra la cola de trabajos y espera a que los workers activos finalicen.
func (uc *DownloadUseCase) Shutdown() {
	uc.closeOnce.Do(func() {
		close(uc.jobQueue)
		uc.wg.Wait()
	})
}

func (uc *DownloadUseCase) nextTaskID() string {
	seq := atomic.AddUint64(&uc.taskCounter, 1)
	return fmt.Sprintf("task-%03d-%d", seq, time.Now().UnixMilli()%100000)
}

// Execute valida la solicitud y ejecuta o encola la descarga según el modo solicitado.
func (uc *DownloadUseCase) Execute(ctx context.Context, req domain.DownloadRequest) (domain.DownloadResponse, error) {
	contentType, targetID, err := domain.ValidateDownloadRequest(&req)
	if err != nil {
		return domain.DownloadResponse{}, err
	}

	if _, _, _, err := uc.pathResolver.ResolveWorkspaceDirs(req.WorkspacePath, req.TracksDir, req.ThumbnailsDir); err != nil {
		return domain.DownloadResponse{}, err
	}

	taskID := uc.nextTaskID()

	if req.Async {
		select {
		case uc.jobQueue <- downloadJob{
			ctx:    context.Background(),
			taskID: taskID,
			req:    req,
		}:
			uc.publishEvent(domain.ProgressEvent{
				TaskID:    taskID,
				YouTubeID: targetID,
				Status:    domain.StatusQueued,
				Progress:  0,
			})
			return domain.DownloadResponse{
				TaskID:      taskID,
				Status:      domain.StatusQueued,
				ContentType: contentType,
				TargetID:    targetID,
				Message:     "download task queued in worker pool",
			}, nil
		default:
			return domain.DownloadResponse{}, domain.ErrQueueFull
		}
	}

	return uc.executeDownload(ctx, taskID, req)
}

func (uc *DownloadUseCase) executeDownload(ctx context.Context, taskID string, req domain.DownloadRequest) (domain.DownloadResponse, error) {
	contentType, targetID, err := domain.ValidateDownloadRequest(&req)
	if err != nil {
		return domain.DownloadResponse{}, err
	}

	_, resolvedTracksDir, resolvedThumbsDir, err := uc.pathResolver.ResolveWorkspaceDirs(
		req.WorkspacePath,
		req.TracksDir,
		req.ThumbnailsDir,
	)
	if err != nil {
		return domain.DownloadResponse{}, err
	}

	// Adquirir slot del pool de concurrencia para proteger CPU e I/O
	select {
	case uc.workerSem <- struct{}{}:
		defer func() { <-uc.workerSem }()
	case <-ctx.Done():
		return domain.DownloadResponse{}, ctx.Err()
	}

	// Paso 1: Si es video individual y ya existe en destino (y no se fuerza sobreescritura), verificar idempotencia rápida
	ext := string(req.AudioFormat)
	if contentType == domain.ContentVideo && !req.ForceOverwrite {
		destAudio := filepath.Join(resolvedTracksDir, fmt.Sprintf("%s.%s", targetID, ext))
		destThumb := filepath.Join(resolvedThumbsDir, fmt.Sprintf("%s.jpg", targetID))
		if exists, size := uc.pathResolver.FileExists(destAudio); exists && size > 0 {
			hostAudio := uc.pathResolver.ToHostPath(destAudio, req.WorkspacePath)
			hostThumb := uc.pathResolver.ToHostPath(destThumb, req.WorkspacePath)
			meta := domain.TrackMetadata{
				YouTubeID:     targetID,
				Title:         targetID,
				Artist:        "Unknown Artist",
				FileExtension: ext,
				AudioPath:     hostAudio,
				ThumbnailPath: hostThumb,
				FileSize:      size,
			}
			// Intentar enriquecer metadatos si el adaptador lo permite sin fallar si no hay red
			if items, metaErr := uc.downloader.FetchMetadata(ctx, req.URL); metaErr == nil && len(items) > 0 {
				meta.Title = nonEmpty(items[0].Title, targetID)
				meta.Artist = nonEmpty(items[0].Artist, "Unknown Artist")
				meta.Duration = items[0].Duration
				meta.PublishedAt = parseUploadDate(items[0].UploadDate)
			}

			itemResult := domain.DownloadItemResult{
				YouTubeID:     targetID,
				Status:        domain.StatusSkipped,
				Metadata:      meta,
				AudioPath:     hostAudio,
				ThumbnailPath: hostThumb,
				FileExtension: ext,
				FileSize:      size,
				Skipped:       true,
			}
			uc.publishEvent(domain.ProgressEvent{
				TaskID:    taskID,
				YouTubeID: targetID,
				Status:    domain.StatusCompleted,
				Progress:  100,
				Metadata:  &meta,
			})
			return domain.DownloadResponse{
				TaskID:      taskID,
				Status:      domain.StatusCompleted,
				ContentType: contentType,
				TargetID:    targetID,
				Items:       []domain.DownloadItemResult{itemResult},
				Message:     "track already exists in workspace",
			}, nil
		}
	}

	// Paso 2: Obtener lista de elementos (1 video o N items de playlist)
	rawItems, err := uc.downloader.FetchMetadata(ctx, req.URL)
	if err != nil {
		uc.publishEvent(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: targetID,
			Status:    domain.StatusFailed,
			Error:     err.Error(),
		})
		return domain.DownloadResponse{}, fmt.Errorf("%w: %v", domain.ErrDownloadFailed, err)
	}

	if len(rawItems) == 0 && contentType == domain.ContentVideo {
		rawItems = []domain.RawDownloadedItem{{YouTubeID: targetID}}
	}

	var (
		results       = make([]domain.DownloadItemResult, 0, len(rawItems))
		playlistID    string
		playlistTitle string
		failedCount   int
	)

	if contentType == domain.ContentPlaylist && playlistID == "" {
		playlistID = targetID
	}
	for _, item := range rawItems {
		if playlistTitle == "" && item.PlaylistTitle != "" {
			playlistTitle = item.PlaylistTitle
		}
	}

	for _, item := range rawItems {
		if item.PlaylistID == "" && contentType == domain.ContentPlaylist {
			item.PlaylistID = playlistID
		}
		if item.PlaylistTitle == "" && playlistTitle != "" {
			item.PlaylistTitle = playlistTitle
		}

		res := uc.processSingleItem(ctx, taskID, req, item, resolvedTracksDir, resolvedThumbsDir)
		if res.Status == domain.StatusFailed {
			failedCount++
		}
		results = append(results, res)
	}

	overallStatus := domain.StatusCompleted
	if failedCount > 0 && failedCount == len(results) {
		overallStatus = domain.StatusFailed
	}

	if contentType == domain.ContentPlaylist && playlistID == "" {
		playlistID = targetID
	}

	if contentType == domain.ContentPlaylist {
		uc.publishEvent(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: targetID,
			Status:    overallStatus,
			Progress:  100,
			Metadata: &domain.TrackMetadata{
				YouTubeID:     targetID,
				Title:         playlistTitle,
				PlaylistID:    playlistID,
				PlaylistTitle: playlistTitle,
			},
		})
	}

	return domain.DownloadResponse{
		TaskID:        taskID,
		Status:        overallStatus,
		ContentType:   contentType,
		TargetID:      targetID,
		PlaylistID:    playlistID,
		PlaylistTitle: playlistTitle,
		Items:         results,
	}, nil
}

func (uc *DownloadUseCase) processSingleItem(
	ctx context.Context,
	taskID string,
	req domain.DownloadRequest,
	item domain.RawDownloadedItem,
	resolvedTracksDir string,
	resolvedThumbsDir string,
) domain.DownloadItemResult {
	ytID := item.YouTubeID
	ext := string(req.AudioFormat)
	destAudio := filepath.Join(resolvedTracksDir, fmt.Sprintf("%s.%s", ytID, ext))
	destThumb := filepath.Join(resolvedThumbsDir, fmt.Sprintf("%s.jpg", ytID))
	hostAudio := uc.pathResolver.ToHostPath(destAudio, req.WorkspacePath)
	hostThumb := uc.pathResolver.ToHostPath(destThumb, req.WorkspacePath)

	// Control de duplicados (SDD 6.1 paso 4 y SDD 9 principio 6: Idempotencia)
	if !req.ForceOverwrite {
		if exists, size := uc.pathResolver.FileExists(destAudio); exists && size > 0 {
			log.Printf("[download] [%s] [%s] track already exists (%d bytes), skipping download", taskID, ytID, size)
			meta := domain.TrackMetadata{
				YouTubeID:     ytID,
				Title:         nonEmpty(item.Title, ytID),
				Artist:        nonEmpty(item.Artist, "Unknown Artist"),
				Duration:      item.Duration,
				PublishedAt:   parseUploadDate(item.UploadDate),
				FileExtension: ext,
				AudioPath:     hostAudio,
				ThumbnailPath: hostThumb,
				FileSize:      size,
				PlaylistID:    item.PlaylistID,
				PlaylistTitle: item.PlaylistTitle,
			}
			uc.publishEvent(domain.ProgressEvent{
				TaskID:    taskID,
				YouTubeID: ytID,
				Status:    domain.StatusCompleted,
				Progress:  100,
				Metadata:  &meta,
			})
			return domain.DownloadItemResult{
				YouTubeID:     ytID,
				Status:        domain.StatusSkipped,
				Metadata:      meta,
				AudioPath:     hostAudio,
				ThumbnailPath: hostThumb,
				FileExtension: ext,
				FileSize:      size,
				Skipped:       true,
			}
		}
	}

	tmpDir, err := os.MkdirTemp(resolvedTracksDir, ".tmp-"+ytID+"-*")
	if err != nil {
		errMsg := fmt.Sprintf("failed to create temp workdir: %v", err)
		uc.publishEvent(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: ytID,
			Status:    domain.StatusFailed,
			Error:     errMsg,
		})
		return domain.DownloadItemResult{
			YouTubeID:    ytID,
			Status:       domain.StatusFailed,
			ErrorMessage: errMsg,
		}
	}
	defer func() {
		_ = os.RemoveAll(tmpDir)
	}()

	initialMeta := domain.TrackMetadata{
		YouTubeID:     ytID,
		Title:         nonEmpty(item.Title, ytID),
		Artist:        nonEmpty(item.Artist, "Unknown Artist"),
		Duration:      item.Duration,
		FileExtension: ext,
		AudioPath:     hostAudio,
		ThumbnailPath: hostThumb,
		PlaylistID:    item.PlaylistID,
		PlaylistTitle: item.PlaylistTitle,
	}

	uc.publishEvent(domain.ProgressEvent{
		TaskID:    taskID,
		YouTubeID: ytID,
		Status:    domain.StatusDownloading,
		Progress:  0,
		Metadata:  &initialMeta,
	})

	log.Printf("[download] [%s] [%s] downloading raw audio via yt-dlp...", taskID, ytID)

	downloaded, err := uc.downloader.DownloadTrack(ctx, ytID, req.AudioFormat, tmpDir, taskID, func(ev domain.ProgressEvent) {
		ev.TaskID = taskID
		ev.YouTubeID = ytID
		if ev.Metadata == nil {
			ev.Metadata = &initialMeta
		}
		uc.publishEvent(ev)
	})
	if err != nil {
		log.Printf("[download] [%s] [%s] yt-dlp download failed: %v", taskID, ytID, err)
		uc.publishEvent(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: ytID,
			Status:    domain.StatusFailed,
			Error:     err.Error(),
			Metadata:  &initialMeta,
		})
		return domain.DownloadItemResult{
			YouTubeID:    ytID,
			Status:       domain.StatusFailed,
			ErrorMessage: err.Error(),
		}
	}

	meta := domain.TrackMetadata{
		YouTubeID:     ytID,
		Title:         nonEmpty(downloaded.Title, nonEmpty(item.Title, ytID)),
		Artist:        nonEmpty(downloaded.Artist, nonEmpty(item.Artist, "Unknown Artist")),
		Duration:      maxInt(downloaded.Duration, item.Duration),
		PublishedAt:   parseUploadDate(nonEmpty(downloaded.UploadDate, item.UploadDate)),
		FileExtension: ext,
		AudioPath:     hostAudio,
		ThumbnailPath: hostThumb,
		PlaylistID:    nonEmpty(downloaded.PlaylistID, item.PlaylistID),
		PlaylistTitle: nonEmpty(downloaded.PlaylistTitle, item.PlaylistTitle),
	}

	log.Printf("[download] [%s] [%s] processing & tagging with FFmpeg -> %s", taskID, ytID, destAudio)

	uc.publishEvent(domain.ProgressEvent{
		TaskID:    taskID,
		YouTubeID: ytID,
		Status:    domain.StatusProcessing,
		Progress:  95,
		Metadata:  &meta,
	})

	fileSize, err := uc.processor.ProcessAndTag(
		ctx,
		downloaded.RawAudioPath,
		downloaded.RawThumbnailPath,
		destAudio,
		destThumb,
		meta,
	)
	if err != nil {
		log.Printf("[download] [%s] [%s] FFmpeg processing failed: %v", taskID, ytID, err)
		uc.publishEvent(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: ytID,
			Status:    domain.StatusFailed,
			Error:     err.Error(),
		})
		return domain.DownloadItemResult{
			YouTubeID:    ytID,
			Status:       domain.StatusFailed,
			ErrorMessage: err.Error(),
		}
	}

	meta.FileSize = fileSize

	log.Printf("[download] [%s] [%s] COMPLETED: size=%d bytes dest=%s", taskID, ytID, fileSize, destAudio)

	uc.publishEvent(domain.ProgressEvent{
		TaskID:    taskID,
		YouTubeID: ytID,
		Status:    domain.StatusCompleted,
		Progress:  100,
		Metadata:  &meta,
	})

	return domain.DownloadItemResult{
		YouTubeID:     ytID,
		Status:        domain.StatusCompleted,
		Metadata:      meta,
		AudioPath:     hostAudio,
		ThumbnailPath: hostThumb,
		FileExtension: ext,
		FileSize:      fileSize,
		Skipped:       false,
	}
}

func (uc *DownloadUseCase) publishEvent(ev domain.ProgressEvent) {
	if uc.broker != nil {
		uc.broker.Publish(ev)
	}
}

func nonEmpty(val, fallback string) string {
	if val != "" {
		return val
	}
	return fallback
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func parseUploadDate(raw string) *time.Time {
	if len(raw) == 8 {
		if t, err := time.Parse("20060102", raw); err == nil {
			return &t
		}
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t
	}
	return nil
}
