# Changelog (`docs/changelog.md`)

Todos los cambios notables y características incorporadas en este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.10.1] - 2026-11-20

### Corregido

#### Estandarización de Estilo en Rust y Optimización de Documentación de Pipeline
- **Formateo y Estilo en Core Rust**:
  - Aplicación de `cargo fmt` en infraestructura (`go_microservice_client.rs`, `sqlite_repository.rs`), interfaces de comandos y pruebas unitarias.
- **Mantenimiento y Documentación**:
  - Depuración de tareas redundantes de empaquetado (`.exe` / `.msi`) en el backlog cubiertas por el workflow de release.

---

## [1.10.0] - 2026-11-20

### Añadido

#### Ampliación Integral de Opciones en Menú Contextual (`ActionMenu`), Modales de Información y Acciones Rápidas
- **Modal de Información Técnica de Pista (`TrackInfoModal.tsx`)**:
  - Inspección exhaustiva de metadatos de audio: título, artista, duración exacta y legible, tamaño en disco formateado, códec/extensión (`MP3`, `M4A`, `OPUS`), origen (`Local` o `YouTube`), estado de favoritos y fecha de descarga/registro.
  - Copia rápida al portapapeles de la ruta física en disco (`audio_path`) y del enlace de YouTube con retroalimentación instantánea vía Toast.
  - Accesibilidad completa WAI-ARIA (`role="dialog"`, bloqueo de scroll, cierre con tecla Escape y clic en backdrop).
- **Modal de Información y Estadísticas de Playlist (`PlaylistInfoModal.tsx`)**:
  - Vista general de playlists con portada dinámica, título, badge de origen (`Local` vs `YouTube`) y recuento de pistas.
  - Métricas acumuladas calculadas en vivo: duración total formateada en horas/minutos y tamaño estimado acumulado en disco (`formatBytes`). Carga asíncrona de pistas bajo demanda si se abre desde vistas resumidas como `HomeView`.
  - Acción rápida para copiar el enlace de YouTube de la playlist con notificación Toast.
- **Ampliación de Acciones en Menús de 3 Puntos (`ActionMenu`)**:
  - Incorporación de *"Información de la pista"* y copia directa de enlace con notificación en `TrackRow` y `PlaylistTrackRow`.
  - Incorporación de *"Información de la playlist"* y *"Copiar enlace de YouTube"* en tarjetas de playlists de `HomeView`, tarjetas/filas de `PlaylistsView` y cabecera de la vista de detalle de playlists.

---

## [1.9.24] - 2026-11-20

### Añadido

#### Estabilización de Ancho y Prevención de Saltos de Layout en Selects (`LibraryView.tsx`)
- **Estabilización Visual de Controles en Biblioteca**:
  - Asignación de dimensiones fijas calibradas a los contenedores y triggers de los desplegables `CustomSelect`: `w-40 shrink-0` para el filtro de formato de audio y `w-44 shrink-0` para el selector de criterio de ordenación.
  - Asignación de ancho fijo calibrado (`w-[72px] shrink-0`) y centrado al botón de alternancia de dirección de ordenamiento (*ASC* / *DESC*).
  - Prevención absoluta de desplazamientos horizontales y saltos abruptos de layout al alternar entre opciones de texto corto y largo (ej. *"Todos los formatos"* vs *"MP3"* o *"Fecha de registro"* vs *"Título"*).

---

## [1.9.23] - 2026-11-20

### Añadido

#### Microinteracción UX en Logo de Cabecera del Sidebar (`Sidebar.tsx`)
- **Microinteracción de Alternancia de Barra Lateral**:
  - Sustitución dinámica y fluida mediante transiciones CSS de escala y opacidad (`duration-200`) del isotipo (`AppLogo`) por iconos estándar de barra lateral (`PanelLeftClose` al estar expandido, `PanelLeftOpen` al estar colapsado) al posar el cursor (`group-hover/logo`) o enfocar con teclado (`group-focus-visible/logo`).
  - Incorporación de accesibilidad con `aria-label` descriptivo (*"Contraer barra lateral"* / *"Expandir barra lateral"*) y retroalimentación de foco accesible (`focus-visible:ring-2 focus-visible:ring-primary`), comunicando de manera intuitiva que el logo funciona como botón interactivo para alternar el ancho del sidebar.

---

## [1.9.22] - 2026-11-20

### Añadido

#### Reubicación de Diagnóstico y Registro de Errores al Panel de Configuración (`Sidebar` & `WorkspaceSettingsView`)
- **Limpieza y Centralización de Diagnósticos**:
  - Remoción del botón redundante de logs/bugs del pie del sidebar lateral principal, liberando espacio y simplificando la navegación global.
  - Centralización del visor completo de errores y diagnóstico exclusivamente dentro de la sección de Configuración (`WorkspaceSettingsView`).
  - Incorporación de un indicador y badge reactivo de peligro (`tone="danger"`) en el botón de *Configuración* del Sidebar cuando existan errores no resueltos en sesión, preservando retroalimentación inmediata sin saturar la navegación.

---

## [1.9.21] - 2026-11-20

### Añadido

#### Mejoras Integrales en Vista de Descargas y Perfeccionamiento UX en Playlists (`DownloadsView`, `HomeView` & `PlaylistsView`)
- **Mejoras Integrales en la Vista de Descargas (`DownloadsView`)**:
  - **Selector de lista en Búsqueda Asistida:** Selector integrado para definir a qué playlist se agregan las canciones buscadas, con diálogo interactivo para crear una nueva playlist al instante. Si la canción ya existe en la biblioteca local, permite agregarla a la playlist elegida sin re-descarga innecesaria mediante botón interactivo *"Agregar"*.
  - **Selector de formato compacto y fijo:** Opciones limpias mostrando únicamente la extensión (`MP3`, `M4A`, `OPUS`) con anchura fija calibrada (`w-24`) para evitar deformaciones en la interfaz.
  - **Placeholder simplificado:** Texto conciso y directo: `URL de Video/Playlist/Mix`.
  - **Botón de descarga minimalista:** Botón de acción con solo el icono, deshabilitado hasta contar con una URL y opción de destino válida.
  - **Selectores de objetivo siempre visibles con detección inteligente y estilos info:**
    - Dos selectores presentes siempre: *Descargar solo una canción* y *Descargar lista completa*.
    - Si la URL está vacía, ambos permanecen desactivados.
    - Si la URL es un video individual, solo se activa el primero y se autoselecciona.
    - Si la URL es una playlist o mix, ambos se activan con temática `info` (azul/celeste) sin preselección forzada, requiriendo elección explícita del usuario sin transmitir sensación de alerta o peligro.
- **Perfeccionamiento UX en Tarjetas de Playlists (`HomeView` & `PlaylistsView`)**:
  - Indicador visual de reproducción activa: borde `border-primary` en la tarjeta completa cuando está en reproducción, suprimiendo anillos blancos en el botón flotante.
  - Aislamiento de navegación: hacer clic en el botón de reproducción o en el menú contextual de 3 puntos ejecuta la acción sin redirigir a la vista de detalles.

---

## [1.9.20] - 2026-11-20

### Añadido

#### Acción Rápida de Sincronización/Redescarga de Playlists Vinculadas y Rediseño de Tarjetas en Cuadrícula (`HomeView` & `PlaylistsView`)
- **Rediseño Estructurado de Tarjetas de Playlists en 3 Filas**:
  - Reubicación de la insignia de origen fuera de la carátula hacia el cuerpo descriptivo de la tarjeta:
    - **Fila 1:** Badge de origen a la izquierda (`YouTube` o `Local`) y botón de menú contextual de 3 puntos (`ActionMenu`) a la derecha con opciones de gestión.
    - **Fila 2:** Título de la playlist a la izquierda y duración total acumulada a la derecha en la misma línea horizontal con alineación de línea base.
    - **Fila 3:** Conteo exacto de canciones (`{n} canciones`).
  - Carátula limpia sin badges flotantes superpuestos para maximizar visibilidad visual de la portada.
- **Acción Rápida de Sincronización y Redescarga**:
  - En playlists vinculadas a YouTube (`youtube_playlist_id`), incorporación de la opción *"Sincronizar / Redescargar"* en el menú contextual de tarjetas y filas tanto en `HomeView` como en `PlaylistsView`.
  - Botón prominente de *"Sincronizar"* en la cabecera de la vista detallada de la playlist (junto a *"Reproducir Playlist"*), acompañado de un indicador visual cuando existan canciones faltantes o corruptas en disco (`is_missing`).
  - Flujo de sincronización estrictamente aguas abajo (YouTube ➔ Local) y no destructivo: preserva intactos todos los archivos físicos en disco y la biblioteca local; la sincronización desvincula de la playlist las canciones eliminadas en remoto sin borrarlas de la biblioteca.
- **Separación Limpia de Responsabilidades en Descarga**:
  - Disparo de sincronización asistida mediante store desacoplado (`useDownloadStore.pendingPlaylistUrl`), redirigiendo inmediatamente a la vista de `Descargas` (`onNavigate("downloads")`).
  - `DownloadsView` consume automáticamente la URL pendiente, precarga el enlace remoto (`https://www.youtube.com/playlist?list={id}`) y abre el modal wizard `PlaylistImportModal` sin duplicar lógica de red ni alterar el flujo de descargas.

---

## [1.9.19] - 2026-11-20

### Añadido

#### Paneles Colapsables con Previsualización Activa en Sección de Personalización (`WorkspaceSettingsView` & `CollapsibleSection`)
- **Componente Reutilizable y Accesible `CollapsibleSection`**:
  - Implementación con semántica WAI-ARIA (`aria-expanded`, `aria-controls`, `role="region"`) y cabecera accionable accesible.
  - Transición fluida de apertura/cierre mediante CSS Grid (`grid-rows-[1fr]` y `grid-rows-[0fr]`) con rotación animada de indicador `ChevronDown`.
- **Estructura Compacta en Sección de Personalización**:
  - Conversión de los 3 bloques de Personalización (*Paleta de Colores*, *Apariencia* y *Visualizador de Reproducción*) a paneles colapsables independientes.
  - Estado inicial cerrado por defecto para todos los bloques para mantener la vista limpia, despejada y compacta sin desplazamientos verticales excesivos.
