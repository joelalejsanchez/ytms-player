package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ytms-player/go-microservice/src/domain"
	"ytms-player/go-microservice/src/usecases"
)

// APIHandler encapsula los controladores HTTP y SSE del microservicio Go (SDD 5.4 y 6).
type APIHandler struct {
	downloadUC  *usecases.DownloadUseCase
	syncLikesUC *usecases.SyncLikesUseCase
	healthUC    *usecases.HealthUseCase
	broker      domain.ProgressBrokerPort
}

// NewAPIHandler crea una nueva instancia de APIHandler.
func NewAPIHandler(
	downloadUC *usecases.DownloadUseCase,
	syncLikesUC *usecases.SyncLikesUseCase,
	healthUC *usecases.HealthUseCase,
	broker domain.ProgressBrokerPort,
) *APIHandler {
	return &APIHandler{
		downloadUC:  downloadUC,
		syncLikesUC: syncLikesUC,
		healthUC:    healthUC,
		broker:      broker,
	}
}

// RegisterRoutes registra los endpoints especificados en SDD Sección 6.
func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/download", h.HandleDownload)
	mux.HandleFunc("/api/progress/stream", h.HandleProgressStream)
	mux.HandleFunc("/api/sync-likes", h.HandleSyncLikes)
	mux.HandleFunc("/api/health", h.HandleHealth)
}

type errorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// HandleDownload procesa POST /api/download (SDD 6.1).
func (h *APIHandler) HandleDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only POST is supported")
		return
	}
	defer func() {
		_ = r.Body.Close()
	}()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // Límite de 1 MB por seguridad
	var req domain.DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request payload")
		return
	}

	resp, err := h.downloadUC.Execute(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidYouTubeURL),
			errors.Is(err, domain.ErrInvalidYouTubeID),
			errors.Is(err, domain.ErrInvalidAudioFormat),
			errors.Is(err, domain.ErrInvalidWorkspacePath):
			writeJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		case errors.Is(err, domain.ErrQueueFull):
			writeJSONError(w, http.StatusTooManyRequests, "queue_full", err.Error())
		default:
			writeJSONError(w, http.StatusInternalServerError, "download_failed", err.Error())
		}
		return
	}

	statusCode := http.StatusOK
	if req.Async {
		statusCode = http.StatusAccepted
	}
	writeJSON(w, statusCode, resp)
}

// HandleProgressStream transmite eventos SSE en tiempo real para GET /api/progress/stream (SDD 6.2).
func (h *APIHandler) HandleProgressStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSONError(w, http.StatusInternalServerError, "streaming_unsupported", "streaming is not supported by response writer")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	eventsCh, unsubscribe := h.broker.Subscribe(r.Context())
	defer unsubscribe()

	// Emitir evento inicial de confirmación de conexión SSE
	_, _ = fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\"}\n\n")
	flusher.Flush()

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case ev, open := <-eventsCh:
			if !open {
				return
			}
			payload, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(w, "event: download_progress\ndata: %s\n\n", payload)
			flusher.Flush()
		case <-heartbeat.C:
			// Comentario keep-alive ligero para detectar cortes de red sin generar eventos innecesarios en React
			_, _ = fmt.Fprintf(w, ": keep-alive\n\n")
			flusher.Flush()
		}
	}
}

// HandleSyncLikes procesa POST /api/sync-likes (SDD 6.3).
func (h *APIHandler) HandleSyncLikes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only POST is supported")
		return
	}
	defer func() {
		_ = r.Body.Close()
	}()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req domain.LikeSyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", "invalid request payload")
		return
	}

	// Soportar token OAuth 2.0 desde cabecera Authorization si no fue incluido en el body
	if strings.TrimSpace(req.AccessToken) == "" {
		authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			req.AccessToken = strings.TrimSpace(authHeader[7:])
		}
	}

	resp, err := h.syncLikesUC.Execute(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrEmptyYouTubeIDList), errors.Is(err, domain.ErrInvalidYouTubeID):
			writeJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		case errors.Is(err, domain.ErrUnauthorizedOAuth):
			writeJSONError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		default:
			writeJSONError(w, http.StatusInternalServerError, "sync_failed", "failed to synchronize likes")
		}
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// HandleHealth procesa GET /api/health (SDD 6.4).
func (h *APIHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
		return
	}
	status := h.healthUC.Execute(r.Context())
	writeJSON(w, http.StatusOK, status)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeJSONError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{
		Error:   code,
		Message: message,
	})
}
