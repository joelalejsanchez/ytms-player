package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"ytms-player/go-microservice/src/adapters"
	"ytms-player/go-microservice/src/handlers"
	"ytms-player/go-microservice/src/usecases"
)

func main() {
	port := getEnv("PORT", "8080")
	maxWorkers := getEnvInt("MAX_WORKERS", 3)
	cookiesFile := getEnv("COOKIES_FILE", "/app/config/cookies.txt")
	hostPrefix := getEnv("HOST_WORKSPACE_PREFIX", "")
	containerPrefix := getEnv("CONTAINER_WORKSPACE_PREFIX", "")
	oauthMockMode := getEnvBool("OAUTH_MOCK_MODE", true)
	youtubeAPIURL := getEnv("YOUTUBE_API_URL", "https://www.googleapis.com/youtube/v3/videos/getRating")

	// Inicialización de Adaptadores (Clean Architecture Capa 3)
	cmdExecutor := adapters.NewOSCommandExecutor()
	depChecker := adapters.NewDependencyChecker(cmdExecutor)
	sseBroker := adapters.NewSSEBroker()
	pathResolver := adapters.NewWorkspacePathResolver(hostPrefix, containerPrefix)
	ytdlpAdapter := adapters.NewYtDlpAdapter(cmdExecutor, cookiesFile)
	ffmpegAdapter := adapters.NewFFmpegAdapter(cmdExecutor)
	likesAdapter := adapters.NewYouTubeLikesAdapter(oauthMockMode, youtubeAPIURL)

	// Inicialización de Casos de Uso (Clean Architecture Capa 2)
	downloadUC := usecases.NewDownloadUseCase(
		ytdlpAdapter,
		ffmpegAdapter,
		sseBroker,
		pathResolver,
		maxWorkers,
		128,
	)
	syncLikesUC := usecases.NewSyncLikesUseCase(likesAdapter)
	healthUC := usecases.NewHealthUseCase(depChecker)

	// Inicialización de Handlers HTTP y SSE (Clean Architecture Capa 4)
	apiHandler := handlers.NewAPIHandler(downloadUC, syncLikesUC, healthUC, sseBroker)
	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           handlers.LocalSecurityMiddleware(mux),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("[ytms-player-go] starting server on :%s (workers=%d, oauth_mock=%v)", port, maxWorkers, oauthMockMode)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[ytms-player-go] server error: %v", err)
		}
	}()

	<-stopCtx.Done()
	log.Println("[ytms-player-go] shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_ = server.Shutdown(shutdownCtx)
	downloadUC.Shutdown()
	log.Println("[ytms-player-go] shutdown complete")
}

func getEnv(key, fallback string) string {
	if val := strings.TrimSpace(os.Getenv(key)); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
		return parsed
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	val := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if val == "" {
		return fallback
	}
	return val == "true" || val == "1" || val == "yes"
}
