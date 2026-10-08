// Pestaña Idiomas, fases 2–3: lógica sin VS Code de la biblioteca de textos, los resúmenes, la escritura y el oral.
// (Cortar textos por párrafos, preguntas de comprensión, dictados, comparación palabra a palabra, métricas del oral e instrucciones para el
// modelo local.) Reglas: main/IDIOMAS.md
'use strict';
const I = require('./idiomas');
const { tr } = require('./media/i18n-idiomas.js');

// ---------------------------------------------------------------- longitud flexible (siempre por párrafos enteros)
const LONGITUDES = { corto: 150, estandar: 400, largo: 800, completo: Infinity };
/** Cuántos párrafos tomar (desde el principio) para acercarse a la longitud pedida sin pasarse mucho: al menos 1 */
function parrafosPara(parrafos, longitud) {
  const meta = typeof longitud === 'number' ? longitud : (LONGITUDES[longitud] || LONGITUDES.estandar);
  let total = 0, k = 0;
  for (const p of parrafos) {
    const n = palabras(p);
    if (k && total + n > meta * 1.15) break;
    total += n; k += 1;
    if (total >= meta * 0.9) break;
  }
  return Math.max(1, k);
}
const palabras = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

/** Texto recortado: párrafos, preguntas e ideas de esa parte; resumen modelo solo si es el texto entero */
function recortar(t, longitud) {
  const k = parrafosPara(t.parrafos || [], longitud);
  const entero = k >= (t.parrafos || []).length;
  return {
    k, entero, parrafos: t.parrafos.slice(0, k), palabras: t.parrafos.slice(0, k).reduce((a, p) => a + palabras(p), 0),
    preguntas: (t.preguntas || []).filter((p) => (p.parrafo || 0) < k),
    ideas: (t.ideas_clave || []).filter((x) => (x.parrafos || [0]).some((i) => i < k)),
    glosario: (t.glosario || []).filter((g) => (g.parrafo || 0) < k),
    resumenModelo: entero ? t.resumen_modelo || '' : '',
  };
}

