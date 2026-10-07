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
| 2 | Biblioteca de textos (nivel, tema, palabras clave), longitud flexible, Escucha (voz del Mac), Escrito (plantillas y rúbrica, LanguageTool y modelo local), instalador de Ollama | Hecha (v0.37, 7/10/2026; sin probar aún en el Mac) |
| 3 | Oral (whisper, métricas), tribunal (preguntas con voz), sesión tipo examen, vídeo | Hecha (v0.37, 7/10/2026; sin probar aún en el Mac) |
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
| VOA Learning English | Textos y audios en inglés (fase 2; enlace al mp3 original) | Dominio público |
| Wikipedia (en, fr), Simple English Wikipedia, Vikidia | Textos de la biblioteca (fase 2) | CC BY-SA 4.0 / 3.0 |
| Wikinews (en, fr; cerrado en mayo de 2026, solo lectura) | Noticias de la biblioteca (fase 2) | CC BY 2.5 |
| Artículos de análisis escritos por Claude | Prensa económica B2–C1, el hueco que no cubren las fuentes abiertas | CC0 |

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
    textos.json                    índice de la biblioteca (lo rehace scripts/idiomas/textos.py)
    textos/<id>.json               cada texto: párrafos, fuente y licencia, nivel, campo, ideas clave, resumen modelo, preguntas, tribunal, glosario
    escritura.json                 tareas de expresión escrita con estructura, expresiones y texto modelo
    tribunal.json                  preguntas generales del tribunal por bloques, con pistas, ideas y repreguntas
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
textos.json       lo hecho con cada texto: {id: {veces, ultima, modos, comprension[], dictado[], resumen[] (notas /10)}}
escritos/<fecha>_<clase>.json   cada resumen o tarea corregida: texto, errores de LanguageTool, valoración del modelo, autoevaluación, nota
audio/<fecha>_<clase>.m4a/.json   grabaciones del oral (solo en el Mac) y su ficha: transcripción, métricas, valoración
examenes/<fecha>_examen.json   sesiones tipo examen: textos, escrito, grabaciones y notas
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
  la definición se rellena con el diccionario bilingüe. Desde v0.40: si el diccionario la tiene, queda **fija** (no editable; se indica «Del
  diccionario» y, si hizo falta, la forma base: wielded → wield, chevaux → cheval, mangeait → manger, con reglas de flexión y las conjugaciones de
  Verbiste); si no, el campo queda libre. Al añadir desde el «Vocabulario del texto», la definición es la del vocabulario, fija. El contexto es la
  frase que contiene la selección. Vista: vocabulario por campo semántico y estructuras por ficha. Repaso: pendiente.
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
  - v0.35: las fichas de conjugación tienen formato propio (`"formato": "conjugacion"`: cabecera de 2–4 viñetas, `modelos` con pestañas,
    `notas` por tiempo bajo su tabla, `notas_finales`, `extra`). El panel genera con Verbiste las tablas de TODOS los tiempos del verbo
    modelo (también passé antérieur, compuestos y futur proche), agrupadas por modos con su color; raíz en gris, terminación en naranja,
    auxiliar en azul; «parti(e)s» cuando hay concordancia. Sin ejemplos ni errores típicos. Encargo: `encargos/fichas_conjugacion_v2.md`.
  - v0.36: pestaña «Compuestos, doble auxiliar y perífrasis» (`compuestos.json`, `"formato": "particularidades"`): sin cabecera ni
    conjugaciones de un verbo; tres subpestañas solo de explicación (Tiempos compuestos, con être y concordancia; Doble auxiliar;
    Perífrasis verbales), cada una con bloques de texto, tabla o lista. Encargo: `encargos/particularidades.md`.
    Las fichas de grupo solo llevan sus tablas por modos. Mitad y mitad (ficha / entrenador); tiempos como botones;
    colores por tipo de tema de VS Code (`body.vscode-light`, `vscode-dark`, alto contraste con subrayado).

## Fases 2–3 (v0.37, 7/10/2026)

