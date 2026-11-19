# Guía de Contribución (`CONTRIBUTING.md`)

¡Gracias por tu interés en contribuir a **Your Tracks Music Server (YTMS)**!

Este proyecto tiene como objetivo ofrecer un reproductor y gestor de audio local independiente, de alto rendimiento, bajo consumo de recursos y enfocado en la propiedad y privacidad de la biblioteca musical del usuario.

Para mantener la calidad, estabilidad y coherencia de la base de código, solicitamos a todos los colaboradores seguir estas directrices, basadas en nuestros estándares de **documentación y flujo de versiones** y **optimización de rendimiento**.

---

## 1. Flujo de Commits y Versionamiento

### 1.1 Enfoque en Features y Commits Atómicos

- **Commits transversales pero cohesivos:** Un commit puede abarcar cambios en Backend (Go), Core nativo (Rust/Tauri) y Frontend (React/TS), siempre que todas las modificaciones correspondan a la **misma funcionalidad o solución específica (feature)**.
- **Commits de una sola línea:** Los mensajes de commit deben ser breves, claros y estrictamente de **una sola línea** siguiendo el estándar [Conventional Commits](https://www.conventionalcommits.org/):
  ```bash
  feat(downloads): agregar selector switch para canciones individuales
  fix(player): eliminar animacion de salto elastico en seek bar
  refactor(streaming): optimizar lectura de rangos http 206
  style(frontend): normalizar espaciado con prettier
  docs(changelog): registrar novedades de la version 1.7.5
  ```
- **Prohibido mezclar versiones:** Jamás agrupes cambios pertenecientes a múltiples versiones o releases en un solo commit.
- **Releases impulsadas por Backend:** Si un cambio en Go o Docker requiere una release, se gestiona como una etapa completa de release (con su bump de versión correspondiente), incluso si la interfaz de usuario no fue modificada.
- **Staging explícito:** Evita `git add .` o `git add -A`. Añade explícitamente los archivos afectados (`git add ruta/archivo.ext` o mediante la herramienta de git de tu editor de código) para no incluir ficheros accidentales.

### 1.2 Puntos de Sincronización de Versión

Cuando un cambio amerite incrementar la versión (Minor o Patch), debe sincronizarse en los **7 lugares obligatorios**:

| #   | Archivo                                                      | Campo / Ubicación                                                                                       |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1   | `tauri-app/package.json`                                     | `"version": "x.y.z"`                                                                                    |
| 2   | `tauri-app/src-tauri/Cargo.toml`                             | `version = "x.y.z"`                                                                                     |
| 3   | `tauri-app/src-tauri/Cargo.lock`                             | Sincronizado automáticamente con `cargo check`                                                          |
| 4   | `tauri-app/src-tauri/tauri.conf.json`                        | `"version": "x.y.z"`                                                                                    |
| 5   | `README.md`                                                  | Badge de versión: `[![Release](https://img.shields.io/badge/version-x.y.z-red.svg)](docs/changelog.md)` |
| 6   | `docs/changelog.md`                                          | Nueva sección `## [x.y.z] - YYYY-MM-DD`                                                                 |
| 7   | `tauri-app/src/features/workspace/WorkspaceSettingsView.tsx` | `<Badge tone="info">vx.y.z</Badge>`                                                                     |

### 1.3 Higiene de Backlog y Changelog

- **Backlog (`docs/backlog.md`):** Al completar una tarea registrada, retírala del backlog para mantenerlo enfocado exclusivamente en ítems pendientes (no dejar checkboxes `[x]`).
- **Changelog (`docs/changelog.md`):** Registra los cambios de forma clara bajo las secciones estándar: `### Añadido`, `### Corregido` o `### Mejorado`.

---

## 2. Pautas de Optimización de Rendimiento

El rendimiento y el bajo consumo de recursos son prioridades arquitectónicas de YTMS. Todo código nuevo o refactorizado debe respetar las siguientes directrices:

### 2.1 Frontend (React 18 + Tauri + Zustand + Tailwind)

- **Memoización Estricta (`React.memo`):** Aplica memoización en componentes repetitivos o listas densas (ej. `TrackRow`, tarjetas de playlists en `HomeView`, items de colas) para evitar re-renderizados masivos cuando el reproductor global actualice su progreso por segundo.
- **Estabilidad Referencial (`useCallback` y `useMemo`):**
  - Envuelve en `useCallback` cualquier función o manejador de eventos transmitido como prop a componentes hijos memoizados.
  - Envuelve en `useMemo` cálculos costosos, filtros de búsqueda y ordenamientos de biblioteca.
- **Zustand Stores Granulares y Selectores:**
  - Mantén el estado dividido en stores específicos (`usePlayerStore`, `useLibraryStore`, `useDownloadStore`, `useThemeStore`).
  - Utiliza selectores precisos (ej. `usePlayerStore(s => s.isPlaying)`) en lugar de extraer el store completo, garantizando que el componente solo reaccione a los cambios que le competen.
- **Virtualización de Listas:**
  - Cuando una vista maneje cientos o miles de elementos en el DOM (como la biblioteca de canciones), utiliza virtualización (`@tanstack/react-virtual`) para renderizar exclusivamente los elementos visibles en el viewport.

### 2.2 Backend y Core (Rust & Go Microservice)

- **Streaming Eficiente en Rust:** La entrega de audio local se realiza mediante un servidor HTTP nativo con soporte estricto de `206 Partial Content` y chunks acotados (64 KB). Nunca cargues archivos de audio completos en memoria RAM.
- **Worker Pool y Concurrencia Acotada (Go):**
  - Todas las tareas pesadas de descarga (`yt-dlp`) y conversión (`ffmpeg`) deben ejecutarse a través del worker pool con semáforos de concurrencia limitados (3 workers por defecto).
  - Nunca dispares descargas concurrentes ilimitadas que puedan saturar la CPU o bloquear el I/O del disco.
- **Manejo de Buffers y Descriptores:**
  - Procesa las salidas de procesos externos mediante streams para emitir eventos SSE sin acumular basura en memoria.
  - Asegura el cierre inmediato de ficheros, descriptores y cuerpos de respuesta HTTP con `defer` para evitar fugas de recursos en servicios de larga duración.

---

## 3. Verificaciones Obligatorias (Pre-flight Checks)

Antes de abrir un Pull Request o proponer cambios, asegúrate de que todos los linters, formateadores y suites de pruebas pasen satisfactoriamente en tu entorno local:

```bash
# Opción rápida con Just (recomendada):
just check

# O verificaciones manuales por tecnología:

# 1. Frontend (React / TypeScript):
cd tauri-app
npm run typecheck     # tsc --noEmit (0 errores de tipado)
npm run format:check  # Verificación de estilo con Prettier
npm run lint          # ESLint (--max-warnings=0)
npm run test          # Vitest (todas las pruebas deben pasar)
cd ..

# 2. Core (Rust / Tauri):
cargo check --manifest-path tauri-app/src-tauri/Cargo.toml
cargo clippy --manifest-path tauri-app/src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path tauri-app/src-tauri/Cargo.toml

# 3. Microservicio (Go):
make -C go-microservice check   # gofmt, go vet y pruebas unitarias
```

---

## 4. Proceso para Enviar Contribuciones

1. Haz un **Fork** del repositorio y clónalo en tu máquina local.
2. Crea una rama temática para tu cambio:
   ```bash
   git checkout -b feature/nombre-de-la-feature
   # o
   git checkout -b fix/descripcion-del-bug
   ```
3. Desarrolla tus cambios respetando los principios de optimización y pruebas.
4. Ejecuta `just check` o `make check` (Linux) para garantizar que todo compila y pasa sin errores.
5. Realiza tus commits atómicos de una sola línea (firmándolos si tu entorno lo requiere):
   ```bash
   git commit -s -m "feat(modulo): descripcion concisa de la mejora"
   ```
6. Abre un **Pull Request** hacia la rama `main` explicando claramente el objetivo del cambio, las pruebas realizadas y los módulos afectados.
