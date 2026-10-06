# Encargo: escribir fichas del paquete de idiomas (Panel TCEE)

Contexto: un opositor español (Técnico Comercial y Economista del Estado) prepara inglés y francés. El panel enseña cada materia con una
"ficha": explicación breve EN ESPAÑOL, ejemplos en la lengua estudiada con traducción al español, errores típicos de hispanohablantes y
ejercicios de respuesta fija que el panel corrige automáticamente (comparando texto, sin inteligencia artificial). Cada repaso muestra
un subconjunto distinto de ejercicios, así que hace falta variedad.

Escribe UN fichero JSON por materia en `/home/claude/idiomas/<lengua>/fichas/<idcorto>.json`, donde `<idcorto>` es lo que va tras
`<lengua>.g.` o `<lengua>.l.` en el id (p. ej. id `en.g.present-perfect` → `/home/claude/idiomas/en/fichas/present-perfect.json`).
Lee primero `/home/claude/idiomas/<lengua>/materias.json` para ver título, nivel y descripción de cada id que te toca.

## Formato exacto (UTF-8, JSON válido)
{
 "id": "en.g.present-perfect",                  // igual que en materias.json
 "titulo": "Present perfect",                    // igual que en materias.json
 "titulo_es": "Present perfect (pretérito perfecto)",  // título para un hispanohablante; conserva el término técnico habitual
 "descripcion_es": "Experiencias y resultados presentes; just, already, yet, ever, never.",   // una línea en español
 "nivel": "A2",                                  // igual que en materias.json
 "resumen": "Una o dos frases en español: qué es y cuándo se usa.",
 "explicacion": [                                // 3–8 bloques, en español, claro y breve (una pantalla), con ejemplos cortos dentro si ayuda
   {"tipo": "texto", "texto": "..."},
   {"tipo": "tabla", "cabecera": ["Forma", "Ejemplo"], "filas": [["...", "..."]]},
   {"tipo": "lista", "items": ["...", "..."]}
 ],
 "ejemplos": [ {"frase": "I have lived here since 2015.", "traduccion": "Vivo aquí desde 2015."} ],   // 4–8
 "errores_hispanohablantes": [ {"mal": "I live here since 2015.", "bien": "I have lived here since 2015.", "nota": "Con since/for se usa present perfect, no presente."} ],  // 2–4
 "ejercicios": [ … 12–16 ejercicios … ],
 "fuente": {"nombre": "propia"}
}

## Ejercicios (12–16 por ficha, mezcla al menos 3 tipos; todos con una respuesta comprobable)
- "hueco": {"id":"e01","tipo":"hueco","enunciado":"Completa con el verbo en la forma correcta.","frase":"She ___ (live) in Paris since 2019.","respuestas":["has lived","'s lived"],"explicacion":"…"}
   · exactamente UN "___" por frase; pista entre paréntesis si hace falta; en "respuestas" TODAS las variantes correctas (contracciones incluidas).
- "eleccion": {"id":"e02","tipo":"eleccion","enunciado":"Elige la opción correcta.","frase":"I ___ him yesterday.","opciones":["have seen","saw","see"],"respuestas":["saw"],"explicacion":"…"}
   · 3–4 opciones plausibles; la respuesta debe estar escrita exactamente igual que en opciones.
- "transformar": {"id":"e03","tipo":"transformar","enunciado":"Pasa la frase a pasiva.","frase":"They built the bridge in 1990.","respuestas":["The bridge was built in 1990.","The bridge was built in 1990 by them."],"explicacion":"…"}
   · solo transformaciones con pocas soluciones posibles; enumera todas las correctas razonables.
- "corregir": {"id":"e04","tipo":"corregir","enunciado":"Corrige el error.","frase":"He don't like coffee.","respuestas":["He doesn't like coffee.","He does not like coffee."],"explicacion":"…"}
   · la frase tiene exactamente un error; respuestas = la frase corregida completa.
- "ordenar": {"id":"e05","tipo":"ordenar","enunciado":"Ordena las palabras.","palabras":["never","I","have","been","to","Japan"],"respuestas":["I have never been to Japan"],"explicacion":"…"}
   · "palabras" son exactamente las palabras de la respuesta, desordenadas, sin puntuación.
- "explicacion" de cada ejercicio: una frase en español que diga por qué.
- ids "e01", "e02"… únicos dentro de la ficha.

## Fichas de LÉXICO (ids con .l.)
- La explicación incluye 1–3 "tabla" con el vocabulario o las expresiones de la materia: columnas como ["Expresión", "Significado", "Ejemplo"].
  Unas 20–40 entradas útiles y frecuentes del nivel indicado (para niveles altos, registro culto y de prensa; para el opositor, útil en
  resúmenes, exposiciones orales y debates). Las funciones (conectores, opinar, matizar, exposición, debate…) se organizan por función.
- Ejercicios: huecos y elección con esas palabras en contexto; algún "corregir" con falsos amigos o colocaciones mal hechas.

## Reglas de calidad
- Todo correcto lingüísticamente (revisa cada respuesta dos veces: los ejercicios mal resueltos son lo peor que puede pasar).
- Explicaciones y traducciones en español de España. Frases de ejemplo naturales y variadas en temas (no todo economía).
- Nivel acorde a la ficha: A1 con frases muy sencillas; C1–C2 con registro culto.
- Contenido ORIGINAL: no copies texto de libros, webs ni del Core Inventory/Inventaire (solo sirven de índice).
- Sin Markdown dentro de los textos (nada de ** ni #); comillas tipográficas « » o “ ” solo dentro de cadenas.
- Al terminar ejecuta: `python3 /home/claude/main/scripts/idiomas/validar_fichas.py /home/claude/idiomas <lengua>` y corrige hasta que tus
  fichas no den errores (ignora errores de fichas que no son tuyas). No toques ficheros de otras materias.
- Responde al final solo con: número de fichas escritas y cualquier duda lingüística que haya quedado.
