# Changelog (`docs/changelog.md`)

Todos los cambios notables y características incorporadas en este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
