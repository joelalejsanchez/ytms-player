CARGO=cargo

.PHONY: all fmt fmt-check lint test build clean check

all: check

fmt: ## Formatea el código Rust con rustfmt
	$(CARGO) fmt --all

fmt-check: ## Verifica el formato del código Rust sin modificar archivos
	$(CARGO) fmt --all -- --check

lint: ## Ejecuta Clippy con advertencias estrictas
	$(CARGO) clippy --all-targets -- -D warnings

test: ## Ejecuta las pruebas unitarias y de integración de Rust
	$(CARGO) test

build: ## Compila el backend de Tauri en modo release
	$(CARGO) build --release

clean: ## Limpia los artefactos de compilación de Cargo
	$(CARGO) clean

check: fmt-check lint test
