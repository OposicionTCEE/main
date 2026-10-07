# Encargo: tareas de escritura, preguntas generales del tribunal y banco de expresiones (fase 2–3 de Idiomas)

Contexto: ver `encargos/textos.md` (examen de idiomas de la oposición TCEE: resumen escrito de un texto leído o escuchado; oral con
lectura, exposición y preguntas del tribunal). Usuario hispanohablante, de B1 a C1. Escribe tres ficheros para la lengua `<l>` (fr | en),
todo en la lengua estudiada salvo los campos `_es` y las explicaciones, que van en castellano. JSON válido, sin Markdown dentro de los valores.

## 1. `<l>/escritura.json`
```json
{"tareas": [{
  "id": "en.w.opinion-teletrabajo",          // estable: <l>.w.<tipo>-<tema>
  "tipo": "opinion",                        // opinion | carta | correo | replica | informe | propuesta | critica | nota
  "nivel": "B2",
  "titulo_es": "…",
  "enunciado": "…",                         // consigna completa en la lengua estudiada, como en un examen (situación, destinatario, qué hacer)
  "palabras": [180, 250],
  "registro": "formal",                     // formal | neutro | informal
  "campo": "empresa y trabajo",             // misma lista de campos que en textos.md
  "estructura": ["…"],                      // 3–6 pasos en castellano (qué va en cada parte)
  "expresiones": ["…"],                     // 6–10 expresiones útiles para ESTA tarea, en la lengua estudiada
  "modelo": "…"                             // texto modelo completo (nivel C1), dentro del rango de palabras
}]}
```
- 24–30 tareas, repartidas: opinion 8 (temas económicos y de actualidad: inflación, comercio, UE, empleo, vivienda, energía, IA, turismo…),
  carta 3, correo 4, replica 3 (responder a una tribuna con la que no se está de acuerdo: el enunciado resume la tribuna en 3–4 frases),
  informe 3, propuesta 2, critica 2, nota 2. Niveles: unas 6 de B1, 10 de B2, 10 de C1, 2–4 de C2.
- Los resúmenes NO van aquí: el panel los genera a partir de la biblioteca de textos.

## 2. `<l>/tribunal.json`
```json
{"preguntas": [{"id": "en.tr.presentacion-01", "bloque": "presentacion", "nivel": "B1", "pregunta": "…", "pista_es": "…", "ideas": ["…"],
                "repreguntas": ["…"]}]}
```
- 50–60 preguntas, como las que hace un tribunal de oposición tras la exposición. Bloques: presentacion (quién eres, formación, por qué TCEE),
  motivacion, economia (coyuntura, política monetaria y fiscal), comercio (comercio exterior, aranceles, internacionalización de la empresa
  española, red de Oficinas Económicas y Comerciales), europa (UE, euro, mercado único), actualidad (energía, clima, IA, demografía, vivienda),
  espana (economía española, turismo, regiones), opinion (dilemas: «¿debería…?»), cultura (países de la lengua estudiada).
- `pista_es`: qué se espera, en castellano. `ideas`: 2–4 ideas posibles (lengua estudiada). `repreguntas`: 1–2 preguntas de seguimiento.
- Sin datos inventados ni nombres de cargos actuales (cambian): pregunta por conceptos, tendencias y opiniones.

## 3. `<l>/expresiones.json`
```json
{"funciones": [{"id": "introducir", "titulo_es": "Introducir el tema", "uso_es": "…", "expresiones": [{"texto": "…", "registro": "formal", "nota_es": ""}]}]}
```
- Funciones (en este orden): introducir, presentar-el-texto (para el resumen y la exposición: «The article deals with…»), resumir-ideas,
  enumerar-ordenar, anadir, contraponer, conceder, causa, consecuencia, ejemplificar, matizar, opinar, expresar-acuerdo, expresar-desacuerdo,
  hipotesis, reformular, concluir, ganar-tiempo (en el oral: «That's an interesting question…»), pedir-aclaracion (al tribunal), cerrar-exposicion.
- 6–12 expresiones por función, de B1 a C2, con `registro` (formal | neutro | informal) y `nota_es` solo si hace falta (uso, falso amigo,
  construcción que exige: subjuntivo, gerundio…).
