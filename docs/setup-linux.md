# Guía de Desarrollo y Puesta en Marcha en Linux (`docs/setup-linux.md`)

Esta guía detalla el entorno de desarrollo necesario para compilar, probar y modificar **ytms-player** en sistemas operativos Linux.

---

## 1. Dependencias del Sistema

### Arch Linux / Manjaro
```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg nodejs npm rustup docker docker-compose just
rustup default stable
```

### Ubuntu / Debian / Pop!_OS / Linux Mint
```bash
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev nodejs npm docker.io docker-compose-v2
# Instalar Rust y Just
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install just
```

### Fedora / RHEL
```bash
sudo dnf install -y webkit2gtk4.1-devel @development-tools curl wget openssl-devel \
  gtk3-devel libappindicator-gtk3-devel librsvg2-devel nodejs npm docker docker-compose
# Instalar Just
cargo install just  # o dnf install just
```

---

## 2. Configuración de Docker

Asegúrate de que tu usuario pueda utilizar Docker sin `sudo`:

```bash
sudo usermod -aG docker $USER
newgrp docker
sudo systemctl enable --now docker
```

---

## 3. Gestor de Comandos: Just (o Make)

Para orquestar las tareas en el monorepo recomendamos **[Just](https://github.com/casey/just)** (también puedes usar `make` tradicional):
- Sitio web oficial: [https://just.systems](https://just.systems)
- Repositorio oficial: [https://github.com/casey/just](https://github.com/casey/just)

Verifica que esté instalado:
```bash
just --version
```

---

## 4. Puesta en Marcha del Microservicio (Docker)

El microservicio en Go gestiona `yt-dlp` y `ffmpeg` para las descargas de YouTube:

```bash
# Construir y levantar el contenedor en segundo plano
just docker-up
# O con make:
make docker-up
```

> [!WARNING]
> **Mantenimiento del contenedor de descargas:**  
> YouTube actualiza frecuentemente sus firmas y mecanismos de protección antibot. Si las descargas comienzan a arrojar errores inesperados, reconstruye la imagen sin caché para que se instale la versión más reciente de `yt-dlp`:
> ```bash
> docker compose build --no-cache
> docker compose up -d
> ```

---

## 5. Ejecución en Modo Desarrollo

Instala las dependencias del frontend:
```bash
cd tauri-app && npm install && cd ..
```

Inicia la aplicación de escritorio en modo desarrollo con recarga en caliente (Hot-Reload):
```bash
just dev
# O con make:
make dev
```

---

## 6. Pruebas y Validación de Calidad

Ejecuta el conjunto unificado de formato, linter y pruebas en Go, Rust y React:
```bash
just check
# O con make:
make check
```

---

## 7. Compilación y Empaquetado

### Opción A: Empaquetado oficial del sistema (.deb, .rpm, AppImage)
Tauri genera automáticamente los instaladores de distribución que registran el acceso directo y los iconos en el sistema:
```bash
cd tauri-app
npm run tauri build
```
Los paquetes quedarán en `tauri-app/src-tauri/target/release/bundle/`.

### Opción B: Binario nativo aislado en `/release`
Si deseas compilar el binario nativo directo sin empaquetar:
```bash
just release
# O con make:
make release
```
El ejecutable resultante quedará en `/release/ytms-player`. Para registrarlo en tu menú de aplicaciones de escritorio en Linux, ejecuta el script auxiliar:
```bash
./scripts/install-desktop-shortcut.sh
```
