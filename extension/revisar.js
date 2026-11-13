// «Revisar» (acción de la barra lateral y ⌘⌥E): ventana aparte con el main.tex a la izquierda y su PDF a la derecha, con el
// desplazamiento sincronizado. Reglas y razonamiento: main/REVISAR.md.
//
// - Foto fija: al abrir se leen a la vez el PDF, su SyncTeX y la copia del .tex con que se compiló (.build/main.fuente.tex, que deja
//   scripts/compilar.sh). El PDF que se ve no cambia aunque se compile de nuevo: «Actualizar» toma otra foto y sigue en el mismo sitio.
// - Las líneas del PDF (las de la copia) se traducen a las del texto de ahora por contenido (mapaLineas.js): los párrafos movidos se siguen.
// - Sentido (ajuste tcee.revisarSentido): el PDF manda (por defecto), en los dos sentidos o sin sincronizar. Lo que mueve uno por orden
//   del otro no se devuelve (si no, se perseguirían). Doble clic en el PDF: el cursor del texto a esa línea. Clic en el texto: se señala en el PDF.
// - Banda de lectura (ajuste tcee.revisarBanda): en el texto, el párrafo que corresponde al punto de lectura del PDF.
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { leer: leerSynctex } = require('./synctex');
const { crearMapa } = require('./mapaLineas');
const { html } = require('./revisarHtml');

const SENTIDOS = {
  pdf: { titulo: 'PDF → texto', ayuda: 'El PDF manda: al moverte por el PDF, el texto lo sigue. Pulsa para cambiar (también en Ajustes)' },
  ambos: { titulo: 'PDF ⇄ texto', ayuda: 'En los dos sentidos: el que muevas manda. Pulsa para cambiar (también en Ajustes)' },
  no: { titulo: 'Sin sincronizar', ayuda: 'Se mueven por separado; el doble clic en el PDF sigue llevando el cursor al texto. Pulsa para cambiar' },
};
const ORDEN = ['pdf', 'ambos', 'no'];
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
async function esperar(cond, ms) { const fin = Date.now() + ms; for (;;) { const r = cond(); if (r) return r; if (Date.now() > fin) return null; await pausa(100); } }
const fechaCorta = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
/** Líneas que no dicen nada en el PDF (en blanco, cierres): SyncTeX a veces da una de estas por el párrafo de encima */
const vacia = (l) => /^\s*(%.*)?$|^\s*(\}|\\end\{[^}]*\}|\\(clear|new)page|\\par|\\medskip|\\bigskip|\\smallskip|\\vspace\*?\{[^}]*\})\s*(%.*)?$/.test(l || '');

