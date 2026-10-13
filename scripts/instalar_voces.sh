#!/bin/bash
# Instala «Identificar voces» (quién habla en cada momento) para los cantes y las clases del Panel TCEE (main/CANTE.md, apartado 8):
#   - sherpa-onnx en su propio entorno de Python (~/.tcee/voces-id, unos 40 MB)
#   - dos modelos pequeños en ~/.tcee/modelos/voces: segmentación (pyannote 3.0, MIT) y voz (CAM++ de 3D-Speaker, Apache 2.0)
# Lo llaman instalar_cante.sh y scripts/idiomas/instalar_herramientas.sh. Se puede repetir: lo que ya esté se salta.
# Uso: bash main/scripts/instalar_voces.sh

VENV="$HOME/.tcee/voces-id"; DIR="$HOME/.tcee/modelos/voces"; mkdir -p "$DIR"
REL="https://github.com/k2-fsa/sherpa-onnx/releases/download"

if [ -x "$VENV/bin/python" ] && "$VENV/bin/python" -c "import sherpa_onnx, numpy" >/dev/null 2>&1; then
  echo "✓ sherpa-onnx ya instalado"
else
  echo "Instalando sherpa-onnx (identificar voces, ~40 MB)…"
  rm -rf "$VENV"
  if ! /usr/bin/python3 -m venv "$VENV" >/dev/null 2>&1 || ! "$VENV/bin/pip" install -q --upgrade pip sherpa-onnx numpy >/dev/null 2>&1; then
    echo "Con el Python del Mac no ha funcionado; pruebo con el de Homebrew…"
    rm -rf "$VENV"
    BREW=""; for d in /opt/homebrew/bin /usr/local/bin; do [ -x "$d/brew" ] && BREW="$d/brew"; done
    [ -z "$BREW" ] && { echo "❌ Falta Homebrew. Instala antes las herramientas de cante."; exit 1; }
    "$BREW" list python@3.12 >/dev/null 2>&1 || "$BREW" install python@3.12 || { echo "❌ No se pudo instalar Python 3.12."; exit 1; }
    PY="$("$BREW" --prefix python@3.12)/bin/python3.12"
    "$PY" -m venv "$VENV" && "$VENV/bin/pip" install -q --upgrade pip sherpa-onnx numpy || { echo "❌ No se pudo instalar sherpa-onnx. Copia a Claude lo que pone arriba."; exit 1; }
  fi
  echo "✓ sherpa-onnx instalado"
fi

if [ -s "$DIR/segmentacion.onnx" ]; then echo "✓ Modelo de segmentación"; else
  echo "Descargando el modelo de segmentación (~7 MB)…"
  T="$(mktemp -d)"
  curl -L --fail -s -o "$T/seg.tar.bz2" "$REL/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2" \
    && tar xjf "$T/seg.tar.bz2" -C "$T" && mv "$T/sherpa-onnx-pyannote-segmentation-3-0/model.onnx" "$DIR/segmentacion.onnx" \
    || { echo "❌ No se pudo descargar el modelo de segmentación. Repite la instalación."; rm -rf "$T"; exit 1; }
  rm -rf "$T"
fi
if [ -s "$DIR/voz.onnx" ]; then echo "✓ Modelo de voz"; else
  echo "Descargando el modelo de voz (~28 MB)…"
  curl -L --fail --progress-bar -o "$DIR/voz.onnx.part" "$REL/speaker-recongition-models/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx" \
    && mv "$DIR/voz.onnx.part" "$DIR/voz.onnx" || { echo "❌ No se pudo descargar el modelo de voz. Repite la instalación."; exit 1; }
fi
echo "✓ Identificar voces, listo"
