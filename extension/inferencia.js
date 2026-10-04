// Inferencia del tema de destino de una nota (sin dependencias de VS Code, para poder probarlo aparte).
// Reglas (de más a menos fuerza):
//   1. Código escrito en la nota (3.B.29, 3B29, 3b 29…)                → casi seguro
//   2. Modelo nombrado (familias de main/analisis/desarrollos.json)    → temas donde se DESARROLLA
//   3. Palabras del título o subtítulo del tema                         → fuerte
//   4. Palabras de los epígrafes del tema                               → fuerte
//   5. Palabras del texto del tema (las raras pesan más que las comunes) → débil
//   6. Contexto: el tema abierto y los destinos usados hace poco        → desempate
'use strict';
const { tituloTema, indiceTema, sinComentario } = require('./parser');

const VACIAS = new Set(('de la el en los las del por con para una uno unos unas que como mas sus ese esa este esta esto '
  + 'son ser sobre entre sin sus nos les hay muy pero tambien cuando donde desde hasta ver tema nota revisar anadir '
  + 'incluir falta poner mirar the and for with from that this teoria analisis politica economia economica economico')
  .split(' '));

/** minúsculas, sin acentos ni órdenes LaTeX */
function normalizar(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\\[a-zA-Z]+\*?/g, ' ').toLowerCase();
}
function raiz(p) { return p.length > 5 && p.endsWith('es') ? p.slice(0, -2) : p.length > 4 && p.endsWith('s') ? p.slice(0, -1) : p; }
function palabras(s) {
  return (normalizar(s).match(/[a-z0-9]+/g) || []).filter((p) => p.length >= 3 && !VACIAS.has(p) && !/^\d+$/.test(p)).map(raiz);
}
function compacto(s) { return normalizar(s).replace(/[^a-z0-9]/g, ''); }

/** Códigos escritos en la nota: 3.B.29 · 3B29 · 3-b-29 · 3 b 29 */
function codigosEn(nota) {
  const r = new Set();
  const rx = /(^|[^0-9])([34])\s*[.\-_ ]?\s*([ab])\s*[.\-_ ]?\s*(\d{1,3})(?!\d)/gi;
  let m;
  while ((m = rx.exec(nota))) r.add(`${m[2]}.${m[3].toUpperCase()}.${Number(m[4])}`);
  return [...r];
}

/**
 * Índice de búsqueda. temas: [{codigo, texto}], familias: {nombre: [códigos]} (puede ser {})
 */
function construirIndice(temas, familias) {
  const df = new Map();
  const lista = temas.map(({ codigo, texto }) => {
    const t = tituloTema(texto) || {};
    const titulo = [t.corto, t.completo].filter(Boolean).join('. ');
    const epigrafes = new Map(); // palabra → [títulos de epígrafe]
    const rec = (ns) => ns.forEach((n) => {
      palabras(n.titulo).forEach((p) => { const l = epigrafes.get(p) || []; if (!l.includes(n.titulo)) l.push(n.titulo); epigrafes.set(p, l); });
      rec(n.hijos);
    });
    rec(indiceTema(texto));
    const ini = texto.indexOf('\\begin{document}');
    const cuerpo = new Map();
    texto.slice(ini >= 0 ? ini : 0).split('\n').map(sinComentario).forEach((l) => palabras(l).forEach((p) => cuerpo.set(p, (cuerpo.get(p) || 0) + 1)));
    const todas = new Set([...cuerpo.keys(), ...epigrafes.keys(), ...palabras(titulo)]);
    todas.forEach((p) => df.set(p, (df.get(p) || 0) + 1));
    return { codigo, titulo: t.corto || codigo, completo: t.completo || '', tit: new Set(palabras(titulo)), epigrafes, cuerpo };
  });
  const modelos = Object.entries(familias || {}).map(([nombre, cods]) => ({
    nombre, cods: new Set(cods),
    claves: [nombre, ...nombre.split(/[/(]/)].map((x) => compacto(x.replace(/\)/g, ''))).filter((k) => k.length >= 4),
  }));
  return { temas: lista, df, n: lista.length, modelos };
}

/**
 * Sugerencias ordenadas: [{codigo, titulo, completo, puntos, motivo}]
 * contexto: {abierto: '3.A.18' | null, recientes: ['3.B.29', …]}
 */
