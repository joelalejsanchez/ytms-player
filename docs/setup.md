# Guía de Instalación, Configuración y Puesta en Marcha (`docs/setup.md`)

Esta guía describe los requisitos previos del sistema operativo, la configuración de Google Cloud Platform (OAuth 2.0 con permisos de lectura y calificación de likes), la puesta en marcha del microservicio Go con Docker y la compilación/ejecución de la aplicación de escritorio nativa **ytms-player** (Tauri v2 + React).

---

## 1. Dependencias del Sistema Operativo

### En Arch Linux (Recomendado)
Instala las bibliotecas de sistema necesarias para compilar y ejecutar **Tauri v2 (WebKitGTK 4.1)**:

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg nodejs npm rustup docker docker-compose
```

Asegúrate de que tu usuario tenga permisos para usar Docker sin `sudo`:
```bash
sudo usermod -aG docker $USER
newgrp docker
sudo systemctl enable --now docker
```

*(Opcional para linting avanzado en Go)*:
```bash
sudo pacman -S --needed golangci-lint
```

### En Windows 10 / 11
1. **Microsoft Visual Studio C++ Build Tools**: Instala el workload *"Desktop development with C++"*.
2. **Microsoft Edge WebView2**: Incluido por defecto en Windows 10/11.
3. **Rustup**: Instala el toolchain `stable-x86_64-pc-windows-msvc`.
4. **Node.js LTS** (versión 20+).
5. **Docker Desktop** con motor WSL2 backend habilitado.

---

## 2. Configuración de Google Cloud Platform (OAuth 2.0 y Likes)

Para que **ytms-player** pueda consultar tus Likes al descargar y marcar automáticamente los Likes que des en la app local hacia tu cuenta de YouTube:

### 2.1 Habilitar la API de YouTube
1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto (por ejemplo `ytms-player`).
3. Ve a **APIs & Services -> Library**, busca **YouTube Data API v3** y pulsa **Enable / Habilitar**.

### 2.2 Configurar la Pantalla de Consentimiento OAuth (OAuth Consent Screen)
1. Ve a **APIs & Services -> OAuth consent screen** (o **Google Auth Platform**).
2. Selecciona **User Type: External / Externo** y pulsa **Create**.
3. **Información básica de la app**:
   - *App name*: `ytms-player`
   - *User support email*: Tu correo de Gmail.
   - *Developer contact information*: Tu correo de Gmail.
4. **Scopes / Permisos (¡Crucial para dar Like!)**:
   - Pulsa **Add or Remove Scopes**.
   - Agrega el permiso con acceso a calificaciones:
     ```text
     https://www.googleapis.com/auth/youtube.force-ssl
     ```
     *(Este permiso permite leer y enviar Likes/Dislikes vía `videos.rate`)*.
   - Pulsa **Update** y luego **Save and Continue**.
5. **Test Users / Usuarios de prueba**:
   - En la sección **Audience / Test users**, pulsa **+ Add Users** y escribe **tu correo de Gmail**.
   - *(Si no agregas tu correo, Google rechazará la conexión con error `403: access_denied` mientras la app esté en modo Testing)*.

### 2.3 Generar Credenciales OAuth 2.0
1. Ve a **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**.
2. **Application type**: Selecciona **Web application**.
3. **Name**: `ytms-player-desktop`.
4. **Authorized redirect URIs (URIs de redireccionamiento autorizados)**:
   Agrega exactamente:
   ```text
   http://127.0.0.1:8080/api/oauth/callback
   ```
5. Pulsa **Create** y copia tu **Client ID** y **Client Secret**.

### 2.4 Variables de Entorno (`.env`)
En la raíz del repositorio, copia el archivo de ejemplo:
```bash
cp .env.example .env
```
Edita `.env` e introduce tus credenciales:
```env
OAUTH_MOCK_MODE=false
OAUTH_CLIENT_ID=tu-id-de-cliente.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=tu-client-secret
OAUTH_REDIRECT_URI=http://127.0.0.1:8080/api/oauth/callback
```

---

## 3. Archivo `cookies.txt` (Para Videos Restringidos o con Inicio de Sesión)

Para descargar canciones restringidas por edad o exclusivas:
1. Exporta tus cookies de YouTube desde tu navegador usando una extensión de exportación en formato Netscape (`cookies.txt`).
2. Tienes dos formas de usarlo:
   - **Desde la app (Recomendado)**: Ve a la pestaña **Configuración -> Gestión de Cookies de YouTube** y pulsa **Buscar .txt** y **Actualizar Cookies**. Se aplicará de inmediato sin reiniciar.
   - **En el sistema de archivos**: Guarda el archivo en `./config/cookies.txt`.

---

## 4. Puesta en Marcha del Microservicio Go (Docker)

El microservicio contiene `yt-dlp` y `FFmpeg` aislados dentro del contenedor Docker:

```bash
docker compose up -d --build
```

Para verificar que esté en ejecución:
```bash
curl http://127.0.0.1:8080/api/health
```
Debe responder: `{"status":"healthy", ...}`.

---

## 5. Compilación y Ejecución de la Aplicación de Escritorio

### 5.1 Instalar dependencias de Node.js
```bash
cd tauri-app
npm install
```

### 5.2 Modo Desarrollo
Inicia la aplicación en modo desarrollo con recarga en caliente:
```bash
npm run tauri dev
```

### 5.3 Compilación para Distribución (Release)
Para generar el binario ejecutable y paquetes para tu distribución Linux (`.deb`, `.tar.gz`, `AppImage` o ejecutable nativo):
```bash
npm run tauri build
```
Los archivos compilados quedarán listos en:
`tauri-app/src-tauri/target/release/`
y en `tauri-app/src-tauri/target/release/bundle/`.

---

## 6. Primeros Pasos dentro de la Aplicación

1. **Seleccionar Workspace**: Al abrir la app, selecciona una carpeta para tus archivos de música (por defecto: `~/Music/ytms-player`). La app creará automáticamente la base de datos SQLite y las carpetas `tracks/` y `thumbnails/`.
2. **Conectar YouTube (Opcional)**: En la pestaña **Configuración**, pulsa **Conectar con Google** para sincronizar tus Likes.
3. **Descargar**: Pega cualquier enlace de video, Playlist o Mix de YouTube en la pestaña **Descargas**.
