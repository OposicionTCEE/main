#!/bin/bash
# Instala lo que necesitan la expresión escrita y la oral de la pestaña Idiomas (ver main/IDIOMAS.md, «Herramientas locales»):
#   - LanguageTool (corrector gramatical sin conexión; trae su propio Java) — unos 450 MB con Java
#   - Ollama y el modelo qwen2.5:3b (corrige escritos, valora el oral y hace de tribunal, sin conexión) — unos 2,2 GB
#   - Piper y seis voces neuronales (tres por idioma) para leer los textos con voz natural — unos 520 MB
#   - comprueba ffmpeg y whisper.cpp (los mismos que el cante; si faltan, los instala) y las voces del Mac
# Lo lanza el botón «Instalar herramientas» de la pestaña Idiomas. Se puede repetir: lo que ya esté instalado se salta.

MODELO="${TCEE_MODELO_IDIOMAS:-qwen2.5:3b}"

echo "== 1/6 Homebrew"
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

echo "== 2/6 LanguageTool (corrector gramatical; incluye Java)"
instalar languagetool "LanguageTool"

echo "== 3/6 Ollama (modelo de lenguaje local)"
instalar ollama "Ollama"

echo "== 4/6 Modelo $MODELO (~2 GB)"
GGUF_URL="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
servidor() {   # arranca un «ollama serve» propio y limpio (el de Homebrew o uno antiguo a veces no resuelve nombres de internet)
  pkill -f "ollama serve" 2>/dev/null; "$BREW" services stop ollama >/dev/null 2>&1; sleep 1
  GODEBUG=netdns=cgo OLLAMA_HOST=127.0.0.1:11434 OLLAMA_KEEP_ALIVE=1m "$BIN/ollama" serve >/tmp/tcee-ollama.log 2>&1 &
  SERVIDOR=$!
  for i in $(seq 1 30); do curl -s -m 1 http://127.0.0.1:11434/api/tags >/dev/null && return 0; sleep 1; done
  echo "❌ Ollama no arranca. Copia a Claude estas líneas:"; tail -5 /tmp/tcee-ollama.log; return 1
}
if "$BIN/ollama" list 2>/dev/null | grep -q "^${MODELO}"; then
  echo "✓ Ya descargado"
else
  servidor || exit 1
  echo "Descargando el modelo desde Ollama…"
  if "$BIN/ollama" pull "$MODELO"; then
    echo "✓ Modelo descargado"
  else
    # plan B: el mismo modelo (Qwen2.5 3B Instruct, cuantizado Q4_K_M) desde Hugging Face, con curl, y se registra en Ollama con su nombre
    echo "La descarga desde Ollama ha fallado (suele ser un problema de nombres de dominio con el servidor de Ollama)."
    echo "Plan B: lo descargo de Hugging Face (2,1 GB; si se corta, repite la instalación y continuará donde lo dejó)…"
    DIR="$HOME/.tcee/modelos"; mkdir -p "$DIR"; F="$DIR/qwen2.5-3b-instruct-q4_k_m.gguf"
    curl -L --fail --progress-bar -C - -o "$F.part" "$GGUF_URL" && mv "$F.part" "$F" || { echo "❌ La descarga de Hugging Face también ha fallado. Copia a Claude lo que pone arriba."; kill $SERVIDOR 2>/dev/null; exit 1; }
    cat > "$DIR/Modelfile-qwen" <<'MODELFILE'
FROM ./qwen2.5-3b-instruct-q4_k_m.gguf
TEMPLATE """{{- if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{- range .Messages }}<|im_start|>{{ .Role }}
{{ .Content }}<|im_end|>
{{ end }}<|im_start|>assistant
"""
PARAMETER stop "<|im_start|>"
PARAMETER stop "<|im_end|>"
MODELFILE
    echo "Registrando el modelo en Ollama…"
    (cd "$DIR" && "$BIN/ollama" create "$MODELO" -f Modelfile-qwen) || { echo "❌ No se pudo registrar el modelo. Copia a Claude lo que pone arriba."; kill $SERVIDOR 2>/dev/null; exit 1; }
    rm -f "$F" "$DIR/Modelfile-qwen"   # Ollama ya guardó su copia: se borra la descargada para no ocupar 2 GB de más
    echo "✓ Modelo instalado (desde Hugging Face)"
  fi
  kill $SERVIDOR 2>/dev/null
fi

echo "== 5/6 Voces neuronales (Piper; tres por idioma, ~460 MB)"
PIPER="$HOME/.tcee/piper"; VOCES="$HOME/.tcee/voces"; mkdir -p "$VOCES"
if [ ! -x "$PIPER/bin/python" ] || ! "$PIPER/bin/python" -c "import piper" >/dev/null 2>&1; then
  echo "Instalando Piper (programa de voz, ~60 MB)…"
  rm -rf "$PIPER"
  PY=/usr/bin/python3
  if ! "$PY" -m venv "$PIPER" >/dev/null 2>&1 || ! "$PIPER/bin/pip" install -q --upgrade pip piper-tts >/dev/null 2>&1; then
    echo "Con el Python del Mac no ha funcionado; instalo uno más nuevo con Homebrew…"
    rm -rf "$PIPER"; instalar python@3.12 "Python 3.12"
    PY="$("$BREW" --prefix python@3.12)/bin/python3.12"
    "$PY" -m venv "$PIPER" && "$PIPER/bin/pip" install -q --upgrade pip piper-tts || { echo "❌ No se pudo instalar Piper. Copia a Claude lo que pone arriba."; exit 1; }
  fi
  echo "✓ Piper instalado"
else
  echo "✓ Piper ya instalado"
fi
HF="https://huggingface.co/rhasspy/piper-voices/resolve/main"
for V in en/en_GB/cori/high/en_GB-cori-high en/en_GB/alan/medium/en_GB-alan-medium en/en_GB/vctk/medium/en_GB-vctk-medium \
         fr/fr_FR/siwis/medium/fr_FR-siwis-medium fr/fr_FR/tom/medium/fr_FR-tom-medium fr/fr_FR/mls/medium/fr_FR-mls-medium; do
  N="$(basename "$V")"
  if [ -s "$VOCES/$N.onnx" ] && [ -s "$VOCES/$N.onnx.json" ]; then echo "✓ Voz $N"; continue; fi
  echo "Descargando la voz $N…"
  curl -L --fail --progress-bar -C - -o "$VOCES/$N.onnx.part" "$HF/$V.onnx" && mv "$VOCES/$N.onnx.part" "$VOCES/$N.onnx" \
    && curl -L --fail -s -o "$VOCES/$N.onnx.json" "$HF/$V.onnx.json" || { echo "❌ No se pudo descargar la voz $N. Repite la instalación."; exit 1; }
done
# prueba: una frase con la primera voz
if echo '{"id":"p","modelo":"'"$VOCES"'/en_GB-alan-medium.onnx","frases":["Hello."],"dir":"/tmp/tcee-voz-prueba"}' | "$PIPER/bin/python" "$(dirname "$0")/voz.py" | grep -q '"fin"'; then
  echo "✓ Las voces funcionan"; rm -rf /tmp/tcee-voz-prueba
else
  echo "⚠️  Piper está instalado pero la prueba de voz ha fallado. Copia a Claude lo que pone arriba."
fi

echo "== 6/6 Grabación, transcripción y voces del sistema"
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
