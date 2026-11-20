# Backlog de Features e Ideas Futuras (`docs/backlog.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Bugs y Core UX)

*(No hay tareas pendientes en esta categoría actualmente).*

---

## 2. Prioridad Media (Roadmap v1.x)

- [ ] **Unificación del selector de volumen flotante vertical en vista completa (`PersistentPlayer`):**
  - **Contexto y paridad de interfaz:** Actualmente, al estrechar la ventana de la aplicación o en modo compacto, el control de volumen se transforma en un selector vertical flotante (popover vertical emergente al interactuar con el icono de altavoz), liberando espacio horizontal. Sin embargo, en la vista completa/escritorio se mantiene un slider horizontal fijo que ocupa espacio continuo en la barra inferior.
  - **Comportamiento unificado:** Aplicar la misma funcionalidad del selector flotante vertical al modo de vista completa estándar. Al interactuar con el icono de altavoz o sobrevolarlo, desplegar el popover vertical con el porcentaje, slider vertical de volumen y botón de silenciar, manteniendo la barra inferior despejada y consistente en todas las resoluciones.

- [ ] **Carga progresiva y paginación en previsualización de Playlists y Mixes (`PlaylistImportModal` / `DownloadsView`):**
  - **Problema de rendimiento:** Al previsualizar listas de reproducción o mixes extensos de YouTube (que pueden contener cientos de canciones), renderizar todos los elementos de golpe provoca saturación del DOM, latencia en la apertura del modal y lentitud en el scroll.
  - **Paginación progresiva de 50 en 50:** Limitar la visualización inicial de la lista a las primeras 50 canciones.
  - **Botón de carga incremental:** Incluir al final de la lista un botón interactivo *"Cargar 50 más"* (o mostrar el recuento de temas restantes) que agregue el siguiente bloque de 50 canciones de manera fluida hasta completar la totalidad de la lista previsualizada, optimizando el rendimiento y la memoria.

- [ ] **Flujo de importación de Playlist en 2 pasos con navegación visual e iconos (`PlaylistImportModal` / `DownloadsView`):**
  - **Separación modular del flujo (Wizard Stepper):** Para facilitar la revisión de las canciones y evitar sobrecargar el modal con selectores de destino simultáneos, dividir la decisión en un asistente de 2 pasos:
    1. **Paso 1 (Selección y revisión de pistas):** Vista dedicada a revisar canciones previsualizadas, seleccionar/deseleccionar pistas en lote y verificar canciones ya descargadas.
       - Botón **Cancelar:** Estilo *outline* con icono de cancelación (`X` / `Ban`).
       - Botón **Atrás:** Estilo *outline* con icono de retroceso (`ArrowLeft` / `ChevronLeft`), deshabilitado en este paso.
       - Botón **Siguiente:** Estilo *primary* con icono de avance (`ArrowRight` / `ChevronRight`), activo cuando existan pistas seleccionadas.
    2. **Paso 2 (Destino de guardado y confirmación):** Vista dedicada a elegir el destino (crear nueva playlist, agregar a playlist existente o solo importar a biblioteca) y opciones de sincronización.
       - Botón **Cancelar:** Estilo *outline* con icono de cancelación (`X` / `Ban`).
       - Botón **Atrás:** Estilo *outline* con icono de retroceso (`ArrowLeft` / `ChevronLeft`), permite retornar al Paso 1 conservando la selección intacta.
       - Botón **Descargar:** Estilo *primary* destacado con icono de descarga (`Download`), que ejecuta la importación y sincronización.
  - **Diferenciación visual:** Aplicar estilos *outline* claros a los botones secundarios (Cancelar y Atrás) para evitar confusión visual con la acción principal (*primary*), e incorporar iconos descriptivos en cada acción como guía visual inmediata.

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
