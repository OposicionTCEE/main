# Pestaña «Relaciones» del Panel Oposición

Sirve para **armonizar** la presentación de los modelos que se desarrollan en varios temas.
Armonizar no es igualar la redacción: es que el **enfoque**, los **supuestos**, las **ecuaciones** (y su notación) y las **implicaciones** sean coherentes entre temas.

Código:
- `extension/desarrollos.js`: localiza y resume el desarrollo de un modelo en un tema (módulo puro).
- `extension/relacionesPanel.js`: datos de la pestaña.
- `extension/media/relaciones.js`: vista.
- `extension/media/katex/`: KaTeX 0.16, para mostrar las ecuaciones sin conexión.

Datos:
- `analisis/desarrollos.json`: qué modelos se desarrollan en cada tema.
- `analisis/armonizacion.json`: informes escritos por Claude.

Mantener este documento y el código a la vez.

## 1. Qué muestra

- **Izquierda, mapa de temas.** Dos temas se unen si desarrollan un mismo modelo; la línea es más gruesa cuantos más modelos comparten.
  - Si hay un `main.tex` abierto, su tema y los temas con los que comparte modelos se resaltan y el resto se atenúa.
  - Al elegir un modelo, los temas que lo desarrollan se marcan en ocre.
  - Pulsar un nodo abre el tema.
- **Derecha, pestaña «Tema X»** (solo si hay un tema abierto):
  - desplegable con los modelos que el tema comparte con otros;
  - al elegir uno, aparecen la prioridad de armonización, los posibles errores de **este** tema (con enlace a la línea) y una ficha por cada uno de los otros temas que lo desarrollan.
- **Derecha, pestaña «Qué armonizar»**: lista de los modelos compartidos ordenada por urgencia. Al pulsar uno se ve el informe completo:
  - enfoque común;
  - diferencias;
  - posibles errores;
  - propuesta;
  - tema de referencia;
  - una ficha por tema.
- **Ficha de un tema**:
  - el resumen de Claude: papel, contexto, supuestos, ecuaciones clave renderizadas, desarrollo e implicaciones;
  - enlaces a los epígrafes donde está el desarrollo.

  Si el tema ha cambiado desde el informe, o no lo hay, la ficha lo avisa y muestra las ecuaciones **actuales** extraídas del texto.

## 2. Las dos señales

1. **Indicadores automáticos** (`desarrollos.js`, se recalculan al instante).
   - **Localización** del desarrollo:
     - los epígrafes que contienen `\eqblock` cuyo pie nombra el modelo;
     - los epígrafes que indica `desarrollos.json`, por su título. Si ese título se repite en el tema (p. ej. «Supuestos»), solo cuentan los que nombran el modelo en su título, en el de un antepasado o en su texto.

     De cada epígrafe cuenta solo su texto propio, hasta su primer subepígrafe. Por eso es importante que los pies de las ecuaciones nombren el modelo (regla de `CLAUDE.md`).
   - **Divergencia** (0 = iguales, 1 = muy distintas):
     - 50 %: notación, como 1 − el parecido medio de los símbolos usados;
     - 25 %: dispersión del número de ecuaciones;
     - 25 %: partes presentes en unos temas y no en otros (supuestos, equilibrio, estática comparativa, implicaciones, gráficos).
   - **Huella**: un resumen numérico del texto del desarrollo. Si cambia, el desarrollo se ha tocado.
2. **Informes de Claude** (`armonizacion.json`).

   Claude lee el LaTeX de cada desarrollo y escribe, por modelo, lo siguiente:
   - prioridad (alta / media / baja) y su motivo;
   - enfoque común;
   - divergencias de fondo;
   - propuesta;
   - tema de referencia;
   - un resumen por tema.

   Los «Posible error:» los revisa un **segundo análisis independiente**, que no escribió el informe, con veredicto *confirmado*, *dudoso* o *descartado*. Los descartados se quitan.

   Cada tema guarda la huella de su desarrollo en el momento del informe.

**Orden de «Qué armonizar»:**

```
puntos = 10 × prioridad (alta 3, media 2, baja 1; sin informe 2) + 3 × errores confirmados + 5 × divergencia + 2 si algún tema cambió
```

**Estado de cada ficha:**
- *al día*: la huella coincide;
- *cambiado*: el desarrollo se tocó después del informe;
- *sin informe*.

## 3. Situación del primer análisis (4 de octubre de 2026)

- 34 modelos compartidos por al menos dos temas (88 desarrollos): 27 de prioridad alta y 7 media.
- 77 posibles errores señalados, en 38 temas. La verificación independiente confirmó 76; queda 1 dudoso: Nueva Economía Keynesiana (NEK-2), pesos de la regla de TAYLOR.
- Un desarrollo no se localizó: 3.A.3, «Teoría del dinero».
- **No se ha corregido ningún tema.** Las correcciones se enseñan antes al usuario (regla de `CLAUDE.md`).
- `desarrollos.json` solo cubre los temas que tenían desarrollo cuando se hizo el análisis.
  Los temas añadidos después (todo 4.A, y 4.B.1, 4.B.2 y 4.B.4 a 4.B.6) eran esqueletos sin modelos.
  Cuando se desarrollen, hay que rehacer `desarrollos.json` para que entren en el mapa.

