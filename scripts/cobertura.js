#!/usr/bin/env node
// Cobertura de las preguntas de test en los temas (analisis/cobertura.json): ¿está el contenido de la pregunta en su tema?
// Reglas y encargo para Claude: main/TEST.md, apartado «Cobertura».
//
//   node main/scripts/cobertura.js estado                       → temas con preguntas falladas sin informe o con el tema cambiado
//   node main/scripts/cobertura.js preparar [--errores | --todos | 3.A.8 …]
//                                                               → escribe en TCEE/.cobertura/in/<tema>.md las preguntas y la ruta del tema
//   node main/scripts/cobertura.js unir                         → incorpora TCEE/.cobertura/out/*.json a analisis/cobertura.json
//
// Se ejecuta desde la carpeta TCEE. La carpeta de trabajo .cobertura queda fuera de los repositorios.
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../extension/desarrollos');

const MAIN = path.resolve(__dirname, '..');
const TCEE = path.resolve(MAIN, '..');
const TRABAJO = path.join(TCEE, '.cobertura');
const F_COB = path.join(MAIN, 'analisis', 'cobertura.json');
const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const ruta = (c) => { const [e, p] = c.split('.'); return path.join(TCEE, 'temario', `Ejercicio-${e}`, `Parte-${p}`, c, 'main.tex'); };
const huellaTema = (c) => { try { return D.huella(fs.readFileSync(ruta(c), 'utf8')); } catch (e) { return null; } };
const ord = (a, b) => a.localeCompare(b, 'es', { numeric: true });

const banco = leer(path.join(TCEE, 'test', 'preguntas.json'), { preguntas: [] });
const cob = () => leer(F_COB, { preguntas: {} });

/** Preguntas cuya última respuesta (de cualquier Mac) fue error o blanco */
function falladas() {
  const d = path.join(TCEE, 'progreso', 'test');
  const ses = (fs.existsSync(d) ? fs.readdirSync(d) : []).filter((f) => f.endsWith('.json'))
    .flatMap((f) => (leer(path.join(d, f), {}).sesiones || [])).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const u = {}; for (const s of ses) for (const r of s.respuestas || []) u[r.id] = r.ok;
  return new Set(Object.entries(u).filter(([, ok]) => ok !== true).map(([id]) => id));
}

/** Temas pendientes: con preguntas (falladas, o todas con --todos) sin informe, o cuyo tema cambió desde el informe */
function pendientes(todas) {
  const c = cob().preguntas || {}, f = falladas();
  const porTema = {};
  for (const q of banco.preguntas) {
    if (!todas && !f.has(q.id)) continue;
    const inf = c[q.id], h = huellaTema(q.tema);
    if (inf && inf.huella === h) continue;
    (porTema[q.tema] = porTema[q.tema] || []).push(q.id);
  }
  return porTema;
}

function preparar(args) {
  let temas;
  if (args[0] === '--todos') temas = pendientes(true);
  else if (!args.length || args[0] === '--errores') temas = pendientes(false);
  else temas = Object.fromEntries(args.map((t) => [t, banco.preguntas.filter((q) => q.tema === t).map((q) => q.id)]));
  fs.mkdirSync(path.join(TRABAJO, 'in'), { recursive: true });
  fs.mkdirSync(path.join(TRABAJO, 'out'), { recursive: true });
  const porId = Object.fromEntries(banco.preguntas.map((q) => [q.id, q]));
  for (const [t, ids] of Object.entries(temas).sort(([a], [b]) => ord(a, b))) {
    let md = `# Tema ${t}\n\nTexto del tema (léelo entero): ${ruta(t)}\n\n## Preguntas (${ids.length})\n`;
    for (const id of ids) {
      const q = porId[id];
      md += `\n### ${id} · ${q.examen || ''}${q.numero ? `, pregunta ${q.numero}` : ''}\n${q.enunciado}\n`;
      q.opciones.forEach((o) => { md += `- ${o.id}) ${o.text}${q.correctas.includes(o.id) ? '   ← CORRECTA' : ''}\n`; });
    }
    fs.writeFileSync(path.join(TRABAJO, 'in', `${t}.md`), md);
    console.log(`  ${t}: ${ids.length} preguntas`);
  }
  if (!Object.keys(temas).length) console.log('No hay nada que preparar.');
}

function unir() {
  const c = cob(); c.preguntas = c.preguntas || {};
  const dir = path.join(TRABAJO, 'out');
  const fs_ = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  if (!fs_.length) { console.log(`No hay informes en ${dir}`); return; }
  const validos = new Set(['cubierta', 'desapercibida', 'falta', 'contradice']);
  let n = 0;
  for (const f of fs_) {
    const j = leer(path.join(dir, f), null);
    if (!j || !j.tema || !Array.isArray(j.preguntas)) { console.log(`AVISO: ${f} no tiene el formato esperado; se omite`); continue; }
    const h = huellaTema(j.tema);
    for (const r of j.preguntas) {
      if (!validos.has(r.estado)) { console.log(`AVISO: ${r.id}: estado «${r.estado}» no válido; se omite`); continue; }
      c.preguntas[r.id] = { tema: j.tema, estado: r.estado, epigrafe: r.epigrafe || '', linea: Number(r.linea) || null,
        explicacion: r.explicacion || '', propuesta: r.propuesta || '', huella: h, fecha: new Date().toISOString().slice(0, 10) };
      n++;
    }
  }
  c.actualizado = new Date().toISOString().slice(0, 10);
  c.metodo = 'Claude lee la pregunta (con su respuesta correcta) y el tema, y clasifica si el contenido está cubierto, pasa desapercibido, falta o lo contradice. Ver TEST.md.';
  fs.writeFileSync(F_COB, JSON.stringify(c, null, 1) + '\n');
  const cuenta = {}; Object.values(c.preguntas).forEach((x) => { cuenta[x.estado] = (cuenta[x.estado] || 0) + 1; });
  console.log(`cobertura.json: ${n} preguntas incorporadas · total ${JSON.stringify(cuenta)}`);
}

const [orden, ...args] = process.argv.slice(2);
if (orden === 'estado') {
  const p = pendientes(args[0] === '--todos');
  const ts = Object.keys(p).sort(ord);
  if (!ts.length) console.log('Cobertura al día: no hay preguntas falladas sin informe.');
  else { console.log(`${ts.length} temas por analizar:`); ts.forEach((t) => console.log(`  ${t} — ${p[t].length} preguntas`)); }
} else if (orden === 'preparar') preparar(args);
else if (orden === 'unir') unir();
else console.log('Uso: node main/scripts/cobertura.js estado | preparar [--errores | --todos | 3.A.8 …] | unir');
