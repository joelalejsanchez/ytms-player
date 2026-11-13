# ytms-player Monorepo

Aplicación de escritorio nativa de alto rendimiento construida con **Tauri v2 (React/TypeScript + Rust/SQLite)** y un microservicio backend autohospedado en **Docker (Go + yt-dlp + FFmpeg)**, siguiendo **Clean Architecture** de 4 capas.

---

## Estructura del Proyecto

```text
/
├── docs/                       # Especificación de diseño (sdd.md) y guías (skills/)
├── config/                     # Montaje de solo lectura (:ro) para cookies.txt
├── go-microservice/            # Microservicio Go (Clean Architecture: domain, usecases, adapters, handlers)
├── tauri-app/                  # Aplicación de escritorio Tauri
│   ├── src/                    # Frontend React + TypeScript + Zustand + Zod + Tailwind
│   └── src-tauri/              # Backend Nativo Rust + SQLite (Clean Architecture)
├── docker-compose.yml          # Orquestación del microservicio Go y volúmenes de workspace
└── Makefile                    # Comandos globales de formateo, linting y pruebas
```

---

## Comandos de Formateo, Linter y Pruebas por Capa

### 1. Microservicio Go (`/go-microservice`)

Configurado con `Makefile`, `gofmt`, `go vet` y `.golangci.yml`:

```bash
cd go-microservice
make fmt          # Formatea el código con gofmt -s -w
make fmt-check    # Verifica que el formato sea válido
make vet          # Ejecuta análisis estático oficial go vet
make lint         # Ejecuta fmt-check + go vet + golangci-lint
make test         # Ejecuta pruebas unitarias y de handlers HTTP/SSE
make build        # Compila el binario estático en bin/ytms-player-go
```

### 2. Backend Rust de Tauri (`/tauri-app/src-tauri`)

Configurado con `rustfmt.toml`, `clippy.toml`, `[lints]` en `Cargo.toml` y `Makefile`:

```bash
cd tauri-app/src-tauri
make fmt          # Formatea el código Rust con cargo fmt
make fmt-check    # Verifica el formato con cargo fmt --check
make lint         # Ejecuta cargo clippy --all-targets -- -D warnings
make test         # Ejecuta las pruebas unitarias de SQLite, integridad y casos de uso
```

### 3. Frontend Web React / TypeScript (`/tauri-app`)

Configurado con **ESLint 9** (`eslint.config.js`), **Prettier** (`.prettierrc`), **TypeScript** (`tsconfig.json`) y **Vitest**:

```bash
cd tauri-app
npm install
npm run format        # Formatea con Prettier
npm run format:check  # Verifica formato con Prettier
npm run lint          # Ejecuta ESLint sin permitir warnings
npm run typecheck     # Verifica tipos con tsc --noEmit
npm run test          # Ejecuta pruebas unitarias con Vitest
```

### 4. Ejecución del Proyecto

```bash
# 1. Levantar el microservicio Go en Docker
make docker-up

# 2. Iniciar la aplicación de escritorio Tauri en modo desarrollo
cd tauri-app
npm install
npm run tauri dev
```
