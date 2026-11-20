# Your Tracks Music Server (ytms-player)

[![Release](https://img.shields.io/badge/version-1.9.6-red.svg)](docs/changelog.md)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8.svg)](https://go.dev/)
[![Rust](https://img.shields.io/badge/Rust-1.77+-black.svg)](https://www.rust-lang.org/)

Reproductor y organizador de audio local de alto rendimiento y bajo consumo, construido con **Tauri v2 (React/TypeScript + Rust/SQLite)**. Diseñado para gestionar, indexar y reproducir tus colecciones musicales privadas con streaming nativo directo desde disco, soporte para múltiples espacios de trabajo (*workspaces*) y un módulo complementario opcional para importar pistas y listas remotas mediante enlaces.

---

## Características Principales

* 🎵 **Reproductor de Música Local Nativo:** Transmisión de audio eficiente mediante HTTP 206 Partial Content directamente desde tus carpetas de música, sin saturar la memoria RAM.
* 📁 **Gestión Libre de Archivos y Workspaces:** Copia libremente tus archivos de música (`.mp3`, `.m4a`, `.opus`, etc.) dentro de la carpeta `tracks/` del espacio de trabajo; la aplicación los detecta e indexa automáticamente en su base de datos SQLite integrada.
* 📊 **Dashboard y Métricas:** Panel principal de bienvenida con estadísticas de duración acumulada, recuento de pistas, uso de almacenamiento en disco, pistas recientes y acceso rápido a playlists.
* 🎨 **Listas de Reproducción con Portadas Dinámicas:** Generación automática de carátulas para tus playlists, reproducción con un solo clic (*Quick Play*) y visualizadores de audio reactivos integrados.
* ⬇️ **Módulo Opcional de Importación Remota:** Soporte complementario para descargar pistas o playlists completas pegando enlaces de audio mediante un microservicio local en Docker.

---

## Instalación (Usuario Final)

Descarga el instalador o ejecutable correspondiente a tu sistema operativo desde la sección de **[Releases](https://github.com/joelsanchz/yt-player/releases)**:

### Windows 🪟
1. Descarga el instalador oficial: formato **`.msi`** (Microsoft Installer) o **`.exe`** (Asistente de instalación).
2. Ejecuta el asistente y abre **Your Tracks Music Server** desde tu Menú Inicio o Escritorio.
3. Selecciona tu carpeta de música para comenzar a reproducir al instante.

### Linux 🐧
* **Ubuntu / Debian / Pop!_OS / Linux Mint:** Descarga el archivo **`.deb`** e instálalo con doble clic o con `sudo dpkg -i ytms-player_*_amd64.deb`.
* **Fedora / RHEL / openSUSE:** Descarga el archivo **`.rpm`** e instálalo con `sudo dnf install ./ytms-player-*.x86_64.rpm`.
* **Arch Linux / Universales:** Descarga el paquete universal **`.AppImage`**, dale permisos de ejecución (`chmod +x ytms-player_*.AppImage`) y ejecútalo directamente.

---

## Módulo Opcional: Microservicio de Descargas (Docker)

> [!NOTE]
> **El reproductor no requiere Docker para escuchar tu música local.**  
> Puedes copiar tus canciones directamente a tu carpeta de música y reproducirlas de inmediato.

Si además deseas importar música remotamente pegando enlaces de listas o canciones, puedes levantar el microservicio complementario en segundo plano:

1. Asegúrate de tener **Docker Desktop** (en Windows/macOS) o **Docker** activo (en Linux).
2. Desde la terminal en la raíz del proyecto:
   ```bash
   docker compose up -d
   ```

---

### Integraciones Remotas Opcionales (OAuth / Cookies)

> [!NOTE]
> **Your Tracks Music Server no requiere cuentas externas para funcionar al 100%.**  
> Puedes organizar, copiar carpetas locales, crear listas y reproducir toda tu música sin iniciar sesión.

* **Sincronización remota (Opcional):** Si deseas sincronizar Likes con cuentas externas, consulta la [Guía Opcional de Configuración (`docs/setup-gcp.md`)](docs/setup-gcp.md).
* **Gestión de Cookies de Sesión (`cookies.txt`) (Opcional):** Solo si utilizas el microservicio complementario para respaldar contenido con restricciones de sesión, puedes importar tu archivo `.txt` directamente en la pestaña *Configuración* de la aplicación.

---

## ¿Quieres Realizar Modificaciones o Colaborar? (Guía Técnica)

Si deseas modificar el código fuente, agregar nuevas funcionalidades o colaborar con el proyecto, consulta nuestras guías técnicas y de desarrollo:

* 🤝 **[Guía de Contribución y Buenas Prácticas (`CONTRIBUTING.md`)](CONTRIBUTING.md):** Estándares de desarrollo, optimización de rendimiento (React/Rust/Go), formato de commits atómicos y pre-flight checks.
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

- [Guía de Contribución (`CONTRIBUTING.md`)](CONTRIBUTING.md): Pautas de colaboración, formato de commits y rendimiento.
- [Registro de Cambios (`docs/changelog.md`)](docs/changelog.md): Historial cronológico de versiones y novedades.
- [Backlog e Ideas Futuras (`docs/backlog.md`)](docs/backlog.md): Roadmap técnico y mejoras planificadas.
- [Especificación de Diseño de Software (`docs/sdd.md`)](docs/sdd.md): Arquitectura detallada, diagramas de secuencia y contratos de API.
