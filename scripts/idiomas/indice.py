#!/usr/bin/env python3
"""Índice de materias A1→C2 (francés e inglés) del paquete de idiomas. Reglas: main/IDIOMAS.md.

Esqueleto tomado de los inventarios del Marco Europeo (Core Inventory for General English, British Council–EAQUALS;
Inventaire linguistique des contenus clés, Eaquals–CIEP): solo como índice; los títulos y descripciones son propios.
Los id NO se cambian nunca (el progreso del usuario se guarda con ellos). Salida: <destino>/<fr|en>/materias.json
"""
import json, os, sys

# (id corto, nivel, título, descripción breve, [páginas de Tex's French Grammar])
FR_GRAMATICA = [
  ('genero-numero', 'A1', 'Género y número del sustantivo', 'Masculino y femenino, plural regular e irregular.', ['no2', 'no3']),
  ('articulos', 'A1', 'Artículos definidos e indefinidos', 'le, la, l\', les; un, une, des; usos frente al español.', ['det2', 'det3', 'det4']),
  ('partitivos', 'A1', 'Artículos partitivos', 'du, de la, de l\', des; de tras negación y cantidad.', ['det5']),
  ('contracciones', 'A1', 'Contracciones de à y de', 'au, aux, du, des.', ['pre2']),
  ('posesivos', 'A1', 'Determinantes posesivos', 'mon, ma, mes, notre, leur… y mon delante de vocal.', ['det6']),
  ('demostrativos', 'A1', 'Determinantes demostrativos', 'ce, cet, cette, ces; -ci y -là.', ['det7']),
  ('pronombres-sujeto', 'A1', 'Pronombres sujeto', 'je, tu, il/elle/on, nous, vous, ils/elles; tu frente a vous; on.', ['pro2']),
  ('presente-er', 'A1', 'Presente: verbos en -er', 'Conjugación regular y verbos con cambio ortográfico (acheter, appeler, manger).', ['ver1', 'ver2', 'tapr1']),
  ('presente-ir-re', 'A1', 'Presente: verbos en -ir y -re', 'finir, partir, ouvrir; vendre, prendre, mettre…', ['vir1', 'vir2', 'vir3', 'vre1', 'vre2', 'vre3', 'vre4']),
  ('etre-avoir', 'A1', 'Être y avoir', 'Conjugación y expresiones con avoir (avoir faim, avoir raison…).', ['virr1', 'virr2', 'virr3']),
  ('aller-faire-venir', 'A1', 'Aller, faire y venir', 'Conjugación y expresiones frecuentes (faire du sport, il fait beau…).', ['virr4', 'virr5', 'virr6', 'virr8']),
  ('ilya-voila', 'A1', 'Il y a y voilà', 'Hay / ahí está.', ['no4']),
  ('negacion-basica', 'A1', 'Negación básica', 'ne… pas; ne… plus, ne… jamais; pas de.', ['neg1', 'neg2']),
  ('preguntas', 'A1', 'Hacer preguntas', 'Entonación, est-ce que, inversión; palabras interrogativas.', ['int1', 'int2', 'int3', 'int7']),
  ('quel', 'A1', 'Quel, quelle, quels, quelles', 'Adjetivo interrogativo y exclamativo.', ['int4']),
  ('adjetivos', 'A1', 'Adjetivos: concordancia', 'Femenino y plural; adjetivos irregulares (beau, nouveau, vieux).', ['adj1', 'adj2', 'adj4']),
  ('preposiciones-lugar', 'A1', 'Preposiciones de lugar y con países', 'à, en, au, aux, chez, dans, sur…', ['pre1', 'pre1a', 'pre3']),
  ('futur-proche', 'A1', 'Futuro próximo', 'aller + infinitivo.', ['taf1']),
  ('adjetivos-posicion', 'A2', 'Posición del adjetivo', 'Antes o después del nombre; cambio de sentido (un grand homme / un homme grand).', ['adj3', 'adj5']),
  ('passe-recent', 'A2', 'Pasado reciente', 'venir de + infinitivo.', ['tap1']),
  ('imperativo', 'A2', 'Imperativo', 'Formas, irregulares y con pronombres.', ['tai1']),
  ('pronominales', 'A2', 'Verbos pronominales', 'se lever, s\'appeler; reflexivos y recíprocos.', ['vpr1']),
  ('passe-compose-avoir', 'A2', 'Passé composé con avoir', 'Formación y participios irregulares.', ['tap2']),
  ('passe-compose-etre', 'A2', 'Passé composé con être', 'Verbos de movimiento y concordancia básica.', ['tap3']),
  ('imparfait', 'A2', 'Imparfait', 'Formación; descripciones y hábitos en el pasado.', ['tap5', 'tap6', 'tap7']),
  ('complementos-cd-ci', 'A2', 'Pronombres de complemento directo e indirecto', 'le, la, les; lui, leur; posición.', ['pro5', 'pro8']),
  ('pronombres-tonicos', 'A2', 'Pronombres tónicos', 'moi, toi, lui, elle… después de preposición y para insistir.', ['pro4']),
  ('cest-ilest', 'A2', 'C\'est o il/elle est', 'Cuándo usar cada uno.', ['pro3']),
  ('comparativo', 'A2', 'Comparativo', 'plus, moins, aussi… que; meilleur/mieux.', ['adj6', 'adv4', 'adj8']),
  ('superlativo', 'A2', 'Superlativo', 'le plus, le moins; le meilleur, le mieux.', ['adj7']),
  ('adverbios', 'A2', 'Adverbios: formación y posición', '-ment; posición con tiempos compuestos.', ['adv1', 'adv2', 'adv3', 'adv6']),
  ('cantidad', 'A2', 'Expresiones de cantidad', 'beaucoup de, peu de, assez de, trop de…', ['det8']),
  ('modales', 'A2', 'Verbos modales', 'pouvoir, vouloir, devoir.', ['vm1']),
  ('savoir-connaitre', 'A2', 'Savoir o connaître', 'Saber algo o conocer a alguien/algo.', ['virr10']),
  ('verbos-irregulares', 'A2', 'Verbos irregulares frecuentes', 'boire, croire, voir, dire, lire, écrire…', ['virr9', 'virr11']),
  ('quitter-partir', 'A2', 'Quitter, partir, sortir, laisser', 'Irse, salir y dejar.', ['vl1']),
  ('depuis', 'A2', 'Depuis, il y a, pendant, pour', 'Expresar duración y momento.', ['pred1', 'pred2', 'prep1', 'adv5']),
  ('relativos-qui-que', 'A2', 'Relativos qui y que', 'Sujeto u objeto de la subordinada.', ['pror1']),
  ('futuro-simple', 'A2', 'Futuro simple', 'Formación regular e irregular; usos.', ['taf2', 'taf3', 'taf4']),
  ('pc-pronominales', 'B1', 'Passé composé de los pronominales', 'Con être y concordancia.', ['tap4']),
  ('pc-vs-imparfait', 'B1', 'Passé composé o imparfait', 'Cómo contar en pasado.', ['tap8']),
  ('y-en', 'B1', 'Pronombres y y en', 'Sustituir lugares, cosas y cantidades.', ['pro6', 'pro7']),
  ('orden-pronombres', 'B1', 'Orden de los pronombres', 'Dobles pronombres: je le lui donne, donne-le-moi.', ['pro9']),
  ('negacion-compleja', 'B1', 'Negación: otras formas', 'ne… personne, ne… rien, ne… aucun, ne… que, ni… ni.', ['neg3', 'neg4', 'neg5']),
  ('tout', 'B1', 'Tout, toute, tous, toutes', 'Determinante, pronombre y adverbio.', ['det9']),
  ('indefinidos', 'B1', 'Indefinidos', 'quelqu\'un, quelque chose, chaque, chacun, plusieurs, certains…', ['det10', 'pro10']),
  ('relativos-ce-qui', 'B1', 'Ce qui, ce que', 'Lo que.', ['pror2']),
  ('relativos-dont-ou', 'B1', 'Relativos dont, où y lequel', 'Con preposición y complemento de nombre.', ['pror3']),
  ('demostrativos-pron', 'B1', 'Pronombres demostrativos', 'celui, celle, ceux, celles (-ci, -là, de, qui).', ['pro11']),
  ('posesivos-pron', 'B1', 'Pronombres posesivos', 'le mien, la tienne, les leurs…', ['pro12']),
  ('interrogativos-pron', 'B1', 'Pronombres interrogativos', 'qui, que, quoi; lequel, laquelle…', ['int5', 'int6']),
  ('plus-que-parfait', 'B1', 'Plus-que-parfait', 'Anterioridad en el pasado.', ['tap9']),
  ('condicional', 'B1', 'Condicional presente', 'Cortesía, deseo, hipótesis, información no confirmada.', ['tac1']),
  ('si-hipotesis', 'B1', 'Oraciones con si', 'si + presente / imperfecto / pluscuamperfecto.', ['tac3']),
  ('subjuntivo-formacion', 'B1', 'Subjuntivo: formación', 'Regulares e irregulares (être, avoir, faire, aller, pouvoir…).', ['tas1', 'tas2']),
  ('subjuntivo-usos', 'B1', 'Subjuntivo: usos', 'Obligación, duda, voluntad, emoción.', ['tas3a', 'tas3b', 'tas4', 'tas7']),
  ('estilo-indirecto', 'B1', 'Estilo indirecto en presente', 'Il dit que…, il demande si…', ['tad1']),
  ('infinitivo', 'B1', 'Construcciones con infinitivo', 'Verbo + infinitivo, à / de + infinitivo.', ['vinf1', 'pre4']),
  ('impersonales', 'B1', 'Verbos y expresiones impersonales', 'il faut, il s\'agit de, il est important de…', ['vim1']),
  ('participio-presente', 'B1', 'Participio presente y gerundio', 'en + -ant; simultaneidad, causa, modo.', ['vpp1']),
  ('transitivos', 'B1', 'Construcciones transitivas e intransitivas', 'Verbos con y sin preposición, distintos del español.', ['vti1']),
  ('participio-adjetivo', 'B1', 'Participios como adjetivos', 'Concordancia y usos.', ['adj9']),
  ('conjunciones', 'B1', 'Conjunciones', 'Coordinantes y subordinantes.', ['con1', 'con2', 'con3']),
  ('estilo-indirecto-pasado', 'B2', 'Estilo indirecto en pasado', 'Concordancia de tiempos: il a dit qu\'il viendrait…', ['tad2']),
  ('conjunciones-subjuntivo', 'B2', 'Conjunciones con subjuntivo', 'bien que, pour que, avant que, à moins que, sans que…', ['tas5']),
  ('subjuntivo-pasado', 'B2', 'Subjuntivo pasado', 'que j\'aie fait, qu\'il soit venu.', ['tas6']),
  ('evitar-subjuntivo', 'B2', 'Cómo evitar el subjuntivo', 'Infinitivo y nombres en su lugar.', ['tas8']),
  ('futur-anterieur', 'B2', 'Futur antérieur', 'Anterioridad en el futuro y suposición.', ['taf5']),
  ('condicional-pasado', 'B2', 'Condicional pasado', 'Reproche, arrepentimiento, información no confirmada.', ['tac2']),
  ('pasiva', 'B2', 'Voz pasiva y sus alternativas', 'être + participio; on; se faire; verbos pronominales con sentido pasivo.', ['tav1']),
  ('faire-causativo', 'B2', 'Faire causativo', 'faire faire, se faire + infinitivo.', ['virr7']),
  ('concordancia-participio', 'B2', 'Concordancia del participio pasado', 'Con avoir y CD antepuesto, con être, con pronominales.', []),
  ('concordancia-tiempos', 'B2', 'Concordancia de tiempos', 'Correspondencias entre principal y subordinada.', []),
  ('mise-en-relief', 'B2', 'Puesta de relieve', 'c\'est… qui/que, ce qui… c\'est, dislocación.', []),
  ('nominalizacion', 'B2', 'Nominalización', 'De verbo a nombre: la hausse, la mise en place… (registro escrito y de prensa).', []),
  ('passe-simple', 'C1', 'Passé simple (reconocer)', 'Tiempo de la narración escrita.', ['tap10']),
  ('passe-anterieur', 'C1', 'Passé antérieur (reconocer)', 'Anterioridad en la narración escrita.', ['tap11']),
  ('participio-compuesto', 'C1', 'Participio compuesto y proposiciones participiales', 'ayant terminé, une fois le rapport rédigé…', []),
  ('concesion', 'C1', 'Concesión y oposición', 'quoique, si… que, avoir beau, tout… que, quand bien même.', []),
  ('hipotesis-avanzada', 'C1', 'Hipótesis sin si', 'au cas où, pour peu que, à supposer que, à condition que.', []),
  ('modalizacion', 'C1', 'Modalización', 'il semblerait que, condicional periodístico, adverbios de opinión.', []),
  ('inversion', 'C1', 'Inversión del sujeto en registro culto', 'À peine…, Sans doute…, Peut-être…, Ainsi…', []),
  ('ne-expletivo', 'C1', 'Ne expletivo', 'avant qu\'il ne parte, de peur qu\'il ne…', []),
  ('subjuntivo-literario', 'C2', 'Subjuntivo imperfecto y pluscuamperfecto (reconocer)', 'qu\'il fût, qu\'il eût fait.', []),
  ('valores-tiempos', 'C2', 'Valores estilísticos de los tiempos', 'Presente histórico, imperfecto narrativo, futuro histórico.', []),
  ('sintaxis-oral-escrita', 'C2', 'Sintaxis oral frente a escrita', 'Omisión de ne, dislocaciones, elipsis; cuándo usar cada una.', []),
]

