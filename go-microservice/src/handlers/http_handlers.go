package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
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
	oauthFlow   domain.OAuthFlowPort
}

// NewAPIHandler crea una nueva instancia de APIHandler.
func NewAPIHandler(
	downloadUC *usecases.DownloadUseCase,
	syncLikesUC *usecases.SyncLikesUseCase,
	healthUC *usecases.HealthUseCase,
	broker domain.ProgressBrokerPort,
	oauthFlow ...domain.OAuthFlowPort,
) *APIHandler {
	var flow domain.OAuthFlowPort
	if len(oauthFlow) > 0 {
		flow = oauthFlow[0]
	}
	return &APIHandler{
		downloadUC:  downloadUC,
		syncLikesUC: syncLikesUC,
		healthUC:    healthUC,
		broker:      broker,
		oauthFlow:   flow,
	}
}

// RegisterRoutes registra los endpoints especificados en SDD Sección 6 y el flujo OAuth 2.0 en navegador.
func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/download", h.HandleDownload)
	mux.HandleFunc("/api/download/preview", h.HandlePreview)
	mux.HandleFunc("/api/progress/stream", h.HandleProgressStream)
	mux.HandleFunc("/api/sync-likes", h.HandleSyncLikes)
	mux.HandleFunc("/api/oauth/status", h.HandleOAuthStatus)
	mux.HandleFunc("/api/oauth/login", h.HandleOAuthLogin)
	mux.HandleFunc("/api/oauth/callback", h.HandleOAuthCallback)
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

// HandlePreview procesa GET /api/download/preview?url=... devolviendo la lista de temas en bulk sin descargar.
func (h *APIHandler) HandlePreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
		return
	}

	targetURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if targetURL == "" {
		writeJSONError(w, http.StatusBadRequest, "missing_url", "query parameter 'url' is required")
		return
	}

	preview, err := h.downloadUC.PreviewURL(r.Context(), targetURL)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "preview_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, preview)
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

// HandleOAuthStatus procesa GET /api/oauth/status informando si la sesión OAuth 2.0 está activa.
func (h *APIHandler) HandleOAuthStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
		return
	}
	if h.oauthFlow == nil {
		writeJSON(w, http.StatusOK, domain.OAuthStatus{MockMode: true})
		return
	}
	writeJSON(w, http.StatusOK, h.oauthFlow.GetOAuthStatus())
}

// HandleOAuthLogin procesa GET /api/oauth/login redirigiendo al navegador hacia la pantalla de consentimiento de Google.
func (h *APIHandler) HandleOAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
		return
	}
	if h.oauthFlow == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "oauth_unavailable", "oauth flow adapter is not initialized")
		return
	}

	authURL, err := h.oauthFlow.BuildAuthorizationURL()
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "oauth_not_configured", err.Error())
		return
	}

	if r.URL.Query().Get("format") == "json" {
		writeJSON(w, http.StatusOK, map[string]string{"auth_url": authURL})
		return
	}

	http.Redirect(w, r, authURL, http.StatusFound)
}

// HandleOAuthCallback recibe la redirección del navegador tras la pantalla de consentimiento de Google (GET /api/oauth/callback).
func (h *APIHandler) HandleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
		return
	}
	if h.oauthFlow == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "oauth_unavailable", "oauth flow adapter is not initialized")
		return
	}

	if oauthErr := strings.TrimSpace(r.URL.Query().Get("error")); oauthErr != "" {
		renderOAuthCallbackHTML(w, http.StatusBadRequest, false, "Autorización cancelada o rechazada por Google ("+oauthErr+").")
		return
	}

	code := strings.TrimSpace(r.URL.Query().Get("code"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if err := h.oauthFlow.ExchangeAuthorizationCode(r.Context(), code, state); err != nil {
		renderOAuthCallbackHTML(w, http.StatusUnauthorized, false, "No se pudo validar el código de autorización OAuth 2.0. Verifica OAUTH_CLIENT_ID y OAUTH_CLIENT_SECRET en tu archivo .env.")
		return
	}

	renderOAuthCallbackHTML(w, http.StatusOK, true, "¡Tu cuenta de YouTube ha sido conectada con éxito! Ya puedes volver a la ventana de ytms-player.")
}

func renderOAuthCallbackHTML(w http.ResponseWriter, status int, success bool, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	badgeColor := "#10b981"
	title := "Conexión OAuth 2.0 Completada"
	if !success {
		badgeColor = "#f43f5e"
		title = "Error de Autorización OAuth 2.0"
	}
	safeTitle := html.EscapeString(title)
	safeMessage := html.EscapeString(message)
	_, _ = fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>ytms-player - OAuth 2.0</title>
  <style>
    body { background:#090d16; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
    .card { max-width:440px; padding:32px; border-radius:16px; background:#111827; border:1px solid #1f2937; text-align:center; box-shadow:0 20px 25px -5px rgba(0,0,0,.5); }
    .dot { width:14px; height:14px; border-radius:9999px; background:%s; display:inline-block; margin-bottom:12px; }
    h1 { font-size:20px; margin:0 0 12px; }
    p { font-size:14px; color:#94a3b8; line-height:1.5; margin:0 0 24px; }
    button { background:#ef4444; color:#fff; border:none; border-radius:8px; padding:10px 20px; font-weight:600; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot"></div>
    <h1>%s</h1>
    <p>%s</p>
    <button onclick="window.close()">Volver a ytms-player</button>
  </div>
  <script>if (%v) { setTimeout(function(){ window.close(); }, 2500); }</script>
</body>
</html>`, badgeColor, safeTitle, safeMessage, success)
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
