# Pestaña Idiomas (Panel Oposición)

Gadget para preparar el ejercicio de idiomas de la oposición: inglés obligatorio y un segundo idioma (al principio, francés).
Es una **academia continua**, no una copia de la estructura del examen. Cubre **de A1 a C2**: un usuario puede dominar cosas de B2 y no saber algunas de A2.

Mantener este documento y el código a la vez.

## Decisiones (octubre de 2026, con el usuario)

- **Sin «definir el nivel» a mano.** La primera vez se crea un **perfil**: nombre, segundo idioma y nivel orientativo de cada idioma.
  El panel ajusta el nivel con lo que observa y avisa cuando cree que el real es otro.
- **Datos del usuario solo en local**, en `TCEE/idiomas-<nombre>/`, fuera de los repositorios: progreso, errores, escritos y grabaciones.
- **Contenido** en el repositorio público `idiomas` (`TCEE/idiomas`). Solo se descarga, nunca se sube: lo hacen *Sincronizar* y la tarea
  *Descargar o actualizar el paquete de idiomas* (`scripts/idiomas/descargar_paquete.sh`). Si hay cambios locales en el paquete, se apartan con `git stash`.
- **Compromiso flexible**: reglas sueltas y opcionales del tipo «francés, cada día, 30 min», «inglés, 1 vez por semana, sin duración»
  o «francés, cada 2 semanas el martes, 60 min». Siempre está el botón *Empezar sesión ahora*. Nunca bloquea nada.
- **Sesiones a elección**: Gramática, Léxico, Escrito, Oral, Escucha, Al azar, Tipo examen y Repaso.
  En la sesión tipo examen, el usuario **lee en voz alta su propio resumen**.
- **Sin tarjetas sueltas.** Se repasan **fichas enteras** (cada repaso, ejercicios distintos), con el calendario de repaso de ts-fsrs.
  Hay un **cuaderno de errores** (cada error, vinculado a su ficha) y un **banco de expresiones por función**.
- **Todo dentro del panel**, también la escritura, y **sin corrector mientras se escribe**: la corrección llega al enviar.
- **Reutilizar antes que generar.** Se reutiliza todo el material abierto que se pueda, citándolo, y Claude escribe solo los huecos.
  Claude no se usa en cada sesión: el material se prepara de antemano y la corrección abierta la hace un **modelo local**.
  El Mac del usuario tiene 8 GB de RAM: modelo pequeño (≈2–3 GB) con Ollama, y una tarea pesada cada vez.
- **Temas variados**, no solo economía. Cada texto lleva su campo semántico y el panel los rota.
- **Longitud flexible**: corto (≈150 palabras), estándar (≈400, por defecto), largo (≈800+) o a medida, cortando siempre por párrafos.
- **Tareas de escritura variadas** con plantillas (resumen, opinión, carta, correo, réplica, nota…) y una **rúbrica** fija:
  cumplimiento de la tarea, coherencia, registro, corrección y vocabulario.
- **Medios de pago**: solo los enlaces que el usuario ponga en Ajustes. Descarga semanal desde su navegador, con su sesión iniciada;
  se borran al renovarse y nunca salen del Mac. El riesgo frente a las condiciones de uso de cada medio lo asume el usuario.
- **Vídeo**: canales públicos (BBC, France 24, Arte, TV5Monde, VOA), incrustados o abiertos en el navegador; nunca se descargan,
  salvo VOA, que es de dominio público.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Repositorio `idiomas`, este documento, *Sincronizar* lo descarga, descarga de fuentes en el Mac | Hecha (6/10/2026) |
| 1 | Perfil, Ajustes, compromisos; índice A1→C2; fichas de gramática y ejercicios con respuesta fija; léxico; sesiones Gramática, Léxico, Repaso y Al azar; mapa de materias, cuaderno de errores, repaso y primer ajuste de nivel | Hecha (v0.30) |
| 2 | Biblioteca de textos (nivel, tema, palabras clave), longitud flexible, Escucha (voz del Mac), Escrito (plantillas y rúbrica, LanguageTool y modelo local), instalador de Ollama | Pendiente |
| 3 | Oral (whisper, métricas), tribunal (preguntas con voz), sesión tipo examen, vídeo | Pendiente |
| 4 | Descarga semanal de medios de pago; informe de progreso opcional en «Rehacer informes» | Pendiente |

