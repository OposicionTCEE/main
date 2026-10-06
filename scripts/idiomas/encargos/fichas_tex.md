# Encargo: fichas de gramática francesa a partir de Tex's French Grammar (Panel TCEE, pestaña Idiomas)

Lee primero /home/claude/encargos/fichas_comun.md: el FORMATO de la ficha, los tipos de ejercicio y las reglas de calidad son los mismos,
con estas diferencias:

1. Fuente principal: "Tex's French Grammar" (COERLL, Universidad de Texas en Austin), licencia CC BY 3.0, que SÍ se puede adaptar citándola.
   El texto de cada página está en /home/claude/fuentes/tex_txt/<pagina>.txt (ignora el menú de navegación del principio).
   Las páginas de cada materia están en /home/claude/idiomas/fr/materias.json → materias[i].fuente.paginas.
   Adapta las explicaciones AL ESPAÑOL (Tex está en inglés): tradúcelas y resúmelas para un hispanohablante, añadiendo lo que haga falta
   comparando con el español. Puedes usar las frases de los diálogos de Tex como ejemplos (traduciendo al español).
2. Frases reales para ejercicios: en /home/claude/fuentes/candidatos/fr/<idcorto>.tsv hay hasta 40 frases de Tatoeba (CC BY 2.0 FR)
   con su traducción al español (columnas: id, frase, traducción). Úsalas como base de al menos la mitad de los ejercicios (huecos, elección,
   transformar, corregir, ordenar) siempre que sirvan para ESA materia; si una frase no es adecuada (tema desagradable, violento, sexual,
   demasiado coloquial o mal escrita), no la uses. Si no hay suficientes buenas, escribe frases propias. En los ejercicios basados en Tatoeba
   añade el campo "origen": "tatoeba:<id>".
3. "fuente" de la ficha:
   {"nombre": "Tex's French Grammar", "autores": "COERLL, Universidad de Texas en Austin", "licencia": "CC BY 3.0",
    "url": "https://laits.utexas.edu/tex/gr/<primera página>.html", "otras": ["Frases de Tatoeba (CC BY 2.0 FR)"]}
   (quita "otras" si no usas ninguna frase de Tatoeba).
4. 12–16 ejercicios, explicaciones en español, ejemplos y ejercicios en francés.

Escribe en /home/claude/idiomas/fr/fichas/<idcorto>.json una ficha por id de tu lista, valida con
`python3 /home/claude/main/scripts/idiomas/validar_fichas.py /home/claude/idiomas fr` y corrige tus fichas hasta que no den errores.
Responde solo con el número de fichas y las dudas lingüísticas que queden.
