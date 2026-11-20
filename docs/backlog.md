# Backlog de Features e Ideas Futuras (`docs/backlog.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Bugs y Core UX)

*(No hay tareas pendientes en esta categoría actualmente).*

---

## 2. Prioridad Media (Roadmap v1.x)

- [ ] **Tooltips contextuales dinámicos según estado de bloqueo en controles de reproducción (`PersistentPlayer` / `NowPlayingView`):**
  - **Retroalimentación explícita de bloqueo:** Sustituir los textos fijos de tooltip (*"Siguiente"* y *"Anterior"*) por etiquetas dinámicas y explicativas cuando los controles se encuentren deshabilitados.
  - **Mensajes de navegación hacia adelante:** Mostrar *"Siguiente"* cuando la navegación esté permitida, y conmutar a *"Fin de la cola"* cuando no existan más temas y el modo bucle esté apagado (`repeatMode === "off"`), o *"Cola vacía"* si no hay pistas en cola.
  - **Mensajes de navegación hacia atrás:** Mostrar *"Reiniciar canción"* cuando `currentTime > 3s`, *"Anterior"* cuando sea posible saltar a la pista previa, y conmutar a *"Inicio de la cola"* cuando se encuentre bloqueado en la primera pista (`currentIndex === 0` y `currentTime <= 3s`) con repetición inactiva.
  - **Claridad cognitiva UX:** Garantizar que los usuarios comprendan inmediatamente el motivo por el cual un botón no responde o se encuentra atenuado sin generar frustración ni ambigüedad.

- [ ] **Acción interactiva primaria y callbacks en notificaciones Toast (`ToastItem` / `ToastContainer`):**
  - **Extensión del contrato de datos (`ToastItem`):** Incorporar propiedades opcionales `action?: { label: string; onClick: () => void }` y `onDismissCallback?: () => void` en la interfaz `ToastItem` y en las funciones auxiliares de `toast.*`.
  - **Renderizado de botón de acción contextual:** En toasts con acción definida (ej. alerta de descarga completa con *"Ver en biblioteca"*, fallo recuperable con *"Reintentar"*, o playlist importada con *"Reproducir ahora"*), desplegar un botón primario compacto (`size="sm"`) junto al mensaje.
  - **Aislamiento de propagación y cierre automático:** Asegurar que hacer clic en el botón de acción ejecute la función asignada, cierre inmediatamente el toast (`onDismiss`) y detenga la propagación de eventos para no alterar la pila de hojas.

- [ ] **Accesibilidad, bloqueo de scroll y trampa de foco en componentes emergentes y modales (`UI / A11y`):**
  - **Diagnóstico del problema:** Los modales y diálogos emergentes actuales (`ConfirmationModal`, `PlaylistImportModal`, `MetadataSyncModal`, `ErrorLogsModal`, `ActionMenu`) permiten que la rueda del ratón o gestos táctiles continúen desplazando el fondo de la pantalla (_scroll leak_), no capturan totalmente las interacciones de puntero y carecen de confinamiento de teclado. Al presionar `Tab`, el foco salta a controles invisibles o situados detrás del modal, violando las pautas de accesibilidad WAI-ARIA Dialog.
  - **Bloqueo de scroll (Scroll Lock estilo shadcn/Radix):** Inmovilizar el desplazamiento de fondo (`overflow: hidden` o bloqueo en contenedor raíz) al abrir cualquier diálogo o modal, compensando dinámicamente el ancho de la barra de desplazamiento para evitar saltos visuales de interfaz (_layout shift_).
  - **Trampa de foco (Focus Trap) y navegación accesible:** Confinar el ciclo de teclado (`Tab` / `Shift+Tab`) estrictamente dentro del contenedor emergente. Enfocar automáticamente el primer elemento interactivo o de confirmación al montar y restaurar el foco al elemento detonante (_trigger_) al desmontar.
  - **Descarte por teclado e interacciones:** Implementar cierre consistente mediante la tecla `Escape` y bloqueo estricto de eventos de puntero en el fondo (`inert` o backdrop con bloqueo de clics/taps).
  - **Atributos semánticos ARIA:** Garantizar `role="dialog"` o `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` y `aria-describedby` en todos los componentes modales y menús contextuales.

- [ ] **Modernización y controles en la vista de Descargas (`DownloadsView`):**
  - **Switch selector para Mix/Playlist vs Solo canción:** Al detectar una URL de lista o mix de YouTube, sustituir los radio buttons por un switch toggle moderno de 2 estados. A la izquierda: _"Solo la canción"_ (removiendo el texto "Recomendado"); a la derecha: _"Mix completo / Lista completa"_. Destacar visualmente con tipografía y color la opción activa seleccionada.
  - **Acción rápida para limpiar historial:** Simplificar la limpieza de descargas sustituyendo el menú contextual de tres puntos actual por un botón directo de _"Limpiar historial"_ con icono de escoba (`Broom` / `Eraser` / `Trash`).
  - **Eliminación de opción obsoleta:** Remover el checkbox de _"Forzar redescarga"_ (`force_overwrite`), dado que está deprecado por el nuevo flujo de sincronización y validación de descargas.

