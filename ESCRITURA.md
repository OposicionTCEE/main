# Ayudas de escritura en los `.tex`

Código: `extension/escritura.js` (funciones puras, probadas fuera de VS Code), `envolver` y `activarEscritura` en `extension/extension.js`,
`config/colores.json` (paleta de colores con significado) y `scripts/preambulo_resaltado.js`. Mantener este documento y el código a la vez.

## Atajos

| Atajo (Mac) | Qué hace |
|---|---|
| ⌘B / ⌘I | Negrita / cursiva (ver abajo) |
| ⌃H | Resaltado amarillo `\hl{…}`, con la misma lógica que ⌘B |
| ⌘⌥U | Mayúsculas de la selección (o de la palabra del cursor) |
| ⌃C | Rodear la selección de color: `\textcolor{|}{selección}`, con la lista de colores abierta; al elegir el color, el cursor sale detrás |
| ⌘⌥K | Ventana con todos los atajos del Panel TCEE; se cierra con Esc. También en la acción «Atajos» del panel |
| ⌘⌥N / ⌘⌥⇧N | Notas al pie (ver `NOTAS.md`) |
| ⌘⌥M | Panel de la fórmula (ver `FORMULAS.md`) |

En Windows/Linux: Ctrl+Alt+H, Ctrl+Alt+U, Ctrl+Alt+C, Ctrl+Alt+Shift+A.
Atajos cambiados tras probarlos en el Mac del usuario: ⌃⌘A abría la ventana de agentes de VS Code, ⌃⌘N abría una pestaña y ⌃U no hacía nada
(algo de su VS Code los captura antes). Se pasaron a ⌘⌥ + letra, como ⌘⌥M, que sí funcionaba.
En la ventana de atajos, el botón ⚙ de cada fila abre los atajos de VS Code filtrados por esa orden para cambiarlo; la ventana enseña
los atajos cambiados así (lee `keybindings.json` del usuario). Además hay un botón «⌨ Atajos» en la barra inferior al editar un `.tex`.
⌃H sustituye, solo en los `.tex`, al «borrar a la izquierda» de macOS.

La ventana de atajos se construye con los `keybindings` de `extension/package.json`, así que siempre está al día.
No muestra los de escritura (`$`). Intro ejecuta el atajo elegido.

## ⌘B, ⌘I y ⌃H

- **Sin selección, fuera de la orden**: escribe `\textbf{|}` con el cursor dentro.
- **Sin selección, dentro de un `\textbf{…}`**: el cursor sale detrás de la `}` para seguir escribiendo sin negrita.
- **Sin selección, dentro de un `\textbf{}` vacío**: se borra (casi siempre es un error).
  Si está dentro de varios grupos, sale del `\textbf` más cercano.
- **Selección de todo el contenido** (o de la orden completa): se quita la negrita.
- **Selección de una parte**: solo esa parte deja de ir en negrita (`\textbf{a}b\textbf{c}`).
  Si la selección corta un grupo `{ }` por la mitad, no se hace nada.
- **Selección fuera**: se envuelve.

## ⌘⌥U: mayúsculas

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
  Va justo debajo del último `\usepackage` del preámbulo, antes del bloque «Fija primero tus valores globales».
  Para temas nuevos, `scripts/preambulo_resaltado.js aplicar` lo añade en ese mismo sitio:

  ```
  \usepackage{soul}\sethlcolor{yellow}
  ```

  Probado en 3.A.1 con acentos, ñ, `\textbf`, `\textit` y `$x^2$` dentro: corta bien las líneas y no añade errores.
- Si se usa ⌃H en un tema sin el paquete, aparece un aviso.
- Probado de nuevo tras añadirlo, en 3.A.1 y 3.B.14: mismo número de errores y de páginas que antes.
- Límites de `soul`: dentro de `\hl{…}` no puede haber `\footnote`, `\eqblock` ni cambios de párrafo.

## Listas: \lnum, \la e Intro

- `\lnum` + Intro escribe una lista numerada y `\la` + Intro una alfabética, con el primer `\item` y el cursor detrás:

  ```
  \begin{lnum}
      \item |
  \end{lnum}
  ```
- Dentro de una lista (`lnum`, `la`, `itemize` o `enumerate`), Intro abre una línea nueva que ya empieza con `\item`, con la misma sangría.
- Intro en un `\item` vacío lo quita y saca el cursor de la lista, debajo del `\end{…}` (como en Word).
- No actúa:
  - dentro de unas llaves abiertas en el `\item`, como una `\footnote{…}` o un `\textbf{…}`;
  - en un entorno metido en la lista, como una fórmula;
  - con la lista de sugerencias abierta, dentro de un fragmento con Tab ni con varios cursores.

  En esos casos Intro funciona como siempre.
- Código: `enLista` y `finDeEntorno` en `escritura.js`. Intro es el comando `tcee.intro`, activo solo cuando `tcee.enLista` es cierto
  (se calcula al mover el cursor). No sale en la ventana de atajos.

## Citas textuales: \cita

```
\begin{cita}[Autor][Año][Obra]
    Texto de la cita.
\end{cita}
```

- Debajo, a la derecha: «AUTOR (Año), *Obra*». Los tres datos son opcionales; sin ninguno, no hay firma.
- `\cita` + Intro escribe `\begin{cita}[Autor][Año][Obra]` con el cursor en el texto de la cita.
  Tab pasa a «Autor», que queda seleccionado (lo que escribas lo sustituye); después a «Año» y a «Obra».
  Si un dato se deja sin cambiar, la palabra sale en el PDF a propósito, para ver lo que falta. En el editor se subraya con una línea ondulada.
- Si un corchete se deja vacío (`[]`), en el editor se ve en gris qué dato va. Esa pista no se escribe en el `.tex`.
- La definición (`\NewDocumentEnvironment{cita}{ O{} O{} O{} +b }`) está en los 145 temas, justo antes del bloque de listas.
  Se añadió el 6 de octubre de 2026 con el visto bueno del usuario; antes solo estaba en 3.A.19, y con dos datos.
  Las citas de 3.A.42, 3.B.2 y 3.B.3, que daban error, se reordenaron a [Autor][Año][Obra].
- El espacio entre autor y año es `\space`: con `~` (babel en castellano) salía «@» y dos errores.