- **Resumen y Previsualización Dinámica en Cabecera**:
  - Muestra un badge interactivo con el estado seleccionado cuando el panel está colapsado:
    - *Paleta de Colores:* Nombre de la paleta y conjunto de muestras cromáticas activas (swatches).
    - *Apariencia:* Icono y nombre del modo de tema activo (*Claro*, *Oscuro*, *Sistema*).
    - *Visualizador de Reproducción:* Icono específico y nombre del visualizador predeterminado activo.
- **Apertura Nativa de Enlaces Externos y Correo (`open_external_url`)**:
  - Nuevo comando IPC en Rust (`open_external_url`) con apertura delegada al sistema operativo (`xdg-open` en Linux, `cmd /C start` en Windows, `open` en macOS).
  - Apertura interactiva del perfil de GitHub en el navegador predeterminado y del cliente de correo con protocolo `mailto:` sin recargas internas ni errores dentro de la WebView de la app.

---

## [1.9.18] - 2026-11-20

### Añadido

#### Flujo de Importación de Playlist en 2 Pasos con Wizard Stepper y Destino a Existente por Defecto (`PlaylistImportModal`)
- **Navegación Stepper de 2 Pasos**:
  - **Paso 1 (Selección y revisión de pistas):** Espacio vertical optimizado y dedicado para inspeccionar tracks previsualizados, alternar presets (`Todas`, `Ninguna`, `< 7 min`, `< 15 min`), usar el buscador instantáneo y consultar la paginación progresiva remota.
    - Botón **Cancelar:** Estilo _outline_ con icono descriptivo `X`.
    - Botón **Atrás:** Estilo _outline_ con icono `ArrowLeft`, deshabilitado en el primer paso para claridad visual.
    - Botón **Siguiente:** Estilo _primary_ con icono `ArrowRight`, activo al haber al menos una pista seleccionada.
  - **Paso 2 (Destino de guardado y confirmación):** Vista limpia y despejada para configurar el destino y opciones de sincronización sin sobrecargar el modal:
    - **Tarjeta de resumen de importación:** Métricas destacadas en mosaico con *Canciones seleccionadas*, *Pendientes de descarga*, *Ya en biblioteca* y *Destino configurado*.
    - **Destino predeterminado "Agregar a una playlist existente":** La opción por defecto selecciona agregar las pistas a una lista existente en la biblioteca local, autoseleccionando la coincidencia de nombre o la primera playlist disponible, reflejando el caso de uso más habitual.
    - Opciones alternativas accesibles para *Crear nueva playlist local* o *Solo importar a mi biblioteca (sin playlist)*.
    - Opción de desvinculación masiva de canciones ausentes en YouTube al sincronizar playlists.
    - Botón **Atrás:** Estilo _outline_ con icono `ArrowLeft` que retorna al Paso 1 conservando intacta la selección y paginación en memoria.
    - Botón **Descargar / Sincronizar:** Estilo _primary_ con icono descriptivo dinámico (`Download` / `CheckCircle2` / `Loader2`).
- **Barra Stepper Visual Superior**:
  - Indicadores interactivos tipo pill numerados (`1. Selección de canciones` y `2. Destino y sincronización`) con recuento en tiempo real de canciones seleccionadas.

---

## [1.9.17] - 2026-11-20

### Añadido

#### Carga Progresiva Remota, Paginación Incremental y Búsqueda en Previsualización de Playlists y Mixes (`PlaylistImportModal`)
- **Paginación remota real en el backend (`yt-dlp` & Go Microservice)**:
  - Implementado el parámetro de rango `--playlist-items {start}:{end}` en `YtDlpAdapter` y en el endpoint `GET /api/download/preview?url=...&start=1&end=50`.
  - La consulta inicial a YouTube solicita exclusivamente las primeras 50 canciones y aborta la paginación de inmediato, reduciendo a milisegundos la respuesta sin descargar metadatos ni saturar la memoria para listas de cientos o miles de canciones.
  - Soporte de consulta y serialización de rangos en Rust (`MicroserviceClientPort::preview_url`), Tauri IPC (`preview_playlist_url`) y cliente frontend (`tauriApi.previewPlaylistUrl(url, start, end)`).
- **Carga remota por demanda (Lazy Loading) y descarga acotada al rango visible**:
  - Al abrir el modal se solicita únicamente el bloque inicial (`1..50`).
  - Al pulsar *"Cargar 50 más"*, se consulta remotamente el bloque siguiente (`51..100`), anexándolo a la vista y memoria de forma fluida.
  - La selección y las acciones de descarga quedan estrictamente restringidas a las canciones efectivamente cargadas y previsualizadas en pantalla, impidiendo la descarga involuntaria de temas no visibles en listas masivas.
- **Buscador interno instantáneo**:
  - Filtro interactivo en tiempo real con icono `Search` y botón rápido de limpieza `X` que busca por título, artista o ID sobre los elementos actualmente en memoria.
  - Mantiene el índice original de cada pista en la lista remota incluso bajo resultados filtrados.
- **Acciones masivas de selección acotadas al conjunto cargado**:
  - Selectores rápidos (`Todas`, `< 15 min`, `< 7 min`, `Ninguna`) y presets de duración que operan estrictamente sobre las canciones cargadas en el DOM (o coincidencias del filtro activo).
  - Contador de selección transparente e informativo (`X de Y cargadas seleccionadas (de Z en total)`).
  - El botón de acción final refleja con total claridad la cantidad exacta de descargas a procesar respecto al total cargado.

---

## [1.9.16] - 2026-11-20

### Mejorado

#### Unificación y Adaptación Responsiva del Selector de Volumen en Barra y Visualizador (`PersistentPlayer` & `NowPlayingView`)
- **Control de volumen responsivo en el visualizador a pantalla completa (`NowPlayingView`)**:
  - Eliminada la desaparición del control de volumen en resoluciones compactas (anteriormente oculto con `hidden sm:flex`).
  - Implementado selector híbrido responsivo en el pie del visualizador: en pantallas de escritorio (`>= sm`) mantiene el deslizador horizontal con ajuste directo por rueda del ratón (`Scroll Wheel`), mientras que en pantallas estrechas o compactas (`< sm`) se colapsa en un botón de altavoz accesible que despliega un popover vertical flotante idéntico al del reproductor principal.
  - Soporte completo para rueda del ratón (`wheel`), arrastre/clic táctil vertical, retardo anti-rebote de 250ms y cierre prioritario con tecla `Escape` sin cerrar inesperadamente la vista completa del visualizador.
- **Unificación del selector de volumen flotante vertical en vista completa (`PersistentPlayer`)**:
  - Reemplazado el control deslizante horizontal permanente de la vista de escritorio por el selector flotante vertical interactivo, unificando la experiencia del reproductor tanto en resoluciones compactas como de escritorio.
  - Al remover el slider horizontal permanente del extremo derecho, la barra de reproducción inferior queda completamente despejada y equilibrada, concediendo mayor espacio legible para los metadatos de la pista y centrando de forma óptima la barra de progreso.
- **Interacción híbrida inteligente (Hover + Click/Focus) y ajuste con rueda del ratón**:
  - Despliegue fluido del selector vertical tanto al posicionar el cursor sobre el botón de altavoz como al interactuar mediante clic o foco de teclado, con retardo calibrado de cierre de 250ms para evitar cierres accidentales durante el movimiento del puntero.
  - Incorporado ajuste directo y continuo de volumen girando la rueda del ratón (`Scroll Wheel`) sobre el disparador de volumen en incrementos del 5%, con reactivación automática de audio si se encontraba silenciado.
  - Accesibilidad WAI-ARIA completa (`aria-haspopup="dialog"`, `aria-expanded` y trampa de escape mediante `Escape`).

---

## [1.9.15] - 2026-11-20

### Añadido

#### Buscador Integrado de Canciones con Descarga Asistida en `DownloadsView`
- **Buscador interactivo en tiempo real con selector de modo**:
  - Incorporado un selector de pestañas accesible (`role="tablist"`) para alternar fluidamente entre *"Descarga por Enlace"* y *"Búsqueda Asistida"*.
  - En el modo de búsqueda, input interactivo con icono de lupa, botón directo de limpieza rápida (`X`), selector de formato de audio persistente (`mp3`, `m4a`, `opus`) y debounce automático calibrado a 400ms para evitar saturación de red y ejecuciones innecesarias.
- **Backend desacoplado con endpoint ligero de búsqueda rápida (`GET /api/search`)**:
  - Implementado en el microservicio Go el endpoint `GET /api/search?q={query}&limit={limit}` que consulta metadatos de las mejores coincidencias mediante `yt-dlp --dump-json --flat-playlist --no-warnings --no-call-home ytsearch{N}:{query}` con timeout de 15 segundos y sin descargar flujos de audio ni saturar ancho de banda.
  - Expuesto el comando IPC de Tauri `search_youtube_tracks` y cliente HTTP robusto en Rust con tipado estricto `SearchResultItemDto`.
- **Tarjetas de resultados con estado reactivo y descarga con 1 clic**:
  - Renderizado de tarjetas enriquecidas con miniatura, título de la canción, artista/canal y duración formateada (`formatDuration`).
  - Detección reactiva de estado: badge verde *"En biblioteca"* si la canción ya existe localmente en el workspace, badge ámbar *"Descargando..."* o *"En cola"* si se encuentra en proceso activo en `useDownloadStore`, o botón interactivo *"Descargar"* para iniciar la descarga con 1 solo clic aprovechando el pipeline existente de SSE, FFmpeg y persistencia en SQLite.

---

## [1.9.14] - 2026-11-20

### Mejorado

#### Modernización de Controles, Switch de Segmento y Limpieza Rápida en la Vista de Descargas (`DownloadsView`)
- **Switch selector de 2 estados (Pill Segmented Control) para Mixes de YouTube**:
  - Sustituida la interfaz previa por un selector segmentado accesible (`role="radiogroup"`) de dos opciones balanceadas: *"Solo la canción"* (a la izquierda con icono `Music2`, eliminando la coletilla redundante de "Recomendado") y *"Mix completo / Lista completa"* (a la derecha con icono `ListMusic`).
  - Resaltado visual activo con contraste y sombras sutiles según la opción elegida.
