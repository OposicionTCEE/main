#!/bin/bash
# Instala lo que necesitan la expresión escrita y la oral de la pestaña Idiomas (ver main/IDIOMAS.md, «Herramientas locales»):
#   - LanguageTool (corrector gramatical sin conexión; trae su propio Java) — unos 450 MB con Java
#   - Ollama y el modelo qwen2.5:3b (corrige escritos, valora el oral y hace de tribunal, sin conexión) — unos 2,2 GB
#   - comprueba ffmpeg y whisper.cpp (los mismos que el cante; si faltan, los instala) y las voces del Mac
# Lo lanza el botón «Instalar herramientas» de la pestaña Idiomas. Se puede repetir: lo que ya esté instalado se salta.

MODELO="${TCEE_MODELO_IDIOMAS:-qwen2.5:3b}"

echo "== 1/5 Homebrew"
for d in /opt/homebrew/bin /usr/local/bin; do [ -x "$d/brew" ] && BREW="$d/brew"; done
if [ -z "$BREW" ]; then
  echo "No está instalado. Se instala ahora: te pedirá la CONTRASEÑA DEL MAC (no se ve al escribirla) y que pulses Intro."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || { echo "❌ No se pudo instalar Homebrew."; exit 1; }
  for d in /opt/homebrew/bin /usr/local/bin; do [ -x "$d/brew" ] && BREW="$d/brew"; done
  [ -z "$BREW" ] && { echo "❌ Homebrew no aparece tras instalarlo. Cierra VS Code, vuelve a abrirlo y repite."; exit 1; }
else
  echo "✓ Ya instalado"
fi
BIN="$(dirname "$BREW")"

instalar() {   # instalar <paquete> <qué es>
  if "$BREW" list "$1" >/dev/null 2>&1; then echo "✓ $2 ya instalado"; return 0; fi
  echo "Instalando $2 (puede tardar varios minutos)…"
  "$BREW" install "$1" || { echo "❌ No se pudo instalar $2. Repite la instalación; si vuelve a fallar, copia este mensaje a Claude."; exit 1; }
}

echo "== 2/5 LanguageTool (corrector gramatical; incluye Java)"
instalar languagetool "LanguageTool"

echo "== 3/5 Ollama (modelo de lenguaje local)"
instalar ollama "Ollama"

echo "== 4/5 Modelo $MODELO (~1,9 GB)"
if "$BIN/ollama" list 2>/dev/null | grep -q "^${MODELO}"; then
  echo "✓ Ya descargado"
else
  ARRANCADO=""
  if ! curl -s -m 2 http://127.0.0.1:11434/api/tags >/dev/null; then
    OLLAMA_KEEP_ALIVE=1m "$BIN/ollama" serve >/dev/null 2>&1 &
    ARRANCADO=$!
    for i in $(seq 1 30); do curl -s -m 1 http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
  fi
  echo "Descargando el modelo (si se corta, repite la instalación y continuará donde lo dejó)…"
  "$BIN/ollama" pull "$MODELO" || { echo "❌ La descarga del modelo falló. Repite la instalación."; [ -n "$ARRANCADO" ] && kill "$ARRANCADO"; exit 1; }
  [ -n "$ARRANCADO" ] && kill "$ARRANCADO" 2>/dev/null
fi

echo "== 5/5 Grabación, transcripción y voces"
instalar ffmpeg "ffmpeg (grabación)"
instalar whisper-cpp "whisper.cpp (transcripción)"
if [ -f "$HOME/.tcee/modelos/ggml-large-v3-turbo.bin" ]; then echo "✓ Modelo de whisper (el del cante; entiende inglés y francés)"
else echo "⚠️  Falta el modelo de whisper: ejecuta también la tarea «Instalar herramientas de cante» (descarga 1,6 GB)."; fi
echo
echo "Voces del Mac para leer textos en voz alta:"
say -v '?' 2>/dev/null | grep -E ' (en_GB|en_US|fr_FR|fr_CA) ' | sed -E 's/^([^ ]+( [^ ]+)?) +([a-z][a-z]_[A-Z][A-Z]).*/  • \1 (\3)/' | head -20
echo "  Si quieres voces más naturales: Ajustes del Sistema › Accesibilidad › Contenido leído › Voz del sistema › Gestionar voces…"
echo "  y descarga, por ejemplo, «Daniel (mejorada)» o «Serena (premium)» en inglés y «Thomas (mejorada)» o «Audrey (premium)» en francés."
echo
echo "✅ Todo listo. Vuelve a la pestaña Idiomas del Panel Oposición (si la tenías abierta, cambia de pestaña y vuelve)."
