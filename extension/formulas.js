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
    const cuerpo = pre.slice(a + 1, b);
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
  const limpia = sinComentarios(tex).trim();
  try { s = motor.svg(prefijo + limpia, display); } catch (e) { if (!prefijo) throw e; s = motor.svg(limpia, display); }
  // MathJax mide en ex; se pasa a píxeles (1 ex ≈ 8 px) para que el tamaño sea predecible en la ventanita
  s = s.replace(/(width|height)="([\d.]+)ex"/g, (x, k, v) => `${k}="${(parseFloat(v) * 8 * escala).toFixed(1)}px"`)
    .replace(/currentColor/g, colorTexto);
  return s;
}

module.exports = { localizar, entorno, macros, dibujar, cierre, sinComentarios };
