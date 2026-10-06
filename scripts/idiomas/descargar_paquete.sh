#!/bin/bash
# Descarga o actualiza el paquete de contenido de la pestaña Idiomas (repositorio público «idiomas» → TCEE/idiomas).
# Solo descarga: nunca sube nada, porque el paquete no se edita en el Mac (tus datos van aparte, en TCEE/idiomas-<nombre>/).
# Si alguien tocó por error algún fichero del paquete, se aparta (git stash) y se avisa: el contenido bueno es el de GitHub.
# Lo usan la tarea «Descargar o actualizar el paquete de idiomas» y la sincronización (sincronizar_todo.sh).

MAIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BASE="$(dirname "$MAIN_DIR")"
DIR="$BASE/idiomas"
URL="https://github.com/OposicionTCEE/idiomas.git"

if [ ! -d "$DIR/.git" ]; then
  if [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
    echo "ERROR: ya existe una carpeta «idiomas» en $BASE que no viene de GitHub. Cámbiale el nombre y vuelve a intentarlo."
    exit 1
  fi
  echo "Descargando el paquete de idiomas…"
  if ! salida="$(git clone -q "$URL" "$DIR" 2>&1)"; then
    echo "ERROR: no se pudo descargar el paquete de idiomas."
    echo "  Mensaje de git: $(printf '%s' "$salida" | tail -2)"
    exit 1
  fi
  estado="descargado"
else
  cd "$DIR" || exit 1
  rm -f .git/index.lock 2>/dev/null   # bloqueo que deja un git interrumpido
  if [ -n "$(git status --porcelain)" ]; then
    git stash push -u -q -m "Cambios apartados el $(date '+%Y-%m-%d %H:%M')" \
      && echo "Aviso: había cambios en la carpeta del paquete; se han apartado (git stash) y se usa la versión de GitHub."
  fi
  antes="$(git rev-parse HEAD)"
  if ! salida="$(git pull -q --ff-only origin main 2>&1)"; then
    # historia local distinta de la de GitHub: se deja igual que GitHub (el paquete no tiene nada propio del usuario)
    if git fetch -q origin main 2>/dev/null && git reset -q --hard origin/main; then
      salida=""
    else
      echo "ERROR: no se pudo actualizar el paquete de idiomas."
      echo "  Mensaje de git: $(printf '%s' "$salida" | tail -2)"
      exit 1
    fi
  fi
  [ "$antes" != "$(git rev-parse HEAD)" ] && estado="actualizado" || estado="al día"
fi

cd "$DIR" || exit 1
n_fr=$(ls fr/fichas/*.json 2>/dev/null | wc -l | tr -d ' ')
n_en=$(ls en/fichas/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "Paquete de idiomas $estado ($(git log -1 --format='%cd' --date=format:'%d/%m/%Y')): $n_fr fichas de francés y $n_en de inglés."
[ "$1" = "--estado" ] && echo "ESTADO=$estado"
exit 0
