// Afinidad entre temas de un mismo ejercicio (sin dependencias de VS Code, para poder probarla aparte).
// Explicación completa y pesos: main/CALENDARIO.md, apartado «Afinidad entre temas».
'use strict';
const { indiceTema, sinComentario } = require('./parser');

// Peso de cada señal en la afinidad final (suman 1). Ajustados con el calendario de la preparadora (ver CALENDARIO.md, apartado 4).
let PESOS = { ambitos: 0.35, programa: 0.30, lexico: 0.15, remisiones: 0.10, modelos: 0.10 };

const VACIAS = new Set(('de la el en los las del por con para una uno unos unas que como mas sus ese esa este esta esto son ser sobre '
  + 'entre sin nos les hay muy pero tambien cuando donde desde hasta ver tema caso casos tipo tipos forma formas parte partes '
  + 'introduccion conclusion contextualizacion relevancia problematica estructura exposicion recapitulacion extensiones relacion '
  + 'otras temario opinion idea final salida cierra preguntas test anexo historia analisis teoria teorias especial referencia '
  + 'economia economica economico economicos economicas the and for with from that this').split(' '));

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\\[a-zA-Z]+\*?/g, ' ').toLowerCase();
const raiz = (p) => (p.length > 5 && p.endsWith('es') ? p.slice(0, -2) : p.length > 4 && p.endsWith('s') ? p.slice(0, -1) : p);
const palabras = (s) => (norm(s).match(/[a-z]+/g) || []).filter((p) => p.length >= 4 && !VACIAS.has(p)).map(raiz);

/** Remisiones «Tema 3.A.44» que aparecen en el cuerpo del tema (sin contarse a sí mismo) */
function remisiones(codigo, texto) {
  const ini = texto.indexOf('\\begin{document}');
  const cuerpo = texto.slice(ini >= 0 ? ini : 0).split('\n').map(sinComentario).join('\n');
  const r = {};
  const rx = /Tema\s*([34])\s*\.?\s*([AB])\s*\.?\s*(\d{1,2})(?!\d)/g;
  let m;
  while ((m = rx.exec(cuerpo))) { const c = `${m[1]}.${m[2]}.${Number(m[3])}`; if (c !== codigo) r[c] = (r[c] || 0) + 1; }
  return r;
}

