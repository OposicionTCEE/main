# Revisar: el tema y su PDF lado a lado (v0.54–0.55, 13 de noviembre de 2026)

Acción **Revisar** de la barra lateral (y ⌘⌥E en un `.tex`): una ventana aparte con el `main.tex` a la izquierda y su PDF a la
derecha, con el desplazamiento sincronizado. Código: `extension/revisar.js` (la extensión), `extension/synctex.js` (qué línea es cada trozo
del PDF), `extension/mapaLineas.js` (líneas del PDF ↔ líneas de ahora), `extension/revisarHtml.js` y `extension/media/revisar.js/.css`
(el visor, con pdf.js en `extension/lib/pdfjs/`). Mantener código y documento a la vez.

## 1. Decisiones del usuario (13 de noviembre de 2026)

- Su forma de trabajar: lee el tema y deja notas magenta, manda un agente, vuelve a leer y marca cambios. Mientras tanto Claude
  recompila (resuelve bloques anteriores) y las notas magenta a veces rompen la compilación. Además **mueve mucho texto** de sitio.
- Por eso el **PDF que se revisa es fijo**: el de cuando se abre. No cambia aunque se compile; el botón **Actualizar** trae el último
  (y avisa con «Hay un PDF nuevo» cuando lo hay). Lo propuso el usuario.
- Al abrir, si el PDF es anterior a los últimos cambios: **«¿Compilar antes de revisar o revisar el PDF que hay?»**. Lo mismo al actualizar.
- El texto se sigue **por contenido**, no por número de línea: si se mueve un párrafo, la sincronización lo encuentra en su sitio nuevo.
- Mejoras aceptadas: sincronización en los dos sentidos con bloqueo (por defecto **manda el PDF**), banda de lectura en el texto,
  doble clic en el PDF → cursor en esa línea, Actualizar sin perder el sitio y atajo de teclado.
- Visor propio con **pdf.js** (Mozilla, Apache 2.0; descarga aprobada por el usuario): el visor de LaTeX Workshop no avisa de su
  desplazamiento y no se puede sincronizar con él.

### Ajustes tras la primera prueba (v0.55, 13 de noviembre de 2026, con vídeo del usuario)

- **Más suave**: los saltos eran bruscos. El PDF se desliza; el texto avanza renglón a renglón dentro del párrafo (antes saltaba de
  párrafo en párrafo) y, para que se deslice, se activa el desplazamiento suave de VS Code en los `.tex` (ajuste `tcee.revisarSuave`).
- **Referencia arriba con arriba** (propuesta del usuario): lo primero que se ve arriba en el PDF va arriba en el texto, y al revés.
  Antes era a un cuarto de la altura del PDF. En el vídeo, con una figura arriba del PDF, el texto saltaba a un párrafo posterior: corregido.
- **Que el movimiento no distraiga**: el usuario propuso oscurecer el lado donde no está el ratón y moverse solo al cambiar de lado, y
  ofrecerlo como opción. Claude añadió **«al parar»** (el otro lado no se mueve mientras te desplazas; va a su sitio al parar medio
  segundo), que es el valor por defecto. Quedan tres modos (al parar, al cambiar de lado, continuo) y el atenuado aparte, combinable.

## 2. La foto fija

- `scripts/compilar.sh` copia el `.tex` al empezar a compilar (`.build/.tmp/main.fuente.tex`) y, si sale PDF, lo deja junto a él:
  `.build/main.pdf`, `.build/main.synctex.gz` y `.build/main.fuente.tex`. El fichero `.build/estado` se escribe después de copiarlos
  (cuando cambia, ya están los tres).
- Al abrir (y al actualizar) se leen los tres a la vez (`tomarFoto`); si el PDF cambia mientras se leen, se repite. Se quedan en memoria:
  lo que se compile después no los toca.
- PDF de antes de la v0.54 (sin copia del `.tex`): si el tema no ha cambiado desde que se compiló, vale el texto del disco; si ha
  cambiado, se usa el de ahora y el visor avisa de que la correspondencia puede ir algo desplazada (compilar lo arregla).

## 3. De qué línea es cada sitio del PDF (`synctex.js`)

- Lee el `.synctex.gz` (formato de SyncTeX, `synctex_parser.c`) y guarda los registros de `main.tex`: cajas de renglón y puntos
  (palabras, espacios, fórmulas), en puntos del PDF desde la esquina superior izquierda, como pdf.js. Un tema de 61 páginas: 0,15 s.
