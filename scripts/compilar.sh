#!/bin/bash
# Compila un tema como Overleaf: si la compilación falla del todo, se conserva el último PDF correcto.
# Lo usa VS Code (LaTeX Workshop) al pulsar "Compilar". También se puede usar a mano:
#   bash main/scripts/compilar.sh temario/Ejercicio-3/Parte-A/3.A.43/main   [carpeta_de_salida]
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

# Usar siempre MacTeX (no otras distribuciones como TinyTeX, que no traen todos los paquetes)
[ -d /Library/TeX/texbin ] && export PATH="/Library/TeX/texbin:$PATH"

rm -f "$TMP/$BASE.pdf"   # para saber con certeza si esta compilación ha generado PDF
latexmk -pdf -f -synctex=1 -interaction=nonstopmode -file-line-error -outdir="$TMP" "$BASE.tex"

# El registro siempre se copia, para que VS Code muestre los errores en "Problemas"
[ -f "$TMP/$BASE.log" ] && cp "$TMP/$BASE.log" "$OUT/$BASE.log"

# Páginas del CUERPO (del primer bloque tras la Introducción hasta la Conclusión; sin Introducción, Conclusión, bibliografía ni anexos).
# Orientación: entre 25 y 35 (main/GUIA_TEMAS.md, §2.5). Se leen del índice (.stc): la numeración arábiga empieza en la Introducción
# y cada bloque empieza en página nueva, así que basta restar. Lo enseña el panel (cabecera de Acciones y pestaña Temas).
CUERPO=""
if [ -f "$TMP/$BASE.pdf" ] && [ -f "$TMP/$BASE.stc" ]; then
  CUERPO="$(awk '
    index($0, "\\contentsline {section}{\\numberline") == 1 {
      if (!match($0, /[}][{][0-9]+[}][{]section[.]/)) next
      p = substr($0, RSTART + 2, RLENGTH - 12) + 0
      if ($0 ~ /Introducci/) next
      if ($0 ~ /Conclusi/) { if (ini) print p - ini; exit }
      if (!ini) ini = p
    }' "$TMP/$BASE.stc")"
fi
# si no hay PDF se conserva el dato de la última compilación correcta; sin Conclusión no hay cuerpo que medir
if [ -f "$TMP/$BASE.pdf" ]; then
  if [ -n "$CUERPO" ]; then echo "$CUERPO" > "$OUT/cuerpo"; else rm -f "$OUT/cuerpo"; fi
fi

# Estado de la última compilación (lo lee el panel TCEE para el tiempo restante; al cambiar, el panel relee también el cuerpo)
if [ -f "$TMP/$BASE.pdf" ]; then echo ok > "$OUT/estado"; else echo error > "$OUT/estado"; fi

if [ -f "$TMP/$BASE.pdf" ]; then
  cp "$TMP/$BASE.pdf" "$OUT/$BASE.pdf"
  [ -f "$TMP/$BASE.synctex.gz" ] && cp "$TMP/$BASE.synctex.gz" "$OUT/$BASE.synctex.gz"
  # Copia visible del PDF dentro de la carpeta del tema (p. ej. 3.A.43/3.A.43.pdf). No se sube a GitHub.
  CODIGO="$(basename "$DIR")"; CODIGO="${CODIGO#Tema-}"
  cp "$OUT/$BASE.pdf" "$DIR/$CODIGO.pdf"
  echo ""
  echo "PDF actualizado: $DIR/$CODIGO.pdf"
  if [ -n "$CUERPO" ]; then
    AVISO=""; [ "$CUERPO" -gt 35 ] && AVISO=" — por encima de la orientación (GUIA_TEMAS.md, §2.5)"
    echo "Cuerpo del tema: $CUERPO páginas (orientación: entre 25 y 35)$AVISO"
  fi

  # Copia del PDF a iCloud (para leerlo desde el iPad). No se sube a GitHub.
  # Carpeta por defecto: iCloud Drive › OPO - TCEE › PDF temas
  # Para cambiarla, escribe otra ruta en el fichero ~/.tcee_carpeta_pdf
  ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
  PDFDIR="$ICLOUD/OPO - TCEE/PDF temas"
  [ -f "$HOME/.tcee_carpeta_pdf" ] && PDFDIR="$(head -1 "$HOME/.tcee_carpeta_pdf")"
  if [ -d "$ICLOUD" ] || [ -f "$HOME/.tcee_carpeta_pdf" ]; then
    TEMA="$(basename "$DIR")"; TEMA="Tema-${TEMA#Tema-}"
    if mkdir -p "$PDFDIR" && cp "$OUT/$BASE.pdf" "$PDFDIR/$TEMA.pdf"; then
      echo "Copia en iCloud: $PDFDIR/$TEMA.pdf"
    else
      echo "Aviso: no se pudo copiar el PDF a $PDFDIR"
    fi
  fi
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
