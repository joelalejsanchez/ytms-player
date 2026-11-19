# Backlog de Features e Ideas Futuras (`docs/backlog.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Bugs y Core UX)

- [ ] **Corrección de estado activo y Quick Play en cards de Playlists (`HomeView`):**
  - **Falsa activación simultánea de botones Play:** Actualmente `isCurrentPlaylist` se evalúa mediante `playlistTracks.some(t => t.youtube_id === currentTrack.youtube_id)`. Si una pista está presente en múltiples playlists, el botón de Play/Pause activo (`opacity-100`) aparece visualmente en todas las cards que contienen dicha pista. Al hacer clic en esas otras cards no se conmuta la reproducción hacia la playlist seleccionada sino que se pausa la pista actual.
  - **Solución requerida para tracking de playlist:** Vincular el estado de reproducción al identificador de la playlist activa (`activePlaylistId` en `usePlayerStore` o contexto de la cola) en vez de basarse únicamente en la presencia de la canción.
  - **Visibilidad y acción en listas sin pistas:** Cuando una playlist no posee canciones (`hasTracks === false`), el botón de Quick Play desaparece y el clic sobre la card redirige a la pantalla de Playlists. Proveer un botón visible (o estado deshabilitado con feedback visual) para evitar saltos inesperados de pantalla y mejorar la consistencia de interacción.

- [ ] **Transición instantánea en indicadores circulares de reproducción y volumen (`PersistentPlayer` y `NowPlayingView`):**
  - Al hacer clic o arrastrar en la barra de progreso (seek bar) o en el control de volumen, el indicador circular debe posicionarse instantáneamente bajo el cursor del ratón.
  - Actualmente existe una animación de transición con curva Bézier que genera un salto visual elástico perceptible o desfasado antes de estabilizarse.
  - Se debe suprimir la animación de transición (`transition-none` o duración cero en la posición del thumb) manteniendo íntegra la lógica y comportamiento de audio actual.

- [ ] **Rediseño de navegación en Playlists (Vista de lista completa -> Vista de detalle):**
  - Sustituir la distribución actual de dos paneles divididos simultáneos por una vista secuencial limpia:
    1. **Pantalla principal:** Muestra la lista completa de playlists en cuadrícula/lista a ancho completo.
    2. **Pantalla de detalle:** Al hacer clic sobre una playlist, se abre la vista detallada con su carátula, estadísticas y todas sus canciones.
    3. **Botón de retorno:** Botón superior para volver fácilmente a la vista general de todas las playlists.

- [ ] **Discriminación de origen de pista (`origin`) y exclusión de archivos locales en sincronización de Likes (`LibraryView` / Core Rust / Go):**
  - **Diagnóstico del problema:** Al pulsar "Sincronizar Me gusta", la app consulta en lote a la YouTube Data API v3 (`POST /api/sync-likes`) enviando todos los identificadores de la base de datos (`track_repo.get_all_tracks()`). Si el usuario ha importado o adoptado archivos de audio locales cuyos identificadores no corresponden al formato estricto de YouTube (11 caracteres alfanuméricos) o no provienen de dicha plataforma, la validación en Go (`ValidateYouTubeID`) rechaza la petición completa con error 400 (`validation_failed`), abortando la sincronización de likes para todo el catálogo restante.
  - **Identificador de origen (`origin`):** Incorporar la columna `origin TEXT NOT NULL DEFAULT 'youtube'` en la tabla `tracks` de SQLite (valores admisibles: `'youtube'` y `'local'`), garantizando migración segura (`ALTER TABLE`) y sincronización en los modelos de datos en Rust (`Track`, `NewTrack`) y TypeScript.
  - **Filtrado previo en Tauri / Rust (`sync_likes_with_youtube`):** Al sincronizar likes, filtrar y enviar al microservicio únicamente aquellas pistas cuyo `origin == "youtube"`, omitiendo automáticamente pistas locales y optimizando el consumo de cuota de la API de YouTube.
  - **Resiliencia en Microservicio Go (`SyncLikesUseCase`):** Hacer tolerante la validación por lotes para que un identificador inválido o con error de calificación individual no provoque el rechazo en bloque del resto de canciones válidas del lote.
  - **Feedback y consistencia UX:** Ajustar `TrackRow` y vistas de reproducción para que las pistas locales gestionen su estado de favorito puramente en SQLite sin intentar sincronizar contra la API de YouTube ni emitir errores.