- **PDF → línea**: dentro del cuerpo de la página, lo que contiene el punto; antes las palabras que las cajas (la caja de un renglón lleva
  la línea donde acabó el párrafo, a menudo la línea en blanco de después); luego lo más cercano. `revisar.js` sube además a la línea con
  contenido si SyncTeX da una vacía o de cierre (`}`, `\end{…}`, `\clearpage`).
  - **Cuerpo de la página**: la cabecera, el pie y los pegamentos de arriba de cada página llevan la línea en que TeX *cerró* la página
    (más abajo en el `.tex`) y hacían saltar la sincronización. El cuerpo es la columna de texto: la más baja de las cajas grandes que
    miden al menos el 60 % de la más alta (la página entera, con cabecera y pie, también es una caja). No se leen los pegamentos ni los
    espacios (`g`, `k`) ni las cajas de alto cero que no son sangrías.
  - **Por el borde de arriba** (`{ arriba: true }`, para sincronizar): lo primero que se ve desde ese punto hacia abajo; si el punto cae
    en el pie o en el hueco entre páginas, lo primero de la página siguiente. En el 3.B.20, el renglón de arriba de 52 de las 61 páginas
    da la misma línea que la orden `synctex` (o una a menos de 6); las otras son la portada y los índices, o el arranque de un bloque.
  - **Figuras y tablas**: si el punto no está en ningún renglón pero sí en una caja grande que no es el cuerpo, es de ella.
- **Renglones de una línea** (`filas`, `fraccion`, `filaEn`): un párrafo es una sola línea del `.tex` y ocupa varios renglones en el PDF.
  Se sabe qué parte del párrafo queda por encima de un punto (y al revés), para seguirlo renglón a renglón.
- **Línea → PDF**: el primer sitio de la línea (página menor y, en ella, lo más arriba), primero por sus palabras; las líneas vacías
  llevan al párrafo de debajo.
- Comparado con la orden `synctex` de TeX Live (`pruebas/synctex.js`): en el 3.B.20, el 96 % de los puntos del PDF dan la misma línea
  o una a ±2 (un renglón) y el 93 % de las líneas caen a menos de un renglón de donde las pone la referencia; en la muestra de prueba,
  con listas, 94 % y 88 %. No tiene que coincidir siempre: SyncTeX da varios sitios por línea y la referencia elige con otras reglas.

## 4. Líneas del PDF ↔ líneas de ahora (`mapaLineas.js`)

1. Anclas: líneas con contenido que aparecen una sola vez en cada versión, aunque hayan cambiado de sitio (párrafos movidos).
2. Alrededor de cada ancla, las líneas iguales aunque se repitan (en blanco, `\item`, `\end{…}`).
3. Entre dos emparejadas, las que se parecen (comparten al menos la mitad de sus palabras: párrafos retocados), en orden.
4. El resto (texto nuevo o borrado), por proporción entre las emparejadas de alrededor.
Se rehace al escribir (como mucho dos veces por segundo); con un tema de 1.800 líneas tarda unos 25 ms.

## 5. La ventana

- El texto: copia del editor en una ventana nueva (`workbench.action.copyEditorToNewWindow`; el editor de la ventana principal se queda).
  El visor, a su lado (`ViewColumn.Beside`). Si no se puede abrir la ventana aparte, los dos van a la principal.
- Al cerrar el visor se cierra la copia del texto (si no tiene cambios sin guardar) y, con ella, la ventana aparte.
- Una revisión cada vez: abrir otra cierra la anterior; volver a abrir la misma la trae al frente.

## 6. Sincronización

- **Referencia: el borde de arriba** de cada lado. El visor avisa de lo que se ve arriba (`vista`, 6 px por debajo del borde, como mucho
  cada 80 ms). Con ello se calcula la línea y qué parte del párrafo queda por encima; en el texto se pone arriba ese trozo
  (`revealRange` AtTop en la línea y el carácter, al principio de una palabra). Al revés, el carácter de arriba del editor
  (`visibleRanges[0].start`) da el renglón del PDF que va arriba (`ir`).
- **Quién manda** (`tcee.revisarSentido`): el PDF (por defecto), los dos o ninguno (el doble clic sigue funcionando).
- **Cuándo se mueve el otro lado** (`tcee.revisarSeguimiento`): *al parar* (por defecto: 0,45 s sin moverse), *al cambiar de lado* (el
  visor avisa de si el ratón entra o sale, `raton`: al salir del PDF el texto va a su sitio; al entrar, el PDF va al del texto si mandan
  los dos) o *continuo*.