- **Botón directo de acción rápida para Limpiar Historial**:
  - Reemplazado el menú contextual de 3 puntos por un botón primario directo con icono `Trash2` y etiqueta *"Limpiar historial"*, manteniendo la confirmación de seguridad en `ConfirmationModal`.
- **Eliminación de la opción obsoleta de Forzar Re-descarga (`force_overwrite`)**:
  - Retirado el checkbox y el estado innecesario del formulario, simplificando la interfaz y enviando `force_overwrite: false` de manera segura hacia el pipeline de descargas.

---

## [1.9.13] - 2026-11-20

### Añadido

#### Accesibilidad WAI-ARIA, Bloqueo de Scroll Anti-Shift y Trampa de Foco en Modales (`useModalA11y`, `ConfirmationModal`, `PlaylistImportModal`, `MetadataSyncModal`, `ErrorLogsModal`, `ActionMenu`)
- **Hook unificado `useModalA11y` (`src/hooks/useModalA11y.ts`)**:
  - Encapsula de forma centralizada y reutilizable las pautas de accesibilidad para diálogos modales (WAI-ARIA Dialog / Alertdialog).
- **Bloqueo de Scroll con Compensación de Scrollbar (Anti Layout Shift)**:
  - Inmoviliza el desplazamiento de fondo (`overflow: hidden`) e inyecta dinámicamente la compensación de anchura de barra (`paddingRight`) para prevenir saltos bruscos de diseño visual al abrir y cerrar modales.
  - Soporte de conteo concurrente (`activeModalCount`) para gestionar con seguridad modales anidados o aperturas secuenciales.
- **Trampa de Foco (Focus Trap) y Restauración Automática**:
  - Confinamiento estricto de navegación por teclado mediante ciclo `Tab` y `Shift+Tab` dentro del contenedor del modal.
  - Auto-enfoque automático al montar en el botón de acción principal y restauración garantizada del foco al control detonante previo al desmontar.
- **Descarte por Tecla Escape e Interacción de Fondo**:
  - Cierre consistente e inmediato al presionar la tecla `Escape` (con guardia condicional en procesos activos) y descarte accesible al pulsar sobre el telón de fondo.
- **Atributos Semánticos WAI-ARIA Completos**:
  - Integrados `role="dialog"` / `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` y `aria-describedby` en `ConfirmationModal`, `PlaylistImportModal`, `MetadataSyncModal`, `ErrorLogsModal` y `ActionMenu`.

---

## [1.9.12] - 2026-11-20

### Añadido

#### Acciones Interactivas Primarias, Callbacks y Pausa Contextual en Notificaciones Toast (`useToastStore`, `ToastContainer` y `ToastRow`)
- **Extensión del contrato de datos de Toast (`ToastItem` y `ToastOptions`)**:
  - Incorporadas las propiedades opcionales `action?: { label: string; onClick: () => void }` y `onDismissCallback?: () => void` en la interfaz `ToastItem` y en todas las variantes auxiliares (`toast.info`, `toast.success`, `toast.warning`, `toast.error`, `toast.show`).
- **Botón de acción contextual con estilos semánticos**:
  - Despliegue de un botón de acción primario compacto con diseño adaptado al nivel de severidad de la alerta (`primary` para info, `emerald` para success, `amber` para warning y `destructive` para error).
- **Aislamiento de eventos y descarte automático**:
  - Al hacer clic en el botón de acción se ejecuta la lógica asignada, se descarta limpiamente el toast (`onDismiss`) y se detiene la propagación de eventos (`e.stopPropagation()`).
- **Extensión de duración automática y pausa al interactuar**:
  - Los toasts que contienen acciones interactivas elevan automáticamente su duración predeterminada de 3000ms a 7000ms si no se especifica otra duración.
  - Al colocar el cursor sobre el toast o el contenedor, el temporizador de autodestrucción y el recorrido perimetral animado se pausan de forma reactiva, evitando que la alerta desaparezca mientras el usuario interactúa con ella.

---

## [1.9.11] - 2026-11-20

### Mejorado

#### Sorteo Aleatorio Integral al Iniciar Reproducción en Modo Shuffle (`usePlayerStore` y `LibraryView`)
- **Sorteo previo sin sesgos al arrancar listas completas**:
  - Al reproducir una playlist completa (`playPlaylist`) o todo el catálogo de la biblioteca (`handlePlayAll`) con el modo aleatorio activo (`isShuffle: true`), se aplica el algoritmo Fisher-Yates de forma íntegra e imparcial sobre la totalidad de las pistas disponibles, eliminando el sesgo que forzaba siempre la primera pista física (`playable[0]`).
- **Preservación canónica del orden original (`originalQueue`)**:
  - La cola original se almacena intacta con el orden secuencial de la playlist o biblioteca, permitiendo que al desactivar el modo aleatorio (`toggleShuffle()`) la cola se restaure fielmente sin perder la pista actualmente en curso.
- **Preservación estricta de la selección intencional (`playTrack`)**:
  - Si el usuario selecciona explícitamente una canción individual dentro de la lista o tabla, se preserva dicha pista ganadora al frente en el índice 0 y se baraja aleatoriamente el resto de la cola detrás de ella.
- **Soporte transversal unificado en `usePlayerStore.playPlaylist`**:
  - Firma extendida a `playlistId?: number | null`, permitiendo a `LibraryView` reutilizar la misma lógica de integridad de cola y sincronización sin duplicación de código.

---

## [1.9.10] - 2026-11-20

### Añadido

#### Tooltips Contextuales Dinámicos y Bloqueo Condicional de Navegación (`usePlayerControlTooltips`, `PersistentPlayer` y `NowPlayingView`)
- **Hook centralizado `usePlayerControlTooltips`**:
  - Unifica la lógica de estados y etiquetas contextuales para los controles de reproducción tanto en la barra inferior persistente (`PersistentPlayer` en modos escritorio y compacto) como en la vista de reproducción expandida (`NowPlayingView`).
- **Retroalimentación explícita para navegación hacia adelante (`SkipForward`)**:
  - Muestra *"Siguiente"* cuando la navegación está habilitada.
  - Conmuta a *"Fin de la cola"* cuando no hay pistas posteriores en la cola (`repeatMode === "off"`), o *"Cola vacía"* cuando la cola carece de elementos.
- **Retroalimentación contextual para navegación hacia atrás (`SkipBack`)**:
  - Muestra *"Reiniciar canción"* cuando el minutero de reproducción supera el umbral de 3 segundos (`currentTime > 3s`).
  - Muestra *"Anterior"* cuando es posible volver a la pista previa.
  - Conmuta a *"Inicio de la cola"* cuando se encuentra bloqueado en la primera pista (`currentIndex <= 0` y `currentTime <= 3s`) con repetición desactivada, o *"Cola vacía"* si no hay canción activa.
- **Tooltips dinámicos en Play/Pause, Repetición y Modo Aleatorio**:
  - El botón principal informa reactivamente su estado: *"Cargando pista..."*, *"Sin canciones en cola"*, *"Pausar"*, *"Reanudar"* (si la canción fue pausada con avance) o *"Reproducir"*.
  - Sincronización homogénea de tooltips para repetición (*"Modo repetición: Desactivado / Una canción / Todas"*) y aleatorio (*"Modo aleatorio: Activado / Desactivado"*).

---

## [1.9.9] - 2026-11-20

### Corregido

#### Sincronización Completa de la Cola al Reproducir Playlists (`usePlayerStore`, `HomeView` y `PlaylistsView`)
- **Acción centralizada de reproducción de playlists (`playPlaylist`)**:
  - Evaluación profunda de la integridad de la cola: valida que la cantidad y correspondencia de pistas coincida con el contenido total de la playlist (`playable.every`) en lugar de limitarse al cotejo superficial de `activePlaylistId`.
- **Preservación de pista activa y de la posición de reproducción**:
  - Si la sesión inició precargando una única pista desde el almacenamiento persistente (`localStorage`), o si la pista en curso ya forma parte de la lista seleccionada pero la cola se encontraba truncada, se invoca `setQueuePreservingCurrent` para poblar la totalidad de los temas sin interrumpir la reproducción ni reiniciar el minutero a cero.
- **Conservación inteligente del modo aleatorio (`shuffle`)**:
  - Al expandir una cola incompleta con `isShuffle: true`, la pista activa se conserva al frente en el índice actual y las canciones entrantes se barajan aleatoriamente en el resto de la cola respetando el estándar de reproducción.
- **Notificación toast informativa de cola sincronizada**:
  - Emisión de alerta contextual (`toast.info("Cola sincronizada", "+N canciones añadidas...")`) cuando se detecta y expande una cola previamente incompleta.
- **Conmutación limpia**:
  - Si la pista activa no pertenece a la playlist detonada, se carga la playlist completa y la reproducción arranca de inmediato desde su primera pista disponible.

---

## [1.9.8] - 2026-11-20

### Añadido

#### Integración y Sincronización con MediaSession API Nativa (`useMediaSession` y `PersistentPlayer`)
- **Publicación de metadatos del reproductor**:
  - Exposición reactiva en `navigator.mediaSession.metadata` con título, artista, álbum y conjunto de resoluciones de carátula (`artwork` de 96x96 a 512x512).
  - Generación automática de artwork con fallback en formato SVG Data URL ante pistas que carezcan de carátula física (`cover_path` nulo), previniendo cajas vacías en el centro de control del SO.
- **Sincronización de estado de reproducción y posición**:
  - Actualización automática de `navigator.mediaSession.playbackState` (`"playing"`, `"paused"` o `"none"`).
  - Sincronización continua de posición y duración mediante `navigator.mediaSession.setPositionState` para reflejar con precisión el progreso y soportar scrubbing nativo.
- **Handlers de control multimedia nativos y soporte para periféricos**:
  - Conexión de manejadores para `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward` y `stop`.
  - Integración con mandos de auriculares Bluetooth, teclas multimedia de teclados físicos y widgets del sistema operativo (Linux MPRIS y Windows Media Controls).
  - Blindaje con las políticas de bloqueo condicional (`repeatMode === "off"` en extremos de cola) y reinicio automático de pista cuando `currentTime > 3s`.