// ---------------------------------------------------------------- comparación palabra a palabra (dictado, lectura en voz alta)
const tokens = (s) => String(s || '').replace(/[’`]/g, "'").split(/\s+/).map((w) => w.trim()).filter((w) => /[\p{L}\p{N}]/u.test(w));   // sin guiones ni signos sueltos
const clave = (w) => I.normalizar(w).replace(/^[«"'(\[¿¡]+|[»"'),.;:!?\]…]+$/g, '');
const claveSinAcentos = (w) => clave(w).normalize('NFD').replace(/[̀-ͯ]/g, '');
/**
 * Alinea el texto original con lo escrito u oído (distancia de edición por palabras).
 * Devuelve [{o: palabra original | null, e: palabra escrita | null, tipo: ok | acento | mal | falta | sobra}] y el resumen.
 */
function comparar(original, escrito) {
  const A = tokens(original), B = tokens(escrito);
  const a = A.map(clave), b = B.map(clave);
  const as = A.map(claveSinAcentos), bs = B.map(claveSinAcentos);
  const n = A.length, m = B.length;
  // matriz de costes (n y m pequeños: frases de dictado, o párrafos en la lectura en voz alta)
  const D = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  const coste = (i, j) => (a[i] === b[j] ? 0 : as[i] === bs[j] ? 0.5 : 1);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (coste(i - 1, j - 1) ? (coste(i - 1, j - 1) === 0.5 ? 1 : 2) : 0));
  }
  const out = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const c = coste(i - 1, j - 1);
      const diag = D[i - 1][j - 1] + (c ? (c === 0.5 ? 1 : 2) : 0);
      if (D[i][j] === diag) { out.push({ o: A[i - 1], e: B[j - 1], tipo: c === 0 ? 'ok' : c === 0.5 ? 'acento' : 'mal' }); i--; j--; continue; }
    }
    if (i > 0 && D[i][j] === D[i - 1][j] + 1) { out.push({ o: A[i - 1], e: null, tipo: 'falta' }); i--; continue; }
    out.push({ o: null, e: B[j - 1], tipo: 'sobra' }); j--;
  }
  out.reverse();
  const cuenta = (t) => out.filter((x) => x.tipo === t).length;
  const r = { ok: cuenta('ok'), acento: cuenta('acento'), mal: cuenta('mal'), falta: cuenta('falta'), sobra: cuenta('sobra'), total: n };
  r.nota = n ? Math.max(0, (r.ok + 0.5 * r.acento - 0.5 * r.sobra) / n) : 0;
  return { palabras: out, resumen: r };
}

/** Frases de dictado de una parte del texto: entre 6 y 22 palabras, repartidas por los párrafos */
function frasesDictado(parrafos, n = 5, semilla) {
  const frases = [];
  parrafos.forEach((p, i) => {
    for (const f of String(p).split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ«"“])/)) {
      const k = palabras(f);
      if (k >= 6 && k <= 22 && !/\d{3,}|https?:/.test(f)) frases.push({ parrafo: i, frase: f.trim() });
    }
  });
  if (frases.length <= n) return frases;
  // reparto: una de cada tramo del texto, al azar dentro del tramo
  const tramo = frases.length / n, out = [];
  const azar = I.barajar(frases.map((_, x) => x), semilla);
  for (let t = 0; t < n; t++) {
    const desde = Math.floor(t * tramo), hasta = Math.floor((t + 1) * tramo);
    const elegido = azar.find((x) => x >= desde && x < hasta);
    out.push(frases[elegido !== undefined ? elegido : desde]);
  }
  return out;
}

// ---------------------------------------------------------------- resumen: comprobaciones objetivas (sin modelo)
/** Fragmentos copiados del texto (5 palabras seguidas o más), para avisar: en el examen se pide resumir con palabras propias */
function copiado(texto, resumen, minimo = 5) {
  const T = tokens(texto).map(clave), R = tokens(resumen);
  const Rk = R.map(clave);
  const grams = new Set();
  for (let i = 0; i + minimo <= T.length; i++) grams.add(T.slice(i, i + minimo).join(' '));
  const marcado = new Array(R.length).fill(false);
  for (let i = 0; i + minimo <= Rk.length; i++) if (grams.has(Rk.slice(i, i + minimo).join(' '))) for (let j = i; j < i + minimo; j++) marcado[j] = true;
  const trozos = []; let cur = [];
  R.forEach((w, i) => { if (marcado[i]) cur.push(w); else if (cur.length) { trozos.push(cur.join(' ')); cur = []; } });
  if (cur.length) trozos.push(cur.join(' '));
  return { fragmentos: trozos, proporcion: R.length ? marcado.filter(Boolean).length / R.length : 0 };
}
/** Extensión recomendada del resumen: 20–30 % del texto, entre 60 y 400 palabras */
function extensionResumen(palabrasTexto) {
  const min = Math.max(60, Math.round(palabrasTexto * 0.2 / 10) * 10), max = Math.max(min + 40, Math.min(400, Math.round(palabrasTexto * 0.3 / 10) * 10));
  return [min, max];
}

// ---------------------------------------------------------------- controles objetivos de la corrección (v0.39.1)
// El modelo local (3B) es benévolo y a veces incoherente: dio 7,5 a un «Hi! This is just a test…» de 24 palabras, dio por recogidas todas las ideas,
// pidió escribir el resumen en español y propuso «mejoras» en castellano. Estas comprobaciones, sin modelo, mandan sobre lo que diga el modelo.
const VACIAS_L = {
  en: new Set('the a an and or but of to in on at by for with from as is are was were be been being it its this that these those there their they them he she his her we our you your i me my not no so than then also which who whom whose what when where why how will would can could should may might must shall do does did have has had into over under about after before between more most such some any each other only very just'.split(' ')),
  fr: new Set('le la les un une des du de d l et ou mais donc or ni car a à au aux en dans par pour sur sous avec sans ce cet cette ces se sa son ses leur leurs qui que quoi dont où il elle ils elles on nous vous je tu ne pas plus moins est sont été être avoir a ont fait comme aussi très tout tous toute toutes y'.split(' ')),
};
const VACIAS_ES = new Set('el la los las de del que y en un una por para con es se no lo al su sus como más pero sin sobre este esta ese esa muy ya'.split(' '));
const plano = (w) => String(w || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
const palabrasPlanas = (s) => (plano(s).match(/[a-z]+/g) || []);
const raiz5 = (w) => (w.length > 5 ? w.slice(0, 5) : w);
/** Raíces de las palabras con contenido (sin vacías, 4 letras o más), recortadas a 5 letras para tolerar plurales y tiempos verbales */
const raices = (s, l) => new Set(palabrasPlanas(s).filter((w) => w.length >= 4 && !(VACIAS_L[l] || VACIAS_L.en).has(w)).map(raiz5));
/** Cuántas raíces con contenido comparten dos textos */
const comunesRaices = (a, b, l) => { const B = raices(b, l); return [...raices(a, l)].filter((r) => B.has(r)).length; };
/** ¿Parece castellano? (para descartar «mejoras» que el modelo escribe en castellano en lugar de en la lengua del examen) */
function pareceCastellano(s, l) {
  const ws = palabrasPlanas(s); if (ws.length < 3) return false;
  const es = ws.filter((w) => VACIAS_ES.has(w)).length, ot = ws.filter((w) => (VACIAS_L[l] || VACIAS_L.en).has(w)).length;
  return es >= 2 && es > ot;
}
/** Comprobaciones del resumen: relación con el texto, cobertura léxica de cada idea y extensión */
function controlResumen({ lengua, texto, ideas, resumen, extension }) {
  const S = raices(resumen, lengua), T = raices(texto, lengua);
  const comunes = [...S].filter((r) => T.has(r)).length;
  const relacion = S.size ? comunes / S.size : 0;
  const n = palabras(resumen);
  return {
    palabras: n, comunes, relacion: Math.round(relacion * 100) / 100,
    fueraDeTema: comunes < 4 || relacion < 0.3,
    corto: n < extension[0], muyCorto: n < extension[0] * 0.5,
    ideas: ideas.map((x) => { const I_ = raices(x.idea, lengua); return I_.size ? [...I_].filter((r) => S.has(r)).length / I_.size : 0; }),
  };
}
/**
 * Frases del modelo que piden escribir en castellano o reprochan que el texto esté en la lengua del examen (en castellano, inglés o francés:
 * los comentarios llegan en la lengua del panel). Solo esas: «written in clear English» o «en un français soutenu» no se tocan.
 */
const PIDE_OTRA_LENGUA = new RegExp([
  "\\b(en|in) (espanol|castellano|spanish|espagnol)\\b",                                         // en español · in Spanish · en espagnol
  "\\b(esta|es|escrito|redactado) en (ingles|frances)\\b", "\\bno (esta|es) en (espanol|castellano)\\b",
  "\\bnot (be |been )?(written |in )?in (english|french)\\b", "\\b(is|was|been) (written )?in (english|french) (instead|rather)\\b",
  "\\bwritten in (english|french)\\b", "\\b(ecrit|redige) en (anglais|francais)\\b",
  "\\b(instead of|rather than) (english|french|spanish)\\b", "\\b(should|must) be (written )?in (english|french)\\b",
  "\\bn.?(est|etait) pas (ecrit |redige )?en (anglais|francais)\\b", "\\b(est|ecrit|redige) en (anglais|francais) au lieu\\b",
  "\\bau lieu (de l.?|du )?(anglais|francais|espagnol)\\b", "\\ben lugar de(l)? (ingles|frances|espanol)\\b",
].join('|'));
/** Quita frases repetidas y las que piden escribir en otra lengua (el resumen y el escrito van SIEMPRE en la lengua del examen) */
function limpiarComentario(txt, max = 3) {
  const vistas = new Set(), out = [];
  for (const f of String(txt || '').split(/(?<=[.!?])\s+/)) {
    const k = plano(f).replace(/[^a-z ]/g, '').trim();
    if (!k || vistas.has(k)) continue; vistas.add(k);
    if (PIDE_OTRA_LENGUA.test(plano(f))) continue;
    out.push(f.trim()); if (out.length >= max) break;
  }
  return out.join(' ');
}
/** Limpia la valoración del modelo: comentarios, «mejoras» que no salen del texto del alumno o vienen en castellano */
function depurarValoracion(v, textoAlumno, lengua) {
  if (!v || typeof v !== 'object') return v;
  const base = plano(textoAlumno).replace(/\s+/g, ' ');
  if (v.comentario) v.comentario = limpiarComentario(v.comentario, 3);
  for (const c of Object.values(v.criterios || {})) if (c && c.comentario) c.comentario = limpiarComentario(c.comentario, 2);
  if (Array.isArray(v.mejoras)) {
    v.mejoras = v.mejoras.filter((m) => m && m.original && m.propuesta && base.includes(plano(m.original).replace(/\s+/g, ' ').trim())
      && plano(m.original).trim() !== plano(m.propuesta).trim() && !pareceCastellano(m.propuesta, lengua)).slice(0, 8);
  }
  return v;
}
const tope = (c, max, motivo) => { if (!c) return; if (Number(c.nota) > max) { c.nota = max; if (motivo) c.comentario = `${motivo}${c.comentario ? ` ${c.comentario}` : ''}`; } };
/**
 * Aplica los controles objetivos a la valoración de un resumen. Devuelve {valoracion, nota, ideasEstado, avisos}.
 * Fuera de tema → 0 en todo. Ideas sin apenas palabras del resumen → «falta». Corto o sin las ideas esenciales → tope en «tarea» y en la nota.
 * lang: lengua del panel (es | en | fr) para los comentarios y avisos.
 */
function ajustarResumen(v, control, ideas, lang = 'es') {
  const t = (s, args) => tr(lang, s, args);
  const avisos = [];
  if (control.fueraDeTema) {
    const crit = Object.fromEntries(RUBRICA.map((c) => [c.id, { nota: 0, comentario: c.id === 'tarea' ? t('El texto no resume el artículo.') : t('No se valora: el texto no es un resumen del artículo.') }]));
    return { valoracion: { ...(v || {}), ideas: ideas.map((_, i) => ({ n: i + 1, estado: 'falta' })), criterios: crit, mejoras: [], inexactitudes: [],
      comentario: t('Esto no es un resumen del texto: apenas comparte vocabulario con él y no recoge ninguna de sus ideas. Nota: 0.') },
    nota: 0, ideasEstado: Object.fromEntries(ideas.map((_, i) => [i + 1, 'falta'])), avisos: [t('El texto no trata del artículo: nota 0.')] };
  }
  const val = v || {}; const estado = {};
  ideas.forEach((x, i) => {
    const dicho = ((val.ideas || []).find((y) => Number(y.n) === i + 1) || {}).estado || 'falta';
    const cob = control.ideas[i] || 0;
    estado[i + 1] = cob < 0.12 ? 'falta' : cob < 0.25 && dicho === 'recogida' ? 'parcial' : dicho;
  });
  val.ideas = ideas.map((_, i) => ({ n: i + 1, estado: estado[i + 1] }));
  const c = val.criterios || (val.criterios = {});
  const esenciales = ideas.map((x, i) => (x.principal ? estado[i + 1] : null)).filter(Boolean);
  const sinEsenciales = esenciales.length && esenciales.every((e) => e === 'falta');
  if (sinEsenciales) tope(c.tarea, 0, t('No recoge ninguna idea esencial.'));
  else if (esenciales.some((e) => e === 'falta')) tope(c.tarea, 2, t('Falta alguna idea esencial.'));
  if (control.muyCorto) tope(c.tarea, 1, t('Muy corto ({0} palabras).', [control.palabras]));
  else if (control.corto) tope(c.tarea, 2, t('Más corto de lo pedido ({0} palabras).', [control.palabras]));
  let nota = notaRubrica(c);
  if (nota != null) {
    if (sinEsenciales) { nota = Math.min(nota, 2); avisos.push(t('No recoge ninguna idea esencial: nota máxima 2.')); }
    if (control.muyCorto) { nota = Math.min(nota, 3); avisos.push(t('Menos de la mitad de la extensión pedida: nota máxima 3.')); }
  }
  return { valoracion: val, nota, ideasEstado: estado, avisos };
}
/** Escrito libre: si apenas comparte vocabulario con el enunciado, «tarea» como mucho 1; si es muy corto, tope de nota */
function ajustarEscrito(v, { lengua, enunciado, texto, extension, lang = 'es' }) {
  const t = (s, args) => tr(lang, s, args);
  const avisos = []; const val = v || {}; const c = val.criterios || (val.criterios = {});
  const S = raices(texto, lengua), E = raices(enunciado, lengua);
  const comunes = [...S].filter((r) => E.has(r)).length;
  if (comunes < 2) { tope(c.tarea, 1, t('No parece responder al enunciado.')); avisos.push(t('El texto apenas tiene relación con el enunciado.')); }
  const n = palabras(texto);
  if (n < extension[0] * 0.5) tope(c.tarea, 1, t('Muy corto ({0} palabras).', [n])); else if (n < extension[0]) tope(c.tarea, 2, t('Más corto de lo pedido ({0} palabras).', [n]));
  let nota = notaRubrica(c);
  if (nota != null && comunes < 2) nota = Math.min(nota, 3);
  if (nota != null && n < extension[0] * 0.5) nota = Math.min(nota, 3);
  return { valoracion: val, nota, avisos };
}

// ---------------------------------------------------------------- rúbrica (la misma para toda la escritura; 0–4 por criterio)
const RUBRICA = [
  { id: 'tarea', nombre: 'Cumplimiento de la tarea', resumen: 'Recoge las ideas principales, sin opiniones propias ni detalles accesorios, con la extensión pedida.',
    otra: 'Responde a todo lo que pide el enunciado, al destinatario y con la extensión pedida.' },
  { id: 'coherencia', nombre: 'Coherencia y cohesión', resumen: 'Orden lógico, párrafos y conectores variados; se entiende sin haber leído el texto.',
    otra: 'Orden lógico, párrafos y conectores variados; progresión clara de las ideas.' },
  { id: 'registro', nombre: 'Registro y adecuación', resumen: 'Registro formal e impersonal propio de un resumen.', otra: 'Registro adecuado a la situación y al destinatario; fórmulas propias del género.' },
  { id: 'correccion', nombre: 'Corrección gramatical y ortográfica', resumen: 'Pocos errores y ninguno que dificulte la comprensión.', otra: 'Pocos errores y ninguno que dificulte la comprensión.' },
  { id: 'vocabulario', nombre: 'Riqueza y precisión del vocabulario', resumen: 'Vocabulario variado y preciso; reformula en lugar de copiar.', otra: 'Vocabulario variado, preciso y adecuado al tema.' },
];
const BANDAS = ['Insuficiente', 'Flojo', 'Suficiente', 'Bien', 'Excelente'];
/** Rúbrica y bandas en la lengua del panel (las tablas de arriba quedan en castellano: los ids son los que usa la lógica) */
const rubricaEn = (lang) => RUBRICA.map((c) => ({ ...c, nombre: tr(lang, c.nombre), resumen: tr(lang, c.resumen), otra: tr(lang, c.otra) }));
const bandasEn = (lang) => BANDAS.map((b) => tr(lang, b));
/** Nota sobre 10 a partir de los cinco criterios (0–4) */
const notaRubrica = (criterios) => {
  const xs = RUBRICA.map((c) => Number((criterios[c.id] || {}).nota));
  if (xs.some((x) => !Number.isFinite(x))) return null;
  return Math.round((xs.reduce((a, b) => a + Math.max(0, Math.min(4, b)), 0) / (4 * RUBRICA.length)) * 100) / 10;
};

// ---------------------------------------------------------------- instrucciones para el modelo local (respuestas en JSON)
const NOMBRE_LENGUA = { en: 'English', fr: 'French' };
/** Lengua de los comentarios del modelo: la del panel (es | en | fr) */
const NOMBRE_PANEL = { es: 'Spanish (castellano)', en: 'English', fr: 'French' };
const comoPanel = (lp) => NOMBRE_PANEL[lp] || NOMBRE_PANEL.es;
/** Instrucciones de sistema. lp: lengua del panel, en la que van SOLO los comentarios, explicaciones y motivos */
const sistema = (lp) => 'You are a strict examiner for the foreign-language exam of the Spanish civil service competition «Técnico Comercial y Economista del Estado». '
  + 'The candidate is a native Spanish speaker. The candidate ALWAYS writes and speaks in the foreign language of the exam (English or French): that is correct and expected, '
  + 'never ask the candidate to use another language and never criticise the candidate for writing in the language of the exam. '
  + `Only YOUR comments, explanations and reasons to the candidate are written in ${comoPanel(lp)}, short and concrete, without repeating yourself. Quote the candidate's words when pointing out a problem. `
  + 'Be strict: an answer that does not do the task gets 0. Never invent errors: if something is correct, do not mark it. Answer ONLY with the JSON object requested.';
const SISTEMA = sistema('es');   // compatibilidad

const esquemaCriterios = () => ({ type: 'object', properties: Object.fromEntries(RUBRICA.map((c) => [c.id, { type: 'object', properties: { nota: { type: 'integer', minimum: 0, maximum: 4 }, comentario: { type: 'string' } }, required: ['nota', 'comentario'] }])), required: RUBRICA.map((c) => c.id) });
const esquemaMejoras = { type: 'array', items: { type: 'object', properties: { original: { type: 'string' }, propuesta: { type: 'string' }, motivo: { type: 'string' } }, required: ['original', 'propuesta', 'motivo'] } };
const listaErrores = (errores) => (errores || []).slice(0, 25).map((e) => `- «${e.fragmento}»: ${e.mensaje}${e.sugerencias && e.sugerencias.length ? ` → ${e.sugerencias.slice(0, 2).join(' / ')}` : ''}`).join('\n') || '(none)';

/** Corrección de un resumen frente a las ideas clave del texto */
function promptResumen({ lengua, texto, ideas, resumen, errores, extension, idiomaPanel = 'es' }) {
  const C = comoPanel(idiomaPanel);
  return {
    sistema: sistema(idiomaPanel),
    mensaje: `TASK: The candidate listened to (or read) the following ${NOMBRE_LENGUA[lengua]} text and wrote a summary in ${NOMBRE_LENGUA[lengua]}.\n\n`
      + `=== TEXT ===\n${texto}\n\n=== KEY IDEAS (numbered; * = essential) ===\n${ideas.map((x, i) => `${i + 1}.${x.principal ? '*' : ''} ${x.idea}`).join('\n')}\n\n`
      + `=== CANDIDATE'S SUMMARY, written in ${NOMBRE_LENGUA[lengua]} as required (${palabras(resumen)} words; recommended ${extension[0]}–${extension[1]}) ===\n${resumen}\n\n`
      + `=== GRAMMAR/SPELLING ISSUES FOUND BY LANGUAGETOOL ===\n${listaErrores(errores)}\n\n`
      + 'Return JSON: "ideas": for EACH key idea, its number and "estado" = "recogida" (clearly present, even if reworded), "parcial" or "falta"; '
      + `"criterios": score 0-4 and a one-sentence comment in ${C} for: tarea (coverage of essential ideas, no personal opinion, length), coherencia, registro (formal), correccion (grammar/spelling), vocabulario (variety, rewording instead of copying); `
      + `"inexactitudes": statements in the summary that contradict the text (explained in ${C}, max 3, empty if none); `
      + `"mejoras": up to 6 concrete rewrites: "original" = exact words copied from the CANDIDATE'S SUMMARY, "propuesta" = improved version in ${NOMBRE_LENGUA[lengua]} (never in Spanish), "motivo" = explanation in ${C}; `
      + `"comentario": 2-3 sentences in ${C} with the overall assessment and the single most useful advice.`,
    formato: { type: 'object', properties: {
      ideas: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, estado: { type: 'string', enum: ['recogida', 'parcial', 'falta'] } }, required: ['n', 'estado'] } },
      criterios: esquemaCriterios(), inexactitudes: { type: 'array', items: { type: 'string' } }, mejoras: esquemaMejoras, comentario: { type: 'string' } },
    required: ['ideas', 'criterios', 'mejoras', 'comentario'] },
  };
}

