# Calendario de vueltas

Cómo genera y ajusta el Panel TCEE los calendarios de estudio.
Está escrito para poder rehacer o revisar un calendario **sin depender de Claude**.
Código: `extension/calendario.js` (calendario) y `extension/afinidad.js` (relaciones entre temas). Si se cambia una regla aquí, hay que cambiarla también en el código.

## 1. Qué es un calendario

- Hay **un calendario por vuelta y por ejercicio**, por ejemplo «2ª vuelta, 3er ejercicio». Se pueden tener varios y elegir cuál se ve.
- El 3er y el 4º ejercicio **no se mezclan nunca** en un calendario: son compartimentos estancos.
  El 4º se añadirá cuando esté su programa (`config/programa_4.json`).
- Una **semana termina el día de cante**. Ese día se cantan sus temas, normalmente 5 en la 2ª vuelta.
- Los días anteriores al cante, desde el día siguiente al cante anterior, son **días de estudio**, salvo el **día libre** semanal, que se elige al crear el calendario.
- El programa del ejercicio está en `config/programa_3.json`: 45 temas de la Parte A y 45 de la Parte B, con su título.
  Un tema que no tenga carpeta en el temario (hoy, 3.A.14) entra igual en el calendario.

## 2. Qué se le puede pedir al crear un calendario

| Opción | Qué hace |
|---|---|
| Temas por semana | Cuántos temas se cantan cada semana. La última semana lleva los que sobren. |
| Modo **temático** | Agrupa los temas por afinidad (apartado 4), con total libertad respecto al orden del programa. |
| Modo **correlativo** | Toda la Parte A por orden (A.1, A.2…) y después toda la Parte B, en bloques del tamaño elegido. No intercala. |
| Modo **aleatorio** | Orden al azar. Cada variante se puede repetir porque lleva una «semilla» que la identifica. |
| Intercalar A y B | En los modos temático y aleatorio, mezcla A y B **dentro de cada semana** (apartado 3). Si no se marca, primero van todas las semanas de la A y luego las de la B. |
| Tener en cuenta los calendarios de referencia | En el modo temático, usa como una señal más la forma de agrupar de los calendarios marcados como referencia (p. ej. el de la preparadora). |
| Fecha del primer cante y día libre | Fijan las fechas. Cada semana siguiente canta 7 días después. |
| Otra variante | Repite la generación con otra semilla y da otra agrupación igual de válida. |

## 3. Proporción A/B al intercalar

La proporción global de A y B se reparte de forma acumulada entre las semanas.
Con 45 A, 45 B y 5 temas por semana sale **3 A + 2 B, 2 A + 3 B, 3 A + 2 B…**, igual que en el calendario de la preparadora.
En general, cada semana lleva el número de temas A que hace que el total acumulado se acerque lo más posible a la proporción global.
En el modo temático, las semanas se reordenan después por contenido (apartado 5). Cada semana conserva su número de temas A (2 o 3 en el ejemplo), pero ya no alternan necesariamente.

## 4. Afinidad entre temas: cómo se decide qué va con qué

La afinidad entre dos temas es un número de 0 a 1 que combina cinco señales:

| Señal | Peso | Qué mide |
|---|---|---|
| **Referencia** | 0,30 | Los dos temas comparten semana en un calendario de referencia (el de la preparadora). Recoge un criterio pedagógico que los datos no ven. |
| **Remisiones** | 0,20 | Un tema remite al otro en el texto («Ver Tema 3.A.44»), en cualquier sentido. 0,5 por remisión, con un máximo de 1. |
| **Modelos** | 0,15 | Desarrollan matemáticamente los mismos modelos (`analisis/desarrollos.json`). 0,5 por modelo común, con un máximo de 1. |
| **Léxico** | 0,25 | Hablan de lo mismo. Similitud de vocabulario (TF-IDF, coseno) entre el título y el subtítulo (×3), los epígrafes (×2) y el texto (×1). Se ignoran las palabras genéricas y las de la plantilla (Introducción, Relevancia…). Se escala para que el 1 % de parejas más parecidas valga 1. |
| **Programa** | 0,10 | Cercanía en el programa: temas consecutivos de la misma parte valen 0,6, a dos de distancia 0,3, y las series de un mismo título («Análisis de mercados (I)…(IV)») valen 1. |

