# Changelog (`docs/changelog.md`)

Todos los cambios notables y características incorporadas en este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
