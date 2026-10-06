// Lógica de la pestaña Idiomas sin VS Code (para poder probarla aparte): corrección de ejercicios, elección de ejercicios,
// repaso de fichas (ts-fsrs), estimación del nivel, compromisos y recomendaciones. Reglas: main/IDIOMAS.md
'use strict';

const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const nivelNum = (n) => NIVELES.indexOf(n) + 1;

// ------------------------------------------------------------------ Corrección
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Forma comparable de una respuesta: minúsculas, apóstrofos y comillas unificados, espacios simples, sin comas ni puntuación final */
function normalizar(s) {
  return String(s || '').replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"').replace(/ /g, ' ')
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

/** Texto legible de una regla: «Francés · cada 2 semanas (martes) · 60 min» */
function textoRegla(r, nombres = { fr: 'Francés', en: 'Inglés', cualquiera: 'Cualquier idioma' }) {
  const D = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const cada = r.cada === 'dia' ? 'cada día' : r.cada === 'semana' ? 'cada semana' : `cada ${Math.max(1, r.n || 2)} semanas`;
  const dias = r.dias && r.dias.length ? ` (${r.dias.map((d) => D[d - 1]).join(', ')})` : '';
  return `${nombres[r.lengua] || r.lengua} · ${cada}${dias} · ${r.minutos ? `${r.minutos} min` : 'sin duración fija'}`;
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

module.exports = { NIVELES, nivelNum, normalizar, corregir, explicarRespuesta, repasar, valoracion, estadoMateria, elegirEjercicios, estimarNivel, recomendar, compromisos, textoRegla, barajar, slug };
