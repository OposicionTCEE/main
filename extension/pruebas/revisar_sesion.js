// Prueba de la lógica de «Revisar» en la extensión (revisar.js; main/REVISAR.md) con VS Code simulado (vscode_simulado.js) y un
// tema de prueba compilado de verdad con scripts/compilar.sh (pdflatex + SyncTeX + copia del .tex).
// Comprueba: foto y apertura (texto en ventana aparte y visor al lado), PDF abierto donde se leía el texto, el texto sigue al PDF
// (banda incluida), lo que mueve el PDF no vuelve, doble clic, clic en el texto → marca en el PDF, «en los dos sentidos», párrafo
// movido después de compilar, aviso de PDF nuevo, «Actualizar» sin perder el sitio y cierre (se cierra la copia del texto).
// Uso: node pruebas/revisar_sesion.js   (necesita pdflatex; en la nube de Claude está). Sale con código 1 si algo falla.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { instalar } = require('./vscode_simulado');

let fallos = 0;
const comprobar = (nombre, ok, detalle) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${!ok && detalle ? ` (${detalle})` : ''}`); if (!ok) fallos++; };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- un «tema» de prueba compilado con el script de verdad
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'revisar-'));
const dirTema = path.join(raiz, 'temario', 'Ejercicio-3', 'Parte-B', '3.B.99');
fs.mkdirSync(dirTema, { recursive: true });
const TEX = path.join(dirTema, 'main.tex');
fs.copyFileSync(path.join(__dirname, 'datos', 'revisar_muestra.tex'), TEX);
const compilar = () => execFileSync('bash', [path.join(__dirname, '..', '..', 'scripts', 'compilar.sh'), path.join(dirTema, 'main')], { stdio: 'ignore', env: { ...process.env, HOME: raiz } });
try { compilar(); } catch (e) { /* errores menores */ }
if (!fs.existsSync(path.join(dirTema, '.build', 'main.synctex.gz'))) { console.log('Sin pdflatex: no se puede probar aquí'); process.exit(2); }
comprobar('compilar.sh deja la copia del .tex junto al PDF', fs.readFileSync(path.join(dirTema, '.build', 'main.fuente.tex'), 'utf8') === fs.readFileSync(TEX, 'utf8'));

(async () => {
  const sim = instalar();
  const v = sim.vscode;
  // ---- lo que falta en la simulación general: documentos, editores, visor, avisos
  class Range { constructor(a, b, c, d) { this.start = { line: a, character: b }; this.end = { line: c, character: d }; } }
  Object.assign(v, {
    Range, ViewColumn: { Active: -1, Beside: -2, One: 1 }, TextEditorRevealType: { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 },
    TextEditorSelectionChangeKind: { Keyboard: 1, Mouse: 2, Command: 3 }, ThemeColor: class { constructor(id) { this.id = id; } },
    OverviewRulerLane: { Center: 2 }, ProgressLocation: { Notification: 15 },
    RelativePattern: class { constructor(base, patron) { this.base = base; this.patron = patron; } },
  });
  v.Uri = class Uri {
    constructor(f) { this.fsPath = f; this.scheme = 'file'; }
    toString() { return `file://${this.fsPath}`; }
    static file(f) { return new Uri(f); }
    static joinPath(u, ...p) { return new Uri(path.join(u.fsPath, ...p)); }
    static parse(t) { return new Uri(t); }
  };
  const oyentes = { rangos: [], seleccion: [], texto: [], vigias: [] };
  const evento = (lista) => (f) => { lista.push(f); return { dispose() { lista.splice(lista.indexOf(f), 1); } }; };
  Object.assign(v.window, {
    onDidChangeTextEditorVisibleRanges: evento(oyentes.rangos), onDidChangeTextEditorSelection: evento(oyentes.seleccion),
    createTextEditorDecorationType: () => ({ dispose() {} }),
    withProgress: async (_, f) => f({ report() {} }, { isCancellationRequested: false }),
    showWarningMessage: (t) => { sim.mensajes.push(`AVISO: ${t}`); return Promise.resolve(); },
    visibleTextEditors: [],
  });
  v.workspace.onDidChangeTextDocument = evento(oyentes.texto);
  v.workspace.createFileSystemWatcher = () => { const w = { cambio: [], onDidChange: (f) => { w.cambio.push(f); return { dispose() {} }; }, onDidCreate: (f) => { w.cambio.push(f); return { dispose() {} }; }, dispose() {} }; oyentes.vigias.push(w); return w; };
  let respuestaModal = null;   // lo que «pulsa» el usuario en las preguntas
  v.window.showInformationMessage = (t, ...r) => { sim.mensajes.push(t); return Promise.resolve(typeof r[0] === 'object' ? respuestaModal : undefined); };

  // documento del tema
  const uri = v.Uri.file(TEX);
  const doc = { uri, isDirty: false, texto: fs.readFileSync(TEX, 'utf8'), getText() { return this.texto; }, save: async () => true, version: 1 };
  v.workspace.openTextDocument = async () => doc;
  const editores = [];
  function nuevoEditor(grupo) {
    const ed = { document: doc, viewColumn: grupo.viewColumn, grupo, visibleRanges: [new Range(0, 0, 40, 0)], deco: [], revelado: [],
      revealRange(r, tipo) { this.revelado.push({ linea: r.start.line + 1, tipo }); if (tipo === v.TextEditorRevealType.AtTop) this.visibleRanges = [new Range(r.start.line, 0, r.start.line + 40, 0)]; oyentes.rangos.forEach((f) => f({ textEditor: this, visibleRanges: this.visibleRanges })); },
      setDecorations(_, rs) { this.deco = rs.map((r) => r.start.line + 1); } };
    Object.defineProperty(ed, 'viewColumn', { get: () => grupo.viewColumn });
    editores.push(ed); v.window.visibleTextEditors = editores.filter((e) => sim.grupos.includes(e.grupo));
    return ed;
  }
  const principal = nuevoEditor(sim.grupos[0]);
  sim.anadir(sim.grupos[0], { input: new v.TabInputText(uri), label: 'main.tex', isDirty: false });
  principal.visibleRanges = [new Range(29, 0, 70, 0)];   // el usuario leía por la línea 30
  v.window.activeTextEditor = principal;
  v.window.showTextDocument = async (d, o = {}) => {
    const g = o.viewColumn ? sim.grupos[o.viewColumn - 1] : v.window.tabGroups.activeTabGroup;
    const ed = editores.find((e) => e.grupo === g) || principal;
    if (o.selection) ed.seleccion = o.selection.start.line + 1;
    return ed;
  };
  sim.ordenes['workbench.action.copyEditorToNewWindow'] = async () => {
    const g = sim.nuevoGrupo('aparte'); sim.anadir(g, { input: new v.TabInputText(uri), label: 'main.tex', isDirty: false }); nuevoEditor(g);
  };
  sim.ordenes['latex-workshop.build'] = async () => { try { compilar(); } catch (e) { /* */ } };
  // visor simulado
  let panel = null;
  v.window.createWebviewPanel = (tipo, titulo, opciones) => {
    const recibidos = [], oyente = [];
    const g = sim.nuevoGrupo('aparte'); sim.anadir(g, { input: new v.TabInputWebview('tceeRevisar'), label: titulo });
    panel = { titulo, recibidos, grupo: g, iconPath: null, alCerrar: [],
      webview: { cspSource: 'vscode-resource:', asWebviewUri: (u) => ({ toString: () => `vscode-resource:${u.fsPath}` }), html: '',
        postMessage: (m) => { recibidos.push(m); return Promise.resolve(true); }, onDidReceiveMessage: (f) => { oyente.push(f); return { dispose() {} }; } },
      onDidDispose: (f) => { panel.alCerrar.push(f); return { dispose() {} }; }, reveal() {},
      dispose: () => panel.alCerrar.forEach((f) => f()),
      decir: async (m) => { for (const f of oyente) await f(m); } };
    return panel;
  };
  v.window.tabGroups.close = async (t) => { const g = t.group; g.tabs.splice(g.tabs.indexOf(t), 1); if (!g.tabs.length) sim.grupos.splice(sim.grupos.indexOf(g), 1); };

  // ---- abrir
  const { crearRevisar } = require('../revisar');
  const context = { subscriptions: [], extensionUri: v.Uri.file(path.join(__dirname, '..')), extensionPath: path.join(__dirname, '..') };
  const codigoTema = (f) => (/(\d\.[AB]\.\d+)[\\/]main\.tex$/.exec(f) || [])[1] || null;
  const R = crearRevisar(context, { codigoTema, temaMostrado: () => uri });
  await R.abrir(uri);
  comprobar('abre el visor con el título del tema', panel && panel.titulo === 'Revisar 3.B.99');
  comprobar('el texto va a una ventana aparte (copia del editor)', sim.grupos.length === 3 && editores.length === 2);
  comprobar('la página del visor lleva su política de seguridad', /Content-Security-Policy/.test(panel.webview.html) && /nonce-/.test(panel.webview.html));
  const aparte = editores[1];

  await panel.decir({ tipo: 'listo' });
  const cargar = panel.recibidos.find((m) => m.tipo === 'cargar');
  comprobar('manda el PDF al visor', cargar && cargar.datos.length > 1000 && /^\d\d\/\d\d \d\d:\d\d$/.test(cargar.fecha), cargar && cargar.fecha);
  comprobar('lo abre donde se leía el texto (línea 30)', cargar && cargar.posicion && cargar.posicion.pagina >= 1, JSON.stringify(cargar && cargar.posicion));
  comprobar('dice quién manda («PDF → texto»)', panel.recibidos.some((m) => m.tipo === 'sentido' && m.titulo === 'PDF → texto'));
  comprobar('sin aviso (copia del .tex y SyncTeX al día)', cargar && !cargar.aviso, cargar && cargar.aviso);

  // ---- el PDF manda: el texto sigue y no se devuelve
  const { leer } = require('../synctex');
  const idx = leer(fs.readFileSync(path.join(dirTema, '.build', 'main.synctex.gz')), 'main.tex');
  const linea = (t) => doc.texto.split('\n').findIndex((l) => l.includes(t)) + 1;
  const lPar = linea('Párrafo de la segunda sección'), sitio = idx.posicion(lPar);
  panel.recibidos.length = 0;
  await panel.decir({ tipo: 'vista', pagina: sitio.pagina, y: sitio.arriba + 2 });
  const rev = aparte.revelado[aparte.revelado.length - 1];
  comprobar('el texto sigue al PDF (línea del párrafo arriba)', rev && rev.linea === lPar && rev.tipo === v.TextEditorRevealType.AtTop, JSON.stringify(rev));
  comprobar('banda en el párrafo que se lee', aparte.deco.length === 1 && aparte.deco[0] === lPar, JSON.stringify(aparte.deco));
  comprobar('lo movido por el PDF no se devuelve al PDF', !panel.recibidos.some((m) => m.tipo === 'ir'));

  // ---- doble clic
  const lItem = linea('Primer elemento de la lista'), sItem = idx.posicion(lItem);
  await panel.decir({ tipo: 'dobleClic', pagina: sItem.pagina, y: sItem.y - 2, x: 200 });
  comprobar('doble clic: cursor en esa línea del texto', aparte.seleccion === lItem, `${aparte.seleccion} ≠ ${lItem}`);

  // ---- clic en el texto → marca en el PDF
  panel.recibidos.length = 0;
  oyentes.seleccion.forEach((f) => f({ textEditor: aparte, kind: v.TextEditorSelectionChangeKind.Mouse, selections: [{ active: { line: lItem - 1 } }] }));
  const marca = panel.recibidos.find((m) => m.tipo === 'marca');
  comprobar('clic en el texto: se marca en el PDF', marca && marca.pagina === sItem.pagina && marca.abajo > marca.arriba, JSON.stringify(marca));

  // ---- en los dos sentidos: al mover el texto, el PDF va
  sim.guardado.workspace['tcee.revisarSentido'] = 'ambos';
  await pausa(450);   // pasa el tiempo en que se ignora lo movido por el PDF
  panel.recibidos.length = 0;
  aparte.visibleRanges = [new Range(lItem - 1, 0, lItem + 30, 0)];
  oyentes.rangos.forEach((f) => f({ textEditor: aparte, visibleRanges: aparte.visibleRanges }));
  await pausa(120);
  const ir = panel.recibidos.find((m) => m.tipo === 'ir');
  comprobar('en los dos sentidos: el PDF sigue al texto', ir && ir.pagina === sItem.pagina && Math.abs(ir.y - sItem.arriba) < 1, JSON.stringify(ir));
  sim.guardado.workspace['tcee.revisarSentido'] = 'pdf';

  // ---- el usuario mueve un párrafo y compila: aviso de PDF nuevo; el PDF visto no cambia
  const viejo = doc.texto;
  const parrafo = viejo.split('\n').find((l) => l.startsWith('Párrafo de la segunda sección'));
  doc.texto = viejo.replace(`${parrafo}\n`, '').replace('\\section{Primera sección}\n', `\\section{Primera sección}\n${parrafo}\n\n`);
  oyentes.texto.forEach((f) => f({ document: doc }));
  await pausa(600);
  // con el texto cambiado (sin compilar), el PDF viejo sigue llevando al párrafo en su sitio nuevo
  panel.recibidos.length = 0;
  await pausa(450);
  await panel.decir({ tipo: 'vista', pagina: sitio.pagina, y: sitio.arriba + 2 });
  const rev2 = aparte.revelado[aparte.revelado.length - 1];
  comprobar('párrafo movido sin compilar: el texto va a su sitio nuevo', rev2 && rev2.linea === linea('Párrafo de la segunda sección'), `${rev2 && rev2.linea} ≠ ${linea('Párrafo de la segunda sección')}`);
  fs.writeFileSync(TEX, doc.texto);
  await pausa(1100);   // el PDF nuevo tiene que ser más reciente que el visto
  try { compilar(); } catch (e) { /* */ }
  oyentes.vigias.forEach((w) => w.cambio.forEach((f) => f()));
  comprobar('aviso de PDF nuevo (no se carga solo)', panel.recibidos.some((m) => m.tipo === 'nuevo' && m.hay) && !panel.recibidos.some((m) => m.tipo === 'cargar'));

  // ---- Actualizar: PDF nuevo en el mismo sitio (el mismo párrafo)
  panel.recibidos.length = 0;
  await panel.decir({ tipo: 'actualizar' });
  const c2 = panel.recibidos.find((m) => m.tipo === 'cargar');
  const idx2 = leer(fs.readFileSync(path.join(dirTema, '.build', 'main.synctex.gz')), 'main.tex');
  const s2 = idx2.posicion(linea('Párrafo de la segunda sección'));
  comprobar('Actualizar: carga el PDF nuevo', !!c2);
  comprobar('Actualizar: sigue en el mismo párrafo (en su sitio nuevo)', c2 && c2.posicion && c2.posicion.pagina === s2.pagina && Math.abs(c2.posicion.y - (s2.arriba + 2)) < 1.5, `${JSON.stringify(c2 && c2.posicion)} vs ${s2.pagina}/${(s2.arriba + 2).toFixed(1)}`);

  // ---- Actualizar con el tema cambiado: pregunta; «Actualizar con el PDF que hay» no compila
  doc.isDirty = true; respuestaModal = 'Actualizar con el PDF que hay'; sim.mensajes.length = 0;
  await panel.decir({ tipo: 'actualizar' });
  comprobar('Actualizar con cambios sin compilar: pregunta antes', sim.mensajes.some((t) => /anterior a tus últimos cambios/.test(t)));
  doc.isDirty = false;

  // ---- cerrar: se cierra la copia del texto (y con ella la ventana aparte)
  const gruposAntes = sim.grupos.length;
  panel.dispose();
  await pausa(10);
  comprobar('al cerrar se cierra la copia del texto de la ventana aparte', sim.grupos.length === gruposAntes - 1 && sim.grupos[0].tabs.length === 1, `grupos ${gruposAntes} → ${sim.grupos.length}`);
  comprobar('y se quita la banda', editores.every((e) => !e.deco.length));

  fs.rmSync(raiz, { recursive: true, force: true });
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
