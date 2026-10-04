// Localiza y resume el desarrollo de un modelo dentro de un tema (sin dependencias de VS Code, para poder probarlo aparte).
// Reglas: main/RELACIONES.md
'use strict';
const { indiceTema, sinComentario, limpiar } = require('./parser');

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\\[a-zA-Z]+\*?/g, ' ').replace(/[^a-z0-9+]+/g, ' ').trim();

/** Variantes del nombre de una familia de modelos (como en afinidad.js) */
function claves(familia) {
  const vs = new Set(); const add = (x) => { x = norm(x); if (x.length >= 3) vs.add(x); };
  add(familia); add(familia.replace(/\(.*?\)/g, ''));
  familia.split('/').forEach((p) => { add(p); add(p.replace(/\(.*?\)/g, '')); });
  const sig = (familia.match(/\((.*?)\)/) || [])[1]; if (sig && sig.length <= 12) add(sig);
  return [...vs];
}
const menciona = (texto, cl) => { const t = ` ${norm(texto)} `; return cl.some((v) => t.includes(` ${v} `)); };

/** Cierre de llave equilibrada desde la posición de '{' */
function cierre(t, i) {
  let p = 0;
  for (let j = i; j < t.length; j++) { const c = t[j]; if (c === '\\') { j++; continue; } if (c === '{') p++; else if (c === '}' && --p === 0) return j; }
  return t.length;
}