- **Aislamiento multiplataforma seguro**:
  - Verificación estricta de disponibilidad con `"mediaSession" in navigator` y registro tolerante a fallos para acciones no admitidas por ciertos entornos o navegadores.

---

## [1.9.7] - 2026-11-20

### Añadido

#### Límite Visual de Toasts, Indicador Numérico (+N más) y Priorización por Severidad (`ToastContainer` y `useToastStore`)
- **Tope visual estricto de tarjetas en pantalla**:
  - Limitación del renderizado a un máximo de 3 tarjetas físicas simultáneas en el DOM (`candidates.slice(0, 3)`), reteniendo el excedente en una cola en memoria dentro del store en lugar de descartarlo con `.slice(-4)`.
- **Priorización estricta por severidad y drenaje secuencial**:
  - Algoritmo de ponderación semántica (`error: 4` > `warning: 3` > `success: 2` > `info: 1`) con resolución cronológica FIFO para alertas del mismo nivel.
  - Las alertas de error y advertencia crítica se anteponen automáticamente al frente de la pila visible, desplazando notificaciones meramente informativas hacia la cola.
  - Temporizadores perimetrales y cuenta regresiva activos exclusivamente en la tarjeta al frente (`isFront`); las tarjetas en capas posteriores resguardan su tiempo restante y pausan su animación SVG hasta tomar el primer plano.
- **Badge indicador numérico flotante (+N más)**:
  - Despliegue de una pastilla flotante animada (`+{hiddenCount} más`) anclada a la esquina superior derecha de la tarjeta al frente cuando existen alertas adicionales en espera en la cola, informando con claridad cuántos mensajes aguardan sin saturar el viewport.

---

## [1.9.6] - 2026-11-20

### Mejorado

#### Unificación Visual de Metadatos e Insignia de YouTube en Playlists (`HomeView` y `PlaylistsView`)
- **Alineación y jerarquía visual uniforme de metadatos**:
  - Reubicación del título de la playlist y de su duración acumulada calculada en la misma fila horizontal superior mediante contenedor flex (`items-baseline justify-between`), permitiendo identificar la extensión total de la lista de un vistazo.
  - Reubicación del conteo de canciones en una segunda línea independiente inferior en ambas vistas (`HomeView` y `PlaylistsView`), calibrado con tipografía balanceada (`text-[10px]`) sin solapamientos.
- **Insignia indicadora de sincronización y supresión de ID crudo**:
  - Supresión definitiva de los identificadores crudos de YouTube (`<code>PL...</code>`) en tarjetas y filas de playlists.
  - Incorporación de una insignia visual elegante y distintiva con el icono oficial de YouTube (`Youtube`) superpuesta con efecto translúcido (`bg-black/60 backdrop-blur-xs`) en la carátula de las tarjetas (cuadrícula) y como pastilla suave (`bg-red-500/10`) en las filas de lista y cabecera de detalle, identificando con claridad el origen de sincronización sin saturar la interfaz.

---

## [1.9.5] - 2026-11-20

### Añadido

#### Rediseño de Toasts de Notificación: Apilado de Hojas y Temporizador Perimetral Animado (`ToastContainer`)
- **Presentación apilada estilo hojas superpuestas (Stacked Cards)**:
  - Sustitución de la lista vertical continua por una pila compacta estilo *Sonner* / *stacked sheets* en la esquina inferior derecha.
  - La notificación más reciente se sitúa al frente con escala completa (`scale(1)`), mientras las precedentes se resguardan sutilmente en capas superpuestas con escala reducida (`scale(0.94)`, `scale(0.88)`) y elevación vertical, eliminando la sobrecarga y saturación visual.
  - Expansión interactiva fluida al posar el cursor (`hover`): la pila se despliega verticalmente hacia arriba separando las tarjetas para permitir la lectura y el descarte individual.
- **Temporizador perimetral animado y supresión del loader circular**:
  - Retiro definitivo del antiguo reloj circular SVG en el extremo derecho.
  - Nuevo borde perimetral animado trazado con SVG (`pathLength="100"` y animación `toast-perimeter`), recorriendo el perímetro de la tarjeta en cuenta regresiva con el color semántico correspondiente (`text-primary` para info, `text-emerald-500` para éxito, `text-amber-500` para advertencia y `text-destructive` para error).
  - Pausa inteligente en hover: la animación perimetral y el temporizador de auto-cierre se congelan mientras el usuario interactúa con la notificación y reanudan su marcha al retirar el cursor.

---

## [1.9.4] - 2026-11-20

### Corregido

#### Bloqueo Condicional de Navegación y Blindaje de Controles de Reproducción (`PersistentPlayer`, `NowPlayingView` y `usePlayerStore`)
- **Bloqueo condicional reactivo en controles de pista**:
  - Deshabilitación visual y funcional del botón de siguiente pista (`SkipForward`) cuando la cola no tiene elementos posteriores (`currentIndex >= queue.length - 1` o `queue.length <= 1`) con modo de repetición inactivo (`repeatMode === "off"`), tanto en la barra inferior (escritorio y móvil de `PersistentPlayer`) como en la vista expandida `NowPlayingView`.
  - Deshabilitación reactiva del botón de pista anterior (`SkipBack`) al encontrarse en la primera posición de la cola (`currentIndex === 0` y `currentTime <= 3s`) sin repetición activa.
  - Habilitación irrestricta de controles de navegación en modos de bucle (`repeatMode === "all"` o `repeatMode === "one"`), facilitando reiniciar la pista o ciclar la cola de reproducción.
- **Prevención de congelamiento del selector de tiempo (Seek Bar) y desincronización**:
  - Eliminación de la mutación errónea de `isLoadingTrack: true` al reiniciar la misma canción o avanzar en bucle individual (`repeatMode === "one"`), evitando que el selector de tiempo quede congelado o bloqueado.
  - Blindaje de límites en las acciones `playNext` y `playPrevious` de `usePlayerStore` para evitar mutaciones de estado inválidas o detenciones prematuras si se invocan fuera de rango.
  - Sincronización limpia en el evento `handleEnded` de `PersistentPlayer`: reinicio transparente a la posición `0:00` y detención segura del motor de audio cuando una cola finaliza sin repetición activa.

---

## [1.9.3] - 2026-11-20

### Añadido

#### Nuevos Visualizadores Estáticos y Depuración Minimalista (`VisualizerRegistry` y `NowPlayingView`)
- **Módulo de Portada Estática / Estuche Físico (`PhysicalCaseVisualizer`)**:
  - Incorporación del módulo coleccionable `physical-case` inspirado en cajas Jewel Case de CD/Blu-ray y cartuchos: lomo izquierdo biselado, clips sujetadores de libreto, reflejo especular diagonal de acetato y sombra 3D profunda sin deformaciones dinámicas ni consumo de GPU.
  - Componente de previsualización `PhysicalCasePreview` integrado en la configuración del espacio de trabajo.
- **Módulo de Disco Analógico Estático (`StaticDiscVisualizer`)**:
  - Incorporación del módulo `static-disc` con disco de acetato de alta fidelidad, surcos concéntricos reflexivos, reflejo cónico y etiqueta central en reposo, prescindiendo de la rotación continua para una presentación musical sobria y eficiente.
  - Componente de previsualización `StaticDiscPreview` integrado en Ajustes.
- **Depuración minimalista de textos y leyendas superfluas**:
  - Eliminación de etiquetas y leyendas de texto secundarias distractoras en todos los visualizadores existentes (`VinylVisualizer`, `AmbientAuraVisualizer`, `CoverWavesVisualizer`, `SpectrumVisualizer`), tales como "33⅓ RPM", "Onda Resonante Activa", "Ondas de sonido reactivas" o indicadores de frecuencia, logrando una presentación artística limpia y directa centrada 100% en el arte musical.

#### Consumo Dinámico de Versión e Información del Sistema (`Sidebar` y `WorkspaceSettingsView`)
- **Inyección dinámica de versión desde `package.json`**:
  - Inyección de `__APP_VERSION__` en tiempo de compilación mediante `vite.config.ts`, sincronizando automáticamente la versión de la aplicación sin literales estáticos ni riesgo de desfase.
- **Tarjeta informativa del sistema (`WorkspaceSettingsView`)**:
  - Cabecera en la vista de Configuración con el nombre oficial del sistema, versión activa `v1.9.3`, autor, licencia GPL-3.0 y stack tecnológico.
- **Indicador visible en `Sidebar`**:
  - Versión activa visible en la cabecera y pie de la barra lateral, permitiendo conocer la versión del cliente de escritorio desde cualquier vista.

---

## [1.9.2] - 2026-11-20

### Añadido

#### Reproducción Instantánea Mediante Doble Clic en Filas de Canciones (`TrackRow` y `PlaylistTrackRow`)
- **Detonación de reproducción directa con doble clic**:
  - Incorporación del evento `onDoubleClick` en el contenedor de las filas de pista de la biblioteca (`TrackRow`) y de las playlists (`PlaylistTrackRow`), reproduciendo de inmediato la pista seleccionada y actualizando la cola de reproducción con la lista activa y su contexto.
  - Indicador de cursor intuitivo (`cursor-pointer` en filas reproducibles y `cursor-not-allowed` si la pista está extraviada/faltante) junto con `select-none` para evitar selección involuntaria de texto al hacer doble clic rápido.
- **Aislamiento y protección estricta de controles interactivos**:
  - Discriminación y filtrado inteligente del objetivo del evento (`target.closest("button, [role='button'], [role='menuitem'], a, input, select, textarea")`) en el manejador del doble clic.
  - Control de propagación explícito (`onDoubleClick={(e) => e.stopPropagation()}`) en el botón de reproducción sobre la carátula y en el contenedor de acciones (botón de me gusta / corazón, botón de encolar, menú desplegable de asignación a playlists y menú contextual de tres puntos `ActionMenu`), garantizando que interactuar repetidamente con estos botones jamás dispare una reproducción accidental.

---

## [1.9.1] - 2026-11-20

### Añadido

