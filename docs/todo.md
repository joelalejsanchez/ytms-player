# Backlog de Features e Ideas Futuras (`docs/todo.md`)

Este documento registra las características, mejoras y extensiones que **no están presentes actualmente** en **ytms-player** y que podrían ser incorporables en versiones posteriores según la necesidad.

---

## 1. Prioridad Alta (Performance y Core Engine)

- [ ] **Streaming nativo de audio mediante HTTP Byte-Range (HTTP 206 Partial Content / Zero-Copy):**
  - **Problema actual:** El reproductor lee el archivo completo a memoria RAM mediante IPC en Base64 (`read_audio_data_url`), y el hilo de JavaScript lo convierte a `Blob` síncronamente. En canciones de larga duración (sets de 1 a 3 horas, podcasts, etc.) o archivos grandes, esto satura cientos de megabytes de RAM, bloquea el hilo de la UI varios segundos y demora el inicio de la reproducción. En archivos pequeños también introduce una sobrecarga innecesaria de serialización IPC.
  - **Solución técnica planificada (Rust nativo en Tauri):**
    - Implementar un servidor HTTP embebido local y ultra-ligero en Rust (dentro del ejecutable de Tauri, ej. con `axum`, `tiny_http` o listener `tokio` en `127.0.0.1:<puerto_libre>`): `http://127.0.0.1:<puerto>/audio?path=<ruta_archivo>`.
    - Servir los archivos con soporte nativo de **HTTP 206 Partial Content (Range requests)** leyendo directamente bloques pequeños del disco bajo demanda (zero-copy / low-memory).
    - **Independencia total del microservicio Go:** Permite que la app de escritorio reproduzca cualquier archivo local de forma autónoma, sin requerir Docker ni que el microservicio esté encendido (Go queda reservado únicamente para descargas con `yt-dlp` y sincronización OAuth con YouTube).
    - El reproductor HTML5 solicitará únicamente los primeros ~64 KB de metadatos e iniciará la reproducción en menos de 50 ms (latencia imperceptible), permitiendo además saltos de reproducción (seek) instantáneos a cualquier punto de la línea temporal sin descargar todo el archivo y con consumo de RAM prácticamente cero.

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
