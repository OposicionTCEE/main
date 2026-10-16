// Fusión a tres bandas al guardar (main/EDICION_SIMULTANEA.md).
// Si el fichero cambió en el disco mientras tenías cambios sin guardar (por ejemplo, porque Claude editó otra parte del tema),
// se combinan las tres versiones: la de partida (base), la tuya (editor) y la del disco. Lo que solo cambió un lado se toma
// de ese lado; si los dos cambiaron el mismo trozo de forma distinta, se deja el tuyo y, debajo, la versión del disco
// comentada entre dos marcas, para elegir después. Funciones puras: no dependen de VS Code (se prueban con node).

/** Diferencias entre dos listas de líneas: [{a0, a1, b0, b1}] = las líneas a[a0..a1) se sustituyen por b[b0..b1). */
function diferencias(a, b) {
  // prefijo y sufijo comunes: en un tema casi todo es común, así que el problema real suele ser pequeño
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s);
  const pares = comunes(A, B);   // [[i, j]] líneas iguales emparejadas, en orden
  const tramos = [];
  let i = 0, j = 0;
  for (const [x, y] of pares.concat([[A.length, B.length]])) {
    if (x > i || y > j) tramos.push({ a0: p + i, a1: p + x, b0: p + j, b1: p + y });
    i = x + 1; j = y + 1;
  }
  return tramos;
}

