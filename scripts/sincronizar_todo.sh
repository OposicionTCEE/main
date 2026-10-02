#!/bin/bash
# Sincroniza con GitHub el repositorio main y todos los temas.
# Para cada repositorio: guarda tus cambios (commit), trae lo que haya en GitHub y sube lo tuyo.
# Si no hay conexión, no hace nada y te lo dice: tus cambios siguen a salvo en tu Mac.
# Si detecta un conflicto (el mismo fragmento cambiado en GitHub y en tu Mac), NO toca ese tema
# y te lo indica al final para resolverlo con calma.

MAIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$(dirname "$MAIN_DIR")"
LISTA="$MAIN_DIR/config/temas.txt"
FECHA="$(date '+%Y-%m-%d %H:%M')"

if ! git ls-remote -q https://github.com/OposicionTCEE/main.git >/dev/null 2>&1; then
  echo "Sin conexión con GitHub. No se ha sincronizado nada; tus cambios siguen guardados en tu Mac."
  exit 0
fi

subidos=(); actualizados=(); conflictos=(); errores=()

sincronizar() {
  local dir="$1" nombre="$2"
  [ -d "$dir/.git" ] || return 0
  cd "$dir" || return 0

  # 1) Guardar los cambios locales
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -q -m "Cambios del $FECHA" || true
  fi

  # 2) Traer lo que haya en GitHub y colocar lo tuyo encima
  local antes; antes="$(git rev-parse HEAD 2>/dev/null)"
  if ! git pull -q --rebase origin "$(git rev-parse --abbrev-ref HEAD)" >/dev/null 2>&1; then
    if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
      git rebase --abort 2>/dev/null
      conflictos+=("$nombre")
    else
      errores+=("$nombre")
    fi
    return 0
  fi
  [ "$antes" != "$(git rev-parse HEAD)" ] && actualizados+=("$nombre")

  # 3) Subir lo tuyo
  if [ -n "$(git log --oneline '@{u}..HEAD' 2>/dev/null)" ]; then
    if git push -q 2>/dev/null; then subidos+=("$nombre"); else errores+=("$nombre"); fi
  fi
}

sincronizar "$MAIN_DIR" "main"
while IFS= read -r repo || [ -n "$repo" ]; do
  [ -z "$repo" ] && continue
  sincronizar "$BASE/$repo" "$repo"
done < "$LISTA"

# Instrucciones para Claude en la raíz del espacio de trabajo (remite a main/CLAUDE.md)
printf '@main/CLAUDE.md\n' > "$BASE/CLAUDE.md"

# Mantener los atajos de escritura al día
mkdir -p "$BASE/.vscode" && cp "$MAIN_DIR/config/tcee.code-snippets" "$BASE/.vscode/tcee.code-snippets"

echo ""
echo "Sincronización terminada ($FECHA)"
echo "  Subidos a GitHub:        ${#subidos[@]} ${subidos[*]}"
echo "  Actualizados desde GitHub: ${#actualizados[@]} ${actualizados[*]}"
if [ ${#conflictos[@]} -gt 0 ]; then
  echo ""
  echo "  ATENCIÓN: conflicto en ${conflictos[*]}"
  echo "  El mismo texto se cambió en GitHub y en tu Mac. No se ha tocado nada en esos temas."
  echo "  Pídele a Claude: \"resuelve el conflicto de sincronización en <tema>\"."
fi
if [ ${#errores[@]} -gt 0 ]; then
  echo ""
  echo "  No se pudo sincronizar: ${errores[*]}"
  echo "  Suele ser un problema de permisos o de inicio de sesión en GitHub (ver GUIA_INSTALACION.md, paso 6)."
fi
