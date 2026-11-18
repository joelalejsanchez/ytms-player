# justfile para ytms-player Monorepo
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

# Ejecuta pruebas unitarias en Go, Rust y Frontend
test:
    just --justfile go-microservice/justfile test
    just --justfile tauri-app/src-tauri/justfile test
    cd tauri-app && npm run test

# Ejecuta fmt-check + lint + test en todo el monorepo
check: fmt-check lint test

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

# Genera el paquete portable AppImage para Linux
build-appimage:
    cd tauri-app && npm run tauri build -- -b appimage

# Genera el paquete instalador .deb para Debian/Ubuntu
build-deb:
    cd tauri-app && npm run tauri build -- -b deb

# Genera el paquete instalador .rpm para Fedora/openSUSE
build-rpm:
    cd tauri-app && npm run tauri build -- -b rpm

# Compila los instaladores oficiales (.msi/.exe en Windows o .deb/AppImage/.rpm en Linux) y los copia a /release/
release:
    cd tauri-app && npm run tauri build
    node -e "const fs = require('fs'); const path = require('path'); const srcDir = path.join('tauri-app', 'src-tauri', 'target', 'release', 'bundle'); const destDir = 'release'; if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true }); function copyFiles(dir) { if (!fs.existsSync(dir)) return; for (const file of fs.readdirSync(dir)) { const full = path.join(dir, file); if (fs.statSync(full).isDirectory()) copyFiles(full); else if (/\.(msi|exe|deb|rpm|AppImage|tar\.gz)$/i.test(file)) { const dest = path.join(destDir, file); fs.copyFileSync(full, dest); console.log('✓ Copiado ' + file + ' -> release/'); } } } copyFiles(srcDir);"
