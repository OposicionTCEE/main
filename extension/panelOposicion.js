// Panel Oposición: pestaña con el calendario de vueltas, el tiempo restante de todos los temas y las relaciones entre temas
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { codigoTema, tituloTema, indiceTema } = require('./parser');
const G = require('./progreso');
const { crearCalendarios } = require('./calendarioPanel');
const { crearRelaciones } = require('./relacionesPanel');
const { crearCante } = require('./cante');
const { crearTest } = require('./testPanel');
const { crearIdiomas } = require('./idiomasPanel');

function crear(context, { progreso, textoDe, temaMostrado, alMarcar }) {
  let panel = null;
  let cache = null;          // {codigo: {uri, titulo, completo}} de todos los temas
  let espera = null, ocupado = false, pendiente = false;
  const raiz = () => vscode.workspace.workspaceFolders[0].uri.fsPath;

  const desarrollos = () => {
    try { return JSON.parse(fs.readFileSync(path.join(raiz(), 'main', 'analisis', 'desarrollos.json'), 'utf8')); } catch (e) { return { por_tema: {}, por_familia: {} }; }
  };
  // bloques temáticos (config/bloques.json), releídos si cambia el fichero
  let bloques = null, bloquesMtime = 0;
  const leerBloques = () => {
    const f = path.join(raiz(), 'main', 'config', 'bloques.json');
    try { const m = fs.statSync(f).mtimeMs; if (!bloques || m !== bloquesMtime) { bloques = JSON.parse(fs.readFileSync(f, 'utf8')); bloquesMtime = m; } } catch (e) { bloques = { ejercicios: {} }; }
    return bloques;
  };
  const calendarios = crearCalendarios({ ctx: context, progreso, raiz, desarrollos });
  const relaciones = crearRelaciones({ raiz, desarrollos });
  const test = crearTest({ raiz, progreso });
  const idiomas = crearIdiomas({ raiz, globalState: context.globalState });
  // Cante: grabación y transcripción (main/CANTE.md). alCambiar(ligero): solo el estado en vivo (nivel, % transcrito) o todo el panel
  const cante = crearCante({
    raiz, progreso,
    avisar: (texto, error) => { if (panel) panel.webview.postMessage({ tipo: 'aviso', texto, error: !!error }); else (error ? vscode.window.showWarningMessage : vscode.window.showInformationMessage)(texto); },
    alCambiar: (ligero) => { if (!panel) return; if (ligero) panel.webview.postMessage({ tipo: 'canteEstado', estado: cante.estado() }); else enviar(); },
  });
  setTimeout(() => { try { cante.retomar(); } catch (e) { /* sin carpeta aún */ } }, 5000);
  let latido = null;   // mientras se graba, el nivel del micrófono se envía cada medio segundo
  const vigilarGrabacion = () => {
    const g = panel && cante.estado().grabando;
    if (g && !latido) latido = setInterval(() => { if (!panel) { clearInterval(latido); latido = null; return; } const e = cante.estado(); panel.webview.postMessage({ tipo: 'canteEstado', estado: e }); if (!e.grabando) { clearInterval(latido); latido = null; } }, 500);
  };
  const minutosDe = () => Object.fromEntries(Object.values(cache || {}).map((t) => [t.codigo, t.minutos]));

  // Para no releer los 145 temas en cada refresco: lista de ficheros guardada (se rehace si se crea o borra un tema)
  // y, por tema, texto y pendientes guardados mientras no cambien el fichero, el documento abierto ni su última compilación
  let uris = null;
  const porTema = new Map();
  const vigiaTemas = vscode.workspace.createFileSystemWatcher('**/temario/Ejercicio-*/Parte-*/*/main.tex', false, true, false);
  vigiaTemas.onDidCreate(() => { uris = null; }); vigiaTemas.onDidDelete(() => { uris = null; });
  context.subscriptions.push(vigiaTemas);
  const marcaDe = (u) => {
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === u.toString());
    let m = '', e = '';
    try { m = fs.statSync(u.fsPath).mtimeMs; } catch (x) { /* sin fichero */ }
    try { e = fs.statSync(path.join(path.dirname(u.fsPath), '.build', 'estado')).mtimeMs; } catch (x) { /* sin compilar */ }
    return `${doc ? `v${doc.version}` : m}|${e}`;
  };

  async function temas() {
    if (!uris) uris = await vscode.workspace.findFiles('temario/Ejercicio-*/Parte-*/*/main.tex');
    const lista = [];
    for (const u of uris) {
      const codigo = codigoTema(u.fsPath);
      if (!codigo) continue;
      const marca = marcaDe(u);
      let c = porTema.get(codigo);
      if (!c || c.marca !== marca) {
        const texto = await textoDe(u);
        const { p } = progreso.calcular(codigo, u, texto);
        c = { marca, texto, t: tituloTema(texto) || {}, p };
        porTema.set(codigo, c);
      }
      const { texto, t } = c;
      const { e, test: tt } = progreso.estimar(codigo, c.p);
      lista.push({ codigo, uri: u, texto, titulo: t.corto || codigo, completo: t.completo || '', parte: codigo.slice(0, 3), minutos: e.minutos, pct: e.pct, hecho: e.hecho, errTest: (tt && tt.errores) || 0 });
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
    const cal = calendarios.vista(cache, minutosDe());
    return {
      temas: lista.map(({ codigo, titulo, completo, parte, minutos, pct, hecho, errTest }) => ({ codigo, titulo, completo, parte, minutos, pct, hecho, errTest, tiempo: G.formatoTiempo(minutos) })),
      total: { tiempo: G.formatoTiempo(lista.reduce((s, t) => s + t.minutos, 0)), hechos: hechos.size, n: lista.length },
      relaciones: { ...relaciones.vista(cache, abierto, dev), nombres },
      calendario: cal,
      bloques: leerBloques(),
      cante: { ...cante.estado(), lista: cante.lista(), abierto, semana: ((cal.cal && cal.cal.semanas) || []).filter((s) => s.estado === 'en curso').flatMap((s) => s.orden),
        objetivo: context.globalState.get('tcee.canteObjetivo', 30), micro: context.globalState.get('tcee.canteMicro', '') },
      mapa: mapa(lista, dev),
    };
  }

  async function enviar() {
    if (!panel) return;
    if (ocupado) { pendiente = true; return; }
    ocupado = true;
    try { panel.webview.postMessage({ tipo: 'datos', datos: await datos() }); vigilarGrabacion(); }
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
    vscode.commands.executeCommand('tcee.irA', t.uri, linea, { principal: true });
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
    if (m.tipo === 'abrirUrl') { if (/^https:\/\//.test(m.url || '')) vscode.env.openExternal(vscode.Uri.parse(m.url)); return; }
    if (m.tipo === 'abrir') return irA(m.codigo, m.epigrafe);
    if (m.tipo === 'hecho') { progreso.marcar(m.codigo, !!m.valor); alMarcar(); return; }
    if (m.tipo === 'relDetalle') {
      if (!cache) await temas();
      const nombres = Object.fromEntries(Object.values(cache).map((t) => [t.codigo, t.titulo]));
      panel.webview.postMessage({ tipo: 'relDetalle', detalle: relaciones.detalle(m.familia, cache, desarrollos(), nombres) });
      return;
    }
    if (m.tipo && m.tipo.startsWith('cante')) return mensajeCante(m);
    if (m.tipo && m.tipo.startsWith('test')) return mensajeTest(m);
    if (m.tipo && m.tipo.startsWith('idi')) return mensajeIdiomas(m);
    if (m.tipo === 'abrirLinea') {
      if (!cache) await temas();
      const t = cache[m.codigo]; if (t) vscode.commands.executeCommand('tcee.irA', t.uri, Math.max(0, m.linea), { principal: true });
    }
  }

  /** Pestaña Test: el banco (≈700 KB) se manda solo al abrir la pestaña, no en cada refresco del panel */
  function mensajeTest(m) {
    const enviarHistorial = () => panel.webview.postMessage({ tipo: 'testHistorial', historial: test.historial() });
    try {
      if (m.tipo === 'testCargar') {
        panel.webview.postMessage({ tipo: 'testDatos', banco: test.leerBanco(), historial: test.historial(), cobertura: test.cobertura(),
          imgBase: panel.webview.asWebviewUri(vscode.Uri.file(test.carpeta())).toString(), hayProgreso: progreso.hayCarpeta() });
      } else if (m.tipo === 'testGuardar') { test.guardar(m.sesion); enviarHistorial(); progreso.testCambiado(); alMarcar(); }
      else if (m.tipo === 'testBorrar') {
        vscode.window.showWarningMessage('¿Borrar esta sesión del historial? Sus respuestas dejarán de contar en las estadísticas.', { modal: true }, 'Borrar')
          .then((r) => { if (r) { test.borrar(m.id); enviarHistorial(); progreso.testCambiado(); alMarcar(); } });
      }
    } catch (e) { panel.webview.postMessage({ tipo: 'aviso', texto: String(e.message || e), error: true }); }
  }

  /** Pestaña Idiomas (main/IDIOMAS.md): los datos van y vienen solo cuando la pestaña los pide */
  async function mensajeIdiomas(m) {
    const responder = (tipo, x) => panel.webview.postMessage({ tipo, ...x });
    try {
      if (m.tipo === 'idiCargar') return responder('idiDatos', { datos: idiomas.datos() });
      if (m.tipo === 'idiCrearPerfil') { idiomas.crearPerfil(m.perfil); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiGuardarPerfil') { idiomas.guardarPerfil(m.cambios); responder('aviso', { texto: 'Ajustes guardados.' }); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiElegirPerfil') { await idiomas.elegirPerfil(m.dir); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiFicha') return responder('idiFicha', { ficha: idiomas.ficha(m.lengua, m.id) });
      if (m.tipo === 'idiEmpezar') return responder('idiSesion', { sesion: idiomas.empezar(m) });
      if (m.tipo === 'idiResponder') return responder('idiCorreccion', { clave: m.clave, resultado: idiomas.responder(m) });
      if (m.tipo === 'idiTerminar') { const r = idiomas.terminar(m); responder('idiFin', { fin: r }); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiRevision') return responder('idiRevisionOk', { revision: idiomas.marcarRevision(m) });
      if (m.tipo === 'idiGuardarEntrada') return responder('idiMiDicc', { lista: idiomas.guardarEntrada(m.entrada) });
      if (m.tipo === 'idiBorrarEntrada') return responder('idiMiDicc', { lista: idiomas.borrarEntrada(m) });
      if (m.tipo === 'idiBuscar') return responder('idiResultados', { clave: m.clave, ...idiomas.buscar(m) });
      if (m.tipo === 'idiDefinir') return responder('idiDefinicion', { clave: m.clave, definicion: idiomas.definir(m) });
      if (m.tipo === 'idiVerbosInicio') return responder('idiVerbos', { info: idiomas.verbosInicio() });
      if (m.tipo === 'idiVerbosBuscar') return responder('idiVerbosLista', { clave: m.clave, lista: idiomas.verbosBuscar(m) });
      if (m.tipo === 'idiVerbosSesion') return responder('idiVerbosSesion', { sesion: idiomas.verbosSesion(m) });
      if (m.tipo === 'idiVerbosTerminar') { responder('idiVerbos', { info: idiomas.verbosTerminar(m) }); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiLibreta') return responder('idiLibreta', { fichas: idiomas.fichasAnotadas() });
      if (m.tipo === 'idiAnotar') return responder('idiAnotado', { id: m.id, nota: idiomas.anotar(m) });
      if (m.tipo === 'idiEliminarPerfil') {
        const { ruta, nombre } = idiomas.rutaPerfil(m.dir);
        const si = await vscode.window.showWarningMessage(`¿Eliminar el perfil «${nombre}»?`,
          { modal: true, detail: `Se moverá a la Papelera la carpeta ${path.basename(ruta)} con todo su progreso, errores y anotaciones. Desde la Papelera se puede recuperar.` }, 'Eliminar');
        if (si !== 'Eliminar') return;
        await vscode.workspace.fs.delete(vscode.Uri.file(ruta), { recursive: true, useTrash: true });
        await idiomas.olvidarPerfil(m.dir);
        responder('aviso', { texto: `Perfil «${nombre}» eliminado (está en la Papelera).` });
        return responder('idiDatos', { datos: idiomas.datos() });
      }
      if (m.tipo === 'idiDescartarError') { idiomas.descartarError(m); return responder('idiDatos', { datos: idiomas.datos() }); }
    } catch (e) { responder('aviso', { texto: String(e.message || e), error: true }); }
  }

  async function mensajeCante(m) {
    try {
      if (m.tipo === 'canteEmpezar') {
        if (!cache) await temas();
        const t = cache[m.codigo];
        if (!t) throw new Error('Elige un tema.');
        context.globalState.update('tcee.canteObjetivo', Number(m.objetivo) || 0);
        if (m.micro) context.globalState.update('tcee.canteMicro', m.micro);
        await cante.empezar({ codigo: t.codigo, titulo: t.completo || t.titulo, objetivo: (Number(m.objetivo) || 0) * 60, micro: m.micro, texto: t.texto });
      } else if (m.tipo === 'canteTerminar') {
        const id = await cante.terminar(false);
        if (id) { panel.webview.postMessage({ tipo: 'canteSeleccionar', id }); panel.webview.postMessage({ tipo: 'canteDetalle', detalle: cante.leer(id) }); }
      } else if (m.tipo === 'canteDescartar') {
        const r = await vscode.window.showWarningMessage('¿Descartar este cante? Se borra la grabación y no se transcribe.', { modal: true }, 'Descartar');
        if (r) await cante.terminar(true);
      } else if (m.tipo === 'canteVer') {
        panel.webview.postMessage({ tipo: 'canteDetalle', detalle: cante.leer(m.id) });
      } else if (m.tipo === 'canteEliminar') {
        const r = await vscode.window.showWarningMessage('¿Eliminar este cante? Se borran la transcripción y el audio.', { modal: true }, 'Eliminar');
        if (r) { cante.eliminar(m.id); panel.webview.postMessage({ tipo: 'canteDetalle', detalle: null }); }
      } else if (m.tipo === 'canteAudio') {
        const f = cante.rutaAudio(m.id);
        if (f) vscode.env.openExternal(vscode.Uri.file(f)); else vscode.window.showWarningMessage('No encuentro el audio de este cante en este Mac (los audios no se sincronizan por GitHub).');
      } else if (m.tipo === 'canteReintentar') {
        cante.encolar(m.id);
      } else if (m.tipo === 'canteCancelar') {
        cante.cancelar();
      } else if (m.tipo === 'canteMicros') {
        panel.webview.postMessage({ tipo: 'canteMicros', micros: await cante.microfonos() });
      } else if (m.tipo === 'canteInstalar') {
        const t = (await vscode.tasks.fetchTasks()).find((x) => x.name === 'Instalar herramientas de cante');
        if (t) vscode.tasks.executeTask(t); else vscode.window.showWarningMessage('No encuentro la tarea «Instalar herramientas de cante». Sincroniza y vuelve a abrir el espacio de trabajo TCEE.');
      } else if (m.tipo === 'canteCopiar') {
        const f = cante.leer(m.id); if (f && f.texto) { await vscode.env.clipboard.writeText(f.texto); panel.webview.postMessage({ tipo: 'aviso', texto: 'Transcripción copiada.' }); }
      }
    } catch (e) { panel.webview.postMessage({ tipo: 'aviso', texto: String(e.message || e), error: true }); }
  }

  function html(webview) {
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = (f) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', f));
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${url('katex/katex.min.css')}"><link rel="stylesheet" href="${url('panel.css')}"><title>Panel Oposición</title></head>
<body><div id="app"><p class="vacio">Calculando los temas…</p></div>
<script nonce="${nonce}" src="${url('katex/katex.min.js')}"></script>
<script nonce="${nonce}" src="${url('calendario.js')}"></script>
<script nonce="${nonce}" src="${url('temas.js')}"></script>
<script nonce="${nonce}" src="${url('relaciones.js')}"></script>
<script nonce="${nonce}" src="${url('cante.js')}"></script>
<script nonce="${nonce}" src="${url('test.js')}"></script>
<script nonce="${nonce}" src="${url('idiomas.js')}"></script>
<script nonce="${nonce}" src="${url('panel.js')}"></script></body></html>`;
  }

  return {
    async abrir() {
      if (panel) { panel.reveal(); refrescar(); return; }
      panel = vscode.window.createWebviewPanel('tceeOposicion', 'Panel Oposición', vscode.ViewColumn.Active, {
        enableScripts: true, retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media'), vscode.Uri.file(test.carpeta())],
      });
      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'tcee.svg');
      panel.webview.html = html(panel.webview);
      panel.webview.onDidReceiveMessage(alMensaje);
      panel.onDidDispose(() => { panel = null; });
      // siempre en una ventana aparte (ventanas auxiliares de VS Code, 1.85 o posterior)
      try { await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow'); } catch (e) { /* se queda en la ventana principal */ }
    },
    refrescar,
    temaCambiado() { if (panel) refrescar(); },
  };
}

module.exports = { crear };
