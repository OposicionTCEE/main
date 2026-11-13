// Correspondencia de líneas entre dos versiones de un texto, para «Revisar» (main/REVISAR.md): la versión que produjo el PDF
// (copia guardada al compilar) y la de ahora, que el usuario sigue cambiando. Sigue los párrafos aunque se muevan de sitio.
// Sin dependencias de VS Code: se prueba con Node (pruebas/mapa_lineas.js). Líneas numeradas desde 1, como en SyncTeX.
//
// Cómo empareja (de más a menos seguro):
//  1. anclas: líneas con contenido que aparecen una sola vez en cada versión (aunque hayan cambiado de sitio: párrafos movidos);
//  2. alrededor de cada ancla, hacia arriba y hacia abajo, las líneas iguales aunque se repitan (en blanco, \item, \end{…});
//  3. entre dos emparejadas seguidas, las que se parecen (párrafos retocados: comparten al menos la mitad de sus palabras), en orden;
//  4. el resto (texto nuevo o borrado), por proporción entre las emparejadas de alrededor.
'use strict';

const normal = (l) => l.replace(/\s+/g, ' ').trim();
/** Una línea vale como ancla si tiene algo de contenido (no solo «}», «%» o «\\») */
const significativa = (l) => l.replace(/[\s{}%\\[\]]/g, '').length >= 4;
const PARECIDO = 0.5;          // proporción de palabras compartidas para dar por buena una línea retocada
const HUECO_MAX = 40000;       // líneas × líneas: en huecos mayores no se compara el parecido (sería lento) y se reparte

function palabras(l) {
  const s = new Set();
  for (const w of l.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []) s.add(w);
  return s;
}
function parecido(a, b) {
  if (!a.size || !b.size) return 0;
  let c = 0;
  for (const w of a) if (b.has(w)) c++;
  return (2 * c) / (a.size + b.size);
}

/**
 * Crea el mapa entre el texto viejo (el del PDF) y el nuevo (el de ahora).
 * Devuelve { aNuevo(lineaVieja), aViejo(lineaNueva), emparejadas } con líneas desde 1.
 */
function crearMapa(viejo, nuevo) {
  const A = viejo.split('\n').map(normal), B = nuevo.split('\n').map(normal);
  const nA = A.length, nB = B.length;
  const aB = new Int32Array(nA).fill(-1), bA = new Int32Array(nB).fill(-1);
  const unir = (i, j) => { aB[i] = j; bA[j] = i; };

  // 1. anclas: únicas en las dos versiones
  const cuenta = (arr) => {
    const m = new Map();
    arr.forEach((l, i) => { if (!significativa(l)) return; const c = m.get(l); if (c) c.n++; else m.set(l, { n: 1, i }); });
    return m;
  };
  const cA = cuenta(A), cB = cuenta(B);
  for (const [l, a] of cA) { const b = cB.get(l); if (a.n === 1 && b && b.n === 1) unir(a.i, b.i); }

  // 2. extender cada ancla con las líneas iguales de alrededor (abajo y arriba)
  for (let i = 0; i < nA; i++) {
    if (aB[i] < 0) continue;
    for (let k = 1, j = aB[i]; i + k < nA && j + k < nB && aB[i + k] < 0 && bA[j + k] < 0 && A[i + k] === B[j + k]; k++) unir(i + k, j + k);
  }
  for (let i = nA - 1; i >= 0; i--) {
    if (aB[i] < 0) continue;
    for (let k = 1, j = aB[i]; i - k >= 0 && j - k >= 0 && aB[i - k] < 0 && bA[j - k] < 0 && A[i - k] === B[j - k]; k++) unir(i - k, j - k);
  }

  // 3. líneas retocadas: en cada hueco entre dos emparejadas seguidas (con destinos en orden), las que más se parecen, en orden
  const cachePal = new Map();
  const pal = (arr, i, lado) => { const k = `${lado}${i}`; if (!cachePal.has(k)) cachePal.set(k, palabras(arr[i])); return cachePal.get(k); };
  let p = -1;   // última emparejada de A (o -1: el principio)
  for (let i = 0; i <= nA; i++) {
    if (i < nA && aB[i] < 0) continue;
    const desdeA = p + 1, hastaA = i - 1;
    const desdeB = p >= 0 ? aB[p] + 1 : 0, hastaB = i < nA ? aB[i] - 1 : nB - 1;
    if (hastaA >= desdeA && hastaB >= desdeB && (hastaA - desdeA + 1) * (hastaB - desdeB + 1) <= HUECO_MAX) {
      let j0 = desdeB;
      for (let a = desdeA; a <= hastaA; a++) {
        if (!significativa(A[a])) continue;
        let mejor = -1, m = PARECIDO;
        for (let b = j0; b <= hastaB; b++) {
          if (bA[b] >= 0 || !significativa(B[b])) continue;
          const s = parecido(pal(A, a, 'a'), pal(B, b, 'b'));
          if (s >= m) { m = s; mejor = b; }
        }
        if (mejor >= 0) { unir(a, mejor); j0 = mejor + 1; }
      }
    }
    p = i;
  }

  // 4. el resto: por proporción entre las emparejadas de alrededor (si están en orden) o por distancia a la más cercana
  function traducir(l, ida, nOrigen, nDestino) {
    if (!nDestino) return 1;
    const i = Math.min(Math.max(Math.round(l) - 1, 0), nOrigen - 1);
    if (ida[i] >= 0) return ida[i] + 1;
    let a = i - 1; while (a >= 0 && ida[a] < 0) a--;
    let b = i + 1; while (b < nOrigen && ida[b] < 0) b++;
    let j;
    if (a >= 0 && b < nOrigen && ida[a] < ida[b]) j = ida[a] + Math.round(((i - a) * (ida[b] - ida[a])) / (b - a));
    else if (a >= 0) j = ida[a] + (i - a);
    else if (b < nOrigen) j = ida[b] - (b - i);
    else j = i;
    return Math.min(Math.max(j, 0), nDestino - 1) + 1;
  }

  let emparejadas = 0;
  for (let i = 0; i < nA; i++) if (aB[i] >= 0) emparejadas++;
  return {
    aNuevo: (l) => traducir(l, aB, nA, nB),
    aViejo: (l) => traducir(l, bA, nB, nA),
    emparejadas,
    lineas: { viejo: nA, nuevo: nB },
  };
}

/** Mapa que deja las líneas igual (cuando el texto no ha cambiado) */
const identidad = (n) => ({ aNuevo: (l) => l, aViejo: (l) => l, emparejadas: n, lineas: { viejo: n, nuevo: n } });

module.exports = { crearMapa, identidad };
