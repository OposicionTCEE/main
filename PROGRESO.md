# Reglas del progreso de los temas

Cómo calcula el Panel TCEE el **tiempo restante** y el **porcentaje** de cada tema.
Código: `extension/progreso.js`. Si se cambia una regla aquí, hay que cambiarla también en el código, y al revés.

## Qué significa «hecho»

Un tema está hecho cuando está **listo para pasar a estudiar sobre esquema**. No significa que esté memorizado.
El historial de revisiones no se usa para decidirlo.

## Qué se ve

En la cabecera de la ventana *Acciones*, para el tema que se muestra en el índice:

> **Tiempo restante: 3 h 20 min (62 %)**   ✓

- El botón **✓ Hecho** marca el tema como hecho: pasa a **0 min (100 %)**, diga lo que diga el texto. Si se desmarca, vuelve al cálculo.
- No se tiene en cuenta la fecha del examen.
- No se muestran los indicadores por separado. El detalle está en «…» › *Ver de dónde sale el tiempo restante*.

## 1. Trabajo pendiente: indicadores y pesos

Cada pendiente vale unas **unidades de trabajo**:

| Indicador | Cómo se detecta | Unidades |
|---|---|---|
| Epígrafe vacío | Epígrafe final (sin subepígrafes) sin contenido: lo que se ve con ○ en el índice | 1 cada uno |
| Nota pendiente | Cada párrafo o `\item` dentro de `\modificaciones{…}`. No cuenta la línea «Última modificación…» | 0,5 cada una |
| OJO | Cada «OJO» en el texto del tema, fuera de `\modificaciones` | 0,3 cada uno |
| Sin PDF | La última compilación en ese Mac no generó PDF. Si el tema no se ha compilado nunca allí, no penaliza | 1 |
| Errores OCR o Markdown pegado | `#` sin escapar (salvo en direcciones web y parámetros `#1`), `**`, `�`, caracteres de control o invisibles, etiquetas `[Seguro]`, `[Probable]` y `[Suposición]` | 0,02 cada uno, con un máximo de 2 por tema |

La longitud del tema **no** es un indicador de avance. Solo se usa para detectar temas poco desarrollados (regla 2).

## 2. Temas poco desarrollados

Un tema vacío o muy escueto no tiene epígrafes vacíos que contar, y parecería casi terminado. Para evitarlo:

- Se cuentan las palabras del cuerpo del tema, sin el bloque `\modificaciones`.
- Si hay **menos de 5.000 palabras**, lo que falta hasta ese mínimo se convierte en epígrafes pendientes:
  **24 × (1 − palabras / 5.000)**, menos los epígrafes vacíos que ya se cuentan, y nunca menos de 0.
- 24 es la mediana de epígrafes finales de un tema del temario. 5.000 palabras está por debajo de lo que tiene cualquier tema desarrollado.
- Por encima de 5.000 palabras, la extensión no influye.

## 3. Ritmo: minutos por unidad

- **Se mide solo.** El cronómetro cuenta cuando VS Code está en primer plano, el editor activo es el `main.tex` de un tema y se ha tecleado en ese tema en los últimos **5 minutos**. Si no, se para solo.
- Al cambiar de tema, el tiempo pasa al nuevo. No cuenta el tiempo en temas marcados como hechos.
- Cada 5 minutos de trabajo, y al cambiar de tema o parar, se anota:
  - **minutos trabajados**;
  - **unidades resueltas**: la bajada de unidades pendientes en ese rato. Si suben, por ejemplo porque se añade una nota, cuenta 0.
- **Ritmo** = (minutos + 30 × 10) / (unidades + 10).
  Al principio vale 30 min por unidad (supuesto inicial). Con los datos reales se ajusta poco a poco, y el supuesto inicial pesa como 10 unidades.

## 4. Tiempo restante y porcentaje

- **Tiempo restante** = unidades pendientes × ritmo.
  Se redondea al minuto y, por encima de una hora, a múltiplos de 5 min.
- **Porcentaje** = hecho / (hecho + pendiente), donde:
  - **hecho** = epígrafes finales con contenido (1 cada uno) + lo que han bajado las notas, OJO, errores y sin PDF desde la primera vez que se midió el tema (su *línea base*);
  - **pendiente** = unidades pendientes.

## 5. Dónde se guarda

- En el repositorio **privado** `OposicionTCEE/progreso`, en la carpeta `TCEE/progreso`. Se sincroniza con el botón de siempre.
- Cada Mac escribe solo su fichero `equipos/<nombre-del-Mac>.json`, así que nunca hay conflictos. El panel suma los de todos los Mac.
- En cada fichero, por tema: minutos trabajados, unidades resueltas, línea base y marca de hecho con fecha. Si hay dos marcas, gana la más reciente.
- Si falta la carpeta `progreso`, los datos se guardan dentro de VS Code y se pasan al fichero cuando aparece.
- Estos datos **nunca** se copian a `main` ni a `temario`, que son públicos.
