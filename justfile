# justfile para ytms-player Monorepo
# https://github.com/casey/just

# Muestra los comandos disponibles
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

# Compila el ejecutable nativo en tauri-app (entorno de desarrollo)
build:
    cd tauri-app && npm run tauri build -- --no-bundle

# Genera el binario de producción en la carpeta raíz (/release/)
release: build
    node -e "const fs = require('fs'); const path = require('path'); const isWin = process.platform === 'win32'; const binName = isWin ? 'ytms-player.exe' : 'ytms-player'; const src = path.join('tauri-app', 'src-tauri', 'target', 'release', binName); const destDir = 'release'; const dest = path.join(destDir, binName); if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true }); fs.copyFileSync(src, dest); console.log('✓ Binario de producción copiado en ' + dest);"
