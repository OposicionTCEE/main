#!/bin/bash
# Instala lo necesario para la pestaña «Cante» del Panel Oposición (ver main/CANTE.md):
#   - Homebrew (el instalador habitual de programas en Mac), si falta
#   - ffmpeg (graba el micrófono) y whisper.cpp (transcribe sin conexión)
#   - el modelo de idioma de whisper (large-v3-turbo, ~1,6 GB) en ~/.tcee/modelos
# Uso (desde la carpeta TCEE): bash main/scripts/instalar_cante.sh   — se puede repetir: lo que ya esté instalado se salta.

MODELO="ggml-large-v3-turbo.bin"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODELO"
DIR="$HOME/.tcee/modelos"

echo "== 1/3 Homebrew"
for d in /opt/homebrew/bin /usr/local/bin; do [ -x "$d/brew" ] && BREW="$d/brew"; done
if [ -z "$BREW" ]; then
  echo "No está instalado. Se instala ahora: te pedirá la CONTRASEÑA DEL MAC (no se ve al escribirla) y que pulses Intro."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || { echo "❌ No se pudo instalar Homebrew."; exit 1; }
  for d in /opt/homebrew/bin /usr/local/bin; do [ -x "$d/brew" ] && BREW="$d/brew"; done
  [ -z "$BREW" ] && { echo "❌ Homebrew no aparece tras instalarlo. Cierra VS Code, vuelve a abrirlo y repite la tarea."; exit 1; }
else
  echo "✓ Ya instalado"
fi

echo "== 2/3 ffmpeg y whisper.cpp"
for p in ffmpeg whisper-cpp; do
  if "$BREW" list "$p" >/dev/null 2>&1; then echo "✓ $p ya instalado"; else "$BREW" install "$p" || { echo "❌ No se pudo instalar $p."; exit 1; }; fi
done

echo "== 3/3 Modelo de idioma ($MODELO, ~1,6 GB)"
mkdir -p "$DIR"
if [ -f "$DIR/$MODELO" ] && [ "$(stat -f%z "$DIR/$MODELO" 2>/dev/null || echo 0)" -gt 1000000000 ]; then
  echo "✓ Ya descargado"
else
  echo "Descargando (puede tardar varios minutos; si se corta, repite la tarea y continuará donde lo dejó)…"
  curl -L --fail --progress-bar -C - -o "$DIR/$MODELO.part" "$URL" && mv "$DIR/$MODELO.part" "$DIR/$MODELO" || { echo "❌ La descarga falló. Repite la tarea."; exit 1; }
fi

echo
echo "Micrófonos que ve el Mac:"
"$(dirname "$BREW")/ffmpeg" -hide_banner -f avfoundation -list_devices true -i "" 2>&1 | sed -n '/audio devices/,$p' | grep '\]' | sed 's/.*\] /  • /' | tail -n +2
echo
echo "✅ Todo listo. Vuelve a la pestaña Cante del Panel Oposición (si la tenías abierta, cambia de pestaña y vuelve)."
echo "   La primera vez que grabes, macOS preguntará si Visual Studio Code puede usar el micrófono: pulsa Permitir."
