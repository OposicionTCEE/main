# Encargo: enriquecer fichas del paquete de idiomas (explicaciones de cada ejercicio y contexto de la ficha)

Contexto: un opositor español (Técnico Comercial y Economista del Estado) estudia inglés y francés con un panel que corrige ejercicios
de respuesta fija. Tras cada respuesta el panel enseña una explicación. Hoy son de una línea («Pasiva: be + participio.») y el usuario
pide que sean CLARAS Y COMPLETAS, NO ESQUEMÁTICAS: por qué lo correcto es correcto, por qué lo suyo está mal, qué regla de la ficha se
aplica y, en léxico, qué significa cada palabra. Además, cada ficha necesita una descripción más amplia (qué es, por qué importa, cuándo se usa).

NO cambies las fichas. Para cada ficha que te toca, LEE la ficha `/home/claude/idiomas/<l>/fichas/<idcorto>.json` (explicación,
ejemplos, errores típicos, ejercicios con sus respuestas) y escribe UN fichero `/home/claude/encargos/enriq/<l>/<idcorto>.json`:

{
 "id": "fr.g.pc-pronominales",
 "descripcion_larga_es": "40–70 palabras en español: qué es, para qué sirve y por qué importa al aprender la lengua (y, si procede, por qué cuesta a un hispanohablante).",
 "descripcion_larga_l": "Lo mismo, 40–70 palabras, en la lengua estudiada (francés o inglés), con vocabulario accesible para el nivel de la ficha +1.",
 "contexto": {
   "que_es": "2–4 frases en español: definición clara de la materia.",
   "por_que_importa": "2–4 frases: para qué sirve en la comunicación real, frecuencia, qué pasa si se usa mal (malentendidos, registro), relevancia en un examen oral o escrito.",
   "cuando_se_usa": "2–4 frases: situaciones típicas, señales que lo piden (palabras clave, tipo de texto), contraste con lo que haría un hispanohablante."
 },
 "ejercicios": {
   "e01": {
     "traduccion": "Traducción al español de la frase correcta completa (con el hueco resuelto). Para ordenar/transformar/corregir, de la respuesta.",
     "explicacion": "3–6 frases en español, en prosa (no telegráfica). 1) Qué regla de la ficha se aplica, nombrándola como en la ficha (p. ej. «la regla de concordancia del participio con el sujeto que ves en Reglas y claves»). 2) Qué pista de ESTA frase lo indica (sujeto, marcador temporal, preposición, registro…). 3) Por qué la respuesta correcta cumple la regla, mostrando la forma (p. ej. «vous + êtes + trompés: participio en masculino plural»). 4) Si hay más de una respuesta válida, por qué todas valen. En léxico: significado preciso de la palabra o expresión clave y matiz frente a sus parecidas.",
     "por_opcion": { "opción exacta": "1–3 frases: por qué esa opción es correcta o incorrecta en ESTA frase; en léxico, qué significa esa palabra y en qué contexto sí se usaría." },
     "errores_previstos": [ { "respuesta": "error típico tal como lo escribiría un alumno", "explicacion": "1–3 frases: por qué está mal y qué regla incumple." } ],
     "glosario": [ { "palabra": "se tromper", "significado": "equivocarse" } ]
   }
 }
}

Reglas por tipo de ejercicio:
- "eleccion": "por_opcion" OBLIGATORIO y con TODAS las opciones, con la clave escrita exactamente igual que en "opciones". Ahora el usuario
  ESCRIBE la respuesta (las opciones se le muestran como pista), así que no hace falta "errores_previstos" salvo errores de escritura frecuentes.
- "hueco", "transformar", "corregir", "ordenar": "errores_previstos" con 1–3 errores verosímiles (los que cometería un hispanohablante:
  calco del español, auxiliar equivocado, concordancia olvidada, preposición calcada, orden de palabras…). En "corregir", el primero
  debe ser dejar la frase sin corregir (copiar la frase tal cual). En "ordenar", el orden calcado del español si lo hay.
  Cada "respuesta" prevista debe ser INCORRECTA: no puede coincidir con ninguna de "respuestas" (ni con diferencias solo de mayúsculas/puntuación).
- "glosario": OBLIGATORIO en fichas de léxico (ids con .l.): la palabra o expresión trabajada y las palabras de la frase que pueden no conocerse
  al nivel de la ficha. En gramática, solo si la frase tiene palabras poco frecuentes para el nivel (si no, omítelo).
- Hazlo para TODOS los ejercicios de la ficha (todos los ids).

Calidad:
- Todo en español de España salvo "descripcion_larga_l" y las palabras citadas. Prosa clara, como un buen profesor particular.
- Exactitud lingüística ante todo: si una opción es discutible (norma frente a uso), dilo («en la lengua hablada se oye…, pero la norma…»).
- Si la ficha procede de Tex's French Grammar, puedes apoyarte en `/home/claude/fuentes/tex_txt/<página>.txt` (páginas en "fuente"/materias.json),
  sin copiar frases literales largas. Para inglés, el nivel lo fija el Core Inventory; no copies su texto.
- Sin Markdown (nada de ** ni #). Comillas « » para citar.
- No inventes reglas que contradigan la ficha; si detectas un ERROR en la ficha o en las respuestas aceptadas, NO lo corrijas: anótalo en tu respuesta final.
- Al terminar cada fichero ejecuta `node /home/claude/main/scripts/idiomas/validar_enriq.js <l> <idcorto>` y corrige hasta 0 problemas.
- Responde al final SOLO con: fichas hechas y lista de posibles errores detectados en las fichas originales (id, ejercicio, problema).
