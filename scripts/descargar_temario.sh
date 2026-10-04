#!/bin/bash
# Descarga el repositorio "temario" (todos los temas) en la carpeta TCEE, si aún no está.
# Uso:  bash main/scripts/descargar_temario.sh      (desde la carpeta TCEE)
# Es seguro ejecutarlo varias veces: si el temario ya está, no toca nada.

MAIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"     # .../TCEE/main
BASE="$(dirname "$MAIN_DIR")"                    # .../TCEE

if [ -d "$BASE/temario/.git" ]; then
  echo "El temario ya está descargado en $BASE/temario"
else
  echo "Descargando el temario…"
  git clone -q https://github.com/OposicionTCEE/temario.git "$BASE/temario" || {
    echo "No se pudo descargar. Comprueba la conexión y vuelve a ejecutar este comando."; exit 1; }
fi

# Progreso del panel TCEE (repositorio PRIVADO: tus tiempos y los temas marcados como hechos)
if [ ! -d "$BASE/progreso/.git" ]; then
  echo "Descargando tu progreso (repositorio privado)…"
  git clone -q https://github.com/OposicionTCEE/progreso.git "$BASE/progreso" || {
    echo "Aviso: no se pudo descargar «progreso». ¿Has creado el repositorio privado en GitHub (GUIA_INSTALACION, paso 11)?"
    echo "       El panel funciona igual y guarda el progreso en VS Code hasta que lo descargues."; }
fi

# Banco de preguntas del test (pestaña Test del Panel Oposición)
if [ ! -d "$BASE/test/.git" ]; then
  echo "Descargando el banco de preguntas del test…"
  git clone -q https://github.com/OposicionTCEE/test.git "$BASE/test" || echo "Aviso: no se pudo descargar «test». Repite esta tarea más tarde."
fi

# Instrucciones para Claude en la raíz del espacio de trabajo (remite a main/CLAUDE.md)
printf '@main/CLAUDE.md\n' > "$BASE/CLAUDE.md"

# Atajos de escritura (snippets) para todo el espacio de trabajo
mkdir -p "$BASE/.vscode"
cp "$MAIN_DIR/config/tcee.code-snippets" "$BASE/.vscode/tcee.code-snippets"

echo "Todo listo."
