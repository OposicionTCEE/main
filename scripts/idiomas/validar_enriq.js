// Comprueba los ficheros de enriquecimiento (encargo enriquecer.md) contra las fichas: todos los ejercicios, opciones completas,
// errores previstos que el corrector NO acepte, glosario en léxico y longitudes mínimas.
// Uso: node validar_enriq.js <lengua> [idcorto…]   (carpetas por defecto: /home/claude/idiomas y /home/claude/encargos/enriq)
'use strict';
const fs = require('fs'), path = require('path');
const { corregir } = require(path.join(__dirname, '../../extension/idiomas.js'));
const PAQ = process.env.PAQ || '/home/claude/idiomas', ENR = process.env.ENR || '/home/claude/encargos/enriq';
const [l, ...ids] = process.argv.slice(2);
const lista = ids.length ? ids : fs.readdirSync(path.join(ENR, l)).filter((x) => x.endsWith('.json')).map((x) => x.slice(0, -5));
const palabras = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
let total = 0;
for (const id of lista) {
  const p = []; const ficha = JSON.parse(fs.readFileSync(path.join(PAQ, l, 'fichas', `${id}.json`), 'utf8'));
  let e; try { e = JSON.parse(fs.readFileSync(path.join(ENR, l, `${id}.json`), 'utf8')); } catch (x) { console.log(`${l}/${id}: no se puede leer (${x.message})`); total++; continue; }
  if (e.id !== ficha.id) p.push(`id ${e.id} ≠ ${ficha.id}`);
  for (const k of ['descripcion_larga_es', 'descripcion_larga_l']) { const n = palabras(e[k]); if (n < 30 || n > 95) p.push(`${k}: ${n} palabras`); }
  for (const k of ['que_es', 'por_que_importa', 'cuando_se_usa']) if (palabras((e.contexto || {})[k]) < 15) p.push(`contexto.${k} corto o vacío`);
  const lex = /\.l\./.test(ficha.id);
  for (const ej of ficha.ejercicios) {
    const x = (e.ejercicios || {})[ej.id];
    if (!x) { p.push(`${ej.id}: falta`); continue; }
    if (palabras(x.explicacion) < 30) p.push(`${ej.id}: explicación corta (${palabras(x.explicacion)} palabras)`);
    if (!x.traduccion) p.push(`${ej.id}: falta traduccion`);
    if (/\*\*|^#/m.test(JSON.stringify(x))) p.push(`${ej.id}: Markdown`);
    if (ej.tipo === 'eleccion') {
      const po = x.por_opcion || {};
      for (const o of ej.opciones) if (!po[o]) p.push(`${ej.id}: por_opcion sin «${o}»`);
      for (const k of Object.keys(po)) if (!ej.opciones.includes(k)) p.push(`${ej.id}: por_opcion con clave ajena «${k}»`);
    } else if (!(x.errores_previstos || []).length) p.push(`${ej.id}: sin errores_previstos`);
    for (const ep of x.errores_previstos || []) {
      if (!ep.respuesta || !ep.explicacion) { p.push(`${ej.id}: error previsto incompleto`); continue; }
      if (corregir(ej, ep.respuesta).ok) p.push(`${ej.id}: el error previsto «${ep.respuesta}» lo acepta el corrector`);
    }
    if (lex && !(x.glosario || []).length) p.push(`${ej.id}: léxico sin glosario`);
  }
  for (const k of Object.keys(e.ejercicios || {})) if (!ficha.ejercicios.some((q) => q.id === k)) p.push(`ejercicio ajeno ${k}`);
  if (p.length) { console.log(`${l}/${id}: ${p.length} problema(s)`); p.slice(0, 30).forEach((q) => console.log('  ' + q)); }
  total += p.length;
}
console.log(total ? `Total: ${total} problema(s)` : `OK: ${lista.length} ficha(s) sin problemas`);
process.exitCode = total ? 1 : 0;
