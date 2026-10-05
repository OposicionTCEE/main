# Ayudas de escritura en los `.tex`

Código: `extension/escritura.js` (funciones puras, probadas fuera de VS Code), `envolver` y `activarEscritura` en `extension/extension.js`,
`config/colores.json` (paleta de colores con significado) y `scripts/preambulo_resaltado.js`. Mantener este documento y el código a la vez.

## Atajos

| Atajo (Mac) | Qué hace |
|---|---|
| ⌘B / ⌘I | Negrita / cursiva (ver abajo) |
| ⌃H | Resaltado amarillo `\hl{…}`, con la misma lógica que ⌘B |
| ⌃U | Mayúsculas de la selección (o de la palabra del cursor) |
| ⌃C | Rodear la selección de color: `\textcolor{|}{selección}`, con la lista de colores abierta; al elegir el color, el cursor sale detrás |
| ⌃⌥⌘A | Ventana con todos los atajos del Panel TCEE; se cierra con Esc. También en la acción «Atajos» del panel |
| ⌃⌘N / ⌃⇧⌘N | Notas al pie (ver `NOTAS.md`) |
| ⌘⌥M | Panel de la fórmula (ver `FORMULAS.md`) |

En Windows/Linux: Ctrl+Alt+H, Ctrl+Alt+U, Ctrl+Alt+C, Ctrl+Alt+Shift+A.
⌃⌘A no se usa porque VS Code ya lo usa para la ventana de agentes.
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
- Con selección: `$selección$`. Si lo seleccionado ya es `$…$`, queda `$$…$$`.

Va en la tecla ⇧4, que es el `$` en los teclados español e inglés.

## \color → \textcolor{}{} y paleta

- Al escribir `\col…`, la primera sugerencia es `\color → \textcolor{color}{texto}`. Con Intro se escribe `\textcolor{}{}`,
  con el cursor en el primer `{}`, y se abre la lista de colores con su significado.
- En cuanto el color escrito (o elegido) es válido, el cursor salta al segundo `{}`; si ese texto ya está escrito (⌃C sobre una selección), sale detrás de la `}` final.
  Válidos: los de la paleta y los que `xcolor` conoce sin opciones (red, blue, gray, orange, violet…).
- La lista enseña solo los colores de la paleta, cada uno con su significado al lado.
  Los demás colores de `xcolor` siguen valiendo si se escriben a mano.
- Al pasar el ratón por el color también se ve su significado. Si no es un color válido (por ejemplo `yellos`), avisa de que dará error.
- En el editor, el texto de cada `\textcolor` se ve en su color.

Paleta (`config/colores.json`, se puede editar):

| Color | Significado |
|---|---|
| magenta | Indicación para Claude |
| red | Pendiente / OJO (nota tuya) |
| blue | Revisar / preservar (no cambiar sin preguntar) |
| orange | Duda: dato por verificar |

Solo los colores recurrentes en la relación con Claude. Verde y gris se quitaron a petición del usuario.

`red` conserva el uso que ya tenía en el temario: 220 marcas en 65 temas, del tipo «OJO», «Añadir…», «Poner título…».
Por eso las indicaciones para Claude van en `magenta`. Si fueran en rojo, las notas antiguas se confundirían con órdenes.

## \high → \hl{} (resaltado amarillo)

- Al escribir `\hig…` o `\hl`, la sugerencia `\highlight` escribe `\hl{}`. En el editor, el texto de `\hl{…}` lleva fondo amarillo.
- `\hl` es del paquete `soul`. Se añadió a los 145 preámbulos el 5 de octubre de 2026, con el visto bueno del usuario.
  Para temas nuevos, `scripts/preambulo_resaltado.js aplicar` lo añade antes de `\begin{document}`:

  ```
  \usepackage{soul}\sethlcolor{yellow}
  ```

  Probado en 3.A.1 con acentos, ñ, `\textbf`, `\textit` y `$x^2$` dentro: corta bien las líneas y no añade errores.
- Si se usa ⌃H en un tema sin el paquete, aparece un aviso.
- Probado de nuevo tras añadirlo, en 3.A.1 y 3.B.14: mismo número de errores y de páginas que antes.
- Límites de `soul`: dentro de `\hl{…}` no puede haber `\footnote`, `\eqblock` ni cambios de párrafo.
