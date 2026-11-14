# Checklist de Insumos y Requisitos para Pruebas End-to-End y Producción (`docs/todo.md`)

Este documento registra el progreso de configuración e integración con servicios externos (Google OAuth 2.0 / YouTube Data API v3), pruebas de descarga reales y preparación de **ytms-player**.

---

## 1. Credenciales de Google Cloud Platform (Para `/api/sync-likes` con OAuth 2.0 Real)

- [x] **Proyecto en Google Cloud Console** con la API **YouTube Data API v3** habilitada.
- [ ] **Pantalla de consentimiento OAuth (OAuth Consent Screen):**
  1. Entra a [Google Cloud Console -> OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) (asegúrate de tener seleccionado tu proyecto arriba).
  2. Si ves la interfaz nueva (**Google Auth Platform**), haz clic en **Get Started / Comenzar** (o en la vista clásica selecciona **User Type: External / Externo** y pulsa **Create**).
  3. **App Information:**
     - *App name*: `ytms-player`
     - *User support email*: selecciona tu correo de Google.
     - *Developer contact information*: escribe tu correo de Google.
  4. **Data Access / Scopes (Permisos):**
     - Haz clic en **Add or Remove Scopes**.
     - Busca `youtube.readonly` y marca la casilla de:
       `https://www.googleapis.com/auth/youtube.readonly` (*View your YouTube account*).
     - Pulsa **Update** y luego **Save and Continue**.
  5. **Audience / Test Users (Usuarios de prueba - ¡MUY IMPORTANTE!):**
     - Mientras el estado de publicación sea **Testing** (no necesitas enviarlo a revisión de Google para uso tuyo y de tus amigos), ve a la sección **Audience / Test users** y pulsa **+ Add Users**.
     - Agrega **tu correo de Gmail** (y los correos de tus amigos desarrolladores si van a usar el mismo Client ID). Si no agregas tu correo aquí, Google mostrará `Error 403: access_denied` al intentar iniciar sesión.
- [ ] **Credenciales OAuth 2.0 (Client ID & Client Secret):**
  1. En el menú lateral izquierdo, ve a **APIs & Services -> Credentials** (o **Google Auth Platform -> Clients**).
  2. Haz clic arriba en **+ Create Credentials -> OAuth client ID**.
  3. En **Application type**, selecciona **Web application** (esto permite definir explícitamente la URL de redirección local exacta hacia el microservicio).
  4. En **Name**, escribe `ytms-player-desktop`.
  5. En **Authorized redirect URIs**, haz clic en **+ Add URI** y pega exactamente:
     ```text
     http://127.0.0.1:8080/api/oauth/callback
     ```
  6. Haz clic en **Create**. Te aparecerá una ventana con tu **Client ID** y tu **Client Secret**.
  7. Crea tu archivo `.env` en la raíz del repositorio (`cp .env.example .env`) y pega ambos valores:
     ```env
     OAUTH_MOCK_MODE=false
     OAUTH_CLIENT_ID=tu-client-id.apps.googleusercontent.com
     OAUTH_CLIENT_SECRET=GOCSPX-tu-client-secret
     OAUTH_REDIRECT_URI=http://127.0.0.1:8080/api/oauth/callback
     ```

---

## 2. Archivo `cookies.txt` (Para Descargas Restringidas o por Edad en `yt-dlp`)

- [x] **Exportar `cookies.txt` en formato Netscape:**
  - Puedes cargarlo directamente desde la pestaña **Workspace -> Gestión de Cookies de YouTube** en la UI de Tauri, o colocarlo en `./config/cookies.txt`.

---

## 3. Dependencias del Sistema Operativo Anfitrión (Antes de Compilar Tauri)

### En Arch Linux (tu entorno actual)
- [x] Verificar paquetes nativos requeridos por **Tauri v2** (WebKitGTK 4.1) y herramientas de linter:
  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
  ```
- [x] *(Opcional para linting avanzado en Go)* Instalar `golangci-lint`:
  ```bash
  sudo pacman -S --needed golangci-lint
  ```

### En Windows *(Pospuesto para fase futura)*
- [ ] **Microsoft Visual Studio C++ Build Tools** (Desktop development with C++).
- [ ] **Microsoft Edge WebView2 Runtime** (incluido por defecto en Windows 10/11).
- [ ] **Rustup** (`x86_64-pc-windows-msvc`) + **Node.js LTS** + **Docker Desktop** (con WSL2 backend).

---

## 4. Rutas de Volumen Dinámicas y Multiplataforma (Linux `$HOME` y Windows `%USERPROFILE%`)

- [x] **Configuración dinámica sin rutas fijas en `docker-compose.yml` y `.env.example`:**
  - `docker-compose.yml` ahora utiliza interpolación multiplataforma nativa:
    ```yaml
    ${YTMS_PLAYER_WORKSPACE_HOST:-${HOME:-${USERPROFILE}}/Music/ytms-player}:/app/workspace
    ```
  - **En Linux/macOS:** Docker Compose resuelve `${HOME}` automáticamente a `/home/<tu_usuario>/Music/ytms-player`.
  - **En Windows:** Docker Compose resuelve `${USERPROFILE}` automáticamente a `C:\Users\<TuAmigo>\Music\ytms-player`.
  - Además, `WorkspacePathResolver` en Go normaliza separadores `\` y `/` e insensibilidad de mayúsculas en unidades de Windows (`C:/` vs `c:/`), permitiendo compartir el repositorio en Git sin rutas hardcodeadas.

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
