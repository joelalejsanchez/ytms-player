# Checklist de Insumos y Requisitos para Pruebas End-to-End y Producción (`docs/todo.md`)

Este documento lista exactamente lo que necesitas tener a mano o proporcionarme para completar la integración real con servicios externos (Google OAuth 2.0 / YouTube Data API v3), probar descargas reales y preparar el empaquetado final de **ytms-player** para producción (Linux y Windows).

---

## 1. Credenciales de Google Cloud Platform (Para `/api/sync-likes` con OAuth 2.0 Real)

Actualmente el adaptador `YouTubeLikesAdapter` tiene soporte tanto para modo simulado (`OAUTH_MOCK_MODE=true`) como para la API real de YouTube (`https://www.googleapis.com/youtube/v3/videos/getRating`). Para activar la sincronización real sin mocks necesitas:

- [ ] **Proyecto en Google Cloud Console** con la API **YouTube Data API v3** habilitada.
- [ ] **Pantalla de consentimiento OAuth (OAuth Consent Screen):**
  - Tipo: *External* (en modo Testing puedes agregar tu correo de Google como *Test User* sin pasar por verificación de Google).
  - Scope requerido: `https://www.googleapis.com/auth/youtube.readonly` (para consultar el estado de likes de tus videos).
- [ ] **Credenciales OAuth 2.0 (Client ID & Client Secret):**
  - Tipo de aplicación recomendada: **Desktop App** (o *Web Application* con Redirect URI `http://127.0.0.1:8080/api/oauth/callback`).
  - Valores a proporcionar en `.env`:
    - `OAUTH_CLIENT_ID=...`
    - `OAUTH_CLIENT_SECRET=...`
    - `OAUTH_MOCK_MODE=false`

---

## 2. Archivo `cookies.txt` (Para Descargas Restringidas o por Edad en `yt-dlp`)

- [ ] **Exportar `cookies.txt` en formato Netscape:**
  - Puedes exportarlo desde tu navegador usando una extensión como *"Get cookies.txt LOCALLY"* en una sesión activa de YouTube.
  - **No necesitas recompilar Docker ni Tauri al actualizarlo:** puedes cargarlo directamente desde la pestaña **Workspace -> Gestión de Cookies de YouTube** en la UI de Tauri, o colocarlo en `./config/cookies.txt`.

---

## 3. Dependencias del Sistema Operativo Anfitrión (Antes de Compilar Tauri)

### En Arch Linux (tu entorno actual)
- [ ] Verificar paquetes nativos requeridos por **Tauri v2** (WebKitGTK 4.1) y herramientas de linter:
  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
  ```
- [ ] *(Opcional para linting avanzado en Go)* Instalar `golangci-lint`:
  ```bash
  sudo pacman -S --needed golangci-lint
  ```

### En Windows (si deseas compilar el instalador `.msi` / `.exe`)
- [ ] **Microsoft Visual Studio C++ Build Tools** (Desktop development with C++).
- [ ] **Microsoft Edge WebView2 Runtime** (incluido por defecto en Windows 10/11).
- [ ] **Rustup** (`x86_64-pc-windows-msvc`) + **Node.js LTS** + **Docker Desktop** (con WSL2 backend).

---

## 4. Definición de Rutas de Volumen Docker ↔ Host para Producción

- [ ] Confirmar cuál será tu **directorio raíz padre** donde guardarás tus Workspaces en tu máquina (ej. `/home/joelsanchz/Music/YtmsPlayerWorkspaces` en Linux o `C:/Users/TuUsuario/Music/YtmsPlayerWorkspaces` en Windows).
- [ ] Configurar esa ruta en el archivo `.env` en la raíz del proyecto:
  ```env
  YTMS_PLAYER_WORKSPACE_HOST=/home/joelsanchz/Music/YtmsPlayerWorkspaces
  HOST_WORKSPACE_PREFIX=/home/joelsanchz/Music/YtmsPlayerWorkspaces
  CONTAINER_WORKSPACE_PREFIX=/app/workspace
  ```
  *(Así cualquier sub-carpeta de Workspace que crees o selecciones en Tauri dentro de ese directorio será accesible tanto por Rust como por el contenedor Docker de Go).*

---

## 5. URLs de Prueba para Validación End-to-End

Para la sesión de pruebas funcionales completas, ten a mano:
- [ ] **1 URL de video corto de dominio público / Creative Commons** (para probar descarga en `.mp3`, `.m4a` y `.opus`, incrustación de miniatura `.jpg` y tags ID3/Vorbis).
- [ ] **1 URL de Playlist pública pequeña (2 a 5 videos)** (para probar creación automática de playlist en SQLite, progreso concurrente por SSE con el Worker Pool y prevención de duplicados).
- [ ] **Prueba de recuperación (`is_missing = 1`):** borrar manualmente un `.mp3` de la carpeta `/tracks` del Workspace, pulsar **"Verificar Integridad"** en la app y luego **"Re-descargar / Restaurar"** en el panel de Recuperación.

---

## 6. Identidad de Empaquetado y Firma para Producción (Opcional)

- [ ] Icono definitivo de la aplicación en alta resolución (`1024x1024 PNG`) para generar automáticamente los `.icns`, `.ico` y `.png` con `npx tauri icon`.
- [ ] Identificador de bundle definitivo en `tauri.conf.json` (actualmente `com.ytms-player.desktop`).
