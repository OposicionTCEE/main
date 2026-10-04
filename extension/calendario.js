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
function tematico(codigos, k, intercalar, semilla, af, titulos = {}, inicio = null, iteraciones = 150000) {
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
  semanas = encadenar(semanas, k, intercalar, inicio, af, r, A.length, B.length);
  ordenarSeries(semanas, titulos, inicio && inicio.tema);
  // dentro de la semana: A antes que B y por número, como en el programa
  semanas.forEach((s) => s.sort(porPrograma));
  return { semanas, valor: semanas.reduce((t, s) => t + val(s), 0) };
}

/**
 * Orden de las semanas: cada semana va seguida de la que más relación guarda con ella (afinidad media entre sus temas),
 * empezando por la semana elegida:
 *   inicio.tipo 'basico' (por defecto) → la semana más básica (menor posición media en el programa; al intercalar cuenta la Parte A);
 *   'tema' → la semana que contiene inicio.tema;   'azar' → una semana al azar (reproducible con la semilla);
 *   'tras' → la más relacionada con inicio.previa (temas de la semana anterior; se usa al reorganizar).
 * Primero se encadena de forma voraz (siempre la más relacionada de las que quedan) y luego se mejora la cadena invirtiendo tramos (2-opt).
 * La semana incompleta va siempre al final. Sin intercalar, primero todas las semanas de una parte (la del tema de inicio) y luego las de la otra.
 */
function encadenar(semanas, k, intercalar, inicio, af, r, nA, nB) {
  const M = af.m, I = af.idx;
  const W = (a, b) => { let t = 0; for (const x of a) for (const y of b) t += M[I[x]][I[y]]; return t / (a.length * b.length); };
  const pos = (s) => { const base = intercalar && s.some((c) => parte(c) === 'A') ? s.filter((c) => parte(c) === 'A') : s;
    return base.reduce((t, c) => t + num(c) / (parte(c) === 'A' ? nA : nB), 0) / base.length; };
  const tipo = (inicio && inicio.tipo) || 'basico';
  const cadena = (lista, primera) => {
    if (lista.length <= 2) return primera ? [primera, ...lista.filter((x) => x !== primera)] : lista;
    const resto = lista.filter((x) => x !== primera), c = [primera];
    while (resto.length) { const u = c[c.length - 1]; let mj = 0; resto.forEach((x, j) => { if (W(u, x) > W(u, resto[mj])) mj = j; }); c.push(resto.splice(mj, 1)[0]); }
    // 2-opt sobre un camino abierto con la primera semana fija
    let mejora = true;
    while (mejora) {
      mejora = false;
      for (let i = 1; i < c.length - 1; i++) for (let j = i + 1; j < c.length; j++) {
        const antes = W(c[i - 1], c[i]) + (j + 1 < c.length ? W(c[j], c[j + 1]) : 0);
        const despues = W(c[i - 1], c[j]) + (j + 1 < c.length ? W(c[i], c[j + 1]) : 0);
        if (despues > antes + 1e-9) { c.splice(i, j - i + 1, ...c.slice(i, j + 1).reverse()); mejora = true; }
      }
    }
    return c;
  };
  const elegir = (lista) => {
    if (tipo === 'tema' && inicio.tema) { const w = lista.find((s) => s.includes(inicio.tema)); if (w) return w; }
    if (tipo === 'azar') return lista[Math.floor(r() * lista.length)];
    if (tipo === 'tras' && inicio.previa) return lista.reduce((a, b) => (W(inicio.previa, b) > W(inicio.previa, a) ? b : a)); // la más relacionada con la semana anterior
    return lista.reduce((a, b) => (pos(b) < pos(a) ? b : a));
  };
  const ordenar = (lista, previa) => {
    const llenas = lista.filter((s) => s.length === k), cortas = lista.filter((s) => s.length < k);
    if (!llenas.length) return cortas;
    let primera = elegir(llenas);
    if (previa && !(tipo === 'tema' && llenas.some((s) => s.includes(inicio.tema)))) primera = llenas.reduce((a, b) => (W(previa, b) > W(previa, a) ? b : a));
    return [...cadena(llenas, primera), ...cortas];
  };
  if (intercalar) {
    const c = ordenar(semanas.filter((s) => s.length === k));
    return [...c, ...semanas.filter((s) => s.length < k)];
  }
  const pA = semanas.filter((s) => parte(s[0]) === 'A'), pB = semanas.filter((s) => parte(s[0]) === 'B');
  const primeroB = tipo === 'tema' && inicio.tema && parte(inicio.tema) === 'B';
  const [p1, p2] = primeroB ? [pB, pA] : [pA, pB];
  const c1 = ordenar(p1);
  const c2 = ordenar(p2, c1[c1.length - 1]);
  return [...c1, ...c2];
}

