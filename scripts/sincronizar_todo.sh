#!/bin/bash
# Sincroniza con GitHub los repositorios: main (herramientas), temario (todos los temas),
# progreso (privado: tiempo de trabajo, calendarios, cantes y respuestas del test) y test (banco de preguntas).
# Para cada uno: guarda tus cambios (commit), trae lo que haya en GitHub y sube lo tuyo.
# Si no hay conexión, no hace nada y te lo dice: tus cambios siguen a salvo en tu Mac.
# Si detecta un conflicto (el mismo fragmento cambiado en GitHub y en tu Mac), NO toca ese
# repositorio y te lo indica al final para resolverlo con calma.

MAIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$(dirname "$MAIN_DIR")"
FECHA="$(date '+%Y-%m-%d %H:%M')"

if ! git ls-remote -q https://github.com/OposicionTCEE/main.git >/dev/null 2>&1; then
  echo "Sin conexión con GitHub. No se ha sincronizado nada; tus cambios siguen guardados en tu Mac."
  exit 0
fi

subidos=(); actualizados=(); conflictos=(); errores=()

# Lista legible de los temas cambiados (p. ej. "3.A.19 4.B.11") para el mensaje del commit
temas_cambiados() {
  git status --porcelain | sed -E 's/^...//; s/^"//; s/"$//' \
    | grep -oE '[34]\.[AB]\.[0-9]+' | sort -u | tr '\n' ' ' | sed 's/ $//'
}

sincronizar() {
  local dir="$1" nombre="$2"
  [ -d "$dir/.git" ] || return 0
  cd "$dir" || return 0

  # 1) Guardar los cambios locales
  if [ -n "$(git status --porcelain)" ]; then
    local cuales; cuales="$(temas_cambiados)"
    git add -A
    git commit -q -m "Cambios del $FECHA${cuales:+ ($cuales)}" || true
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
sincronizar "$BASE/temario" "temario"
sincronizar "$BASE/progreso" "progreso"   # privado: tiempos y temas hechos del panel TCEE
# banco de preguntas del test (pestaña Test del Panel Oposición): se descarga la primera vez
if [ ! -d "$BASE/test/.git" ] && git clone -q https://github.com/OposicionTCEE/test.git "$BASE/test" 2>/dev/null; then actualizados+=("test (descargado)"); fi
sincronizar "$BASE/test" "test"

[ -d "$BASE/progreso/.git" ] || echo "Aviso: falta la carpeta progreso. Ejecuta la tarea «Descargar el temario (si falta)»."

# Instrucciones para Claude y atajos de escritura, siempre al día
printf '@main/CLAUDE.md\n' > "$BASE/CLAUDE.md"
mkdir -p "$BASE/.vscode" && cp "$MAIN_DIR/config/tcee.code-snippets" "$BASE/.vscode/tcee.code-snippets"

echo ""
echo "Sincronización terminada ($FECHA)"
echo "  Subidos a GitHub:          ${subidos[*]:-nada}"
echo "  Actualizados desde GitHub: ${actualizados[*]:-nada}"
if [ ${#conflictos[@]} -gt 0 ]; then
  echo ""
  echo "  ATENCIÓN: conflicto en ${conflictos[*]}"
  echo "  El mismo texto se cambió en GitHub y en tu Mac. No se ha tocado nada en ese repositorio."
  echo "  Pídele a Claude: \"resuelve el conflicto de sincronización\"."
fi
if [ ${#errores[@]} -gt 0 ]; then
  echo ""
  echo "  No se pudo sincronizar: ${errores[*]}"
  echo "  Suele ser un problema de inicio de sesión en GitHub (ver GUIA_INSTALACION.md, paso 6)."
fi