/** Título sin el número de la serie: «Análisis de mercados (III)» → «analisis de mercados» */
const baseSerie = (t) => norm(t.split(':')[0]).replace(/\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

// ---- detección de modelos en los pies de \eqblock{…}{pie}
const normM = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\\[a-z]+\*?/g, ' ').replace(/[^a-z0-9+]+/g, ' ').trim();
let clavesCache = null;
/** Variantes de nombre de cada familia de modelos: el nombre, sin paréntesis, cada parte separada por «/» y la sigla entre paréntesis */
function clavesModelos(desarrollos) {
  if (clavesCache && clavesCache.d === desarrollos) return clavesCache.k;
  const k = Object.keys((desarrollos && desarrollos.por_familia) || {}).map((f) => {
    const vs = new Set(); const add = (x) => { x = normM(x); if (x.length >= 4) vs.add(x); };
    add(f); add(f.replace(/\(.*?\)/g, ''));
    f.split('/').forEach((p) => { add(p); add(p.replace(/\(.*?\)/g, '')); });
    const sig = (f.match(/\((.*?)\)/) || [])[1]; if (sig && sig.length <= 12) add(sig);
    return { f, vs: [...vs] };
  });
  clavesCache = { d: desarrollos, k };
  return k;
}
/** Familias de modelos nombradas en los pies de las ecuaciones del tema */
function modelosEnPies(texto, desarrollos) {
  const pies = [];
  const rx = /\\eqblock\s*\{/g; let m;
  const cierre = (i) => { let p = 0; for (let j = i; j < texto.length; j++) { const c = texto[j]; if (c === '\\') { j++; continue; } if (c === '{') p++; else if (c === '}' && --p === 0) return j; } return texto.length; };
  while ((m = rx.exec(texto))) {
    const f1 = cierre(m.index + m[0].length - 1);
    let k = f1 + 1; while (/\s/.test(texto[k] || '')) k++;
    if (texto[k] !== '{') { rx.lastIndex = f1; continue; }
    const f2 = cierre(k);
    pies.push(` ${normM(texto.slice(k + 1, f2))} `);
    rx.lastIndex = f2;
  }
  if (!pies.length) return [];
  return clavesModelos(desarrollos).filter((c) => pies.some((p) => c.vs.some((v) => p.includes(` ${v} `) || p.includes(` ${v}`)))).map((c) => c.f);
}

/**
 * temas: [{codigo, parte: 'A'|'B', titulo, subtitulo, ambitos: [principal, …], texto|null}]
 * desarrollos: {por_tema: {codigo: [{familia}]}} · pesos: opcional, para probar otros pesos
 * Devuelve {codigos, idx, m: matriz n×n de afinidad 0..1, senales: {nombre: matriz}}
 */
function calcular(temas, desarrollos, pesosProbar) {
  const n = temas.length;
  const idx = Object.fromEntries(temas.map((t, i) => [t.codigo, i]));
  const vacia = () => Array.from({ length: n }, () => new Float64Array(n));
  const S = { ambitos: vacia(), remisiones: vacia(), modelos: vacia(), lexico: vacia(), programa: vacia() };
  const sim = (M, i, j, v) => { if (i !== j && v > M[i][j]) { M[i][j] = v; M[j][i] = v; } };

  // 1. Ámbitos temáticos (config/programa_N.json): mismo ámbito principal = 1; el principal de uno es ámbito del otro = 0,6;
  //    comparten algún ámbito secundario = 0,3
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = temas[i].ambitos || [], b = temas[j].ambitos || [];
    if (!a.length || !b.length) continue;
    const v = a[0] === b[0] ? 1 : (b.includes(a[0]) || a.includes(b[0])) ? 0.6 : a.some((x) => b.includes(x)) ? 0.3 : 0;
    sim(S.ambitos, i, j, v);
  }

  // 2. Remisiones explícitas entre temas («Ver Tema …»), en cualquiera de los dos sentidos
  temas.forEach((t, i) => {
    if (!t.texto) return;
    for (const [c, k] of Object.entries(remisiones(t.codigo, t.texto))) {
      const j = idx[c]; if (j == null) continue;
      sim(S.remisiones, i, j, Math.min(1, S.remisiones[i][j] + 0.5 * k));
    }
  });

  // 3. Modelos desarrollados en común: los del análisis revisado (analisis/desarrollos.json) más los que se detectan ahora
  //    en los pies de \eqblock del texto actual (el pie debe nombrar el modelo: «… Modelo de SOLOW»). Así un desarrollo nuevo cuenta enseguida.
  const fam = temas.map((t) => {
    const f = new Set(((desarrollos && desarrollos.por_tema) || {})[t.codigo]?.map((x) => x.familia) || []);
    if (t.texto) modelosEnPies(t.texto, desarrollos).forEach((x) => f.add(x));
    return f;
  });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let c = 0; fam[i].forEach((f) => { if (fam[j].has(f)) c++; });
    if (c) sim(S.modelos, i, j, Math.min(1, c / 2));
  }

  // 4. Léxico: similitud coseno TF-IDF de título y subtítulo (×3), epígrafes (×2) y texto (×1)
  const bolsas = temas.map((t) => {
    const b = new Map();
    const add = (s, w) => palabras(s).forEach((p) => b.set(p, (b.get(p) || 0) + w));
    add(`${t.titulo} ${t.subtitulo}`, 3);
    if (t.texto) {
      const rec = (ns) => ns.forEach((x) => { add(x.titulo, 2); rec(x.hijos); });
      rec(indiceTema(t.texto));
      const ini = t.texto.indexOf('\\begin{document}');
      t.texto.slice(ini >= 0 ? ini : 0).split('\n').map(sinComentario).forEach((l) => add(l, 1));
    }
    return b;
  });
  const df = new Map();
  bolsas.forEach((b) => b.forEach((_, p) => df.set(p, (df.get(p) || 0) + 1)));
  const vec = bolsas.map((b) => {
    const v = new Map(); let nn = 0;
    b.forEach((tf, p) => { const d = df.get(p); if (d < 2 || d > n * 0.3) return; const w = Math.log(1 + tf) * Math.log(n / d); v.set(p, w); nn += w * w; });
    nn = Math.sqrt(nn) || 1; v.forEach((w, p) => v.set(p, w / nn));
    return v;
  });
  const cos = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let s = 0; const [a, b] = vec[i].size < vec[j].size ? [vec[i], vec[j]] : [vec[j], vec[i]];
    a.forEach((w, p) => { const x = b.get(p); if (x) s += w * x; });
    cos.push([i, j, s]);
  }
  // se escala al percentil 99 para que la señal léxica ocupe el rango 0..1 sin saturarse
  const orden = cos.map((x) => x[2]).sort((a, b) => a - b);
  const p99 = orden[Math.floor(orden.length * 0.99)] || 1;
  cos.forEach(([i, j, s]) => sim(S.lexico, i, j, Math.min(1, s / p99)));

  // 5. Programa: temas consecutivos de la misma parte y series «(I), (II)…» del mismo título
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = temas[i], b = temas[j];
    if (a.parte !== b.parte) continue;
    const d = Math.abs(Number(a.codigo.split('.')[2]) - Number(b.codigo.split('.')[2]));
    let v = d === 1 ? 0.6 : d === 2 ? 0.3 : 0;
    if (a.titulo && baseSerie(a.titulo) === baseSerie(b.titulo) && /\((i|ii|iii|iv|v|vi)\)/i.test(a.titulo)) v = 1;
    sim(S.programa, i, j, v);
  }

  const pesos = { ...(pesosProbar || PESOS) };
  const m = vacia();
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    let v = 0; for (const k of Object.keys(S)) v += pesos[k] * S[k][i][j];
    m[i][j] = v;
  }
  return { codigos: temas.map((t) => t.codigo), idx, m, senales: S, pesos };
}

module.exports = { calcular, PESOS, remisiones, palabras, modelosEnPies };
