.PHONY: help fmt fmt-check lint test check docker-up docker-down

help: ## Muestra los comandos disponibles en la raíz del monorepo
	@echo "Comandos disponibles en ytms-player Monorepo:"
	@echo "  make fmt          - Formatea Go, Rust y Frontend (React/TS)"
	@echo "  make fmt-check    - Verifica el formato en Go, Rust y Frontend"
	@echo "  make lint         - Ejecuta linters en Go, Rust (Clippy) y Frontend (ESLint)"
	@echo "  make test         - Ejecuta pruebas unitarias en Go, Rust y Frontend"
	@echo "  make check        - Ejecuta fmt-check + lint + test en todo el monorepo"
	@echo "  make docker-up    - Levanta el microservicio Go en Docker Compose"
	@echo "  make docker-down  - Detiene el microservicio Go en Docker Compose"
	@echo "  make build-bin    - Compila el ejecutable nativo de Linux (target/release/ytms-player)"
	@echo "  make build-appimage - Genera el instalador portable AppImage para Linux"

fmt:
	$(MAKE) -C go-microservice fmt
	$(MAKE) -C tauri-app/src-tauri fmt
	cd tauri-app && npm run format

fmt-check:
	$(MAKE) -C go-microservice fmt-check
	$(MAKE) -C tauri-app/src-tauri fmt-check
	cd tauri-app && npm run format:check

lint:
	$(MAKE) -C go-microservice lint
	$(MAKE) -C tauri-app/src-tauri lint
	cd tauri-app && npm run lint

test:
	$(MAKE) -C go-microservice test
	$(MAKE) -C tauri-app/src-tauri test
	cd tauri-app && npm run test

check: fmt-check lint test

docker-up:
	mkdir -p workspace config
	touch config/cookies.txt
	docker compose up --build -d

docker-down:
	docker compose down

build-bin:
	cd tauri-app && npm run tauri build -- --no-bundle

build-appimage:
	cd tauri-app && npm run tauri build -- -b appimage