El examen real (BOE-A-2025-26902, segundo ejercicio) marca el diseño: **escrito** = se lee en voz alta un texto (hasta 15 minutos), se toman
notas y se escribe un resumen en esa lengua (90 minutos, con diccionario); **oral** = 10 minutos para preparar otro texto, lectura en voz alta,
exposición (unos 10 minutos) y preguntas del tribunal, que además lee el escrito. **El usuario quiere practicar con el mismo peso «leer y
resumir» y «escuchar y resumir»**: son los botones *Comprensión lectora* y *Comprensión auditiva* de *Empezar sesión* (sin botones nuevos
en la pantalla principal, decisión del usuario del 7/10/2026) y comparten corrección.

### Biblioteca de textos
- 193 textos con material (104 en inglés, 89 en francés), de B1 a C1: Wikipedia, Simple English Wikipedia, Vikidia, Wikinews, VOA (con su
  mp3 cuando la fecha cuadra) y 34 artículos de análisis originales (prensa económica, CC0). Se bajaron con el navegador integrado del Mac
  (la nube no llega a esas webs) y se procesan con `scripts/idiomas/textos.py`:
  - `preparar`: limpia (quita «Véase también», referencias, listas sin punto), corta por párrafos hasta 1.700 palabras y calcula el **nivel
    léxico** con FLELex/EFLLex (parte del texto cubierta por el vocabulario de B1, umbrales por lengua calibrados con VOA ≈ B1–B2,
    Vikidia ≈ A2–B1 y Wikipedia ≈ C1–C2; frases muy largas suben un nivel);
  - los agentes de Claude escriben el material de cada texto con `encargos/textos.md` (y los artículos con `encargos/prensa.md`), que se
    comprueba con `scripts/idiomas/validar_textos.py` (citas literales, párrafos en rango, ideas que cubren todo el texto…);
  - `unir`: añade el material, aparta los textos sin él y rehace el índice. Se descartaron 6 textos desordenados o triviales.
- Material de cada texto: título y resumen en castellano, campo, palabras clave, nivel (el agente puede corregir el léxico), **ideas clave**
  por párrafo (las imprescindibles con ★), **resumen modelo**, 10–16 **preguntas** (verdadero/falso/no se dice, elegir, vocabulario en el
  texto y respuesta breve; cada una con su párrafo, cita literal y explicación), 6–8 **preguntas de tribunal** y glosario.
- **Longitud flexible**: corto (≈150), estándar (≈400), largo (≈800) o completo; siempre párrafos enteros desde el principio. Solo se
  enseñan las preguntas, ideas y glosario de esa parte; el resumen modelo, solo con el texto completo.
- Tarjetas por nivel, tema, tipo (prensa, noticia, divulgación, enciclopedia) y hechos/sin hacer. «Te propongo»: un texto de tu nivel o uno
  más, sin hacer, de un campo distinto a los últimos y, a igualdad, de prensa.

### Comprensión lectora (leer y resumir) · Comprensión auditiva (escuchar y resumir)
- Etapas: Lectura (texto con «🔊 Escucharlo») o Escucha (sin texto: voz del Mac frase a frase, con barra, frase anterior, voz y velocidad;
  o el audio original de VOA) → Resumen → Preguntas → Dictado (solo escucha, opcional) → Resultado. Notas siempre a la derecha.
- La voz es la del sistema (`speechSynthesis` del panel); las voces «mejoradas/premium» se descargan en Ajustes del Sistema › Accesibilidad.
- En el resumen se ve el contador frente a la extensión recomendada (20–30 % del texto) y el diccionario del cajón (como en el examen).
  En «leer», el texto se puede ocultar para resumir de memoria; en «escuchar», el texto se ve al final.
- Preguntas: V/F y elegir se corrigen al pulsar; vocabulario se escribe (mismas reglas que las fichas, «oe» = «œ»); respuesta breve la valora
  el modelo local (bien / a medias / mal) o, sin modelo, el usuario frente a la respuesta modelo. Tras corregir: cita y «ver en el texto».
