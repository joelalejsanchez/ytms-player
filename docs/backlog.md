# Backlog de Features e Ideas Futuras (`docs/backlog.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Bugs y Core UX)

_(No hay tareas pendientes en esta categoría actualmente)._

---

## 2. Prioridad Media (Roadmap v1.x)

- [ ] **Normalización de volumen de audio (ReplayGain / EBU R128):**
  - Medición y ajuste de sonoridad automática en el reproductor para evitar saltos bruscos de volumen entre diferentes canciones.
- [ ] **Exportación de biblioteca y playlists en formato `.m3u8`:**
  - Permitir exportar las listas creadas localmente para ser usadas en reproductores externos o dispositivos móviles.
- [ ] **Soporte multiidioma e Internacionalización (i18n):**
  - Implementar arquitectura de traducción (ej. `react-i18next` o módulo tipado de internacionalización) para soportar como mínimo español e inglés.
  - Extracción de literales de UI hacia diccionarios estructurados JSON de localización (`es.json`, `en.json`).
  - Selector dinámico de idioma en la sección de Configuración con detección automática del locale del sistema operativo y persistencia local.

---

## 3. Prioridad Baja (Casos Específicos o Opcionales)

- [ ] **Sistema configurable de atajos de teclado y gestor de Hotkeys (`useHotkeyStore` / `WorkspaceSettingsView`):**
  - **Arquitectura de atajos desacoplada y centralizada (`useHotkeyStore`):** Diseñar un store Zustand específico con persistencia en `localStorage` que gestione el mapeo de combinaciones de teclas hacia acciones del reproductor y navegación de la aplicación (ej. `togglePlayPause`, `playNext`, `playPrevious`, `volumeUp`, `volumeDown`, `toggleMute`, `toggleShuffle`, `cycleRepeat`, `toggleNowPlayingExpanded`, `focusSearch`).
  - **Mapeos predeterminados intuitivos:** Configuración por defecto con teclas multimedia estándar y combinaciones comunes: `Espacio` (reproducir / pausar), `Alt + Flecha Derecha` (pista siguiente), `Alt + Flecha Izquierda` (pista anterior), `Flecha Arriba` / `Flecha Abajo` (subir/bajar volumen en saltos del 5%), `M` (silenciar/reactivar preservando el volumen previo), `S` (modo aleatorio), `R` (modo repetición) y `F` / `Escape` (expandir/cerrar vista Now Playing).
  - **Aislamiento contextual de foco:** Detector inteligente de pulsaciones a nivel global en `window` con guardia estricta para ignorar disparos cuando el foco activo del usuario resida en elementos de entrada editables (`HTMLInputElement`, `HTMLTextAreaElement`, selectores desplegables o elementos con atributo `contenteditable`).
  - **Normalización y presentación multiplataforma de modificadores:** Representación visual de teclas contextual según el sistema operativo detectado (desplegando símbolos nativos como `⌘` / `⌥` en macOS y `Ctrl` / `Alt` en Linux y Windows).
  - **Panel de configuración y reasignación interactiva en Ajustes (`WorkspaceSettingsView`):**
    - Interfaz visual dentro de la sección de Configuración para visualizar todos los atajos registrados, su acción asignada y su combinación de teclas actual.
    - Modo de captura interactiva (_Record Hotkey_): botón para reasignar un atajo haciendo clic y pulsando la combinación deseada (soportando modificadores `Ctrl`, `Alt`, `Shift`, `Meta` + Tecla).
    - Detección de colisiones y duplicados: advertencia visual inmediata si una combinación asignada entra en conflicto con otro atajo existente.
    - Botón de restauración de atajos predeterminados (_Reset to Defaults_).

- [ ] **Descarte gestual mediante deslizamiento lateral (Swipe to Dismiss en Toasts) (`ToastContainer`):**
  - **Detección gestual táctil y de puntero:** Capturar eventos de arrastre (`onPointerDown`, `onPointerMove`, `onPointerUp`) sobre la tarjeta activa del frente (`stackIndex === 0`).
  - **Respuesta elástica y desvanecimiento dinámico:** A medida que el usuario arrastra la tarjeta hacia la derecha, desplazarla proporcionalmente en el eje X y reducir su opacidad progresivamente con un efecto de fricción física.
  - **Umbral de expulsión (Threshold):** Si el desplazamiento supera el 40% del ancho de la tarjeta o se detecta una velocidad de lanzamiento rápida (_flick_), disparar la animación de expulsión lateral completa fuera de la pantalla y descartar el toast; de lo contrario, retornar suavemente a su posición original con efecto resorte (_spring_).

- [ ] **Descarga independiente de videos completos:**
  - Posibilidad de descargar el archivo de video completo (video + audio) desde YouTube sin reproducirlo en la aplicación.
  - Almacenamiento directo en el directorio `/videos` dentro del workspace activo donde se realice la descarga.
  - Funcionamiento desacoplado del motor de audio/reproducción, permitiendo almacenar y conservar los archivos para posterior gestión o uso externo.
- [ ] **Sincronización selectiva de canciones en Playlists vinculadas:**
  - En playlists sincronizadas, elegir qué canciones individuales ignorar o congelar localmente aunque hayan sido eliminadas en el canal de YouTube.
- [ ] **Editor manual de etiquetas de metadatos (Tag Editor integrado):**
  - Permitir al usuario modificar manualmente el título, artista o álbum desde la biblioteca y reescribir los tags ID3v2 / Vorbis Comments directamente en el archivo de audio físico.
- [ ] **Ecualizador gráfico (Equalizer DSP):**
  - Implementación de ecualizador de 5 a 10 bandas mediante Web Audio API para personalizar el perfil de sonido (graves, medios, agudos).
- [ ] **Visualización e integración de letras de canciones (Lyrics):**
  - Soporte para consulta y renderizado de letras sincronizadas (formato `.lrc` con resaltado línea por línea en tiempo real) o texto plano en la vista En Reproducción (`NowPlayingView`).
  - Obtención opcional mediante APIs públicas abiertas de letras (ej. LRCLIB o similares) o lectura de archivos locales `.lrc` asociados al archivo de audio.
