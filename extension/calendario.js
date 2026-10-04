// Calendario de vueltas: generación de semanas, reparto diario y ajustes (sin dependencias de VS Code, para poder probarlo aparte).
// Reglas completas: main/CALENDARIO.md
'use strict';

// ------------------------------------------------------------------ utilidades
function azar(semilla) { let s = (semilla >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const num = (c) => Number(c.split('.')[2]);
const parte = (c) => c.split('.')[1];
const porPrograma = (a, b) => parte(a).localeCompare(parte(b)) || num(a) - num(b);
function barajar(lista, r) { const l = [...lista]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; }

// fechas locales 'YYYY-MM-DD'
const fecha = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const masDias = (s, n) => { const d = fecha(s); d.setDate(d.getDate() + n); return iso(d); };
const diaSemana = (s) => (fecha(s).getDay() + 6) % 7; // 0 = lunes … 6 = domingo

// ------------------------------------------------------------------ 1. Semanas: qué temas van juntos
/**
 * Tamaños de semana y cuántos temas de la Parte A lleva cada una cuando se intercala:
 * la proporción A/B global se reparte de forma acumulada (con 45 A y 45 B y 5 por semana sale 3, 2, 3, 2…).
 */
function cuotas(nA, nB, k) {
  const n = nA + nB, W = Math.ceil(n / k), tam = [], a = [];
  let acumA = 0;
  for (let w = 0; w < W; w++) {
    const t = Math.min(k, n - w * k); tam.push(t);
    const objetivo = Math.round(((w * k + t) * nA) / n);
    const x = Math.max(0, Math.min(t, objetivo - acumA));
    a.push(x); acumA += x;
  }
  return { tam, a };
}

/** Modo correlativo: toda la Parte A por orden y después toda la Parte B, en bloques de k */
function correlativo(codigos, k) {
  const l = [...codigos].sort(porPrograma), s = [];
  for (let i = 0; i < l.length; i += k) s.push(l.slice(i, i + k));
  return s;
}

/** Modo aleatorio: orden al azar (reproducible con la semilla); si se intercala, respeta las cuotas A/B de cada semana */
function aleatorio(codigos, k, intercalar, semilla) {
  const r = azar(semilla);
  if (!intercalar) { const l = barajar(codigos, r), s = []; for (let i = 0; i < l.length; i += k) s.push(l.slice(i, i + k)); return s; }
  const A = barajar(codigos.filter((c) => parte(c) === 'A'), r), B = barajar(codigos.filter((c) => parte(c) === 'B'), r);
  const { tam, a } = cuotas(A.length, B.length, k);
  return tam.map((t, w) => barajar([...A.splice(0, a[w]), ...B.splice(0, t - a[w])], r));
}

/**
 * Modo temático: agrupa por afinidad (búsqueda local con recocido simulado, reproducible con la semilla).
 * Objetivo: maximizar la suma de afinidades entre los temas de cada semana.
 * Restricciones: tamaño de semana k; si se intercala, cuotas A/B por semana; si no, primero semanas solo A y luego solo B.
 */
function tematico(codigos, k, intercalar, semilla, af, titulos = {}, iteraciones = 150000) {
  const r = azar(semilla);
  const M = af.m, I = af.idx;
  const A = codigos.filter((c) => parte(c) === 'A').sort(porPrograma), B = codigos.filter((c) => parte(c) === 'B').sort(porPrograma);
  // punto de partida: orden del programa (como hace una preparadora), que la búsqueda luego reordena con libertad
  let semanas;
  if (intercalar) {
    const { tam, a } = cuotas(A.length, B.length, k); const a2 = [...A], b2 = [...B];
    semanas = tam.map((t, w) => [...a2.splice(0, a[w]), ...b2.splice(0, t - a[w])]);
  } else semanas = [...correlativo(A, k), ...correlativo(B, k)];
  // valor de una semana: suma de log(0,05 + encaje de cada tema), donde encaje = afinidad media con sus compañeros de semana.
  // El logaritmo castiga dejar un tema «huérfano» en una semana que no le corresponde (mejor que sumar afinidades sin más).
  const val = (s) => {
    let v = 0;
    for (const x of s) { let f = 0; for (const y of s) if (y !== x) f += M[I[x]][I[y]]; v += Math.log(0.05 + f / Math.max(1, s.length - 1)); }
    return v;
  };
  let T = 1;
  const enfriar = Math.pow(0.001 / T, 1 / iteraciones);
  for (let it = 0; it < iteraciones; it++, T *= enfriar) {
    const w1 = Math.floor(r() * semanas.length), w2 = Math.floor(r() * semanas.length);
    if (w1 === w2) continue;
    const s1 = semanas[w1], s2 = semanas[w2];
    const i1 = Math.floor(r() * s1.length), x = s1[i1];
    const cand = s2.map((y, j) => j).filter((j) => parte(s2[j]) === parte(x)); // intercambio dentro de la misma parte: conserva las cuotas
    if (!cand.length) continue;
    const i2 = cand[Math.floor(r() * cand.length)], y = s2[i2];
    const antes = val(s1) + val(s2);
    s1[i1] = y; s2[i2] = x;
    const delta = val(s1) + val(s2) - antes;
    if (!(delta >= 0 || r() < Math.exp(delta / T))) { s1[i1] = x; s2[i2] = y; }
  }
  // orden de las semanas: de lo más básico a lo más avanzado (posición media en el programa)
  // con intercalado, manda la Parte A (la teoría de base, como en el calendario de la preparadora); sin intercalar, la parte de la semana
  const pos = (s) => { const base = intercalar && s.some((c) => parte(c) === 'A') ? s.filter((c) => parte(c) === 'A') : s;
    return base.reduce((t, c) => t + num(c) / (parte(c) === 'A' ? A.length : B.length), 0) / base.length; };
  if (intercalar) semanas.sort((a, b) => (a.length < k) - (b.length < k) || pos(a) - pos(b)); // la semana incompleta, al final
  else {
    // sin intercalar: primero las semanas de la A y luego las de la B; la semana incompleta de cada parte, al final de esa parte
    const ord = (a, b) => (a.length < k) - (b.length < k) || pos(a) - pos(b);
    semanas = [...semanas.filter((s) => parte(s[0]) === 'A').sort(ord), ...semanas.filter((s) => parte(s[0]) === 'B').sort(ord)];
  }
  ordenarSeries(semanas, titulos);
  // dentro de la semana: A antes que B y por número, como en el programa
  semanas.forEach((s) => s.sort(porPrograma));
  return { semanas, valor: semanas.reduce((t, s) => t + val(s), 0) };
}

/**
 * Orden pedagógico de las series: en temas con el mismo título y numeración (I), (II)… («Análisis de mercados (I)…(IV)»),
 * el (I) nunca va en una semana posterior al (II). Si pasa, se intercambian sus puestos (misma parte: las cuotas no cambian).
 * Las series largas (más de 4 temas, como «Unión Europea (I)…(VII)») no se ordenan: cada tema es un ámbito distinto.
 */
function ordenarSeries(semanas, titulos) {
  const serie = (c) => {
    const t = (titulos[c] || '').split(':')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!/\((i|ii|iii|iv|v|vi|vii|viii)\)/.test(t)) return null;
    return `${parte(c)}|${t.replace(/\((i|ii|iii|iv|v|vi|vii|viii)\)/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  };
  const tam = {};
  semanas.flat().forEach((c) => { const k = serie(c); if (k) tam[k] = (tam[k] || 0) + 1; });
  const serieCorta = (c) => { const k = serie(c); return k && tam[k] <= 4 ? k : null; };
  const donde = () => { const r = {}; semanas.forEach((s, w) => s.forEach((c, i) => { r[c] = [w, i]; })); return r; };
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const pos = donde(); let cambio = false;
    const cods = Object.keys(pos).sort(porPrograma);
    buscar: for (const x of cods) for (const y of cods) {
      if (num(x) >= num(y) || parte(x) !== parte(y)) continue;
      const sx = serieCorta(x); if (!sx || sx !== serieCorta(y)) continue;
      if (pos[x][0] > pos[y][0]) {
        const [wx, ix] = pos[x], [wy, iy] = pos[y];
        semanas[wx][ix] = y; semanas[wy][iy] = x; cambio = true; break buscar; // posiciones cambiadas: se vuelve a empezar
      }
    }
    if (!cambio) break;
  }
  return semanas;
}

/** Nombre del bloque temático: los títulos de los temas más «centrales» de la semana (el de A y el de B) */
function bloque(semana, af, titulos) {
  const M = af.m, I = af.idx;
  const central = (cs) => cs.map((c) => [c, cs.reduce((t, d) => t + (d === c ? 0 : M[I[c]][I[d]]), 0) + semana.reduce((t, d) => t + (d === c ? 0 : M[I[c]][I[d]]), 0)])
    .sort((a, b) => b[1] - a[1])[0];
  const limpio = (c) => (titulos[c] || c).replace(/\s*\((I|II|III|IV|V|VI|VII|VIII)\)\s*/g, ' ').replace(/[.:].*$/, '').trim();
  const a = semana.filter((c) => parte(c) === 'A'), b = semana.filter((c) => parte(c) === 'B');
  const nombres = [a.length ? limpio(central(a)[0]) : null, b.length ? limpio(central(b)[0]) : null].filter(Boolean);
  return [...new Set(nombres)].join(' · ');
}

/** Suma de afinidades dentro de las semanas (para comparar calendarios) */
function valorar(semanas, af) {
  let v = 0;
  for (const s of semanas) for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = af.idx[s[i]], b = af.idx[s[j]]; if (a != null && b != null) v += af.m[a][b];
  }
  return v;
}

// ------------------------------------------------------------------ 2. Fechas y reparto diario
/**
 * Crea el calendario completo.
 * opciones: {nombre, ejercicio, temasSemana, modo: 'tematico'|'correlativo'|'aleatorio', intercalar, semilla,
 *            primerCante: 'YYYY-MM-DD', diaLibre: 0..6 (0 = lunes)}
 */
function crear(codigos, opciones, af, titulos) {
  const k = opciones.temasSemana;
  let semanas;
  if (opciones.modo === 'correlativo') semanas = correlativo(codigos, k);
  else if (opciones.modo === 'aleatorio') semanas = aleatorio(codigos, k, opciones.intercalar, opciones.semilla);
  else semanas = tematico(codigos, k, opciones.intercalar, opciones.semilla, af, titulos).semanas;
  return {
    version: 1,
    nombre: opciones.nombre,
    ejercicio: opciones.ejercicio,
    creado: new Date().toISOString(),
    opciones,
    semanas: semanas.map((temas, w) => ({
      cante: masDias(opciones.primerCante, 7 * w),
      temas,
      bloque: opciones.modo === 'tematico' && af ? bloque(temas, af, titulos) : '',
      orden: null,           // orden manual de estudio dentro de la semana (null = el de la lista)
    })),
    inicio: masDias(opciones.primerCante, -6),
    id: `${(opciones.nombre || 'calendario').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`,
    diaLibre: opciones.diaLibre,
    librados: {},            // 'YYYY-MM-DD': true  → días que has librado de forma excepcional
    estudio: {},             // 'YYYY-MM-DD': true  → días libres habituales en los que sí estudias
    cantados: {},            // código: 'YYYY-MM-DD'
  };
}

/** Días de estudio de la semana w: del día siguiente al cante anterior hasta el día antes del cante, sin días libres */
/** Primer día de estudio de la semana w (la primera empieza 6 días antes del primer cante previsto, aunque luego se mueva) */
function inicioSemana(cal, w) {
  if (w > 0) return masDias(cal.semanas[w - 1].cante, 1);
  return cal.inicio || masDias((cal.opciones && cal.opciones.primerCante) || cal.semanas[0].cante, -6);
}

function diasEstudio(cal, w) {
  const s = cal.semanas[w];
  const inicio = inicioSemana(cal, w);
  const dias = [];
  for (let d = inicio; d < s.cante; d = masDias(d, 1)) {
    const libreHabitual = cal.diaLibre === diaSemana(d) && !(cal.estudio || {})[d];
    if (!libreHabitual && !(cal.librados || {})[d]) dias.push(d);
  }
  return dias;
}

/**
 * Reparto de los temas de la semana entre sus días de estudio.
 * Peso de cada tema = 1 (estudio) + 1 por cada 5 h de tiempo restante (tope +2); sin dato (tema sin carpeta) = 3.
 * pesos: {código: minutos restantes}. Un tema por redactar puede ocupar más de un día.
 * Los temas se colocan en orden, llenando cada día hasta su parte proporcional del peso total; un tema puede partirse entre días.
 * Devuelve {dia: [{codigo, parte: 'entero'|'empieza'|'sigue'|'termina', fraccion}]}
 */
function repartir(cal, w, pesos = {}) {
  const s = cal.semanas[w];
  const dias = diasEstudio(cal, w);
  const orden = s.orden && s.orden.length === s.temas.length ? s.orden : s.temas;
  const peso = (c) => (pesos[c] == null ? 3 : 1 + Math.min(2, pesos[c] / 300));
  const total = orden.reduce((t, c) => t + peso(c), 0);
  const r = Object.fromEntries(dias.map((d) => [d, []]));
  if (!dias.length) return { dias: r, sinDias: orden };
  const porDia = total / dias.length;
  let di = 0, libre = porDia;
  for (const c of orden) {
    let resto = peso(c), primera = true;
    while (resto > 1e-6) {
      // no se dejan trocitos de menos del 10 % de un tema: o pasa entero al día siguiente o se termina hoy
      if (di < dias.length - 1 && (libre < 1e-6 || (libre < resto && libre / peso(c) < 0.1))) { di++; libre = porDia; }
      let pone = di === dias.length - 1 ? resto : Math.min(resto, libre);
      if ((resto - pone) / peso(c) < 0.1) pone = resto;
      resto -= pone; libre -= pone;
      const p = primera ? (resto > 1e-6 ? 'empieza' : 'entero') : (resto > 1e-6 ? 'sigue' : 'termina');
      r[dias[di]].push({ codigo: c, parte: p, fraccion: pone / peso(c) });
      primera = false;
    }
  }
  return { dias: r, sinDias: [] };
}

// ------------------------------------------------------------------ 3. Ajustes sobre la marcha
/** Mueve un tema de la semana w a la siguiente. modo: 'absorber' (la siguiente tiene uno más) | 'desplazar' (todo el calendario corre un puesto) */
function pasarSiguiente(cal, w, codigo, modo) {
  const s = cal.semanas[w];
  if (!s || !s.temas.includes(codigo)) return cal; // ya no está en esa semana (p. ej. doble clic): no se duplica
  s.temas = s.temas.filter((c) => c !== codigo); if (s.orden) s.orden = s.orden.filter((c) => c !== codigo);
  if (w + 1 >= cal.semanas.length) cal.semanas.push({ cante: masDias(s.cante, 7), temas: [], bloque: '', orden: null });
  const sig = cal.semanas[w + 1];
  sig.temas.unshift(codigo); if (sig.orden) sig.orden.unshift(codigo);
  if (modo === 'desplazar') {
    const k = cal.opciones.temasSemana;
    for (let v = w + 1; v < cal.semanas.length; v++) {
      const sv = cal.semanas[v];
      while (sv.temas.length > k) {
        const ult = sv.temas.pop(); if (sv.orden) sv.orden = sv.orden.filter((c) => c !== ult);
        if (v + 1 >= cal.semanas.length) cal.semanas.push({ cante: masDias(sv.cante, 7), temas: [], bloque: '', orden: null });
        const sn = cal.semanas[v + 1]; sn.temas.unshift(ult); if (sn.orden) sn.orden.unshift(ult);
      }
    }
  }
  return cal;
}

/** Cambia el día de cante de la semana w (debe quedar después del cante anterior y antes del siguiente) */
function moverCante(cal, w, nuevo) {
  const ant = w > 0 ? cal.semanas[w - 1].cante : null, sig = w + 1 < cal.semanas.length ? cal.semanas[w + 1].cante : null;
  if ((ant && nuevo <= ant) || (sig && nuevo >= sig)) return { ok: false, motivo: 'El cante debe quedar entre el de la semana anterior y el de la siguiente.' };
  cal.semanas[w].cante = nuevo;
  return { ok: true };
}

/**
 * Librar un día de estudio. accion:
 *  'repartir'  → sus temas se reparten entre los demás días de la misma semana (el reparto se recalcula solo);
 *  'absorber' / 'desplazar' → los temas que se estudiaban sobre todo ese día pasan a la semana siguiente (ver pasarSiguiente).
 */
function librar(cal, dia, accion, pesos = {}) {
  const w = semanaDe(cal, dia);
  if (w < 0) return { ok: false, motivo: 'Ese día está fuera del calendario.' };
  let mover = [];
  if (accion !== 'repartir') {
    const rep = repartir(cal, w, pesos).dias[dia] || [];
    mover = rep.filter((x) => x.fraccion >= 0.5).map((x) => x.codigo);
  }
  cal.librados = cal.librados || {}; cal.librados[dia] = true; // «librado» manda sobre «estudio»: al deshacerlo se recupera lo anterior
  for (const c of mover.reverse()) pasarSiguiente(cal, w, c, accion);
  return { ok: true, movidos: mover.reverse() };
}

/** Deshace un día librado, o hace que un día libre habitual sea de estudio */
function estudiar(cal, dia) {
  cal.librados = cal.librados || {}; cal.estudio = cal.estudio || {};
  if (cal.librados[dia]) delete cal.librados[dia];
  else cal.estudio[dia] = true;
}

/** Cambia el orden de estudio de un tema dentro de su semana (dir = -1 antes, +1 después) */
function reordenar(cal, w, codigo, dir) {
  const s = cal.semanas[w];
  const o = s.orden && s.orden.length === s.temas.length ? [...s.orden] : [...s.temas];
  const i = o.indexOf(codigo), j = i + dir;
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]];
  s.orden = o;
}

/** Semana a la que pertenece un día (la del primer cante que cae ese día o después) */
function semanaDe(cal, dia) {
  if (dia < inicioSemana(cal, 0)) return -1;
  return cal.semanas.findIndex((s) => dia <= s.cante);
}

module.exports = { inicioSemana, ordenarSeries, cuotas, correlativo, aleatorio, tematico, bloque, valorar, crear, diasEstudio, repartir, pasarSiguiente, moverCante, semanaDe, librar, estudiar, reordenar, masDias, diaSemana };