/** Bloques \eqblock{matemática}{pie} de un texto: [{tex, pie, pos}] */
function ecuaciones(t) {
  const r = []; const rx = /\\eqblock\s*\{/g; let m;
  while ((m = rx.exec(t))) {
    const f1 = cierre(t, m.index + m[0].length - 1);
    let k = f1 + 1; while (/\s/.test(t[k] || '')) k++;
    if (t[k] !== '{') { rx.lastIndex = f1; continue; }
    const f2 = cierre(t, k);
    r.push({ tex: t.slice(m.index + m[0].length, f1).trim(), pie: limpiar(t.slice(k + 1, f2)), pos: m.index });
    rx.lastIndex = f2;
  }
  return r;
}

/** Epígrafes del tema con su rango de líneas [inicio, fin) y la cadena de títulos de sus antepasados */
function epigrafes(texto) {
  const plano = [];
  const rec = (ns, padres) => ns.forEach((n) => { plano.push({ ...n, padres }); rec(n.hijos, [...padres, n.titulo]); });
  rec(indiceTema(texto), []);
  const total = texto.split('\n').length;
  plano.forEach((n, i) => {
    let fin = total;
    for (let j = i + 1; j < plano.length; j++) if (plano[j].nivel <= n.nivel) { fin = plano[j].linea; break; }
    n.fin = fin;
  });
  return plano;
}

/**
 * Epígrafes donde un tema desarrolla un modelo.
 * 1) Los que contienen ecuaciones cuyo pie nombra el modelo («… Modelo AK»): el epígrafe más profundo que las contiene.
 * 2) Los que el análisis revisado (desarrollos.json) indica por su título; si ese título se repite en el tema
 *    («Supuestos»), solo cuentan los que nombran el modelo en su título, en el de un antepasado o en su texto.
 * De cada epígrafe cuenta su texto propio (hasta su primer subepígrafe). Devuelve [{titulo, numero, linea, fin}] en orden.
 */
function localizar(texto, familia, epigrafesRevisados = []) {
  const cl = claves(familia);
  const lineas = texto.split('\n');
  const nodos = epigrafes(texto);
  const segmento = (n) => lineas.slice(n.linea, n.fin).map(sinComentario).join('\n');
  const elegidos = new Set();
  // 1) por los pies de ecuación
  const posLinea = []; { let a = 0; lineas.forEach((l) => { posLinea.push(a); a += l.length + 1; }); }
  const lineaDe = (pos) => { let lo = 0, hi = posLinea.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (posLinea[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  for (const e of ecuaciones(texto)) {
    if (!menciona(e.pie, cl)) continue;
    const l = lineaDe(e.pos);
    const dentro = nodos.filter((n) => n.linea <= l && l < n.fin);
    if (!dentro.length) continue;
    const n = dentro[dentro.length - 1];
    // si el epígrafe tiene subepígrafes, solo su texto propio (hasta el primer subepígrafe): no todo el apartado
    const hijo = nodos.find((x) => x.linea > n.linea && x.linea < n.fin);
    elegidos.add(hijo ? { ...n, fin: hijo.linea, propio: true } : n);
  }
  // 2) por los títulos del análisis revisado
  for (const ep of epigrafesRevisados) {
    const iguales = nodos.filter((n) => norm(n.titulo) === norm(ep));
    if (iguales.length === 1) { elegidos.add(iguales[0]); continue; }
    iguales.filter((n) => menciona(n.titulo, cl) || n.padres.some((p) => menciona(p, cl)) || menciona(segmento(n), cl)).forEach((n) => elegidos.add(n));
  }
  // de cada epígrafe elegido cuenta su texto propio (hasta su primer subepígrafe): los subepígrafes que interesen se eligen aparte
  const propio = (n) => { const h = nodos.find((x) => x.linea > n.linea && x.linea < n.fin); return h ? { ...n, fin: h.linea } : n; };
  const lista = [...new Map([...elegidos].map((n) => [n.linea, propio(n)])).values()].sort((a, b) => a.linea - b.linea);
  return lista.filter((n) => !lista.some((m) => m !== n && m.linea <= n.linea && n.fin <= m.fin && (m.linea !== n.linea || m.fin !== n.fin)))
    .map((n) => ({ titulo: n.titulo, numero: n.numero, linea: n.linea, fin: n.fin }));
}

/** Huella del texto (para saber si un desarrollo ha cambiado desde que se analizó) */
function huella(s) {
  const t = norm(s); let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

/** Símbolos de la notación usada en un bloque de matemáticas: letras con subíndice/superíndice, griegas, operadores con nombre */
function notacion(tex) {
  const s = new Set();
  const t = tex.replace(/\\text\{[^{}]*\}/g, ' ').replace(/\\(mathrm|operatorname)\{([^{}]*)\}/g, '$2');
  (t.match(/\\(alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|varphi|psi|omega|Delta|Pi|Omega|Phi|Gamma|Lambda|Sigma)\b/g) || []).forEach((g) => s.add(g));
  (t.match(/(?<![\\a-zA-Z])[A-Za-z](?=[_^])/g) || []).forEach((g) => s.add(g));
  return s;
}

/**
 * Resumen automático de un desarrollo: subepígrafes, ecuaciones con su pie, primeras frases de los párrafos y partes presentes.
 * Es lo que se puede sacar sin entender el texto; el resumen de fondo lo escribe Claude (analisis/armonizacion.json).
 */
function resumenAuto(texto, nodos) {
  const lineas = texto.split('\n');
  const partes = nodos.map((n) => {
    const seg = lineas.slice(n.linea, n.fin).map(sinComentario).join('\n');
    const eqs = ecuaciones(seg);
    // texto sin ecuaciones ni órdenes de entorno, en párrafos
    let prosa = seg;
    eqs.forEach((e) => { prosa = prosa.replace(e.tex, ' '); });
    const frases = prosa.split(/\n\s*\n/).map((p) => limpiar(p.replace(/\\(sub)*section\*?\{[^{}]*\}|\\paragraph\{[^{}]*\}|\\begin\{[^{}]*\}|\\end\{[^{}]*\}|\\eqblock|\\imagenfit\{[^{}]*\}\{[^{}]*\}\{[^{}]*\}/g, ' ')))
      .filter((p) => p.length > 40).map((p) => { const m = p.match(/^.{40,}?[.:;](\s|$)/); return (m ? m[0] : p.slice(0, 220)).trim(); });
    const sub = epigrafes(texto).filter((x) => x.linea > n.linea && x.linea < n.fin).map((x) => x.titulo);
    return { titulo: n.titulo, numero: n.numero, linea: n.linea, subepigrafes: sub, ecuaciones: eqs.map(({ tex, pie }) => ({ tex, pie })), frases: frases.slice(0, 4),
      graficos: (seg.match(/\\imagenfit|\\includegraphics/g) || []).length };
  });
  const todo = nodos.map((n) => lineas.slice(n.linea, n.fin).join('\n')).join('\n');
  const notas = new Set(); partes.forEach((p) => p.ecuaciones.forEach((e) => notacion(e.tex).forEach((x) => notas.add(x))));
  const t = norm(todo);
  const hay = (rx) => rx.test(t);
  return {
    partes,
    huella: huella(todo),
    indicadores: {
      ecuaciones: partes.reduce((a, p) => a + p.ecuaciones.length, 0),
      graficos: partes.reduce((a, p) => a + p.graficos, 0),
      palabras: (t.match(/[a-z]{3,}/g) || []).length,
      notacion: [...notas].sort(),
      supuestos: hay(/\bsupuesto/),
      equilibrio: hay(/\bequilibrio\b/),
      estatica: hay(/estatica comparativa|perturbacion|shock/),
      implicaciones: hay(/implicacion|valoracion|conclusion|limitacion|critica/),
    },
  };
}

/**
 * Divergencia automática entre las presentaciones de un modelo en varios temas (0 = iguales, 1 = muy distintas):
 * 50 % notación (1 − parecido medio de los símbolos usados), 25 % número de ecuaciones (dispersión relativa),
 * 25 % partes presentes (supuestos, equilibrio, estática comparativa, implicaciones, gráficos) que tienen unos temas y otros no.
 */
function divergencia(resumenes) {
  const r = resumenes.filter(Boolean);
  if (r.length < 2) return { total: 0, notacion: 0, ecuaciones: 0, partes: 0 };
  let s = 0, n = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = new Set(r[i].indicadores.notacion), b = new Set(r[j].indicadores.notacion);
    const u = new Set([...a, ...b]).size; if (!u) continue;
    s += [...a].filter((x) => b.has(x)).length / u; n++;
  }
  const dNot = n ? 1 - s / n : 0.5;
  const eq = r.map((x) => x.indicadores.ecuaciones), media = eq.reduce((a, b) => a + b, 0) / eq.length;
  const dEq = media ? Math.min(1, Math.sqrt(eq.reduce((a, b) => a + (b - media) ** 2, 0) / eq.length) / media) : 0;
  const claves2 = ['supuestos', 'equilibrio', 'estatica', 'implicaciones'];
  const dPar = (claves2.filter((k) => { const v = r.map((x) => x.indicadores[k]); return v.some(Boolean) && !v.every(Boolean); }).length
    + (r.some((x) => x.indicadores.graficos) && !r.every((x) => x.indicadores.graficos) ? 1 : 0)) / 5;
  return { total: Math.round((0.5 * dNot + 0.25 * dEq + 0.25 * dPar) * 100) / 100, notacion: dNot, ecuaciones: dEq, partes: dPar };
}

module.exports = { localizar, resumenAuto, divergencia, ecuaciones, huella, claves, epigrafes };
