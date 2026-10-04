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
- El programa del ejercicio está en `config/programa_3.json`: 45 temas de la Parte A y 45 de la Parte B. Cada tema tiene:
  - **título**;
  - **resumen** (`corto`), como en el calendario de la preparadora, por ejemplo «Demanda del consumidor (III). Riesgo e incertidumbre»;
  - **etiqueta breve** (`breve`), la que se ve en el calendario, por ejemplo «Consumidor III: riesgo»;
  - **ámbitos temáticos** (`ambitos`): el primero es el principal (apartado 4).

  Un tema que no tenga carpeta en el temario (hoy, 3.A.14) entra igual en el calendario.

## 2. Qué se le puede pedir al crear un calendario

| Opción | Qué hace |
|---|---|
| Temas por semana | Cuántos temas se cantan cada semana. La última semana lleva los que sobren. |
| Modo **temático** | Agrupa los temas por afinidad (apartado 4), con total libertad respecto al orden del programa, y encadena las semanas para que cada una guarde relación con la siguiente (apartado 5). |
| Modo **correlativo** | Toda la Parte A por orden (A.1, A.2…) y después toda la Parte B, en bloques del tamaño elegido. No intercala. |
| Modo **aleatorio** | Orden al azar. Cada variante se puede repetir porque lleva una «semilla» que la identifica. |
| Intercalar A y B | En los modos temático y aleatorio, mezcla A y B **dentro de cada semana** (apartado 3). Si no se marca, primero van todas las semanas de la A y luego las de la B. |
| Empezar por | **Lo más básico**: la semana de temas más básicos del programa. **Un tema concreto**: el calendario empieza por la semana de ese tema, y ese tema es el primero que se estudia. **Un tema al azar**. Vale para los tres modos. En el correlativo, la parte del tema elegido empieza en él y da la vuelta (A.10 … A.45, A.1 … A.9) antes de pasar a la otra parte. |
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
| **Ámbitos** | 0,35 | Comparten ámbito temático (`ambitos` en el programa). Mismo ámbito principal vale 1; si el principal de uno es ámbito del otro, 0,6; si solo comparten un ámbito secundario, 0,3. |
| **Programa** | 0,30 | Cercanía en el programa: temas consecutivos de la misma parte valen 0,6, a dos de distancia 0,3, y las series de un mismo título («Análisis de mercados (I)…(IV)») valen 1. |
| **Léxico** | 0,15 | Hablan de lo mismo. Similitud de vocabulario (TF-IDF, coseno) entre el título y el subtítulo (×3), los epígrafes (×2) y el texto (×1). Se ignoran las palabras genéricas y las de la plantilla (Introducción, Relevancia…). Se escala para que el 1 % de parejas más parecidas valga 1. |
| **Remisiones** | 0,10 | Un tema remite al otro en el texto («Ver Tema 3.A.44»), en cualquier sentido. 0,5 por remisión, con un máximo de 1. |
| **Modelos** | 0,10 | Desarrollan matemáticamente los mismos modelos (`analisis/desarrollos.json`). 0,5 por modelo común, con un máximo de 1. |

Las señales se recalculan cada vez que se crea un calendario, así que siguen los cambios del temario.
El calendario de la preparadora **no se usa** al generar: sirvió para fijar los ámbitos y los pesos (apartado 11).

## 5. Modo temático: el algoritmo

1. **Punto de partida**: el orden del programa, como haría una preparadora, respetando las cuotas A/B del apartado 3.
2. **Mejora**: se prueban, una y otra vez (150.000 intentos), intercambios de dos temas **de la misma parte** entre dos semanas.
   Así se conservan las cuotas A/B. Se acepta el cambio si mejora la agrupación. Al principio también se acepta alguno que empeora, cada vez menos, para no quedarse en una solución mediocre (*recocido simulado*).
3. **Qué se considera «mejor»**: para cada tema se calcula su **encaje**, la afinidad media con sus compañeros de semana, y se suma el logaritmo de (0,05 + encaje) de todos los temas.
   El logaritmo castiga mucho dejar un tema **huérfano** en una semana que no le corresponde. Es preferible que todos encajen razonablemente a que unas semanas sean perfectas y otras un cajón de sastre.
4. **Orden de las semanas: encadenadas por relación.**
   - La **relación entre dos semanas** es la afinidad media entre los temas de una y los de la otra.
   - Se empieza por la semana elegida en «Empezar por» (apartado 2). Con «lo más básico», es la de menor posición media en el programa; al intercalar, cuenta la Parte A.
   - Después, cada semana va seguida de la más relacionada con ella entre las que quedan.
   - Al final, la cadena se mejora invirtiendo tramos mientras aumente la relación total entre semanas consecutivas (*2-opt*).
   - La semana incompleta, si la hay, va al final.
   - Si no se intercala, primero van todas las semanas de una parte (la del tema de inicio; si no hay tema elegido, la A) y luego las de la otra. La primera semana de la segunda parte es la más relacionada con la última de la primera.
   - Dentro de la semana, primero los temas A y luego los B, por número, salvo el tema de inicio elegido, que va el primero.
