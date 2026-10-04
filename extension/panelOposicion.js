// Panel Oposición: pestaña con el calendario de vueltas, el tiempo restante de todos los temas y las relaciones entre temas
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { codigoTema, tituloTema, indiceTema } = require('./parser');
const G = require('./progreso');
const { crearCalendarios } = require('./calendarioPanel');
const { crearRelaciones } = require('./relacionesPanel');

function crear(context, { progreso, textoDe, temaMostrado, alMarcar }) {
  let panel = null;
  let cache = null;          // {codigo: {uri, titulo, completo}} de todos los temas
  let espera = null, ocupado = false, pendiente = false;
  const raiz = () => vscode.workspace.workspaceFolders[0].uri.fsPath;

  const desarrollos = () => {
    try { return JSON.parse(fs.readFileSync(path.join(raiz(), 'main', 'analisis', 'desarrollos.json'), 'utf8')); } catch (e) { return { por_tema: {}, por_familia: {} }; }
  };
  const calendarios = crearCalendarios({ ctx: context, progreso, raiz, desarrollos });
  const relaciones = crearRelaciones({ raiz, desarrollos });
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
    const hechos = new Set(lista.filter((t) => t.hecho).map((t) => t.codigo));
    const abierto = temaMostrado() ? codigoTema(temaMostrado().fsPath) : null;
    return {
      temas: lista.map(({ codigo, titulo, completo, parte, minutos, pct, hecho }) => ({ codigo, titulo, completo, parte, minutos, pct, hecho, tiempo: G.formatoTiempo(minutos) })),
      total: { tiempo: G.formatoTiempo(lista.reduce((s, t) => s + t.minutos, 0)), hechos: hechos.size, n: lista.length },
      relaciones: { ...relaciones.vista(cache, abierto, dev), nombres },
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
    if (m.tipo === 'relDetalle') {
      if (!cache) await temas();
      const nombres = Object.fromEntries(Object.values(cache).map((t) => [t.codigo, t.titulo]));
      panel.webview.postMessage({ tipo: 'relDetalle', detalle: relaciones.detalle(m.familia, cache, desarrollos(), nombres) });
      return;
    }
    if (m.tipo === 'abrirLinea') {
      if (!cache) await temas();
      const t = cache[m.codigo]; if (t) vscode.commands.executeCommand('tcee.irA', t.uri, Math.max(0, m.linea));
    }
  }

  function html(webview) {
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = (f) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', f));
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${url('katex/katex.min.css')}"><link rel="stylesheet" href="${url('panel.css')}"><title>Panel Oposición</title></head>
<body><div id="app"><p class="vacio">Calculando los temas…</p></div>
<script nonce="${nonce}" src="${url('katex/katex.min.js')}"></script>
<script nonce="${nonce}" src="${url('calendario.js')}"></script>
<script nonce="${nonce}" src="${url('relaciones.js')}"></script>
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
