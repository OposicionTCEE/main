#!/usr/bin/env node
// Informes de armonización de modelos entre temas (analisis/armonizacion.json). Reglas y encargo para Claude: main/RELACIONES.md
//
//   node main/scripts/armonizacion.js estado                 → qué informes están desactualizados o faltan
//   node main/scripts/armonizacion.js preparar [--pendientes | "Modelo" …]
//                                                            → escribe en TCEE/.armonizacion/in/ el LaTeX de cada modelo, tema a tema
//   node main/scripts/armonizacion.js unir                   → incorpora TCEE/.armonizacion/out/*.json (y verif_*.json) a armonizacion.json
//
// Se ejecuta desde la carpeta TCEE. La carpeta de trabajo .armonizacion queda fuera de los repositorios.
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../extension/desarrollos');
const P = require('../extension/parser');

const MAIN = path.resolve(__dirname, '..');
const TCEE = path.resolve(MAIN, '..');
const TRABAJO = path.join(TCEE, '.armonizacion');
const F_DEV = path.join(MAIN, 'analisis', 'desarrollos.json');
const F_ARM = path.join(MAIN, 'analisis', 'armonizacion.json');

const dev = JSON.parse(fs.readFileSync(F_DEV, 'utf8'));
const leerArm = () => (fs.existsSync(F_ARM) ? JSON.parse(fs.readFileSync(F_ARM, 'utf8')) : { modelos: {} });
const ruta = (c) => { const [e, p] = c.split('.'); return path.join(TCEE, 'temario', `Ejercicio-${e}`, `Parte-${p}`, c, 'main.tex'); };
const slug = (f) => f.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const compartidos = () => Object.entries(dev.por_familia || {}).map(([f, c]) => [f, [...new Set(c)].sort()]).filter(([, c]) => c.length >= 2);
const epis = (c, f) => ((dev.por_tema || {})[c] || []).filter((x) => x.familia === f).flatMap((x) => (x.epigrafes || '').split(' | ')).filter(Boolean);

/** Desarrollo actual de un modelo en un tema: epígrafes localizados y huella */
function actual(c, f) {
  if (!fs.existsSync(ruta(c))) return null;
  const t = fs.readFileSync(ruta(c), 'utf8');
  const nodos = D.localizar(t, f, epis(c, f));
  return { texto: t, nodos, huella: D.resumenAuto(t, nodos).huella };
}

/** Modelos cuyo informe falta o tiene algún tema cambiado desde que se escribió */
function pendientes() {
  const arm = leerArm().modelos || {};
  const r = [];
  for (const [f, cods] of compartidos()) {
    const inf = arm[f];
    if (!inf) { r.push({ familia: f, motivo: 'sin informe' }); continue; }
    const camb = cods.filter((c) => { const a = actual(c, f); const t = inf.temas && inf.temas[c]; return !t || !a || t.huella !== a.huella; });
    if (camb.length) r.push({ familia: f, motivo: `cambiados: ${camb.join(', ')}` });
  }
  return r;
}

function preparar(args) {
  const todos = compartidos();
  let elegidos;
  if (args[0] === '--pendientes') { const p = new Set(pendientes().map((x) => x.familia)); elegidos = todos.filter(([f]) => p.has(f)); }
  else if (args.length) { elegidos = todos.filter(([f]) => args.includes(f)); }
  else elegidos = todos;
  fs.mkdirSync(path.join(TRABAJO, 'in'), { recursive: true });
  fs.mkdirSync(path.join(TRABAJO, 'out'), { recursive: true });
  const lista = [];
  for (const [f, cods] of elegidos) {
    let md = `# Modelo: ${f}\n\n`, lin = 0;
    for (const c of cods) {
      const a = actual(c, f);
      const tit = a ? (P.tituloTema(a.texto) || {}) : {};
      md += `\n\n${'='.repeat(70)}\n## TEMA ${c}: ${tit.corto || ''}${tit.completo ? ' — ' + tit.completo : ''}\n`;
      if (!a || !a.nodos.length) { md += '(No se localizó el desarrollo en el texto actual.)\n'; continue; }
      const L = a.texto.split('\n');
      for (const x of a.nodos) { md += `\n### Epígrafe ${x.numero} ${x.titulo} (líneas ${x.linea + 1}-${x.fin})\n\`\`\`latex\n${L.slice(x.linea, x.fin).join('\n')}\n\`\`\`\n`; lin += x.fin - x.linea; }
    }
    fs.writeFileSync(path.join(TRABAJO, 'in', `${slug(f)}.md`), md);
    lista.push({ slug: slug(f), familia: f, lineas: lin, temas: cods.length });
  }
  lista.sort((a, b) => b.lineas - a.lineas);
  fs.writeFileSync(path.join(TRABAJO, 'lista.json'), JSON.stringify(lista, null, 1));
  console.log(`${lista.length} modelos preparados en ${path.join(TRABAJO, 'in')}`);
  lista.forEach((x) => console.log(`  ${x.slug}  (${x.temas} temas, ${x.lineas} líneas)`));
}

