package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ytms-player/go-microservice/src/adapters"
	"ytms-player/go-microservice/src/domain"
	"ytms-player/go-microservice/src/usecases"
)

type stubDownloader struct{}

func (s *stubDownloader) FetchMetadata(_ context.Context, _ string) ([]domain.RawDownloadedItem, error) {
	return []domain.RawDownloadedItem{
		{
			YouTubeID:  "dQw4w9WgXcQ",
			Title:      "Never Gonna Give You Up",
			Artist:     "Rick Astley",
			Duration:   213,
			UploadDate: "20091025",
		},
	}, nil
}

func (s *stubDownloader) DownloadTrack(
	_ context.Context,
	youtubeID string,
	format domain.AudioFormat,
	workDir string,
	taskID string,
	onProgress domain.ProgressCallback,
) (domain.RawDownloadedItem, error) {
	if onProgress != nil {
		onProgress(domain.ProgressEvent{
			TaskID:    taskID,
			YouTubeID: youtubeID,
			Status:    domain.StatusDownloading,
			Progress:  65.4,
			Speed:     "2.5 MiB/s",
			ETA:       "00:00:18",
		})
	}
	rawAudio := filepath.Join(workDir, youtubeID+"."+string(format))
	rawThumb := filepath.Join(workDir, youtubeID+".jpg")
	_ = os.WriteFile(rawAudio, []byte("audio-data"), 0o644)
	_ = os.WriteFile(rawThumb, []byte("thumb-data"), 0o644)
	return domain.RawDownloadedItem{
		YouTubeID:        youtubeID,
		Title:            "Never Gonna Give You Up",
		Artist:           "Rick Astley",
		Duration:         213,
		UploadDate:       "20091025",
		RawAudioPath:     rawAudio,
		RawThumbnailPath: rawThumb,
	}, nil
}

type stubProcessor struct{}

func (s *stubProcessor) ProcessAndTag(
	_ context.Context,
	_ string,
	_ string,
	destAudioPath string,
	destThumbPath string,
	_ domain.TrackMetadata,
) (int64, error) {
	content := []byte("final-mp3-content")
	_ = os.WriteFile(destAudioPath, content, 0o644)
	_ = os.WriteFile(destThumbPath, []byte("final-jpg-content"), 0o644)
	return int64(len(content)), nil
}

func setupTestServer(t *testing.T) (*httptest.Server, *adapters.SSEBroker, func()) {
	t.Helper()
	broker := adapters.NewSSEBroker()
	resolver := adapters.NewWorkspacePathResolver("", "")
	downloadUC := usecases.NewDownloadUseCase(&stubDownloader{}, &stubProcessor{}, broker, resolver, 2, 16)
	likesAdapter := adapters.NewYouTubeLikesAdapter(true, "")
	syncLikesUC := usecases.NewSyncLikesUseCase(likesAdapter)
	healthUC := usecases.NewHealthUseCase(nil)

	handler := NewAPIHandler(downloadUC, syncLikesUC, healthUC, broker, likesAdapter)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	srv := httptest.NewServer(LocalSecurityMiddleware(mux))
	cleanup := func() {
		srv.Close()
		downloadUC.Shutdown()
	}
	return srv, broker, cleanup
}

func TestHandleHealth(t *testing.T) {
	srv, _, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(srv.URL + "/api/health")
	if err != nil {
		t.Fatalf("GET /api/health failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var status domain.HealthStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}
	if status.Status != "healthy" || status.Service != "ytms-player-go" || status.Version != "1.0.0" {
		t.Errorf("unexpected health response: %+v", status)
	}
}

func TestHandleDownloadAndSyncLikes(t *testing.T) {
	srv, _, cleanup := setupTestServer(t)
	defer cleanup()

	workspaceDir := t.TempDir()
	reqBody, _ := json.Marshal(domain.DownloadRequest{
		URL:           "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		AudioFormat:   domain.FormatMP3,
		WorkspacePath: workspaceDir,
	})

	resp, err := http.Post(srv.URL+"/api/download", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("POST /api/download failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var dlResp domain.DownloadResponse
	if err := json.NewDecoder(resp.Body).Decode(&dlResp); err != nil {
		t.Fatalf("failed to decode download response: %v", err)
	}
	if dlResp.TargetID != "dQw4w9WgXcQ" || len(dlResp.Items) != 1 {
		t.Errorf("unexpected download response: %+v", dlResp)
	}

	// Probar POST /api/sync-likes
	syncBody, _ := json.Marshal(domain.LikeSyncRequest{
		YouTubeIDs: []string{"dQw4w9WgXcQ"},
	})
	syncResp, err := http.Post(srv.URL+"/api/sync-likes", "application/json", bytes.NewReader(syncBody))
	if err != nil {
		t.Fatalf("POST /api/sync-likes failed: %v", err)
	}
	defer func() { _ = syncResp.Body.Close() }()

	if syncResp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200 for sync-likes, got %d", syncResp.StatusCode)
	}

	var likedResult domain.LikeSyncResponse
	if err := json.NewDecoder(syncResp.Body).Decode(&likedResult); err != nil {
		t.Fatalf("failed to decode sync-likes response: %v", err)
	}
	if likedResult.TotalProcessed != 1 || !likedResult.Results[0].Liked {
		t.Errorf("unexpected sync-likes result: %+v", likedResult)
	}
}

func TestHandleProgressStream_SSE(t *testing.T) {
	srv, broker, cleanup := setupTestServer(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/progress/stream", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /api/progress/stream failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if !strings.HasPrefix(resp.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("expected text/event-stream, got %s", resp.Header.Get("Content-Type"))
	}

	go func() {
		time.Sleep(50 * time.Millisecond)
		broker.Publish(domain.ProgressEvent{
			TaskID:    "task-001",
			YouTubeID: "dQw4w9WgXcQ",
			Status:    domain.StatusDownloading,
			Progress:  65.4,
			Speed:     "2.5 MiB/s",
			ETA:       "00:00:18",
		})
	}()

	scanner := bufio.NewScanner(resp.Body)
	foundProgressEvent := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") && strings.Contains(line, `"task_id":"task-001"`) {
			foundProgressEvent = true
			break
		}
	}

	if !foundProgressEvent {
		t.Errorf("did not receive expected download_progress SSE event")
	}
}

func TestHandleOAuthBrowserFlow(t *testing.T) {
	srv, _, cleanup := setupTestServer(t)
	defer cleanup()

	loginResp, err := http.Get(srv.URL + "/api/oauth/login?format=json")
	if err != nil {
		t.Fatalf("GET /api/oauth/login failed: %v", err)
	}
	defer func() { _ = loginResp.Body.Close() }()

	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 from /api/oauth/login?format=json, got %d", loginResp.StatusCode)
	}
	var payload map[string]string
	if err := json.NewDecoder(loginResp.Body).Decode(&payload); err != nil || payload["auth_url"] == "" {
		t.Fatalf("expected auth_url in response, got %+v", payload)
	}

	statusResp, err := http.Get(srv.URL + "/api/oauth/status")
	if err != nil {
		t.Fatalf("GET /api/oauth/status failed: %v", err)
	}
	defer func() { _ = statusResp.Body.Close() }()
	if statusResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 from /api/oauth/status, got %d", statusResp.StatusCode)
	}
}
