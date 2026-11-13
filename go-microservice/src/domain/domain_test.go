package domain

import "testing"

func TestValidateYouTubeID(t *testing.T) {
	validIDs := []string{
		"dQw4w9WgXcQ",
		"abc123xyz89",
		"_-123456789",
	}
	for _, id := range validIDs {
		if err := ValidateYouTubeID(id); err != nil {
			t.Errorf("expected valid YouTube ID %q, got error: %v", id, err)
		}
	}

	invalidIDs := []string{
		"",
		"short",
		"toolongyoutubeid123",
		"invalid!@#1",
		"dQw4w9WgXcQ; rm -rf /",
	}
	for _, id := range invalidIDs {
		if err := ValidateYouTubeID(id); err == nil {
			t.Errorf("expected error for invalid YouTube ID %q, got nil", id)
		}
	}
}

func TestParseYouTubeURL(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		wantType    ContentType
		wantID      string
		expectError bool
	}{
		{
			name:     "standard watch url",
			url:      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			wantType: ContentVideo,
			wantID:   "dQw4w9WgXcQ",
		},
		{
			name:     "short youtu.be url",
			url:      "https://youtu.be/abc123xyz89?si=test",
			wantType: ContentVideo,
			wantID:   "abc123xyz89",
		},
		{
			name:     "youtube music url",
			url:      "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
			wantType: ContentVideo,
			wantID:   "dQw4w9WgXcQ",
		},
		{
			name:     "playlist url",
			url:      "https://www.youtube.com/playlist?list=PL1234567890ABCDEF",
			wantType: ContentPlaylist,
			wantID:   "PL1234567890ABCDEF",
		},
		{
			name:     "shorts url",
			url:      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
			wantType: ContentVideo,
			wantID:   "dQw4w9WgXcQ",
		},
		{
			name:        "non-youtube domain",
			url:         "https://evil.example.com/watch?v=dQw4w9WgXcQ",
			expectError: true,
		},
		{
			name:        "ftp protocol",
			url:         "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
			expectError: true,
		},
		{
			name:        "empty url",
			url:         "",
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotType, gotID, err := ParseYouTubeURL(tc.url)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error for %q, got nil", tc.url)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.url, err)
			}
			if gotType != tc.wantType {
				t.Errorf("expected content type %q, got %q", tc.wantType, gotType)
			}
			if gotID != tc.wantID {
				t.Errorf("expected target ID %q, got %q", tc.wantID, gotID)
			}
		})
	}
}

func TestValidateDownloadRequest(t *testing.T) {
	req := &DownloadRequest{
		URL:           "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		AudioFormat:   "",
		WorkspacePath: "/home/user/music-workspace",
	}

	cType, id, err := ValidateDownloadRequest(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cType != ContentVideo || id != "dQw4w9WgXcQ" {
		t.Errorf("unexpected parse result: %v, %s", cType, id)
	}
	if req.AudioFormat != FormatMP3 {
		t.Errorf("expected default audio format mp3, got %s", req.AudioFormat)
	}

	traversalReq := &DownloadRequest{
		URL:           "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		AudioFormat:   FormatMP3,
		WorkspacePath: "/home/user/../../etc/passwd",
	}
	if _, _, err := ValidateDownloadRequest(traversalReq); err == nil {
		t.Errorf("expected error for path traversal attempt, got nil")
	}
}