Si no hay calendarios de referencia, o no se marca esa opción, el peso de la referencia se reparte proporcionalmente entre las otras cuatro señales.
Las señales se recalculan cada vez que se crea un calendario, así que siguen los cambios del temario.

## 5. Modo temático: el algoritmo

1. **Punto de partida**: el orden del programa, como haría una preparadora, respetando las cuotas A/B del apartado 3.
2. **Mejora**: se prueban, una y otra vez (150.000 intentos), intercambios de dos temas **de la misma parte** entre dos semanas.
   Así se conservan las cuotas A/B. Se acepta el cambio si mejora la agrupación. Al principio también se acepta alguno que empeora, cada vez menos, para no quedarse en una solución mediocre (*recocido simulado*).
3. **Qué se considera «mejor»**: para cada tema se calcula su **encaje**, la afinidad media con sus compañeros de semana, y se suma el logaritmo de (0,05 + encaje) de todos los temas.
   El logaritmo castiga mucho dejar un tema **huérfano** en una semana que no le corresponde. Es preferible que todos encajen razonablemente a que unas semanas sean perfectas y otras un cajón de sastre.
4. **Orden de las semanas**: de lo más básico a lo más avanzado, según la posición media en el programa.
   Al intercalar, cuenta la posición de los temas de la Parte A (la teoría de base, como en el calendario de la preparadora), y la semana incompleta va al final.
   Si no se intercala, primero van las semanas de la A y luego las de la B; la semana incompleta de cada parte, si la hay, va al final de esa parte.
   Dentro de la semana, primero los temas A y luego los B, por número.
5. **Series en orden**: en los temas con el mismo título numerado («Teoría de la demanda del consumidor (I), (II), (III)»), el (I) nunca va en una semana posterior al (II), y así sucesivamente.
   Si ocurre, se intercambian sus puestos. Las series largas, de más de 4 temas (como «Unión Europea (I)…(VII)»), no se fuerzan: cada tema es un ámbito distinto.
6. **Nombre del bloque**: el título del tema A más central de la semana (el de mayor afinidad con los demás), junto con el del tema B más central.
7. **Reproducible**: con las mismas opciones, la misma semilla y el mismo temario, sale el mismo calendario.

## 6. Reparto de los temas entre los días de estudio

- Cada tema pesa **1** (estudiarlo) **+ lo que le falte por redactar**: +1 por cada 5 horas de tiempo restante, con un máximo de +2.
  Un tema sin carpeta en el temario pesa 3.
- Los temas se reparten **en orden** entre los días de estudio, de forma que cada día cargue lo mismo. Un tema pesado puede ocupar parte de dos días («empieza», «continúa», «termina»).
  No se dejan trozos de menos del 10 % de un tema: ese trozo pasa entero al día siguiente o se termina ese mismo día. En el calendario, el porcentaje junto a un tema es la parte que toca ese día.
- El reparto **se recalcula solo** cuando cambia algo: un día librado, un cambio del día de cante, un tema que se mueve, o el tiempo restante.

## 7. Ajustes sobre la marcha (calendario dinámico)

