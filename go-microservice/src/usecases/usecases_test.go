package usecases

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"ytms-player/go-microservice/src/domain"
)

type mockDownloader struct {
	metadataItems []domain.RawDownloadedItem
	downloadErr   error
	downloadCalls int
	mu            sync.Mutex
}

func (m *mockDownloader) FetchMetadata(_ context.Context, _ string) ([]domain.RawDownloadedItem, error) {
	if m.downloadErr != nil {
		return nil, m.downloadErr
	}
	return m.metadataItems, nil
}

func (m *mockDownloader) DownloadTrack(
	_ context.Context,
	youtubeID string,
	format domain.AudioFormat,
	workDir string,
	taskID string,
	onProgress domain.ProgressCallback,
) (domain.RawDownloadedItem, error) {
	m.mu.Lock()
	m.downloadCalls++
	m.mu.Unlock()

	if m.downloadErr != nil {
		return domain.RawDownloadedItem{}, m.downloadErr
	}

	if onProgress != nil {
		onProgress(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: youtubeID,
			Status:    domain.StatusDownloading,
			Progress:  50.0,
			Speed:     "3.1 MiB/s",
			ETA:       "00:00:05",
		})
	}

	rawAudio := filepath.Join(workDir, youtubeID+"."+string(format))
	rawThumb := filepath.Join(workDir, youtubeID+".jpg")
	_ = os.WriteFile(rawAudio, []byte("raw-audio-bytes"), 0o600)
	_ = os.WriteFile(rawThumb, []byte("raw-thumb-bytes"), 0o600)

	return domain.RawDownloadedItem{
		YouTubeID:        youtubeID,
		Title:            "Mock Song " + youtubeID,
		Artist:           "Mock Artist",
		Duration:         215,
		UploadDate:       "20250115",
		RawAudioPath:     rawAudio,
		RawThumbnailPath: rawThumb,
	}, nil
}

type mockAudioProcessor struct {
	processErr error
}

func (m *mockAudioProcessor) ProcessAndTag(
	_ context.Context,
	_ string,
	_ string,
	destAudioPath string,
	destThumbPath string,
	_ domain.TrackMetadata,
) (int64, error) {
	if m.processErr != nil {
		return 0, m.processErr
	}
	payload := []byte("processed-audio-with-id3-tags")
	if err := os.WriteFile(destAudioPath, payload, 0o644); err != nil {
		return 0, err
	}
	if err := os.WriteFile(destThumbPath, []byte("processed-jpg"), 0o644); err != nil {
		return 0, err
	}
	return int64(len(payload)), nil
}

type mockBroker struct {
	mu     sync.Mutex
	events []domain.ProgressEvent
}

func (b *mockBroker) Publish(event domain.ProgressEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events = append(b.events, event)
}

func (b *mockBroker) Subscribe(_ context.Context) (<-chan domain.ProgressEvent, func()) {
	ch := make(chan domain.ProgressEvent)
	return ch, func() { close(ch) }
}

func (b *mockBroker) ClientCount() int { return 0 }

type mockPathResolver struct{}

func (r *mockPathResolver) ResolveWorkspaceDirs(workspacePath, tracksDir, thumbnailsDir string) (string, string, string, error) {
	if tracksDir == "" {
		tracksDir = filepath.Join(workspacePath, "tracks")
	}
	if thumbnailsDir == "" {
		thumbnailsDir = filepath.Join(workspacePath, "thumbnails")
	}
	if err := os.MkdirAll(tracksDir, 0o755); err != nil {
		return "", "", "", err
	}
	if err := os.MkdirAll(thumbnailsDir, 0o755); err != nil {
		return "", "", "", err
	}
	return workspacePath, tracksDir, thumbnailsDir, nil
}

func (r *mockPathResolver) ToHostPath(containerPath, _ string) string {
	return containerPath
}

func (r *mockPathResolver) FileExists(path string) (bool, int64) {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false, 0
	}
	return true, info.Size()
}

func TestDownloadUseCase_SingleVideoAndIdempotency(t *testing.T) {
	tmpWorkspace := t.TempDir()

	downloader := &mockDownloader{
		metadataItems: []domain.RawDownloadedItem{
			{
				YouTubeID:  "dQw4w9WgXcQ",
				Title:      "Never Gonna Give You Up",
				Artist:     "Rick Astley",
				Duration:   213,
				UploadDate: "20091025",
			},
		},
	}
	processor := &mockAudioProcessor{}
	broker := &mockBroker{}
	resolver := &mockPathResolver{}

	uc := NewDownloadUseCase(downloader, processor, broker, resolver, 2, 10)
	defer uc.Shutdown()

	req := domain.DownloadRequest{
		URL:           "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		AudioFormat:   domain.FormatMP3,
		WorkspacePath: tmpWorkspace,
	}

	// Primera ejecución: descarga real y creación de archivos
	resp, err := uc.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error on first download: %v", err)
	}
	if resp.Status != domain.StatusCompleted {
		t.Fatalf("expected status completed, got %s", resp.Status)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	if resp.Items[0].Skipped {
		t.Errorf("expected first download not to be skipped")
	}
	if resp.Items[0].FileSize <= 0 {
		t.Errorf("expected positive file size, got %d", resp.Items[0].FileSize)
	}

	// Segunda ejecución del mismo video: debe omitir la descarga por idempotencia (SDD 6.1 paso 4)
	resp2, err := uc.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error on duplicate download: %v", err)
	}
	if len(resp2.Items) != 1 || !resp2.Items[0].Skipped {
		t.Errorf("expected second download to be skipped due to existing file")
	}
	if downloader.downloadCalls != 1 {
		t.Errorf("expected DownloadTrack to be called only once, got %d", downloader.downloadCalls)
	}

	broker.mu.Lock()
	eventCount := len(broker.events)
	broker.mu.Unlock()
	if eventCount == 0 {
		t.Errorf("expected SSE progress events to be published")
	}
}

type mockLikesSyncPort struct {
	calls int
}

func (m *mockLikesSyncPort) SyncLikes(_ context.Context, ids []string, token string) ([]domain.LikeSyncItem, error) {
	if token == "invalid" {
		return nil, domain.ErrUnauthorizedOAuth
	}
	m.calls++
	out := make([]domain.LikeSyncItem, 0, len(ids))
	for i, id := range ids {
		out = append(out, domain.LikeSyncItem{
			YouTubeID: id,
			Liked:     i%2 == 0,
			Synced:    true,
			SyncedAt:  time.Now().UTC(),
		})
	}
	return out, nil
}

func (m *mockLikesSyncPort) RateVideo(_ context.Context, _ string, _ string) error {
	return nil
}

func TestSyncLikesUseCase_DeduplicationAndValidation(t *testing.T) {
	port := &mockLikesSyncPort{}
	uc := NewSyncLikesUseCase(port)

	resp, err := uc.Execute(context.Background(), domain.LikeSyncRequest{
		YouTubeIDs:  []string{"dQw4w9WgXcQ", "abc123xyz89", "dQw4w9WgXcQ"},
		AccessToken: "valid-token",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.TotalProcessed != 2 {
		t.Errorf("expected 2 unique IDs processed, got %d", resp.TotalProcessed)
	}
	if resp.SyncedCount != 2 {
		t.Errorf("expected 2 synced items, got %d", resp.SyncedCount)
	}
}

func TestHealthUseCase(t *testing.T) {
	uc := NewHealthUseCase(nil)
	status := uc.Execute(context.Background())
	if status.Status != "healthy" || status.Service != "ytms-player-go" || status.Version != "1.0.0" {
		t.Errorf("unexpected health status: %+v", status)
	}
}
