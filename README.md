# YouTube Desktop Player (ytms-player)

[![Release](https://img.shields.io/badge/version-1.6.0-red.svg)](docs/changelog.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8.svg)](https://go.dev/)
[![Rust](https://img.shields.io/badge/Rust-1.77+-black.svg)](https://www.rust-lang.org/)

Aplicación de escritorio nativa de alto rendimiento construida con **Tauri v2 (React/TypeScript + Rust/SQLite)** y un microservicio backend local en **Docker (Go + yt-dlp + FFmpeg)**. Diseñada para gestionar, descargar, organizar y reproducir contenido de YouTube de forma local y privada con arquitectura limpia desacoplada.

---

## Características Principales

* 🎵 **Motor de Streaming Nativo (HTTP 206 Partial Content):** Reproducción de audio local eficiente directamente desde disco con bajo consumo de CPU y memoria.
* 📁 **Workspaces Aislados:** Múltiples bibliotecas independientes organizadas con base de datos SQLite embebida por cada directorio de música.
* ❤️ **Favoritos y Likes Híbridos:** Sistema local de canciones favoritas en SQLite con soporte de sincronización bidireccional opcional con tu cuenta de YouTube.

---

## Guía de Instalación y Puesta en Marcha (Usuario Final)

### Requisito Base: Motor de Descargas (Docker)

La aplicación utiliza un microservicio local en Go que encapsula `yt-dlp` y `FFmpeg` para procesar descargas y metadatos sin ensuciar tu sistema operativo.

1. Asegúrate de tener instalado **Docker Desktop** (en Windows/macOS) o el servicio de **Docker** (en Linux).
2. Desde la raíz del proyecto, construye y levanta el servicio:
   ```bash
   docker compose up -d --build
   ```
   *(A partir de este paso, puedes iniciar o detener el contenedor cuando quieras desde Docker Desktop o con `docker compose up -d` / `docker compose down`)*.

> [!WARNING]
> **Mantenimiento y Actualizaciones del Contenedor:**  
> YouTube actualiza continuamente sus firmas y protecciones antibot. Si las descargas comienzan a arrojar errores inesperados, reconstruye el contenedor sin caché para obtener la versión más reciente de `yt-dlp`:
> ```bash
> docker compose build --no-cache
> docker compose up -d
> ```

---

### Instalación en Windows

1. Dirígete a la sección de **Releases** y descarga el instalador oficial para Windows:
   - Formato **`.msi`** (Microsoft Installer) o **`.exe`** (Asistente NSIS).
2. Ejecuta el archivo y sigue los pasos del asistente de instalación.
3. La aplicación creará automáticamente los accesos directos en el **Menú Inicio**, en el **Escritorio** y se registrará en el sistema.
4. Asegúrate de que Docker esté corriendo y abre la aplicación.

---

### Instalación en Linux

Descarga el paquete correspondiente a tu distribución desde la sección de **Releases**:

1. **Ubuntu / Debian / Pop!_OS / Linux Mint:**
   - Descarga el archivo **`.deb`**.
   - Instálalo con un clic en tu tienda de software o desde la terminal:
     ```bash
     sudo dpkg -i ytms-player_*_amd64.deb
     ```
   - Registra automáticamente el icono y lanzador en el menú de aplicaciones del sistema.
2. **Fedora / RHEL / openSUSE:**
   - Descarga el paquete **`.rpm`**.
   - Instálalo con doble clic o mediante:
     ```bash
     sudo dnf install ./ytms-player-*.x86_64.rpm
     ```
3. **Arch Linux / Manjaro u otras distribuciones:**
   - Descarga el paquete **`AppImage`** o el archivo comprimido **`.tar.gz`**.
   - Para el AppImage, concede permisos de ejecución y ábrelo directamente:
     ```bash
     chmod +x ytms-player_*.AppImage
     ./ytms-player_*.AppImage
     ```

---

### Configuración de Google Cloud Platform y Cookies (Opcional)

> [!NOTE]
> **ytms-player no requiere cuentas para funcionar al 100%.**  
> Puedes buscar, descargar, crear listas y reproducir sin iniciar sesión.

* **Sincronización de Likes con YouTube (Opcional):** Si deseas que tus Likes locales se marquen en tu cuenta oficial de YouTube, consulta la [Guía Opcional de Google Cloud Platform (`docs/setup-gcp.md`)](docs/setup-gcp.md).
* **Cookies de YouTube (`cookies.txt`) (Opcional):** Solo se requieren si necesitas descargar canciones restringidas por edad (+18) o contenido exclusivo. Puedes importar tu archivo `.txt` directamente en la pestaña *Configuración* de la app.

---

## ¿Quieres Realizar Modificaciones o Colaborar? (Guía Técnica)

Si deseas modificar el código fuente, agregar nuevas funcionalidades o compilar la aplicación por tu cuenta, consulta las guías de configuración del entorno de desarrollo:

* 🐧 **[Guía de Desarrollo en Linux (`docs/setup-linux.md`)](docs/setup-linux.md):** WebKitGTK 4.1, Rustup, Node.js y compilación local.
* 🪟 **[Guía de Desarrollo en Windows (`docs/setup-windows.md`)](docs/setup-windows.md):** Visual Studio C++ Build Tools, WebView2, Rustup (MSVC) y Docker Desktop WSL2.

### Automatización Multiplataforma con Just

El monorepo utiliza **[Just](https://github.com/casey/just)** ([https://just.systems](https://just.systems)) como orquestador de tareas universal (reemplazo moderno y multiplataforma de Make compatible con Windows, Linux y macOS):

```bash
just dev         # Inicia la aplicación en modo desarrollo con Hot-Reload
just check       # Ejecuta fmt-check + lint + test en Go, Rust y React
just build       # Compila el ejecutable nativo de desarrollo
just release     # Genera el ejecutable de producción en /release/
just docker-up   # Construye y levanta el microservicio en Docker
just docker-down # Detiene el microservicio en Docker
```

*(En Linux también se mantiene compatibilidad con `make dev`, `make check`, `make release`, etc.)*.

---

## Documentación Adicional

- [Registro de Cambios (`docs/changelog.md`)](docs/changelog.md): Historial cronológico de versiones y novedades.
- [Backlog e Ideas Futuras (`docs/backlog.md`)](docs/backlog.md): Roadmap técnico y mejoras planificadas.
- [Especificación de Diseño de Software (`docs/sdd.md`)](docs/sdd.md): Arquitectura detallada, diagramas de secuencia y contratos de API.