function unir() {
  const arm = leerArm(); arm.modelos = arm.modelos || {};
  const ver = {};
  for (const f of fs.existsSync(TRABAJO) ? fs.readdirSync(TRABAJO) : []) {
    if (/^verif_.*\.json$/.test(f)) JSON.parse(fs.readFileSync(path.join(TRABAJO, f), 'utf8')).forEach((v) => { ver[v.id] = v; });
  }
  const dirOut = path.join(TRABAJO, 'out');
  const nuevos = fs.existsSync(dirOut) ? fs.readdirSync(dirOut).filter((f) => f.endsWith('.json')) : [];
  if (!nuevos.length) { console.log(`No hay informes en ${dirOut}`); return; }
  for (const f of nuevos) {
    const j = JSON.parse(fs.readFileSync(path.join(dirOut, f), 'utf8'));
    const s = f.replace(/\.json$/, '');
    if (!(dev.por_familia || {})[j.familia]) { console.log(`AVISO: «${j.familia}» (${f}) no coincide con ninguna familia de desarrollos.json; se omite`); continue; }
    // posibles errores: se guarda el veredicto de la verificación independiente; los descartados se quitan
    j.divergencias = (j.divergencias || []).map((d, i) => {
      const v = ver[`${s}#${i}`];
      const esError = /^posible error/i.test(d.descripcion || '');
      if (!v) return d.verificacion ? d : esError ? { ...d, error: true, verificacion: 'sin verificar' } : d;
      return { ...d, error: true, verificacion: v.veredicto, linea: v.linea, nota_verificacion: v.nota };
    }).filter((d) => d.verificacion !== 'descartado');
    // huella del desarrollo de cada tema en el momento del análisis (para avisar cuando cambie)
    for (const c of Object.keys(j.temas || {})) {
      const a = actual(c, j.familia);
      if (a) { j.temas[c].huella = a.huella; j.temas[c].epigrafes_analizados = a.nodos.map((x) => `${x.numero} ${x.titulo}`); }
    }
    j.fecha = new Date().toISOString().slice(0, 10);
    arm.modelos[j.familia] = j;
    console.log(`  incorporado: ${j.familia}`);
  }
  arm.generado = new Date().toISOString().slice(0, 10);
  arm.metodo = arm.metodo || 'Informes escritos por Claude leyendo los desarrollos de cada modelo en cada tema; los posibles errores los revisa un segundo análisis independiente (ver RELACIONES.md). Cada tema guarda la huella de su desarrollo para avisar cuando cambia.';
  fs.writeFileSync(F_ARM, JSON.stringify(arm, null, 1));
  const errs = Object.values(arm.modelos).flatMap((m) => (m.divergencias || []).filter((d) => d.error));
  console.log(`armonizacion.json: ${Object.keys(arm.modelos).length} modelos, ${errs.filter((d) => d.verificacion === 'confirmado').length} posibles errores confirmados`);
}

const [orden, ...args] = process.argv.slice(2);
if (orden === 'estado') {
  const p = pendientes();
  if (!p.length) console.log('Todos los informes están al día.');
  else { console.log(`${p.length} modelos por actualizar:`); p.forEach((x) => console.log(`  ${x.familia} — ${x.motivo}`)); }
} else if (orden === 'preparar') preparar(args);
else if (orden === 'unir') unir();
else console.log('Uso: node main/scripts/armonizacion.js estado | preparar [--pendientes | "Modelo" …] | unir');
