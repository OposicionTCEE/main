#!/bin/bash
# Archiva en GitHub (solo lectura, reversible) los antiguos repositorios Tema-X.Y.Z, cuyo historial ya está dentro de «temario».
# Uso (desde la carpeta TCEE): bash main/scripts/archivar_repos_antiguos.sh   — tarea «Archivar los repositorios antiguos de temas».
# Seguridad: solo archiva los repositorios que «temario» incorporó con su historial («Incorporar Tema-X con su historial»)
# y que no han recibido cambios después de esa incorporación; los demás los lista y los deja como están.
# Deshacer: en GitHub, el repositorio › Settings › «Unarchive this repository».

cd "$(dirname "$0")/../.." || exit 1
ORG="OposicionTCEE"

# 1) GitHub CLI (gh): se instala con Homebrew si falta
GH="$(command -v gh 2>/dev/null)"
for d in /opt/homebrew/bin /usr/local/bin; do [ -z "$GH" ] && [ -x "$d/gh" ] && GH="$d/gh"; done
if [ -z "$GH" ]; then
  BREW=""; for d in /opt/homebrew/bin /usr/local/bin; do [ -x "$d/brew" ] && BREW="$d/brew"; done
  [ -z "$BREW" ] && { echo "❌ Falta Homebrew. Ejecuta antes la tarea «Instalar herramientas de cante» (lo instala) y repite esta."; exit 1; }
  echo "== Instalando GitHub CLI (gh)…"
  "$BREW" install gh || { echo "❌ No se pudo instalar gh."; exit 1; }
  GH="$(dirname "$BREW")/gh"
fi

# 2) Inicio de sesión en GitHub (solo la primera vez)
if ! "$GH" auth status >/dev/null 2>&1; then
  echo "== Hay que iniciar sesión en GitHub una vez:"
  echo "   1) Pulsa Intro cuando lo pida; se abrirá el navegador."
  echo "   2) Copia el código de 8 caracteres que aparece aquí y pégalo en la página de GitHub."
  echo "   3) Pulsa «Authorize» y vuelve aquí."
  "$GH" auth login --hostname github.com --git-protocol https --web || { echo "❌ No se completó el inicio de sesión."; exit 1; }
fi

# 3) Repositorios incorporados a temario, con la fecha de incorporación
[ -d temario/.git ] || { echo "❌ No encuentro la carpeta temario."; exit 1; }
git -C temario log --format='%ct %s' | sed -nE 's/^([0-9]+) Incorporar (Tema-[0-9]\.[AB]\.[0-9]+) con su historial$/\2 \1/p' | sort -u > /tmp/tcee_repos_antiguos.txt
TOTAL=$(wc -l < /tmp/tcee_repos_antiguos.txt | tr -d ' ')
echo "== $TOTAL repositorios antiguos incorporados a temario"

ok=0; ya=0; saltados=""; fallos=""
while read -r REPO INCORP; do
  INFO="$("$GH" api "repos/$ORG/$REPO" --jq '[.archived, (.pushed_at | fromdate)] | @tsv' 2>/dev/null)"
  if [ -z "$INFO" ]; then fallos="$fallos $REPO(no-existe)"; continue; fi
  ARCH="$(echo "$INFO" | cut -f1)"; PUSH="$(echo "$INFO" | cut -f2)"
  if [ "$ARCH" = "true" ]; then ya=$((ya+1)); continue; fi
  # margen de 1 h: la incorporación se hizo justo después del último cambio
  if [ "$PUSH" -gt $((INCORP + 3600)) ]; then saltados="$saltados $REPO"; echo "⚠️  $REPO tiene cambios posteriores a la incorporación: no se archiva"; continue; fi
  if "$GH" repo archive "$ORG/$REPO" --yes >/dev/null 2>&1; then ok=$((ok+1)); echo "✓ $REPO"; else fallos="$fallos $REPO"; echo "❌ $REPO"; fi
done < /tmp/tcee_repos_antiguos.txt

echo
echo "Archivados ahora: $ok · ya estaban archivados: $ya"
[ -n "$saltados" ] && echo "No archivados por tener cambios posteriores (revísalos con Claude):$saltados"
[ -n "$fallos" ] && echo "Fallaron:$fallos  (¿tu cuenta es propietaria de la organización? Repite la tarea más tarde)"
[ -z "$saltados$fallos" ] && echo "✅ Todo listo: los repositorios antiguos quedan archivados (solo lectura) como copia de seguridad."
