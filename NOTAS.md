# Notas al pie contraíbles

Código: `extension/notas.js` (localiza las notas y calcula qué líneas se pliegan), `activarNotas` en `extension/extension.js`
y `scripts/notas_pie.js` (pasa las notas antiguas a la forma contraíble). Mantener este documento y el código a la vez.

## Cómo se usa

- Al abrir un tema, las notas al pie salen **contraídas**: solo se ve `\footnote{%` y un `⋯`. Se desactiva con el ajuste
  `tcee.notasContraidasAlAbrir`. La nota donde está el cursor no se contrae.
- **⌃⌘N** contrae o expande todas las notas del tema. También: *TCEE: Contraer las notas al pie* / *Expandir las notas al pie*.
- Una nota suelta se abre o cierra con la flecha del margen, junto al número de línea, como cualquier bloque.
- **⌃⇧⌘N** inserta una nota nueva ya en forma contraíble (si hay texto seleccionado, lo mete dentro).

## Por qué hay que escribirlas en varias líneas

VS Code solo puede contraer **líneas enteras**, no un trozo de una línea. Se pliegan las líneas del contenido de la nota y se dejan a la vista
la línea del `\footnote{` y la del `}` (que puede llevar detrás el resto del párrafo):

```
… texto del párrafo.\footnote{%
    Contenido de la nota, en una o varias líneas.
} Sigue el párrafo.
```

El `%` tras `\footnote{` hace falta: sin él, LaTeX vería un espacio delante del texto de la nota, tras su número.
El salto de línea antes de la `}` no lo necesita: es un espacio al final de la nota, que no se ve.
Los saltos de línea dentro del texto de la nota son espacios normales y tampoco llevan `%`; con uno, se pegarían dos palabras.

Contraída, la nota queda en dos filas: `… texto.\footnote{%⋯` y debajo `} Sigue el párrafo.`
No se puede dejar en una sola fila: VS Code solo contrae líneas enteras, y si se contrajera también la línea de la `}`
se escondería el resto del párrafo.

## El % automático

Al escribir no hay que poner ningún `%` (`activarNotas`, en `extension.js`):
- si una línea acaba en `\footnote{` y la nota sigue en la línea de abajo (por ejemplo, al pulsar Intro dentro de `\footnote{}`), se añade el `%`;
  no se hace mientras el cursor está en esa línea, para no dejarlo detrás del `%`;
- si detrás de `\footnote{%` queda texto en la misma línea (al juntar dos líneas con ⌫), se quita el `%`.
  Si no, ese texto quedaría como comentario y desaparecería del PDF;
- el cambio entra en el mismo paso de deshacer (⌘Z) que lo que se ha escrito.

Se probó (comparación de imágenes página a página) que el PDF es idéntico en 3.A.4, 3.A.6, 3.A.29, 3.B.7, 3.B.14, 4.B.24 y 4.B.26.

Ocultar el texto con decoraciones, como hacen otras extensiones, no sirve aquí: con el ajuste de línea activado (`editor.wordWrap`),
el texto oculto sigue ocupando sus filas en blanco.

## Reescritura de las notas antiguas (`scripts/notas_pie.js`)

En octubre de 2026 había 3.859 notas en 106 temas y solo 861 se podían contraer: casi todas empezaban en la misma línea del `\footnote{`.
**Aplicado el 5 de octubre de 2026** con el visto bueno del usuario: 3.499 notas reescritas en 105 temas.

- Se reescriben las notas de **80 caracteres o más**; las más cortas se quedan en su línea.
- No se tocan:
  - las que ya están en forma de bloque;
  - las anidadas en otra nota;
  - las que están en un comentario;
  - las que terminan en `\`;
  - las que empiezan con una línea en blanco.
- Si la nota acaba con una línea en blanco (cambio de párrafo, que deja algo de espacio en el PDF), se conserva.
- Las líneas citadas en `analisis/armonizacion.json` («Ir a la línea …») se recolocan al aplicar.
  Las listas de líneas de otros documentos (`FORMULAS.md`, `CONTEXTO.md`) quedan aproximadas.

Desde la carpeta TCEE:

```
node main/scripts/notas_pie.js estado [3.A.4 …]
node main/scripts/notas_pie.js muestra 3.A.29 3
node main/scripts/notas_pie.js aplicar [3.A.4 …]
```

Volver a aplicarlo solo con el visto bueno del usuario (por ejemplo, si se pegan notas antiguas de otro sitio).
