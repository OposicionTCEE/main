# Instrucciones para Claude — Entorno de la oposición TCEE

## Qué es esto
Espacio de trabajo para preparar la oposición a Técnico Comercial y Economista del Estado (TCEE).
La carpeta raíz (`TCEE/`) contiene:
- `main/` — este repositorio: configuración del entorno, scripts, análisis y todo lo que no es un tema.
- `temario/` — repositorio con todos los temas: `Ejercicio-3/Parte-A/3.A.1/`, `Ejercicio-4/Parte-B/4.B.7/`, etc.
  Cada carpeta de tema tiene `main.tex`, la carpeta `Img/` con sus figuras (el preámbulo usa `\graphicspath{{Img/}}`)
  y, si ha compilado, el PDF `X.Y.N.pdf` (no se sube a GitHub). Las figuras nuevas van siempre en `Img/`.
  Los antiguos repositorios `Tema-X.Y.Z` están archivados; su historial está dentro de `temario` (ver `main/HISTORIAL.md`).

## Cómo trabajar con los temas
- Compilación: `bash main/scripts/compilar.sh temario/Ejercicio-3/Parte-A/3.A.43/main` (envuelve `latexmk -pdf -f …`).
  Compila en `.build/.tmp` y solo copia el PDF a `.build/` si se genera: con un error grave se conserva el último PDF correcto.
  `-f` es intencionado: muchos temas tienen errores menores y el PDF debe salir igual.
  Si compila, el PDF se copia también a iCloud (`OPO - TCEE/PDF temas/Tema-X.pdf`, configurable en `~/.tcee_carpeta_pdf`).
  Los PDF nunca se suben a GitHub. Para compilar todos: `bash main/scripts/compilar_todo.sh [3.A.43 …]`.
  El estado de cada tema está en `main/ESTADO_COMPILACION.md`.
- Las ecuaciones se escriben con `\eqblock{<matemática en aligned>}{<pie>}`. El pie debe nombrar el modelo
  ("… Modelo de SOLOW"): el análisis de relaciones entre temas depende de ello.
- Remisiones a otros temas: `([\authorfont{Ver Tema 3.A.44}])`.
- Autores en MAYÚSCULAS en el texto (SOLOW, MUNDELL-FLEMING), con año entre paréntesis.
- No pegar nunca Markdown (`#`, `**`, `[Seguro]`) dentro de un `.tex`: rompe la compilación (ha pasado en 4.B.15 y 4.B.25).
- Antes de modificar varios temas a la vez, enseñar al usuario qué se va a cambiar y esperar su visto bueno.
- Para sincronizar con GitHub (main + temario): `bash main/scripts/sincronizar_todo.sh` desde la carpeta TCEE.
- Para ver o deshacer cambios antiguos de un tema: `main/HISTORIAL.md`.
  Si informa de un conflicto en un tema, resolverlo mostrando al usuario las dos versiones del fragmento y dejando que elija.

