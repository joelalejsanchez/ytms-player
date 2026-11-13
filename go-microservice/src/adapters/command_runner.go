package adapters

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// LineHandler procesa cada línea emitida por stdout de un proceso externo sin acumular todo en memoria.
type LineHandler func(line string)

// CommandExecutor abstrae la ejecución de procesos del sistema operativo para permitir pruebas unitarias (docs/skills/testing.md).
type CommandExecutor interface {
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
	RunStreaming(ctx context.Context, onLine LineHandler, name string, args ...string) error
	LookPath(file string) (string, error)
}

// OSCommandExecutor ejecuta binarios reales del sistema utilizando argumentos separados (SDD 8.3).
type OSCommandExecutor struct{}

// NewOSCommandExecutor crea una nueva instancia de OSCommandExecutor.
func NewOSCommandExecutor() *OSCommandExecutor {
	return &OSCommandExecutor{}
}

// Run ejecuta un comando con argumentos separados y devuelve su salida combinada o un error controlado.
func (e *OSCommandExecutor) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errText := strings.TrimSpace(stderr.String())
		if errText == "" {
			errText = err.Error()
		}
		return nil, fmt.Errorf("command %s failed: %s", name, sanitizeLogMessage(errText))
	}
	return stdout.Bytes(), nil
}

// RunStreaming ejecuta un proceso leyendo stdout línea por línea con un buffer acotado para evitar presión sobre el GC (docs/skills/optimization.md).
func (e *OSCommandExecutor) RunStreaming(ctx context.Context, onLine LineHandler, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to attach stdout pipe for %s: %w", name, err)
	}

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start %s: %w", name, err)
	}

	scanner := bufio.NewScanner(stdoutPipe)
	buf := make([]byte, 0, 16*1024)
	scanner.Buffer(buf, 64*1024)

	for scanner.Scan() {
		if onLine != nil {
			onLine(scanner.Text())
		}
	}

	if err := cmd.Wait(); err != nil {
		errText := strings.TrimSpace(stderr.String())
		if errText == "" {
			errText = err.Error()
		}
		return fmt.Errorf("command %s exited with error: %s", name, sanitizeLogMessage(errText))
	}

	return nil
}

// LookPath verifica si un ejecutable se encuentra disponible en el PATH del sistema.
func (e *OSCommandExecutor) LookPath(file string) (string, error) {
	return exec.LookPath(file)
}

// DependencyChecker implementa domain.DependencyCheckerPort para GET /api/health.
type DependencyChecker struct {
	executor CommandExecutor
}

// NewDependencyChecker crea un verificador de dependencias basado en CommandExecutor.
func NewDependencyChecker(executor CommandExecutor) *DependencyChecker {
	return &DependencyChecker{executor: executor}
}

// CheckDependencies comprueba la disponibilidad de yt-dlp y ffmpeg.
func (d *DependencyChecker) CheckDependencies(_ context.Context) map[string]string {
	deps := map[string]string{
		"yt-dlp": "available",
		"ffmpeg": "available",
	}
	if d.executor == nil {
		return deps
	}
	if _, err := d.executor.LookPath("yt-dlp"); err != nil {
		deps["yt-dlp"] = "missing"
	}
	if _, err := d.executor.LookPath("ffmpeg"); err != nil {
		deps["ffmpeg"] = "missing"
	}
	return deps
}

func sanitizeLogMessage(msg string) string {
	// Nunca exponer contenido ni rutas sensibles de cookies o tokens en mensajes de error (SDD 8.1 y 8.3)
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "cookies") || strings.Contains(lower, "oauth") || strings.Contains(lower, "bearer") {
		return "external process failed due to authentication or configuration error"
	}
	return msg
}
