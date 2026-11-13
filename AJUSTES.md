# Ajustes del Panel TCEE (v0.53, 13 de noviembre de 2026)

Ventanita para cambiar los ajustes del Panel TCEE sin tocar ficheros. Código: `extension/acciones.js` (catálogo de acciones),
`extension/ajustes.js` (lista de ajustes y ventanita), `extension/claudeCode.js` (dónde se abre Claude Code) y `extension/package.json`
(declaración de cada ajuste, `contributes.configuration`). Mantener código y documento a la vez.

## 1. Decisiones del usuario (13 de noviembre de 2026)

- Una acción **Ajustes** en la barra lateral TCEE (siempre visible, la última) y un ⚙ en la cabecera de Acciones. Lista abierta a ajustes nuevos.
- **Iguales en todos los Macs**: se guardan en los ajustes del espacio de trabajo (`TCEE.code-workspace`, en `main`), que viajan con *Sincronizar*.
- Mostrar u ocultar cada acción de la barra lateral, el Índice y el botón «Atajos» de la barra inferior.
- **Dónde se abre Claude Code** con *Notas del tema con Claude*: barra lateral (como hasta ahora), pestaña o ventana aparte.
  Con ventana aparte, **la misma si se puede**: si ya hay una ventana de Claude abierta, la conversación nueva va a esa; si no, se abre otra y se dice.
  Vale también para *Rehacer informes* (un solo sitio para elegir dónde se abre Claude Code).
- La **versión** del panel se ve en el título de la ventanita: lo primero que hay que mirar si algo no cambia tras instalar (instalar no basta:
  hay que recargar la ventana).

## 2. Cómo funciona

- **Intro** cambia lo marcado y la ventanita sigue abierta; los ajustes con varias opciones abren una segunda lista (Esc vuelve sin cambiar).
- **Guardar** (`guardar` en `ajustes.js`): en el espacio de trabajo si hay uno abierto; si no, en los ajustes de usuario. Un valor igual al de
  por defecto se quita del fichero, salvo que los ajustes de usuario digan otra cosa (entonces se escribe explícito).
- **En vivo**: al ocultar o mostrar una acción, la vista se rehace (`onDidChangeConfiguration` en `extension.js`); el Índice se oculta con
  `"when": "config.tcee.indiceVisible"` en `package.json`; el botón «Atajos» se quita o vuelve al momento.
- El atajo que se ve junto a cada acción sale de `package.json` y de los que el usuario haya cambiado en VS Code (`keybindings.json`):
  la misma función (`atajos` en `acciones.js`) sirve a la vista Acciones y a la ventana *Atajos*.

## 3. Ajustes

| Ajuste | Qué hace | Por defecto |
| - | - | - |
| `tcee.accionesOcultas` | Acciones de la barra lateral que no se ven (ids del catálogo). *Ajustes* siempre se ve | ninguna |
| `tcee.indiceVisible` | Vista Índice del tema, debajo de Acciones | sí |
| `tcee.botonAtajos` | Botón «Atajos» en la barra inferior al editar un `.tex` | sí |
| `tcee.claudeAbrirEn` | Dónde se abre Claude Code: `barraLateral`, `pestana` o `ventanaNueva` | barra lateral |
| `tcee.revisarSentido` | Revisar: quién manda al desplazarse: `pdf`, `ambos` o `no` (también con el botón del visor; `REVISAR.md`) | el PDF |
| `tcee.revisarSeguimiento` | Revisar: cuándo se mueve el otro lado: `alParar`, `alCambiar` o `continuo` (también con el botón del visor) | al parar |
| `tcee.revisarAtenuar` | Revisar: oscurecer el lado donde no está el ratón (también con el botón ◐) | sí |
| `tcee.revisarSuave` | Revisar: deslizarse en vez de saltar; para el texto pone `editor.smoothScrolling` en los `.tex` (y lo quita al apagarlo) | sí |
| `tcee.revisarBanda` | Revisar: banda en el texto con el párrafo que se lee en el PDF | sí |
| `tcee.notasContraidasAlAbrir` | Contraer las notas al pie al abrir un tema (`NOTAS.md`) | sí |
| `tcee.preambuloContraidoAlAbrir` | Plegar el preámbulo al abrir un tema (`NOTAS.md`) | sí |
| `tcee.fusionAlGuardar` | Fusión al guardar (`EDICION_SIMULTANEA.md`) | sí |

