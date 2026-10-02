#!/bin/bash
# Compila un tema como Overleaf: si la compilación falla del todo, se conserva el último PDF correcto.
# Lo usa VS Code (LaTeX Workshop) al pulsar "Compilar". También se puede usar a mano:
#   bash main/scripts/compilar.sh /ruta/al/Tema-3.A.43/main   [carpeta_de_salida]
#
# - Compila en <salida>/.tmp (por defecto <tema>/.build/.tmp).
# - Si se genera PDF (aunque haya errores menores), lo copia a <salida>/ y es el que ves.
# - Si no se genera PDF (error grave), deja intacto el PDF anterior y te avisa.
# - El .tex NUNCA depende de esto: se guarda siempre, compile o no.

DOC="${1%.tex}"
DIR="$(cd "$(dirname "$DOC")" && pwd)"
BASE="$(basename "$DOC")"
OUT="${2:-$DIR/.build}"
TMP="$OUT/.tmp"
mkdir -p "$TMP"
cd "$DIR" || exit 1

latexmk -pdf -f -synctex=1 -interaction=nonstopmode -file-line-error -outdir="$TMP" "$BASE.tex"

# El registro siempre se copia, para que VS Code muestre los errores en "Problemas"
[ -f "$TMP/$BASE.log" ] && cp "$TMP/$BASE.log" "$OUT/$BASE.log"

if [ -f "$TMP/$BASE.pdf" ]; then
  cp "$TMP/$BASE.pdf" "$OUT/$BASE.pdf"
  [ -f "$TMP/$BASE.synctex.gz" ] && cp "$TMP/$BASE.synctex.gz" "$OUT/$BASE.synctex.gz"
  echo ""
  echo "PDF actualizado."
  exit 0
else
  echo ""
  echo "=================================================================="
  echo " La compilación ha fallado por un error grave en el texto."
  echo " Tu .tex está guardado. Se mantiene el último PDF que compiló bien."
  echo " Para ver el error: menú Ver › Problemas (o pregúntale a Claude)."
  echo "=================================================================="
  exit 1
fi