/** Corrección de una tarea de escritura (opinión, carta, correo…) */
function promptEscrito({ lengua, tarea, texto, errores, idiomaPanel = 'es' }) {
  const C = comoPanel(idiomaPanel);
  return {
    sistema: sistema(idiomaPanel),
    mensaje: `TASK given to the candidate (${NOMBRE_LENGUA[lengua]}, level ${tarea.nivel}, register: ${tarea.registro}, ${tarea.palabras[0]}–${tarea.palabras[1]} words):\n${tarea.enunciado}\n\n`
      + `=== CANDIDATE'S TEXT (${palabras(texto)} words) ===\n${texto}\n\n=== GRAMMAR/SPELLING ISSUES FOUND BY LANGUAGETOOL ===\n${listaErrores(errores)}\n\n`
      + `Return JSON: "criterios": score 0-4 and a one-sentence comment in ${C} for: tarea (does it do everything the task asks, for the right reader, with the right length), coherencia, registro, correccion, vocabulario; `
      + `"mejoras": up to 8 concrete rewrites ("original" = exact words copied from the candidate's text, "propuesta" = improved version in ${NOMBRE_LENGUA[lengua]}, never in Spanish, "motivo" = explanation in ${C}); `
      + `"comentario": 2-3 sentences in ${C}: overall assessment and the most useful advice.`,
    formato: { type: 'object', properties: { criterios: esquemaCriterios(), mejoras: esquemaMejoras, comentario: { type: 'string' } }, required: ['criterios', 'mejoras', 'comentario'] },
  };
}