## Fuentes y licencias

Solo se **copian** al repositorio `idiomas` fuentes con licencia abierta, citando la autoría.
Las webs gratuitas pero con todos los derechos reservados (TV5Monde, BBC Learning English, RFI…) solo se **enlazan**.

| Fuente | Uso | Licencia |
|---|---|---|
| Tex's French Grammar (COERLL, Universidad de Texas) | Explicaciones y ejercicios de gramática francesa A1–B1 | CC BY 3.0 |
| Tatoeba | Frases reales con traducción (y algunos audios) para ejercicios | CC BY 2.0 FR; audios según su autor (solo los libres) |
| EFLLex / FLELex (CENTAL, UCLouvain) | Nivel del Marco Europeo de cada palabra | CC BY-NC-SA 4.0 |
| ipa-dict (open-dict-data) | Pronunciación de cada palabra (AFI) | MIT |
| mlconjug3 | Tablas de conjugación | MIT |
| wordfreq | Frecuencia de las palabras | Datos CC BY-SA 4.0 |
| Core Inventory for General English (British Council–EAQUALS) | Solo como índice de materias (no se copia el texto) | © British Council |
| Inventaire linguistique des contenus clés (Eaquals–CIEP) | Solo como índice de materias (no se copia el texto) | © Eaquals/CIEP |
| VOA Learning English | Textos y audios en inglés (fase 2) | Dominio público |
| Wikipedia, Wikinews, Vikidia, Wikisource | Textos de todos los temas (fase 2) | CC BY-SA / dominio público |

El entorno de Claude no llega a la mayoría de estas webs. Por eso `scripts/idiomas/descargar_fuentes.sh`
las baja en el Mac a `TCEE/.fuentes-idiomas/` (fuera de GitHub). Ya no hay tarea de VS Code para ello (se quitó el 6/10/2026 por ser auxiliar):
cuando una fase necesite fuentes nuevas, Claude amplía el script y lo ejecuta o vuelve a añadir la tarea solo mientras haga falta.
Re-ejecutarlo es inofensivo: no toca nada fuera de `.fuentes-idiomas/` y salta lo ya descargado.
Claude las recoge desde ahí, fabrica el paquete con los programas de `scripts/idiomas/` y lo sube al repositorio `idiomas`.

## Repositorio `idiomas`

```
idiomas/
  README.md, LICENCIAS.md          atribuciones de cada fuente
  <lengua>/                        fr, en
    materias.json                  índice A1→C2: id estable, bloque, título, nivel, descripción, fuente, ficha
    titulos.json                   título y descripción de cada materia en la lengua estudiada; rótulo oficial (Core Inventory) si lo hay
    fichas/<id>.json               explicación, ejemplos y ejercicios propios de la ficha
    ejercicios/<id>.json           banco de ejercicios de respuesta fija, montado por programa
    lexico.json                    palabras por nivel y campo semántico, con pronunciación y ejemplos
    expresiones.json               expresiones por función (introducir, matizar, contraponer, concluir…)
```

Los `id` de materias y ejercicios **no cambian nunca**: el progreso del usuario se guarda con ellos.

## Datos del usuario (`TCEE/idiomas-<nombre>/`)

```
perfil.json        nombre, idiomas, nivel orientativo y estimado por bloque, compromisos, ajustes
sesiones.jsonl     una línea por sesión: fecha, idioma, tipo, minutos, materias, resultados
repaso.json        estado del repaso de cada ficha (ts-fsrs)
errores.json       cuaderno de errores: frase, corrección, ficha, fecha, veces
anotaciones.json   anotaciones del usuario en cada ficha
diccionario.json   Mi diccionario (palabras y estructuras guardadas)
revision.json      preguntas marcadas para revisar con Claude
verbos.json        estadística del entrenador de verbos: {"verbo|tiempo": {i, a, fallos por persona, u}}
escritos/, audio/  lo que el usuario escribe y graba (fases 2–3)
```

## Estado del paquete (fase 1, 6 de octubre de 2026)

