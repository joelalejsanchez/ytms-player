.PHONY: help fmt fmt-check lint typecheck test check docker-up docker-down dev build build-bin release build-release build-appimage build-deb build-rpm

## help: Muestra los comandos disponibles en la raíz del monorepo
help:
	@echo "Comandos disponibles en ytms-player Monorepo (Linux):"
	@grep -h -E '^## ' $(MAKEFILE_LIST) | sed -e 's/^## //' | awk -F': ' '{printf "  make %-17s - %s\n", $$1, $$2}'

## fmt: Formatea Go, Rust y Frontend (React/TS)
fmt:
	$(MAKE) -C go-microservice fmt
	$(MAKE) -C tauri-app/src-tauri fmt
	cd tauri-app && npm run format

## fmt-check: Verifica el formato en Go, Rust y Frontend
fmt-check:
	$(MAKE) -C go-microservice fmt-check
	$(MAKE) -C tauri-app/src-tauri fmt-check
	cd tauri-app && npm run format:check

## lint: Ejecuta linters en Go, Rust (Clippy) y Frontend (ESLint)
lint:
	$(MAKE) -C go-microservice lint
	$(MAKE) -C tauri-app/src-tauri lint
	cd tauri-app && npm run lint

## typecheck: Verifica los tipos de TypeScript en el Frontend
typecheck:
	cd tauri-app && npm run typecheck

## test: Ejecuta pruebas unitarias en Go, Rust y Frontend
test:
	$(MAKE) -C go-microservice test
	$(MAKE) -C tauri-app/src-tauri test
	cd tauri-app && npm run test

## check: Ejecuta fmt-check + lint + typecheck + test en todo el monorepo
check: fmt-check lint typecheck test

## docker-up: Levanta el microservicio Go en Docker Compose
docker-up:
	mkdir -p workspace config
	docker compose up --build -d

## docker-down: Detiene el microservicio Go en Docker Compose
docker-down:
	docker compose down

## dev: Levanta la aplicación Tauri en modo desarrollo con Hot-Reload
dev:
	cd tauri-app && npm run tauri dev

## build: Compila el ejecutable nativo en tauri-app (entorno de desarrollo sin empaquetar)
build: build-bin

## build-bin: Compila el binario directo en tauri-app/src-tauri/target/release
build-bin:
	cd tauri-app && npm run tauri build -- --no-bundle

## release: Compila los paquetes de distribución para Linux (.deb/.rpm/AppImage) y los copia a /release/
release:
	cd tauri-app && npm run tauri build
	mkdir -p $(CURDIR)/release
	@find $(CURDIR)/tauri-app/src-tauri/target/release/bundle -type f \( -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" -o -name "*.tar.gz" \) -exec cp -f {} $(CURDIR)/release/ \; 2>/dev/null || true
	@echo "✓ Paquetes de release copiados en $(CURDIR)/release/"
	@ls -la $(CURDIR)/release/

## build-release: Alias de release para generar los paquetes de distribución
build-release: release

# ==============================================================================
# Comandos especiales individuales de empaquetado (Linux)
# ==============================================================================

## build-appimage: Genera el paquete portable AppImage para Linux
build-appimage:
	cd tauri-app && npm run tauri build -- -b appimage

## build-deb: Genera el paquete instalador .deb para Debian/Ubuntu
build-deb:
	cd tauri-app && npm run tauri build -- -b deb

## build-rpm: Genera el paquete instalador .rpm para Fedora/openSUSE
build-rpm:
	cd tauri-app && npm run tauri build -- -b rpm