#### Discriminación de Origen de Pista (`origin`) y Exclusión de Archivos Locales en Sincronización de Likes
- **Columna `origin` y migración retrocompatible en SQLite**:
  - Incorporación de la columna `origin TEXT NOT NULL DEFAULT 'youtube'` en la tabla `tracks` (valores admisibles: `'youtube'` y `'local'`) con migración automática segura `ALTER TABLE` para bases de datos existentes.
  - Sincronización transparente de `origin` en los modelos de dominio Rust (`Track`, `NewTrack`) con deserialización tolerante mediante `#[serde(default = "default_origin")]` y tipado estricto en TypeScript (`TrackOrigin = "youtube" | "local"`).
- **Filtrado previo estricto en Tauri / Rust (`sync_likes_with_youtube`)**:
  - Exclusión automática de todas las canciones de origen local (`origin == "local"`) antes de consultar al microservicio, enviando exclusivamente identificadores válidos de YouTube y optimizando la cuota de la API.
- **Resiliencia en Microservicio Go (`SyncLikesUseCase`)**:
  - Validación por lotes tolerante en Go: identificadores no pertenecientes a YouTube o archivos locales no provocan rechazo en bloque (`validation_error 400`), procesando todos los IDs válidos del lote de forma ininterrumpida.
- **Gestión local de favoritos y feedback UX (`TrackRow`, `NowPlayingView`, `HomeView` y `useLibraryStore`)**:
  - Las pistas locales gestionan su estado de `liked` puramente en la base de datos local SQLite sin detonar llamadas a YouTube ni generar falsos toasts de error de sincronización.
  - **Calibración cromática del botón de Like**:
    - **Sincronizado con YouTube**: Borde rojo (`text-rose-500`) cuando no tiene like, y rellenado rojo (`fill-rose-500 text-rose-500`) al marcarse como favorita.
    - **Local / No sincronizado**: Borde gris (`text-muted-foreground/60`) cuando no tiene like, y rellenado gris (`fill-muted-foreground text-muted-foreground`) al marcarse como favorita local.
  - Badge visual `Local` en `TrackRow`, omitiendo la acción "Copiar enlace de YouTube" en pistas locales.

---

## [1.9.0] - 2026-11-19

### Añadido

#### Barra Inferior de Reproducción Adaptable (Responsive PlayerBar en `PersistentPlayer`) y Flexibilidad de Ventana
- **Diseño adaptativo y breakpoints para pantallas compactas y pantalla dividida**:
  - Reestructuración dinámica del reproductor persistente inferior (`PersistentPlayer`) adaptándose sin desbordamientos ni cortes desde pantallas estrechas (< 640px) y split-screen hasta monitores ultrawide.
  - **Apertura de límites de ventana en Tauri**: Reducción del límite restrictivo del sistema operativo en `tauri.conf.json` de `minWidth: 960, minHeight: 640` a `minWidth: 400, minHeight: 500`, permitiendo encoger la ventana a modo compacto y pantalla dividida.
  - **Corrección de restricciones Flexbox**: Inclusión de `min-w-0` y espaciado responsivo en el contenedor principal de `App.tsx`, así como `flex-wrap` en barras de herramientas de `DownloadsView` y `PlaylistsView` para garantizar compresión fluida sin desbordamientos.
  - **Desacoplamiento y jerarquía de texto en modo compacto**: Al decrecer la pantalla (`< lg`), el título se ubica en la parte superior y el nombre del autor debajo con estilo atenuado (`text-muted-foreground`), ambos con soporte de desplazamiento horizontal lineal automático ante desbordamientos y sin extensión física de archivo.
  - **Centrado simétrico de controles con CSS Grid**: Aplicación de `grid grid-cols-[1fr_max-content_1fr]` en la fila de controles inferiores para asegurar un centrado matemático exacto del bloque de reproducción independientemente de la diferencia de ancho entre la portada (izquierda) y las acciones de volumen/cola (derecha).
  - **Animación lineal de desplazamiento (Linear Marquee)**: Integración del componente `ScrollableText` con `@keyframes marquee-linear` en `index.css`, activando desplazamiento lineal constante de principio a fin, retorno instantáneo y pausa de 1s antes de reiniciar.
  - **Limpieza de metadatos**: Supresión de la extensión física del archivo de audio (`.mp3`, `.m4a`, etc.) en la interfaz del reproductor para mayor pulcritud visual.
  - **Vista completa de escritorio refinada**: Título y artista en líneas separadas con tamaño de fuente compacto y calibrado, con soporte de desplazamiento horizontal automático ante desbordamientos.
  - **Barra de progreso de ancho completo superior**: En ventanas compactas (`< lg`), la barra de progreso (seek bar) ocupa todo el ancho disponible de la barra en la fila superior con contadores numéricos de tiempo transcurrido y total, optimizando el espacio horizontal.
  - **Control de volumen flotante vertical por hover**: Al acercar el cursor al icono de sonido en vista compacta, se despliega un slider vertical flotante con pista calibrada, indicador circular instantáneo, porcentaje y botón de mute.
  - **Visibilidad y cierre inteligente de cola de reproducción**: El botón de cola (`ListMusic`) permanece visible y accesible en todas las vistas, y su ventana emergente se cierra de forma instantánea y automática al detectar clics externos en cualquier área de la pantalla o presionar `Escape`.

---

## [1.8.2] - 2026-11-19

### Corregido

#### Transición Instantánea en Indicadores Circulares de Reproducción y Volumen (`PersistentPlayer` y `NowPlayingView`)
- **Eliminación del salto elástico en Seek Bar y Volumen**: Sustitución de las transiciones interpoladas (`transition-all duration-150`) por posicionamiento instantáneo (`transition-none`) en los indicadores circulares (*thumbs*) y barras de relleno de la barra de progreso de reproducción y el control de volumen.
- **Sincronización exacta bajo el cursor**: Al hacer clic o arrastrar el cursor sobre las barras de seek y volumen en `PersistentPlayer` y `NowPlayingView` (vista en reproducción a pantalla completa), el indicador se ubica de forma inmediata bajo el puntero sin retardos ni desfases visuales, manteniendo intacta la lógica de audio y volumen.

---

## [1.8.1] - 2026-11-19

### Corregido

#### Estado Activo y Quick Play en Playlists (`HomeView` y `PlaylistsView`)
- **Eliminación de falsa activación simultánea de botones Play**: Asociación del estado de reproducción activa directamente a `activePlaylistId` en `usePlayerStore`, resolviendo el problema donde múltiples tarjetas de playlists que compartían una misma pista mostraban simultáneamente el botón activo de Pausa (`opacity-100 ring-2`).
- **Conmutación certera de reproducción entre playlists**: Al hacer clic en el botón de Quick Play de otra tarjeta de playlist que contiene la pista en reproducción, el reproductor conmuta la reproducción hacia la playlist elegida e inicializa su cola en lugar de pausar la pista actual.
- **Botón Quick Play deshabilitado con feedback para playlists vacías**: En tarjetas sin pistas (`hasTracks === false`), el botón de Quick Play se mantiene visible en estado deshabilitado con cursor bloqueado y emite una notificación toast informativa (`toast.info`), eliminando saltos o redirecciones de pantalla accidentales.
- **Cálculo de pistas y duración en `HomeView`**: Corrección en la indexación de `playlistTrackMap` para asociar con precisión las pistas pertenecientes a cada playlist y calcular sus duraciones acumuladas exactas.

---

## [1.8.0] - 2026-11-18

### Añadido

#### Rediseño de Navegación Secuencial en Playlists (`PlaylistsView`)
- **Navegación secuencial de dos niveles**: Sustitución del esquema dividido de dos paneles simultáneos por un flujo limpio y enfocado compuesto por Pantalla Principal (Tus Playlists) y Pantalla de Detalle individual.
- **Pantalla principal a ancho completo**:
  - Cuadrícula responsiva (`grid`) y vista en lista (`list`) conmutables mediante selector visual de modo de vista.
  - Tarjetas de playlist con carátula dinámica o respaldo visual, conteo de canciones, duración acumulada, badge de YouTube si está vinculada, botón de reproducción rápida con 1 clic y menú de opciones contextuales (`ActionMenu`).
  - Campo de búsqueda interactiva en tiempo real para filtrar playlists por título o identificador de YouTube.
  - Formulario desplegable accesible para la creación inmediata de nuevas playlists con redirección directa a su vista de detalle.
- **Pantalla de detalle de playlist**:
  - Barra superior de retorno con botón prominente *"Volver a Playlists"* y migas de pan (*breadcrumbs*) clicables para regresar a la vista general.
  - Hero banner con carátula a gran escala, título completo, etiqueta de tipo y métricas acumuladas (número de canciones, duración total en formato legible y espacio total en disco).
  - Listado de canciones a ancho completo con numeración de pista, miniatura con hover play, resaltado dinámico de pista en reproducción, duración formateada y menú contextual para copiar enlace o desvincular de la lista.
  - Buscador interno de canciones para listas de reproducción extensas.

---

## [1.7.5] - 2026-11-18

### Corregido

- **Compatibilidad de opacidad y variables CSS en Tailwind**: Configuración de `withOpacity` en `tailwind.config.js` mediante `color-mix(in srgb, var(...) calc(<alpha-value> * 100%), transparent)` para soportar modificadores de transparencia (`/<alpha>`) en todas las variables semánticas de Tailwind (`bg-primary/10`, `border-border/80`, `bg-card/60`, `ring-primary/20`, etc.).
- **Fondo sólido y renderizado en Notificaciones Toast (`ToastContainer`)**: Asignación de fondo `bg-card` y borde `border-border` sólidos a las notificaciones toast, evitando que aparezcan transparentes y garantizando nitidez y contraste en el texto y elementos visuales.
- **Sincronización de versión en panel de configuración y metadatos**: Actualización del indicador de versión a `v1.7.5` en el panel de Personalización (`WorkspaceSettingsView.tsx`), `package.json`, `tauri.conf.json` y `Cargo.toml`.

---

## [1.7.4] - 2026-11-18

### Corregido

- **Tipado estricto en TypeScript**: Corrección de inferencia de tipo `DownloadStatus` en `useDownloadStore.ts` y adición de propiedades requeridas `force_overwrite` y `async_mode` en las pruebas unitarias de `stores_and_schemas.test.ts`, asegurando compilación 100% limpia con `tsc --noEmit`.

---

## [1.7.3] - 2026-11-18

### Corregido

- **Formato y consistencia de código**: Normalización de estilo y formateo con Prettier en `useDownloadStore.ts`, con verificación estricta de linters (ESLint, Clippy, gofmt) aprobada en todo el monorepo.

