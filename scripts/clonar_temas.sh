#!/bin/bash
# Descarga (o completa) todos los temas en la carpeta TCEE.
# Uso:  bash main/scripts/clonar_temas.sh      (ejecutado desde la carpeta TCEE)
# Es seguro ejecutarlo varias veces: solo descarga lo que falta y no toca lo que ya tienes.

ORG="https://github.com/OposicionTCEE"
MAIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"     # .../TCEE/main
BASE="$(dirname "$MAIN_DIR")"                    # .../TCEE
LISTA="$MAIN_DIR/config/temas.txt"

cd "$BASE" || exit 1
nuevos=0; existentes=0; fallos=()

while IFS= read -r repo || [ -n "$repo" ]; do
  [ -z "$repo" ] && continue
  if [ -d "$BASE/$repo/.git" ]; then
    existentes=$((existentes + 1))
  else
    echo "Descargando $repo…"
    if git clone -q "$ORG/$repo.git" "$BASE/$repo"; then
      nuevos=$((nuevos + 1))
    else
      fallos+=("$repo")
      continue
    fi
  fi
  # Archivos de compilación que Git debe ignorar (solo en tu Mac, no se sube nada)
  excl="$BASE/$repo/.git/info/exclude"
  grep -q "# TCEE-build" "$excl" 2>/dev/null || cat >> "$excl" <<'EOF'
# TCEE-build
.build/
*.aux
*.log
*.out
*.toc
*.fls
*.fdb_latexmk
*.synctex.gz
*.leq
*.lof
*.lot
EOF
done < "$LISTA"

# Instrucciones para Claude en la raíz del espacio de trabajo (remite a main/CLAUDE.md)
printf '@main/CLAUDE.md\n' > "$BASE/CLAUDE.md"

# Atajos de escritura (snippets) para todo el espacio de trabajo
mkdir -p "$BASE/.vscode"
cp "$MAIN_DIR/config/tcee.code-snippets" "$BASE/.vscode/tcee.code-snippets"

echo ""
echo "Temas descargados ahora: $nuevos · ya existentes: $existentes"
if [ ${#fallos[@]} -gt 0 ]; then
  echo "No se pudieron descargar: ${fallos[*]}"
  echo "Comprueba la conexión y vuelve a ejecutar este mismo comando."
  exit 1
fi
echo "Todo listo."
