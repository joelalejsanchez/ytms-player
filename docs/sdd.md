# SOFTWARE DESIGN DOCUMENT (SDD): LOCALSTREAM COMPLETE ARCHITECTURE

## 1. VISIÓN GENERAL Y PROPÓSITO

LocalStream es una aplicación de escritorio nativa orientada al alto rendimiento, construida con **Tauri (Frontend en React/TypeScript y Backend en Rust)** y complementada con un microservicio backend autohospedado en **Docker (Go)**.

Su propósito es gestionar, descargar, reproducir y sincronizar contenido multimedia de YouTube de forma local, garantizando:

- Prevención de archivos y registros duplicados.
- Gestión de múltiples workspaces independientes.
- Almacenamiento local organizado por identificadores de YouTube.
- Sincronización de metadatos y estados de likes.
- Recuperación ante fallos o pérdida de archivos físicos.
- Comunicación eficiente entre frontend, backend nativo y microservicio.
- Alto rendimiento y bajo consumo de recursos en reposo.

---

## 2. ESTRUCTURA DEL MONOREPO

La arquitectura del proyecto estará organizada en un único monorepo:

```
/local-stream-root
│
├── /docs
│   └── sdd.md
│
├── /tauri-app
│   ├── /src-tauri
│   │   ├── /src
│   │   │   ├── /domain
│   │   │   ├── /application
│   │   │   ├── /infrastructure
│   │   │   ├── /interfaces
│   │   │   └── main.rs
│   │   └── Cargo.toml
│   │
│   ├── /src
│   │   ├── /components
│   │   ├── /features
│   │   ├── /hooks
│   │   ├── /stores
│   │   ├── /services
│   │   ├── /schemas
│   │   ├── /types
│   │   └── /lib
│   │
│   ├── package.json
│   └── vite.config.ts
│
└── /go-microservice
    ├── Dockerfile
    ├── go.mod
    └── /src
        ├── /domain
        ├── /usecases
        ├── /adapters
        └── /handlers
```

**Stack tecnológico:**

- Desktop Framework: Tauri.
- Frontend: React + TypeScript.
- UI: Tailwind CSS + Shadcn UI.
- Estado global: Zustand.
- Validación: Zod.
- Backend nativo: Rust.
- Base de datos: SQLite.
- Microservicio: Go.
- Contenedorización: Docker.
- Descargas: yt-dlp.
- Procesamiento multimedia: FFmpeg.
- Comunicación en tiempo real: Server-Sent Events (SSE).

---

## 3. WORKSPACES Y SISTEMA DE ARCHIVOS

### 3.1. Workspace Root

El usuario podrá seleccionar un directorio local desde la interfaz de configuración de Tauri.

Este directorio funcionará como raíz independiente de almacenamiento de LocalStream.

### 3.2. Archivo de control

Al seleccionar un workspace, la aplicación deberá crear o validar un archivo de control denominado:

```
.localstream-workspace
```

Este archivo permitirá identificar y validar que un directorio corresponde a un workspace de LocalStream.

### 3.3. Estructura automática del workspace

Una vez inicializado, el directorio tendrá la siguiente estructura:

```
/Workspace-Root
│
├── .localstream-workspace
│
├── /tracks
│   ├── dQw4w9WgXcQ.mp3
│   ├── abc123xyz89.m4a
│   └── ...
│
└── /thumbnails
    ├── dQw4w9WgXcQ.jpg
    ├── abc123xyz89.jpg
    └── ...
```

### 3.4. Nomenclatura de archivos

Todos los archivos multimedia y miniaturas utilizarán estrictamente el `youtube_id` como nombre base.

**Convención:**

- Audio: `<youtube_id>.<extension>`
- Miniatura: `<youtube_id>.jpg`

Ejemplo:

```
dQw4w9WgXcQ.mp3
dQw4w9WgXcQ.jpg
```

Esta convención permitirá:

