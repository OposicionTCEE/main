#!/bin/bash
# Compila todos los temas (o los que indiques) y deja sus PDF en .build/ y en la carpeta de iCloud.
# Uso:  bash main/scripts/compilar_todo.sh               (todos)
#       bash main/scripts/compilar_todo.sh 3.A.43 3.B.5  (solo esos)
# Tarda: unos 10–30 minutos para los 110, según el Mac.

MAIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$(dirname "$MAIN_DIR")"
TEMARIO="$BASE/temario"
LISTA="$MAIN_DIR/config/temas.txt"
COMPILAR="$MAIN_DIR/scripts/compilar.sh"
PARALELO=4

# Ruta de un tema a partir de su código (3.A.43 -> Ejercicio-3/Parte-A/3.A.43)
ruta() { local t="${1#Tema-}"; echo "Ejercicio-${t%%.*}/Parte-$(echo "$t" | cut -d. -f2)/$t"; }

temas=()
if [ $# -gt 0 ]; then
  for t in "$@"; do temas+=("$(ruta "$t")"); done
else
  while IFS= read -r t || [ -n "$t" ]; do [ -n "$t" ] && temas+=("$t"); done < "$LISTA"
fi

uno() {
  local dir="$1/$2" tex
  [ -d "$dir" ] || { echo "FALTA  $(basename "$2")"; return; }
  tex="$(cd "$dir" && { ls main.tex 2>/dev/null || ls *.tex 2>/dev/null | head -1; })"
  [ -n "$tex" ] || { echo "SIN-TEX $(basename "$2")"; return; }
  mkdir -p "$dir/.build"
  if bash "$3" "$dir/${tex%.tex}" > "$dir/.build/compilar.txt" 2>&1; then
    echo "OK     $(basename "$2")"
  else
    echo "FALLO  $(basename "$2")"
  fi
}
export -f uno

echo "Compilando ${#temas[@]} temas (de $PARALELO en $PARALELO)…"
resultado="$(printf '%s\n' "${temas[@]}" | xargs -P "$PARALELO" -I{} bash -c 'uno "$0" "$1" "$2"' "$TEMARIO" {} "$COMPILAR" | sort)"
echo "$resultado"
echo ""
echo "Correctos: $(grep -c '^OK' <<< "$resultado") · Con error grave (se mantiene el PDF anterior, si existía): $(grep -c '^FALLO' <<< "$resultado")"
