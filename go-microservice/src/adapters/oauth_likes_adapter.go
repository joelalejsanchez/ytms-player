package adapters

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"ytms-player/go-microservice/src/domain"
)

const (
	defaultYouTubeRatingURL = "https://www.googleapis.com/youtube/v3/videos/getRating"
	defaultGoogleAuthURL    = "https://accounts.google.com/o/oauth2/v2/auth"
	defaultGoogleTokenURL   = "https://oauth2.googleapis.com/token"
	defaultOAuthRedirectURI = "http://127.0.0.1:8080/api/oauth/callback"
	youtubeReadonlyScope    = "https://www.googleapis.com/auth/youtube.readonly"
)

// OAuthConfig agrupa la configuración de credenciales OAuth 2.0 para el flujo de redirección en navegador.
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	TokenFile    string
	AuthBaseURL  string
	TokenURL     string
}

type storedOAuthToken struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// YouTubeLikesAdapter implementa domain.LikesSyncPort y domain.OAuthFlowPort soportando modo Mock e integración real OAuth 2.0 (SDD 6.3 y 8.2).
type YouTubeLikesAdapter struct {
	httpClient   *http.Client
	apiBaseURL   string
	mockMode     bool
	oauthCfg     OAuthConfig
	mu           sync.RWMutex
	token        *storedOAuthToken
	pendingState string
}

// NewYouTubeLikesAdapter crea una nueva instancia de YouTubeLikesAdapter con configuración por defecto.
func NewYouTubeLikesAdapter(mockMode bool, apiBaseURL string) *YouTubeLikesAdapter {
	return NewYouTubeLikesAdapterWithOAuth(mockMode, apiBaseURL, OAuthConfig{})
}

// NewYouTubeLikesAdapterWithOAuth crea una nueva instancia de YouTubeLikesAdapter con configuración OAuth 2.0 completa.
func NewYouTubeLikesAdapterWithOAuth(mockMode bool, apiBaseURL string, oauthCfg OAuthConfig) *YouTubeLikesAdapter {
	if strings.TrimSpace(apiBaseURL) == "" {
		apiBaseURL = defaultYouTubeRatingURL
	}
	if strings.TrimSpace(oauthCfg.RedirectURI) == "" {
		oauthCfg.RedirectURI = defaultOAuthRedirectURI
	}
	if strings.TrimSpace(oauthCfg.AuthBaseURL) == "" {
		oauthCfg.AuthBaseURL = defaultGoogleAuthURL
	}
	if strings.TrimSpace(oauthCfg.TokenURL) == "" {
		oauthCfg.TokenURL = defaultGoogleTokenURL
	}
	oauthCfg.ClientID = strings.TrimSpace(oauthCfg.ClientID)
	oauthCfg.ClientSecret = strings.TrimSpace(oauthCfg.ClientSecret)
	oauthCfg.TokenFile = strings.TrimSpace(oauthCfg.TokenFile)

	adapter := &YouTubeLikesAdapter{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		apiBaseURL: apiBaseURL,
		mockMode:   mockMode,
		oauthCfg:   oauthCfg,
	}
	adapter.loadTokenFromDisk()
	return adapter
}

// GetOAuthStatus retorna el estado actual de autenticación OAuth 2.0 sin exponer tokens sensibles (SDD 8.2).
func (a *YouTubeLikesAdapter) GetOAuthStatus() domain.OAuthStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	clientConfigured := a.oauthCfg.ClientID != "" && a.oauthCfg.ClientSecret != ""
	authenticated := false
	expiresAt := ""

	if a.token != nil && strings.TrimSpace(a.token.AccessToken) != "" {
		authenticated = true
		if !a.token.ExpiresAt.IsZero() {
			expiresAt = a.token.ExpiresAt.UTC().Format(time.RFC3339)
		}
	}

	return domain.OAuthStatus{
		Authenticated:    authenticated,
		MockMode:         a.mockMode,
		ClientConfigured: clientConfigured,
		RedirectURI:      a.oauthCfg.RedirectURI,
		ExpiresAt:        expiresAt,
	}
}

