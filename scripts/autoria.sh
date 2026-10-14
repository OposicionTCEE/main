#!/bin/bash
# Autoría de los cambios del temario en git (reglas: main/AUTORIA.md).
# Lo llama un hook de Claude Code antes y después de cada herramienta que puede cambiar ficheros (Edit, Write, NotebookEdit, Bash):
#   autoria.sh antes    → lo que haya sin guardar en el temario es del usuario (lo de Claude se guarda siempre al instante):
#                         se guarda a su nombre, con la fecha de su último cambio.
#   autoria.sh despues  → lo que acaba de cambiar Claude se guarda a nombre de Claude: con Edit/Write/NotebookEdit, solo el
#                         fichero editado; con Bash, solo lo que haya cambiado en las carpetas Img/ y Code/ de los temas.
# Nunca bloquea a Claude: no escribe nada en pantalla y siempre termina con 0.

modo="$1"
entrada="$(cat 2>/dev/null)"
RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
T="$(cd "$RAIZ/temario" 2>/dev/null && pwd -P)" || exit 0
[ -d "$T/.git" ] || exit 0
cd "$T" || exit 0
# a mitad de una sincronización con conflicto no se toca nada
[ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] || [ -f .git/MERGE_HEAD ] && exit 0

CLAUDE_AUTOR="Claude <noreply@anthropic.com>"
campo() { printf '%s' "$entrada" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1; }
# git esperando a que quede libre (otra orden de git en marcha: Sincronizar, otra herramienta)
g() { local i; for i in $(seq 1 30); do [ -f .git/index.lock ] || break; sleep 0.2; done; git "$@"; }
# segundos de la última modificación (Linux: stat -c; macOS: stat -f); solo si es un número
mtime() { local t; t="$(stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null)"; case "$t" in ''|*[!0-9]*) ;; *) echo "$t" ;; esac; }
# códigos de tema afectados por lo que está preparado para guardar, p. ej. "3.B.33 3.A.30"
temas() { g diff --cached --name-only | sed -n 's#^Ejercicio-[^/]*/Parte-[^/]*/\([^/]*\)/.*#\1#p' | sort -u | tr '\n' ' ' | sed 's/ $//'; }

guardar_usuario() {
  [ -n "$(g status --porcelain)" ] || return 0
  # fecha: la del último fichero que cambió el usuario (si solo hubo borrados, ahora)
  local f t max=0
  while IFS= read -r f; do t="$(mtime "$f")"; [ -n "$t" ] && [ "$t" -gt "$max" ] && max="$t"; done < <(g diff --name-only HEAD; g ls-files --others --exclude-standard)
  [ "$max" -gt 0 ] || max="$(date +%s)"
  g add -A || return 0
  g diff --cached --quiet && return 0
  GIT_AUTHOR_DATE="@$max" g commit -q -m "Marcelo: cambios propios, guardados antes de una acción de Claude ($(temas))" >/dev/null 2>&1
}

guardar_claude() {
  g diff --cached --quiet && return 0
  g commit -q --author="$CLAUDE_AUTOR" -m "Claude: $1 ($(temas))" >/dev/null 2>&1
}

case "$modo" in
  antes)
    guardar_usuario ;;
  despues)
    herramienta="$(campo tool_name)"
    if [ "$herramienta" = "Bash" ]; then
      # una a una: si una de las dos no existe, git no añadiría ninguna
      g add -A -- ':(glob)Ejercicio-*/Parte-*/*/Img/**' 2>/dev/null
      g add -A -- ':(glob)Ejercicio-*/Parte-*/*/Code/**' 2>/dev/null
      guardar_claude "figuras y código de figuras"
    else
      f="$(campo file_path)"
      [ -n "$f" ] || exit 0
      case "$f" in /*) ;; *) f="$(campo cwd)/$f" ;; esac
      d="$(cd "$(dirname "$f")" 2>/dev/null && pwd -P)" || exit 0
      f="$d/$(basename "$f")"
      case "$f" in "$T"/*) ;; *) exit 0 ;; esac      # solo ficheros del temario
      g add -A -- "${f#"$T"/}" 2>/dev/null
      guardar_claude "edición de $(basename "$f")"
    fi ;;
esac
exit 0