/** Respuesta abierta de comprensión frente a la respuesta modelo */
function promptAbierta({ lengua, pregunta, modelo, cita, respuesta, idiomaPanel = 'es' }) {
  return {
    sistema: sistema(idiomaPanel),
    mensaje: `Reading/listening comprehension question (${NOMBRE_LENGUA[lengua]}): ${pregunta}\nModel answer: ${modelo}\nEvidence in the text: ${cita || '-'}\n`
      + `Candidate's answer: ${respuesta}\n\nJudge ONLY the content (not the grammar). Return JSON: "nota": 2 = correct, 1 = partly correct, 0 = wrong or empty; "comentario": one sentence in ${comoPanel(idiomaPanel)} explaining what is right or missing.`,
    formato: { type: 'object', properties: { nota: { type: 'integer', minimum: 0, maximum: 2 }, comentario: { type: 'string' } }, required: ['nota', 'comentario'] },
  };
}

/** Respuesta oral a una pregunta del tribunal (transcrita con whisper) */
function promptTribunal({ lengua, pregunta, ideas, transcripcion, segundos, texto, idiomaPanel = 'es' }) {
  const C = comoPanel(idiomaPanel);
  return {
    sistema: sistema(idiomaPanel),
    mensaje: `ORAL exam, question from the board (${NOMBRE_LENGUA[lengua]}): ${pregunta}\n${ideas && ideas.length ? `Possible ideas: ${ideas.join(' / ')}\n` : ''}`
      + `${texto ? `The question refers to this text:\n${texto.slice(0, 6000)}\n` : ''}`
      + `Automatic transcription of the candidate's spoken answer (${Math.round(segundos || 0)} s; transcription may hide hesitations; ignore punctuation):\n${transcripcion}\n\n`
      + 'Return JSON: "contenido": 0-4 (relevance and depth of the answer); "lengua": 0-4 (grammar and vocabulary as far as the transcription shows); '
      + `"comentario": 2 sentences in ${C}; "mejoras": up to 4 rewrites ("original" from the transcription, "propuesta" in ${NOMBRE_LENGUA[lengua]}, "motivo" in ${C}); `
      + `"repregunta": one natural follow-up question the board could ask next, in ${NOMBRE_LENGUA[lengua]}.`,
    formato: { type: 'object', properties: { contenido: { type: 'integer', minimum: 0, maximum: 4 }, lengua: { type: 'integer', minimum: 0, maximum: 4 },
      comentario: { type: 'string' }, mejoras: esquemaMejoras, repregunta: { type: 'string' } }, required: ['contenido', 'lengua', 'comentario', 'repregunta'] },
  };
}