- Dictado: 5 frases repartidas por el texto; se comparan palabra a palabra (bien, acento, mal, falta, sobra).
- Al terminar: nota del resumen, % de preguntas y dictado, el texto, el vocabulario y accesos al oral (exponerlo, leerlo, leer tu resumen,
  preguntas del tribunal). Se guarda en `textos.json` y `sesiones.jsonl` (tipo `lectura` o `escucha`).

### Expresión escrita y corrección
- 27 tareas por lengua (`escritura.json`): opinión, carta, correo, réplica, informe, propuesta, crítica y nota, de B1 a C2, con estructura,
  expresiones útiles y texto modelo (se enseña tras corregir). Banco de 20 funciones de expresiones (`expresiones.json`).
- **Corrección** (resúmenes y tareas): LanguageTool (errores subrayados: ortografía en rojo, gramática en ámbar) + fragmentos copiados del
  texto (5 palabras seguidas o más, en morado) + **modelo local** con la rúbrica fija de cinco criterios (0–4: tarea, coherencia, registro,
  corrección, vocabulario; nota /10), ideas recogidas/a medias/que faltan, inexactitudes, propuestas de mejora y comentario, todo en castellano.
  Instrucciones del modelo en `extension/idiomasTextos.js` (respuesta en JSON con esquema). El usuario puede cambiar la rúbrica y las ideas
  («Guardar mi valoración»). Sin herramientas instaladas, se autoevalúa con la misma rúbrica.
- **Controles objetivos (v0.40, 7/10/2026)**, porque el modelo de 3B es benévolo e incoherente: puso 7,5 a «Hi! This is just a test…» (24 palabras),
  dio por recogidas todas las ideas, pidió escribir el resumen *en español* y propuso «mejoras» en castellano. Ahora, sin modelo
  (`controlResumen`/`ajustarResumen`/`ajustarEscrito`/`depurarValoracion` en `extension/idiomasTextos.js`), y mandando sobre el modelo:
  - **Fuera de tema → 0** en todo y sin preguntar al modelo: menos de 4 palabras con contenido en común con el texto o menos del 30 % de las
    del resumen (raíces de 5 letras, sin palabras vacías).
  - Cada idea: si el resumen apenas comparte su vocabulario (menos del 12 %) → «falta»; menos del 25 % → como mucho «a medias».
  - Sin ninguna idea esencial → «tarea» 0 y nota máxima 2; falta alguna → «tarea» ≤ 2. Más corto que el mínimo → «tarea» ≤ 2; menos de la mitad
    → «tarea» ≤ 1 y nota máxima 3. Escritos: sin relación con el enunciado → «tarea» ≤ 1 y nota máxima 3.
  - Se descartan las «mejoras» cuyo original no está en el texto del alumno o cuya propuesta está en castellano, las frases repetidas y las
    que piden escribir en castellano. Respuestas abiertas sin ninguna palabra en común con la respuesta modelo → 0.
  - Instrucciones del modelo: el alumno escribe SIEMPRE en la lengua del examen; solo los comentarios van en castellano. `repeat_penalty` 1,15 y
    tope de 1.200 fichas de salida (evita los bucles de frases repetidas y acorta la espera).
- **Procesos largos y otros botones (v0.40)**: la corrección del resumen y del escrito guarda su estado (`T.corr`, `W.corr`) y sobrevive a que se
  repinte la pantalla (mostrar u ocultar el texto, abrir una ficha…): el botón sigue desactivado con el progreso, no se manda dos veces
  (el 7/10 se corrigió dos veces el mismo resumen) y al terminar pasa a la etapa siguiente, o la deja preparada si el usuario está en otra vista.
  Lo mismo con las preguntas abiertas que se están comprobando.

