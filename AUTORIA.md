# Autoría de los cambios del temario

Quién hizo cada cambio de un tema (el usuario o Claude) y cuándo queda registrado en git, sin escribir nada a mano. No hay recuadro en
el PDF: la información está en git y se consulta con las herramientas que ya existen.

## Cómo se ve

- **VS Code**: con el tema abierto, la vista **Línea de tiempo** (abajo en la barra del Explorador) lista cada guardado con su autor
  (`marceloortegar` o `Claude`) y su hora. Al pulsar uno se ve qué cambió.
- **GitHub**: en el fichero del tema, botón **History**.
- La marca **`inicio-autoria`** del repositorio `temario` (14/10/2026) señala desde cuándo es fiable. Lo anterior figura a nombre del
  usuario aunque lo escribiera Claude, porque antes todo lo subía «Sincronizar». En esa marca consta con quién empieza cada tema: Claude en
  los ya trabajados con él y el usuario en el resto.

## Cómo funciona

1. **Hook de Claude Code** (en el Mac, configurado en `TCEE/.claude/settings.json`). Llama a `main/scripts/autoria.sh`:
   - **antes** de cada acción de Claude que puede cambiar ficheros (Edit, Write, NotebookEdit, Bash): lo que haya sin guardar en el
     temario es del usuario, porque lo de Claude se guarda siempre al instante. Se guarda a su nombre, con la hora de su último cambio;
   - **después**: lo que acaba de cambiar Claude se guarda a nombre de Claude. Con Edit/Write/NotebookEdit, solo el fichero editado; con
     Bash, solo lo que cambie en las carpetas `Img/` y `Code/` de los temas (figuras).
   Así, si el usuario retoca una parte de un tema mientras Claude escribe en otra, cada cambio queda a nombre de quien lo hizo.
   El script no escribe nada en pantalla y nunca bloquea a Claude.
2. **«Sincronizar»** guarda lo que quede a nombre del usuario (por ejemplo, lo trabajado sin conexión) y lo sube.
3. **Claude en la nube** guarda sus cambios a su nombre.
4. **Regla para Claude** (`GUIA_TEMAS.md` §8.7): el texto de los temas solo se modifica con las herramientas de edición, nunca con scripts;
   si un encargo exige un script sobre los `.tex`, Claude guarda ese cambio a su nombre nada más terminarlo. Claude no reescribe la
   historia de git ni sube nada.

**Límites conocidos**: si el usuario guarda un fichero en el mismo segundo en que Claude lo edita, ese cambio puede quedar a nombre de
Claude; y si Claude incumpliera la regla y cambiara un `.tex` con un script sin guardarlo, ese cambio quedaría a nombre del usuario.
Nada de esto pierde texto: solo afecta a quién figura como autor.

## Instalación del hook (una vez por Mac)

El hook es configuración de Claude Code y lo da de alta el usuario (Claude no puede modificar su propia configuración). En VS Code:
**Archivo › Abrir…**, carpeta `TCEE/.claude` (oculta: en la ventana de abrir, ⌘⇧. muestra los ficheros ocultos).

- Si **no existe** `settings.json`, se crea con este contenido:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|NotebookEdit|Bash",
        "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/main/scripts/autoria.sh\" antes", "timeout": 30 } ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write|NotebookEdit|Bash",
        "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/main/scripts/autoria.sh\" despues", "timeout": 30 } ] }
    ]
  }
}
```

- Si **ya existe** (por ejemplo, con los permisos), se añade el bloque `"hooks": { … }` de arriba dentro de las llaves principales,
  separado de lo anterior por una coma.

Claude Code relee el fichero al guardarlo; si no se nota, basta cerrar y abrir Claude Code. Para comprobarlo: en el panel de Claude Code,
**Customize › Hooks** muestra los hooks cargados.