/** Exposición oral sobre un texto (o lectura del propio resumen): cobertura de ideas y lengua */
function promptExposicion({ lengua, texto, ideas, transcripcion, segundos, idiomaPanel = 'es' }) {
  const C = comoPanel(idiomaPanel);
  return {
    sistema: sistema(idiomaPanel),
    mensaje: `ORAL exam: after reading the text below, the candidate gave an oral presentation about it (${Math.round((segundos || 0) / 60)} min). `
      + `Text (${NOMBRE_LENGUA[lengua]}):\n${texto.slice(0, 9000)}\n\nKey ideas (* = essential):\n${ideas.map((x, i) => `${i + 1}.${x.principal ? '*' : ''} ${x.idea}`).join('\n')}\n\n`
      + `Automatic transcription of the presentation:\n${transcripcion}\n\n`
      + `Return JSON: "ideas": for each key idea, "n" and "estado" (recogida | parcial | falta); "criterios": 0-4 + comment in ${C} for: tarea (coverage and personal contribution), coherencia (structure: introduction, development, conclusion), registro, correccion, vocabulario; `
      + `"mejoras": up to 6 rewrites ("original" from the transcription, "propuesta" in ${NOMBRE_LENGUA[lengua]}, "motivo" in ${C}); "comentario": 2-3 sentences in ${C}.`,
    formato: { type: 'object', properties: {
      ideas: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, estado: { type: 'string', enum: ['recogida', 'parcial', 'falta'] } }, required: ['n', 'estado'] } },
      criterios: esquemaCriterios(), mejoras: esquemaMejoras, comentario: { type: 'string' } }, required: ['ideas', 'criterios', 'comentario'] },
  };
}