5. **Series en orden**: en los temas con el mismo título numerado («Teoría de la demanda del consumidor (I), (II), (III)»), el (I) nunca va en una semana posterior al (II), y así sucesivamente.
   Si ocurre, se intercambian sus puestos. Las series largas, de más de 4 temas (como «Unión Europea (I)…(VII)»), no se fuerzan: cada tema es un ámbito distinto.
   El tema de inicio elegido nunca se mueve.
6. **Nombre del bloque**: se forma con los ámbitos de sus temas.
   - Cada tema suma 1 a su ámbito principal y 0,5 a cada secundario.
   - Siempre se nombra el ámbito con más peso. El segundo, si suma al menos 1, y el tercero, si suma al menos 1,5.
   - Por ejemplo, «Agregados macroeconómicos, balanza de pagos».
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
| Libras un día que tocaba estudiar | Tres opciones. **Repartir en la semana**: sus temas se reparten entre los demás días de esa semana. **Pasar a la semana siguiente**: los temas que se estudiaban sobre todo ese día (al menos la mitad del tema) pasan a la semana siguiente, que los absorbe. **Recolocar donde mejor encajen**: esos temas van a la semana por venir que mejor les corresponda (ver «Recolocar»). |
| Quieres estudiar en tu día libre | Ese día pasa a ser de estudio y el reparto se recalcula. Un día librado también se puede deshacer. |
| Cambia el día de cante de una semana | Pulsando un día: «Cantar aquí la semana N» (adelanta el cante) o «Retrasar aquí el cante de la semana N−1» (si el día es de la semana siguiente). Debe quedar entre el cante anterior y el siguiente. Los días de estudio de las dos semanas afectadas se ajustan solos. Si una semana se queda sin días de estudio, se avisa. |
| Cambiar el orden de estudio dentro de la semana | Un tema se estudia antes o después que otro. |
| Un tema sale de su semana | «A la semana siguiente» (la absorbe) o «Donde mejor encaje» (ver «Recolocar»). |
| Varias semanas sobrecargadas | Si **dos o más semanas por venir** tienen más temas de los previstos, el calendario recomienda ampliarse (ver «Ampliar»). |
| Cantar | Cada tema tiene su marca de **cantado**. Una semana está cumplida cuando todos sus temas están cantados. «Cantado» es independiente de «hecho» (listo para estudiar sobre esquema). |

**Recolocar.** El tema sale de su semana y va a la semana por venir con mejor puntuación. Puede ser cualquier semana posterior a la semana en curso, salvo la suya; también una anterior a la suya, si aún no ha empezado. La puntuación es:
- \+ afinidad media del tema con los temas de esa semana;
- − 0,15 por cada tema que la semana tendría por encima de los previstos;
- − 0,2 × exceso de carga de trabajo. La carga es la suma de los pesos de sus temas (apartado 6), comparada con la carga media prevista por semana;
- − 0,005 por cada semana de distancia, para desempatar a favor de la más cercana.

Dentro de esa semana, el tema se estudia justo después del tema con el que más relación tiene. Solo si no queda ninguna semana posterior se añade una al final.

**Ampliar.** Cuando hay dos o más semanas sobrecargadas, el calendario ofrece dos opciones:
- **Añadir semanas con los temas que sobran** (reorganización parcial): de cada semana sobrecargada sale el tema que peor encaja en ella (menor afinidad media con sus compañeros), hasta dejarla con los temas previstos. Esos temas forman semanas nuevas al final, agrupadas por afinidad y de tamaño equilibrado.
- **Reorganizar todas las semanas por venir** (reorganización completa): se rehacen en modo temático con todos sus temas y las semanas que hagan falta, encadenadas a partir de la semana en curso.

En los dos casos, la semana en curso y las pasadas no se tocan, y las semanas nuevas siguen el ritmo semanal desde el último cante que se conserva.

## 8. Dónde se guarda