// BuildAuthorizationURL construye la URL de pantalla de consentimiento de Google OAuth 2.0 para abrir en el navegador del sistema.
func (a *YouTubeLikesAdapter) BuildAuthorizationURL() (string, error) {
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return "", fmt.Errorf("failed to generate oauth state: %w", err)
	}
	state := hex.EncodeToString(stateBytes)

	a.mu.Lock()
	a.pendingState = state
	a.mu.Unlock()

	// Si está en modo mock y aún no se han configurado credenciales GCP, redirigir al callback local simulado
	if a.mockMode && (a.oauthCfg.ClientID == "" || a.oauthCfg.ClientSecret == "") {
		callbackURL, err := url.Parse(a.oauthCfg.RedirectURI)
		if err != nil {
			return "", err
		}
		q := callbackURL.Query()
		q.Set("code", "mock_oauth_code")
		q.Set("state", state)
		callbackURL.RawQuery = q.Encode()
		return callbackURL.String(), nil
	}

	if a.oauthCfg.ClientID == "" || a.oauthCfg.ClientSecret == "" {
		return "", domain.ErrOAuthClientNotConfigured
	}

	authURL, err := url.Parse(a.oauthCfg.AuthBaseURL)
	if err != nil {
		return "", fmt.Errorf("invalid oauth auth url: %w", err)
	}
	q := authURL.Query()
	q.Set("client_id", a.oauthCfg.ClientID)
	q.Set("redirect_uri", a.oauthCfg.RedirectURI)
	q.Set("response_type", "code")
	q.Set("scope", youtubeReadonlyScope)
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")
	q.Set("state", state)
	authURL.RawQuery = q.Encode()

	return authURL.String(), nil
}

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// ExchangeAuthorizationCode intercambia el código devuelto por Google en el callback local por un access_token y refresh_token.
func (a *YouTubeLikesAdapter) ExchangeAuthorizationCode(ctx context.Context, code string, state string) error {
	trimmedCode := strings.TrimSpace(code)
	if trimmedCode == "" {
		return domain.ErrUnauthorizedOAuth
	}

	a.mu.Lock()
	expectedState := a.pendingState
	a.pendingState = ""
	a.mu.Unlock()

	if expectedState != "" && strings.TrimSpace(state) != expectedState {
		return domain.ErrUnauthorizedOAuth
	}

	if a.mockMode && (a.oauthCfg.ClientID == "" || a.oauthCfg.ClientSecret == "") {
		a.saveToken(&storedOAuthToken{
			AccessToken:  "mock_oauth_token",
			RefreshToken: "mock_refresh_token",
			ExpiresAt:    time.Now().UTC().Add(24 * time.Hour),
		})
		return nil
	}

	if a.oauthCfg.ClientID == "" || a.oauthCfg.ClientSecret == "" {
		return domain.ErrOAuthClientNotConfigured
	}

	form := url.Values{}
	form.Set("code", trimmedCode)
	form.Set("client_id", a.oauthCfg.ClientID)
	form.Set("client_secret", a.oauthCfg.ClientSecret)
	form.Set("redirect_uri", a.oauthCfg.RedirectURI)
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.oauthCfg.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("oauth token exchange request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return domain.ErrUnauthorizedOAuth
	}

	var parsed googleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil || strings.TrimSpace(parsed.AccessToken) == "" {
		return domain.ErrUnauthorizedOAuth
	}

	expiresIn := parsed.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}

	a.mu.RLock()
	existingRefresh := ""
	if a.token != nil {
		existingRefresh = a.token.RefreshToken
	}
	a.mu.RUnlock()

	refreshToken := strings.TrimSpace(parsed.RefreshToken)
	if refreshToken == "" {
		refreshToken = existingRefresh
	}

	a.saveToken(&storedOAuthToken{
		AccessToken:  strings.TrimSpace(parsed.AccessToken),
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().UTC().Add(time.Duration(expiresIn) * time.Second),
	})
	return nil
}

func (a *YouTubeLikesAdapter) refreshAccessTokenIfNeeded(ctx context.Context) (string, error) {
	a.mu.RLock()
	tok := a.token
	a.mu.RUnlock()

	if tok == nil || strings.TrimSpace(tok.AccessToken) == "" {
		return "", domain.ErrUnauthorizedOAuth
	}

	// Si el token aún es válido por al menos 60 segundos o no hay refresh_token, devolver el actual
	if tok.ExpiresAt.IsZero() || time.Now().UTC().Add(60*time.Second).Before(tok.ExpiresAt) || tok.RefreshToken == "" {
		return tok.AccessToken, nil
	}

	if a.oauthCfg.ClientID == "" || a.oauthCfg.ClientSecret == "" {
		return tok.AccessToken, nil
	}

	form := url.Values{}
	form.Set("client_id", a.oauthCfg.ClientID)
	form.Set("client_secret", a.oauthCfg.ClientSecret)
	form.Set("refresh_token", tok.RefreshToken)
	form.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.oauthCfg.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return tok.AccessToken, nil
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return tok.AccessToken, nil
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", domain.ErrUnauthorizedOAuth
	}

	var parsed googleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil || strings.TrimSpace(parsed.AccessToken) == "" {
		return "", domain.ErrUnauthorizedOAuth
	}

	expiresIn := parsed.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}

	updated := &storedOAuthToken{
		AccessToken:  strings.TrimSpace(parsed.AccessToken),
		RefreshToken: tok.RefreshToken,
		ExpiresAt:    time.Now().UTC().Add(time.Duration(expiresIn) * time.Second),
	}
	a.saveToken(updated)
	return updated.AccessToken, nil
}

func (a *YouTubeLikesAdapter) saveToken(tok *storedOAuthToken) {
	a.mu.Lock()
	a.token = tok
	tokenFile := a.oauthCfg.TokenFile
	a.mu.Unlock()

	if tokenFile == "" || tok == nil {
		return
	}
	if dir := filepath.Dir(tokenFile); dir != "" && dir != "." {
		_ = os.MkdirAll(dir, 0o700)
	}
	if data, err := json.Marshal(tok); err == nil {
		_ = os.WriteFile(tokenFile, data, 0o600)
	}
}

func (a *YouTubeLikesAdapter) loadTokenFromDisk() {
	if a.oauthCfg.TokenFile == "" {
		return
	}
	data, err := os.ReadFile(a.oauthCfg.TokenFile)
	if err != nil {
		return
	}
	var tok storedOAuthToken
	if err := json.Unmarshal(data, &tok); err == nil && strings.TrimSpace(tok.AccessToken) != "" {
		a.mu.Lock()
		a.token = &tok
		a.mu.Unlock()
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

	resolvedToken := strings.TrimSpace(accessToken)
	if resolvedToken == "" {
		var err error
		resolvedToken, err = a.refreshAccessTokenIfNeeded(ctx)
		if err != nil || resolvedToken == "" {
			return nil, domain.ErrUnauthorizedOAuth
		}
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
	req.Header.Set("Authorization", "Bearer "+resolvedToken)
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
