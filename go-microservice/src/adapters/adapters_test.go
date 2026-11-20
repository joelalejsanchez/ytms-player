package adapters

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"ytms-player/go-microservice/src/domain"
)

type fakeCommandExecutor struct {
	runOutput      []byte
	runErr         error
	streamingLines []string
	lastArgs       []string
	onRun          func(name string, args []string)
}

func (f *fakeCommandExecutor) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	f.lastArgs = args
	if f.onRun != nil {
		f.onRun(name, args)
	}
	if f.runErr != nil {
		return nil, f.runErr
	}
	return f.runOutput, nil
}

func (f *fakeCommandExecutor) RunStreaming(_ context.Context, onLine LineHandler, name string, args ...string) error {
	f.lastArgs = args
	for _, line := range f.streamingLines {
		if onLine != nil {
			onLine(line)
		}
	}
	if f.onRun != nil {
		f.onRun(name, args)
	}
	return f.runErr
}

func (f *fakeCommandExecutor) LookPath(file string) (string, error) {
	return "/usr/bin/" + file, nil
}

func TestSSEBroker_PublishAndSubscribe(t *testing.T) {
	broker := NewSSEBroker()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch, unsub := broker.Subscribe(ctx)
	defer unsub()

	if broker.ClientCount() != 1 {
		t.Fatalf("expected 1 connected client, got %d", broker.ClientCount())
	}

	expected := domain.ProgressEvent{
		TaskID:    "task-001",
		YouTubeID: "dQw4w9WgXcQ",
		Status:    domain.StatusDownloading,
		Progress:  65.4,
		Speed:     "2.5 MiB/s",
		ETA:       "00:00:18",
	}
	broker.Publish(expected)

	select {
	case got := <-ch:
		if got.TaskID != expected.TaskID || got.Progress != expected.Progress {
			t.Errorf("unexpected event received: %+v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for SSE event")
	}

	unsub()
	if broker.ClientCount() != 0 {
		t.Errorf("expected 0 connected clients after unsubscribe, got %d", broker.ClientCount())
	}
}

func TestYtDlpAdapter_ProgressAndMetadata(t *testing.T) {
	tmpDir := t.TempDir()
	cookiesFile := filepath.Join(tmpDir, "cookies.txt")
	_ = os.WriteFile(cookiesFile, []byte("# Netscape HTTP Cookie File\n"), 0o600)

	execMock := &fakeCommandExecutor{
		runOutput: []byte(`{"id":"dQw4w9WgXcQ","title":"Never Gonna Give You Up","artist":"Rick Astley","duration":213,"upload_date":"20091025"}` + "\n"),
		streamingLines: []string{
			"YTMS_PLAYER_PROGRESS| 42.5%| 2.10MiB/s| 00:00:12| 1.50MiB",
			"YTMS_PLAYER_PROGRESS| 100.0%| 3.00MiB/s| 00:00:00| 3.50MiB",
		},
		onRun: func(name string, _ []string) {
			if name == "yt-dlp" {
				_ = os.WriteFile(filepath.Join(tmpDir, "dQw4w9WgXcQ.mp3"), []byte("audio"), 0o644)
				_ = os.WriteFile(filepath.Join(tmpDir, "dQw4w9WgXcQ.jpg"), []byte("thumb"), 0o644)
			}
		},
	}

	adapter := NewYtDlpAdapter(execMock, cookiesFile)
	items, err := adapter.FetchMetadata(context.Background(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ", 0, 0)
	if err != nil {
		t.Fatalf("FetchMetadata failed: %v", err)
	}
	if len(items) != 1 || items[0].YouTubeID != "dQw4w9WgXcQ" {
		t.Fatalf("unexpected metadata items: %+v", items)
	}

	var progressUpdates []domain.ProgressEvent
	downloaded, err := adapter.DownloadTrack(
		context.Background(),
		"dQw4w9WgXcQ",
		domain.FormatMP3,
		tmpDir,
		"task-100",
		func(ev domain.ProgressEvent) {
			progressUpdates = append(progressUpdates, ev)
		},
	)
	if err != nil {
		t.Fatalf("DownloadTrack failed: %v", err)
	}
	if downloaded.YouTubeID != "dQw4w9WgXcQ" {
		t.Errorf("expected YouTubeID dQw4w9WgXcQ, got %s", downloaded.YouTubeID)
	}

	// Prueba de SearchTracks
	searchResults, err := adapter.SearchTracks(context.Background(), "Rick Astley", 5)
	if err != nil {
		t.Fatalf("SearchTracks failed: %v", err)
	}
	if len(searchResults) != 1 || searchResults[0].YouTubeID != "dQw4w9WgXcQ" {
		t.Fatalf("unexpected search results: %+v", searchResults)
	}
	if searchResults[0].ThumbnailURL != "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" {
		t.Errorf("unexpected thumbnail url: %s", searchResults[0].ThumbnailURL)
	}
	if len(progressUpdates) != 2 || progressUpdates[0].Progress != 42.5 {
		t.Errorf("unexpected progress updates: %+v", progressUpdates)
	}
}

func TestFFmpegAdapter_ProcessAndTag(t *testing.T) {
	tmpDir := t.TempDir()
	rawAudio := filepath.Join(tmpDir, "raw.mp3")
	rawThumb := filepath.Join(tmpDir, "raw.jpg")
	destAudio := filepath.Join(tmpDir, "tracks", "dQw4w9WgXcQ.mp3")
	destThumb := filepath.Join(tmpDir, "thumbnails", "dQw4w9WgXcQ.jpg")

	_ = os.WriteFile(rawAudio, []byte("raw-mp3"), 0o644)
	_ = os.WriteFile(rawThumb, []byte("raw-jpg"), 0o644)

	execMock := &fakeCommandExecutor{
		onRun: func(name string, args []string) {
			if name == "ffmpeg" && len(args) > 0 {
				outPath := args[len(args)-1]
				_ = os.WriteFile(outPath, []byte("tagged-mp3-output"), 0o644)
			}
		},
	}

	ff := NewFFmpegAdapter(execMock)
	size, err := ff.ProcessAndTag(context.Background(), rawAudio, rawThumb, destAudio, destThumb, domain.TrackMetadata{
		YouTubeID:     "dQw4w9WgXcQ",
		Title:         "Never Gonna Give You Up",
		Artist:        "Rick Astley",
		FileExtension: "mp3",
	})
	if err != nil {
		t.Fatalf("ProcessAndTag failed: %v", err)
	}
	if size != int64(len("tagged-mp3-output")) {
		t.Errorf("unexpected output size: %d", size)
	}
	if _, err := os.Stat(destThumb); err != nil {
		t.Errorf("expected thumbnail to be written at %s: %v", destThumb, err)
	}
}

func TestWorkspacePathResolver(t *testing.T) {
	tmpContainerRoot := t.TempDir()
	resolver := NewWorkspacePathResolver("/host/workspaces", tmpContainerRoot)

	ws, tracks, thumbs, err := resolver.ResolveWorkspaceDirs("/host/workspaces/rock", "", "")
	if err != nil {
		t.Fatalf("ResolveWorkspaceDirs failed: %v", err)
	}
	if ws != filepath.Join(tmpContainerRoot, "rock") {
		t.Errorf("unexpected resolved workspace: %s", ws)
	}
	if tracks != filepath.Join(tmpContainerRoot, "rock", "tracks") {
		t.Errorf("unexpected resolved tracks dir: %s", tracks)
	}
	if thumbs != filepath.Join(tmpContainerRoot, "rock", "thumbnails") {
		t.Errorf("unexpected resolved thumbnails dir: %s", thumbs)
	}

	hostAudio := resolver.ToHostPath(filepath.Join(tracks, "dQw4w9WgXcQ.mp3"), "/host/workspaces/rock")
	if hostAudio != "/host/workspaces/rock/tracks/dQw4w9WgXcQ.mp3" {
		t.Errorf("unexpected mapped host path: %s", hostAudio)
	}

	// Verificar soporte multiplataforma Windows (C:\Users\...)
	winResolver := NewWorkspacePathResolver(`C:\Users\Developer\Music\ytms-player`, tmpContainerRoot)
	winWS, winTracks, _, err := winResolver.ResolveWorkspaceDirs(`C:\Users\Developer\Music\ytms-player\Electronic`, "", "")
	if err != nil {
		t.Fatalf("Windows ResolveWorkspaceDirs failed: %v", err)
	}
	if winWS != filepath.Join(tmpContainerRoot, "Electronic") {
		t.Errorf("unexpected resolved Windows workspace: %s", winWS)
	}
	winHostAudio := winResolver.ToHostPath(filepath.Join(winTracks, "dQw4w9WgXcQ.mp3"), `C:\Users\Developer\Music\ytms-player\Electronic`)
	if winHostAudio != "C:/Users/Developer/Music/ytms-player/Electronic/tracks/dQw4w9WgXcQ.mp3" {
		t.Errorf("unexpected Windows mapped host path: %s", winHostAudio)
	}
}
