# Encargo: material de cada texto de la biblioteca (fase 2 de Idiomas)

Contexto: Panel de preparación del ejercicio de idiomas de la oposición a Técnico Comercial y Economista del Estado (TCEE).
En el examen real (BOE-A-2025-26902): **a)** se lee en voz alta a los candidatos un texto (hasta 15 minutos), toman notas y escriben un
**resumen** en ese idioma (90 minutos, con diccionario); **b)** oral: 10 minutos de preparación de otro texto, lectura en voz alta,
**exposición** sobre él (unos 10 minutos) y **preguntas del tribunal**. El usuario es hispanohablante y practica tanto «leer y resumir»
como «escuchar y resumir»; ambas cosas tienen la misma importancia.

Recibes varios ficheros `<l>/textos/<nombre>.json` con `id`, `lengua` (fr | en), `titulo`, `tipo`, `fuente`, `palabras`, `nivel_lexico`
(calculado con FLELex/EFLLex: orientativo) y `parrafos` (lista; el índice 0 es el primer párrafo). **No cambies `parrafos`** ni ningún campo
existente. Para cada texto escribe un fichero `<salida>/<id>.json` SOLO con los campos nuevos de abajo (se unirán después con un programa).

## Campos que escribes

```json
{
 "id": "en.t.voa-…",                       // igual que el del texto
 "titulo_es": "…",                          // traducción natural del título
 "resumen_es": "…",                         // 1–2 frases en castellano: de qué trata (va en la tarjeta)
 "campo": "economía",                       // UNO de la lista de campos
 "palabras_clave": ["…"],                   // 4–8, en la lengua del texto
 "nivel": "B2",                             // nivel MCER final (A2…C2): parte de nivel_lexico y corrígelo con tu criterio
 "nivel_motivo": "…",                       // 1 frase en castellano si cambias nivel_lexico; si no, ""
 "ideas_clave": [ {"parrafos": [0, 1], "idea": "…"} ],
 "resumen_modelo": "…",
 "preguntas": [ … ],
 "tribunal": [ {"pregunta": "…", "pista_es": "…", "ideas": ["…"]} ],
 "glosario": [ {"palabra": "…", "parrafo": 3, "significado": "…", "nota": "…"} ]
}
```

Campos (`campo`): economía · empresa y trabajo · finanzas · comercio internacional · Europa e instituciones · política y sociedad ·
medio ambiente y energía · ciencia y tecnología · salud · educación · cultura y arte · historia · geografía y viajes · deporte · vida cotidiana.

### `ideas_clave` (la base para corregir los resúmenes)
- En la **lengua del texto**, una frase cada una, con sus propias palabras (no copies frases del texto).
- Cubren TODO el texto en orden; cada idea dice de qué párrafos sale (`parrafos`). Todos los párrafos deben estar en alguna idea.
- Entre 1 idea por cada 1–2 párrafos (textos cortos) y 1 por cada 2–3 párrafos (largos). Mínimo 4, máximo 16.
- Marca las imprescindibles poniendo `"principal": true` (las que un buen resumen no puede omitir): entre un tercio y la mitad.

### `resumen_modelo`
- En la lengua del texto; registro formal; conectores variados; sin copiar frases enteras; tercera persona («The text explains…» / «L'auteur…»
  solo una vez al principio, como se hace en el examen).
- Extensión: alrededor del 20–25 % del texto (mínimo 80 palabras, máximo 300).
- Debe ser un resumen que un tribunal de C1 calificaría como excelente: es el que el panel enseña como modelo.

### `preguntas` (10–16; todas llevan `parrafo` = índice del párrafo donde está la respuesta)
Tipos (no uses otros):
- `vf`: afirmación en la lengua del texto; `respuestas`: ["V"], ["F"] o ["ND"] (no se dice). Incluye 3–5, con al menos una F y, si cabe, una ND.
  Las F deben ser plausibles (un detalle cambiado, no un disparate).
- `eleccion`: pregunta en la lengua del texto y 3–4 `opciones` (en la lengua del texto); `respuestas`: [la opción correcta, copiada exacta].
  Una sola correcta, distractores plausibles. 3–5 preguntas.
- `vocabulario`: «Busca en el párrafo N una palabra o expresión que signifique «…»» (enunciado en castellano, significado en castellano o con un
  sinónimo en la lengua del texto); `respuestas`: la forma EXACTA que aparece en el texto (y variantes razonables: singular/plural si el texto
  lo permite). 2–4 preguntas.
- `abierta`: pregunta de comprensión global o de inferencia en la lengua del texto; `respuestas`: [respuesta modelo de 1–3 frases].
  Se corrige con el modelo local frente a esa respuesta modelo; si no está instalado, el usuario se autoevalúa. 2–3 preguntas.
Campos de cada pregunta: `id` ("p01"…), `tipo`, `parrafo`, `enunciado` (instrucción breve en castellano), `pregunta` (en la lengua del texto),
`opciones` (solo eleccion), `respuestas`, `cita` (fragmento LITERAL del texto que justifica la respuesta, máx. 30 palabras; en ND, "") y
`explicacion` (2–3 frases en castellano: por qué es esa la respuesta y, en eleccion/vf, por qué no las otras).
Reparte las preguntas por todo el texto (no todas del principio). Con textos de más de 12 párrafos, al menos una pregunta cada 2–3 párrafos,
para que las preguntas sirvan también cuando el usuario elige solo una parte del texto.

### `tribunal` (6–8 preguntas, como las que haría un tribunal tras la exposición)
- En la lengua del texto; de más sencilla (comprensión) a más exigente (opinión, relación con España/UE, economía, política comercial).
- `pista_es`: qué se espera, en castellano, 1 frase. `ideas`: 2–4 ideas que una buena respuesta podría tocar (en la lengua del texto).

### `glosario` (8–20 entradas)
- Palabras o expresiones de nivel B2 o superior, términos técnicos y falsos amigos que aparezcan en el texto (forma exacta del texto).
- `significado` en castellano, breve y en contexto. `nota` solo si aporta algo (falso amigo, registro, colocación); si no, "".

## Calidad
- Todo lo que afirmes debe estar en el texto (o, en ND, claramente no estar). Comprueba cada `cita` contra el texto: debe ser literal.
- No inventes datos. No uses Markdown dentro de los valores.
- JSON válido (UTF-8, comillas tipográficas permitidas dentro del texto). Comprueba que se puede leer con `python3 -c "import json;json.load(open(f))"`.
- Si un texto no sirve (vacío, lista, plantilla, demasiado técnico o desordenado), no escribas su fichero y explícalo al final de tu respuesta.
