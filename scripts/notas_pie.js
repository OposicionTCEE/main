#!/usr/bin/env node
// Pasa las notas al pie largas a la forma «contraíble» (en varias líneas), sin cambiar el PDF. Reglas: main/NOTAS.md
//
//   node main/scripts/notas_pie.js estado [3.A.4 …]     → cuántas notas hay y cuántas se reescribirían, tema a tema
//   node main/scripts/notas_pie.js muestra 3.A.4 [n]    → enseña n notas antes y después (por defecto 3)
//   node main/scripts/notas_pie.js aplicar [3.A.4 …]    → reescribe los temas (todos si no se indica ninguno)
//                                                        y recoloca las líneas citadas en analisis/armonizacion.json
//
// Se ejecuta desde la carpeta TCEE. No tocar ningún tema sin el visto bueno del usuario.
'use strict';
const fs = require('fs');
const path = require('path');
const N = require('../extension/notas');

const MAIN = path.resolve(__dirname, '..');
const TEMARIO = process.env.TCEE_TEMARIO || path.join(path.resolve(MAIN, '..'), 'temario');
const F_ARM = path.join(MAIN, 'analisis', 'armonizacion.json');
const MINIMO = 80;   // caracteres: las notas más cortas se dejan en una línea

const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
function temas() {
  const v = [];
  for (const e of ls(TEMARIO).filter((x) => /^Ejercicio-/.test(x)))
    for (const p of ls(path.join(TEMARIO, e)).filter((x) => /^Parte-/.test(x)))
      for (const t of ls(path.join(TEMARIO, e, p))) { const f = path.join(TEMARIO, e, p, t, 'main.tex'); if (fs.existsSync(f)) v.push([t, f]); }
  const orden = (c) => c.split('.').map((x) => (/^\d+$/.test(x) ? x.padStart(3, '0') : x)).join('.');
  return v.sort((a, b) => orden(a[0]).localeCompare(orden(b[0])));
}

const [orden, ...args] = process.argv.slice(2);
const pedidos = args.filter((a) => /^\d\.[AB]\.\d+$/.test(a));
const lista = temas().filter(([c]) => !pedidos.length || pedidos.includes(c));

if (orden === 'estado') {
  let tn = 0, tr = 0, tc = 0, tt = 0;
  for (const [c, f] of lista) {
    const x = fs.readFileSync(f, 'utf8');
    const n = N.notas(x).length; if (!n) continue;
    const r = N.reescribir(x, MINIMO);
    const distinto = N.notas(r.texto).length !== n;
    const ahora = N.tramos(x).length, despues = N.tramos(r.texto).length;
    tn += n; tr += despues; tc += ahora; tt++;
    console.log(`${c.padEnd(7)} notas ${String(n).padStart(4)}   contraíbles ahora ${String(ahora).padStart(4)}   después ${String(despues).padStart(4)}${distinto ? '   ¡distinto número de notas!' : ''}`);
  }
  console.log(`\nTotal: ${tt} temas, ${tn} notas; contraíbles ahora ${tc}, después ${tr} (las de menos de ${MINIMO} caracteres se quedan en una línea).`);
} else if (orden === 'muestra') {
  const [c, f] = lista[0] || []; if (!f) { console.error('Indica un tema, p. ej. 3.A.4'); process.exit(1); }
  const n = Number(args.find((a) => /^\d+$/.test(a))) || 3;
  const x = fs.readFileSync(f, 'utf8'), r = N.reescribir(x, MINIMO);
  const a = N.notas(x), b = N.notas(r.texto);
  let k = 0;
  for (let i = 0; i < a.length && k < n; i++) {
    const va = x.slice(x.lastIndexOf('\n', a[i].inicio) + 1, x.indexOf('\n', a[i].fin) < 0 ? x.length : x.indexOf('\n', a[i].fin));
    const vb = r.texto.slice(r.texto.lastIndexOf('\n', b[i].inicio) + 1, r.texto.indexOf('\n', b[i].fin) < 0 ? r.texto.length : r.texto.indexOf('\n', b[i].fin));
    if (va === vb) continue;
    k++;
    console.log(`──── ${c}, nota ${i + 1} ── ANTES\n${va}\n──── DESPUÉS\n${vb}\n`);
  }
} else if (orden === 'aplicar') {
  const arm = fs.existsSync(F_ARM) ? JSON.parse(fs.readFileSync(F_ARM, 'utf8')) : null;
  let hechos = 0, notas = 0;
  const cambiosPorTema = {};
  for (const [c, f] of lista) {
    const x = fs.readFileSync(f, 'utf8'), r = N.reescribir(x, MINIMO);
    if (r.texto === x) continue;
    if (N.notas(r.texto).length !== N.notas(x).length) { console.error(`${c}: el número de notas cambiaría; no se toca`); continue; }
    fs.writeFileSync(f, r.texto);
    cambiosPorTema[c] = r.cambios; hechos++; notas += r.cambios.length;
  }
  // líneas citadas en los informes de armonización (posibles errores con «Ir a la línea»)
  let recolocadas = 0;
  if (arm) {
    const recorrer = (o) => {
      if (Array.isArray(o)) return o.forEach(recorrer);
      if (!o || typeof o !== 'object') return;
      if (typeof o.linea === 'number' && Array.isArray(o.temas) && o.temas.length === 1 && cambiosPorTema[o.temas[0]]) {
        const nueva = N.recolocar(o.linea, cambiosPorTema[o.temas[0]]);
        if (nueva !== o.linea) { o.linea = nueva; recolocadas++; }
      }
      Object.values(o).forEach(recorrer);
    };
    recorrer(arm);
    fs.writeFileSync(F_ARM, JSON.stringify(arm, null, 1));
  }
  console.log(`Reescritas ${notas} notas en ${hechos} temas; ${recolocadas} líneas recolocadas en armonizacion.json.`);
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