---

## [1.7.2] - 2026-11-18

### Añadido

#### Microservicio Go y Docker
- **Logging estructurado en Docker**: Trazas detalladas con timestamps en `stdout` (`[http]`, `[worker]`, `[download]`, `[path-resolver]`) para monitorear peticiones, descargas, etapas de FFmpeg y errores en tiempo real mediante `docker compose logs -f`.
- **Alineación de volúmenes en `docker-compose.yml`**: Configuración predeterminada del volumen del anfitrión hacia la carpeta estándar de música (`${HOME:-${USERPROFILE}}/Music`) para permitir acceso a cualquier subcarpeta de música sin generar carpetas huérfanas (`ytms-player`) en el disco anfitrión.
- **Guía de desarrollo en Windows**: Documentación detallada en `docs/setup-windows.md` sobre configuración de `YTMS_PLAYER_WORKSPACE_HOST` y visualización de logs de contenedor.

### Corregido

- **Condición de carrera en descargas asíncronas (`useDownloadStore`)**: Corrección del error donde la resolución asíncrona de `startDownloadTask` sobrescribía con estado `"queued"` las tareas que ya habían finalizado o avanzado por eventos SSE en tiempo real (`downloading`, `processing`, `completed`).
- **Validación de prefijo en `WorkspacePathResolver`**: Advertencias explícitas en logs si la ruta de workspace recibida no coincide con `HOST_WORKSPACE_PREFIX`, evitando escrituras silenciosas en el almacenamiento efímero del contenedor.

---

## [1.7.1] - 2026-11-18

### Añadido

#### Adopción y Reproducción Libre de Audios Locales
- **Flexibilización de validación de pistas**: Eliminación de la restricción rígida de 11 caracteres en los identificadores de pista (`validate_youtube_id`), permitiendo indexar cualquier archivo de audio local (`.mp3`, `.m4a`, `.opus`, etc.) copiado manualmente a la carpeta `tracks/` del espacio de trabajo.
- **Resolución local inteligente**: Adopción directa de archivos locales en la base de datos SQLite sin invocar peticiones remotas de previsualización al microservicio cuando el identificador no corresponde a un video externo.

#### Documentación y Licencia
- **Reorientación del README**: Enfoque principal de la aplicación como reproductor y organizador de audio local independiente de alto rendimiento, estableciendo el microservicio en Docker como un complemento secundario opcional para importar enlaces.
- **Licencia GNU GPL v3**: Actualización de los metadatos del proyecto (`Cargo.toml`, `package.json`, `README.md`) para reflejar la licencia oficial GNU General Public License v3 (`GPL-3.0-or-later`).

### Corregido

- **Bloqueo al adoptar archivos locales**: Solución al fallo que emitía errores de toast inesperados al copiar canciones con nombres locales comunes (ej. `hachimi.mp3`).
- **Optimización de flujos de GitHub Actions**: Eliminación de dependencias innecesarias de sistema en `ci.yml` para acelerar los pipelines y adición de permisos de escritura (`permissions: contents: write`) con dependencia estricta (`needs: [ci]`) en `release.yml`.

---

## [1.7.0] - 2026-11-18

### Añadido

#### Identidad de Marca Oficial: Your Tracks Music Server (YTMS)
- **Denominación oficial**: Desligamiento de marcas comerciales y adopción del nombre **Your Tracks Music Server** (**YTMS**), enfocado en la propiedad y privacidad de las bibliotecas de audio locales.
- **Actualización global**: Reflejado en la barra de título de la aplicación, cabecera de la barra lateral, diálogos nativos y documentación del proyecto.

#### Dashboard Principal y Página de Bienvenida (Home View)
- **Página de inicio predeterminada**: Nueva vista `HomeView` accesible desde el Sidebar con saludo dinámico según el horario del día y accesos rápidos a la biblioteca y descargas.
- **Métricas globales de la biblioteca**:
  - *Total de canciones*: Conteo en tiempo real de pistas locales registradas.
  - *Duración acumulada*: Suma total formateada de manera amigable (ej. `14h 32m` o `45 min`).
  - *Almacenamiento en disco*: Espacio físico total ocupado por los archivos de audio en MB/GB.
  - *Favoritos*: Recuento reactivo de pistas con *Me gusta*.
- **Cuadrícula interactiva de Playlists con Quick Play**:
  - Tarjetas visuales con carátula dinámica o gradiente musical de respaldo.
  - Metadatos integrados: recuento de canciones y duración acumulada de la playlist.
  - Botón flotante de reproducción rápida con 1 clic para iniciar o pausar la lista completa al instante.
  - Navegación directa al detalle de la playlist seleccionada en `PlaylistsView`.
- **Pistas recientes y actividad**:
  - Listado compacto de las últimas pistas agregadas con reproducción instantánea y toggle de favoritos.
  - Historial de actividad de descargas con badges de estado (`completado`, `procesando`, `error`, `omitido`) y formatos.

#### Automatización y CI/CD en GitHub Actions
- **Pipeline de Integración Continua (`.github/workflows/ci.yml`)**:
  - Validación automatizada de calidad, linters y tests en React/TypeScript (Vitest, Prettier, ESLint, TypeScript), Go (gofmt, go vet, go test) y Rust/Tauri (cargo fmt, clippy, cargo test).
- **Pipeline de Publicación de Releases (`.github/workflows/release.yml`)**:
  - Empaquetado multiplataforma automático activado por tags Git (`v*`) con `tauri-apps/tauri-action`.
  - Generación de instaladores para Windows (`.msi`, `.exe` NSIS) y Linux (`.AppImage`, `.deb`, `.rpm`) adjuntos a GitHub Releases.

### Corregido

- **Compatibilidad y empaquetado de AppImage**: Corrección del plugin de GStreamer en distribuciones Linux no Debian y configuración de rutas de códecs de audio del anfitrión para evitar congelamientos en WebKitGTK.

---

## [1.6.0] - 2026-11-18

### Añadido

#### Gestión Dinámica de Portadas para Playlists
- **Persistencia y migración de esquema en SQLite**: Incorporación retrocompatible del campo `cover_path TEXT NULL` en la tabla `playlists` con soporte nativo en el struct de dominio `Playlist`.
- **Asignación automática de carátula**: Asignación automática de la miniatura de la primera canción insertada en la lista como portada representativa.
- **Reasignación dinámica y aleatoria ante eliminación**: Al eliminar o desvincular una pista cuya miniatura correspondía a la portada activa, el repositorio SQLite selecciona aleatoriamente (`ORDER BY RANDOM() LIMIT 1`) otra pista perteneciente a la lista para actualizar la carátula, recurriendo a un estado vacío por defecto si la lista queda sin canciones.
- **Integración visual en Frontend**:
  - Renderizado de miniatura con bordes redondeados y sombra en las tarjetas del listado lateral de playlists.
  - Portada destacada de 64×64 en el encabezado de detalle de la playlist activa con badge de tipo y fallback estético a icono `ListMusic`.
  - Icono de previsualización en el menú contextual de marcadores y guardado en listas (`PlaylistBookmarkMenu`).

#### Tooling de Desarrollo y Flujo de Release Aislado
- **Comando `make dev`**: Acceso directo para levantar el entorno completo de desarrollo con Hot-Reload.
- **Comando `make release`**: Compilación y aislamiento del ejecutable nativo de producción dentro de la carpeta raíz `/release/ytms-player`.
- **Exclusión en `.gitignore`**: Protección del directorio `/release/` para evitar rastreo accidental en Git.
- **Integración en `make desktop-shortcut`**: Enlace del lanzador del sistema `.desktop` apuntando exclusivamente al ejecutable de producción en `/release`.

---

## [1.5.1] - 2026-11-16

### Añadido

#### Persistencia Física de Logs en Disco (`/logs/app.log`) con Rotación y Límite de Tamaño
- **Almacenamiento físico en el Workspace**: Creación y validación automática del directorio `/logs` dentro de cada workspace (`LocalWorkspaceManager::initialize_or_validate`).
- **Archivo de registro estructurado (`app.log`)**: Escritura en disco de cada evento, advertencia o fallo con formato cronológico `[YYYY-MM-DD HH:mm:ss] [NIVEL] [contexto] mensaje`.
- **Límite optimizado y rotación automática (1 MB)**: Prevención de crecimiento desmedido en disco mediante rotación a `app.log.old` cuando el archivo supera 1 MB, conservando el historial sin saturar el almacenamiento.
- **Comandos Tauri nativos**: Incorporación de `append_log_entry`, `clear_log_file` y `open_logs_folder` para manipular el archivo físico y abrir directamente la carpeta en el explorador de archivos nativo (Nautilus/Dolphin, Windows Explorer, macOS Finder).
- **Acceso rápido desde la interfaz**: Botón *"Abrir /logs"* integrado tanto en el modal de diagnóstico `ErrorLogsModal` como en la Sección 4 de *Configuración del Workspace*.

---

## [1.5.0] - 2026-11-16

### Añadido

#### Subsistema Transversal de Diagnóstico y Registro de Errores (Error Logs)
- **Store global de eventos técnicos (`useLogStore` y API `logger`)**: Almacenamiento cronológico de todos los errores, advertencias e información de diagnóstico de la sesión con fecha y hora exacta (`YYYY-MM-DD HH:mm:ss`), nivel de severidad (`error`, `warn`, `info`) y contexto de ejecución (`streaming`, `player`, `toast`, `library`, `runtime`).
- **Intercepción automática de notificaciones Toast**: Integración transparente en `useToastStore` que captura automáticamente el 100% de los errores y advertencias emitidos hacia las alertas toast, garantizando que ninguna falla pase desapercibida si el usuario mantiene la aplicación minimizada o en segundo plano.
- **Escucha global de excepciones de ejecución**: Captura de errores no controlados (`window.onerror`) y rechazos de promesas asíncronas (`unhandledrejection`) con registro automático en memoria y persistencia en `localStorage` (acotado a los últimos 100 eventos).
- **Visor interactivo modal (`ErrorLogsModal`)**: Modal accesible de diagnóstico completo con filtrado por nivel de severidad, barra de búsqueda en tiempo real, copia individual de registros y botón de "Copiar reporte" estructurado para soporte y depuración.
- **Sección en Ajustes y acceso directo en Barra Lateral**:
  - En *Ajustes*, nueva sección dedicada con contador de errores, estado de estabilidad, vista previa de los últimos eventos y botón para abrir el visor completo.
  - En la barra lateral (`Sidebar`), botón de acceso directo con distintivo dinámico en rojo que indica el número de errores ocurridos durante la sesión.