---

## 2. Prioridad Media (Roadmap v1.x)

- [ ] **Alineación de metadatos en cards de Playlists (`HomeView`):**
  - En las tarjetas de playlist de la pantalla de inicio, ubicar en la misma fila horizontal el título de la playlist y su duración acumulada.
  - Ubicar el conteo de canciones justo debajo de ambos elementos en una segunda línea para mayor legibilidad y orden visual.

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

- [ ] **Consumo dinámico de versión desde `package.json` en UI (`WorkspaceSettingsView`):**
  - Actualmente el badge de versión en la sección de Personalización (`WorkspaceSettingsView.tsx`) está escrito como un literal estático (ej. `v1.7.5`), lo que exige edición manual en cada release.
  - Configurar la importación dinámica de la versión desde `package.json` en Vite o mediante la API de Tauri (`@tauri-apps/api/app`), asegurando que la interfaz siempre refleje la versión real del proyecto automáticamente sin riesgo de desincronización humana.

- [ ] **Tarjeta superior de información de la aplicación (`WorkspaceSettingsView`):**
  - Incorporar en la cabecera superior de la vista de Configuración una tarjeta informativa del sistema con:
    - **Nombre oficial:** Your Tracks Music Server (`ytms-player`).
    - **Versión del producto:** Badge dinámico sincronizado (ej. `v1.7.5`).
    - **Autor(es) y contacto:** Joel Alejandro Sánchez Valdez.
    - **Licencia:** GPL-3.0-or-later con enlace a términos de licencia.
    - **Tecnologías y arquitectura:** Tauri v2, React 18, Vite, Rust, SQLite.
    - **Enlaces rápidos:** Acceso directo a documentación local (`docs/`), repositorio y reporte de incidencias.

- [ ] **Acción rápida para redescarga de Playlists vinculadas:**
  - Botón directo en la vista de playlist para aquellas que posean un `youtube_playlist_id`.
  - Redirecciona automáticamente a la vista de Descargas precargando el ID o enlace de la lista para facilitar la re-descarga y recuperación de audios corruptos o faltantes.
- [ ] **Barra inferior de reproducción adaptable (Responsive PlayerBar):**
  - Implementación de layout adaptativo y breakpoints para ventanas compactas o modo de pantalla dividida.
  - Reorganización de elementos: apilar la barra de progreso, compactar el control de volumen en menú desplegable o slider flotante y priorizar la visibilidad de controles esenciales (Play/Pause, anterior/siguiente y carátula).
- [ ] **Reubicación de la vista de Diagnóstico y Errores (Bugs):**
  - Remover la opción de logs/bugs del sidebar principal para simplificar y limpiar la navegación general.
  - Integrar el visor de logs y diagnóstico exclusivamente dentro de la vista de Configuración.
- [ ] **Microinteracción UX en el logo del Sidebar:**
  - Al colocar el cursor (hover) sobre el logo de la aplicación en la cabecera del sidebar, sustituir dinámicamente el logo por el icono estándar de colapsar/expandir barra lateral (ej. `PanelLeftClose` / icono de sidebar común).
  - Clarifica al usuario que el logo actúa como detonante interactivo para alternar el estado del sidebar.
- [ ] **Corrección de layout y alineación de scroll en la vista de Playlists:**
  - Solucionar la inconsistencia visual donde el scroll de la lista de playlists queda separado de los items mientras que en la card de pistas aparece pegado.
  - Configurar `padding: 0` en el contenedor scrolleable padre y aplicar paddings específicos en los componentes hijos contenedores de tracks para que la barra de scroll quede pegada al borde de manera uniforme en ambos paneles.
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
