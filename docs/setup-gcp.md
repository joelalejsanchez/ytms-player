# Guía Opcional: Configuración de Google Cloud Platform (OAuth 2.0 y Likes) (`docs/setup-gcp.md`)

> [!NOTE]
> **Esta configuración es 100% OPCIONAL.**  
> **ytms-player** funciona perfectamente sin configurar Google Cloud Platform. Puedes buscar, descargar canciones, armar playlists y reproducir audio sin ninguna cuenta. Si no configuras esta sección, los "Me gusta" (Likes) se guardarán y gestionarán de forma local en la base de datos SQLite de tu workspace sin emitir errores.

Esta guía solo es necesaria si deseas que al presionar el botón de "Me gusta" en la app local, el Like se registre automáticamente en tu cuenta real de YouTube (y viceversa mediante la YouTube Data API v3).

---

## 1. Crear Proyecto y Habilitar la API de YouTube

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto (por ejemplo `ytms-player`).
3. En el menú de navegación, ve a **APIs & Services -> Library** (Biblioteca).
4. Busca **YouTube Data API v3** y pulsa **Enable / Habilitar**.

---

## 2. Configurar la Pantalla de Consentimiento OAuth

1. Ve a **APIs & Services -> OAuth consent screen** (o *Pantalla de consentimiento de OAuth*).
2. Selecciona **User Type: External / Externo** y pulsa **Create**.
3. **Información básica de la app**:
   - *App name*: `ytms-player`
   - *User support email*: Tu correo de Gmail.
   - *Developer contact information*: Tu correo de Gmail.
4. **Scopes / Permisos (Requerido para Likes)**:
   - Pulsa **Add or Remove Scopes**.
   - Agrega el permiso con acceso a calificaciones:
     ```text
     https://www.googleapis.com/auth/youtube.force-ssl
     ```
     *(Este permiso oficial permite consultar y enviar calificaciones de Likes/Dislikes vía el endpoint `videos.rate`)*.
   - Pulsa **Update** y luego **Save and Continue**.
5. **Test Users / Usuarios de prueba (Crítico)**:
   - En la sección **Audience / Test users**, pulsa **+ Add Users** e introduce **tu correo de Gmail**.
   - *(Nota: Si no agregas tu correo aquí, Google rechazará la conexión con el error `403: access_denied` mientras el proyecto esté en modo Testing)*.

---

## 3. Generar Credenciales OAuth 2.0

1. Ve a **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**.
2. **Application type**: Selecciona **Web application**.
3. **Name**: `ytms-player-desktop`.
4. **Authorized redirect URIs (URIs de redireccionamiento autorizados)**:  
   Agrega exactamente:
   ```text
   http://127.0.0.1:8080/api/oauth/callback
   ```
5. Pulsa **Create** y copia tu **Client ID** y **Client Secret**.

---

## 4. Configurar Variables de Entorno (`.env`)

En la raíz del proyecto, copia el archivo de plantilla:

```bash
cp .env.example .env
```

Edita `.env` e introduce tus credenciales recién obtenidas:

```env
OAUTH_MOCK_MODE=false
OAUTH_CLIENT_ID=tu-id-de-cliente.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=tu-client-secret
OAUTH_REDIRECT_URI=http://127.0.0.1:8080/api/oauth/callback
```

Reinicia el contenedor Docker para aplicar las credenciales:

```bash
docker compose up -d
```

---

## 5. Vinculación desde la Aplicación

1. Inicia la aplicación **ytms-player**.
2. Dirígete a la pestaña **Configuración -> Cuenta de YouTube**.
3. Pulsa **Conectar con Google**. Tu navegador abrirá la pantalla de inicio de sesión de Google.
4. Concede los permisos. Al redirigir, la app mostrará el estado **Conectado** y tus Likes se sincronizarán bidireccionalmente.