---

## [1.4.1] - 2026-11-16

### Añadido

#### Extracción de Color Dominante e Iluminación Ambiental de Portada
- **Hook de extracción cromática (`useCoverDominantColor`)**: Análisis instantáneo de la miniatura del álbum mediante un `<canvas>` offscreen de 32×32 con filtrado ITU-R BT.601, discriminación de extremos acromáticos (blancos y negros) y ponderación por saturación para aislar el color más vibrante y representativo del álbum.
- **Resplandor ambiental dinámico en `NowPlayingView`**: Proyección de gradiente radial suave en el fondo detrás del visualizador (`<main>`) utilizando el color dominante extraído de la carátula, manteniendo intactos los fondos sólidos y de alto contraste en los controles (`<footer>`) y la barra superior (`<header>`).
- **Transición cromática atmosférica**: Desvanecimiento suave (`transition: all 1s ease-out`) al cambiar de pista entre las tonalidades de cada carátula.

### Mejorado

#### Cuadrícula Paralela y Tooltips en Ajustes de Personalización
- **Disposición paralela vertical con Grid auto-fit**: Las opciones de visualización en *Ajustes -> Personalización* ahora se organizan en columnas paralelas adaptables (`grid-cols-[repeat(auto-fit,minmax(210px,1fr))]`), optimizando el aprovechamiento horizontal del espacio y la ergonomía visual.
- **Descripción encapsulada en Tooltip con icono de información**: Se sustituyó el texto largo inferior por un icono `Info` con tooltip emergente flotante, dejando tarjetas más compactas, limpias y centradas en la previsualización interactiva.
- **Workspaces y Cuenta de YouTube en paralelo**: Integración de una cuadrícula adaptable (`repeat(auto-fit, minmax(min(100%, 420px), 1fr))`) que coloca ambas secciones una al lado de la otra expandiéndose al ancho máximo disponible, y apilándolas automáticamente solo cuando la ventana se reduce, eliminando el desperdicio de espacio vertical.

#### Dinámica y Rango Útil de Barras de Visualización
- **Desacoplamiento de atenuación por volumen máster**: Las barras de espectro (`SpectrumVisualizer`) y ondas de carátula (`CoverWavesVisualizer`) ahora escalan su altura en función de la actividad y contenido armónico real de la pista en reproducción, en lugar de verse colapsadas si el usuario escucha a volumen bajo.
- **Aprovechamiento completo del espacio de UI (hasta 94-96%)**: Curva perceptual y límites acotados que permiten a los picos de percusión y frecuencias medias y graves alcanzar la parte alta del contenedor visual sin desbordar los bordes de la interfaz.

### Corregido

#### Unificación Visual y Funcional de la Vista En Reproducción (Now Playing)
- **Corrección de fondo transparente en la barra de tiempo**: Se eliminó la sintaxis inválida `bg-muted/80` y se aplicó fondo sólido `var(--muted)` visible al 100%, permitiendo distinguir con total claridad la longitud completa de la pista frente al progreso reproducido.
- **Control de volumen con diseño y estilos del reproductor general**: Se incorporó el relleno dinámico con color primario del tema, thumb interactivo, texto de porcentaje (`0% - 100%`) e icono `VolumeX` en tono rojizo (`text-rose-400`) al silenciar, homologándolo al reproductor persistente.
- **Lógica y reactividad del botón Me gusta en Now Playing**: Corrección de la alternancia de estado (`!currentTrack.liked`), vinculación reactiva de la pista viva con `useLibraryStore`, actualización optimista en memoria en 0ms y sincronización bidireccional inmediata con `usePlayerStore.updateTrackMetadata`. Cuando la sincronización remota con YouTube reporta advertencia (microservicio no disponible), la UI ahora actualiza inmediatamente el corazón al estado ámbar local sin quedarse congelada en el estado anterior.

#### Previsualización Exclusiva por Hover en Ajustes
- **Aislamiento de estado en Personalización**: La animación interactiva de las tarjetas de visualizadores en *Configuración -> Personalización* ahora se activa **únicamente** cuando el cursor se posiciona sobre la opción (`isHovered`), corrigiendo el comportamiento previo donde la reproducción activa en segundo plano forzaba la animación constante de todas las tarjetas.

---

## [1.4.0] - 2026-11-16

### Añadido

#### Vista En Reproducción a Pantalla Completa (Now Playing View)
- **Modo expandido inmersivo**: Al hacer clic sobre la miniatura, título o botón de expandir en la barra de reproducción, se despliega una vista a pantalla completa dentro de la aplicación (`NowPlayingView`).
- **Controles centrados con barra superior**: Disposición ergonómica con la barra de progreso de tiempo ubicada por encima de los botones de reproducción (botón Play/Pause destacado de 56px, Shuffle, Skip, Repeat y botón de Me gusta sincronizado).
- **Cierre accesible**: Minimización fluida mediante botón superior, clic en chevron o tecla `Escape`.
- **Transición de subida y bajada (Slide Up & Slide Down)**: Animación fluida de deslizamiento vertical (`translate-y-full` a `translate-y-0`) con curva de aceleración orgánica `cubic-bezier(0.16, 1, 0.3, 1)` de 500 ms tanto al abrir como al cerrar la vista.
- **Fondo sólido y corrección de opacidad CSS**: Corrección de sintaxis incompatible de Tailwind CSS v3 sobre variables CSS (`bg-background/95`), aplicando un fondo sólido y 100% opaco (`bg-background` con superficie `var(--background)`) que cubre por completo el contenido inferior.

#### Suite Completa de 4 Visualizadores de Reproducción
- **Disco de Vinilo Analógico (`VinylVisualizer`)**: Acetato negro con surcos concéntricos reflexivos, destello cónico de luz especular, aguja interactiva con física realista y carátula central en rotación continua a 33⅓ RPM.
- **Barras Dinámicas de Espectro (`SpectrumVisualizer`)**: Ecualizador gráfico de 36 bandas reactivas impulsado por dinámicas de audio en tiempo real a 60 FPS, con barras de picos en suspensión gravitacional, gradientes visuales y reflejo especular invertido.
- **Aura Líquida / Onda Resonante Ambiental (`AmbientAuraVisualizer`)**: Anillos concéntricos fluidos y bioluminiscentes que se expanden, respiran y modulan su brillo y escala en sintonía con las frecuencias y armónicos de la música.
- **Carátula con Ondas Sonoras (`CoverWavesVisualizer`)**: Carátula del álbum fija y enmarcada con acabado estético de vinilo/CD y un osciloscopio simétrico de ondas de sonido vibrando activamente bajo la portada en función directa del volumen y ritmo musical.
- **Motor de Dinámicas de Audio en Tiempo Real (`useAudioDynamics`)**: Hook optimizado a 60 FPS que se enlaza a nodos de análisis Web Audio API (`AnalyserNode`) junto con un modelo armónico procedural de respaldo que decae naturalmente a cero al pausar o silenciar la reproducción.

#### API de Exportación y Registro Modular de Visualizadores
- **Contrato público de integración (`VisualizerProps`, `VisualizerModule`)**: Definición tipada para crear y conectar nuevos efectos o visualizaciones personalizadas con acceso directo al estado de reproducción (`track`, `isPlaying`, `currentTime`, `duration`, `volume`, `isMuted`, `audioElement`).
- **Registro extensible (`visualizerRegistry`, `registerVisualizer`)**: API de registro para incorporar animaciones dinámicas creadas por terceros o futuros parches.
- **Configuración y Previsualización en Personalización**: Subsección en *Ajustes -> Personalización* con selector de visualizador y previsualización animada en vivo al posar el cursor (*hover*) utilizando la pista en reproducción actual.

---

## [1.3.0] - 2026-11-16

### Añadido

#### Servidor Nativo de Streaming HTTP 206 (Byte-Range / Zero-Copy)
- **Servidor HTTP embebido en Rust**: Implementación nativa ultraligera con `tokio::net::TcpListener` en `127.0.0.1:0` (puerto efímero dinámico).
- **Soporte completo de Byte-Range (HTTP 206 Partial Content)**: Capacidad de servir fragmentos de audio bajo demanda directamente desde el disco mediante `tokio::io::copy` y `take` acotado sin cargar archivos completos en memoria RAM.
- **Independencia absoluta del microservicio Go para reproducción**: La aplicación de escritorio reproduce cualquier archivo de audio local de forma autónoma sin requerir Docker ni servicios externos encendidos (Go queda reservado exclusivamente para descargas remotas y OAuth).
- **Comando IPC `get_audio_stream_url`**: Resolución instantánea de rutas locales hacia URLs HTTP transmitibles (`http://127.0.0.1:<puerto>/stream?path=...`).
- **Control granular de scrubbing en la línea temporal**: Interacción suave de arrastre (`isSeekingLocally`) con actualización visual a 60 FPS sin parpadeos y emisión del seek definitivo al soltar el cursor (`onPointerUp`).

### Corregido

- **Eliminación del silencio al iniciar pistas**: Al conectar directamente mediante HTTP 206, GStreamer y WebKitGTK solicitan únicamente los metadatos iniciales sin buffers forzados ni conversiones síncronas Base64 / Blob.
- **Retrasos de salto temporal eliminados**: Al realizar un seek a cualquier punto de la línea temporal, el reproductor emite un Range request exacto y el backend en Rust se posiciona de inmediato en el byte correspondiente (`SeekFrom::Start`), logrando saltos instantáneos sin re-decodificar desde el segundo 0.
- **Eliminación de sobrecarga en memoria RAM**: Purgado del caché de Blob URLs en memoria (`audioBlobUrlCache`), reduciendo a prácticamente cero el consumo de RAM durante la reproducción.

---

## [1.2.0] - 2026-11-16

### Añadido

