# Encargo: pestaña «Compuestos, doble auxiliar y perífrasis» del entrenador de verbos (francés)

Reescribe `/home/claude/idiomas/fr/conjugacion/compuestos.json` (léelo: tiene información útil) con ESTE formato. No hay cabecera ni
descripción general, ni tablas de conjugación de un verbo concreto: el objetivo es EXPLICAR, de forma clara, ordenada y breve, tres cosas,
cada una en su subpestaña.

{
 "id": "fr.v.compuestos", "formato": "particularidades", "titulo": "Compuestos, doble auxiliar y perífrasis", "titulo_es": "Particularidades",
 "subpestanas": [
  {"id": "compuestos", "titulo": "Tiempos compuestos", "bloques": [ … ]},
  {"id": "doble", "titulo": "Doble auxiliar", "bloques": [ … ]},
  {"id": "perifrasis", "titulo": "Perífrasis verbales", "bloques": [ … ]}
 ]
}
Bloques: {"tipo": "texto", "titulo": "opcional", "texto": "…"} · {"tipo": "tabla", "titulo": "opcional", "cabecera": […], "filas": [[…]]} ·
{"tipo": "lista", "titulo": "opcional", "items": […]}. Texto entre « » sale en negrita (sin las comillas). Sin Markdown. Español de España.

1. Tiempos compuestos: qué son (auxiliar avoir/être en un tiempo simple + participio pasado; el tiempo del auxiliar decide el compuesto);
   tabla [«Tiempo compuesto», «Auxiliar en…», «Con avoir», «Con être», «En español»] con passé composé, plus-que-parfait, passé antérieur,
   futur antérieur, conditionnel passé, subjonctif passé, subjonctif plus-que-parfait, impératif passé (ejemplos cortos con je/il: «j'ai parlé» /
   «je suis parti(e)»); cuándo se usa être (los ~20 verbos de movimiento o cambio de estado, con una regla mnemotécnica, y todos los pronominales);
   concordancia del participio (con être, con el sujeto; con avoir, con el complemento directo antepuesto; pronominales) en una lista breve con ejemplos.
2. Doble auxiliar: qué significa (monter, descendre, sortir, rentrer, passer, retourner admiten être sin complemento directo y avoir con complemento
   directo, cambiando el sentido); tabla [«Verbo», «Con être (sin CD)», «Con avoir (+ CD)»] con ejemplo y traducción en cada celda; nota sobre
   concordancia en cada caso; otros casos (apparaître, demeurer…) si son claros.
3. Perífrasis verbales: qué son (verbo auxiliar conjugado + infinitivo que expresa tiempo o aspecto; no son tiempos); tabla
   [«Perífrasis», «Forma», «Significado», «Ejemplo», «En español»] con futur proche (aller + inf.), passé récent (venir de + inf.),
   être en train de + inf., être sur le point de + inf., aller / venir de en imparfait (futur proche y passé récent en el pasado),
   se mettre à, commencer à / finir de si quieres (máximo 8 filas); notas breves: de → d' ante vocal, pronombres delante del infinitivo
   («je vais le faire»), diferencia futur proche / futur simple.
Todas las formas deben ser correctas (comprueba conjugaciones con `/home/claude/encargos/verbos/`). JSON válido. Responde solo con dudas.