EN_GRAMATICA = [
  ('to-be', 'A1', 'Verb to be', 'Present and past; affirmative, negative, questions.', []),
  ('present-simple', 'A1', 'Present simple', 'Routines and facts; -s ending; do/does.', []),
  ('present-continuous', 'A1', 'Present continuous', 'Actions now and temporary situations.', []),
  ('have-got', 'A1', 'Have / have got', 'Possession; questions and negatives.', []),
  ('can', 'A1', 'Can / can\'t', 'Ability, permission and requests.', []),
  ('there-is', 'A1', 'There is / there are', 'Existence; some/any.', []),
  ('articulos', 'A1', 'Articles a/an/the', 'First mention, unique things, zero article basics.', []),
  ('plurales', 'A1', 'Plural nouns', 'Regular and irregular plurals.', []),
  ('posesivos', 'A1', 'Possessives', 'my, your…; \'s and of.', []),
  ('demostrativos', 'A1', 'this, that, these, those', 'Demonstratives.', []),
  ('pronombres', 'A1', 'Subject and object pronouns', 'I/me, he/him…', []),
  ('imperativo', 'A1', 'Imperatives', 'Instructions and advice; let\'s.', []),
  ('preposiciones-tiempo-lugar', 'A1', 'Prepositions of time and place', 'in, on, at.', []),
  ('preguntas-wh', 'A1', 'Wh- questions', 'what, where, when, who, why, how (much/many/often).', []),
  ('contables', 'A1', 'Countable and uncountable nouns', 'some, any, a lot of.', []),
  ('past-simple', 'A2', 'Past simple', 'Regular and irregular verbs; did.', []),
  ('past-continuous', 'A2', 'Past continuous', 'Background actions; when / while.', []),
  ('going-to', 'A2', 'Be going to', 'Plans and evidence-based predictions.', []),
  ('will', 'A2', 'Will', 'Predictions, offers and instant decisions.', []),
  ('present-perfect', 'A2', 'Present perfect', 'Experience; just, already, yet, ever, never.', []),
  ('comparativos', 'A2', 'Comparatives and superlatives', '-er/-est, more/most, as… as; irregular forms.', []),
  ('adverbios-frecuencia', 'A2', 'Adverbs of frequency and manner', 'always, usually…; -ly adverbs and position.', []),
  ('cuantificadores', 'A2', 'Much, many, a few, a little', 'Quantifiers.', []),
  ('obligacion', 'A2', 'Must, have to, should', 'Obligation, necessity and advice.', []),
  ('verbo-ing-to', 'A2', 'Verb + -ing or to-infinitive (1)', 'like, enjoy, want, decide…', []),
  ('posesivos-pron', 'A2', 'Possessive pronouns', 'mine, yours… whose.', []),
  ('primer-condicional', 'A2', 'First conditional', 'If + present, will.', []),
  ('preguntas-sujeto', 'A2', 'Subject and object questions', 'Who called? / Who did you call?', []),
  ('pp-continuous', 'B1', 'Present perfect continuous', 'Duration up to now; for / since.', []),
  ('pp-vs-past', 'B1', 'Present perfect or past simple', 'Finished vs unfinished time.', []),
  ('past-perfect', 'B1', 'Past perfect', 'Earlier past.', []),
  ('used-to', 'B1', 'Used to and would', 'Past habits and states.', []),
  ('futuros', 'B1', 'Future forms compared', 'will, going to, present continuous, present simple.', []),
  ('condicional-0-2', 'B1', 'Zero and second conditionals', 'General truths; unreal present.', []),
  ('pasiva-basica', 'B1', 'Passive (present and past)', 'be + past participle; by.', []),
  ('relativas', 'B1', 'Defining relative clauses', 'who, which, that, where, whose.', []),
  ('estilo-indirecto', 'B1', 'Reported speech (statements)', 'Backshift; say vs tell.', []),
  ('deduccion-presente', 'B1', 'Modals of deduction (present)', 'must, might, could, can\'t.', []),
  ('reflexivos', 'B1', 'Reflexive pronouns', 'myself, themselves; each other.', []),
  ('so-such', 'B1', 'So, such, too, enough', 'Degree and result.', []),
  ('question-tags', 'B1', 'Question tags and indirect questions', 'isn\'t it?; Could you tell me where…?', []),
  ('phrasal-1', 'B1', 'Phrasal verbs (1)', 'Common phrasal verbs and their meaning.', []),
  ('futuro-continuo-perfecto', 'B2', 'Future continuous and future perfect', 'will be doing; will have done.', []),
  ('tercer-condicional', 'B2', 'Third and mixed conditionals', 'Unreal past; past cause, present result.', []),
  ('pasiva-completa', 'B2', 'Passive: all forms', 'Continuous, perfect and modal passives; get passive.', []),
  ('causativo', 'B2', 'Causative have/get', 'have something done; get someone to do.', []),
  ('relativas-explicativas', 'B2', 'Non-defining relative clauses', 'Commas; which referring to a clause; prepositions + whom/which.', []),
  ('estilo-indirecto-2', 'B2', 'Reported questions, commands and reporting verbs', 'ask, advise, deny, claim, suggest…', []),
  ('deduccion-pasado', 'B2', 'Modals of deduction (past)', 'must have, might have, can\'t have done.', []),
  ('wish', 'B2', 'Wish, if only, would rather, it\'s time', 'Regrets and preferences.', []),
  ('participiales', 'B2', 'Participle clauses', 'Having finished…, Built in 1900…', []),
  ('contraste', 'B2', 'Contrast and concession', 'although, despite, in spite of, whereas, however.', []),
  ('articulos-2', 'B2', 'Articles: advanced uses', 'Generic reference, institutions, abstract nouns.', []),
  ('cuantificadores-2', 'B2', 'Quantifiers: advanced', 'each, every, either, neither, both, none of.', []),
  ('verbo-ing-to-2', 'B2', 'Verb patterns (2)', 'remember/stop/try + -ing or to; verb + object + infinitive.', []),
  ('pasiva-impersonal', 'B2', 'Impersonal passive', 'It is said that… / He is said to…', []),
  ('phrasal-2', 'B2', 'Phrasal verbs (2)', 'Separable and inseparable; three-part verbs.', []),
  ('enfatico', 'B2', 'Emphasis with do and auxiliaries', 'I do agree; She did call.', []),
  ('inversion', 'C1', 'Inversion after negative adverbials', 'Never have I…, Not only…, Hardly… when, Little did they know.', []),
  ('condicional-sin-if', 'C1', 'Conditionals without if', 'Had I known…, Should you need…, Were it not for…, provided that, unless.', []),
  ('cleft', 'C1', 'Cleft sentences', 'It was… that…; What I need is…', []),
  ('subjuntivo', 'C1', 'The subjunctive', 'It is essential that he be…; formal suggestions.', []),
  ('modales-pasado', 'C1', 'Modals in the past: nuances', 'needn\'t have vs didn\'t need to; should have; would have.', []),
  ('futuro-pasado', 'C1', 'Future in the past', 'was going to, was to, was about to, would.', []),
  ('elipsis', 'C1', 'Ellipsis and substitution', 'so, not, do so, one/ones.', []),
  ('nominalizacion', 'C1', 'Nominalisation', 'Formal written style: the introduction of…, the rise in…', []),
  ('fronting', 'C1', 'Fronting', 'Moving information to the start for emphasis or cohesion.', []),
  ('participiales-2', 'C1', 'Participle clauses (advanced)', 'Having been told…, Being the eldest…', []),
  ('formulas-subjuntivo', 'C2', 'Formulaic subjunctive and fixed expressions', 'be that as it may, come what may, so be it.', []),
  ('estilo', 'C2', 'Style and register in grammar', 'Choosing structures for tone, emphasis and formality.', []),
]