- Identificación directa de archivos.
- Búsquedas rápidas en el sistema operativo.
- Prevención de duplicados.
- Correspondencia inequívoca entre registros SQLite y archivos físicos.

### 3.5. Manejo de archivos extraviados

La aplicación deberá implementar un mecanismo de verificación de integridad entre SQLite y el sistema de archivos.

**Regla de negocio:**

Si un registro de la tabla `tracks` no encuentra su archivo físico correspondiente dentro de `/tracks`, deberá actualizarse automáticamente:

```
UPDATE tracks
SET is_missing = 1
WHERE youtube_id = ?;
```

Si el archivo vuelve a estar disponible, el estado deberá actualizarse:

```
UPDATE tracks
SET is_missing = 0
WHERE youtube_id = ?;
```

Los registros afectados se expondrán en un panel dedicado de recuperación de archivos.

---

## 4. ESQUEMA DE BASE DE DATOS SQLITE

La base de datos será administrada exclusivamente por el backend Rust de Tauri.

### 4.1. Tabla: `tracks`

Almacena los metadatos y el estado local de cada contenido multimedia.

```
CREATE TABLE tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    published_at DATETIME NULL,
    file_extension TEXT NOT NULL,
    thumbnail_path TEXT NULL,
    synced BOOLEAN DEFAULT 0,
    liked BOOLEAN NULL,
    is_missing BOOLEAN DEFAULT 0,
    file_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2. Tabla: `playlists`

Almacena las playlists creadas o importadas por el usuario.

```
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    youtube_playlist_id TEXT UNIQUE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3. Tabla: `playlist_tracks`

Implementa la relación muchos a muchos entre playlists y tracks.

```
CREATE TABLE playlist_tracks (
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,

    FOREIGN KEY (playlist_id)
        REFERENCES playlists(id)
        ON DELETE CASCADE,

    FOREIGN KEY (track_id)
        REFERENCES tracks(id)
        ON DELETE CASCADE,

    PRIMARY KEY (playlist_id, track_id)
);
```

### 4.4. Consideraciones de integridad

- `youtube_id` será el identificador único de cada contenido multimedia.
- No se permitirá insertar dos registros con el mismo `youtube_id`.
- Las relaciones de playlists deberán mantener integridad referencial.
- SQLite deberá tener habilitado `PRAGMA foreign_keys = ON`.
- Las operaciones de escritura relacionadas deberán ejecutarse mediante transacciones.
- La base de datos será independiente por workspace.

---

## 5. ARQUITECTURA CLEAN ARCHITECTURE

Tanto el backend Rust de Tauri como el microservicio Go implementarán una arquitectura de cuatro capas.

El objetivo es mantener la lógica de negocio independiente de los frameworks, las tecnologías de persistencia y los mecanismos de comunicación.

### 5.1. Dominio (Domain)

Contiene las reglas fundamentales del negocio.

Responsabilidades:

- Definición de entidades.
- Objetos de valor.
- Reglas de negocio.
- Interfaces y contratos abstractos (puertos).
- Validaciones independientes de infraestructura.

No deberá depender de frameworks externos ni implementaciones concretas.

### 5.2. Casos de uso (Application / UseCases)

Contiene la orquestación de las operaciones de negocio.

Responsabilidades:

- Inicialización y validación de workspaces.
- Registro de tracks.
- Gestión de playlists.
- Control de duplicados.
- Gestión de descargas.
- Sincronización de likes.
- Verificación de integridad de archivos.
- Recuperación de archivos extraviados.

Los casos de uso interactuarán con el dominio mediante interfaces abstractas.

### 5.3. Adaptadores (Infrastructure / Adapters)

Implementa los mecanismos concretos necesarios para ejecutar los casos de uso.

Responsabilidades:

- Repositorios SQLite.
- Operaciones del sistema de archivos.
- Clientes HTTP.
- Integración con yt-dlp.
- Integración con FFmpeg.
- Lectura de configuración.
- Integración con YouTube Data API.
- Gestión de procesos externos.

### 5.4. Handlers / Framework Drivers

Representa la capa de entrada y salida del sistema.

**En Tauri:**

- Comandos IPC.
- Componentes React.
- Hooks.
- Integración con Zustand.
- Comunicación con el microservicio.

**En Go:**

- Endpoints REST.
- Handlers HTTP.
- Emisión de eventos SSE.
- Middleware.
- Healthchecks.

**Regla arquitectónica:** Las dependencias deberán apuntar hacia el dominio. Ninguna regla de negocio deberá depender directamente de SQLite, React, Tauri, Docker o HTTP.

---

## 6. ESPECIFICACIÓN DE LA API REST Y SSE (MICROSERVICIO GO)

El microservicio Go será responsable de ejecutar las operaciones de descarga y sincronización que requieran comunicación externa con YouTube.

### 6.1. POST `/api/download`

**Propósito:** Iniciar la descarga de un video o playlist de YouTube.

**Entrada:**

- URL del video o playlist.
- Metadatos de destino.
- Configuración de formato de audio.
- Directorios de almacenamiento correspondientes al workspace.

**Proceso interno:**

1. Validar la URL recibida.
2. Identificar si se trata de un video individual o una playlist.
3. Extraer el `youtube_id`.
4. Comprobar si el contenido ya existe en el destino.
5. Ejecutar yt-dlp.
6. Procesar el audio mediante FFmpeg.
7. Extraer metadatos.
8. Incrustar tags ID3 o Vorbis según el formato.
9. Guardar el archivo multimedia utilizando el `youtube_id` como nombre base.
10. Extraer y guardar la miniatura.
11. Informar el resultado de la operación.

**Convención de almacenamiento:**

```
/tracks/<youtube_id>.<extension>
/thumbnails/<youtube_id>.jpg
```

**Resultado esperado:**

- Estado de la descarga.
- `youtube_id`.
- Metadatos extraídos.
- Extensión final.
- Tamaño del archivo.
- Rutas de almacenamiento.
- Información de errores, cuando corresponda.

### 6.2. GET `/api/progress/stream`

**Propósito:** Transmitir el progreso de las descargas en tiempo real mediante Server-Sent Events.

**Protocolo:** SSE (`text/event-stream`).

**Información emitida:**

- Identificador de la tarea.
- `youtube_id`.
- Estado de la descarga.
- Porcentaje completado.
- Velocidad de descarga.
- Tamaño descargado.
- Tiempo estimado restante, cuando esté disponible.
- Errores y mensajes de estado.

**Ejemplo de evento:**

```
event: download_progress
data: {
  "task_id": "task-001",
  "youtube_id": "dQw4w9WgXcQ",
  "status": "downloading",
  "progress": 65.4,
  "speed": "2.5 MiB/s",
  "eta": "00:00:18"
}
```

**Requisitos de rendimiento:**

- Mantener una conexión SSE persistente.
- No realizar polling continuo desde React.
- Emitir eventos únicamente cuando exista información nueva.
- Evitar ciclos de procesamiento innecesarios en reposo.
- Gestionar reconexiones y desconexiones del cliente.
- Permitir la transmisión concurrente del progreso de múltiples tareas.

### 6.3. POST `/api/sync-likes`

**Propósito:** Sincronizar el estado de los likes de YouTube con la base de datos local.

**Proceso interno:**

1. Recibir la lista de identificadores que deben sincronizarse.
2. Validar las credenciales OAuth 2.0.
3. Consultar por lotes la YouTube Data API v3.
4. Identificar qué contenidos están marcados como favoritos.
5. Devolver los resultados al backend Rust.
6. Actualizar SQLite mediante transacciones.
7. Marcar los registros procesados como sincronizados.

**Seguridad:**

