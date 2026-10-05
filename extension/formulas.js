// Vista previa de fórmulas en los .tex (al pasar el ratón y en un panel que sigue al cursor), como en Overleaf.
// Sustituye a la de LaTeX Workshop, que empareja \begin{aligned} con el PRIMER \end{aligned} y por eso no dibuja
// un aligned que contiene otros aligned (460 casos en 53 temas en octubre de 2026). Aquí el emparejamiento cuenta el anidamiento
// y se dibuja el primer argumento completo de \eqblock{…}{…}. Reglas: main/FORMULAS.md
'use strict';

// entornos que ya son matemáticos por sí mismos (nivel superior) y entornos internos que solo cuentan si no hay otro alrededor
const DISPLAY = ['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'flalign', 'flalign*',
  'alignat', 'alignat*', 'eqnarray', 'eqnarray*', 'displaymath', 'math'];
const INTERNOS = ['aligned', 'alignedat', 'gathered', 'split', 'cases', 'array', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix'];

/** Posición del } que cierra la { de la posición i (llaves equilibradas; ignora \{ \}) */
function cierre(t, i) {
  let p = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === '\\') { j++; continue; }
    if (c === '%') { const n = t.indexOf('\n', j); if (n < 0) return -1; j = n; continue; }
    if (c === '{') p++; else if (c === '}' && --p === 0) return j;
  }
  return -1;
}

/** Quita los comentarios % (no los \%) */
const sinComentarios = (s) => s.replace(/(^|[^\\])%.*$/gm, '$1');

/**
 * Fórmula que contiene la posición (desplazamiento en el texto): {tex, display, inicio, fin} o null.
 * Orden: argumento de \eqblock, entorno matemático de nivel superior, \[ \] o $$ $$, entorno interno suelto, y en línea \( \) o $ $.
 */