def lexico(lengua):
    """Bloque de léxico y funciones comunicativas (iguales para las dos lenguas; los contenidos de cada ficha cambian)."""
    base = [
      ('presentarse', 'A1', 'Saludar y presentarse', 'Saludos, datos personales, profesiones.'),
      ('numeros-tiempo', 'A1', 'Números, fecha y hora', 'Contar, precios, horas, días y meses.'),
      ('familia', 'A1', 'Familia y relaciones', 'Parentesco y descripción de personas.'),
      ('vida-diaria', 'A1', 'Rutina y vida diaria', 'Acciones habituales, casa, tiempo libre.'),
      ('comida', 'A1', 'Comida y compras básicas', 'Alimentos, restaurante, cantidades.'),
      ('ciudad', 'A1', 'Ciudad y orientación', 'Lugares, transporte, pedir y dar direcciones.'),
      ('trabajo-estudios', 'A2', 'Trabajo y estudios', 'Profesiones, tareas, formación.'),
      ('viajes', 'A2', 'Viajes y alojamiento', 'Reservas, aeropuerto, hotel, incidencias.'),
      ('salud', 'A2', 'Salud y cuerpo', 'Síntomas, médico, hábitos saludables.'),
      ('dinero', 'A2', 'Dinero y consumo', 'Pagar, banco, comprar y devolver.'),
      ('clima', 'A2', 'Tiempo y clima', 'El tiempo que hace y las estaciones.'),
      ('gustos', 'A2', 'Gustos y opiniones sencillas', 'Me gusta, prefiero, pienso que…'),
      ('medios', 'B1', 'Medios de comunicación', 'Prensa, radio, redes; noticias.'),
      ('medio-ambiente', 'B1', 'Medio ambiente', 'Contaminación, energía, cambio climático.'),
      ('conectores-1', 'B1', 'Conectores básicos', 'Causa, consecuencia, oposición, adición, orden.'),
      ('opinar', 'B1', 'Opinar, acordar y discrepar', 'Fórmulas para dar y rebatir opiniones.'),
      ('narrar', 'B1', 'Contar experiencias', 'Marcadores temporales y de secuencia.'),
      ('sociedad', 'B1', 'Sociedad y convivencia', 'Igualdad, migración, educación, vivienda.'),
      ('economia', 'B2', 'Economía y empresa', 'Crecimiento, empleo, inflación, mercados, comercio.'),
      ('politica', 'B2', 'Política e instituciones', 'Gobierno, parlamento, elecciones, Unión Europea.'),
      ('ciencia-tecnologia', 'B2', 'Ciencia y tecnología', 'Investigación, digital, inteligencia artificial.'),
      ('conectores-2', 'B2', 'Conectores de argumentación', 'Concesión, reformulación, ejemplificación, conclusión.'),
      ('matizar', 'B2', 'Matizar y atenuar', 'Expresar probabilidad, prudencia y grados de certeza.'),
      ('tendencias-cifras', 'B2', 'Describir tendencias y cifras', 'Subir, bajar, estabilizarse; porcentajes y comparaciones.'),
      ('colocaciones', 'B2', 'Colocaciones frecuentes', 'Combinaciones naturales de palabras (tomar una decisión…).'),
      ('falsos-amigos', 'B2', 'Falsos amigos con el español', 'Palabras parecidas con distinto significado.'),
      ('registro', 'B2', 'Registro formal, neutro y coloquial', 'Elegir palabras según la situación.'),
      ('formacion-palabras', 'B2', 'Formación de palabras', 'Prefijos, sufijos y familias de palabras.'),
      ('prensa-idiomatica', 'C1', 'Expresiones idiomáticas de la prensa', 'Locuciones habituales en artículos y editoriales.'),
      ('abstracto', 'C1', 'Vocabulario abstracto', 'Nombres de ideas, procesos y cualidades.'),
      ('exposicion', 'C1', 'Estructurar una exposición oral', 'Abrir, enlazar partes, ganar tiempo y cerrar.'),
      ('sintesis', 'C1', 'Resumir y reformular', 'Verbos introductores y paráfrasis.'),
      ('debate', 'C1', 'Debatir y responder preguntas', 'Pedir aclaraciones, matizar, concluir.'),
      ('derecho-justicia', 'C1', 'Derecho y justicia', 'Leyes, tribunales, derechos.'),
      ('cultura', 'C1', 'Cultura y artes', 'Literatura, cine, patrimonio.'),
      ('estilo', 'C2', 'Matices de estilo', 'Sinónimos con matices, ironía y atenuación.'),
      ('alusiones', 'C2', 'Refranes y alusiones culturales', 'Referencias que da por sabidas un hablante nativo.'),
      ('especializado', 'C2', 'Léxico especializado', 'Finanzas, diplomacia, comercio internacional.'),
    ]
    if lengua == 'en':
        base.insert(17, ('phrasal-tematicos', 'B1', 'Phrasal verbs por temas', 'Trabajo, relaciones, dinero, problemas.'))
    return [(i, n, t, d, []) for i, n, t, d in base]