- Índice: 140 materias de francés y 125 de inglés (`scripts/idiomas/indice.py`).
- 232 fichas con 4.198 respuestas aceptadas en sus ejercicios:
  - **Francés:** gramática A1–C2 (73 adaptadas de Tex's French Grammar con frases de Tatoeba, más 13 propias de B2–C2) y léxico A1–C2 (38).
  - **Inglés:** gramática A1–C2 (70) y léxico A1–C2 (39).
- Fonética y destrezas aún sin ficha (fases 2–3): en el mapa salen como «ficha en preparación».
- Las fichas las escribieron varios agentes de Claude con el encargo de `scripts/idiomas/encargos/`. Un **segundo análisis independiente**
  revisó todos los ejercicios: 177 cambios, la mayoría respuestas válidas que faltaban y opciones ambiguas.
  Las dudas de norma frente a uso (après que + indicativo, «des bons amis»…) se resolvieron enseñando la norma y avisándolo en la explicación.
- Comprobación automática: `scripts/idiomas/validar_fichas.py <carpeta idiomas>` (formato, niveles, una sola laguna por hueco, respuesta entre las opciones,
  palabras de «ordenar»…). Además, cada respuesta aceptada pasa el corrector del panel (`corregir` en `extension/idiomas.js`).
- Pendiente para la fase 2: las páginas no3, no4 y taf5 de Tex ya están en `.fuentes-idiomas/tex/` (bajaron el 6/10/2026); revisar con ellas las fichas que se escribieron sin fuente.
- Pendiente para la fase 2: usar EFLLex/FLELex (`TCEE/.fuentes-idiomas/cefrlex/`) para medir la dificultad de los textos y el nivel del vocabulario usado.

## Formato de las fichas

Ver `scripts/idiomas/encargos/fichas_comun.md`. Resumen: `id`, `titulo`, `titulo_es`, `descripcion_es`, `nivel`, `resumen`,
`explicacion` (bloques texto/tabla/lista, en español), `ejemplos` (frase + traducción), `errores_hispanohablantes` (mal/bien/nota),
`ejercicios` (12–16: hueco, eleccion, transformar, corregir, ordenar; todas las respuestas válidas en `respuestas`; `origen` si viene de Tatoeba)
y `fuente`.
Desde v0.32 cada ficha lleva también `descripcion_larga_es`, `contexto` {que_es, por_que_importa, cuando_se_usa} y, en cada ejercicio,
`explicacion` (ampliada, 3–6 frases), `explicacion_breve` (la de una línea), `traduccion`, `por_opcion` (elección), `errores_previstos`
[{respuesta, explicacion}] y `glosario` [{palabra, significado}]. Se escribieron con el encargo `scripts/idiomas/encargos/enriquecer.md`,
se comprueban con `scripts/idiomas/validar_enriq.js` (los errores previstos no pueden ser respuestas aceptadas) y se unen con `scripts/idiomas/unir_enriq.py`.
Al escribirlas se revisaron de nuevo todas las fichas: unas 90 correcciones (respuestas válidas que faltaban, enunciados que no casaban, ejemplos discutibles).

## Pantalla (v0.31, 6/10/2026, con el usuario)

- **Barra superior**: a la izquierda «IDIOMA: [desplegable]»; a la derecha, el perfil (nombre, niveles, ⚙ Ajustes) y debajo los compromisos.
- **Izquierda (1/3)**: *Empezar sesión* con las seis destrezas y competencias (Gramática, Léxico, Comprensión lectora, Comprensión auditiva,
  Expresión escrita, Expresión oral; las cuatro últimas, desactivadas hasta las fases 2–3) y, aparte, Repaso, Al azar y Examen.
  Debajo, el cuaderno de errores y las últimas sesiones.
- **Derecha (2/3)**: fichas como tarjetas, solo las del nivel elegido (botones A1…C2 con la parte dominada; ● marca tu nivel; flechas del teclado) y del bloque elegido
  en el desplegable (Gramática, Léxico, Fonética, Destrezas o todas). Cada tarjeta: nivel, bloque, estado, título y descripción, progreso
  (última nota en un anillo con la media, sesiones, fecha de repaso) y marcas «CI» (rótulo del Core Inventory) y 📝 (tiene anotaciones).
- **Idioma de las tarjetas**: por defecto, la lengua estudiada (`<lengua>/titulos.json` del paquete: `titulo_l`, `descripcion_l`, `oficial`);
  en Ajustes se puede pasar a castellano. Las explicaciones de dentro de la ficha siguen en castellano.
  `oficial` es el rótulo exacto del *Core Inventory for General English* (inglés, 78 de 125) o del *Inventaire linguistique des contenus clés
  des niveaux du CECRL* (francés, 112 de 140, con `nivel_oficial`); en la tarjeta, 📘. La descripción de la tarjeta es la ampliada (`descripcion_larga_l` / `descripcion_larga_es`).
- **Ficha**: siempre las mismas secciones y en el mismo orden, plegables: De qué trata (descripción ampliada + Qué es · Por qué importa · Cuándo se usa,
  campo `contexto`) · Reglas y claves · Ejemplos (con 🔊, voz del Mac) · Errores típicos de hispanohablantes · Material complementario
  (fuente, rótulo oficial, fichas relacionadas, enlaces de consulta).
- **Anotaciones sobre la ficha** (v0.32): al seleccionar texto sale una barra para subrayar en cuatro colores o «✎ Nota» (subraya y abre un recuadro
  debajo del bloque); clic en un subrayado para cambiar color, ver la nota o quitarlo; «＋ nota» en cada sección añade un recuadro al final.
  Se guardan en `anotaciones.json` del perfil: `{id: {texto, marcas: [{id, k, inicio, cita, color, caja, nota}]}}` (`k` = bloque con `data-k`;
  si la ficha cambia, la marca se recoloca buscando la cita).
- **Respuestas siempre escritas** (v0.32): en «elige» las opciones y en «ordena» las palabras son solo pista; hay que escribir la respuesta.
- **Corrección ampliada** (v0.32): tu respuesta frente a la correcta (lo que sobra, en rojo), la frase completa con traducción y 🔊, por qué tu
  respuesta concreta vale o no (`por_opcion` / `errores_previstos`), la regla aplicada a esa frase (`explicacion`), todas las opciones una a una y
  el vocabulario (`glosario`). Ver «Formato de las fichas».
- **Práctica**: la ficha a la izquierda (plegable a una franja) y los ejercicios a la derecha, con una barra de puntos verde/rojo por ejercicio.
- **Ejercicios según el nivel**: si la ficha está por debajo del nivel del usuario, salen primero los de producción (transformar, corregir, ordenar);
  si está por encima, primero los de reconocimiento (elegir, hueco). Con el mismo nivel, mezclados.
- **Eliminar perfil**: Ajustes → *Eliminar este perfil…*; pide confirmación y manda la carpeta a la Papelera del Mac.

## v0.33 (6/10/2026, con el usuario)

- **Niveles de francés** alineados con el *Inventaire* en 30 materias donde su rótulo coincide con la ficha (`NIVEL_FR_LEXICO` y tuplas de
  `scripts/idiomas/indice.py`). No se tocaron 20 en las que el rótulo del Inventaire solo cubre una parte de la ficha
  (p. ej. conectores-1, impersonales, concordancia-participio, negacion-compleja).
- **Marcar para revisión**: casilla bajo cada corrección. Solo guarda la pregunta en `revision.json` del perfil
  (`[{lengua, materia, ejercicio, frase, respuesta, correcta, fecha}]`) para revisarla más adelante con Claude. No cambia nada más.
- **Consultar**: enlace junto a la casilla; abre Claude en el navegador (`https://claude.ai/new?q=…`) con la pregunta ya redactada
  (ficha, ejercicio, solución, tu respuesta, «¿cuándo se utiliza…?, ¿es correcto utilizar…?»).
- **Dos roscos por tarjeta**: *Avance* (ejercicios distintos hechos / ejercicios de la ficha) y *Dominio* (media de las 3 últimas notas).
- **Cuaderno de errores compacto**: barra de acumulación (verde < 10, ámbar < 25, rojo), «Repasar los errores» (sesión `errores` sin materia:
  solo ejercicios fallados, de las fichas con más errores) y el detalle plegado.
- **Mi diccionario** (`diccionario.json` del perfil): al seleccionar cualquier texto del panel sale «📖 Añadir a mi diccionario» / «🔎 Buscar»
  (en la ficha, junto a los colores). Entradas `{id, lengua, texto, definicion, tipo: palabra|estructura, campo, ficha, contexto, fecha}`;
  la definición se rellena con el diccionario bilingüe. Vista: vocabulario por campo semántico y estructuras por ficha. Repaso: pendiente.
- **Libreta**: todos los subrayados y notas de las fichas, agrupados por ficha, con el fragmento subrayado y su contexto y la nota en recuadro.
- **Cajón del diccionario** (fijo a la derecha, plegable): «lengua → castellano» (palabra exacta y por prefijo) o «Por significado»
  (describes en castellano y propone palabras: búsqueda inversa sobre traducciones y definiciones). Datos: `<l>/diccionario.json` del paquete,
  generado con `scripts/idiomas/diccionario.py` a partir de Wiktionary (wiktextract/kaikki.org: es-extract y fr-extract; CC BY-SA 4.0).
  Versión del 6/10/2026: francés 64.310 entradas (es.wiktionary + traducciones al español de fr.wiktionary + 2.886 palabras de FLELex con definición
  en francés, «(fr)»; cubre el 99,4 % de las 12.000 palabras más frecuentes de FLELex), inglés 30.937 (solo es.wiktionary; 89 % de las 6.000 de EFLLex).
  Para regenerarlo: descargar es-extract.jsonl.gz y fr-extract.jsonl.gz de kaikki.org/dictionary/rawdata.html; filtrar el francés con
  `zcat fr-extract.jsonl.gz | grep -F '"lang_code": "es"' | grep -F '"lang_code": "fr"' | gzip > fr-es.jsonl.gz` (30 s; leerlo entero en Python
  tarda más de lo que permite una orden) y ejecutar `diccionario.py es-extract.jsonl.gz fr-es.jsonl.gz <carpeta idiomas>`.
  La búsqueda «por significado» puntúa traducciones (peso 2) y definiciones (peso 1), con plurales simplificados; depende de las palabras
  que use Wiktionary, así que no entiende sinónimos que no aparezcan en la entrada.
  WantWords (diccionario inverso de la Universidad de Tsinghua) solo existe para inglés y chino y necesita un modelo neuronal pesado;
  se enlaza su web para inglés en lugar de instalarlo.

## v0.34 (7/10/2026, con el usuario)

- **Cajón del diccionario**: tres modos, «Francés → Español», «Español → Francés» (traducción exacta, luego por prefijo, luego traducciones
  que contienen la palabra) y «Por significado»; se repinta al cambiar de idioma. Se busca igual con œ que con oe.
- **Libreta**: el contexto de cada subrayado es la fila de la tabla (con el nombre de cada columna), el punto de la lista o la frase o frases
  que lo contienen, no el bloque entero.
- **Practica los verbos** (solo francés; barra entre «Empezar sesión» y el cuaderno de errores):
  - Datos: `idiomas/fr/verbos.json` (7.015 verbos y 149 modelos de Verbiste, GPL; frecuencia contada en las frases francesas de Tatoeba),
    generado con `scripts/idiomas/verbos.py`. Conjugador en `extension/idiomas.js` (`conjugar`): tiempos simples de Verbiste; compuestos con
    avoir/être (lista `CON_ETRE`, doble auxiliar `DOBLE_AUX` acepta los dos), concordancia del participio con el sujeto (je/tu: masc. o fem.;
    vous: plural o singular de cortesía), futur proche; variantes aceptadas: paie/paye, préférerai/préfèrerai (1990).
  - Entrenador (como Scholingua): grupos 1.º/2.º/3.º, solo frecuentes (300 más frecuentes), 16 tiempos por modo, buscar y elegir verbos o 3 al
    azar, «Lo que más fallo». Modos: Tabla (un verbo y un tiempo, las 6 personas) y Mezcla (una forma por pregunta). Se escribe solo la forma
    (el pronombre, con elisión y «que» en subjuntivo, ya aparece); teclado de acentos; «≈» si solo fallan acentos.
  - Fallos: estadística propia por verbo y tiempo en `verbos.json` del perfil (no van al cuaderno de errores); cada ronda cuenta como sesión.
  - Izquierda, plegable: cinco fichas de consulta (`idiomas/fr/conjugacion/`: grupo1, grupo2, grupo3, irregulares, compuestos), con el
    formato de las fichas (sin ejercicios), subrayables y anotables; se abre sola la del grupo del verbo o la de compuestos.
    Las formas de sus tablas se generaron y comprobaron con Verbiste; pouvoir: «pu» invariable (Verbiste da «pue»).

## Búsqueda por significado: opciones (pendiente, 7/10/2026)

El problema: hoy solo se cruzan las palabras de la descripción con las traducciones y definiciones de cada entrada; «subida general de
precios» no encuentra inflation porque su entrada dice «inflación». Opciones, de más a menos intensivas:

1. **Modelo de lenguaje local (Ollama, fase 2)**: el modelo propone palabras a partir de la descripción y el diccionario las confirma.
   El más flexible; 2–3 GB y unos segundos por consulta en un Mac de 8 GB.
2. **Búsqueda semántica con un modelo de «embeddings» multilingüe pequeño** (p. ej. paraphrase-multilingual-MiniLM o multilingual-e5-small,
   120–470 MB, en la propia extensión con transformers.js): se calcula una vez el vector de cada definición (unos minutos) y se busca por
   cercanía de significado. Entiende sinónimos y paráfrasis; sin conexión.
3. **Tesauro preparado una vez por Claude** para el vocabulario frecuente (FLELex/EFLLex, ~12.000 palabras por lengua): para cada palabra,
   5–10 maneras de describirla en castellano. Luego la búsqueda actual funciona muy bien en ese vocabulario; coste solo al prepararlo.
4. **Doble salto por el Wikcionario en español** (datos que ya tenemos): buscar la descripción en las DEFINICIONES de las palabras españolas
   («inflación: elevación del nivel general de los precios») y pasar de la palabra española a su traducción. Barato y eficaz para conceptos
   que tienen una palabra española clara; mejorable con ponderación BM25 y raíces de las palabras.
5. **Enlaces externos** (OneLook o WantWords para inglés, diccionarios en línea): lo mínimo, fuera del panel.

## Cómo funciona la pestaña (fase 1)

Código: `extension/idiomas.js` (lógica sin VS Code), `extension/idiomasPanel.js` (datos) y `extension/media/idiomas.js` (pantalla).
Para el repaso se usa ts-fsrs, copiado en `extension/lib/ts-fsrs.cjs` (MIT).

- **Corrección** (`corregir`):
  - Se comparan minúsculas, sin comas ni punto final, con apóstrofos y comillas unificados.
  - Los acentos cuentan; si solo fallan los acentos, el aviso dice «Casi», pero se cuenta como fallo.
  - Las respuestas nunca se mandan a la pantalla: se corrige en la extensión.
- **Elección de ejercicios:** primero los fallados (cuaderno de errores), luego los no vistos y luego los vistos hace más tiempo.
- **Repaso:**
  - Cada ficha trabajada recibe una fecha de repaso (ts-fsrs, sin pasos intradía).
  - La nota de la sesión se convierte en valoración: ≥ 90 % fácil, ≥ 70 % bien, ≥ 50 % difícil y, por debajo, otra vez.
- **Estado de una materia:**
  - *nueva*;
  - *aprendiendo*;
  - *dominada*: media ≥ 0,8 en las 3 últimas notas y al menos 2 sesiones;
  - *para repasar*: repaso vencido.
- **Recomendación** («Gramática», «Léxico», «Al azar»), en este orden:
  1. repasos vencidos;
  2. materias flojas;
  3. nuevas del nivel indicado;
  4. nuevas del nivel inferior (para no dejar huecos);
  5. nuevas del superior.
- **Nivel estimado** (por bloque):
  - Es el nivel más alto con media ≥ 0,75 en al menos 3 materias, sin niveles inferiores por debajo de 0,6.
  - Si no coincide con el indicado, aparece un aviso con el botón «Cambiar mi nivel».
  - Las materias flojas de niveles inferiores salen antes.
- **Compromisos:**
  - Cada regla mide su periodo: el día, la semana o el bloque de N semanas contado desde que se creó.
  - Con minutos, se cumple al llegar a esos minutos; sin minutos, con una sesión.
  - Si la regla tiene días fijados, «toca hoy» solo en esos días.
