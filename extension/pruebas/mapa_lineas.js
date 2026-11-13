// Prueba de mapaLineas.js (main/REVISAR.md): la correspondencia de líneas entre el .tex del PDF y el de ahora.
// Casos: texto igual, líneas añadidas y borradas, un párrafo movido, un párrafo retocado y un tema real con cambios.
// Uso: node pruebas/mapa_lineas.js   (sale con código 1 si alguna comprobación falla)
'use strict';
const fs = require('fs');
const path = require('path');
const { crearMapa } = require('../mapaLineas');

let fallos = 0;
const comprobar = (nombre, ok, detalle) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${!ok && detalle ? ` (${detalle})` : ''}`); if (!ok) fallos++; };

const parrafo = (n) => `Párrafo ${n}: ${['inflación', 'tipo de cambio', 'balanza de pagos', 'patrón oro', 'Bretton Woods', 'liquidez', 'reservas', 'ajuste'][n % 8]} y más texto propio del párrafo número ${n} con palabras distintas ${'abcdefghij'.slice(0, (n % 9) + 1)}.`;
const base = [];
for (let n = 1; n <= 30; n++) { if (n % 6 === 1) base.push(`\\subsection{Apartado ${n}}`); base.push(parrafo(n), ''); }
const V = base.join('\n');
const linea = (texto, contiene) => texto.split('\n').findIndex((l) => l.includes(contiene)) + 1;

// ---- igual
let m = crearMapa(V, V);
comprobar('texto igual: cada línea en su sitio', [1, 5, 20, base.length].every((l) => m.aNuevo(l) === l && m.aViejo(l) === l));

// ---- añadir y borrar
const conAnadido = V.replace(parrafo(3), `${parrafo(3)}\n\nUn párrafo nuevo que no estaba.\n\nY otro más.`);
m = crearMapa(V, conAnadido);
comprobar('añadir arriba: los párrafos de abajo se desplazan', m.aNuevo(linea(V, 'Párrafo 20:')) === linea(conAnadido, 'Párrafo 20:'));
comprobar('añadir: lo nuevo apunta a un sitio cercano del viejo', Math.abs(m.aViejo(linea(conAnadido, 'Un párrafo nuevo')) - linea(V, 'Párrafo 3:')) <= 3);
const sinUno = V.replace(`${parrafo(10)}\n\n`, '');
m = crearMapa(V, sinUno);
comprobar('borrar: los de abajo suben', m.aNuevo(linea(V, 'Párrafo 25:')) === linea(sinUno, 'Párrafo 25:'));
comprobar('borrar: la línea borrada va a la de al lado', Math.abs(m.aNuevo(linea(V, 'Párrafo 10:')) - linea(sinUno, 'Párrafo 11:')) <= 2);

// ---- mover un párrafo de arriba abajo
const movido = V.replace(`${parrafo(4)}\n\n`, '').replace(`${parrafo(27)}\n`, `${parrafo(27)}\n\n${parrafo(4)}\n`);
m = crearMapa(V, movido);
comprobar('mover: el párrafo movido se sigue', m.aNuevo(linea(V, 'Párrafo 4:')) === linea(movido, 'Párrafo 4:'), `${m.aNuevo(linea(V, 'Párrafo 4:'))} ≠ ${linea(movido, 'Párrafo 4:')}`);
comprobar('mover: y al revés', m.aViejo(linea(movido, 'Párrafo 4:')) === linea(V, 'Párrafo 4:'));
comprobar('mover: los demás siguen bien', m.aNuevo(linea(V, 'Párrafo 15:')) === linea(movido, 'Párrafo 15:'));

// ---- retocar un párrafo (cambian unas palabras): se empareja por parecido
const retocado = V.replace(parrafo(12), parrafo(12).replace('con palabras distintas', 'con algunas palabras cambiadas'));
m = crearMapa(V, retocado);
comprobar('retocar: el párrafo retocado se empareja', m.aNuevo(linea(V, 'Párrafo 12:')) === linea(retocado, 'Párrafo 12:'));

// ---- un tema real (si está la copia del temario en la nube): borrar un bloque, mover otro y retocar líneas
const real = path.join(__dirname, '..', '..', '..', 'temario', 'Ejercicio-3', 'Parte-B', '3.B.20', 'main.tex');
if (fs.existsSync(real)) {
  const T = fs.readFileSync(real, 'utf8');
  const L = T.split('\n');
  const n = L.length;
  // mover las líneas [40 %, 42 %) al 80 %, borrar [60 %, 61 %) y retocar una línea de cada 50
  const a0 = Math.floor(n * 0.4), a1 = a0 + Math.floor(n * 0.02), b0 = Math.floor(n * 0.6), b1 = b0 + Math.floor(n * 0.01);
  const bloque = L.slice(a0, a1);
  const resto = L.filter((_, i) => !(i >= a0 && i < a1) && !(i >= b0 && i < b1));
  const nuevo = [...resto.slice(0, Math.floor(resto.length * 0.8)), ...bloque, ...resto.slice(Math.floor(resto.length * 0.8))]
    .map((l, i) => (i % 50 === 0 && l.length > 40 ? l.replace(/ (\S+) /, ' palabra ') : l));
  const N = nuevo.join('\n');
  const t0 = Date.now();
  m = crearMapa(T, N);
  const ms = Date.now() - t0;
  comprobar(`tema real (${n} líneas): rápido (${ms} ms)`, ms < 500);
  // comprobación: para cada línea vieja con contenido único que sigue en el nuevo, el mapa la encuentra
  let ok = 0, total = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i].trim();
    if (l.length < 30) continue;
    const donde = nuevo.reduce((acc, x, j) => (x.trim() === l ? [...acc, j] : acc), []);
    if (donde.length !== 1) continue;
    total++;
    if (m.aNuevo(i + 1) === donde[0] + 1) ok++;
  }
  comprobar(`tema real: líneas largas encontradas en su sitio nuevo (${ok} de ${total})`, total > 0 && ok / total > 0.99);
} else console.log('(sin copia del temario en la nube: se salta el tema real)');

console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
