# Changelog (`docs/changelog.md`)

Todos los cambios notables y características incorporadas en este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
