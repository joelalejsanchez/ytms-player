package usecases

import (
	"context"
	"fmt"
	"strings"

	"ytms-player/go-microservice/src/domain"
)

const maxYouTubeBatchSize = 50

// SyncLikesUseCase gestiona la sincronización por lotes del estado de likes con YouTube Data API v3 (SDD 6.3).
type SyncLikesUseCase struct {
	likesPort domain.LikesSyncPort
}

// NewSyncLikesUseCase crea una nueva instancia de SyncLikesUseCase.
func NewSyncLikesUseCase(likesPort domain.LikesSyncPort) *SyncLikesUseCase {
	return &SyncLikesUseCase{likesPort: likesPort}
}

// RateVideo califica ("like", "none", "dislike") un video en YouTube a través del puerto OAuth.
func (uc *SyncLikesUseCase) RateVideo(ctx context.Context, youtubeID string, rating string) error {
	if err := domain.ValidateYouTubeID(youtubeID); err != nil {
		return err
	}
	trimmed := strings.ToLower(strings.TrimSpace(rating))
	if trimmed != "like" && trimmed != "none" && trimmed != "dislike" {
		return fmt.Errorf("invalid rating: %s (must be like, none or dislike)", rating)
	}
	return uc.likesPort.RateVideo(ctx, youtubeID, trimmed)
}

// Execute valida los identificadores recibidos, los agrupa por lotes y consulta el estado de likes.
func (uc *SyncLikesUseCase) Execute(ctx context.Context, req domain.LikeSyncRequest) (domain.LikeSyncResponse, error) {
	if len(req.YouTubeIDs) == 0 {
		return domain.LikeSyncResponse{}, domain.ErrEmptyYouTubeIDList
	}

	seen := make(map[string]struct{}, len(req.YouTubeIDs))
	uniqueIDs := make([]string, 0, len(req.YouTubeIDs))

	for _, id := range req.YouTubeIDs {
		// Resiliencia: si un ID individual no cumple con el formato de YouTube (ej. archivo local),
		// se omite de forma tolerante sin hacer fallar el lote completo
		if err := domain.ValidateYouTubeID(id); err != nil {
			continue
		}
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			uniqueIDs = append(uniqueIDs, id)
		}
	}

	if len(uniqueIDs) == 0 {
		return domain.LikeSyncResponse{
			Results:        []domain.LikeSyncItem{},
			TotalProcessed: 0,
			SyncedCount:    0,
		}, nil
	}

	allResults := make([]domain.LikeSyncItem, 0, len(uniqueIDs))
	syncedCount := 0

	for start := 0; start < len(uniqueIDs); start += maxYouTubeBatchSize {
		end := start + maxYouTubeBatchSize
		if end > len(uniqueIDs) {
			end = len(uniqueIDs)
		}

		batch := uniqueIDs[start:end]
		batchResults, err := uc.likesPort.SyncLikes(ctx, batch, req.AccessToken)
		if err != nil {
			return domain.LikeSyncResponse{}, err
		}

		for _, item := range batchResults {
			if item.Synced {
				syncedCount++
			}
			allResults = append(allResults, item)
		}
	}

	return domain.LikeSyncResponse{
		Results:        allResults,
		TotalProcessed: len(uniqueIDs),
		SyncedCount:    syncedCount,
	}, nil
}