#### Sistema de Notificaciones Flotantes (Toasts)
- **API global desacoplada (`useToastStore`)**: Helpers reutilizables (`toast.info`, `toast.warning`, `toast.error`, `toast.success`).
- **Contenedor flotante (`ToastContainer`)**: Ubicación en esquina inferior derecha (`fixed bottom-24 right-6`) por encima del reproductor persistente sin empujar el flujo ni el layout de la interfaz.
- **Reloj temporizador circular**: Indicador de progreso SVG con gradiente circular animado (`primary` a `accent`) de 3 segundos sin texto numérico y botón de descarte inmediato ("X").

#### Experiencia de Like y Animación de Corazón
- **Animación orgánica de carga (`animate-heart-pulse`)**: El propio icono SVG del corazón pulsa suavemente durante la sincronización remota sin recurrir a spinners genéricos.
- **Estado desacoplado sin microservicio**: Si el microservicio Go está apagado o falla la conexión remota, el like se persiste localmente en SQLite y el corazón se pinta directamente en color naranja/ámbar (`fill-amber-500 text-amber-500`), notificando el estado mediante un Toast de advertencia y eliminando el banner superior intrusivo de error.

#### Detección y Gestión de Archivos Corruptos
- **Identificación visual de pistas dañadas**: Detección de fallos de decodificación (`MEDIA_ERR_DECODE`) y marcado dinámico en la biblioteca con etiqueta **Dañado** y estilizado de advertencia.
- **Salto automático protegido**: Notificación Toast técnica con el código del fallo y salto automático a la siguiente pista (`playNext()`), con límite de protección de hasta 4 fallos consecutivos.

#### Reproducción y Cola de Reproducción Estándar Spotify
- **Preservación de reproducción con filtros activos**: Al filtrar en biblioteca y presionar "Reproducir todos", si la canción actual está en el filtro, no se interrumpe ni corta la música; solo se actualiza la cola de reproducción.
- **Estándar Spotify en modo Aleatorio**: La pista en reproducción se conserva como la `#0` y el resto de canciones filtradas se barajan mediante Fisher-Yates detrás de ella.
- **Restauración de orden normal (`originalQueue`)**: Al desactivar el modo aleatorio (Shuffle OFF), se restituye de forma instantánea el orden secuencial normal del filtro activo de la biblioteca con el cursor en la posición correspondiente.

### Corregido

- **Eliminación del corte de audio y salto inicial**: Corrección de condición de carrera y eliminación del seek artificial (`currentTime = 0`) que provocaba vaciados de buffer y silencios en GStreamer/WebKitGTK al iniciar pistas.
- **Caché en memoria de Blob URLs (`audioBlobUrlCache`)**: Conversión y almacenamiento directo de objetos Blob en memoria para transiciones fluidas de 0 ms entre pistas sin congelar el hilo principal.
- **Desbloqueo de selector de tiempo**: Corrección del estado `isLoadingTrack` que quedaba congelado al pulsar reproducir sobre la misma canción activa.

---

## [1.1.0] - 2026-11-15

### Añadido y Mejorado

#### Personalización y Temas
- **Paletas de color temáticas**: 8 paletas integradas (Blue, Teal, Ember, Midnight, Denim, Pine, Burgundy, Amber).
- **Modos de visualización**: Soporte para Modo Claro, Modo Oscuro y Modo Sistema.
- **Selector rápido de tema**: Menú desplegable con previsualización de color en la barra lateral y botón de acceso rápido para conmutar entre modo claro y oscuro.
- **Iconografía adaptativa**: Iconos de advertencia, estado y controles integrados con el color de texto semántico del tema (`foreground`).

#### Barra Lateral (Sidebar)
- **Barra lateral colapsable**: Capacidad de contraer y expandir la barra haciendo clic en el logo de la aplicación, con persistencia entre sesiones (`localStorage`).
- **Modo contraído minimalista**: Oculta textos y badges numéricos, mostrando únicamente los iconos centrados.
- **Modo expandido optimizado**: Texto alineado a la izquierda inmediatamente al lado del icono y contadores numéricos alineados en el extremo derecho.
- **Reorganización modular**: Separación clara entre navegación principal superior (Biblioteca, Playlists, Descargas) y accesos secundarios inferiores (Tema, Recuperación, Configuración).

#### Playlists y Biblioteca
- **Apertura automática de playlists**: Al reproducir una playlist se abre directamente su panel de canciones en detalle y se activa el estilo visual de selección.
- **Filtro por playlist en Biblioteca**: Selector integrado en la barra superior junto al menú de acciones, adaptado a ancho completo mediante CSS Grid responsivo.
- **Indicador unificado de Like y sincronización**: Estado de sincronización integrado directamente en el botón de corazón (rojo: sincronizado con YouTube; naranja: guardado solo en local; borde verde: pista sincronizada sin Me gusta).

#### Configuración Reorganizada
- **Estructura en 4 secciones**: Personalización, Cuenta de YouTube, Espacios de trabajo (Workspaces) y Servidor/Herramientas.
- **Gestión visual de carpetas de biblioteca**: Selección rápida de carpetas de trabajo con tarjetas interactivas, alias descriptivos y detección automática de inicialización.
- **Monitoreo de estado de herramientas**: Tarjetas indicadoras de disponibilidad en tiempo real para el servidor local, motor de descarga (yt-dlp) y procesador de audio (FFmpeg).
- **Entrada protegida para servicios y cookies**: Campos con bloqueo de edición accidental, botones de selección de archivos simplificados y estilo outline en botones de cuenta.

#### Experiencia de Usuario y Redacción
- **Nombre de la aplicación**: Actualizado visualmente a **YouTube Desktop Player** en toda la interfaz, barra de título y diálogos nativos.
- **Simplificación del copy**: Eliminación de tecnicismos, jerga de bases de datos y rutas internas en todas las vistas y modales, priorizando instrucciones claras orientadas al usuario.

---

## [1.0.0] - 2026-11-15

### Añadido

#### Reproductor Persistente de Audio
- Motor de audio HTML5 con soporte nativo para decodificación y reproducción de streams locales en formatos `.mp3`, `.m4a` y `.opus`.
- Control de volumen calibrado perceptualmente 1:1 mediante curva cúbica de PulseAudio/PipeWire ($gain = v^3$).
- Barra de progreso y volumen con relleno dinámico visual (`bg-red-500`) e indicadores circulares responsivos con crecimiento al posar el cursor (*hover*).
- Pausa acústica inmediata y reinicio a `00:00` al cambiar de pista para eliminar sangrado residual y saltos de tiempo tardíos.
- Bloqueo y protección interactiva durante la carga e inicialización de audio (`isLoadingTrack`), deshabilitando el deslizador de tiempo para prevenir excepciones y fallos en WebKitGTK.
- Modo Aleatorio (*Shuffle*) persistente con algoritmo Fisher-Yates, respetado al seleccionar canciones desde playlists o la biblioteca.
- Modos de repetición cíclicos: cola completa, pista individual o desactivado.
- Precarga de datos en caché para transiciones instantáneas entre canciones.

#### Descargas, Historial y Microservicio Backend
- Microservicio backend autohospedado en Docker escrito en Go siguiendo Clean Architecture, con `yt-dlp` y `FFmpeg` con aceleración concurrente y tags ID3/Vorbis.
- Streaming de progreso bidireccional en tiempo real vía SSE (*Server-Sent Events*) con reporte de porcentaje, velocidad de descarga y ETA.
- Panel unificado de descargas activas e historial con divisores temporales estilo chat ("Hoy", "Ayer", día de la semana o fecha completa).
- Agrupador visual colapsable para descargas de listas y playlists con visualización de miniaturas y estado de post-procesamiento.
- Deduplicación en SQLite del historial de descargas mediante actualización de estados (`UPDATE`) sobre tareas encoladas.
- Botón y modal bloqueante de confirmación para purgar el historial de descargas sin afectar los archivos físicos.

#### Importación y Gestión de Playlists
- Previsualización rápida de listas y mixes de YouTube (`--dump-json --flat-playlist`) sin descarga anticipada de audio.
- Pre-selección inteligente por defecto para canciones con duración menor a 7 minutos (`< 420` segundos), omitiendo sesiones largas de más de una hora para optimizar el rendimiento.
- Barra de selección rápida con botones ("Todas", "< 7 min", "Ninguna") y distintivo `≥ 7 min` en canciones largas.
- Checkboxes independientes y selección táctil/ratón por fila completa.
- 3 opciones de destino: crear nueva playlist local, incorporar a playlist existente o importar únicamente a la biblioteca.
- Sincronización transaccional en SQLite evitando consultas N+1 y asociación garantizada de canciones a nuevas playlists al concluir las descargas.
- Sincronización opcional para desvincular temas eliminados de YouTube conservando los archivos físicos locales.

#### Biblioteca, Integridad y Archivos Huérfanos
- Base de datos local SQLite con claves foráneas activas (`PRAGMA foreign_keys = ON`) y operaciones transaccionales ACID.
- Virtualización con `@tanstack/react-virtual` que permite explorar bibliotecas de miles de pistas fluidamente a 60 FPS.
- Detección automática de integridad física: detección de archivos extraviados (`is_missing = 1`) y adopción de audios huérfanos con enriquecimiento automático de título, artista y duración desde YouTube.
- Modal interactivo de sincronización y actualización masiva de metadatos contra YouTube.
- Soporte para workspaces múltiples y desacoplados con archivo de validación `.localstream-workspace`.

#### Integración con YouTube Data API v3 (OAuth 2.0)
- Autenticación OAuth 2.0 PKCE con Google Cloud Platform y alcance ampliado (`youtube.force-ssl`).
- Sincronización automática de "Me gusta" (Likes) entre la biblioteca local y la cuenta de YouTube.
- Cierre de sesión seguro (*Logout*) y soporte para importar cookies de sesión en formato Netscape (`cookies.txt`) para contenido restringido.

#### Experiencia de Usuario y Seguridad
- Menú contextual desplegable de 3 puntos (`ActionMenu`) en todas las acciones de eliminación para prevenir clics accidentales.
- Modales de confirmación con captura de foco y cierre accesible con tecla `Escape`.
- Interfaz gráfica moderna en modo oscuro desarrollada con React, Tailwind CSS y componentes primitivos basados en Shadcn UI.