- **Atenuar** (`tcee.revisarAtenuar`): el lado donde no está el ratón se oscurece. En el texto, con una decoración de opacidad
  sobre todo menos el párrafo de la banda; en el PDF, las páginas a media opacidad.
- **Suave** (`tcee.revisarSuave`): el visor se desliza (animación de 0,16 a 0,38 s, frenando; si el usuario toca la rueda o el teclado,
  se para y manda él; nada si el sistema pide reducir el movimiento). El texto lo mueve VS Code: se pone `editor.smoothScrolling` para
  LaTeX en el espacio de trabajo (afecta a todos los `.tex`; con la rueda de un ratón se nota, con el trackpad apenas) y se quita al
  apagar el ajuste.
- **Sin persecución**: lo que mueve uno por orden del otro no se devuelve (el visor no avisa mientras se desliza ni 0,15 s después; la
  extensión ignora el desplazamiento del texto 0,5 s tras moverlo).
- Los botones del visor cambian quién manda, cuándo sigue y el atenuado (se guardan en Ajustes); la banda se quita en Ajustes (`tcee.revisarBanda`).
- **Doble clic** en el PDF: el cursor del texto va al principio de esa línea. **Clic** en el texto: se marca en el PDF (franja amarilla que se
  apaga) y, si no se ve, se trae a la vista.
- **Actualizar** guarda el trozo del texto de ahora que está arriba (línea y carácter) y en el PDF nuevo vuelve a ese sitio (aunque el
  párrafo se haya movido).

## 7. El visor (`media/revisar.js`)

- pdf.js 6.5 (versión «legacy», para que valga también en VS Code algo antiguos). Su trabajador se crea desde un Blob (tiene que ser del
  mismo origen que la página); el texto se pide con `fetch` y, si no se puede, a la extensión (`pideTrabajador`).
- El PDF llega como bytes en el mensaje `cargar` (no con una dirección: así no dependemos de cómo sirve VS Code los ficheros).
- Solo se pintan las páginas cercanas a la vista (1.200 px arriba y abajo); las lejanas se liberan (un tema de 60 páginas a doble
  resolución ocuparía cientos de MB). Cada página se pinta en un lienzo aparte y se cambia al terminar: no se ve en blanco mientras tanto.
- Zoom (−, +, ↔ ajustar al ancho; teclas + y −) sin perder el punto de lectura. Ajustar al ancho sigue al tamaño de la ventana.
- Barra: página, zoom, *PDF → texto* (quién manda), *Sigue: …* (cuándo), ◐ (atenuar), fecha del PDF y *Actualizar*.
- Política de seguridad: scripts con nonce y de la extensión; trabajador desde Blob; `connect-src` solo la extensión.

## 8. Pruebas

- `node extension/pruebas/synctex.js [tema.tex]`: SyncTeX contra la orden `synctex` de TeX Live (85 % como mínimo en cada sentido).
- `node extension/pruebas/mapa_lineas.js`: añadir, borrar, mover y retocar párrafos; un tema real con cambios (822 de 822 líneas).
- `node extension/pruebas/revisar_visor.js [fichero.pdf]`: el visor en Chromium con la página y los ficheros en orígenes distintos y la
  misma política de seguridad que en VS Code (carga, pintado, avisos por el borde de arriba, `ir` deslizándose y sin persecución, doble
  clic, marca, zoom, Actualizar, ratón dentro y fuera, atenuado y botones).
- `node extension/pruebas/revisar_sesion.js`: la lógica de la extensión con VS Code simulado y un tema compilado con `compilar.sh`
  (ventana, desplazamiento suave, borde de arriba renglón a renglón, cabecera y pie, los tres modos, atenuado, los dos sentidos, párrafo
  movido, aviso de PDF nuevo, Actualizar en el mismo sitio, cierre).
- No simulable: la ventana aparte real y el desplazamiento del editor de VS Code. Se prueba en el Mac; cada paso queda en
  *Salida › Panel TCEE: Revisar*.

## 9. Límites conocidos

- Dentro de un párrafo se sigue **por proporción de renglones**: el renglón del PDF y el trozo del texto se corresponden aproximadamente
  (las órdenes de LaTeX ocupan sitio en el texto y no en el PDF).
- El **sticky scroll** de VS Code (las líneas fijas de arriba con `\section` y `\subsection`) tapa las primeras líneas del texto: «arriba
  con arriba» se queda unas líneas corto mientras esté encendido.
- Las figuras, tablas y notas al pie que TeX coloca en otro sitio llevan a donde TeX las puso.
- Si el editor de la ventana aparte se cierra, se sincroniza con el de la ventana principal.
