# Ayudas de escritura en los `.tex`

Código: `extension/escritura.js` (funciones puras, probadas fuera de VS Code), `envolver` y `activarEscritura` en `extension/extension.js`,
`config/colores.json` (paleta de colores con significado) y `scripts/preambulo_resaltado.js`. Mantener este documento y el código a la vez.

## Atajos

| Atajo (Mac) | Qué hace |
|---|---|
| ⌘B / ⌘I | Negrita / cursiva (ver abajo) |
| ⌃H | Resaltado amarillo `\hl{…}`, con la misma lógica que ⌘B |
| ⌃U | Mayúsculas de la selección (o de la palabra del cursor) |
| ⌃⌘A | Ventana con todos los atajos del Panel TCEE; se cierra con Esc |
| ⌃⌘N / ⌃⇧⌘N | Notas al pie (ver `NOTAS.md`) |
| ⌘⌥M | Panel de la fórmula (ver `FORMULAS.md`) |

En Windows/Linux: Ctrl+Alt+H, Ctrl+Alt+U, Ctrl+Alt+Shift+A.
⌃H sustituye, solo en los `.tex`, al «borrar a la izquierda» de macOS.

La ventana de atajos se construye con los `keybindings` de `extension/package.json`, así que siempre está al día.
No muestra los de escritura (`$`). Intro ejecuta el atajo elegido.

## ⌘B, ⌘I y ⌃H

- **Sin selección, fuera de la orden**: escribe `\textbf{|}` con el cursor dentro.
- **Sin selección, dentro de un `\textbf{…}`**: el cursor sale detrás de la `}` para seguir escribiendo sin negrita.
  Si está dentro de varios grupos, sale del `\textbf` más cercano.
- **Selección de todo el contenido** (o de la orden completa): se quita la negrita.
- **Selección de una parte**: solo esa parte deja de ir en negrita (`\textbf{a}b\textbf{c}`).
  Si la selección corta un grupo `{ }` por la mitad, no se hace nada.
- **Selección fuera**: se envuelve.

## ⌃U: mayúsculas

Pasa a mayúsculas el texto (con acentos y ñ), pero no:
- las órdenes (`\textbf` no pasa a `\TEXTBF`);
- las fórmulas `$…$`, `\(…\)`, `\[…\]`;
- los comentarios;
- el primer argumento de `\ref`, `\label`, `\cite`, `\textcolor`, `\href`, `\url`, `\begin`/`\end`, `\includegraphics`, `\imagenfit`…

## $ automático

- Sin selección y con espacio (o nada) a los dos lados: `$|$` con el cursor en medio.
- Con texto pegado delante o detrás (`a|b`), o tras `\`: un solo `$`.
- Si justo delante del cursor está el `$` de cierre: se pasa por encima.
- Con selección: `$selección$`.

Va en la tecla ⇧4, que es el `$` en los teclados español e inglés.

## \color → \textcolor{}{} y paleta

- Al escribir `\col…`, la primera sugerencia es `\color → \textcolor{color}{texto}`. Con Intro se escribe `\textcolor{}{}`,
  con el cursor en el primer `{}`, y se abre la lista de colores con su significado.
- En cuanto el color escrito (o elegido) es válido, el cursor salta al segundo `{}`.
  Válidos: los de la paleta y los que `xcolor` conoce sin opciones (red, blue, gray, orange, violet…).
- Al pasar el ratón por el color se ve su significado. Si no es un color válido (por ejemplo `yellos`), avisa de que dará error.
- En el editor, el texto de cada `\textcolor` se ve en su color.

Paleta (`config/colores.json`, se puede editar):

| Color | Significado |
|---|---|
| magenta | Indicación para Claude: lo que quieres que haga en este punto |
| red | Pendiente / OJO: nota tuya para completar o corregir |
| blue | Revisar / preservar: no cambiar sin preguntarte |
| orange | Duda: dato o afirmación por verificar |
| green | Revisado y validado |
| gray | Nota personal: no se recita en el examen |

`red` conserva el uso que ya tenía en el temario: 220 marcas en 65 temas, del tipo «OJO», «Añadir…», «Poner título…».
Por eso las indicaciones para Claude van en `magenta`. Si fueran en rojo, las notas antiguas se confundirían con órdenes.

## \high → \hl{} (resaltado amarillo)

- Al escribir `\hig…` o `\hl`, la sugerencia `\highlight` escribe `\hl{}`. En el editor, el texto de `\hl{…}` lleva fondo amarillo.
- `\hl` es del paquete `soul`, que **no estaba** en ningún preámbulo (octubre de 2026).
  `scripts/preambulo_resaltado.js aplicar` añade antes de `\begin{document}`:

  ```
  \usepackage{soul}\sethlcolor{yellow}
  ```

  Probado en 3.A.1 con acentos, ñ, `\textbf`, `\textit` y `$x^2$` dentro: corta bien las líneas y no añade errores.
- Si se usa ⌃H en un tema sin el paquete, aparece un aviso.
- Límites de `soul`: dentro de `\hl{…}` no puede haber `\footnote`, `\eqblock` ni cambios de párrafo.