## 4. Cómo actualizar los informes (con Claude Code, desde la carpeta TCEE)

Cuando una ficha diga *cambiado*, o se añada un modelo compartido nuevo, pídele a Claude Code: «actualiza los informes de armonización siguiendo `main/RELACIONES.md`». Claude Code hará esto:

1. `node main/scripts/armonizacion.js estado`: lista los modelos sin informe o con algún tema cambiado.
2. `node main/scripts/armonizacion.js preparar --pendientes`, o con nombres de modelo entre comillas.

   Escribe en `TCEE/.armonizacion/in/<modelo>.md` el LaTeX de los epígrafes de cada tema. Esa carpeta está fuera de los repositorios y no se sube.
3. Para cada modelo, escribir `TCEE/.armonizacion/out/<modelo>.json` siguiendo el **encargo del informe** (apartado 5).

   Con muchos modelos conviene repartirlos entre varios agentes en paralelo.
4. Reunir todas las divergencias que empiecen por «Posible error:» y encargar su revisión a agentes **distintos** de los que escribieron los informes (apartado 6).

   El resultado va en `TCEE/.armonizacion/verif_<n>.json`.
5. `node main/scripts/armonizacion.js unir`. Incorpora los informes a `analisis/armonizacion.json` con las huellas actuales y no toca los demás modelos.
6. Recargar el Panel Oposición. No hace falta reinstalar la extensión: el fichero se relee al cambiar.

## 5. Encargo del informe (para cada modelo)

Lee `TCEE/.armonizacion/in/<slug>.md`. Si hace falta más contexto, el tema completo está en `temario/Ejercicio-<E>/Parte-<P>/<código>/main.tex`. Escribe `TCEE/.armonizacion/out/<slug>.json`, un JSON válido en español con esta estructura:

```json
{
  "familia": "<nombre del modelo tal como aparece en el título del .md, sin '# Modelo: '>",
  "prioridad": "alta | media | baja",
  "motivo_prioridad": "1-2 frases. Alta = contradicciones o notaciones/ecuaciones incompatibles que pueden confundir en el examen; media = enfoques o profundidad muy desiguales; baja = coherente o diferencias justificadas por el tema.",
  "enfoque_comun": "2-3 frases: qué comparten las presentaciones",
  "divergencias": [
    { "aspecto": "enfoque | supuestos | ecuaciones | notacion | implicaciones | profundidad",
      "descripcion": "concreta, citando qué hace cada tema",
      "temas": ["3.A.5", "3.A.7"] }
  ],
  "propuesta": "3-6 frases: qué versión tomar de referencia y qué ajustar en cada tema, respetando que cada tema use el modelo para su propio fin",
  "referencia": "<código del tema con la presentación más completa y correcta>",
  "temas": {
    "<código>": {
      "epigrafe": "<número y título del epígrafe principal>",
      "papel": "1 frase: para qué usa el modelo este tema",
      "contexto": "1-2 frases",
      "supuestos": ["…"],
      "ecuaciones": [ { "tex": "<ecuación clave, LaTeX compatible con KaTeX>", "que": "qué representa" } ],
      "desarrollo": "2-4 frases con los pasos clave",
      "implicaciones": ["…"]
    }
  }
}
```

Reglas:
- **Ir al grano.** Es para comparar rápido: de 2 a 5 ecuaciones clave por tema.
- **LaTeX compatible con KaTeX.**
  - Nada de macros propias (`\eqblock`, `\authorfont`…) ni de tablas.
  - Se admiten `\frac`, `\dot`, `\hat`, `\tilde`, `\mathbb`, `\text`, `aligned` y `cases`.
  - Respetar la notación del tema.
  - Escapar las barras en JSON (`\\frac`).
- **Autores en MAYÚSCULAS.**
- **Temas sin desarrollo.** Si un tema no se localizó o solo menciona el modelo, se incluye igualmente: se explica en «papel» y los demás campos quedan vacíos.
- **Divergencias de fondo**, no de estilo.
- **No inventar.** Un error detectado (ecuación incorrecta, signo cambiado) se apunta como divergencia de aspecto «ecuaciones» y su descripción empieza por «Posible error:».
- **Comprobar que el JSON es válido** antes de terminar.
- **No modificar ningún otro fichero.**

## 6. Encargo de la verificación independiente

Cada posible error se identifica como `<slug>#<índice de la divergencia>`. El verificador recibe la lista `[{id, modelo, temas, descripcion}]` y hace esto:
- **Leer el tema.** Lee el tema en `temario/…/main.tex`, no el informe.
- **Comprobar la afirmación.** Con criterio de economista, decide si es cierta.
- **Escribir el veredicto.** Escribe `verif_<n>.json` como `[{ "id", "veredicto": "confirmado | dudoso | descartado", "linea": <línea del .tex donde está>, "nota": "1-2 frases" }]`.

Solo confirma si el error está en el texto y es un error, no una convención distinta pero válida.
