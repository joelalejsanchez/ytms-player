#!/usr/bin/env bash
set -euo pipefail

# Script local para instalar el acceso directo .desktop e icono en entornos de escritorio Linux
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_PATH="${SCRIPT_DIR}/release/ytms-player"

if [ ! -f "${BIN_PATH}" ]; then
  echo "Error: No se encontró el binario en ${BIN_PATH}."
  echo "Ejecute 'just release' o 'make release' primero para compilar el ejecutable."
  exit 1
fi

mkdir -p "${HOME}/.local/share/applications" "${HOME}/.local/share/icons/hicolor/512x512/apps"
cp "${SCRIPT_DIR}/tauri-app/src-tauri/icons/icon.png" "${HOME}/.local/share/icons/hicolor/512x512/apps/youtube-desktop-player.png"

cat <<EOF > "${HOME}/.local/share/applications/youtube-desktop-player.desktop"
[Desktop Entry]
Name=YouTube Desktop Player
Comment=Reproductor y gestor de audio local de YouTube
Exec=${BIN_PATH}
Icon=youtube-desktop-player
Terminal=false
Type=Application
Categories=AudioVideo;Audio;Player;
EOF

update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
echo "✓ Acceso directo creado exitosamente en ~/.local/share/applications/youtube-desktop-player.desktop"
