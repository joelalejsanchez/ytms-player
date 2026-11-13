---
name: optimization
description: Pautas avanzadas de optimización de rendimiento para el frontend con React, Tauri, Zustand y el backend en Go (goroutines, workers pool, memoización, virtualización).
---

# Skill: Optimización de Rendimiento (Frontend & Backend)

## 1. Frontend (React, Tauri, Zustand, Tailwind)

- **Memoización Estricta:** Utilizar `React.memo` en componentes repetitivos o filas de la biblioteca para evitar re-renders masivos cuando el reproductor global actualice su estado.
- **Hooks Optimizados:** Envolver funciones pasadas como _props_ en `useCallback` y computaciones pesadas o filtrados de listas en `useMemo`.
- **Zustand Stores Granulares:** Dividir el estado global en stores pequeños y específicos (`usePlayerStore`, `useDownloadStore`) para evitar renderizados innecesarios en componentes que no consumen esa porción del estado.
- **Virtualización de Listas:** Si la biblioteca supera los cientos de elementos en disco, implementar virtualización (ej. `@tanstack/react-virtual`) para renderizar únicamente los elementos visibles en el DOM.

## 2. Backend (Go - Microservicio de Descargas)

- **Concurrency & Workers Pool:** Controlar el uso de `yt-dlp` mediante canales limitados y pools de trabajadores para evitar saturar la CPU y el I/O del disco al procesar múltiples peticiones simultáneas.
- **Gestión de Memoria y Stdin/Stdout:** Leer de forma eficiente los buffers de salida de `yt-dlp` para emitir eventos de progreso por SSE sin acumular basura en memoria (_garbage collection pressure_).
- **Cierre de Descriptores:** Asegurar el cierre inmediato de ficheros y sockets HTTP con `defer` para evitar fugas de recursos en contenedores Docker de larga duración.