## Panel TCEE (extensión propia de VS Code)
Código en `main/extension/` (JavaScript sin compilación: `extension.js` + `parser.js`). Tras cualquier cambio, volver a empaquetar
con `npx @vscode/vsce package --skip-license -o tcee-panel.vsix` dentro de `main/extension/` y subir el `.vsix`;
el usuario lo instala con la tarea *Instalar o actualizar el panel TCEE*. Probar `parser.js` contra todos los temas (145 carpetas en octubre de 2026) antes de publicar.
Tiempo restante (`progreso.js`): reglas en `main/PROGRESO.md` (mantener código y documento a la vez). Ajustes propios de este temario
que no figuran allí: no cuentan Introducción, Conclusión ni Preguntas Test. Datos en el repositorio PRIVADO `progreso`; no copiarlos a `main` ni a `temario`.
Nueva nota (`inferencia.js`): añade `\textbf{NOTA (dd/mm/aaaa[, desde X.Y.N]):} texto` como párrafo final de `\modificaciones{…}` del tema destino
(buscado tras `\begin{document}`: en el preámbulo está la definición de la macro).
Panel Oposición (`panelOposicion.js` + `media/panel.js/.css`, pestaña webview): pestañas Calendario, Temas (`media/temas.js`: cartas por bloque de `config/bloques.json`, filtro de ejercicio y partes),
Relaciones, Cante y Test; se abre en una ventana aparte (`workbench.action.moveEditorToNewWindow`). Lo que abre (temas, líneas) va a la ventana principal:
`tcee.irA(uri, linea, {principal:true})` usa el último grupo de editores de texto activo.
Para ahorrar batería guarda por tema el texto y los pendientes y solo los recalcula si cambia el fichero, el documento abierto o `.build/estado`;
`Progreso.todos()` se guarda 5 s. La transcripción del cante nunca se lanza sola (botón *Transcribir*). El plan semanal se eliminó (v0.11).
Cante (`cante.js` + `media/cante.js`): graba con ffmpeg y transcribe con whisper.cpp en el Mac; fichas en el repositorio PRIVADO `progreso/cantes/`,
audio solo en el Mac. Reglas en `main/CANTE.md` (mantener código y documento a la vez); instalación con `scripts/instalar_cante.sh`.
Test (`testPanel.js` + `media/test.js`): banco en el repositorio `test` (`TCEE/test/preguntas.json`, un único fichero; mantener los `id`),
respuestas en el repositorio PRIVADO `progreso/test/<Mac>.json`. Reglas en `main/TEST.md` (mantener código y documento a la vez).
Atajos en `.tex`: ⌘B/⌘I (`tcee.negrita`/`tcee.cursiva`, envuelven o desenvuelven en `\textbf`/`\textit`); vista previa de fórmulas propia
(`formulas.js` + MathJax en `lib/`: al pasar el ratón y ⌘⌥M; también imágenes, `imagenes.js`; empareja bien los `aligned` anidados, a diferencia de LaTeX Workshop, cuya vista previa está apagada). Reglas en `main/FORMULAS.md`.
Notas al pie contraíbles (`notas.js`, ⌘⌥N; se contraen al abrir): las notas van en varias líneas (`\footnote{%` ⏎ contenido ⏎ `}`; el % se pone y quita solo);
`scripts/notas_pie.js` reescribe las antiguas sin cambiar el PDF. Reglas en `main/NOTAS.md`.
Escritura (`escritura.js`, reglas en `main/ESCRITURA.md`): ⌘B/⌘I/⌃H salen del grupo o quitan la orden; ⌘⌥U mayúsculas; `$` automático; `\color` → `\textcolor{}{}`;
`\hl{}` (paquete soul); ⌃C rodea de color; ⌘⌥K y la acción «Atajos» muestran los atajos;
`\lnum`/`\la` + Intro → lista; Intro en una lista añade `\item`; `\cita` → `\begin{cita}[Autor][Año][Obra]` (entorno definido en los 145 temas). Paleta en `config/colores.json`. **Para Claude**: `\textcolor{magenta}{…}` en un tema es una indicación
del usuario para Claude; `red` = pendiente/OJO del usuario (no es una orden); `blue` = no cambiar sin preguntar; `orange` = dato por verificar.
Acción Rehacer informes (`tcee.rehacerInformes`): ejecuta `scripts/armonizacion.js estado` y copia el encargo para Claude Code. El progreso guarda además minutos por día (`dias`) en el fichero de cada Mac.
Calendario de vueltas (pestaña Calendario): reglas y razonamiento en `main/CALENDARIO.md` (mantener código y documento a la vez).
`calendario.js` (generar semanas temático/correlativo/aleatorio, reparto diario, librar días, mover cante), `afinidad.js` (relaciones entre temas),
`calendarioPanel.js` (guardar y aplicar cambios) y `media/calendario.js` (vista mensual). Programa del ejercicio en `config/programa_3.json`.
Los calendarios se guardan en el repositorio PRIVADO `progreso/calendarios/`. La generación usa solo las reglas (ámbitos y etiquetas de `config/programa_3.json` + pesos de `afinidad.js`); el calendario de la preparadora solo sirvió para fijarlas. 3º y 4º ejercicio nunca se mezclan.

Bloques temáticos del temario en `config/bloques.json` (`ejercicios.<n>.bloques[]`: id, nombre, grupo, color, temas). Es la fuente única de a qué bloque
pertenece cada tema: no guardarlo en las carpetas ni en los `.tex`. Solo existe aún para el 3er ejercicio.

Historia del proyecto, decisiones tomadas y tareas pendientes: `main/CONTEXTO.md` (leerlo al empezar una tarea nueva).

## Relaciones entre temas
`main/analisis/desarrollos.json` indica, para cada tema, qué modelos se DESARROLLAN matemáticamente y en qué epígrafes
(`por_tema`) y en qué temas se desarrolla cada familia de modelos (`por_familia`).
Úsalo cuando el usuario pregunte por relaciones, duplicidades o cómo homogeneizar la presentación de un modelo.
El Excel equivalente con más detalle está en `main/analisis/Desarrollos_modelos_TCEE.xlsx`.
`main/analisis/armonizacion.json`: informes de armonización de los modelos compartidos (enfoque, divergencias, posibles errores
verificados, propuesta y resumen por tema), con la huella de cada desarrollo para detectar cambios. Los muestra la pestaña Relaciones
(`desarrollos.js`, `relacionesPanel.js`, `media/relaciones.js`, KaTeX en `media/katex/`). Método, encargos y cómo actualizarlos
(`scripts/armonizacion.js estado | preparar | unir`): `main/RELACIONES.md`. Los posibles errores NO se corrigen en los temas sin enseñárselos antes al usuario.

## Estilo de interacción (preferencias del usuario)
1. No abrir nunca dando la razón; la primera frase cuestiona una asunción, señala un riesgo u omisión, o hace una pregunta que revele una falla.
2. Ante un desacuerdo: "No estoy de acuerdo porque [RAZÓN]. El riesgo de tu enfoque es [CONSECUENCIA ESPECÍFICA]."
3. La verdad incómoda va primero.
4. Etiquetar las afirmaciones propias como [Seguro], [Probable] o [Suposición] (en la conversación, no dentro del `.tex`).
5. Prohibido: "Buena pregunta", "Tienes toda la razón", "Eso tiene mucho sentido", "Por supuesto", "Definitivamente".
6. Sin introducciones innecesarias.
7. Mantener la postura salvo que el usuario aporte información genuinamente nueva.

El usuario no tiene formación informática: explicar los pasos técnicos en lenguaje llano y no dar por sabido el uso de la terminal.