FONETICA = {
  'fr': [
    ('alfabeto-sonidos', 'A1', 'Sonidos del francés', 'Vocales y consonantes; letras que no se pronuncian.'),
    ('vocales-orales', 'A1', 'Vocales: u/ou, e/é/è, eu', 'Contrastes difíciles para hispanohablantes.'),
    ('nasales', 'A2', 'Vocales nasales', 'an/en, on, in/un.'),
    ('liaison', 'A2', 'Liaison y enchaînement', 'Enlaces obligatorios, prohibidos y facultativos.'),
    ('e-muda', 'B1', 'E muda', 'Cuándo se pronuncia y cuándo desaparece.'),
    ('r-francesa', 'A2', 'La r francesa', 'Articulación.'),
    ('cifras', 'B1', 'Leer cifras, fechas y porcentajes', 'soixante-dix, quatre-vingt-dix, millions…'),
    ('entonacion', 'B2', 'Entonación y ritmo', 'Grupo rítmico, acento final, entonación de la pregunta.'),
    ('lectura-expresiva', 'C1', 'Lectura en voz alta expresiva', 'Pausas, énfasis y ritmo al leer un texto propio.'),
  ],
  'en': [
    ('sonidos', 'A1', 'English sounds', 'Vowels and consonants; silent letters.'),
    ('vocales-largas', 'A1', 'Long and short vowels', 'ship/sheep, full/fool.'),
    ('th', 'A2', 'th sounds', 'think / this.'),
    ('terminaciones', 'A2', '-ed and -s endings', '/t/, /d/, /ɪd/; /s/, /z/, /ɪz/.'),
    ('acento-palabra', 'B1', 'Word stress', 'ECOnomy / ecoNOMic; stress shift.'),
    ('schwa', 'B1', 'Schwa and weak forms', 'to, for, can, of in connected speech.'),
    ('cifras', 'B1', 'Reading numbers, dates and percentages', 'billion, per cent, decimals.'),
    ('entonacion', 'B2', 'Intonation and connected speech', 'Linking, sentence stress, rising/falling tones.'),
    ('lectura-expresiva', 'C1', 'Expressive reading aloud', 'Pauses, emphasis and pace when reading your own text.'),
  ],
}

