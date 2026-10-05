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

No es un error de escritura del tema: con el emparejamiento correcto, MathJax dibuja 597 de los 601 `\eqblock` del temario.

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

## Límites conocidos

- 4 `\eqblock` del temario no se dibujan por errores en la propia fórmula (un `\end{aligned}` de más, `\\[…]` sin unidad, `\text` fuera de modo matemático, `\rule` sin unidades).
  La ventanita lo indica con el mensaje de error.
- Las órdenes propias definidas fuera del preámbulo del tema no se conocen.
