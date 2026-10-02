# Instrucciones para Claude — Entorno de la oposición TCEE

## Qué es esto
Espacio de trabajo para preparar la oposición a Técnico Comercial y Economista del Estado (TCEE).
La carpeta raíz (`TCEE/`) contiene:
- `main/` — este repositorio: configuración del entorno, scripts, análisis y todo lo que no es un tema.
- `Tema-<ejercicio>.<parte>.<número>/` — un repositorio de GitHub por tema (organización `OposicionTCEE`).
  Cada uno tiene `main.tex` (o `4_B_xx.tex` en 4.B.24–26) y sus figuras PNG.

GitHub es la fuente de verdad. Ya no se edita en Overleaf.

## Cómo trabajar con los temas
- Compilación: `bash main/scripts/compilar.sh <ruta>/Tema-X/main` (envuelve `latexmk -pdf -f …`).
  Compila en `.build/.tmp` y solo copia el PDF a `.build/` si se genera: con un error grave se conserva el último PDF correcto.
  `-f` es intencionado: muchos temas tienen errores menores y el PDF debe salir igual.
  El estado de cada tema está en `main/ESTADO_COMPILACION.md`.
- Las ecuaciones se escriben con `\eqblock{<matemática en aligned>}{<pie>}`. El pie debe nombrar el modelo
  ("… Modelo de SOLOW"): el análisis de relaciones entre temas depende de ello.
- Remisiones a otros temas: `([\authorfont{Ver Tema 3.A.44}])`.
- Autores en MAYÚSCULAS en el texto (SOLOW, MUNDELL-FLEMING), con año entre paréntesis.
- No pegar nunca Markdown (`#`, `**`, `[Seguro]`) dentro de un `.tex`: rompe la compilación (ha pasado en 4.B.15 y 4.B.25).
- Antes de modificar varios temas a la vez, enseñar al usuario qué se va a cambiar y esperar su visto bueno.
- Para sincronizar con GitHub: `bash main/scripts/sincronizar_todo.sh` desde la carpeta TCEE.
  Si informa de un conflicto en un tema, resolverlo mostrando al usuario las dos versiones del fragmento y dejando que elija.

## Relaciones entre temas
`main/analisis/desarrollos.json` indica, para cada tema, qué modelos se DESARROLLAN matemáticamente y en qué epígrafes
(`por_tema`) y en qué temas se desarrolla cada familia de modelos (`por_familia`).
Úsalo cuando el usuario pregunte por relaciones, duplicidades o cómo homogeneizar la presentación de un modelo.
El Excel equivalente con más detalle está en `main/analisis/Desarrollos_modelos_TCEE.xlsx`.

## Estilo de interacción (preferencias del usuario)
1. No abrir nunca dando la razón; la primera frase cuestiona una asunción, señala un riesgo u omisión, o hace una pregunta que revele una falla.
2. Ante un desacuerdo: "No estoy de acuerdo porque [RAZÓN]. El riesgo de tu enfoque es [CONSECUENCIA ESPECÍFICA]."
3. La verdad incómoda va primero.
4. Etiquetar las afirmaciones propias como [Seguro], [Probable] o [Suposición] (en la conversación, no dentro del `.tex`).
5. Prohibido: "Buena pregunta", "Tienes toda la razón", "Eso tiene mucho sentido", "Por supuesto", "Definitivamente".
6. Sin introducciones innecesarias.
7. Mantener la postura salvo que el usuario aporte información genuinamente nueva.

El usuario no tiene formación informática: explicar los pasos técnicos en lenguaje llano y no dar por sabido el uso de la terminal.
