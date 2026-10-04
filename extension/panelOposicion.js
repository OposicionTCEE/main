// Panel Oposición: pestaña con el calendario de vueltas, el tiempo restante de todos los temas, el plan semanal y las relaciones entre temas
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { codigoTema, tituloTema, indiceTema } = require('./parser');
const G = require('./progreso');
const P = require('./plan');
const { crearCalendarios } = require('./calendarioPanel');

function crear(context, { progreso, textoDe, temaMostrado, alMarcar }) {
  let panel = null;
  let cache = null;          // {codigo: {uri, titulo, completo}} de los 110 temas
  let espera = null, ocupado = false, pendiente = false;
  const raiz = () => vscode.workspace.workspaceFolders[0].uri.fsPath;

  const desarrollos = () => {
    try { return JSON.parse(fs.readFileSync(path.join(raiz(), 'main', 'analisis', 'desarrollos.json'), 'utf8')); } catch (e) { return { por_tema: {}, por_familia: {} }; }
  };
  const calendarios = crearCalendarios({ ctx: context, progreso, raiz, desarrollos });
  const minutosDe = () => Object.fromEntries(Object.values(cache || {}).map((t) => [t.codigo, t.minutos]));

  async function temas() {
    const uris = await vscode.workspace.findFiles('temario/Ejercicio-*/Parte-*/*/main.tex');
    const lista = [];
    for (const u of uris) {
      const codigo = codigoTema(u.fsPath);
      if (!codigo) continue;
      const texto = await textoDe(u);
      const t = tituloTema(texto) || {};
      const { e } = progreso.calcular(codigo, u, texto);
      lista.push({ codigo, uri: u, texto, titulo: t.corto || codigo, completo: t.completo || '', parte: codigo.slice(0, 3), minutos: e.minutos, pct: e.pct, hecho: e.hecho });
    }
    lista.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
    cache = Object.fromEntries(lista.map((t) => [t.codigo, t]));
    return lista;
  }

  function relaciones(abierto, dev, nombres) {
    if (!abierto) return { abierto: null, modelos: [] };
    // un mismo modelo puede aparecer varias veces (distintas formas): se agrupa por familia
    const grupos = new Map();
    for (const m of (dev.por_tema || {})[abierto] || []) {
      const g = grupos.get(m.familia);
      if (!g) grupos.set(m.familia, { ...m });
      else g.epigrafes = [...new Set([...g.epigrafes.split(' | '), ...m.epigrafes.split(' | ')])].join(' | ');
    }
    const propios = [...grupos.values()];
    return {
      abierto, titulo: nombres[abierto] || abierto,
      modelos: propios.map((m) => ({
        familia: m.familia, area: m.area, grado: m.grado, epigrafes: m.epigrafes, forma: m.forma,
        otros: ((dev.por_familia || {})[m.familia] || []).filter((c) => c !== abierto).map((c) => {
          const xs = ((dev.por_tema || {})[c] || []).filter((y) => y.familia === m.familia);
          const epis = [...new Set(xs.flatMap((y) => (y.epigrafes || '').split(' | ')).filter(Boolean))].join(' | ');
          return { codigo: c, titulo: nombres[c] || c, epigrafes: epis, grado: xs.map((y) => y.grado).includes('Completo') ? 'Completo' : (xs[0] || {}).grado || '' };
        }).filter((o, i, arr) => arr.findIndex((z) => z.codigo === o.codigo) === i),
      })),
    };
  }

  function mapa(lista, dev) {
    const pares = new Map();
    for (const [familia, cods] of Object.entries(dev.por_familia || {})) {
      const cs = [...new Set(cods)].sort();
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const k = `${cs[i]}|${cs[j]}`;
        (pares.get(k) || pares.set(k, []).get(k)).push(familia);
      }
    }
    return {
      nodos: lista.map((t) => ({ codigo: t.codigo, titulo: t.titulo, parte: t.parte, hecho: t.hecho, pct: t.pct,
        modelos: ((dev.por_tema || {})[t.codigo] || []).map((m) => m.familia) })),
      aristas: [...pares.entries()].map(([k, f]) => { const [a, b] = k.split('|'); return { a, b, familias: f }; }),
      familias: Object.keys(dev.por_familia || {}).sort((a, b) => a.localeCompare(b, 'es')),
    };
  }

  async function datos() {
    const lista = await temas();
    const dev = desarrollos();
    const nombres = Object.fromEntries(lista.map((t) => [t.codigo, t.titulo]));
    const plan = progreso.leerPlan();
    const lunes = P.lunesDe();
    const semanas = P.planificar(lista, plan, lunes);
    if (!plan.historial[lunes]) { plan.historial[lunes] = P.foto(semanas, lunes); progreso.guardarPlan(plan); }
    const hechos = new Set(lista.filter((t) => t.hecho).map((t) => t.codigo));
    const historial = Object.entries(plan.historial).filter(([l]) => l < lunes).sort().reverse().slice(0, 8)
      .map(([l, cods]) => ({ lunes: l, planificados: cods, hechos: cods.filter((c) => hechos.has(c)) }));
    const dias = progreso.dias();
    const estaSemana = Object.entries(dias).filter(([f]) => f >= lunes).reduce((s, [, m]) => s + m, 0);
    const abierto = temaMostrado() ? codigoTema(temaMostrado().fsPath) : null;
    return {
      temas: lista.map(({ codigo, titulo, completo, parte, minutos, pct, hecho }) => ({ codigo, titulo, completo, parte, minutos, pct, hecho, tiempo: G.formatoTiempo(minutos) })),
      total: { tiempo: G.formatoTiempo(lista.reduce((s, t) => s + t.minutos, 0)), hechos: hechos.size, n: lista.length },
      plan: {
        horasSemana: plan.horasSemana, lunes, estaSemana: G.formatoTiempo(estaSemana),
        semanas: semanas.map((s) => ({ ...s, total: G.formatoTiempo(s.total), cap: G.formatoTiempo(s.capacidad), lleno: s.total / s.capacidad,
          temas: s.temas.map((t) => ({ ...t, titulo: nombres[t.codigo], tiempo: G.formatoTiempo(t.minutos) })) })),
        historial, nombres,
      },
      relaciones: relaciones(abierto, dev, nombres),
      calendario: calendarios.vista(cache, minutosDe()),
      mapa: mapa(lista, dev),
    };
  }

  async function enviar() {
    if (!panel) return;
    if (ocupado) { pendiente = true; return; }
    ocupado = true;
    try { panel.webview.postMessage({ tipo: 'datos', datos: await datos() }); }
    catch (e) { panel.webview.postMessage({ tipo: 'error', texto: String(e && e.message || e) }); }
    ocupado = false;
    if (pendiente) { pendiente = false; refrescar(); }
  }
  function refrescar() { if (!panel) return; clearTimeout(espera); espera = setTimeout(enviar, 800); }
  progreso.alCambiar(refrescar);

  async function irA(codigo, epigrafe) {
    const t = cache && cache[codigo];
    if (!t) return;
    let linea = 0;
    if (epigrafe) {
      const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const buscado = norm(epigrafe.split('|')[0]);
      const plano = []; const rec = (ns) => ns.forEach((n) => { plano.push(n); rec(n.hijos); });
      rec(indiceTema(t.texto));
      const n = plano.find((x) => norm(x.titulo) === buscado) || plano.find((x) => norm(x.titulo).includes(buscado) || buscado.includes(norm(x.titulo)));
      if (n) linea = n.linea;
    }
    vscode.commands.executeCommand('tcee.irA', t.uri, linea);
  }

  async function alMensaje(m) {
    if (m.tipo === 'listo') return enviar();
    if (m.tipo && m.tipo.startsWith('cal')) {
      if (!cache) await temas();
      let r;
      try { r = calendarios.mensaje(m, cache, minutosDe()); } catch (e) { r = { ok: false, aviso: String(e && e.message || e) }; }
      if (r.previa) { panel.webview.postMessage({ tipo: 'previa', previa: r.previa }); return; }
      if (r.traer) { panel.webview.postMessage({ tipo: 'traer', traer: r.traer }); return; }
      if (r.aviso) panel.webview.postMessage({ tipo: 'aviso', texto: r.aviso, error: r.ok === false });
      if (r.ok !== false) enviar();
      return;
    }
    if (m.tipo === 'abrir') return irA(m.codigo, m.epigrafe);
    if (m.tipo === 'hecho') { progreso.marcar(m.codigo, !!m.valor); alMarcar(); return; }
    const plan = progreso.leerPlan();
    if (m.tipo === 'horas') { const h = Number(m.valor); if (h > 0 && h <= 100) { plan.horasSemana = h; progreso.guardarPlan(plan); refrescar(); } }
    if (m.tipo === 'fijar') {
      if (m.lunes) plan.fijados[m.codigo] = m.lunes; else delete plan.fijados[m.codigo];
      progreso.guardarPlan(plan); refrescar();
    }
  }

  function html(webview) {
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = (f) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', f));
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${url('panel.css')}"><title>Panel Oposición</title></head>
<body><div id="app"><p class="vacio">Calculando los 110 temas…</p></div>
<script nonce="${nonce}" src="${url('calendario.js')}"></script>
<script nonce="${nonce}" src="${url('panel.js')}"></script></body></html>`;
  }

  return {
    abrir() {
      if (panel) { panel.reveal(); refrescar(); return; }
      panel = vscode.window.createWebviewPanel('tceeOposicion', 'Panel Oposición', vscode.ViewColumn.Active, {
        enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      });
      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'tcee.svg');
      panel.webview.html = html(panel.webview);
      panel.webview.onDidReceiveMessage(alMensaje);
      panel.onDidDispose(() => { panel = null; });
    },
    refrescar,
    temaCambiado() { if (panel) refrescar(); },
  };
}

module.exports = { crear };