/**
 * Orden pedagógico de las series: en temas con el mismo título y numeración (I), (II)… («Análisis de mercados (I)…(IV)»),
 * el (I) nunca va en una semana posterior al (II). Si pasa, se intercambian sus puestos (misma parte: las cuotas no cambian).
 * Las series largas (más de 4 temas, como «Unión Europea (I)…(VII)») no se ordenan: cada tema es un ámbito distinto.
 * El tema de inicio elegido por el usuario (fijo) no se mueve.
 */
function ordenarSeries(semanas, titulos, fijo = null) {
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
      if (num(x) >= num(y) || parte(x) !== parte(y) || x === fijo || y === fijo) continue; // el tema de inicio elegido no se mueve
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

/**
 * Nombre del bloque temático de una semana, a partir de los ámbitos de sus temas (config/programa_N.json):
 * cada tema suma 1 a su ámbito principal y 0,5 a los secundarios; se nombran los ámbitos con más peso
 * (el segundo si suma al menos 1 y el tercero si suma al menos 1,5), por ejemplo «Mercados y competencia, comercio internacional».
 */
function bloque(semana, tax) {
  if (!tax || !tax.ambitos) return '';
  const peso = {};
  semana.forEach((c) => (tax.ambitos[c] || []).forEach((a, i) => { peso[a] = (peso[a] || 0) + (i === 0 ? 1 : 0.5); }));
  const orden = Object.entries(peso).sort((a, b) => b[1] - a[1]);
  const elegidos = orden.filter(([, v], i) => i === 0 || (i === 1 && v >= 1) || (i === 2 && v >= 1.5)).map(([a]) => tax.nombres[a] || a);
  const propio = /^(Unión Europea|UE)\b/; // los nombres propios no pasan a minúscula
  return elegidos.map((n, i) => (i === 0 || propio.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1))).join(', ');
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
function crear(codigos, opciones, af, titulos, tax) {
  const k = opciones.temasSemana;
  // tema de inicio: 'basico' (lo de siempre), 'tema' (uno elegido) o 'azar' (uno cualquiera, reproducible con la semilla)
  const inicio = { tipo: 'basico', ...(opciones.inicio || {}) };
  if (inicio.tipo === 'tema' && !codigos.includes(inicio.tema)) inicio.tipo = 'basico';
  let semanas;
  if (opciones.modo === 'correlativo') {
    // correlativo desde un tema: esa parte empieza en él y da la vuelta (A.10 … A.45, A.1 … A.9) y después la otra parte
    let l = [...codigos].sort(porPrograma);
    if (inicio.tipo !== 'basico') {
      const t = inicio.tipo === 'tema' ? inicio.tema : l[Math.floor(azar(opciones.semilla)() * l.length)];
      const mia = l.filter((c) => parte(c) === parte(t)), otra = l.filter((c) => parte(c) !== parte(t));
      const i = mia.indexOf(t);
      l = [...mia.slice(i), ...mia.slice(0, i), ...otra];
    }
    semanas = []; for (let i = 0; i < l.length; i += k) semanas.push(l.slice(i, i + k));
  } else if (opciones.modo === 'aleatorio') {
    semanas = aleatorio(codigos, k, opciones.intercalar, opciones.semilla);
    if (inicio.tipo === 'tema') { // el tema elegido pasa a la primera semana (cambiándolo por uno de su misma parte)
      const w = semanas.findIndex((s) => s.includes(inicio.tema));
      if (w > 0) { const j = semanas[0].findIndex((c) => parte(c) === parte(inicio.tema)); const i = semanas[w].indexOf(inicio.tema);
        if (j >= 0) [semanas[0][j], semanas[w][i]] = [semanas[w][i], semanas[0][j]]; else { semanas[w].splice(i, 1); semanas[0].push(inicio.tema); } }
    }
  } else semanas = tematico(codigos, k, opciones.intercalar, opciones.semilla, af, titulos, inicio).semanas;
  // en la primera semana, el tema de inicio elegido se estudia el primero
  if (inicio.tipo === 'tema' && semanas[0].includes(inicio.tema)) semanas[0] = [inicio.tema, ...semanas[0].filter((c) => c !== inicio.tema)];
  return {
    version: 1,
    nombre: opciones.nombre,
    ejercicio: opciones.ejercicio,
    creado: new Date().toISOString(),
    opciones,
    semanas: semanas.map((temas, w) => ({
      cante: masDias(opciones.primerCante, 7 * w),
      temas,
      bloque: bloque(temas, tax),
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
/** Mueve un tema de la semana w a la siguiente, que lo absorbe (tendrá un tema más) */
function pasarSiguiente(cal, w, codigo) {
  const s = cal.semanas[w];
  if (!s || !s.temas.includes(codigo)) return cal; // ya no está en esa semana (p. ej. doble clic): no se duplica
  s.temas = s.temas.filter((c) => c !== codigo); if (s.orden) s.orden = s.orden.filter((c) => c !== codigo);
  if (w + 1 >= cal.semanas.length) cal.semanas.push({ cante: masDias(s.cante, 7), temas: [], bloque: '', orden: null });
  const sig = cal.semanas[w + 1];
  sig.temas.unshift(codigo); if (sig.orden) sig.orden.unshift(codigo);
  return cal;
}

// ------------------------------------------------------------------ Recolocar y ampliar (ver CALENDARIO.md, apartado 7)
/** Peso de trabajo de un tema: 1 (estudio) + 1 por cada 5 h de tiempo restante (tope +2); sin dato = 3 */
const pesoTema = (pesos, c) => (pesos[c] == null ? 3 : 1 + Math.min(2, pesos[c] / 300));
/** Semana en curso: la primera cuyo cante es hoy o después (-1 si el calendario ya terminó) */
const semanaEnCurso = (cal, hoy) => cal.semanas.findIndex((s) => s.cante >= hoy);
/** Afinidad media de un tema con los de una lista */
const afMedia = (af, c, lista) => { const o = lista.filter((x) => x !== c && af.idx[x] != null); if (!o.length || af.idx[c] == null) return 0;
  return o.reduce((t, x) => t + af.m[af.idx[c]][af.idx[x]], 0) / o.length; };

/**
 * Recoloca un tema de la semana w en la semana por venir donde mejor encaje (cualquiera posterior a la semana en curso,
 * salvo la suya; puede ser anterior a la suya si aún no ha empezado). Puntuación de cada semana candidata:
 *   afinidad media con sus temas − 0,15 por cada tema por encima de los previstos − 0,2 × exceso de carga de trabajo
 *   (carga = suma de pesos de sus temas frente a la carga media prevista por semana) − 0,005 por semana de distancia.
 * Dentro de la semana elegida, el tema se estudia justo después del tema con el que más relación tiene.
 * Si no hay ninguna semana candidata, se añade una al final.
 */
function recolocar(cal, w, codigo, af, pesos = {}, hoy = '0000-00-00') {
  const s = cal.semanas[w];
  if (!s || !s.temas.includes(codigo)) return { ok: true, destino: null };
  const k = cal.opciones.temasSemana;
  s.temas = s.temas.filter((c) => c !== codigo); if (s.orden) s.orden = s.orden.filter((c) => c !== codigo);
  const enCurso = semanaEnCurso(cal, hoy);
  const todos = cal.semanas.flatMap((x) => x.temas);
  const cargaMedia = k * (todos.reduce((t, c) => t + pesoTema(pesos, c), 0) / Math.max(1, todos.length));
  let mejor = -1, mejorV = -Infinity;
  for (let v = enCurso < 0 ? cal.semanas.length : enCurso + 1; v < cal.semanas.length; v++) { // calendario terminado: ninguna
    if (v === w) continue;
    const t = cal.semanas[v].temas;
    const carga = t.reduce((x, c) => x + pesoTema(pesos, c), 0) + pesoTema(pesos, codigo);
    const val = (af ? afMedia(af, codigo, t) : 0) - 0.15 * Math.max(0, t.length + 1 - k)
      - 0.2 * Math.max(0, carga / cargaMedia - 1) - 0.005 * Math.abs(v - w);
    if (val > mejorV) { mejorV = val; mejor = v; }
  }
  if (mejor < 0) { cal.semanas.push({ cante: masDias(cal.semanas[cal.semanas.length - 1].cante, 7), temas: [], bloque: '', orden: null }); mejor = cal.semanas.length - 1; }
  const d = cal.semanas[mejor];
  const orden = d.orden && d.orden.length === d.temas.length ? [...d.orden] : [...d.temas];
  let tras = -1, tv = -1;
  orden.forEach((c, i) => { const v = af && af.idx[c] != null && af.idx[codigo] != null ? af.m[af.idx[codigo]][af.idx[c]] : 0; if (v > tv) { tv = v; tras = i; } });
  orden.splice(tras + 1, 0, codigo);
  d.temas.push(codigo); d.orden = orden;
  return { ok: true, destino: mejor };
}

/**
 * Sugerencias para traer un tema a la semana w desde semanas que aún no han empezado (la inversa de recolocar).
 * Puntuación de cada tema candidato:
 *   afinidad media con los temas de la semana w − 0,5 × afinidad media con su semana actual (cuesta sacarlo de donde encaja bien)
 *   − 0,15 por cada tema que w tendría por encima de los previstos − 0,2 × exceso de carga de trabajo de w − 0,005 por semana de distancia.
 * Devuelve las n mejores: [{codigo, desde, puntos}] y, aparte, todos los candidatos ordenados.
 */
function sugerirTraer(cal, w, af, pesos = {}, hoy = '0000-00-00', n = 3) {
  const k = cal.opciones.temasSemana;
  const enCurso = semanaEnCurso(cal, hoy);
  const s = cal.semanas[w];
  if (!s || (enCurso >= 0 && w < enCurso) || enCurso < 0) return { mejores: [], todos: [] };
  const todos = cal.semanas.flatMap((x) => x.temas);
  const cargaMedia = k * (todos.reduce((t, c) => t + pesoTema(pesos, c), 0) / Math.max(1, todos.length));
  const carga0 = s.temas.reduce((t, c) => t + pesoTema(pesos, c), 0);
  const cand = [];
  cal.semanas.forEach((x, v) => {
    if (v === w || v <= enCurso) return;
    for (const c of x.temas) {
      const puntos = (af ? afMedia(af, c, s.temas) - 0.5 * afMedia(af, c, x.temas) : 0)
        - 0.15 * Math.max(0, s.temas.length + 1 - k) - 0.2 * Math.max(0, (carga0 + pesoTema(pesos, c)) / cargaMedia - 1) - 0.005 * Math.abs(v - w);
      cand.push({ codigo: c, desde: v, puntos });
    }
  });
  cand.sort((a, b) => b.puntos - a.puntos);
  return { mejores: cand.slice(0, n), todos: cand };
}

/** Trae el tema a la semana w (sale de la suya). Se estudia justo después del tema de w con el que más relación tiene. */
function traer(cal, w, codigo, af) {
  const desde = cal.semanas.findIndex((x) => x.temas.includes(codigo));
  if (desde < 0 || desde === w || !cal.semanas[w]) return { ok: false, motivo: 'Ese tema ya no está disponible.' };
  const o = cal.semanas[desde];
  o.temas = o.temas.filter((c) => c !== codigo); if (o.orden) o.orden = o.orden.filter((c) => c !== codigo);
  const d = cal.semanas[w];
  const orden = d.orden && d.orden.length === d.temas.length ? [...d.orden] : [...d.temas];
  let tras = -1, tv = -1;
  orden.forEach((c, i) => { const v = af && af.idx[c] != null && af.idx[codigo] != null ? af.m[af.idx[codigo]][af.idx[c]] : 0; if (v > tv) { tv = v; tras = i; } });
  orden.splice(tras + 1, 0, codigo);
  d.temas.push(codigo); d.orden = orden;
  return { ok: true, desde };
}

/** Semanas por venir (después de la semana en curso) con más temas de los previstos */
function sobrecargadas(cal, hoy) {
  const k = cal.opciones.temasSemana, ini = semanaEnCurso(cal, hoy) + 1;
  return cal.semanas.map((s, w) => ({ w, n: s.temas.length })).filter((x) => x.w >= Math.max(ini, 1) && x.n > k);
}

/**
 * Ampliar el calendario cuando hay demasiadas semanas sobrecargadas.
 *  modo 'parcial'  → de cada semana sobrecargada salen los temas que menos encajan en ella (hasta dejarla en lo previsto)
 *                    y forman una o varias semanas nuevas al final, agrupados por afinidad y de tamaño equilibrado.
 *  modo 'completo' → todas las semanas por venir se rehacen en modo temático con los temas que quedan
 *                    (las que hagan falta), encadenadas a partir de la semana en curso. La semana en curso y las pasadas no se tocan.
 * Las semanas nuevas siguen el ritmo semanal desde el último cante que se conserva.
 */
function ampliar(cal, modo, af, titulos, tax, hoy, semilla = 1) {
  const k = cal.opciones.temasSemana;
  const enCurso = semanaEnCurso(cal, hoy);
  const fijas = enCurso < 0 ? cal.semanas.length : enCurso + 1; // semanas que no se tocan (pasadas y en curso)
  if (fijas >= cal.semanas.length) return { ok: false, motivo: 'No quedan semanas por venir que reorganizar.' };
  const nueva = (cante, temas) => ({ cante, temas, bloque: bloque(temas, tax), orden: null });
  if (modo === 'parcial') {
    const sobran = [];
    for (let v = fijas; v < cal.semanas.length; v++) {
      const s = cal.semanas[v];
      while (s.temas.length > k) {
        const peor = s.temas.reduce((a, c) => (afMedia(af, c, s.temas) < afMedia(af, a, s.temas) ? c : a));
        s.temas = s.temas.filter((c) => c !== peor); if (s.orden) s.orden = s.orden.filter((c) => c !== peor);
        sobran.push(peor);
      }
    }
    if (!sobran.length) return { ok: false, motivo: 'No hay semanas con más temas de los previstos.' };
    // semanas nuevas equilibradas: con 6 temas que sobran y 5 por semana, dos semanas de 3 (no una de 5 y otra de 1)
    const kk = Math.ceil(sobran.length / Math.ceil(sobran.length / k));
    const grupos = sobran.length <= k ? [sobran] : tematico(sobran, kk, cal.opciones.intercalar !== false, semilla, af, titulos, null, 20000).semanas;
    let cante = cal.semanas[cal.semanas.length - 1].cante;
    for (const g of grupos) { cante = masDias(cante, 7); cal.semanas.push(nueva(cante, [...g])); }
    return { ok: true, nuevas: grupos.length };
  }
  // completo
  const resto = cal.semanas.slice(fijas).flatMap((s) => s.temas);
  const previa = fijas > 0 ? cal.semanas[fijas - 1].temas : null;
  const hechas = tematico(resto, k, cal.opciones.intercalar !== false, semilla, af, titulos,
    previa ? { tipo: 'tras', previa } : { tipo: 'basico' }, 80000).semanas;
  let cante = fijas > 0 ? cal.semanas[fijas - 1].cante : masDias(cal.semanas[0].cante, -7);
  const antes = cal.semanas.length - fijas;
  cal.semanas = cal.semanas.slice(0, fijas);
  for (const g of hechas) { cante = masDias(cante, 7); cal.semanas.push(nueva(cante, g)); }
  return { ok: true, nuevas: hechas.length - antes };
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
 *  'absorber'  → los temas que se estudiaban sobre todo ese día pasan a la semana siguiente (ver pasarSiguiente);
 *  'recolocar' → esos temas van a la semana posterior donde mejor encajen (ver recolocar).
 */
function librar(cal, dia, accion, pesos = {}, af = null, hoy = '0000-00-00') {
  const w = semanaDe(cal, dia);
  if (w < 0) return { ok: false, motivo: 'Ese día está fuera del calendario.' };
  let mover = [];
  if (accion !== 'repartir') {
    const rep = repartir(cal, w, pesos).dias[dia] || [];
    mover = rep.filter((x) => x.fraccion >= 0.5).map((x) => x.codigo);
  }
  cal.librados = cal.librados || {}; cal.librados[dia] = true; // «librado» manda sobre «estudio»: al deshacerlo se recupera lo anterior
  const destinos = {};
  if (accion === 'recolocar') for (const c of mover) destinos[c] = recolocar(cal, w, c, af, pesos, hoy).destino;
  else for (const c of [...mover].reverse()) pasarSiguiente(cal, w, c);
  return { ok: true, movidos: mover, destinos };
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

module.exports = { sugerirTraer, traer, recolocar, sobrecargadas, ampliar, semanaEnCurso, inicioSemana, ordenarSeries, cuotas, correlativo, aleatorio, tematico, bloque, valorar, crear, diasEstudio, repartir, pasarSiguiente, moverCante, semanaDe, librar, estudiar, reordenar, masDias, diaSemana };