- [ ] **Buscador integrado de canciones con descarga asistida (`DownloadsView`):**
  - Incorporar en la vista de Descargas un campo de búsqueda interactiva por texto (título, artista o palabras clave), eliminando la fricción de tener que buscar en un navegador y copiar enlaces manualmente.
  - **Backend (Microservicio Go y `yt-dlp`):** Exponer un endpoint de búsqueda rápida (ej. `GET /api/search?q={query}`) que ejecute `yt-dlp --dump-json "ytsearch4:{query}"` para obtener metadatos ligeros de las 3 a 5 mejores coincidencias sin descargar streams de audio.
  - **Frontend (Vista previa interactiva):** Desplegar los resultados en tarjetas compactas con miniatura, título limpio, nombre del canal/artista, duración formateada y fecha de publicación.
  - **Descarga con 1 clic:** Cada coincidencia cuenta con un botón directo de descarga que envía el identificador a la cola existente (`useDownloadStore`), aprovechando el pipeline actual de SSE, conversión con FFmpeg e indexación automática en la base de datos local.

- [ ] **Paneles colapsables en sección de Personalización (`WorkspaceSettingsView`):**
  - La sección de Personalización se ha tornado extensa al incorporar paletas cromáticas, modos de tema y selector de visualizadores.
  - Implementar componentes desplegables/colapsables (`Collapsible` o `Accordion`) exclusivamente para los 3 bloques de Personalización (Paleta de Colores, Modo de Tema y Visualizador predeterminado) para mantener compacta la interfaz.

- [ ] **Acción rápida para redescarga de Playlists vinculadas:**
  - Botón directo en la vista de playlist para aquellas que posean un `youtube_playlist_id`.
  - Redirecciona automáticamente a la vista de Descargas precargando el ID o enlace de la lista para facilitar la re-descarga y recuperación de audios corruptos o faltantes.

- [ ] **Reubicación de la vista de Diagnóstico y Errores (Bugs):**
  - Remover la opción de logs/bugs del sidebar principal para simplificar y limpiar la navegación general.
  - Integrar el visor de logs y diagnóstico exclusivamente dentro de la vista de Configuración.
- [ ] **Microinteracción UX en el logo del Sidebar:**
  - Al colocar el cursor (hover) sobre el logo de la aplicación en la cabecera del sidebar, sustituir dinámicamente el logo por el icono estándar de colapsar/expandir barra lateral (ej. `PanelLeftClose` / icono de sidebar común).
  - Clarifica al usuario que el logo actúa como detonante interactivo para alternar el estado del sidebar.
- [ ] **Estabilización de ancho y prevención de saltos visuales en selects de Tracks (`LibraryView`):**
  - Los desplegables `CustomSelect` de formato y ordenamiento varían dinámicamente de anchura según la longitud del texto de la opción activa (ej. al alternar entre _"Todos los formatos"_ vs _"MP3"_, o _"Fecha de descarga"_ vs _"Título"_), provocando desplazamientos horizontales bruscos en los controles adyacentes (botón ASC/DESC).
  - Asignar anchos mínimos consistentes o anchos fijos calibrados (`min-w-[130px]` / `min-w-[150px]` o `w-36` / `w-40`) a los contenedores/triggers de `CustomSelect` para garantizar estabilidad en la interfaz sin saltos de layout al cambiar filtros.
- [ ] **Ampliación de opciones en el menú contextual de 3 puntos (`ActionMenu`):**
  - **Información detallada de la pista (Track Info):** Modal o panel lateral para inspeccionar los metadatos completos del archivo (codec de audio, bitrate, frecuencia de muestreo, tamaño en disco, fecha de descarga, ID original y enlace directo de YouTube).
  - **Información y estadísticas de Playlist:** Modal con duración total acumulada (horas/minutos), recuento de temas, tamaño estimado en disco, ID de sincronización y enlace original a YouTube.
  - **Copiar enlace de YouTube al portapapeles:** Acción rápida en el menú contextual para compartir o abrir en el navegador.
- [ ] **Empaquetado y distribución nativa para Windows (`.msi` / `.exe`):**
  - Configurar pipeline de empaquetado Tauri con WebView2 Runtime y validación de paths en PowerShell.
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
    - Modo de captura interactiva (*Record Hotkey*): botón para reasignar un atajo haciendo clic y pulsando la combinación deseada (soportando modificadores `Ctrl`, `Alt`, `Shift`, `Meta` + Tecla).
    - Detección de colisiones y duplicados: advertencia visual inmediata si una combinación asignada entra en conflicto con otro atajo existente.
    - Botón de restauración de atajos predeterminados (*Reset to Defaults*).

- [ ] **Descarte gestual mediante deslizamiento lateral (Swipe to Dismiss en Toasts) (`ToastContainer`):**
  - **Detección gestual táctil y de puntero:** Capturar eventos de arrastre (`onPointerDown`, `onPointerMove`, `onPointerUp`) sobre la tarjeta activa del frente (`stackIndex === 0`).
  - **Respuesta elástica y desvanecimiento dinámico:** A medida que el usuario arrastra la tarjeta hacia la derecha, desplazarla proporcionalmente en el eje X y reducir su opacidad progresivamente con un efecto de fricción física.
  - **Umbral de expulsión (Threshold):** Si el desplazamiento supera el 40% del ancho de la tarjeta o se detecta una velocidad de lanzamiento rápida (*flick*), disparar la animación de expulsión lateral completa fuera de la pantalla y descartar el toast; de lo contrario, retornar suavemente a su posición original con efecto resorte (*spring*).

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