- Cada calendario es un fichero en el repositorio **privado** `progreso`, en la carpeta `calendarios/<id>.json`. Se sincroniza con el botón de siempre.
- El de la preparadora está importado como `calendarios/preparadora-2a-vuelta-3.json`. Se puede ver y usar como cualquier otro, pero no interviene en la generación.
- Contenido de cada fichero: opciones de creación, semanas (fecha de cante, temas, bloque, orden manual), día libre, días librados, días de estudio extra y temas cantados con su fecha.
- **Eliminar un calendario** (botón «Eliminar calendario», con confirmación) borra su fichero. Tras sincronizar desaparece también de GitHub. Si hiciera falta recuperarlo, sigue en el historial del repositorio `progreso`.

## 9. Cómo comprobar o rehacer un calendario sin Claude

1. Panel Oposición › Calendario › **Nuevo calendario**. Elige las opciones del apartado 2 y mira la vista previa.
   **Otra variante** genera otra agrupación con las mismas reglas.
2. Para revisar por qué dos temas están juntos, consulta las señales del apartado 4:
   - remisiones: busca «Ver Tema» en los dos temas;
   - modelos: `analisis/desarrollos.json`;
   - programa: si los números son consecutivos o forman una serie;
   - ámbitos: `config/programa_3.json`.
3. Para cambiar el criterio (por ejemplo, dar más peso a los modelos), cambia los pesos en `extension/afinidad.js` y en la tabla del apartado 4, y vuelve a empaquetar el panel (ver `CLAUDE.md`).

## 10. Propuesta inicial (4 de octubre de 2026)

Con el temario de esa fecha se generó la propuesta de la 2ª vuelta: 5 temas por semana, intercalados, empezando por lo más básico, primer cante el 7 de octubre y sábado libre.
Está en `progreso/calendarios/propuesta-2a-vuelta-3.json`.

| Calendario | Encaje medio* | Temas huérfanos* | Relación entre semanas consecutivas* | Parejas de la preparadora que conserva |
|---|---|---|---|---|
| Preparadora | 0,225 | 13 | 0,172 | 180 de 180 |
| Propuesta | 0,335 | 3 | 0,184 | 45 de 180 |

\* Medidos con la afinidad del apartado 4. La propuesta se optimiza con esa misma medida, así que la tabla dice que es coherente con las reglas, no que sea mejor para estudiar.
Un tema es «huérfano» si su afinidad media con los compañeros de semana es menor que 0,1.

## 11. Qué se aprendió del calendario de la preparadora

El calendario de la preparadora sirvió para fijar las reglas una vez, de modo que después se apliquen solas.

1. **Ámbitos temáticos.** Cada tema recibió uno o varios ámbitos (23 en total, por ejemplo «Comercio internacional», «Finanzas e instrumentos financieros», «Unión Europea»).
   Se definieron con el programa, el contenido de los temas y los bloques de la preparadora. Su nombre se usa para titular las semanas.
2. **Pesos.** Se comparó, para cada pareja de temas, si la preparadora los pone en la misma semana con lo que dice cada señal.
   La medida es el AUC: 0,5 es azar y 1 es acierto pleno.
   - **Temas de la misma parte** (A con A, B con B): sus agrupaciones se explican bien.
     Por separado: ámbitos 0,78, programa 0,76, léxico 0,73, remisiones 0,59, modelos 0,52.
     El ajuste estadístico (regresión logística con pesos no negativos) da sobre todo ámbitos y programa.
     Los pesos elegidos (apartado 4) reproducen su criterio casi igual de bien: AUC 0,80, frente a 0,80 del ajuste puro.
     Se mantiene un 10 % para remisiones y otro 10 % para modelos, porque son la información propia de tu temario.
   - **Temas A con temas B**: sus emparejamientos apenas se explican por el contenido (la mejor señal, los ámbitos, da AUC 0,57).
     Parece que junta A y B sobre todo para avanzar a la vez en las dos partes, no por afinidad temática.
     Con los pesos elegidos, el calendario empareja A y B por ámbitos compartidos (AUC 0,61 frente a su criterio), que es más coherente con lo que pediste.
3. **Orden de las series.** El (I) siempre va antes que el (II), como hace ella. Las series largas, como la Unión Europea, no se fuerzan.

## 12. Cómo añadir un programa nuevo (por ejemplo, el 4º ejercicio)

1. Crear `config/programa_4.json` con la misma estructura que el del 3º. Para cada tema hacen falta `codigo`, `parte`, `titulo`, `subtitulo`, `corto`, `breve` y `ambitos`, y además la lista de `ambitos` con sus nombres.
2. Los ámbitos y las etiquetas son lo único que requiere criterio. Se pueden escribir a mano, o pedírselo a Claude: *«etiqueta el programa del 4º ejercicio siguiendo CALENDARIO.md, apartado 12»*.
3. Comprobar con «Nuevo calendario › Vista previa» que las semanas tienen sentido. Si un tema queda mal, normalmente basta con corregir sus ámbitos.
