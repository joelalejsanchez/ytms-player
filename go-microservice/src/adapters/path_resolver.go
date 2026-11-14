package adapters

import (
	"os"
	"path/filepath"
	"strings"

	"ytms-player/go-microservice/src/domain"
)

const WorkspaceControlFile = ".ytms-player-workspace"

// WorkspacePathResolver gestiona la traducción de rutas entre el Host (Tauri) y el contenedor Docker,
// garantizando la estructura del workspace y previniendo escrituras fuera de directorios autorizados (SDD 3.2, 3.3 y 8.3).
type WorkspacePathResolver struct {
	hostPrefix      string
	containerPrefix string
}

// NewWorkspacePathResolver crea una nueva instancia de WorkspacePathResolver.
func NewWorkspacePathResolver(hostPrefix, containerPrefix string) *WorkspacePathResolver {
	return &WorkspacePathResolver{
		hostPrefix:      normalizeCrossPlatformPath(hostPrefix),
		containerPrefix: normalizeCrossPlatformPath(containerPrefix),
	}
}

func normalizeCrossPlatformPath(p string) string {
	replaced := strings.ReplaceAll(strings.TrimSpace(p), "\\", "/")
	return strings.TrimRight(filepath.ToSlash(replaced), "/")
}

// ResolveWorkspaceDirs traduce las rutas al entorno del contenedor, verifica su seguridad y garantiza la estructura de carpetas.
func (r *WorkspacePathResolver) ResolveWorkspaceDirs(
	workspacePath string,
	tracksDir string,
	thumbnailsDir string,
) (string, string, string, error) {
	if err := domain.ValidateSafePath(workspacePath); err != nil {
		return "", "", "", err
	}

	resolvedWorkspace := r.toContainerPath(workspacePath)

	var resolvedTracks string
	if strings.TrimSpace(tracksDir) != "" {
		if err := domain.ValidateSafePath(tracksDir); err != nil {
			return "", "", "", err
		}
		resolvedTracks = r.toContainerPath(tracksDir)
	} else {
		resolvedTracks = filepath.Join(resolvedWorkspace, "tracks")
	}

	var resolvedThumbs string
	if strings.TrimSpace(thumbnailsDir) != "" {
		if err := domain.ValidateSafePath(thumbnailsDir); err != nil {
			return "", "", "", err
		}
		resolvedThumbs = r.toContainerPath(thumbnailsDir)
	} else {
		resolvedThumbs = filepath.Join(resolvedWorkspace, "thumbnails")
	}

	// Si containerPrefix está configurado y la ruta fue traducida al contenedor, verificar que permanezca dentro del prefijo autorizado
	if r.containerPrefix != "" && strings.HasPrefix(filepath.ToSlash(resolvedWorkspace), r.containerPrefix) {
		cleanBase := filepath.Clean(r.containerPrefix)
		if !isSubPath(cleanBase, resolvedWorkspace) || !isSubPath(cleanBase, resolvedTracks) || !isSubPath(cleanBase, resolvedThumbs) {
			return "", "", "", domain.ErrInvalidWorkspacePath
		}
	}

	if err := os.MkdirAll(resolvedTracks, 0o755); err != nil {
		return "", "", "", domain.ErrInvalidWorkspacePath
	}
	if err := os.MkdirAll(resolvedThumbs, 0o755); err != nil {
		return "", "", "", domain.ErrInvalidWorkspacePath
	}

	// Asegurar archivo de control .ytms-player-workspace (SDD 3.2)
	controlFile := filepath.Join(resolvedWorkspace, WorkspaceControlFile)
	if _, err := os.Stat(controlFile); os.IsNotExist(err) {
		_ = os.WriteFile(controlFile, []byte(`{"version":"1.0.0","app":"ytms-player"}`+"\n"), 0o644)
	}

	return resolvedWorkspace, resolvedTracks, resolvedThumbs, nil
}

func (r *WorkspacePathResolver) toContainerPath(p string) string {
	slashPath := normalizeCrossPlatformPath(p)
	if r.hostPrefix != "" && r.containerPrefix != "" {
		if hasCrossPlatformPrefix(slashPath, r.hostPrefix) {
			rel := slashPath[len(r.hostPrefix):]
			return filepath.Clean(r.containerPrefix + "/" + strings.TrimLeft(rel, "/"))
		}
	}
	return filepath.Clean(slashPath)
}

// ToHostPath convierte una ruta dentro del contenedor a la ruta equivalente en el Host de Tauri (soportando Linux y Windows).
func (r *WorkspacePathResolver) ToHostPath(containerPath string, originalWorkspacePath string) string {
	slashPath := normalizeCrossPlatformPath(containerPath)
	if originalWorkspacePath != "" && r.containerPrefix != "" {
		origNorm := normalizeCrossPlatformPath(originalWorkspacePath)
		resolvedOrig := normalizeCrossPlatformPath(r.toContainerPath(originalWorkspacePath))
		if hasCrossPlatformPrefix(slashPath, resolvedOrig) {
			rel := strings.TrimLeft(slashPath[len(resolvedOrig):], "/")
			if rel == "" {
				return origNorm
			}
			return origNorm + "/" + rel
		}
	}
	if r.hostPrefix != "" && r.containerPrefix != "" && hasCrossPlatformPrefix(slashPath, r.containerPrefix) {
		rel := strings.TrimLeft(slashPath[len(r.containerPrefix):], "/")
		if rel == "" {
			return r.hostPrefix
		}
		return r.hostPrefix + "/" + rel
	}
	return filepath.Clean(containerPath)
}

func hasCrossPlatformPrefix(target, prefix string) bool {
	if prefix == "" {
		return false
	}
	if strings.HasPrefix(target, prefix) {
		return len(target) == len(prefix) || target[len(prefix)] == '/'
	}
	// Soporte para letras de unidad en Windows con distinta capitalización (ej. C:/Users vs c:/Users)
	if len(target) >= len(prefix) && strings.EqualFold(target[:len(prefix)], prefix) {
		return len(target) == len(prefix) || target[len(prefix)] == '/'
	}
	return false
}

// FileExists verifica si un archivo existe y devuelve su tamaño en bytes.
func (r *WorkspacePathResolver) FileExists(path string) (bool, int64) {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false, 0
	}
	return true, info.Size()
}

func isSubPath(base, target string) bool {
	rel, err := filepath.Rel(filepath.Clean(base), filepath.Clean(target))
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
