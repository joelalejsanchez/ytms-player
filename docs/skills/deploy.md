---
name: deploying
description: Guía de contenedorización con Docker, configuración de Docker Compose, volúmenes compartidos de workspaces y empaquetado nativo de Tauri.
---

# Skill: Deploying & Contenedorización

## 1. Microservicio Go en Docker

- **Dockerfile Multi-stage:** Utilizar una imagen oficial de Go para compilar un binario estático optimizado y empaquetarlo en una imagen ligera (como `alpine` o `scratch`) junto con `yt-dlp` y `ffmpeg`.
- **Configuración de Docker Compose (`docker-compose.yml`):**

  ```yaml
  version: "3.8"
  services:
    ytms-player-backend:
      build: .
      container_name: ytms-player-backend
      ports:
        - "8080:8080"
      volumes:
        - ./workspace:/app/workspace
        - ./config/cookies.txt:/app/cookies.txt:ro
      restart: unless-stopped
  ```

- **Volúmenes y Seguridad**: Asegurar el montaje de la carpeta de trabajo (workspace) y el archivo de cookies en modo de solo lectura (:ro) para proteger las credenciales OAuth y de sesión de YouTube.

## 2. Empaquetado de Tauri en Linux

- **Dependencias del Sistema**: Asegurarse de tener instaladas las librerías de desarrollo de WebKitGTK y dependencias gráficas requeridas por Tauri v2 en Linux.

- **Build de Producción**: Ejecutar el empaquetado nativo optimizado mediante:

```Bash
cargo tauri build
```