## 4. Dónde se abre Claude Code (`claudeCode.js`)

- El encargo se **copia siempre** al portapapeles: si una versión de Claude Code no admite el mensaje prellenado, basta con pegarlo (⌘V).
- **Barra lateral**: `claudeCode.preferredLocation = sidebar`, `claude-vscode.sidebar.open` y `claude-vscode.editor.open` en modo programático
  (`{programmatic: 'honor-preferred-location'}`), que escribe el encargo. Es lo que había hasta la v0.52.
- **Pestaña**: `claudeCode.preferredLocation = panel` y la misma orden: conversación nueva en una pestaña del editor.
- **Ventana aparte**: se abre como pestaña y, si es el editor activo, se lleva:
  1. a la ventana de Claude que abrió el panel, si sigue abierta (`moveActiveEditor` con `{to: 'position', by: 'group', value: viewColumn}`:
     VS Code numera seguidos los grupos de todas las ventanas, en el mismo orden que `viewColumn`; si el número no existe, no hace nada);
  2. si no (por ejemplo, tras recargar), al último grupo que solo tenga conversaciones de Claude y no sea el primero (el primero es siempre de la ventana principal);
  3. si no hay ninguna, a una ventana nueva (`workbench.action.moveEditorToNewWindow`, como el Panel Oposición).
  Se comprueba cada paso; si la conversación no queda como editor activo o no se puede mover, se queda en la pestaña y el aviso lo dice.
  **Nunca se mueve otro editor** (un tema, por ejemplo).
- Sin las órdenes de Claude Code: el enlace documentado `vscode://anthropic.claude-code/open?prompt=…` (abre una pestaña con el encargo).
- **Efecto secundario**: cambia el ajuste de usuario de Claude Code `claudeCode.preferredLocation` (barra lateral o pestaña), que Claude Code usa
  también para sus propias conversaciones nuevas. Ya pasaba antes con la barra lateral.
- [Probable] Al llevar una conversación a otra ventana, Claude Code puede recargarla y perder el texto escrito: por eso el encargo está copiado.
- Registro de cada paso en *Salida › Panel TCEE: Claude Code*.
- Lo que no se ha podido comprobar fuera de VS Code: el nombre de la orden *Open in New Window* de Claude Code y si admite el mensaje
  (no se usa: se mueve la pestaña). Si Claude Code cambia sus órdenes, mirar el registro.

## 5. Cómo añadir algo

- **Una acción** en la barra lateral: entrada en `ACCIONES` de `acciones.js` (el `id` no se cambia nunca: es lo que se guarda), su orden en
  `contributes.commands` de `package.json` y `registerCommand` en `extension.js`, y el `id` en el `enum` de `tcee.accionesOcultas`. Sale visible y ya
  se puede ocultar en Ajustes.
- **Un ajuste**: propiedad `tcee.…` en `contributes.configuration` de `package.json` (tipo, valor por defecto y descripción; con opciones,
  `enum` + `enumItemLabels` + `enumDescriptions`), entrada en `SECCIONES` de `ajustes.js`, leerlo con `getConfiguration('tcee').get(…)` y, si debe
  aplicarse al momento, escuchar `onDidChangeConfiguration`. Añadirlo a la tabla del apartado 3.
- La prueba `node extension/pruebas/ajustes.js` falla si `package.json`, el catálogo y la ventanita no coinciden (y comprueba ocultar y guardar).

## 6. Pruebas

- `node extension/pruebas/ajustes.js`: catálogo, ventanita y `package.json` coinciden; ocultar acciones; guardar en el espacio de trabajo.
- `node extension/pruebas/claude_code.js`: los tres destinos con VS Code simulado (`pruebas/vscode_simulado.js`): misma ventana la segunda vez,
  tras recargar, ventana principal con solo Claude, conversación abierta de fondo (no se mueve nada) y sin órdenes de Claude Code.
- No simulable: la ventana aparte real en el Mac. Se prueba allí; si falla, el registro de *Salida* dice en qué paso.
