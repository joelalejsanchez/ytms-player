# Backlog de Features e Ideas Futuras (`docs/todo.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Performance y Core Engine)

*(Actualmente no hay tareas de prioridad alta pendientes; el motor de streaming nativo HTTP 206 Partial Content fue integrado en la versión 1.3.0).*

---

## 2. Prioridad Media (Roadmap v1.x)

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

---

## 3. Prioridad Baja (Casos Específicos o Opcionales)

- [ ] **Sincronización selectiva de canciones en Playlists vinculadas:**
  - En playlists sincronizadas, elegir qué canciones individuales ignorar o congelar localmente aunque hayan sido eliminadas en el canal de YouTube.
- [ ] **Editor manual de etiquetas de metadatos (Tag Editor integrado):**
  - Permitir al usuario modificar manualmente el título, artista o álbum desde la biblioteca y reescribir los tags ID3v2 / Vorbis Comments directamente en el archivo de audio físico.
- [ ] **Ecualizador gráfico (Equalizer DSP):**
  - Implementación de ecualizador de 5 a 10 bandas mediante Web Audio API para personalizar el perfil de sonido (graves, medios, agudos).
