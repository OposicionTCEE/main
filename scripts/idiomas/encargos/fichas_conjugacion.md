# Encargo: fichas de consulta de la conjugación francesa (Panel TCEE, entrenador de verbos)

Contexto: opositor español (TCEE) que estudia francés A1→C2. El panel tendrá un entrenador de conjugación (como Scholingua) y, a la
izquierda, fichas de consulta plegables «cómo se conjugan los verbos». Escribe CINCO fichas, en español, en
`/home/claude/idiomas/fr/conjugacion/<nombre>.json`:

| fichero | id | contenido |
|---|---|---|
| grupo1.json | fr.v.grupo1 | 1.er grupo (-er, salvo aller): modelo aimer; cambios ortográficos (manger, placer, acheter, jeter, appeler, préférer, nettoyer/payer, envoyer) |
| grupo2.json | fr.v.grupo2 | 2.º grupo (-ir con -issons): modelo finir; haïr |
| grupo3.json | fr.v.grupo3 | 3.er grupo: familias (-ir sin -iss-: partir/dormir/ouvrir/venir/tenir; -re: prendre/mettre/rendre/connaître/craindre/conduire; -oir: voir/recevoir/devoir/pouvoir/vouloir/valoir/falloir/pleuvoir) |
| irregulares.json | fr.v.irregulares | Los muy irregulares y frecuentes: être, avoir, aller, faire, dire, pouvoir, vouloir, savoir, devoir, venir, voir, prendre (tablas completas de los tiempos simples) |
| compuestos.json | fr.v.compuestos | Tiempos compuestos y perífrasis: auxiliar avoir/être (lista de verbos con être y verbos de doble auxiliar), pronominales, concordancia del participio, futur proche, passé récent |

Tiempos que deben aparecer (los del entrenador): Indicatif présent, imparfait, passé simple, futur simple, passé composé,
plus-que-parfait, futur proche, futur antérieur; Subjonctif présent, imparfait, passé, plus-que-parfait; Conditionnel présent, passé;
Impératif présent, passé. En grupo1/2/3, para CADA tiempo simple: cómo se forma (raíz + terminaciones) y una tabla
[«Persona», «Terminación», «Ejemplo»] con las 6 personas (3 en el imperativo). Los compuestos se explican en compuestos.json.

## Formato (igual que las fichas del panel, SIN ejercicios)
{
 "id": "fr.v.grupo1", "titulo": "Les verbes du 1er groupe", "titulo_es": "Verbos del 1.er grupo (-er)", "nivel": "A1",
 "descripcion_es": "una línea", "descripcion_larga_es": "40–70 palabras: qué abarca y por qué importa",
 "contexto": {"que_es": "...", "por_que_importa": "...", "cuando_se_usa": "..."},
 "resumen": "1–2 frases",
 "explicacion": [ {"tipo":"texto","texto":"..."}, {"tipo":"tabla","cabecera":["Persona","Terminación","Ejemplo"],"filas":[["je","-e","je parle"],...]}, {"tipo":"lista","items":["..."]} ],
 "ejemplos": [ {"frase":"...","traduccion":"..."} ],       // 6–10, frases naturales con varios tiempos
 "errores_hispanohablantes": [ {"mal":"...","bien":"...","nota":"..."} ],   // 4–8
 "fuente": {"nombre": "propia", "nota": "Tablas comprobadas con Verbiste (Pierre Sarrazin, GPL)"}
}
Antes de cada tabla de un tiempo, un bloque "texto" que empiece por el nombre del tiempo en francés y su equivalente español
(p. ej. «Imparfait (pretérito imperfecto): raíz de nous en presente + -ais, -ais, -ait…»), para que se pueda localizar.

## Comprobación obligatoria
Cada forma que escribas debe coincidir con Verbiste: `/home/claude/encargos/verbos/verbs-fr.json` ({infinitivo: {root, template}}) y
`/home/claude/encargos/verbos/conjugation-fr.json` ({template: {modo: {tiempo: [[persona, terminación]]}}}; forma = root + terminación).
Escribe un pequeño script en Python que conjugue con esos datos y compara tus tablas antes de terminar.
Sin Markdown dentro de los textos. Español de España, claro, como un buen profesor. Responde con la lista de ficheros y cualquier duda.
