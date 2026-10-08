// Lógica de la pestaña Idiomas sin VS Code (para poder probarla aparte): corrección de ejercicios, elección de ejercicios,
// repaso de fichas (ts-fsrs), estimación del nivel, compromisos y recomendaciones. Reglas: main/IDIOMAS.md
'use strict';

const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const nivelNum = (n) => NIVELES.indexOf(n) + 1;

// ------------------------------------------------------------------ Corrección
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Forma comparable de una respuesta: minúsculas, apóstrofos y comillas unificados, espacios simples, sin comas ni puntuación final */
function normalizar(s) {
  return String(s || '').replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae').replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"').replace(/ /g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s*([.!?…]+)$/, '').replace(/\s*,\s*/g, ' ').replace(/\s+([;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
}
/** Para ordenar: solo las palabras, sin signos */
const soloPalabras = (s) => normalizar(s).replace(/[.,;:!?¿¡"()]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Corrige una respuesta. Devuelve {ok, casi, correcta}: casi = solo fallan los acentos o las mayúsculas
 * (se cuenta como fallo, pero el mensaje lo dice: en francés el acento cambia la palabra).
 */
function corregir(ej, respuesta) {
  const buenas = ej.respuestas || [];
  const f = ej.tipo === 'ordenar' ? soloPalabras : normalizar;
  const r = f(respuesta);
  if (!r) return { ok: false, casi: false, correcta: buenas[0] };
  if (buenas.some((b) => f(b) === r)) return { ok: true, casi: false, correcta: buenas[0] };
  // hueco con contracción: «'s lived» también vale escrito con la palabra anterior delante o sin el apóstrofo inicial
  if (ej.tipo === 'hueco' && buenas.some((b) => /^'/.test(b) && f(b.slice(1)) === r.replace(/^\S*'/, ''))) return { ok: true, casi: false, correcta: buenas[0] };
  const casi = buenas.some((b) => sinAcentos(f(b)) === sinAcentos(r));
  return { ok: false, casi, correcta: buenas[0] };
}

// ------------------------------------------------------------------ Repaso (ts-fsrs, por ficha completa)
let F = null;
const motor = () => {
  if (!F) { const m = require('./lib/ts-fsrs.cjs'); F = { m, f: m.fsrs(m.generatorParameters({ enable_short_term: false })) }; }
  return F;
};
/** Nota de la sesión (0–1) → valoración de ts-fsrs */
const valoracion = (nota) => (nota >= 0.9 ? 4 : nota >= 0.7 ? 3 : nota >= 0.5 ? 2 : 1);
/** Nuevo estado de repaso de una ficha tras una sesión con esa nota */
function repasar(tarjeta, nota, ahora = new Date()) {
  const { m, f } = motor();
  const c = tarjeta ? { ...tarjeta, due: new Date(tarjeta.due), last_review: tarjeta.last_review ? new Date(tarjeta.last_review) : undefined } : m.createEmptyCard(ahora);
  const r = f.next(c, ahora, valoracion(nota)).card;
  return { ...r, due: r.due.toISOString(), last_review: r.last_review ? new Date(r.last_review).toISOString() : null };
}

// ------------------------------------------------------------------ Estado de cada materia
/**
 * Estado de una materia a partir de su registro {intentos, aciertos, sesiones, ultima, tarjeta, notas[]}:
 * nueva · aprendiendo (nota media < 0,8 o pocas sesiones) · dominada · repasar (dominada o aprendiendo con repaso vencido)
 */
function estadoMateria(r, ahora = new Date()) {
  if (!r || !r.sesiones) return 'nueva';
  const notas = (r.notas || []).slice(-3);
  const media = notas.reduce((a, b) => a + b, 0) / (notas.length || 1);
  if (r.tarjeta && new Date(r.tarjeta.due) <= ahora) return 'repasar';
  return media >= 0.8 && r.sesiones >= 2 ? 'dominada' : 'aprendiendo';
}

// ------------------------------------------------------------------ Elección de ejercicios
/** Baraja con semilla (para que una sesión sea reproducible si hace falta) */
function barajar(arr, semilla = Date.now()) {
  let s = (semilla ^ 0x9e3779b9) >>> 0;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/**
 * Ejercicios de una sesión sobre una ficha: primero los que el usuario falló (cuaderno de errores), luego los no vistos y, por último,
 * los vistos hace más tiempo. Mezcla tipos.
 */
// Orden de preferencia de los tipos de ejercicio según el nivel del usuario frente al de la ficha:
// ficha por debajo de su nivel → primero los de producción (escribir la frase); ficha por encima → primero los de reconocimiento.
const TIPOS_PRODUCCION = ['transformar', 'corregir', 'ordenar', 'hueco', 'eleccion'];
const TIPOS_RECONOCIMIENTO = ['eleccion', 'hueco', 'ordenar', 'corregir', 'transformar'];
function elegirEjercicios(ficha, registro, n = 10, semilla, ajuste = 0) {
  const vistos = (registro && registro.ejercicios) || {};   // id → {ultima, fallos}
  let todos = barajar(ficha.ejercicios || [], semilla);
  if (ajuste) {
    const orden = ajuste > 0 ? TIPOS_PRODUCCION : TIPOS_RECONOCIMIENTO;
    const rango = (e) => { const r = orden.indexOf(e.tipo); return r < 0 ? 2 : r; };
    todos = todos.map((e, i) => ({ e, i })).sort((a, b) => rango(a.e) - rango(b.e) || a.i - b.i).map((x) => x.e);
  }
  const fallados = todos.filter((e) => vistos[e.id] && vistos[e.id].fallos > 0 && !vistos[e.id].corregido);
  const nuevos = todos.filter((e) => !vistos[e.id]);
  const resto = todos.filter((e) => vistos[e.id] && !fallados.includes(e)).sort((a, b) => (vistos[a.id].ultima || '').localeCompare(vistos[b.id].ultima || ''));
  const elegidos = [...fallados.slice(0, Math.ceil(n / 3)), ...nuevos, ...resto, ...fallados.slice(Math.ceil(n / 3))].slice(0, n);
  return barajar(elegidos, (semilla || 1) + 7);
}

// ------------------------------------------------------------------ Nivel estimado
/**
 * Nivel estimado por bloque (gramática, léxico) con las notas de las materias trabajadas: el nivel más alto en el que la nota media
 * es ≥ 0,75 con al menos 3 materias, siempre que los niveles inferiores trabajados no estén por debajo de 0,6.
 * Devuelve {nivel, confianza, huecos: [ids de niveles inferiores flojos]} o null si aún no hay datos suficientes.
 */
function estimarNivel(materias, registros, bloque) {
  const porNivel = {};
  for (const m of materias) {
    if (m.bloque !== bloque) continue;
    const r = registros[m.id];
    if (!r || !r.notas || !r.notas.length) continue;
    const media = r.notas.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, r.notas.length);
    (porNivel[m.nivel] = porNivel[m.nivel] || []).push({ id: m.id, media });
  }
  let nivel = null, base = true;
  for (const n of NIVELES) {
    const xs = porNivel[n]; if (!xs) continue;
    const media = xs.reduce((a, b) => a + b.media, 0) / xs.length;
    if (xs.length >= 3 && media >= 0.75 && base) nivel = n;
    if (media < 0.6) base = false;
  }
  const huecos = NIVELES.slice(0, nivel ? nivelNum(nivel) : 0).flatMap((n) => (porNivel[n] || []).filter((x) => x.media < 0.6).map((x) => x.id));
  const n = Object.values(porNivel).reduce((a, b) => a + b.length, 0);
  return n < 3 ? null : { nivel, materias: n, huecos };
}

// ------------------------------------------------------------------ Recomendación («siguiente» y «al azar»)
/**
 * Materias recomendadas de un bloque: repasos vencidos; materias flojas; nuevas del nivel actual y del inmediatamente inferior
 * (para no dejar huecos); por último, del nivel siguiente. Solo las que tienen ficha.
 */
function recomendar(materias, registros, { bloque, nivel, conFicha, ahora = new Date(), semilla }) {
  const nv = nivelNum(nivel || 'B1');
  const cand = materias.filter((m) => (!bloque || m.bloque === bloque) && conFicha.has(m.id) && m.fase <= 1);
  const puntos = (m) => {
    const r = registros[m.id], e = estadoMateria(r, ahora), d = nivelNum(m.nivel) - nv;
    if (e === 'repasar') return 100;
    if (e === 'aprendiendo') return 80;
    if (e === 'nueva') return d === 0 ? 70 : d === -1 ? 60 : d < -1 ? 50 - Math.abs(d) : d === 1 ? 40 : 10;
    return 0;   // dominada y sin repaso pendiente
  };
  return barajar(cand, semilla).map((m) => ({ m, p: puntos(m) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p).map((x) => x.m);
}

// ------------------------------------------------------------------ Compromisos
/**
 * Reglas libres: {lengua: 'fr'|'en'|'cualquiera', cada: 'dia'|'semana'|'semanas', n (para «semanas»), dias: [1..7] (lunes=1; vacío = cualquiera),
 * minutos (null = sin duración), desde: 'YYYY-MM-DD'}. Devuelve, para cada regla, el periodo actual, lo hecho y si toca hoy.
 */
function compromisos(reglas, sesiones, hoy = new Date()) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lunes = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const diaSemana = ((hoy.getDay() + 6) % 7) + 1;
  return (reglas || []).map((r) => {
    let ini, fin;
    if (r.cada === 'dia') { ini = iso(hoy); fin = ini; }
    else {
      const sem = r.cada === 'semanas' ? Math.max(1, r.n || 2) : 1;
      const l0 = lunes(new Date(r.desde || iso(hoy))), l = lunes(hoy);
      const k = Math.floor(Math.round((l - l0) / 864e5) / 7 / sem);
      const a = new Date(l0); a.setDate(a.getDate() + k * sem * 7);
      const b = new Date(a); b.setDate(b.getDate() + sem * 7 - 1);
      ini = iso(a); fin = iso(b);
    }
    const hechas = sesiones.filter((s) => s.fecha.slice(0, 10) >= ini && s.fecha.slice(0, 10) <= fin && (r.lengua === 'cualquiera' || s.lengua === r.lengua));
    const minutos = Math.round(hechas.reduce((a, s) => a + (s.minutos || 0), 0));
    const cumplido = r.minutos ? minutos >= r.minutos : hechas.length > 0;
    const tocaHoy = !cumplido && (!(r.dias && r.dias.length) || r.dias.includes(diaSemana));
    return { regla: r, desde: ini, hasta: fin, minutos, sesiones: hechas.length, cumplido, tocaHoy };
  });
}

/** Texto legible de una regla en la lengua del panel (es | en | fr): «Francés · cada 2 semanas (martes) · 60 min» */
function textoRegla(r, lang = 'es') {
  const { tr } = require('./media/i18n-idiomas.js');
  const t = (s, args) => tr(typeof lang === 'string' ? lang : 'es', s, args);
  const nombres = typeof lang === 'object' && lang ? lang : { fr: t('Francés'), en: t('Inglés'), cualquiera: t('Cualquier idioma') };   // compatibilidad: textoRegla(r, nombres)
  const D = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map((d) => t(d));
  const cada = r.cada === 'dia' ? t('cada día') : r.cada === 'semana' ? t('cada semana') : t('cada {0} semanas', [Math.max(1, r.n || 2)]);
  const dias = r.dias && r.dias.length ? ` (${r.dias.map((d) => D[d - 1]).join(', ')})` : '';
  return `${nombres[r.lengua] || r.lengua} · ${cada}${dias} · ${r.minutos ? `${r.minutos} min` : t('sin duración fija')}`;
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'usuario';

/**
 * Explicación concreta de la respuesta del usuario: la de su opción (ejercicios de elección) o la del error previsto que coincida.
 * Devuelve el texto o null.
 */
function explicarRespuesta(ej, respuesta) {
  if (!String(respuesta || '').trim()) return null;
  const f = ej.tipo === 'ordenar' ? soloPalabras : normalizar;
  const r = f(respuesta);
  for (const [op, t] of Object.entries(ej.por_opcion || {})) if (f(op) === r) return t;
  for (const ep of ej.errores_previstos || []) if (f(ep.respuesta) === r) return ep.explicacion;
  return null;
}

// ------------------------------------------------------------------ Conjugación francesa (entrenador de verbos; datos de Verbiste en idiomas/fr/verbos.json)
const TIEMPOS_FR = [
  ['pres', 'Indicatif', 'Présent'], ['imp', 'Indicatif', 'Imparfait'], ['ps', 'Indicatif', 'Passé simple'], ['fut', 'Indicatif', 'Futur simple'],
  ['pc', 'Indicatif', 'Passé composé'], ['pqp', 'Indicatif', 'Plus-que-parfait'], ['pant', 'Indicatif', 'Passé antérieur'], ['fant', 'Indicatif', 'Futur antérieur'], ['fproche', 'Indicatif', 'Futur proche'],
  ['subj', 'Subjonctif', 'Présent'], ['subjimp', 'Subjonctif', 'Imparfait'], ['subjpasse', 'Subjonctif', 'Passé'], ['subjpqp', 'Subjonctif', 'Plus-que-parfait'],
  ['cond', 'Conditionnel', 'Présent'], ['condpasse', 'Conditionnel', 'Passé'],
  ['impe', 'Impératif', 'Présent'], ['impepasse', 'Impératif', 'Passé'],
];
const AUX_DE = { pc: 'pres', pqp: 'imp', pant: 'ps', fant: 'fut', subjpasse: 'subj', subjpqp: 'subjimp', condpasse: 'cond', impepasse: 'impe' };
const CON_ETRE = new Set('aller arriver venir devenir revenir parvenir intervenir survenir advenir provenir redevenir partir repartir rester tomber retomber naître renaître mourir décéder'.split(' '));
const DOBLE_AUX = new Set('descendre redescendre monter remonter sortir ressortir passer repasser rentrer retourner entrer apparaître demeurer ressusciter'.split(' '));
const PRONOMBRES = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];

/** Formas simples de un verbo en un tiempo (clave de verbos.json): lista por persona de [formas aceptadas] o null si no existe */
function formasSimples(datos, verbo, clave) {
  const v = datos.porVerbo.get(verbo); if (!v) return null;
  const [inf, raiz, tpl] = v; const p = datos.plantillas[tpl]; if (!p || !p[clave]) return null;
  return p[clave].map((t) => {
    if (t == null) return null;
    const f = [raiz + t];
    if (tpl === 'pa:yer' && /^i/.test(t)) f.push(`${raiz}y${t.slice(1)}`);                       // je paie / je paye
    if (tpl === 'réf:érer' && (clave === 'fut' || clave === 'cond')) f.push(`${raiz}è${t.slice(1)}`);  // préférerai / préfèrerai (1990)
    return f;
  });
}
/** Conjugación de un verbo en un tiempo del entrenador: [{persona, pronombre, respuestas: [..]}] (3 personas en imperativo) */
function conjugar(datos, verbo, tiempo) {
  const v = datos.porVerbo.get(verbo); if (!v) return null;
  const imper = tiempo === 'impe' || tiempo === 'impepasse';
  const personas = imper ? [1, 3, 4] : [0, 1, 2, 3, 4, 5];
  const pp = formasSimples(datos, verbo, 'pp');
  const ppDe = (i) => (pp && pp[i] ? pp[i][0] : null);
  let filas;
  if (AUX_DE[tiempo] || tiempo === 'fproche') {
    filas = personas.map((per, k) => {
      if (tiempo === 'fproche') { const a = formasSimples(datos, 'aller', 'pres'); return [`${a[per][0]} ${verbo}`]; }
      const auxT = AUX_DE[tiempo];
      const idx = imper ? k : per;
      const conAvoir = () => { const a = formasSimples(datos, 'avoir', auxT); return a && a[idx] && ppDe(0) ? [`${a[idx][0]} ${ppDe(0)}`] : []; };
      const conEtre = () => {
        const a = formasSimples(datos, 'être', auxT); if (!a || !a[idx] || !ppDe(0)) return [];
        // concordancia con el sujeto: je/tu masc. o fem.; nous/vous plural (vous también singular de cortesía); il masc. sing.; ils masc. pl.
        const pl = per >= 3;
        const g = per === 2 ? [ppDe(0)] : per === 5 ? [ppDe(1) || ppDe(0)] : pl ? [ppDe(1), ppDe(3)] : [ppDe(0), ppDe(2)];
        if (per === 4) g.push(ppDe(0), ppDe(2));
        return [...new Set(g.filter(Boolean))].map((x) => `${a[idx][0]} ${x}`);
      };
      const r = CON_ETRE.has(verbo) ? conEtre() : DOBLE_AUX.has(verbo) ? [...conEtre(), ...conAvoir()] : conAvoir();
      return r.length ? r : null;
    });
  } else {
    const fs = formasSimples(datos, verbo, tiempo); if (!fs) return null;
    filas = imper ? fs.slice(0, 3) : fs;
  }
  return personas.map((per, k) => {
    const resp = filas[k]; if (!resp) return null;
    return { persona: per, pronombre: pronombre(datos, verbo, tiempo, per, resp[0]), respuestas: resp };
  }).filter(Boolean);
}
/** Pronombre que se muestra: elisión (j', qu'il) ante vocal o h muda; «que» en subjuntivo; entre paréntesis en imperativo */
function pronombre(datos, verbo, tiempo, per, forma) {
  if (tiempo === 'impe' || tiempo === 'impepasse') return `(${PRONOMBRES[per]})`;
  const v = datos.porVerbo.get(verbo);
  const vocal = /^[aeiouyàâäéèêëîïôöùûüœ]/i.test(forma) || (/^h/i.test(forma) && !(v && v[5]));   // v[5]: h aspirada (je hais)
  const subj = tiempo.startsWith('subj');
  if (per === 0) return `${subj ? 'que ' : ''}${vocal ? "j'" : 'je'}`;
  if (subj) return `${per === 2 || per === 5 ? (`qu'${PRONOMBRES[per]}`) : `que ${PRONOMBRES[per]}`}`;
  return PRONOMBRES[per];
}
/** Corrige una forma: exacta (sin distinguir mayúsculas ni espacios de más) o «casi» si solo fallan acentos */
function corregirForma(respuestas, escrito) {
  const n = (x) => String(x || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();
  const r = n(escrito);
  if (!r) return { ok: false, casi: false };
  if (respuestas.some((x) => n(x) === r)) return { ok: true, casi: false };
  return { ok: false, casi: respuestas.some((x) => sinAcentos(n(x)) === sinAcentos(r)) };
}
/** Paradigma completo de un verbo para las fichas de consulta: todos los tiempos, raíz y participios */
function paradigma(datos, verbo) {
  const v = datos.porVerbo.get(verbo); if (!v) return null;
  const tiempos = {};
  for (const [k] of TIEMPOS_FR) tiempos[k] = (conjugar(datos, verbo, k) || []).map((x) => ({ pronombre: x.pronombre, formas: x.respuestas }));
  const pp = formasSimples(datos, verbo, 'pp') || [], ppres = formasSimples(datos, verbo, 'ppres') || [];
  return { verbo, raiz: v[1], grupo: v[3], hAspirada: !!v[5], tiempos, participios: { presente: (ppres[0] || [])[0] || '', pasado: pp.map((x) => (x ? x[0] : null)).filter(Boolean) },
    auxiliar: CON_ETRE.has(verbo) ? 'être' : DOBLE_AUX.has(verbo) ? 'être / avoir' : 'avoir' };
}
/** Prepara los datos de verbos.json para conjugar */
function prepararVerbos(d) { return { ...d, porVerbo: new Map(d.verbos.map((v) => [v[0], v])) }; }

module.exports = { TIEMPOS_FR, conjugar, paradigma, corregirForma, prepararVerbos, NIVELES, nivelNum, normalizar, corregir, explicarRespuesta, repasar, valoracion, estadoMateria, elegirEjercicios, estimarNivel, recomendar, compromisos, textoRegla, barajar, slug };
