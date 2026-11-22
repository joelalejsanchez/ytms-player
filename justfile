# justfile para ytms-player Monorepo (Windows)
# https://github.com/casey/just

# Muestra los comandos disponibles en el monorepo
default:
    @just --list

# Formatea Go, Rust y Frontend (React/TS)
fmt:
    just --justfile go-microservice/justfile fmt
    just --justfile tauri-app/src-tauri/justfile fmt
    cd tauri-app && npm run format

# Verifica el formato en Go, Rust y Frontend
fmt-check:
    just --justfile go-microservice/justfile fmt-check
    just --justfile tauri-app/src-tauri/justfile fmt-check
    cd tauri-app && npm run format:check

# Ejecuta linters en Go, Rust (Clippy) y Frontend (ESLint)
lint:
    just --justfile go-microservice/justfile lint
    just --justfile tauri-app/src-tauri/justfile lint
    cd tauri-app && npm run lint

# Verifica los tipos de TypeScript en el Frontend
typecheck:
    cd tauri-app && npm run typecheck

# Ejecuta pruebas unitarias en Go, Rust y Frontend
test:
    just --justfile go-microservice/justfile test
    just --justfile tauri-app/src-tauri/justfile test
    cd tauri-app && npm run test

# Ejecuta fmt-check + lint + typecheck + test en todo el monorepo
check: fmt-check lint typecheck test

# Levanta el microservicio Go en Docker Compose
docker-up:
    docker compose up -d --build

# Detiene el microservicio Go en Docker Compose
docker-down:
    docker compose down

# Levanta la aplicación Tauri en modo desarrollo con Hot-Reload
dev:
    cd tauri-app && npm run tauri dev

# Compila el ejecutable nativo en tauri-app (entorno de desarrollo sin empaquetar)
build: build-bin

# Compila el binario directo en tauri-app/src-tauri/target/release
build-bin:
    cd tauri-app && npm run tauri build -- --no-bundle

# Compila los instaladores oficiales (.msi y .exe) y los copia a /release/
build-release:
    cd tauri-app && npm run tauri build
    node -e "const fs = require('fs'); const path = require('path'); const srcDir = path.join('tauri-app', 'src-tauri', 'target', 'release', 'bundle'); const destDir = 'release'; if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true }); function copyFiles(dir) { if (!fs.existsSync(dir)) return; for (const file of fs.readdirSync(dir)) { const full = path.join(dir, file); if (fs.statSync(full).isDirectory()) copyFiles(full); else if (/\.(msi|exe)$/i.test(file)) { const dest = path.join(destDir, file); fs.copyFileSync(full, dest); console.log('✓ Copiado ' + file + ' -> release/'); } } } copyFiles(srcDir);"

# Alias de build-release para generar los paquetes de distribución
release: build-release

# ==============================================================================
# Comandos especiales individuales de empaquetado (Windows)
# ==============================================================================

# Genera el instalador oficial MSI para Windows
build-msi:
    cd tauri-app && npm run tauri build -- -b msi

# Genera el instalador ejecutable NSIS (.exe) para Windows
build-exe:
    cd tauri-app && npm run tauri build -- -b nsis
