// SyncTeX: qué sitio del PDF corresponde a cada línea del .tex y al revés (para «Revisar»; main/REVISAR.md).
// Lee el .synctex.gz que deja pdflatex (-synctex=1, scripts/compilar.sh) y guarda solo los registros del fichero fuente pedido
// (main.tex): cajas de línea y puntos (glifos, espacios, fórmulas) con su página y su posición.
// Unidades: puntos del PDF (bp, 1/72 de pulgada) medidos desde la esquina superior izquierda de la página, como pdf.js.
// Formato de SyncTeX: https://github.com/jlaurens/synctex (synctex_parser.c). Se comprueba contra la orden «synctex» de TeX Live
// en pruebas/synctex.js.
'use strict';
const zlib = require('zlib');
const path = require('path');

const SP_POR_BP = 65781.76;   // puntos de escala de TeX (sp) por punto del PDF (bp): 65536 · 72,27 / 72
// alto y fondo aproximados de una línea de texto, para los registros que son puntos (sin caja)
const ALTO_PUNTO = 8, FONDO_PUNTO = 2.5;
const GRANDE = 120;   // bp: una caja más alta que esto no es una línea (una fórmula grande o una tabla sí caben)

/** ¿La ruta de un «Input:» es el fichero fuente? (rutas absolutas, relativas o con «./» en medio) */
function esFuente(ruta, fuente) {
  const n = ruta.replace(/\\/g, '/').replace(/\/\.\//g, '/');
  const f = fuente.replace(/\\/g, '/');
  return n === f || n.endsWith(`/${f}`) || (path.isAbsolute(f) && path.normalize(n) === path.normalize(f));
}

/**
 * Lee el contenido de un .synctex.gz (Buffer, comprimido o no) y devuelve un índice para el fichero fuente.
 * fuente: nombre (main.tex) o ruta del fichero cuyas líneas interesan.
 */
function leer(contenido, fuente = 'main.tex') {
  const buf = contenido[0] === 0x1f && contenido[1] === 0x8b ? zlib.gunzipSync(contenido) : contenido;
  const lineas = buf.toString('latin1').split('\n');
  const etiquetas = new Set();
  let unidad = 1, xOff = 0, yOff = 0, mag = 1000, i = 0;
  for (; i < lineas.length; i++) {
    const l = lineas[i];
    if (l.startsWith('Content:')) { i++; break; }
    let m;
    if ((m = /^Input:(\d+):(.*)$/.exec(l))) { if (esFuente(m[2], fuente)) etiquetas.add(Number(m[1])); }
    else if ((m = /^Unit:(-?\d+(?:\.\d+)?)/.exec(l))) unidad = Number(m[1]);
    else if ((m = /^X Offset:(-?\d+)/.exec(l))) xOff = Number(m[1]);
    else if ((m = /^Y Offset:(-?\d+)/.exec(l))) yOff = Number(m[1]);
    else if ((m = /^Magnification:(\d+)/.exec(l))) mag = Number(m[1]) || 1000;
  }
  const escala = mag / 1000 / SP_POR_BP;
  const bpX = (v) => (v * unidad + xOff) * escala;
  const bpY = (v) => (v * unidad + yOff) * escala;
  const dist = (v) => v * unidad * escala;
  // registros: tipo, etiqueta, línea[, columna] : x, y [: ancho, alto, fondo]   (las páginas, entre «{n» y «}n»)
  const RX = /^([[(hvxkg$])(\d+),(\d+)(?:,-?\d+)?:(-?\d+),(-?\d+)(?::(-?\d+)(?:,(-?\d+),(-?\d+))?)?/;
  const registros = [];   // {p, l, x, y, w, arriba, abajo, caja}
  let pagina = 0;
  for (; i < lineas.length; i++) {
    const l = lineas[i];
    const c = l[0];
    if (c === '{') { pagina = parseInt(l.slice(1), 10); continue; }
    if (c === '}' || c === ']' || c === ')' || c === '!') continue;
    if (c === 'P' && l.startsWith('Postamble')) break;
    const m = RX.exec(l);
    if (!m || !etiquetas.has(Number(m[2]))) continue;
    const tipo = m[1], linea = Number(m[3]), x = bpX(Number(m[4])), y = bpY(Number(m[5]));
    const caja = tipo === '[' || tipo === '(' || tipo === 'h' || tipo === 'v';
    if (caja && m[7] !== undefined) {
      const w = dist(Number(m[6])), h = dist(Number(m[7])), d = dist(Number(m[8]));
      if (h + d <= 0 && w <= 0) continue;   // cajas vacías: no marcan ningún sitio
      // una caja sin alto (la sangría del párrafo, por ejemplo) está en un renglón: se le da el alto de una línea de texto
      if (h + d <= 0) registros.push({ p: pagina, l: linea, x, y, w, arriba: y - ALTO_PUNTO, abajo: y + FONDO_PUNTO, caja: false });
      else registros.push({ p: pagina, l: linea, x, y, w, arriba: y - h, abajo: y + d, caja: true });
    } else {
      registros.push({ p: pagina, l: linea, x, y, w: m[6] !== undefined ? dist(Number(m[6])) : 0, arriba: y - ALTO_PUNTO, abajo: y + FONDO_PUNTO, caja: false });
    }
  }
  return crearIndice(registros);
}

/** ¿Va antes la clave a que la b? (comparación por orden, con margen para los decimales) */
function menor(a, b) {
  for (let i = 0; i < a.length; i++) { if (a[i] < b[i] - 1e-6) return true; if (a[i] > b[i] + 1e-6) return false; }
  return false;
}

/** Índice con las dos búsquedas a partir de los registros */
function crearIndice(registros) {
  const porPagina = new Map();
  // línea → {pagina, y, arriba, abajo}: el primer sitio donde aparece (página menor y, en ella, lo más arriba). Primero con sus palabras:
  // la caja de un renglón lleva la línea donde acabó el párrafo (p. ej. el \item siguiente), así que solo vale si la línea no tiene palabras
  const primera = new Map(), deCajas = new Map();
  let ultimaLinea = 0;
  for (const r of registros) {
    if (!porPagina.has(r.p)) porPagina.set(r.p, []);
    porPagina.get(r.p).push(r);
    if (r.l > ultimaLinea) ultimaLinea = r.l;
    // las cajas que ocupan casi toda la página (el cuerpo de la página, una columna) no dicen dónde está la línea
    if (r.caja && r.abajo - r.arriba > GRANDE) continue;
    const m = r.caja ? deCajas : primera;
    const p = m.get(r.l);
    if (!p || r.p < p.pagina || (r.p === p.pagina && r.y < p.y)) m.set(r.l, { pagina: r.p, y: r.y, arriba: r.arriba, abajo: r.abajo, cajas: r.caja });
  }
  for (const [l, p] of deCajas) if (!primera.has(l)) primera.set(l, p);
  // hasta dónde llega cada línea en su primera página (un párrafo escrito en una sola línea del .tex ocupa varios renglones)
  for (const r of registros) {
    if (r.caja && r.abajo - r.arriba > GRANDE) continue;
    const p = primera.get(r.l);
    if (p && r.p === p.pagina && r.caja === p.cajas && r.abajo > p.abajo) p.abajo = r.abajo;
  }

  /**
   * Sitio del PDF de una línea del .tex (1 = primera): página, y de su primer renglón (línea base), arriba y abajo de lo que ocupa
   * en esa página. Si la línea no tiene nada en el PDF (en blanco, comentario…), la más cercana que sí (primero la de abajo)
   */
  function posicion(linea) {
    for (let d = 0; d < 400; d++) {
      const a = primera.get(linea + d); if (a) return { pagina: a.pagina, y: a.y, arriba: a.arriba, abajo: a.abajo, linea: linea + d };
      if (d && linea - d > 0) { const b = primera.get(linea - d); if (b) return { pagina: b.pagina, y: b.y, arriba: b.arriba, abajo: b.abajo, linea: linea - d }; }
    }
    return null;
  }

  // caja del cuerpo de cada página (la más alta): lo que queda fuera es la cabecera o el pie, que SyncTeX atribuye a la línea
  // que TeX leía al cerrar la página (más abajo en el .tex) y haría saltar la sincronización
  const cuerpo = new Map();
  for (const [p, rs] of porPagina) {
    let c = null;
    for (const r of rs) if (r.caja && r.abajo - r.arriba > GRANDE && (!c || r.abajo - r.arriba > c.abajo - c.arriba)) c = r;
    if (c) cuerpo.set(p, { arriba: c.arriba, abajo: c.abajo });
  }

  /** Línea del .tex en un punto del PDF (página, y desde arriba y, si se sabe, x). null si la página no tiene nada del fichero */
  function linea(pagina, y, x) {
    const todos = porPagina.get(pagina);
    if (!todos || !todos.length) return null;
    // solo cajas del tamaño de una línea (o fórmula): las grandes (cuerpo de la página, columnas) contienen cualquier punto y taparían
    // la línea más cercana cuando el punto cae entre dos renglones. Si la página no tiene otras, valen las grandes.
    // Con cuerpo conocido, el punto se lleva dentro de él y no cuentan la cabecera ni el pie
    const c = cuerpo.get(pagina);
    if (c) y = Math.min(Math.max(y, c.arriba), c.abajo);
    let finas = todos.filter((r) => r.abajo - r.arriba <= GRANDE);
    if (c) { const dentro = finas.filter((r) => r.abajo >= c.arriba - 2 && r.arriba <= c.abajo + 2); if (dentro.length) finas = dentro; }
    const rs = finas.length ? finas : todos;
    let mejor = null, clave = null;
    for (const r of rs) {
      const dv = y < r.arriba ? r.arriba - y : y > r.abajo ? y - r.abajo : 0;
      let dh = 0;
      if (x != null) { const fin = r.x + Math.max(r.w, 0); dh = x < r.x ? r.x - x : x > fin ? x - fin : 0; }
      // primero lo que contiene el punto en vertical; dentro, las palabras antes que las cajas (la caja de un renglón lleva la línea
      // donde acabó el párrafo, a menudo la línea en blanco de después; cada palabra, la suya); luego lo más cercano en horizontal;
      // luego lo más pequeño (lo más concreto)
      const k = [dv > 0 ? 1 : 0, dv, r.caja ? 1 : 0, dh, r.abajo - r.arriba];
      if (!clave || menor(k, clave)) { mejor = r; clave = k; }
    }
    return mejor ? mejor.l : null;
  }

  return { posicion, linea, paginas: () => [...porPagina.keys()].sort((a, b) => a - b), lineas: () => [...primera.keys()].sort((a, b) => a - b), ultimaLinea, registros: registros.length };
}

module.exports = { leer, SP_POR_BP };
