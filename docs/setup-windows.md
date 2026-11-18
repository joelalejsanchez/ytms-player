# Guía de Desarrollo y Puesta en Marcha en Windows (`docs/setup-windows.md`)

Esta guía detalla el entorno de desarrollo necesario para compilar, probar y modificar **ytms-player** en Windows 10 y Windows 11.

---

## 1. Dependencias del Sistema

### 1.1 Microsoft Visual Studio C++ Build Tools
Rust en Windows requiere las herramientas de compilación de C++ (MSVC):
1. Descarga el instalador de [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
2. En el instalador, selecciona la carga de trabajo **"Desarrollo para el escritorio con C++"** (*Desktop development with C++*).
3. Asegúrate de incluir el *SDK de Windows 10 o 11* y pulsa **Instalar**.

### 1.2 Microsoft Edge WebView2
WebView2 es el motor de renderizado de Tauri en Windows. Viene preinstalado de fábrica en Windows 10 (actualizado) y Windows 11. Si no lo tienes, puedes instalar el [WebView2 Runtime Evergreen](https://developer.microsoft.com/microsoft-edge/webview2/).

### 1.3 Rustup (Toolchain MSVC)
Instala el compilador oficial de Rust para Windows:
1. Descarga y ejecuta [rustup-init.exe](https://rustup.rs/).
2. Selecciona la instalación por defecto con el toolchain `stable-x86_64-pc-windows-msvc`.

### 1.4 Node.js LTS
Descarga e instala [Node.js LTS (v20 o superior)](https://nodejs.org/).

### 1.5 Docker Desktop
1. Instala [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/).
2. Durante la instalación, marca la opción recomendada: **Use WSL 2 instead of Hyper-V**.
3. Inicia Docker Desktop y espera a que el servicio esté en estado *Running*.

---

## 2. Instalación de Just (Task Runner Multiplataforma)

En Windows utilizamos **[Just](https://github.com/casey/just)** como reemplazo nativo de Make:
- Sitio oficial: [https://just.systems](https://just.systems)
- Repositorio oficial: [https://github.com/casey/just](https://github.com/casey/just)

Puedes instalarlo desde PowerShell con cualquiera de estos comandos:

```powershell
# Opción A (Recomendada con Winget):
winget install Casey.Just

# Opción B (Con Cargo):
cargo install just

# Opción C (Con Chocolatey o Scoop):
choco install just
# o
scoop install just
```

Verifica la instalación en PowerShell:
```powershell
just --version
```

---

## 3. Puesta en Marcha del Microservicio (Docker)

Desde la raíz del proyecto en PowerShell o CMD:

```powershell
just docker-up
# O directamente:
docker compose up -d --build
```

> [!WARNING]
> **Mantenimiento del contenedor de descargas:**  
> YouTube actualiza frecuentemente sus firmas y mecanismos de protección antibot. Si las descargas fallan, reconstruye la imagen del contenedor sin caché para obtener la versión más reciente de `yt-dlp`:
> ```powershell
> docker compose build --no-cache
> docker compose up -d
> ```

---

## 4. Ejecución en Modo Desarrollo

Instala las dependencias de Node.js:
```powershell
cd tauri-app
npm install
cd ..
```

Inicia la aplicación con recarga en caliente (Hot-Reload):
```powershell
just dev
```

---

## 5. Pruebas y Control de Calidad

Ejecuta las pruebas y linters en todo el monorepo (Go, Rust y React):
```powershell
just check
```

---

## 6. Compilación y Generación del Instalador (.msi / .exe)

En Windows no se requieren scripts manuales de accesos directos. Al compilar con Tauri, el sistema empaqueta un instalador nativo que registra el programa en el Menú Inicio, en el Escritorio y en *Agregar o quitar programas*:

```powershell
cd tauri-app
npm run tauri build
```

El instalador quedará listo en:
`tauri-app/src-tauri/target/release/bundle/msi/` o `/nsis/`.
Al hacer doble clic en el instalador, la app se instalará en Windows de forma estándar.