### Herramientas locales (`extension/idiomasHerramientas.js`)
- Instalación: botón *Instalar herramientas* en Ajustes de Idiomas, que abre un terminal con `scripts/idiomas/instalar_herramientas.sh`
  (Homebrew: `languagetool` con su Java, `ollama`, modelo `qwen2.5:3b` de 1,9 GB; comprueba ffmpeg, whisper y las voces). Sin tarea de VS Code.
  Si `ollama pull` falla («no such host», 7/10/2026 en el Mac del usuario), el script arranca un servidor limpio y, si sigue fallando,
  baja el mismo modelo en GGUF de Hugging Face (Qwen2.5-3B-Instruct Q4_K_M, 2,1 GB) y lo registra en Ollama con `ollama create`.
- LanguageTool (puerto 8081) y Ollama (11434) se arrancan solo al corregir, **de uno en uno** (al arrancar uno se para el otro) y se paran
  tras 8 minutos sin uso; el modelo se descarga de la memoria a los 4 minutos (Mac de 8 GB).

### Expresión oral, tribunal y examen
- Grabación con ffmpeg y transcripción con whisper.cpp (el modelo `large-v3-turbo` del cante, multilingüe; `-l en|fr`), en
  `idiomas-<nombre>/audio/`. Como en el cante, **no se transcribe sola**: al terminar se ofrece *Corregir* (transcribe y valora),
  *Escucharla* o *Grabar otra vez* (decisión del usuario, 7/10/2026). En el examen, el informe empieza con un botón *Corregir* que transcribe
  todas las grabaciones, una tras otra. Las sin corregir quedan en «Mis grabaciones» y se corrigen desde allí. El audio se guarda en mp3.
- Métricas: palabras por minuto (orientativo: 115–170 adecuado), pausas de más de 2 s, palabras, variedad léxica (Guiraud) y, en la
  lectura en voz alta y la de tu resumen, palabras bien leídas, saltadas y cambiadas frente al original. El modelo valora la exposición
  (ideas cubiertas y rúbrica) y las respuestas al tribunal (contenido y lengua 0–4, mejoras y una **repregunta**, que se puede contestar).
- Tribunal: la voz del Mac lee la pregunta (se puede ver escrita y pedir pista); mezcla preguntas del texto y generales de `tribunal.json`
  (54 por lengua en 9 bloques, hasta un nivel por encima del tuyo).
- **Sesión tipo examen**: escucha (una vez, hasta 15 min) → resumen (90 min; versión corta 30) → preparación de otro texto (10 min) →
  lectura en voz alta → exposición → lectura de tu resumen → 4 preguntas del tribunal → informe. Los relojes avisan y nunca cortan.
  La corrección del resumen arranca al entregarlo y las grabaciones se transcriben mientras sigues; el informe espera a todo y da una nota
  orientativa (media de resumen, exposición y tribunal). Se guarda en `examenes/`.
- Vídeo y audio en abierto: enlaces (VOA, BBC Learning English, The Economist, France 24, RFI français facile, TV5Monde, Arte, Le Monde…)
  en *Escuchar y resumir*; se abren en el navegador.

### Pendiente de las fases 2–3
- Probarlo en el Mac: voces disponibles, permisos de micrófono, LanguageTool y Ollama de Homebrew, tiempos de corrección del modelo de 3B.
- El modelo de 3B es modesto: si sus valoraciones no convencen, probar `qwen2.5:7b` (4,7 GB; justo con 8 GB) con `TCEE_MODELO_IDIOMAS`.
- Más textos: hay 120 descargados sin material en `encargos/fase2/sin_material` del entorno de Claude (VOA y Wikinews sobre todo).

## Voces (v0.39, 7/10/2026, con el usuario)

- La voz del sistema que da el panel de VS Code suena muy artificial: por defecto los textos se leen con **voces neuronales de Piper**
  (libres, sin conexión; funcionan también en Windows y Linux). Tres por idioma, instaladas por *Instalar herramientas* en `~/.tcee/voces`
  (Piper en `~/.tcee/piper`, un entorno de Python): inglés británico Cori (mujer, calidad alta), Alan (hombre) y VCTK (109 hablantes);
  francés Siwis (mujer), Tom (hombre) y MLS (125 hablantes). Unos 460 MB.
