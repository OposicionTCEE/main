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
    Contenido de la nota, en una o varias líneas.%
} Sigue el párrafo.
```

Los `%` hacen que LaTeX no vea los saltos de línea añadidos: el PDF sale igual.

Se probó (pdftotext página a página y comparación de imágenes) que el PDF es idéntico en 3.A.6, 3.A.29, 3.B.14, 4.B.24 y 4.B.26.

Ocultar el texto con decoraciones, como hacen otras extensiones, no sirve aquí: con el ajuste de línea activado (`editor.wordWrap`),
el texto oculto sigue ocupando sus filas en blanco.

## Reescritura de las notas antiguas (`scripts/notas_pie.js`)

En octubre de 2026 había 3.859 notas en 106 temas y solo 861 se podían contraer: casi todas empiezan en la misma línea del `\footnote{`.

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

No aplicar sin el visto bueno del usuario.