- OAuth 2.0 será el mecanismo de autenticación para acceder a los datos de la cuenta del usuario.
- El archivo `cookies.txt` podrá utilizarse en los procesos de yt-dlp que lo requieran.
- Las cookies se montarán en Docker en modo de solo lectura.
- Las credenciales no deberán exponerse al frontend ni incluirse en logs.

### 6.4. GET `/api/health`

**Propósito:** Verificar la disponibilidad del microservicio Go.

**Responsabilidades:**

- Comprobar que el servidor HTTP está operativo.
- Verificar la disponibilidad de las dependencias esenciales.
- Informar el estado del contenedor.
- Permitir que Tauri determine si el backend está disponible.

**Respuesta esperada:**

```
{
  "status": "healthy",
  "service": "localstream-go",
  "version": "1.0.0"
}
```

---

## 7. ARQUITECTURA FRONTEND Y RENDIMIENTO

El frontend estará construido con React y TypeScript, utilizando Zustand para la gestión del estado global.

### 7.1. Gestión de estado global (Zustand)

Se implementarán stores independientes según la responsabilidad funcional.

#### `usePlayerStore`

Gestionará el reproductor persistente ubicado en la parte inferior de la interfaz.

Responsabilidades:

- Track actual.
- Estado de reproducción.
- Play / Pause.
- Seek.
- Volumen.
- Duración.
- Tiempo actual de reproducción.
- Cola de reproducción.

#### `useDownloadStore`

Gestionará las tareas de descarga y la comunicación con el stream SSE.

Responsabilidades:

- Conexión con `/api/progress/stream`.
- Estado de conexión.
- Cola de descargas.
- Progreso individual.
- Velocidad de descarga.
- Errores.
- Estados de las tareas.
- Reconexión ante desconexiones.

### 7.2. Optimización de rendimiento

La aplicación deberá priorizar una experiencia fluida incluso con bibliotecas multimedia extensas.

**React.memo**

Utilizar `React.memo` en componentes de filas y elementos de biblioteca para evitar renderizados innecesarios.

**useCallback**

Utilizar `useCallback` para estabilizar referencias de funciones utilizadas en componentes memoizados.

**useMemo**

Utilizar `useMemo` para almacenar resultados de operaciones costosas, especialmente:

- Filtrado de biblioteca.
- Búsquedas.
- Ordenamiento.
- Agrupaciones.
- Transformaciones de datos.

**Separación de componentes**

Mantener una separación clara entre:

- Componentes Stateless: componentes visuales puros.
- Componentes Stateful: componentes conectados a stores y lógica de aplicación.

**Principios adicionales:**

- Evitar actualizaciones globales innecesarias.
- Seleccionar únicamente las propiedades necesarias desde Zustand.
- Evitar pasar objetos y funciones recreados constantemente.
- Utilizar listas virtualizadas cuando el volumen de registros lo justifique.
- Mantener desacoplada la lógica del reproductor respecto de la biblioteca visual.

---

## 8. AUTENTICACIÓN Y SEGURIDAD

### 8.1. Gestión de cookies de YouTube

La aplicación permitirá utilizar un archivo `cookies.txt` exportado desde el navegador del usuario para los procesos de yt-dlp que requieran autenticación.

**Integración con Docker:**

El archivo se inyectará al contenedor mediante un volumen de solo lectura:

```
volumes:
  - ./config/cookies.txt:/app/config/cookies.txt:ro
```

**Medidas de seguridad:**

- Montaje de solo lectura (`:ro`).
- No modificar el archivo desde el contenedor.
- No exponer las cookies mediante endpoints HTTP.
- No incluir su contenido en logs.
- Restringir los permisos del archivo en el host.
- Evitar incorporar credenciales al repositorio Git.

### 8.2. OAuth 2.0

OAuth 2.0 será utilizado para las operaciones que requieran acceso autorizado a la cuenta de YouTube del usuario.

