BINARY_NAME=localstream-go
BIN_DIR=bin
GO=go
GOFMT=gofmt
GOLANGCI_LINT=golangci-lint

.PHONY: all fmt fmt-check vet lint test test-race build run clean check

all: check build

fmt: ## Formatea todo el código Go con gofmt -s -w
	$(GOFMT) -s -w .

fmt-check: ## Verifica que todos los archivos Go cumplan el formato estándar
	@test -z "$$($(GOFMT) -s -l .)" || (echo "Archivos sin formatear:" && $(GOFMT) -s -l . && exit 1)

vet: ## Ejecuta análisis estático oficial con go vet
	$(GO) vet ./...

lint: vet ## Ejecuta golangci-lint (si está instalado) además de go vet y fmt-check
	@$(MAKE) fmt-check
	@if command -v $(GOLANGCI_LINT) >/dev/null 2>&1; then \
		$(GOLANGCI_LINT) run ./...; \
	else \
		echo "golangci-lint no detectado en PATH; verificaciones go vet y gofmt completadas."; \
	fi

test: ## Ejecuta pruebas unitarias y de integración con cobertura
	$(GO) test -v -cover ./...

test-race: ## Ejecuta pruebas con detector de condiciones de carrera
	$(GO) test -v -race ./...

build: ## Compila el binario estático optimizado
	mkdir -p $(BIN_DIR)
	CGO_ENABLED=0 $(GO) build -trimpath -ldflags="-s -w" -o $(BIN_DIR)/$(BINARY_NAME) ./src

run: ## Ejecuta el microservicio localmente
	$(GO) run ./src

clean: ## Limpia artefactos de compilación y reportes de cobertura
	rm -rf $(BIN_DIR) coverage.out coverage.html

check: fmt-check lint test
