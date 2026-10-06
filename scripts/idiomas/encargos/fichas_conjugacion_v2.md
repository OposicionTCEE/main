# Encargo: rehacer las fichas de conjugación con formato propio (las tablas mandan)

El usuario ha elegido un diseño en el que la ficha muestra, por modos (Indicatif, Conditionnel, Subjonctif, Impératif), las tablas de
TODOS los tiempos del verbo modelo, simples y compuestos (présent, imparfait, passé simple, futur simple, passé composé, plus-que-parfait,
passé antérieur, futur antérieur, futur proche; conditionnel présent y passé; subjonctif présent, imparfait, passé, plus-que-parfait;
impératif présent y passé), con la raíz en gris y la terminación en color. LAS TABLAS LAS GENERA EL PANEL a partir de Verbiste:
tú solo escribes el poco texto que acompaña. Fuera: ejemplos, errores típicos, cifras («unos 300 verbos»), párrafos largos.

Reescribe (sobrescribe) los cinco ficheros `/home/claude/idiomas/fr/conjugacion/{grupo1,grupo2,grupo3,irregulares,compuestos}.json`
a partir de los actuales (léelos: tienen la información) con EXACTAMENTE este formato:

{
 "id": "fr.v.grupo2", "formato": "conjugacion", "titulo": "Les verbes du 2e groupe", "titulo_es": "Verbos del 2.º grupo (-ir con -iss-)", "nivel": "A1",
 "cabecera": ["Cómo reconocerlo: participio presente en «-issant» («finissant»); si no («partant», «dormant», «venant»), es del 3.er grupo.",
              "Raíz: infinitivo sin -ir: «finir» → «fin-», «choisir» → «chois-»; en las formas de nous, raíz larga «fin-iss-»."],
 "modelos": [ {"verbo": "finir"}, {"verbo": "choisir", "nota": "opcional: una línea sobre por qué se muestra"} ],
 "notas": { "fut": "Se forma sobre el infinitivo entero: finir → je finirai.", "cond": "También sobre el infinitivo entero." },
 "notas_finales": ["Participios: pasado = raíz + -i («fini», «choisi»); presente «finissant»."],
 "extra": [ {"titulo": "…", "tipo": "tabla", "cabecera": ["…"], "filas": [["…"]]}, {"titulo": "…", "tipo": "lista", "items": ["…"]} ]
}

Reglas:
- "cabecera": 2–4 viñetas MUY breves (máx. ~30 palabras cada una), solo lo general del grupo: cómo reconocerlo, cómo se saca la raíz,
  qué auxiliar usan en los compuestos (si hace falta). Lo que se escribe entre « » el panel lo pone en negrita (sin las comillas).
- "notas": claves de tiempo (pres, imp, ps, fut, pc, pqp, pant, fant, fproche, cond, condpasse, subj, subjimp, subjpasse, subjpqp, impe, impepasse);
  1–2 frases cada una, SOLO donde aporte una regla de formación (la nota aparece debajo de la tabla de ese tiempo). Máximo ~8 notas por ficha.
- "modelos": grupo1: aimer (y parler si quieres); grupo2: finir; grupo3: partir, rendre, recevoir (el panel muestra pestañas por modelo; 
  usa "nota" de una línea para decir qué familia representa cada uno); irregulares: être, avoir, aller, faire, dire, pouvoir, vouloir, savoir,
  devoir, venir, voir, prendre; compuestos: parler (avoir) y partir (être) — en esta ficha la cabecera y las notas tratan del auxiliar y de la concordancia.
- "extra": lo imprescindible que no cabe en las tablas, como bloques breves al final: grupo1 → tabla de cambios ortográficos (manger, placer, acheter,
  jeter, appeler, préférer, nettoyer/payer, envoyer) con [«Modelo», «Qué cambia», «Formas clave»]; grupo3 → tabla de familias con formas clave;
  compuestos → lista de verbos con être, verbos de doble auxiliar (con ejemplo corto), reglas de concordancia y pronominales, passé récent.
  irregulares → como mucho una lista breve de trucos.
- Las formas que cites deben coincidir con Verbiste (`/home/claude/encargos/verbos/`); pouvoir: participio «pu».
- Sin Markdown. Español de España. Valida que cada fichero es JSON válido. Responde solo con los ficheros escritos y dudas.