function crearRevisar(context, { codigoTema, temaMostrado }) {
  let s = null;   // la revisión abierta (una cada vez)
  let salida = null;
  const log = (t) => { if (!salida) salida = vscode.window.createOutputChannel('Panel TCEE: Revisar'); salida.appendLine(`${new Date().toLocaleTimeString('es-ES')}  ${t}`); };
  const conf = () => vscode.workspace.getConfiguration('tcee');
  const sentido = () => (SENTIDOS[conf().get('revisarSentido')] ? conf().get('revisarSentido') : 'pdf');
  const banda = vscode.window.createTextEditorDecorationType({
    isWholeLine: true, backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.rangeHighlightForeground'), overviewRulerLane: vscode.OverviewRulerLane.Center,
  });
  context.subscriptions.push(banda, { dispose: () => { if (s) s.panel.dispose(); } });

  const rutasDe = (uri) => {
    const dir = path.dirname(uri.fsPath), b = path.join(dir, '.build');
    return { tex: uri.fsPath, build: b, pdf: path.join(b, 'main.pdf'), synctex: path.join(b, 'main.synctex.gz'), fuente: path.join(b, 'main.fuente.tex'), estado: path.join(b, 'estado') };
  };

  /** Tema a revisar: el que se pase, el del editor, el del índice o, si no, se pregunta */
  async function elegirTema(arg) {
    if (arg instanceof vscode.Uri && codigoTema(arg.fsPath)) return arg;
    const ed = vscode.window.activeTextEditor;
    if (ed && codigoTema(ed.document.uri.fsPath)) return ed.document.uri;
    const m = temaMostrado();
    if (m && codigoTema(m.fsPath)) return m;
    const uris = await vscode.workspace.findFiles('temario/Ejercicio-*/Parte-*/*/main.tex');
    const items = uris.map((u) => ({ label: codigoTema(u.fsPath), uri: u })).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
    const e = await vscode.window.showQuickPick(items, { title: 'Revisar: ¿qué tema?', placeHolder: 'Escribe el código, p. ej. 3.B.20' });
    return e ? e.uri : null;
  }

  /** ¿Compilar antes? 'compilar' | 'usar' | null (cancelado). cuando: 'abrir' o 'actualizar' */
  async function decidir(doc, r, codigo, cuando) {
    if (!fs.existsSync(r.pdf)) {
      const b = await vscode.window.showInformationMessage(`${codigo} aún no tiene PDF`, { modal: true, detail: 'Para revisarlo hay que compilarlo primero.' }, 'Compilar y revisar');
      return b ? 'compilar' : null;
    }
    const atrasado = doc.isDirty || mtime(r.tex) > mtime(r.pdf) + 1000;
    if (!atrasado) return 'usar';
    const [si, no] = cuando === 'abrir' ? ['Compilar y revisar', 'Revisar el PDF que hay'] : ['Compilar y actualizar', 'Actualizar con el PDF que hay'];
    const b = await vscode.window.showInformationMessage(`El PDF de ${codigo} es anterior a tus últimos cambios`, {
      modal: true, detail: cuando === 'abrir'
        ? '¿Compilar antes de revisar, o revisar el PDF que hay? Mientras revisas, el PDF no cambia solo: pulsa «Actualizar» cuando quieras el nuevo.'
        : '¿Compilar antes, o traer el último PDF compilado tal como está?',
    }, si, no);
    return b === si ? 'compilar' : b === no ? 'usar' : null;
  }

  /** Compila con LaTeX Workshop (como «Compilar tema») y espera a que scripts/compilar.sh escriba .build/estado. true si hay PDF nuevo */
  async function compilar(doc, r, codigo, columna = vscode.ViewColumn.One) {
    const antes = mtime(r.estado);
    await vscode.window.showTextDocument(doc, { viewColumn: columna, preview: false, preserveFocus: false });   // LaTeX Workshop compila el documento activo
    await doc.save();
    vscode.commands.executeCommand('latex-workshop.build').then(undefined, (e) => log(`latex-workshop.build: ${e.message}`));
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Compilando ${codigo} para revisar…`, cancellable: true }, async (_, cancelar) => {
      const listo = await esperar(() => cancelar.isCancellationRequested || mtime(r.estado) > antes, 10 * 60 * 1000);
      if (!listo || cancelar.isCancellationRequested) return false;
      let est = ''; try { est = fs.readFileSync(r.estado, 'utf8').trim(); } catch (e) { /* */ }
      if (est !== 'ok') vscode.window.showWarningMessage(`La compilación de ${codigo} ha fallado: se revisa el último PDF que compiló bien.`);
      return est === 'ok';
    });
  }

  /** Foto fija: PDF, SyncTeX y el .tex con que se compiló, leídos juntos (si se compila mientras tanto, se repite) */
  function tomarFoto(r, doc) {
    for (let intento = 0; intento < 3; intento++) {
      const t = mtime(r.pdf);
      if (!t) return null;
      const pdf = fs.readFileSync(r.pdf);
      let syn = null; try { syn = fs.readFileSync(r.synctex); } catch (e) { /* sin SyncTeX */ }
      // la copia del .tex vale si es de la misma compilación (scripts/compilar.sh la copia justo después del PDF)
      let fuente = null;
      const tf = mtime(r.fuente);
      if (tf && tf >= t - 10000) { try { fuente = fs.readFileSync(r.fuente, 'utf8'); } catch (e) { /* */ } }
      if (mtime(r.pdf) !== t) continue;
      let aproximado = false;
      if (fuente == null) {
        // PDF de antes de la v0.54 (sin copia): si el tema no ha cambiado desde entonces, el texto del disco es el del PDF
        if (!doc.isDirty && mtime(r.tex) <= t) fuente = fs.readFileSync(r.tex, 'utf8');
        else { fuente = doc.getText(); aproximado = true; }
      }
      let idx = null;
      try { idx = syn ? leerSynctex(syn, 'main.tex') : null; } catch (e) { log(`SyncTeX ilegible: ${e.message}`); }
      log(`foto: PDF del ${fechaCorta(t)} (${(pdf.length / 1e6).toFixed(1)} MB), SyncTeX ${idx ? `${idx.registros} registros` : 'no'}, copia del .tex ${aproximado ? 'no (aproximado)' : 'sí'}`);
      return { pdf, idx, fuente, lineasFuente: fuente.split('\n'), fecha: t, aproximado };
    }
    return null;
  }

  function avisoDe(foto) {
    if (!foto.idx) return 'Este PDF no tiene SyncTeX: compílalo de nuevo para sincronizar el texto y el PDF.';
    if (foto.aproximado) return 'Este PDF es de antes de la versión 0.54 del panel y el tema ha cambiado desde entonces: la correspondencia puede ir algo desplazada. Compila para que sea exacta.';
    return '';
  }

  /** El texto en una ventana aparte (copia del editor: el de la ventana principal se queda). Devuelve su grupo o null */
  async function ventanaTexto(doc) {
    // en la ventana principal (su primer grupo): si se pidió desde el Panel Oposición, no se abre el tema en su ventana
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: false, preserveFocus: false });
    const antes = new Set(vscode.window.tabGroups.all);
    const esDelTema = (t) => t.input instanceof vscode.TabInputText && t.input.uri.toString() === doc.uri.toString();
    try { await vscode.commands.executeCommand('workbench.action.copyEditorToNewWindow'); } catch (e) { log(`copyEditorToNewWindow: ${e.message}`); return null; }
    const g = await esperar(() => vscode.window.tabGroups.all.find((x) => !antes.has(x) && x.tabs.some(esDelTema)), 4000);
    log(g ? `texto en una ventana aparte (grupo ${g.viewColumn})` : 'no se pudo abrir la ventana aparte: todo en la ventana principal');
    return g || null;
  }

  // ------------------------------------------------------------------ abrir
  async function abrir(arg) {
    const uri = await elegirTema(arg);
    if (!uri) return;
    if (s && s.uri.toString() === uri.toString()) { s.panel.reveal(undefined, false); return; }
    if (s) s.panel.dispose();
    const doc = await vscode.workspace.openTextDocument(uri);
    const codigo = codigoTema(uri.fsPath), r = rutasDe(uri);
    // dónde se estaba leyendo el texto, para abrir el PDF en ese sitio
    const ed0 = vscode.window.activeTextEditor;
    const lineaInicial = ed0 && ed0.document === doc && ed0.visibleRanges.length ? ed0.visibleRanges[0].start.line + 1 : null;

    const d = await decidir(doc, r, codigo, 'abrir');
    if (!d) return;
    if (d === 'compilar') await compilar(doc, r, codigo);
    const foto = tomarFoto(r, doc);
    if (!foto) { vscode.window.showWarningMessage(`No hay PDF de ${codigo} que revisar.`); return; }

    const grupo = await ventanaTexto(doc);
    const media = vscode.Uri.joinPath(context.extensionUri, 'media'), lib = vscode.Uri.joinPath(context.extensionUri, 'lib');
    const panel = vscode.window.createWebviewPanel('tceeRevisar', `Revisar ${codigo}`, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media, lib] });
    panel.iconPath = new vscode.ThemeIcon('open-preview');
    s = { uri, doc, codigo, r, panel, foto, grupo, mapa: crearMapa(foto.fuente, doc.getText()), lineaInicial,
      vista: null, lineaLectura: null, ultimaRevelada: null, ignorarEditorHasta: 0, ultimoTop: null, subs: [] };
    log(`revisar ${codigo}: ${s.mapa.emparejadas} líneas emparejadas entre el PDF y el texto de ahora`);
    const nonce = crypto.randomBytes(16).toString('base64');
    panel.webview.html = html({ nonce, csp: panel.webview.cspSource, url: (rel) => panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...rel.split('/'))).toString() });
    conectar(s);
  }

  // ------------------------------------------------------------------ sincronización
  /** Editor del texto: el de la ventana aparte si sigue abierto; si no, cualquiera visible del tema */
  function editorTexto(x) {
    const vis = vscode.window.visibleTextEditors.filter((e) => e.document.uri.toString() === x.uri.toString());
    if (x.grupo && vscode.window.tabGroups.all.includes(x.grupo)) { const e = vis.find((v) => v.viewColumn === x.grupo.viewColumn); if (e) return e; }
    return vis[vis.length - 1] || null;
  }
  /** Línea del texto de ahora en un punto del PDF (o null) */
  function lineaEn(x, pagina, y, px) {
    if (!x.foto.idx) return null;
    let lv = x.foto.idx.linea(pagina, y, px);
    if (!lv) return null;
    // si SyncTeX da una línea vacía o de cierre, la de contenido de encima (el párrafo que se está leyendo)
    for (let k = 0; k < 6 && lv > 1 && vacia(x.foto.lineasFuente[lv - 1]); k++) lv--;
    return x.mapa.aNuevo(lv);
  }
  /** Sitio del PDF de una línea del texto de ahora (o null). Una línea vacía o de cierre lleva al párrafo de debajo (el que empieza ahí) */
  function sitioDe(x, linea) {
    if (!x.foto.idx) return null;
    let lv = x.mapa.aViejo(linea);
    for (let k = 0; k < 6 && lv < x.foto.lineasFuente.length && vacia(x.foto.lineasFuente[lv - 1]); k++) lv++;
    return x.foto.idx.posicion(lv);
  }
  function ponerBanda(x, linea) {
    for (const e of vscode.window.visibleTextEditors) if (e.document.uri.toString() === x.uri.toString()) e.setDecorations(banda, []);
    const ed = editorTexto(x);
    if (!ed || !linea || conf().get('revisarBanda', true) === false || sentido() === 'no') return;
    ed.setDecorations(banda, [new vscode.Range(linea - 1, 0, linea - 1, 0)]);
  }
  const enviar = (x, m) => x.panel.webview.postMessage(m);
  const enviarSentido = (x) => enviar(x, { tipo: 'sentido', ...SENTIDOS[sentido()] });

  function cargarEnVisor(x, posicion) {
    const f = x.foto;
    enviar(x, { tipo: 'cargar', datos: new Uint8Array(f.pdf), fecha: fechaCorta(f.fecha), posicion, aviso: avisoDe(f) });   // copia: pdf.js se queda los bytes
  }

  function conectar(x) {
    const subs = x.subs;
    subs.push(x.panel.webview.onDidReceiveMessage(async (m) => {
      if (s !== x) return;
      if (m.tipo === 'listo') {
        // al abrir, donde se leía el texto; si la página del visor se recarga (VS Code puede hacerlo), donde estaba
        enviarSentido(x);
        const p = !x.vista && x.lineaInicial ? sitioDe(x, x.lineaInicial) : null;
        cargarEnVisor(x, x.vista || (p ? { pagina: p.pagina, y: p.arriba } : null));
      } else if (m.tipo === 'pideTrabajador') {
        enviar(x, { tipo: 'trabajador', texto: fs.readFileSync(path.join(context.extensionPath, 'lib', 'pdfjs', 'pdf.worker.min.mjs'), 'utf8') });
      } else if (m.tipo === 'vista') {
        x.vista = { pagina: m.pagina, y: m.y };
        if (sentido() === 'no') return;
        const ln = lineaEn(x, m.pagina, m.y);
        if (!ln) return;
        x.lineaLectura = ln;
        ponerBanda(x, ln);
        const ed = editorTexto(x);
        if (ed && ln !== x.ultimaRevelada) {
          x.ultimaRevelada = ln;
          x.ignorarEditorHasta = Date.now() + 400;
          ed.revealRange(new vscode.Range(ln - 1, 0, ln - 1, 0), vscode.TextEditorRevealType.AtTop);
        }
      } else if (m.tipo === 'dobleClic') {
        const ln = lineaEn(x, m.pagina, m.y, m.x);
        const ed = editorTexto(x);
        if (!ln || !ed) return;
        x.ignorarEditorHasta = Date.now() + 400;
        const r = new vscode.Range(ln - 1, 0, ln - 1, 0);
        await vscode.window.showTextDocument(ed.document, { viewColumn: ed.viewColumn, preserveFocus: false, selection: r });
        ed.revealRange(r, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        x.lineaLectura = ln; ponerBanda(x, ln);
      } else if (m.tipo === 'actualizar') {
        await actualizar(x);
      } else if (m.tipo === 'sentido') {
        const v = ORDEN[(ORDEN.indexOf(sentido()) + 1) % ORDEN.length];
        await require('./ajustes').guardar('revisarSentido', v);   // se avisa al visor al cambiar el ajuste (abajo)
      } else if (m.tipo === 'error') log(`visor: ${m.texto}`);
    }));

    // texto → PDF (solo «en los dos sentidos»), con el desplazamiento del editor; lo movido por el PDF no se devuelve
    let tTexto = null;
    subs.push(vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (s !== x || sentido() !== 'ambos' || e.textEditor !== editorTexto(x) || !e.visibleRanges.length) return;
      if (Date.now() < x.ignorarEditorHasta) return;
      clearTimeout(tTexto);
      tTexto = setTimeout(() => {
        const top = e.visibleRanges[0].start.line + 1;
        if (top === x.ultimoTop) return;
        x.ultimoTop = top;
        const p = sitioDe(x, top);
        if (p) { enviar(x, { tipo: 'ir', pagina: p.pagina, y: p.arriba }); x.lineaLectura = top; ponerBanda(x, top); }
      }, 60);
    }));
    // clic en el texto → se señala en el PDF (y se trae a la vista si no se ve)
    subs.push(vscode.window.onDidChangeTextEditorSelection((e) => {
      if (s !== x || e.kind !== vscode.TextEditorSelectionChangeKind.Mouse || e.textEditor.document.uri.toString() !== x.uri.toString()) return;
      if (sentido() === 'no') return;
      const p = sitioDe(x, e.selections[0].active.line + 1);
      if (p) enviar(x, { tipo: 'marca', pagina: p.pagina, arriba: p.arriba, abajo: p.abajo });
    }));
    // el texto cambia: se rehace la correspondencia (poco a poco: como mucho dos veces por segundo)
    let tMapa = null;
    subs.push(vscode.workspace.onDidChangeTextDocument((e) => {
      if (s !== x || e.document.uri.toString() !== x.uri.toString()) return;
      clearTimeout(tMapa);
      tMapa = setTimeout(() => { if (s === x) x.mapa = crearMapa(x.foto.fuente, x.doc.getText()); }, 500);
    }));
    // compilación nueva: se avisa en el visor (no se carga sola)
    const vigia = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(x.r.build), 'estado'));
    const alCompilar = () => { if (s === x && mtime(x.r.pdf) > x.foto.fecha + 500) enviar(x, { tipo: 'nuevo', hay: true }); };
    subs.push(vigia, vigia.onDidChange(alCompilar), vigia.onDidCreate(alCompilar));
    subs.push(vscode.workspace.onDidChangeConfiguration((e) => {
      if (s !== x) return;
      if (e.affectsConfiguration('tcee.revisarSentido')) { enviarSentido(x); ponerBanda(x, x.lineaLectura); }
      if (e.affectsConfiguration('tcee.revisarBanda')) ponerBanda(x, x.lineaLectura);
    }));

    x.panel.onDidDispose(() => {
      subs.forEach((d) => d.dispose());
      for (const e of vscode.window.visibleTextEditors) if (e.document.uri.toString() === x.uri.toString()) e.setDecorations(banda, []);
      // se cierra la copia del texto de la ventana aparte (si no tiene cambios sin guardar): la ventana se cierra sola si queda vacía
      if (x.grupo && vscode.window.tabGroups.all.includes(x.grupo)) {
        const t = x.grupo.tabs.find((y) => y.input instanceof vscode.TabInputText && y.input.uri.toString() === x.uri.toString());
        if (t && !t.isDirty) vscode.window.tabGroups.close(t, true).then(undefined, () => {});
      }
      if (s === x) s = null;
      log(`revisión de ${x.codigo} cerrada`);
    });
  }

  /** Nueva foto (compilando antes si hace falta y se quiere) sin perder el sitio */
  async function actualizar(x) {
    const d = await decidir(x.doc, x.r, x.codigo, 'actualizar');
    if (!d || s !== x) return;
    if (d === 'compilar') { const ed = editorTexto(x); await compilar(x.doc, x.r, x.codigo, ed ? ed.viewColumn : vscode.ViewColumn.One); }
    if (mtime(x.r.pdf) <= x.foto.fecha && d !== 'compilar') { vscode.window.showInformationMessage('Ya estás viendo el último PDF compilado.'); enviar(x, { tipo: 'nuevo', hay: false }); return; }
    // dónde se está: línea del texto de ahora y cuánto se ha bajado dentro de ella (para quedar igual en el PDF nuevo)
    let linea = null, dentro = 0;
    if (x.vista && x.foto.idx) {
      linea = lineaEn(x, x.vista.pagina, x.vista.y);
      const p = linea && sitioDe(x, linea);
      if (p && p.pagina === x.vista.pagina) dentro = x.vista.y - p.arriba;
    }
    const foto = tomarFoto(x.r, x.doc);
    if (!foto || s !== x) return;
    x.foto = foto;
    x.mapa = crearMapa(foto.fuente, x.doc.getText());
    x.ultimaRevelada = null;
    const p = linea ? sitioDe(x, linea) : null;
    cargarEnVisor(x, p ? { pagina: p.pagina, y: p.arriba + dentro } : x.vista);
  }

  return { abrir };
}

module.exports = { crearRevisar };