- **Al azar** (por defecto): cada texto, una voz distinta y, en las de varios hablantes, un hablante al azar («· otra voz» cambia). Se puede fijar
  una voz o elegir una del sistema en el selector de *Comprensión auditiva*. Las preguntas del tribunal, el dictado y los 🔊 de las fichas usan
  la voz del texto en curso.
- Funcionamiento: `extension/idiomasVoz.js` mantiene vivo `scripts/idiomas/voz.py` (servidor de Piper) mientras se usa y lo para a los 5 minutos;
  genera el audio frase a frase (la primera, en menos de un segundo) en `~/.tcee/voz-cache/` (se borra lo de más de 3 días) y la pantalla lo
  reproduce según llega. Si Piper falla o no está, se usa la voz del sistema y se avisa.
- **v0.40 (7/10/2026, fallo visto por el usuario y diagnosticado con un registro en su Mac)**: sonaba la primera frase y el resto se saltaba, o se
  paraba. Causa: VS Code solo deja reproducir audio que inicia un clic, y el lector creaba un elemento de audio por frase; todos salvo el del clic
  eran rechazados (`NotAllowedError: play() can only be initiated by a user gesture`) y el lector los daba por terminados. Ahora hay **un único
  elemento de audio**, desbloqueado con el primer clic en el panel (50 ms de silencio en WAV; CSP `media-src … data:`), y todas las frases suenan
  en él. Si una frase aun así no suena, se lee con la voz del sistema y se avisa una vez: nunca se salta en silencio.
- **Pausa**: con la voz neuronal sigue desde el punto exacto (con la del sistema, desde el principio de la frase).
- **Velocidad** (× 0,75 a × 1,2, por idioma) en Comprensión lectora (junto a *Escucharlo*) y auditiva: se aplica al reproducir (`playbackRate`
  conservando el tono), al momento y sin volver a generar el audio; Piper genera siempre a velocidad normal. El dictado «más despacio» resta 0,25.

## Clases con profesores (v0.38, 7/10/2026, con el usuario)

- Botón **👩‍🏫 Clases** a la derecha de la fila de niveles, encima de las tarjetas. Lista de clases del idioma y *+ Nueva clase* (tema, profesor, fecha).
- Cada clase (`idiomas-<nombre>/clases/<fecha>_<hora>_<lengua>-<tema>/clase.json`): datos, **notas** (se guardan solas), casilla
  «Revisar esta clase con Claude» (para que Claude la lea por el puente y ajuste el panel), **ficheros** y **audio**.
- Ficheros (`adjuntos/`): textos, PDF e imágenes tal cual; Word, RTF, Pages, HTML… se pasan a texto con `textutil` de macOS (ocupan menos y se leen
  en el panel). Los vídeos o audios subidos van al audio.
- Audio: *Grabar con el Mac* (ffmpeg con el micrófono elegido; convive con Meet o Teams, que siguen usando el micrófono; tope de 3 horas) o
  *Subir audio (iPhone…)* (Notas de voz pasadas al Mac por AirDrop, o la grabación de Meet/Teams). Todo se guarda en **mp3 mono de 32 kbit/s**
  (unos 14 MB por hora); el original no se copia.
- Para grabar al profesor hay que oír la clase por los **altavoces** (con auriculares solo se graba al usuario). Avisar al profesor de que se graba.
- **Transcribir** (botón; nunca solo): whisper con el idioma elegido (el de la clase, castellano o automático; whisper no separa voces ni idiomas
  dentro de una misma grabación). Transcripción con marcas de tiempo (clic = se oye desde ahí), búsqueda, y copia en texto plano
  (`audio-N.txt`) junto al audio. Un whisper y un micrófono cada vez entre cante, oral y clases.
- *Eliminar* manda la carpeta de la clase a la Papelera.

## Inicio: columnas con desplazamiento propio (v0.38)

En pantallas anchas (más de 1.000 px) la barra superior queda fija y cada columna se desplaza por su cuenta: la izquierda (sesiones, verbos,
cuaderno, diccionario, historial) y las tarjetas (con su cabecera de bloque, niveles y Clases fija). Al repintar se conserva la posición de cada una.

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
