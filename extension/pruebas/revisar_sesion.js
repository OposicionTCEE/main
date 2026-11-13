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
  const tipos = [];   // decoraciones creadas: la 1.ª es la banda; la 2.ª, el atenuado
  const evento = (lista) => (f) => { lista.push(f); return { dispose() { lista.splice(lista.indexOf(f), 1); } }; };
  Object.assign(v.window, {
    onDidChangeTextEditorVisibleRanges: evento(oyentes.rangos), onDidChangeTextEditorSelection: evento(oyentes.seleccion),
    createTextEditorDecorationType: (o) => { const t = { o, dispose() {} }; tipos.push(t); return t; },
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
  const doc = { uri, isDirty: false, texto: fs.readFileSync(TEX, 'utf8'), getText() { return this.texto; }, save: async () => true, version: 1,
    lineAt(i) { return { text: this.texto.split('\n')[i] }; }, get lineCount() { return this.texto.split('\n').length; } };
  v.workspace.openTextDocument = async () => doc;
  const editores = [];
  function nuevoEditor(grupo) {
    const ed = { document: doc, viewColumn: grupo.viewColumn, grupo, visibleRanges: [new Range(0, 0, 40, 0)], decos: new Map(), revelado: [],
      revealRange(r, tipo) { this.revelado.push({ linea: r.start.line + 1, car: r.start.character, tipo }); if (tipo === v.TextEditorRevealType.AtTop) this.visibleRanges = [new Range(r.start.line, r.start.character, r.start.line + 40, 0)]; oyentes.rangos.forEach((f) => f({ textEditor: this, visibleRanges: this.visibleRanges })); },
      setDecorations(t, rs) { this.decos.set(t, rs); },
      get deco() { return (this.decos.get(tipos[0]) || []).map((r) => r.start.line + 1); },
      get atenuado() { return (this.decos.get(tipos[1]) || []).map((r) => [r.start.line + 1, r.end.line + 1]); } };
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

  comprobar('activa el desplazamiento suave de VS Code para los .tex', sim.guardado.workspace['editor.smoothScrolling'] === true);
  await panel.decir({ tipo: 'listo' });
  const cargar = panel.recibidos.find((m) => m.tipo === 'cargar');
  comprobar('manda el PDF al visor', cargar && cargar.datos.length > 1000 && /^\d\d\/\d\d \d\d:\d\d$/.test(cargar.fecha), cargar && cargar.fecha);
  comprobar('lo abre donde se leía el texto (línea 30)', cargar && cargar.posicion && cargar.posicion.pagina >= 1, JSON.stringify(cargar && cargar.posicion));
  const modo = panel.recibidos.find((m) => m.tipo === 'modo');
  comprobar('dice el modo (PDF → texto, sigue al parar, atenuar)', modo && modo.sentido.titulo === 'PDF → texto' && modo.seguimiento.titulo === 'Sigue: al parar' && modo.atenuar === true, JSON.stringify(modo));
  comprobar('sin aviso (copia del .tex y SyncTeX al día)', cargar && !cargar.aviso, cargar && cargar.aviso);

  const { leer } = require('../synctex');
  const idx = leer(fs.readFileSync(path.join(dirTema, '.build', 'main.synctex.gz')), 'main.tex');
  const linea = (t) => doc.texto.split('\n').findIndex((l) => l.includes(t)) + 1;
  const ultimo = () => aparte.revelado[aparte.revelado.length - 1];
  const W = sim.guardado.workspace;

  // ---- continuo: el texto sigue al momento, por el borde de arriba
  W['tcee.revisarSeguimiento'] = 'continuo';
  const lPar = linea('Primera sección') + 1, filas = idx.filas(lPar), sitio = filas[0];   // el primer párrafo, de varios renglones
  panel.recibidos.length = 0;
  await panel.decir({ tipo: 'vista', pagina: sitio.pagina, y: sitio.arriba + 1 });
  comprobar('el texto pone arriba el párrafo de arriba del PDF', ultimo() && ultimo().linea === lPar && ultimo().car === 0 && ultimo().tipo === v.TextEditorRevealType.AtTop, JSON.stringify(ultimo()));
  comprobar('banda en ese párrafo', aparte.deco.length === 1 && aparte.deco[0] === lPar, JSON.stringify(aparte.deco));
  comprobar('lo movido por el PDF no se devuelve al PDF', !panel.recibidos.some((m) => m.tipo === 'ir'));
  // a mitad del párrafo (tercer renglón): el texto baja dentro del párrafo, empezando en palabra
  await panel.decir({ tipo: 'vista', pagina: filas[2].pagina, y: filas[2].arriba + 1 });
  const t = doc.lineAt(lPar - 1).text, r3 = ultimo();
  comprobar('renglón a renglón: dentro del párrafo, en proporción', r3.linea === lPar && r3.car > t.length * 0.3 && r3.car < t.length * 0.8, `${r3.car} de ${t.length}`);
  comprobar('…y empezando en palabra', r3.car > 0 && t[r3.car - 1] === ' ', JSON.stringify(t.slice(r3.car - 3, r3.car + 5)));
  // la cabecera de una página cuenta como lo primero de su cuerpo (no como la línea en que TeX cerró la página)
  const pag2 = idx.paginas()[1];
  await panel.decir({ tipo: 'vista', pagina: pag2, y: 20 });
  const enCabecera = ultimo().linea;
  await panel.decir({ tipo: 'vista', pagina: pag2 - 1, y: 790 });   // el pie de la página anterior: también lo primero de la siguiente
  comprobar('cabecera y pie: lo primero del cuerpo de la página', enCabecera === ultimo().linea && enCabecera < linea('Tercera sección'), `${enCabecera} / ${ultimo().linea}`);

  // ---- al parar: no se mueve hasta medio segundo sin desplazarse
  W['tcee.revisarSeguimiento'] = 'alParar';
  let n = aparte.revelado.length;
  await panel.decir({ tipo: 'vista', pagina: sitio.pagina, y: sitio.arriba + 1 });
  await pausa(200);
  const quieto = aparte.revelado.length === n;
  await pausa(400);
  comprobar('al parar: quieto mientras te desplazas y luego va', quieto && aparte.revelado.length === n + 1 && ultimo().linea === lPar, `${quieto} ${aparte.revelado.length - n}`);

  // ---- al cambiar de lado: no se mueve hasta que el ratón sale del PDF
  W['tcee.revisarSeguimiento'] = 'alCambiar';
  await panel.decir({ tipo: 'raton', dentro: true });
  n = aparte.revelado.length;
  await panel.decir({ tipo: 'vista', pagina: filas[2].pagina, y: filas[2].arriba + 1 });
  await pausa(600);
  const quieto2 = aparte.revelado.length === n;
  await panel.decir({ tipo: 'raton', dentro: false });
  comprobar('al cambiar de lado: quieto hasta sacar el ratón del PDF', quieto2 && aparte.revelado.length === n + 1 && ultimo().car > 0, `${quieto2} ${aparte.revelado.length - n}`);

  // ---- atenuar: el lado sin ratón
  panel.recibidos.length = 0;
  await panel.decir({ tipo: 'raton', dentro: true });
  const at = aparte.atenuado;
  comprobar('ratón en el PDF: el texto se atenúa, menos el párrafo de la banda', at.length === 2 && at[0][1] === lPar - 1 && at[1][0] === lPar + 1, JSON.stringify(at));
  comprobar('…y el PDF no', panel.recibidos.some((m) => m.tipo === 'atenuar' && m.si === false));
  panel.recibidos.length = 0;
  await panel.decir({ tipo: 'raton', dentro: false });
  comprobar('ratón fuera del PDF: el PDF se atenúa y el texto no', !aparte.atenuado.length && panel.recibidos.some((m) => m.tipo === 'atenuar' && m.si === true));
  W['tcee.revisarAtenuar'] = false;
  await panel.decir({ tipo: 'raton', dentro: true });
  comprobar('sin atenuar (ajuste apagado)', !aparte.atenuado.length);
  W['tcee.revisarAtenuar'] = true;
  W['tcee.revisarSeguimiento'] = 'continuo';

  // ---- doble clic
  const lItem = linea('Primer elemento de la lista'), sItem = idx.posicion(lItem);
  await panel.decir({ tipo: 'dobleClic', pagina: sItem.pagina, y: sItem.y - 2, x: 200 });
  comprobar('doble clic: cursor en esa línea del texto', aparte.seleccion === lItem, `${aparte.seleccion} ≠ ${lItem}`);

  // ---- clic en el texto → marca en el PDF
  panel.recibidos.length = 0;
  oyentes.seleccion.forEach((f) => f({ textEditor: aparte, kind: v.TextEditorSelectionChangeKind.Mouse, selections: [{ active: { line: lItem - 1 } }] }));
  const marca = panel.recibidos.find((m) => m.tipo === 'marca');
  comprobar('clic en el texto: se marca en el PDF', marca && marca.pagina === sItem.pagina && marca.abajo > marca.arriba, JSON.stringify(marca));

  // ---- en los dos sentidos: al mover el texto, el PDF va (por el borde de arriba, renglón a renglón)
  W['tcee.revisarSentido'] = 'ambos';
  await pausa(550);   // pasa el tiempo en que se ignora lo movido por el PDF
  panel.recibidos.length = 0;
  aparte.visibleRanges = [new Range(lPar - 1, 0, lPar + 30, 0)];
  oyentes.rangos.forEach((f) => f({ textEditor: aparte, visibleRanges: aparte.visibleRanges }));
  await pausa(120);
  let ir = panel.recibidos.find((m) => m.tipo === 'ir');
  comprobar('en los dos sentidos: el PDF pone arriba el párrafo de arriba del texto', ir && ir.pagina === filas[0].pagina && Math.abs(ir.y - filas[0].arriba) < 1, JSON.stringify(ir));
  panel.recibidos.length = 0;
  aparte.visibleRanges = [new Range(lPar - 1, Math.floor(t.length * 0.6), lPar + 30, 0)];
  oyentes.rangos.forEach((f) => f({ textEditor: aparte, visibleRanges: aparte.visibleRanges }));
  await pausa(120);
  ir = panel.recibidos.find((m) => m.tipo === 'ir');
  comprobar('…y dentro del párrafo, el renglón que toca', ir && ir.y > filas[1].arriba, JSON.stringify(ir));
  W['tcee.revisarSentido'] = 'pdf';

  // ---- el usuario mueve un párrafo y compila: aviso de PDF nuevo; el PDF visto no cambia
  const viejo = doc.texto;
  const lMov = linea('Párrafo de la segunda sección'), sMov = idx.posicion(lMov);
  const parrafo = viejo.split('\n')[lMov - 1];
  doc.texto = viejo.replace(`${parrafo}\n`, '').replace('\\section{Primera sección}\n', `\\section{Primera sección}\n${parrafo}\n\n`);
  oyentes.texto.forEach((f) => f({ document: doc }));
  await pausa(600);
  await pausa(450);
  await panel.decir({ tipo: 'vista', pagina: sMov.pagina, y: sMov.arriba + 1 });
  comprobar('párrafo movido sin compilar: el texto va a su sitio nuevo', ultimo().linea === linea('Párrafo de la segunda sección'), `${ultimo().linea} ≠ ${linea('Párrafo de la segunda sección')}`);
  fs.writeFileSync(TEX, doc.texto);
  await pausa(1100);   // el PDF nuevo tiene que ser más reciente que el visto
  try { compilar(); } catch (e) { /* */ }
  panel.recibidos.length = 0;
  oyentes.vigias.forEach((w) => w.cambio.forEach((f) => f()));
  comprobar('aviso de PDF nuevo (no se carga solo)', panel.recibidos.some((m) => m.tipo === 'nuevo' && m.hay) && !panel.recibidos.some((m) => m.tipo === 'cargar'));

  // ---- Actualizar: PDF nuevo en el mismo sitio (el mismo párrafo)
  panel.recibidos.length = 0;
  await panel.decir({ tipo: 'actualizar' });
  const c2 = panel.recibidos.find((m) => m.tipo === 'cargar');
  const idx2 = leer(fs.readFileSync(path.join(dirTema, '.build', 'main.synctex.gz')), 'main.tex');
  const f2 = idx2.filas(linea('Párrafo de la segunda sección'))[0];
  comprobar('Actualizar: carga el PDF nuevo', !!c2);
  comprobar('Actualizar: sigue en el mismo párrafo (en su sitio nuevo)', c2 && c2.posicion && c2.posicion.pagina === f2.pagina && Math.abs(c2.posicion.y - f2.arriba) < 3, `${JSON.stringify(c2 && c2.posicion)} vs ${f2.pagina}/${f2.arriba.toFixed(1)}`);

  // ---- Actualizar con el tema cambiado: pregunta; «Actualizar con el PDF que hay» no compila
  doc.isDirty = true; respuestaModal = 'Actualizar con el PDF que hay'; sim.mensajes.length = 0;
  await panel.decir({ tipo: 'actualizar' });
  comprobar('Actualizar con cambios sin compilar: pregunta antes', sim.mensajes.some((x) => /anterior a tus últimos cambios/.test(x)));
  doc.isDirty = false;

  // ---- cerrar: se cierra la copia del texto (y con ella la ventana aparte)
  const gruposAntes = sim.grupos.length;
  panel.dispose();
  await pausa(10);
  comprobar('al cerrar se cierra la copia del texto de la ventana aparte', sim.grupos.length === gruposAntes - 1 && sim.grupos[0].tabs.length === 1, `grupos ${gruposAntes} → ${sim.grupos.length}`);
  comprobar('y se quitan la banda y el atenuado', editores.every((e) => !e.deco.length && !e.atenuado.length));

  fs.rmSync(raiz, { recursive: true, force: true });
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