| Situación | Qué se puede hacer |
|---|---|
| Libras un día que tocaba estudiar | **Repartir en la semana**: sus temas se reparten entre los demás días de esa semana. **Pasar a la semana siguiente**: los temas que se estudiaban sobre todo ese día (al menos la mitad del tema) pasan a la semana siguiente. Cada vez se elige entre **absorber** (la semana siguiente tiene más temas y el resto del calendario no se mueve; si una semana queda sobrecargada se avisa) y **desplazar** (todo el calendario corre un puesto y, si hace falta, se añade una semana al final). |
| Quieres estudiar en tu día libre | Ese día pasa a ser de estudio y el reparto se recalcula. Un día librado también se puede deshacer. |
| Cambia el día de cante de una semana | Pulsando un día: «Cantar aquí la semana N» (adelanta el cante) o «Retrasar aquí el cante de la semana N−1» (si el día es de la semana siguiente). Debe quedar entre el cante anterior y el siguiente. Los días de estudio de las dos semanas afectadas se ajustan solos. Si una semana se queda sin días de estudio, se avisa. |
| Cambiar el orden de estudio dentro de la semana | Un tema se estudia antes o después que otro. |
| Un tema salta a la semana siguiente | Igual que al librar un día: se elige absorber o desplazar. |
| Cantar | Cada tema tiene su marca de **cantado**. Una semana está cumplida cuando todos sus temas están cantados. «Cantado» es independiente de «hecho» (listo para estudiar sobre esquema). |

## 8. Dónde se guarda

- Cada calendario es un fichero en el repositorio **privado** `progreso`, en la carpeta `calendarios/<id>.json`. Se sincroniza con el botón de siempre.
- El de la preparadora está importado como `calendarios/preparadora-2a-vuelta-3.json`, marcado como **referencia**.
  Su agrupación original se guarda aparte (`referenciaSemanas`), para que los ajustes del día a día no cambien la señal de referencia.
- Contenido de cada fichero: opciones de creación, semanas (fecha de cante, temas, bloque, orden manual), día libre, días librados, días de estudio extra y temas cantados con su fecha.

## 9. Cómo comprobar o rehacer un calendario sin Claude

1. Panel Oposición › Calendario › **Nuevo calendario**. Elige las opciones del apartado 2 y mira la vista previa.
   **Otra variante** genera otra agrupación con las mismas reglas.
2. Para revisar por qué dos temas están juntos, consulta las señales del apartado 4:
   - remisiones: busca «Ver Tema» en los dos temas;
   - modelos: `analisis/desarrollos.json`;
   - programa: si los números son consecutivos o forman una serie.
3. Para cambiar el criterio (por ejemplo, dar más peso a los modelos), cambia los pesos en `extension/afinidad.js` y en la tabla del apartado 4, y vuelve a empaquetar el panel (ver `CLAUDE.md`).

## 10. Las dos propuestas iniciales (4 de octubre de 2026)

Con el temario de esa fecha se generaron dos calendarios temáticos de la 2ª vuelta, con 5 temas por semana, intercalados, primer cante el 7 de octubre y sábado libre. Ambos están en `progreso/calendarios`.

| Calendario | Encaje medio* | Temas huérfanos* | Parejas de la preparadora que conserva |
|---|---|---|---|
| Preparadora | 0,183 | 9 | 180 de 180 |
| Propuesta «preparadora + temario» (con referencia) | 0,199 | 9 | 128 de 180 |
| Propuesta «solo temario» (sin referencia) | 0,243 | 0 | 34 de 180 |

\* Medidos solo con las señales del temario (sin la de referencia). Por eso favorecen a la propuesta «solo temario», que se optimiza con esa misma medida: no son una prueba de que sea mejor.
Un tema es «huérfano» si su afinidad media con los compañeros de semana es menor que 0,08.

Lectura: la propuesta «solo temario» agrupa mejor por contenido, pero comete errores pedagógicos que la preparadora no comete. Por ejemplo, junta la demanda del consumidor (A.8, A.9) con temas de la Unión Europea por coincidencias de vocabulario.
La propuesta mixta conserva el 70 % del criterio de la preparadora y cambia lo que el temario respalda con claridad. Por ejemplo, crisis financieras y pánicos bancarios van junto con renta fija y regulación, y los tres temas de política fiscal (A.38–A.40) van juntos.
Con la versión de las reglas que haya en cada momento, las cifras pueden variar: rehacer la comparación es parte de revisar un calendario.
