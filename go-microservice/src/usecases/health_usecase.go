package usecases

import (
	"context"

	"localstream/go-microservice/src/domain"
)

const (
	ServiceName    = "localstream-go"
	ServiceVersion = "1.0.0"
)

// HealthUseCase verifica el estado del microservicio y sus dependencias externas (SDD 6.4).
type HealthUseCase struct {
	checker domain.DependencyCheckerPort
}

// NewHealthUseCase construye un nuevo HealthUseCase.
func NewHealthUseCase(checker domain.DependencyCheckerPort) *HealthUseCase {
	return &HealthUseCase{checker: checker}
}

// Execute devuelve el estado operativo del servicio en el formato definido por SDD 6.4.
func (uc *HealthUseCase) Execute(ctx context.Context) domain.HealthStatus {
	var deps map[string]string
	if uc.checker != nil {
		deps = uc.checker.CheckDependencies(ctx)
	}
	return domain.HealthStatus{
		Status:       "healthy",
		Service:      ServiceName,
		Version:      ServiceVersion,
		Dependencies: deps,
	}
}