Su utilización estará enfocada principalmente en:

- Consultar información de la cuenta.
- Acceder a los datos de likes autorizados.
- Sincronizar estados de interacción con YouTube.

Los tokens deberán almacenarse de forma segura y nunca exponerse directamente al frontend.

### 8.3. Seguridad de comunicaciones

- Limitar el acceso al microservicio a la aplicación local.
- Validar todas las entradas recibidas por HTTP.
- Evitar la ejecución de comandos mediante concatenación insegura de strings.
- Utilizar argumentos de procesos separados al invocar yt-dlp y FFmpeg.
- Gestionar errores sin revelar información sensible.
- Restringir los directorios de escritura al workspace autorizado.

---

## 9. PRINCIPIOS GENERALES DE DISEÑO

LocalStream deberá cumplir los siguientes principios durante su implementación:

1. **Single Source of Truth:** SQLite será la fuente de verdad para los metadatos y estados locales.
2. **Identidad única:** `youtube_id` será la clave de identificación externa de cada contenido multimedia.
3. **Separación de responsabilidades:** Rust administrará la persistencia local y la lógica nativa; Go gestionará las operaciones de descarga y sincronización externa.
4. **Desacoplamiento:** El frontend no accederá directamente a SQLite ni al sistema de archivos.
5. **Resiliencia:** La aplicación deberá detectar archivos extraviados, errores de descarga y desconexiones del microservicio.
6. **Idempotencia:** Las operaciones repetidas no deberán generar registros ni archivos duplicados.
7. **Eficiencia:** La comunicación en tiempo real utilizará SSE y evitará polling innecesario.
8. **Seguridad:** Las credenciales y cookies permanecerán fuera del frontend.
9. **Independencia de workspaces:** Cada workspace mantendrá su propio almacenamiento y base de datos.
10. **Mantenibilidad:** Cada módulo deberá respetar las responsabilidades de su capa arquitectónica.

---

## 10. RESULTADO ARQUITECTÓNICO ESPERADO

LocalStream tendrá tres componentes principales:

| Componente       | Tecnología            | Responsabilidad                                      |
| ---------------- | --------------------- | ---------------------------------------------------- |
| Desktop Frontend | React + TypeScript    | Interfaz, biblioteca y reproductor                   |
| Desktop Backend  | Rust + Tauri + SQLite | Persistencia, IPC y gestión de workspaces            |
| Microservicio    | Go + Docker           | Descargas, procesamiento multimedia y sincronización |

La comunicación seguirá este esquema general:

```
┌───────────────────────────────────────────────┐
│                 LOCALSTREAM APP                │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │          FRONTEND (React / TS)           │  │
│  │                                         │  │
│  │  Zustand · Shadcn UI · Tailwind · Zod   │  │
│  └───────────────────┬─────────────────────┘  │
│                      │ IPC                    │
│  ┌───────────────────▼─────────────────────┐  │
│  │           BACKEND (Rust / Tauri)         │  │
│  │                                         │  │
│  │       Clean Architecture · SQLite      │  │
│  │       Workspace · File Management       │  │
│  └───────────────────┬─────────────────────┘  │
│                      │ HTTP / SSE             │
└──────────────────────┼────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│             GO MICROSERVICE (Docker)          │
│                                               │
│  Clean Architecture                           │
│                                               │
│  REST API · SSE · yt-dlp · FFmpeg             │
│                                               │
│  Downloads · Metadata · Likes Synchronization│
└───────────────────────┬───────────────────────┘
                        │
                        ▼
                 YOUTUBE SERVICES
```

**Objetivo final:** Construir una aplicación de escritorio multimedia local, modular, escalable y resiliente, capaz de gestionar grandes bibliotecas de contenido de YouTube mediante almacenamiento organizado, persistencia SQLite, procesamiento multimedia externo y comunicación eficiente entre componentes.

---

## FIN DEL DOCUMENTO