function sugerir(indice, nota, contexto = {}) {
  const pals = [...new Set(palabras(nota))];
  const comp = compacto(nota);
  const cods = new Set(codigosEn(nota));
  const idf = (p) => Math.log((indice.n + 1) / (1 + (indice.df.get(p) || 0)));
  const modelosNota = indice.modelos.filter((m) => m.claves.some((k) => comp.includes(k)));
  const recientes = contexto.recientes || [];

  return indice.temas.map((t) => {
    const motivos = [];
    let puntos = 0;
    const suma = (v, motivo) => { if (v > 0) { puntos += v; motivos.push([v, motivo]); } };
    if (cods.has(t.codigo)) suma(100, 'código en la nota');
    modelosNota.filter((m) => m.cods.has(t.codigo)).forEach((m) => suma(4, `modelo: ${m.nombre}`));
    let vt = 0, ve = 0, vc = 0; const pc = [], pe = new Map();
    for (const p of pals) {
      const w = idf(p);
      if (t.tit.has(p)) vt += 3 * w;
      else if (t.epigrafes.has(p)) { ve += 2 * w; t.epigrafes.get(p).forEach((e) => pe.set(e, (pe.get(e) || 0) + w)); }
      const tf = t.cuerpo.get(p) || 0;
      if (tf) { vc += w * Math.min(1, Math.log(1 + tf) / Math.log(11)); pc.push(p); }
    }
    suma(vt, 'título del tema');
    suma(ve, `epígrafe «${[...pe.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0])[0]}»`);
    suma(vc, `aparece en el texto (${pc.slice(0, 3).join(', ')})`);
    return { t, puntos, motivos };
  }).map((r, _, todos) => {
    // Contexto: decide solo cuando la nota no da pistas claras (ningún tema supera 3 puntos)
    const pistas = Math.max(...todos.map((x) => x.puntos));
    const { t, motivos } = r;
    let puntos = r.puntos;
    const k = recientes.indexOf(t.codigo);
    if (contexto.abierto === t.codigo) { const v = pistas < 3 ? 5 : 1; puntos += v; motivos.push([v, 'tema abierto']); }
    if (k >= 0) { const v = (pistas < 3 ? 3 : 0.6) - 0.1 * k; puntos += v; motivos.push([v, 'usado hace poco']); }
    motivos.sort((a, b) => b[0] - a[0]);
    return { codigo: t.codigo, titulo: t.titulo, completo: t.completo, puntos, motivo: motivos.length ? motivos[0][1] : '' };
  }).sort((a, b) => b.puntos - a.puntos || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
}

/** Escapa los caracteres especiales de LaTeX y une las líneas en un solo párrafo */
function escaparLatex(s) {
  return s.replace(/\s*\n\s*/g, ' ').trim()
    .replace(/\\/g, '\u0000')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\u0000/g, '\\textbackslash{}');
}

/** Línea de la nota: \textbf{NOTA (04/10/2026, desde 3.A.18):} texto */
function lineaNota(texto, origen, fecha = new Date()) {
  const f = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
  return `\\textbf{NOTA (${f}${origen ? `, desde ${origen}` : ''}):} ${escaparLatex(texto)}`;
}

/**
 * Dónde y qué insertar para añadir la nota al final de \modificaciones{…}.
 * Devuelve {desde, hasta, insertar} (posiciones en el texto) o, si no hay bloque, lo crea tras \begin{document}.
 */
function insercion(texto, linea) {
  // se busca después de \begin{document}: en el preámbulo está la definición de la macro
  const docIni = Math.max(0, texto.indexOf('\\begin{document}'));
  const rxM = /\\modificaciones\s*\{/g; rxM.lastIndex = docIni;
  let m = rxM.exec(texto);
  while (m && /^\s*%/.test(texto.slice(texto.lastIndexOf('\n', m.index) + 1, m.index + 1))) m = rxM.exec(texto); // ignora comentadas
  if (m) {
    let prof = 0, cierre = -1;
    for (let j = m.index + m[0].length - 1; j < texto.length; j++) {
      const c = texto[j];
      if (c === '\\') { j++; continue; }
      if (c === '%') { const nl = texto.indexOf('\n', j); if (nl < 0) break; j = nl; continue; }
      if (c === '{') prof++;
      else if (c === '}' && --prof === 0) { cierre = j; break; }
    }
    if (cierre >= 0) {
      const abre = m.index + m[0].length;
      let fin = cierre; while (fin > abre && /\s/.test(texto[fin - 1])) fin--;
      const vacio = fin === abre;
      return { desde: fin, hasta: cierre, insertar: `${vacio ? '\n' : '\n\n'}    ${linea}\n` };
    }
  }
  const d = texto.indexOf('\\begin{document}');
  const pos = d >= 0 ? texto.indexOf('\n', d) + 1 : texto.length;
  return { desde: pos, hasta: pos, insertar: `\n\\modificaciones{\n    ${linea}\n}\n` };
}

module.exports = { construirIndice, sugerir, codigosEn, escaparLatex, lineaNota, insercion, palabras };
