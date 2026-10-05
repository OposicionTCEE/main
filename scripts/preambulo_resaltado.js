#!/usr/bin/env node
// Añade al preámbulo de los temas el paquete del resaltado amarillo (\hl{…}, ⌃H en el Panel TCEE). Reglas: main/ESCRITURA.md
//
//   node main/scripts/preambulo_resaltado.js estado     → qué temas lo tienen ya
//   node main/scripts/preambulo_resaltado.js aplicar    → lo añade justo antes de \begin{document} donde falte
//
// Se ejecuta desde la carpeta TCEE. No aplicar sin el visto bueno del usuario.
'use strict';
const fs = require('fs');
const path = require('path');
const TEMARIO = process.env.TCEE_TEMARIO || path.join(path.resolve(__dirname, '..', '..'), 'temario');
const LINEA = '\\usepackage{soul}\\sethlcolor{yellow}% resaltado amarillo: \\hl{texto} (Panel TCEE, ⌃H)';
const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
const temas = [];
for (const e of ls(TEMARIO).filter((x) => /^Ejercicio-/.test(x)))
  for (const p of ls(path.join(TEMARIO, e)).filter((x) => /^Parte-/.test(x)))
    for (const t of ls(path.join(TEMARIO, e, p))) { const f = path.join(TEMARIO, e, p, t, 'main.tex'); if (fs.existsSync(f)) temas.push([t, f]); }
const tiene = (x) => /\\usepackage(\[[^\]]*\])?\{[^}]*\bsoul(utf8)?\b/.test(x.slice(0, x.indexOf('\\begin{document}')));
const orden = process.argv[2];
let con = 0, sin = [], hechos = 0;
for (const [c, f] of temas) {
  const x = fs.readFileSync(f, 'utf8'), i = x.indexOf('\\begin{document}');
  if (i < 0) continue;
  if (tiene(x)) { con++; continue; }
  sin.push(c);
  if (orden === 'aplicar') { fs.writeFileSync(f, x.slice(0, i) + LINEA + '\n' + x.slice(i)); hechos++; }
}
if (orden === 'aplicar') console.log(`Añadido en ${hechos} temas.`);
else console.log(`Con el paquete: ${con}. Sin él: ${sin.length}${sin.length ? ` (${sin.slice(0, 10).join(', ')}${sin.length > 10 ? '…' : ''})` : ''}.`);