// ---------------------------------------------------------------- métricas del oral (a partir de la transcripción de whisper con tiempos)
/**
 * segmentos: [{t0, t1 (s), texto}] (de whisper, con -ml para trozos cortos). Devuelve palabras por minuto, pausas largas, muletillas y
 * variedad léxica. Whisper suele borrar las muletillas: la cifra es un mínimo.
 */
const MULETILLAS = { en: /\b(uh+|um+|er+m?|hmm+|you know|i mean|like|sort of|kind of|basically|actually)\b/gi, fr: /\b(euh+|bah|ben|hein|bon|du coup|en fait|genre|voilà|quoi)\b/gi };
function metricasOral(segmentos, lengua, duracion) {
  const segs = (segmentos || []).filter((s) => s.texto && s.texto.trim());
  const texto = segs.map((s) => s.texto.trim()).join(' ');
  const ws = tokens(texto).map(clave).filter((w) => /\p{L}/u.test(w));
  const habla = segs.reduce((a, s) => a + Math.max(0, (s.t1 || 0) - (s.t0 || 0)), 0);
  const total = duracion || (segs.length ? segs[segs.length - 1].t1 : 0) || habla;
  const pausas = [];
  for (let i = 1; i < segs.length; i++) { const p = (segs[i].t0 || 0) - (segs[i - 1].t1 || 0); if (p >= 2) pausas.push({ en: segs[i - 1].t1, dura: Math.round(p * 10) / 10 }); }
  const muletillas = (texto.match(MULETILLAS[lengua] || /$^/) || []).length;
  const unicas = new Set(ws).size;
  return {
    palabras: ws.length, segundos: Math.round(total), ppm: total ? Math.round((ws.length / total) * 60) : 0,
    ppmHablando: habla ? Math.round((ws.length / habla) * 60) : 0,
    pausasLargas: pausas.length, pausaMax: pausas.reduce((a, p) => Math.max(a, p.dura), 0), pausas: pausas.slice(0, 20),
    muletillas, variedad: ws.length ? Math.round((unicas / Math.sqrt(2 * ws.length)) * 100) / 100 : 0,   // índice de Guiraud corregido
    texto,
  };
}
/** Velocidad orientativa: lectura en voz alta y exposición de un hablante de C1 rondan 120–160 palabras por minuto */
const valorarVelocidad = (ppm, lang = 'es') => tr(lang, ppm < 90 ? 'lenta' : ppm < 115 ? 'algo lenta' : ppm <= 170 ? 'adecuada' : 'rápida');

module.exports = { LONGITUDES, parrafosPara, recortar, palabras, comparar, frasesDictado, copiado, extensionResumen, RUBRICA, BANDAS, rubricaEn, bandasEn, notaRubrica,
  comunesRaices, controlResumen, ajustarResumen, ajustarEscrito, depurarValoracion, limpiarComentario, pareceCastellano,
  promptResumen, promptEscrito, promptAbierta, promptTribunal, promptExposicion, metricasOral, valorarVelocidad };
