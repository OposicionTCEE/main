// Tiempo restante y progreso de un tema (sin dependencias de VS Code, para poder probarlo aparte)
'use strict';
const { indiceTema, sinComentario } = require('./parser');

// Unidades de trabajo que vale cada pendiente
const PESOS = { vacio: 1, nota: 0.5, ojo: 0.3, sinPdf: 1, ocr: 0.02, ocrMax: 2 };
// Ritmo inicial supuesto (minutos por unidad) y cuántas unidades "pesa" esa suposición frente a tus datos reales
const RITMO_INICIAL = 30, PESO_INICIAL = 10;
// Introducción y Conclusión no cuentan como trabajo pendiente
const NO_CUENTAN = /^(Introducci|Conclusi)/i;
// Temas "esqueleto" (casi sin desarrollar): un tema desarrollado tiene ~24 epígrafes finales en el cuerpo (mediana del temario)
// y ninguno tiene menos de ~2.300 palabras en el cuerpo. Por debajo de 2.000 palabras se añaden los epígrafes que faltan,
// en proporción a lo que falta por escribir. Así un tema vacío, sin epígrafes, no aparece como casi terminado.
const EPIGRAFES_TIPICOS = 24, PALABRAS_ESQUELETO = 2000;

/** Posición [inicio, fin) del contenido de \macro{…} (llaves equilibradas), o null */
function bloque(texto, macro) {
  const m = new RegExp(`\\\\${macro}\\s*\\{`).exec(texto);
  if (!m) return null;
  let prof = 0;
  for (let j = m.index + m[0].length - 1; j < texto.length; j++) {
    const c = texto[j];
    if (c === '\\') { j++; continue; }
    if (c === '{') prof++;
    else if (c === '}' && --prof === 0) return [m.index, m.index + m[0].length, j];
  }
  return null;
}

/** Notas pendientes del bloque \modificaciones: \item o párrafos (sin contar "Última modificación: …") */
function contarNotas(contenido) {
  const items = (contenido.match(/\\item\b/g) || []).length;
  if (items) return items;
  return contenido.split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(\\[a-z]+\{)*\s*Última modificación/i.test(p)).length;
}

/** Errores de tipo OCR / Markdown pegado: # sueltos, **, �, caracteres de control, [Seguro]/[Probable]/[Suposición] */
function contarOcr(texto) {
  const t = texto
    .replace(/\\(href|url)\s*\{[^{}]*\}/g, ' ')   // los # de las direcciones web son correctos
    .replace(/#\d/g, ' ');                          // parámetros de macros (#1)
  const n = (rx) => (t.match(rx) || []).length;
  return n(/(^|[^\\])#/g) + n(/\*\*/g) + n(/�/g)
    + n(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‏-]/g)
    + n(/\[(Seguro|Probable|Suposición)\]/g);
}

/**
 * Pendientes del tema. estadoPdf: 'ok' | 'error' | null (null = nunca compilado aquí: no penaliza)
 * Devuelve { vacios, llenos, notas, ojo, sinPdf, ocr, unidades, otros }
 */
function pendientes(texto, estadoPdf) {
  const lineas = texto.split('\n');
  const ini = lineas.findIndex((l) => /\\begin\{document\}/.test(sinComentario(l)));
  const cuerpo = lineas.slice(ini >= 0 ? ini + 1 : 0).map(sinComentario).join('\n');

  const b = bloque(cuerpo, 'modificaciones');
  const notas = b ? contarNotas(cuerpo.slice(b[1], b[2])) : 0;
  const resto = b ? cuerpo.slice(0, b[0]) + cuerpo.slice(b[2] + 1) : cuerpo;

  let vacios = 0, llenos = 0;
  const hojas = (ns) => ns.forEach((n) => { if (n.hijos.length) hojas(n.hijos); else if (n.vacio) vacios++; else llenos++; });
  const indice = indiceTema(texto);
  const cuerpoIdx = indice.filter((n) => !NO_CUENTAN.test(n.titulo));
  hojas(cuerpoIdx);

  // palabras del cuerpo (sin Introducción, Conclusión ni \modificaciones): solo para detectar temas esqueleto
  const todas = texto.split('\n');
  let palabras = 0;
  cuerpoIdx.forEach((n) => {
    const k = indice.indexOf(n);
    const fin = k + 1 < indice.length ? indice[k + 1].linea : todas.length;
    let t = todas.slice(n.linea, fin).map(sinComentario).join('\n');
    const bm = bloque(t, 'modificaciones'); if (bm) t = t.slice(0, bm[0]) + t.slice(bm[2] + 1);
    palabras += (t.replace(/\\[a-zA-Z]+\*?/g, ' ').match(/[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]{3,}/g) || []).length;
  });
  const faltan = Math.round(Math.max(0, EPIGRAFES_TIPICOS - vacios - llenos)
    * Math.max(0, 1 - palabras / PALABRAS_ESQUELETO) * 10) / 10;

  const ojo = (resto.match(/\bOJO\b/g) || []).length;
  const ocr = contarOcr(resto);
  const sinPdf = estadoPdf === 'error' ? 1 : 0;
  const otros = notas * PESOS.nota + ojo * PESOS.ojo + sinPdf * PESOS.sinPdf + Math.min(PESOS.ocrMax, ocr * PESOS.ocr);
  return { vacios, faltan, llenos, palabras, notas, ojo, sinPdf, ocr, otros, unidades: (vacios + faltan) * PESOS.vacio + otros };
}

/** Une los ficheros de progreso de todos los equipos (cada Mac escribe solo el suyo: sin conflictos al sincronizar) */
function combinar(equipos) {
  const temas = {};
  let minutos = 0, unidades = 0;
  for (const eq of equipos) {
    for (const [cod, d] of Object.entries((eq && eq.temas) || {})) {
      const t = temas[cod] || (temas[cod] = { minutos: 0, unidades: 0, base: null, hecho: null });
      t.minutos += d.minutos || 0;
      t.unidades += d.unidades || 0;
      if (d.base != null) t.base = Math.max(t.base == null ? 0 : t.base, d.base);
      if (d.hecho && (!t.hecho || d.hecho.fecha > t.hecho.fecha)) t.hecho = d.hecho;
      minutos += d.minutos || 0;
      unidades += d.unidades || 0;
    }
  }
  return { temas, ritmo: { minutos, unidades } };
}

/** Minutos por unidad: tu ritmo real, suavizado con la suposición inicial mientras hay pocos datos */
function ritmo(r) {
  return (r.minutos + RITMO_INICIAL * PESO_INICIAL) / (r.unidades + PESO_INICIAL);
}

/** {minutos, pct, hecho} del tema */
function estimar(p, datosTema, r) {
  if (datosTema && datosTema.hecho && datosTema.hecho.valor) return { minutos: 0, pct: 100, hecho: true };
  const base = datosTema && datosTema.base != null ? datosTema.base : p.otros;
  const hechas = p.llenos * PESOS.vacio + Math.max(0, base - p.otros);
  const total = hechas + p.unidades;
  return {
    minutos: p.unidades * ritmo(r),
    pct: total > 0 ? Math.round((100 * hechas) / total) : 100,
    hecho: false,
  };
}

function formatoTiempo(min) {
  const m = min > 60 ? Math.round(min / 5) * 5 : Math.round(min);
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

module.exports = { PESOS, pendientes, combinar, ritmo, estimar, formatoTiempo, contarNotas, contarOcr };
