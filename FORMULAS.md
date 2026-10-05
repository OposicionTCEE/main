# Vista previa de fórmulas en los `.tex`

Al pasar el ratón por una fórmula se ve dibujada, como en Overleaf. **⌘⌥M** abre un panel que dibuja la fórmula donde está el cursor mientras escribes.

Código:
- `extension/formulas.js`: localiza la fórmula y la dibuja.
- `activarFormulas` en `extension/extension.js`: la ventanita al pasar el ratón y el panel.

Mantener este documento y el código a la vez.

## Por qué no se usa la de LaTeX Workshop

LaTeX Workshop empareja cada `\begin{aligned}` con el **primer** `\end{aligned}` que encuentra, sin contar el anidamiento
(`findEndPair` en su `src/parse/find.ts`).

En un `aligned` que contiene otros `aligned`, el exterior se corta en el primer cierre interior. La fórmula queda incompleta y no se dibuja; los interiores sí.
En octubre de 2026 había 460 `aligned` anidados en 53 temas.

No es un error de escritura del tema: con el emparejamiento correcto se dibujan 598 de los 601 `\eqblock` del temario (octubre de 2026).

Su vista previa se apaga en `TCEE.code-workspace` (`latex-workshop.hover.preview.enabled: false`) para que no salgan dos ventanitas.

## Qué fórmula se dibuja

Al poner el ratón o el cursor en una posición, se busca en este orden:
1. El primer argumento completo de `\eqblock{…}{pie}`, con las llaves equilibradas.
2. El entorno matemático **más externo** que contiene la posición: `equation`, `align`, `gather`, `multline`, `flalign`, `alignat`, `eqnarray`, `displaymath` y sus versiones con `*`.
   El emparejamiento de `\begin` y `\end` cuenta el anidamiento.
3. `\[ … \]` o `$$ … $$`.
4. Un entorno interno suelto (`aligned`, `gathered`, `cases`, `array`, `matrix`…) que no esté dentro de otro: el más externo.
5. En la misma línea, `\( … \)` o `$ … $`.

Además:
- Se quitan los comentarios `%`.
- Se añaden las órdenes propias del preámbulo que use la fórmula: `\newcommand`, `\renewcommand` y `\DeclareMathOperator`.
  Si su definición usa órdenes de tipografía que MathJax no conoce (`\fontfamily…\selectfont`, `\fontsize`…), se sustituye por `\textrm{#1}`
  (caso de `\authorfont`).
- `\displaywidth`, `\linewidth`, `\textwidth`, `\columnwidth` y `\hsize` se sustituyen por `30em` (MathJax no conoce las medidas de la página).
- El color se adapta al tema de VS Code, claro u oscuro.

## Motor

`extension/lib/mathjax-svg.js` es MathJax 3.2 (TeX → SVG) empaquetado en un solo fichero de unos 1,7 MB, con los paquetes:
- `base`, `ams`, `newcommand`, `boldsymbol`;
- `cancel`, `color`, `mathtools`;
- `noundefined`, `textmacros`.

Licencia en `lib/MATHJAX-LICENSE`. Se carga la primera vez que se dibuja una fórmula.

Para regenerarlo, por ejemplo para añadir un paquete de MathJax, desde una carpeta de trabajo:

```
npm install mathjax-full@3 esbuild
npx esbuild main/extension/lib/mathjax-entrada.js --bundle --platform=node --minify --format=cjs --define:PACKAGE_VERSION='"3"' --outfile=main/extension/lib/mathjax-svg.js
```

## Tamaño de la ventanita

VS Code corta el texto de una ventanita (hover) a unos 100.000 caracteres. La imagen va dentro de ese texto, codificada en base64,
así que una fórmula grande se cortaba y en lugar del dibujo salía el texto en bruto (`![](data:image/svg+xml;base64,…`).

- El SVG se compacta (sin atributos de accesibilidad y con un decimal): unos 15 % menos.
- Si aun así supera 90.000 caracteres, se guarda como fichero en `extension/.formulas/<huella>.svg` y la ventanita enlaza a él.
  Debajo sale la nota «Fórmula grande: si no se ve, pulsa ⌘⌥M», porque el panel no tiene ese límite.
  En octubre de 2026 eran 45 de los 601 `\eqblock`.

## Errores

Si la fórmula no se puede dibujar, la ventanita dice «⚠ No se puede dibujar esta fórmula» y explica en castellano qué falla,
con el mensaje original de MathJax detrás, entre paréntesis (`explicarError` en `formulas.js`, lista `ERRORES`).

- En modo normal, una orden desconocida (por ejemplo, la errata `\rigt`) se pinta en rojo y no detiene el dibujo,
  pero puede provocar más adelante un error engañoso (en ese caso, `\left` sin `\right`).
  Por eso, si falla, se vuelve a probar en modo estricto (sin `noundefined`): si allí el error es «orden desconocida», se informa de esa, que es la causa real.
- `\\[0.5m]`: se cita la medida que falla y se dice que «m» no es una unidad.
- `\text{…}` dentro de otro `\text{…}`: se cita el fragmento. LaTeX lo admite y MathJax no, así que el PDF no se ve afectado.
- Si se dibuja con órdenes en rojo, debajo se avisa: «En rojo: órdenes que la vista previa no conoce».

## Límites conocidos

- 3 `\eqblock` del temario no se dibujan (octubre de 2026); la ventanita explica por qué:
  - 3.A.13, línea 789: errata `\rigt.` (debería ser `\right.`);
  - 3.A.20, línea 794: `\\[0.5m]` («m» no es una unidad; probablemente `0.5em`);
  - 3.A.27, línea 773: `\text{\text{…}}` (limitación de MathJax; en el PDF sale bien).
  No se corrigen en los temas sin el visto bueno del usuario.
- Las órdenes propias definidas fuera del preámbulo del tema no se conocen.
