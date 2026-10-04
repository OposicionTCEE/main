# Pestaña «Test» del Panel Oposición (primer ejercicio)

Sirve para practicar el test con el banco de preguntas de exámenes oficiales, clasificadas por tema del tercer ejercicio.

Código:
- `extension/testPanel.js`: lee el banco y el historial, y guarda las sesiones.
- `extension/media/test.js`: vista.

Mantener este documento y el código a la vez.

## Datos

| Qué | Dónde | Visibilidad |
|---|---|---|
| Banco de preguntas | Repositorio `test`: `TCEE/test/preguntas.json` + `img/` (formato en su README) | Público |
| Tus respuestas | `progreso/test/<Mac>.json` (`sesiones[]`); cada Mac escribe solo su fichero | **Privado** |

- **Descarga del banco:** *Sincronizar* descarga el repositorio `test` la primera vez y después lo mantiene al día.
- **Envío a la pestaña:** el banco (unos 700 KB) se manda a la pestaña solo al abrirla, no en cada refresco del panel.
- **Fichero de sesiones:** cada sesión guarda `{id, fecha, modo, titulo, duracion, correccion, respuestas: [{id, r: ["A"], ok: true|false|null}], resumen: {n, aciertos, errores, blancos, puntos, nota10}}`.

## Modos

1. **Por tema o bloque**: se eligen bloques enteros de `config/bloques.json` o temas sueltos.
   - Opcionalmente, solo preguntas nunca respondidas y un máximo de preguntas.
   - Orden aleatorio.
2. **Simulacro**:
   - un examen oficial, en su orden; solo incluye las preguntas de ese examen que están en el banco, no el examen completo;
   - o uno mezclado de N preguntas al azar;
   - tiempo límite (por defecto, 1,2 minutos por pregunta); al agotarse, se corrige solo;
   - corrección siempre al final.
3. **Repaso de falladas**: las preguntas cuya **última** respuesta, de cualquier sesión y cualquier Mac, fue un error o quedó en blanco. Al acertarlas salen de la lista.
4. **Aleatorio**: N preguntas al azar de todo el banco.

**Corrección** (en todos los modos salvo el simulacro, que siempre corrige al final):
- *Al momento*: se comprueba pregunta a pregunta. **Solo cuentan las preguntas comprobadas**: si terminas antes, las que no viste no son fallos.
- *Al final*: como en el examen; las no contestadas cuentan en blanco.

## Efecto en el progreso del tema

Cada pregunta cuya última respuesta es un error suma 1 unidad de trabajo pendiente a su tema (en blanco, 0,5), incluso si el tema está marcado como hecho. Reglas en `PROGRESO.md`.

## Puntuación

Según `puntuacion` del banco:
- acierto +1;
- error −1/3;
- en blanco 0.

Nota = máx(0, puntos) / preguntas × 10.

En las preguntas de varias respuestas (`tipo: "multi"`), es acierto solo si se marcan exactamente las correctas.

## Pantalla

- **Inicio**:
  - a la izquierda, la nueva prueba;
  - a la derecha, el progreso: preguntas respondidas alguna vez, % de acierto en el último intento y, por bloque, una barra con acertadas, falladas o en blanco y sin hacer;
  - debajo, las últimas pruebas, que se pueden borrar.
- **Prueba**:
  - enunciado con las fórmulas dibujadas (KaTeX) e imagen si la hay; si la imagen falta en el banco, se avisa;
  - mapa de preguntas;
  - reloj;
  - teclado: A–D o 1–4 para marcar, Intro para comprobar o seguir, ← → para moverse.
  - Si el panel se recarga, la prueba continúa donde estaba.
- **Resultado**:
  - nota, puntos, aciertos, errores, blancos y tiempo;
  - desglose por bloque;
  - revisión de cada pregunta: tu respuesta, la correcta, el examen de origen y un enlace al tema;
  - botón *Repasar las falladas de esta prueba*.

## Calidad del banco (4 de octubre de 2026)

- 583 preguntas de 86 temas y 13 exámenes (2011–2025).
- Faltan 3.A.33 y 3.B.40: estaban en iCloud sin descargar.
- Faltan 14 de las 16 imágenes.
- Se corrigieron 24 fórmulas mal convertidas en origen: subíndices dobles, `%` sin escapar, `\pdv` y `$` dentro de fórmulas.
- Quedan 7 preguntas con texto de fórmula suelto, mal convertido en origen: 3A0909, 3A1011, 3A1204, 3A2101, 3A2104, 3A2905 y 3A4313. Hay que revisarlas a mano con el examen original.
- Ninguna pregunta tiene justificación todavía. Si se añade en el banco, se muestra al corregir.