/** Subsecuencia común más larga (Myers, O((N+M)·D)); si el cambio es enorme, programación dinámica por bloques. */
function comunes(A, B) {
  const N = A.length, M = B.length;
  if (!N || !M) return [];
  const max = N + M, off = max;
  const V = new Int32Array(2 * max + 2);
  const traza = [];
  let fin = -1;
  for (let d = 0; d <= max; d++) {
    traza.push(V.slice(off - d, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) ? V[off + k + 1] : V[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      V[off + k] = x;
      if (x >= N && y >= M) { fin = d; break; }
    }
    if (fin >= 0) break;
  }
  // reconstrucción hacia atrás
  const pares = [];
  let x = N, y = M;
  for (let d = fin; d > 0; d--) {
    const Vd = traza[d];   // V al empezar la iteración d (índices off-d .. off+d+1 → 0 .. 2d+1)
    const val = (k) => Vd[k + d];
    const k = x - y;
    const kPrev = (k === -d || (k !== d && val(k - 1) < val(k + 1))) ? k + 1 : k - 1;
    const xPrev = val(kPrev), yPrev = xPrev - kPrev;
    const xIni = kPrev === k + 1 ? xPrev : xPrev + 1;   // tras el paso (inserción o borrado) y antes de la diagonal
    while (x > xIni && y > xIni - k) { x--; y--; pares.push([x, y]); }
    x = xPrev; y = yPrev;
  }
  while (x > 0 && y > 0) { x--; y--; pares.push([x, y]); }
  return pares.reverse();
}

/** Versión de un trozo de la base [g0, g1) tras aplicar los tramos de un lado que caen dentro. */
function version(base, lado, tramos, g0, g1) {
  const r = [];
  let pos = g0;
  for (const t of tramos) {
    r.push(...base.slice(pos, t.a0));
    r.push(...lado.slice(t.b0, t.b1));
    pos = t.a1;
  }
  r.push(...base.slice(pos, g1));
  return r;
}

const MARCA_INI = '% >>> PANEL TCEE: VERSIÓN DEL DISCO';
const MARCA_FIN = '% <<< PANEL TCEE: FIN DE LA VERSIÓN DEL DISCO';

/**
 * Fusiona base, tuyo (editor) y disco. Devuelve {texto, conflictos: [{id, tuyas, disco}]}.
 * En cada conflicto el texto lleva tus líneas y, debajo, las del disco comentadas entre MARCA_INI [id] y MARCA_FIN [id].
 */
function fusionar(baseTxt, tuyoTxt, discoTxt, sello = '') {
  const base = baseTxt.split('\n'), tuyo = tuyoTxt.split('\n'), disco = discoTxt.split('\n');
  const T = diferencias(base, tuyo).map((t) => ({ ...t, lado: 'tuyo' }));
  const D = diferencias(base, disco).map((t) => ({ ...t, lado: 'disco' }));
  const todos = T.concat(D).sort((x, y) => x.a0 - y.a0 || x.a1 - y.a1);
  // grupos de tramos que se solapan o se tocan en la base (dos cambios pegados se tratan como el mismo trozo)
  const grupos = [];
  for (const t of todos) {
    const g = grupos[grupos.length - 1];
    if (g && t.a0 <= g.a1) { g.tramos.push(t); g.a1 = Math.max(g.a1, t.a1); } else grupos.push({ a0: t.a0, a1: t.a1, tramos: [t] });
  }
  const salida = [], conflictos = [];
  let pos = 0;
  for (const g of grupos) {
    salida.push(...base.slice(pos, g.a0));
    const tt = g.tramos.filter((t) => t.lado === 'tuyo'), dd = g.tramos.filter((t) => t.lado === 'disco');
    const vt = version(base, tuyo, tt, g.a0, g.a1), vd = version(base, disco, dd, g.a0, g.a1);
    if (!dd.length) salida.push(...vt);
    else if (!tt.length) salida.push(...vd);
    else if (vt.join('\n') === vd.join('\n')) salida.push(...vt);
    else {
      const id = `${sello}${sello ? '-' : ''}${conflictos.length + 1}`;
      salida.push(...vt, `${MARCA_INI} [${id}] (cambió mientras escribías; el panel te deja elegir)`,
        ...vd.map((l) => (l ? '% ' + l : '%')), `${MARCA_FIN} [${id}]`);
      conflictos.push({ id, tuyas: vt, disco: vd });
    }
    pos = g.a1;
  }
  salida.push(...base.slice(pos));
  return { texto: salida.join('\n'), conflictos };
}

/** Ediciones mínimas (por desplazamientos de caracteres en `de`) que convierten `de` en `a`: [{desde, hasta, texto}]. */
function ediciones(deTxt, aTxt) {
  const de = deTxt.split('\n'), a = aTxt.split('\n');
  const ini = [];   // desplazamiento del comienzo de cada línea de `de`
  let o = 0;
  for (const l of de) { ini.push(o); o += l.length + 1; }
  const largo = deTxt.length;
  return diferencias(de, a).map((t) => {
    const nuevas = a.slice(t.b0, t.b1);
    if (t.a1 < de.length) return { desde: ini[t.a0], hasta: ini[t.a1], texto: nuevas.map((l) => l + '\n').join('') };
    // el tramo llega al final del fichero (la última línea no lleva salto)
    if (t.a0 < de.length) {
      if (nuevas.length) return { desde: ini[t.a0], hasta: largo, texto: nuevas.join('\n') };
      return { desde: t.a0 > 0 ? ini[t.a0] - 1 : 0, hasta: largo, texto: '' };
    }
    return { desde: largo, hasta: largo, texto: nuevas.length ? '\n' + nuevas.join('\n') : '' };
  }).filter((e) => e.desde !== e.hasta || e.texto);
}

/** Aplica ediciones (en orden y sin solaparse) a un texto: para las pruebas. */
function aplicar(txt, eds) {
  let r = '', pos = 0;
  for (const e of eds) { r += txt.slice(pos, e.desde) + e.texto; pos = e.hasta; }
  return r + txt.slice(pos);
}

/** Resuelve un conflicto ya escrito en el texto: 'tuya' quita el bloque comentado; 'disco' pone la versión del disco. */
function resolver(txt, conflicto, eleccion) {
  const L = txt.split('\n');
  const i = L.findIndex((l) => l.startsWith(MARCA_INI) && l.includes(`[${conflicto.id}]`));
  const f = L.findIndex((l, k) => k > i && l.startsWith(MARCA_FIN) && l.includes(`[${conflicto.id}]`));
  if (i < 0 || f < 0) return null;
  const n = conflicto.tuyas.length;
  if (eleccion === 'tuya') return L.slice(0, i).concat(L.slice(f + 1)).join('\n');
  if (i - n < 0 || L.slice(i - n, i).join('\n') !== conflicto.tuyas.join('\n')) return null;   // has cambiado tus líneas: no se toca
  return L.slice(0, i - n).concat(conflicto.disco, L.slice(f + 1)).join('\n');
}

module.exports = { diferencias, fusionar, ediciones, aplicar, resolver, MARCA_INI, MARCA_FIN };