function localizar(texto, off) {
  // 1) \eqblock{fórmula}{pie}
  const rx = /\\eqblock\s*\{/g; let m;
  while ((m = rx.exec(texto))) {
    if (m.index > off) break;
    const a = m.index + m[0].length - 1, b = cierre(texto, a);
    if (b < 0) break;
    if (off >= m.index && off <= b) return { tex: texto.slice(a + 1, b), display: true, inicio: m.index, fin: b + 1 };
    rx.lastIndex = b;
  }
  // 2) y 4) entornos \begin{x}…\end{x}, contando el anidamiento
  const env = entorno(texto, off, DISPLAY);
  if (env) return { tex: texto.slice(env.cuerpo, env.finCuerpo), display: true, inicio: env.inicio, fin: env.fin, entorno: env.nombre };
  // 3) \[ … \] y $$ … $$
  for (const [ab, ce] of [['\\[', '\\]'], ['$$', '$$']]) {
    let i = -1;
    while ((i = texto.indexOf(ab, i + 1)) >= 0 && i <= off) {
      if (texto[i - 1] === '\\') continue;
      const j = texto.indexOf(ce, i + ab.length);
      if (j < 0) break;
      if (off <= j + ce.length) return { tex: texto.slice(i + ab.length, j), display: true, inicio: i, fin: j + ce.length };
      i = j + ce.length - 1;
    }
  }
  const interno = entorno(texto, off, INTERNOS);
  if (interno) return { tex: texto.slice(interno.inicio, interno.fin), display: true, inicio: interno.inicio, fin: interno.fin };
  // 5) en línea, en la línea del cursor
  const ini = texto.lastIndexOf('\n', off - 1) + 1, finL = texto.indexOf('\n', off), linea = texto.slice(ini, finL < 0 ? texto.length : finL);
  const rxl = /\\\((.+?)\\\)|(?<![\\$])\$(?!\$)((?:\\.|[^\\$])+?)\$/g;
  while ((m = rxl.exec(linea))) {
    const a = ini + m.index, b = a + m[0].length;
    if (off >= a && off <= b) return { tex: m[1] || m[2], display: false, inicio: a, fin: b };
  }
  return null;
}

/** El entorno MÁS EXTERNO de la lista que contiene la posición, emparejando \begin/\end con su anidamiento */
function entorno(texto, off, nombres) {
  const esc = nombres.map((n) => n.replace('*', '\\*')).join('|');
  const rx = new RegExp(`\\\\(begin|end)\\{(${esc})\\}`, 'g');
  const pila = []; let m;
  while ((m = rx.exec(texto))) {
    if (m.index > off && !pila.length) return null;
    if (m[1] === 'begin') pila.push({ nombre: m[2], inicio: m.index, cuerpo: m.index + m[0].length });
    else {
      // cierra el último \begin del mismo nombre (tolera entornos mal cerrados de otros nombres)
      let k = pila.length - 1; while (k >= 0 && pila[k].nombre !== m[2]) k--;
      if (k < 0) continue;
      const e = pila[k]; pila.length = k;
      if (!pila.length && e.inicio <= off && off <= m.index + m[0].length) return { ...e, finCuerpo: m.index, fin: m.index + m[0].length };
    }
  }
  return null;
}

/** \newcommand, \renewcommand, \def y \DeclareMathOperator del preámbulo que usa la fórmula, para que MathJax los entienda */
function macros(texto, tex) {
  const fin = texto.indexOf('\\begin{document}');
  const pre = fin > 0 ? texto.slice(0, fin) : '';
  const defs = [];
  const rx = /\\(?:re)?newcommand\*?\s*\{?\s*(\\[A-Za-z]+)\s*\}?\s*(\[\d\])?\s*(\[[^\]]*\])?\s*\{|\\DeclareMathOperator(\*?)\s*\{\s*(\\[A-Za-z]+)\s*\}\s*\{/g;
  let m;
  while ((m = rx.exec(pre))) {
    const a = m.index + m[0].length - 1, b = cierre(pre, a);
    if (b < 0) continue;
    const nombre = m[1] || m[5];
    if (!new RegExp(`\\${nombre}(?![A-Za-z])`).test(tex)) { rx.lastIndex = b; continue; }
    let cuerpo = pre.slice(a + 1, b);
    // órdenes de tipografía del documento (\fontfamily{…}\selectfont, \fontsize…) que MathJax no conoce: se quedan solo con el texto
    if (/\\(fontfamily|selectfont|fontsize|usefont|fontseries|fontshape)\b/.test(cuerpo)) cuerpo = m[2] ? '\\textrm{#1}' : '';
    defs.push(m[1] ? `\\newcommand{${nombre}}${m[2] || ''}${m[3] || ''}{${cuerpo}}` : `\\newcommand{${nombre}}{\\operatorname${m[4] ? '*' : ''}{${cuerpo}}}`);
    rx.lastIndex = b;
  }
  return defs.join('');
}

let motor = null;
/** SVG de la fórmula (lanza error si no se puede). colorTexto: color con el que pintar (según el tema de VS Code) */
function dibujar(tex, display, colorTexto, escala = 1.1, prefijo = '') {
  if (!motor) motor = require('./lib/mathjax-svg.js');   // se carga la primera vez (≈1,7 MB)
  let s;
  // medidas de página que MathJax no conoce (\rule{\displaywidth}{…}): se sustituyen por un ancho fijo
  const limpia = sinComentarios(tex).trim().replace(/\\(displaywidth|linewidth|textwidth|columnwidth|hsize)(?![A-Za-z])/g, '30em');
  try { s = motor.svg(prefijo + limpia, display); } catch (e) {
    let e2 = e;
    if (prefijo) { try { s = motor.svg(limpia, display); } catch (x) { e2 = x; } }
    if (!s) {
      // en modo normal una orden desconocida (p. ej. la errata \rigt) no falla y provoca un error engañoso más adelante;
      // en modo estricto falla justo en ella: si es eso, se informa de la causa de verdad
      try { motor.svg(prefijo + limpia, display, true); } catch (x) {
        if (/Undefined control sequence/.test(x.message) && !/Undefined control sequence/.test(e2.message)) throw x;
      }
      throw e2;
    }
  }
  // MathJax mide en ex; se pasa a píxeles (1 ex ≈ 8 px) para que el tamaño sea predecible en la ventanita
  s = s.replace(/(width|height)="([\d.]+)ex"/g, (x, k, v) => `${k}="${(parseFloat(v) * 8 * escala).toFixed(1)}px"`)
    .replace(/currentColor/g, colorTexto);
  return compactar(s);
}

/** Quita del SVG lo que no hace falta para verlo (atributos de accesibilidad y decimales sobrantes): ≈15 % menos */
const compactar = (svg) => svg.replace(/\s(data-[a-z-]+|role|focusable|aria-hidden)="[^"]*"/g, '').replace(/(\d+\.\d)\d+/g, '$1');

/** Mensajes de MathJax traducidos a algo que se entienda al leerlo (el original va detrás, entre paréntesis) */
const ERRORES = [
  [/Missing \\begin\{(\w+\*?)\} or extra \\end\{\1\}/, (m) => `Sobra un \\end{${m[1]}} o falta su \\begin{${m[1]}}.`],
  [/Missing \\end\{(\w+\*?)\}|\\begin\{(\w+\*?)\} ended with/, (m) => `Falta cerrar un entorno con \\end{${m[1] || m[2]}}.`],
  [/Extra close brace or missing open brace/, () => 'Sobra una llave de cierre «}» o falta una de apertura «{».'],
  [/Missing close brace/, () => 'Falta una llave de cierre «}».'],
  [/Extra open brace or missing close brace/, () => 'Sobra una llave de apertura «{» o falta una de cierre «}».'],
  [/Undefined control sequence (\\\w+)/, (m) => `La orden ${m[1]} no existe: ¿errata, o está definida fuera del preámbulo de este tema?`],
  [/'(\d*\.?\d+)\s*([a-z]+)' is not a valid dimension|Bracket argument to \\\\ must be a dimension/, (m) => m[1] ? `«${m[1]}${m[2]}» no es una medida válida: «${m[2]}» no es una unidad (usa em, ex, pt, mm o cm, por ejemplo «${m[1]}em»).` : 'Tras un salto de línea «\\\\», el corchete debe llevar una medida, por ejemplo «\\\\[0.5em]». Si la línea siguiente empieza por «[», escribe «\\\\ {[}» o «\\\\ \\relax [».'],
  [/\\text is only supported in math mode/, () => 'Hay un \\text{…} dentro de otro \\text{…}. LaTeX lo admite, pero la vista previa (MathJax) no: quita el \\text exterior o cierra el primero antes de abrir el segundo. El PDF no se ve afectado.'],
  [/(\\\w+) is only supported in math mode/, (m) => `${m[1]} solo puede usarse dentro de una fórmula, y aquí está en modo texto (por ejemplo, dentro de un \\text{…}).`],
  [/Missing dimension|Missing or unrecognized delimiter for (\\\w+)/, (m) => m[1] ? `Falta o no se reconoce el delimitador de ${m[1]} (por ejemplo «\\left(» … «\\right)» o «\\right.»).` : 'Falta una medida con unidades (por ejemplo «0.5em» o «2pt»).'],
  [/extra \\left|missing \\right|extra \\right|missing \\left/i, () => 'Los \\left y \\right no están emparejados: cada \\left necesita su \\right (vale «\\right.» si no quieres delimitador).'],
  [/Misplaced &/, () => 'Hay un «&» fuera de un entorno de alineación (aligned, cases, array…).'],
  [/Double (sub|super)scripts/, (m) => `Hay dos ${m[1] === 'sub' ? 'subíndices' : 'superíndices'} seguidos sobre lo mismo: agrúpalos entre llaves, por ejemplo x_{i}_{j} → x_{ij}.`],
  [/Math input error|TeX parse error/, () => 'La fórmula tiene un error de escritura.'],
];
function explicarError(msg, tex = '') {
  const m0 = String(msg || '');
  // salto de línea con medida mal escrita: se cita la que falla (p. ej. «\\\\[0.5m]»)
  if (/Bracket argument/.test(m0)) {
    const d = [...String(tex).matchAll(/\\\\\s*\[\s*([\d.]*)\s*([A-Za-z]*)\s*\]/g)].find((x) => !/^(em|ex|pt|mm|cm|in|pc|bp|mu|px)$/.test(x[2]));
    if (d) return `En «\\\\[${d[1]}${d[2]}]» ${d[2] ? `«${d[2]}» no es una unidad` : 'falta la unidad'}: usa em, ex, pt, mm o cm, por ejemplo «\\\\[${d[1] || '0.5'}em]». (MathJax: ${m0})`;
  }
  // \text dentro de \text: se cita el fragmento
  if (/\\text is only supported/.test(m0)) {
    const rx = /\\text\s*\{/g; let x;
    while ((x = rx.exec(tex))) {
      const b = cierre(tex, x.index + x[0].length - 1), dentro = b > 0 ? tex.slice(x.index + x[0].length, b) : '';
      if (/\\text\s*\{/.test(dentro)) {
        const frag = tex.slice(x.index, b + 1).replace(/\s+/g, ' ');
        return `Hay un \\text{…} dentro de otro: «${frag.length > 90 ? frag.slice(0, 87) + '…' : frag}». LaTeX lo admite, pero la vista previa (MathJax) no: quita el \\text exterior o cierra el primero antes de abrir el segundo. El PDF no se ve afectado. (MathJax: ${m0})`;
      }
    }
  }
  for (const [rx, f] of ERRORES) { const m = m0.match(rx); if (m) return `${f(m)} (MathJax: ${m0})`; }
  return `No se puede interpretar la fórmula. (MathJax: ${m0})`;
}

module.exports = { localizar, entorno, macros, dibujar, compactar, explicarError, cierre, sinComentarios };