DESTREZAS = [
  ('notas', 'B1', 'Tomar notas al escuchar', 'Abreviaturas, estructura y palabras clave.', 2),
  ('idea-principal', 'B1', 'Idea principal y detalles', 'Distinguir lo esencial de los datos.', 2),
  ('resumen', 'B2', 'Hacer un resumen', 'Tesis, argumentos y conclusión sin copiar.', 2),
  ('opinion', 'B2', 'Escribir un artículo de opinión', 'Tesis, argumentos, concesión y cierre.', 2),
  ('carta', 'B1', 'Cartas y correos', 'Formales e informales: fórmulas y estructura.', 2),
  ('exposicion-oral', 'C1', 'Exposición oral de un texto', '5 minutos: presentar, resumir, valorar.', 3),
  ('preguntas-tribunal', 'C1', 'Responder preguntas', 'Ganar tiempo, matizar y concluir.', 3),
]

ORDEN = {'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6}

def materias(lengua):
    out = []
    gram = FR_GRAMATICA if lengua == 'fr' else EN_GRAMATICA
    for i, n, t, d, tex in gram:
        out.append({'id': f'{lengua}.g.{i}', 'bloque': 'gramatica', 'nivel': n, 'titulo': t, 'descripcion': d,
                    'fuente': ({'nombre': "Tex's French Grammar", 'paginas': tex} if tex else {'nombre': 'propia'}), 'fase': 1})
    for i, n, t, d, _ in lexico(lengua):
        out.append({'id': f'{lengua}.l.{i}', 'bloque': 'lexico', 'nivel': n, 'titulo': t, 'descripcion': d, 'fuente': {'nombre': 'propia'}, 'fase': 1})
    for i, n, t, d in FONETICA[lengua]:
        out.append({'id': f'{lengua}.f.{i}', 'bloque': 'fonetica', 'nivel': n, 'titulo': t, 'descripcion': d, 'fuente': {'nombre': 'propia'}, 'fase': 3})
    for i, n, t, d, f in DESTREZAS:
        out.append({'id': f'{lengua}.d.{i}', 'bloque': 'destrezas', 'nivel': n, 'titulo': t, 'descripcion': d, 'fuente': {'nombre': 'propia'}, 'fase': f})
    out.sort(key=lambda m: (['gramatica', 'lexico', 'fonetica', 'destrezas'].index(m['bloque']), ORDEN[m['nivel']]))
    ids = [m['id'] for m in out]
    assert len(ids) == len(set(ids)), 'id repetido'
    return out

if __name__ == '__main__':
    destino = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', '..', 'idiomas')
    for lengua in ('fr', 'en'):
        os.makedirs(os.path.join(destino, lengua), exist_ok=True)
        m = materias(lengua)
        with open(os.path.join(destino, lengua, 'materias.json'), 'w', encoding='utf-8') as f:
            json.dump({'lengua': lengua, 'version': 1, 'materias': m}, f, ensure_ascii=False, indent=1)
        cuenta = {}
        for x in m: cuenta[(x['bloque'], x['nivel'])] = cuenta.get((x['bloque'], x['nivel']), 0) + 1
        print(lengua, len(m), 'materias', {b: sum(v for (bb, _), v in cuenta.items() if bb == b) for b in ('gramatica', 'lexico', 'fonetica', 'destrezas')})
