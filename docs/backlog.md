# Backlog de Features e Ideas Futuras (`docs/backlog.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Bugs y Core UX)

*(Actualmente no hay incidencias ni tareas de prioridad alta pendientes; la discriminación de origen de pista y exclusión de archivos locales en la sincronización de Likes fue integrada en la versión 1.9.1).*

---

## 2. Prioridad Media (Roadmap v1.x)

- [ ] **Nuevos visualizadores estáticos (Estuche/Cartucho físico y Disco estático) y depuración minimalista (`VisualizerRegistry` / `NowPlayingView`):**
  - **Módulo de Portada Estática (Estuche / Formato Físico):** Incorporar un visualizador estático cuadrado/rectangular inspirado en estuches físicos coleccionables (caja Blu-ray, cartucho o disquete retro tipo Nintendo donde el lateral/lomo exhibe el arte de la carátula), brindando una presentación cuidada y sobria sin deformaciones dinámicas.
  - **Módulo de Disco Estático:** Añadir una variante de vinilo/CD estática que preserve la textura y acabados analógicos pero prescinda de la rotación continua, orientada a quienes prefieren una estética musical clásica sin movimiento continuo en pantalla ni consumo innecesario de GPU.
  - **Depuración de textos y adornos superfluos:** Eliminar de todos los visualizadores existentes (`VinylVisualizer`, `AmbientAuraVisualizer`, `CoverWavesVisualizer`) las etiquetas y leyendas de texto secundarias innecesarias (ej. "33⅓ RPM", "Onda Resonante Activa", "Ondas de sonido reactivas" o indicadores de frecuencia), manteniendo la presentación artística limpia y directa sin textos distractores.

- [ ] **Rediseño de Toasts de notificación: Apilado de hojas (Stacked Cards) y temporizador perimetral animado (`ToastContainer`):**
  - **Presentación apilada estilo hojas superpuestas:** Reemplazar la lista vertical de alertas por una pila de tarjetas superpuestas (estilo *Sonner* / *stacked sheets*). El último mensaje recibido se ubica al frente con legibilidad completa, mientras los anteriores se resguardan sutilmente detrás con escala reducida y ligero desplazamiento vertical, reduciendo la saturación visual.
  - **Supresión del loader circular:** Retirar el reloj circular SVG de cuenta regresiva del extremo derecho de cada toast.
  - **Temporizador en borde perimetral animado:** Dibujar una animación de borde perimetral que recorre la tarjeta con el color correspondiente a la variante (destructivo para error, ámbar para advertencia, esmeralda para éxito y primario para info), rotando o avanzando progresivamente para indicar el tiempo de expiración restante de forma elegante.

- [ ] **Reproducción instantánea mediante doble clic en filas de canciones (`LibraryView` / `TrackRow`):**
  - **Contexto UX:** En aplicaciones de música de escritorio estándar (Spotify, Apple Music, VLC), el doble clic sobre cualquier fila de pista detona inmediatamente la reproducción de dicha canción y establece el contexto de reproducción actual.
  - **Implementación requerida:** Añadir el evento `onDoubleClick` en el contenedor de la fila de pista (`TrackRow`), invocando la acción de reproducción sobre la pista seleccionada y actualizando la cola con el listado activo de la biblioteca.
  - **Aislamiento de controles interactivos:** Evitar que el doble clic se dispare inadvertidamente cuando el usuario interactúa con botones internos específicos (botón de like, menú de opciones de 3 puntos `ActionMenu` o selector de favoritos) mediante discriminación del objetivo del evento o control de propagación.

- [ ] **Accesibilidad, bloqueo de scroll y trampa de foco en componentes emergentes y modales (`UI / A11y`):**
  - **Diagnóstico del problema:** Los modales y diálogos emergentes actuales (`ConfirmationModal`, `PlaylistImportModal`, `MetadataSyncModal`, `ErrorLogsModal`, `ActionMenu`) permiten que la rueda del ratón o gestos táctiles continúen desplazando el fondo de la pantalla (_scroll leak_), no capturan totalmente las interacciones de puntero y carecen de confinamiento de teclado. Al presionar `Tab`, el foco salta a controles invisibles o situados detrás del modal, violando las pautas de accesibilidad WAI-ARIA Dialog.
  - **Bloqueo de scroll (Scroll Lock estilo shadcn/Radix):** Inmovilizar el desplazamiento de fondo (`overflow: hidden` o bloqueo en contenedor raíz) al abrir cualquier diálogo o modal, compensando dinámicamente el ancho de la barra de desplazamiento para evitar saltos visuales de interfaz (_layout shift_).
  - **Trampa de foco (Focus Trap) y navegación accesible:** Confinar el ciclo de teclado (`Tab` / `Shift+Tab`) estrictamente dentro del contenedor emergente. Enfocar automáticamente el primer elemento interactivo o de confirmación al montar y restaurar el foco al elemento detonante (_trigger_) al desmontar.
  - **Descarte por teclado e interacciones:** Implementar cierre consistente mediante la tecla `Escape` y bloqueo estricto de eventos de puntero en el fondo (`inert` o backdrop con bloqueo de clics/taps).
  - **Atributos semánticos ARIA:** Garantizar `role="dialog"` o `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` y `aria-describedby` en todos los componentes modales y menús contextuales.

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
