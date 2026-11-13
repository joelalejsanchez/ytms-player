# Directorio de Configuración Segura (`config/`)

Coloca aquí tu archivo `cookies.txt` exportado desde el navegador en formato Netscape para que el contenedor de `localstream-backend` lo monte en modo de **solo lectura (`:ro`)** en `/app/config/cookies.txt`.

> **Seguridad:** `config/cookies.txt` está excluido en `.gitignore` para evitar exponer credenciales de sesión en el repositorio Git.
