package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"ytms-player/go-microservice/src/domain"
)

// YouTubeLikesAdapter implementa domain.LikesSyncPort soportando modo Mock inicial e integración con YouTube Data API v3 (SDD 6.3 y 8.2).
type YouTubeLikesAdapter struct {
	httpClient *http.Client
	apiBaseURL string
	mockMode   bool
}

// NewYouTubeLikesAdapter crea una nueva instancia de YouTubeLikesAdapter.
func NewYouTubeLikesAdapter(mockMode bool, apiBaseURL string) *YouTubeLikesAdapter {
	if strings.TrimSpace(apiBaseURL) == "" {
		apiBaseURL = "https://www.googleapis.com/youtube/v3/videos/getRating"
	}
	return &YouTubeLikesAdapter{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		apiBaseURL: apiBaseURL,
		mockMode:   mockMode,
	}
}

type youtubeRatingResponse struct {
	Items []struct {
		VideoID string `json:"videoId"`
		Rating  string `json:"rating"`
	} `json:"items"`
}

// SyncLikes consulta por lotes el estado de like de los identificadores indicados.
func (a *YouTubeLikesAdapter) SyncLikes(
	ctx context.Context,
	youtubeIDs []string,
	accessToken string,
) ([]domain.LikeSyncItem, error) {
	now := time.Now().UTC()

	if a.mockMode {
		if strings.TrimSpace(accessToken) == "invalid_token" {
			return nil, domain.ErrUnauthorizedOAuth
		}
		results := make([]domain.LikeSyncItem, 0, len(youtubeIDs))
		for _, id := range youtubeIDs {
			results = append(results, domain.LikeSyncItem{
				YouTubeID: id,
				Liked:     true,
				Synced:    true,
				SyncedAt:  now,
			})
		}
		return results, nil
	}

	if strings.TrimSpace(accessToken) == "" {
		return nil, domain.ErrUnauthorizedOAuth
	}

	reqURL, err := url.Parse(a.apiBaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid youtube api url: %w", err)
	}
	q := reqURL.Query()
	q.Set("id", strings.Join(youtubeIDs, ","))
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))
	req.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("youtube api request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, domain.ErrUnauthorizedOAuth
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("youtube api returned unexpected status %d", resp.StatusCode)
	}

	var parsed youtubeRatingResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("failed to decode youtube rating response: %w", err)
	}

	ratingMap := make(map[string]bool, len(parsed.Items))
	for _, item := range parsed.Items {
		ratingMap[item.VideoID] = item.Rating == "like"
	}

	results := make([]domain.LikeSyncItem, 0, len(youtubeIDs))
	for _, id := range youtubeIDs {
		results = append(results, domain.LikeSyncItem{
			YouTubeID: id,
			Liked:     ratingMap[id],
			Synced:    true,
			SyncedAt:  now,
		})
	}

	return results, nil
}
