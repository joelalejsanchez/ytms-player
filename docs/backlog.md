# Backlog de Features e Ideas Futuras (`docs/backlog.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Performance y Core Engine)

*(Actualmente no hay tareas de prioridad alta pendientes; el motor de streaming nativo HTTP 206 Partial Content fue integrado en la versión 1.3.0).*

---

## 2. Prioridad Media (Roadmap v1.x)

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
  - Los desplegables `CustomSelect` de formato y ordenamiento varían dinámicamente de anchura según la longitud del texto de la opción activa (ej. al alternar entre *"Todos los formatos"* vs *"MP3"*, o *"Fecha de descarga"* vs *"Título"*), provocando desplazamientos horizontales bruscos en los controles adyacentes (botón ASC/DESC).
  - Asignar anchos mínimos consistentes o anchos fijos calibrados (`min-w-[130px]` / `min-w-[150px]` o `w-36` / `w-40`) a los contenedores/triggers de `CustomSelect` para garantizar estabilidad en la interfaz sin saltos de layout al cambiar filtros.
- [ ] **Ampliación de opciones en el menú contextual de 3 puntos (`ActionMenu`):**
  - **Información detallada de la pista (Track Info):** Modal o panel lateral para inspeccionar los metadatos completos del archivo (codec de audio, bitrate, frecuencia de muestreo, tamaño en disco, fecha de descarga, ID original y enlace directo de YouTube).
  - **Información y estadísticas de Playlist:** Modal con duración total acumulada (horas/minutos), recuento de temas, tamaño estimado en disco, ID de sincronización y enlace original a YouTube.
  - **Copiar enlace de YouTube al portapapeles:** Acción rápida en el menú contextual para compartir o abrir en el navegador.
- [ ] **Pipeline CI/CD con GitHub Actions para compilación y releases automáticas:**
  - Configurar workflow con matriz multiplataforma (`tauri-apps/tauri-action`) en runners `windows-latest` y `ubuntu-latest`.
  - Compilación automática de instaladores nativos para usuarios no técnicos (`.msi` / `.exe` para Windows, `.deb` / AppImage / binario para Linux) activada por push de tags (`v*.*.*`) o ejecución manual (`workflow_dispatch`).
  - Publicación automatizada de los instaladores directamente en la sección de **GitHub Releases** del repositorio.
  - Publicación automatizada de la imagen Docker del microservicio Go en GitHub Packages / Container Registry (`ghcr.io`), permitiendo levantar el backend con un simple `pull` sin necesidad de compilar código Go localmente.
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