## Cobertura: ¿está la pregunta en su tema?

Para cada pregunta, Claude lee la pregunta con su respuesta correcta y el tema entero, y la clasifica:

| Estado | Significa |
|---|---|
| `cubierta` | El tema contiene lo necesario para responderla. Se indican el epígrafe y la línea |
| `desapercibida` | Está, pero de pasada, sin la idea concreta que pide la pregunta o mezclada; es fácil no verlo al estudiar |
| `falta` | El tema no tiene ese contenido |
| `contradice` | El tema dice algo incompatible con la respuesta correcta: posible error del tema |

- **Se analizan solo los temas con preguntas falladas** (decisión del usuario, 4 de octubre de 2026): las que tienen como última respuesta un error o un blanco.
- **Fichero:** `main/analisis/cobertura.json` (`preguntas.<id>`: tema, estado, epígrafe, línea, explicación, propuesta, huella).
- **Huella:** guarda la del tema. Si el tema cambia, la pregunta vuelve a quedar pendiente de analizar.
- **Dónde se ve:** en la pestaña Test, al corregir y en la revisión de cada pregunta, con un enlace a la línea.
- **Los temas no se corrigen solos:** las propuestas se enseñan al usuario antes de tocar nada (regla de `CLAUDE.md`).

**Cómo se actualiza.** La acción *Rehacer informes* lo comprueba y copia el encargo. A mano:
1. `node main/scripts/cobertura.js estado`: temas con preguntas falladas sin informe o con el tema cambiado.
2. `node main/scripts/cobertura.js preparar --errores`. También admite `--todos` o códigos de tema.
   Escribe `TCEE/.cobertura/in/<tema>.md`: las preguntas, con la correcta marcada, y la ruta del tema.
3. Por cada tema, escribir `TCEE/.cobertura/out/<tema>.json`:

   ```json
   { "tema": "3.A.8", "preguntas": [ { "id": "3A0801", "estado": "cubierta | desapercibida | falta | contradice",
     "epigrafe": "<número y título>", "linea": <línea del main.tex, desde 1>, "explicacion": "1-2 frases",
     "propuesta": "qué añadir o corregir en el tema (vacío si está cubierta)" } ] }
   ```

   Reglas del informe:
   - Leer el tema entero, no solo el epígrafe probable.
   - «Cubierta» exige que el tema permita llegar a la respuesta correcta y descartar las incorrectas.
   - Fórmulas en LaTeX entre `\( … \)`.
   - No inventar líneas: la línea debe contener el contenido citado.
4. `node main/scripts/cobertura.js unir`.

## Pendiente: preguntas de la academia (carpeta Test-JC del Escritorio)

El usuario quiere hacerlo más adelante en una sesión de Claude en la nube. Ha decidido guardarlas en el repositorio **público** `test`.
Se le advirtió de que es material de una academia, con derechos de autor, y lo mantuvo.

Estado de la carpeta el 4 de octubre de 2026:
- 68 PDF, pero unos 25 documentos reales: muchas copias («copia», «1», «2», «SOL 1»…).
- Unas 1.270 páginas sin duplicados, de las que unas 740 están escaneadas, sin texto.
- Varios ficheros no se abrían (iCloud sin descargar).

Procedimiento:
1. **Quitar duplicados:** mismo contenido o mismo nombre base. Quedarse con la versión con soluciones.
2. **Extraer el texto:**
   - páginas con texto: `pdftotext`;
   - páginas escaneadas: convertirlas a imagen (`pdftoppm -r 150`) y leerlas como imagen.
3. **Identificar la respuesta correcta:** en los «SOL / CON SOLUCIONES» suele ir resaltada o rodeada, así que hay que mirar la página como imagen.
   Si no hay solución, la pregunta queda sin `correctas` y se marca para revisar; nunca se inventa.
4. **Asignar el tema** del programa (`main/config/programa_3.json`).
5. **Añadirlas a `test/preguntas.json`** con el mismo formato:
   - `id` nuevo con prefijo `JC`;
   - `examen`: nombre del documento;
   - `origen: "academia"`.
6. **Hacer antes una muestra de 2 documentos** y enseñársela al usuario.
