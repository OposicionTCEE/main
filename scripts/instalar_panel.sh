#!/bin/bash
# Instala (o actualiza) el Panel TCEE en VS Code.
# Uso (desde la carpeta TCEE): bash main/scripts/instalar_panel.sh
# Busca el programa "code" de VS Code aunque no esté en Aplicaciones ni en el PATH.

cd "$(dirname "$0")/../.." || exit 1
VSIX="main/extension/tcee-panel.vsix"
if [ ! -f "$VSIX" ]; then
  echo "❌ No encuentro $VSIX. Sincroniza primero (tarea «Sincronizar todos los temas con GitHub»)."
  exit 1
fi

CODE=""
# 1) El que esté en el PATH
command -v code >/dev/null 2>&1 && CODE="$(command -v code)"
# 2) El de la copia de VS Code que está abierta ahora mismo (la tarea corre dentro de ella)
if [ -z "$CODE" ]; then
  for v in "$VSCODE_GIT_ASKPASS_NODE" "$VSCODE_CWD"; do
    case "$v" in
      *".app/"*) APP="${v%%.app/*}.app"
                 [ -x "$APP/Contents/Resources/app/bin/code" ] && CODE="$APP/Contents/Resources/app/bin/code" && break ;;
    esac
  done
fi
# 3) Ubicaciones habituales y búsqueda de Spotlight
if [ -z "$CODE" ]; then
  CANDIDATAS=("/Applications/Visual Studio Code.app" "$HOME/Applications/Visual Studio Code.app" "$HOME/Downloads/Visual Studio Code.app")
  while IFS= read -r app; do CANDIDATAS+=("$app"); done < <(mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.VSCode'" 2>/dev/null)
  for APP in "${CANDIDATAS[@]}"; do
    [ -x "$APP/Contents/Resources/app/bin/code" ] && CODE="$APP/Contents/Resources/app/bin/code" && break
  done
fi

if [ -z "$CODE" ]; then
  echo "❌ No encuentro VS Code para instalar el panel automáticamente."
  echo "   Instálalo a mano: icono de Extensiones (cuatro cuadrados) › «…» arriba › «Instalar desde VSIX…»"
  echo "   y elige TCEE › main › extension › tcee-panel.vsix"
  exit 1
fi

echo "Usando: $CODE"
if "$CODE" --install-extension "$VSIX" --force; then
  echo ""
  echo "✅ Listo. Ahora recarga la ventana: ⌘⇧P y escribe «Recargar ventana»"
  echo "   (en español sale como «Desarrollador: Recargar ventana»). Aparecerá el icono TCEE en la barra izquierda."
else
  echo "❌ La instalación ha fallado (mensaje de arriba). Prueba a mano: Extensiones › «…» › «Instalar desde VSIX…»."
  exit 1
fi
