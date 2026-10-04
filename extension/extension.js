// Panel TCEE para VS Code: acciones (arriba) e índice del tema (abajo)
'use strict';
const vscode = require('vscode');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { codigoTema, tituloTema, indiceTema } = require('./parser');
const G = require('./progreso');

// ---------------------------------------------------------------- Progreso (repositorio privado "progreso")
// Cada Mac escribe solo su fichero progreso/equipos/<equipo>.json; el tiempo restante se calcula con todos.
// Si la carpeta progreso no existe todavía, los datos se guardan en VS Code y se pasan al fichero en cuanto aparece.
const MINUTOS_SIN_TECLEAR = 5;   // pasado este tiempo sin escribir, el cronómetro se para solo
class Progreso {
  constructor(context) {
    this.ctx = context;
    const raiz = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    this.dir = raiz ? path.join(raiz.uri.fsPath, 'progreso') : null;
    this.equipo = os.hostname().replace(/\.local$/, '').replace(/[^A-Za-z0-9_-]+/g, '-') || 'mac';
    this.mio = context.globalState.get('tcee.progreso', { temas: {} });
    const enDisco = this.leer(this.fichero());
    if (enDisco) this.mio = this.fusionar(enDisco, this.mio);
  }
  hayCarpeta() { return this.dir && fs.existsSync(path.join(this.dir, '.git')); }
  fichero() { return this.dir ? path.join(this.dir, 'equipos', `${this.equipo}.json`) : null; }
  leer(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
  // une lo guardado en disco con lo guardado en VS Code (por si se trabajó sin la carpeta)
  fusionar(a, b) {
    const r = { temas: { ...a.temas } };
    for (const [c, d] of Object.entries(b.temas || {})) {
      const x = r.temas[c] || {};
      r.temas[c] = {
        minutos: Math.max(x.minutos || 0, d.minutos || 0),
        unidades: Math.max(x.unidades || 0, d.unidades || 0),
        base: x.base != null ? x.base : d.base,
        hecho: !x.hecho || (d.hecho && d.hecho.fecha > x.hecho.fecha) ? d.hecho || x.hecho : x.hecho,
      };
    }
    return r;
  }
  tema(c) { return this.mio.temas[c] || (this.mio.temas[c] = { minutos: 0, unidades: 0 }); }
  guardar() {
    this.ctx.globalState.update('tcee.progreso', this.mio);
    if (!this.hayCarpeta()) return;
    try {
      fs.mkdirSync(path.dirname(this.fichero()), { recursive: true });
      fs.writeFileSync(this.fichero(), JSON.stringify(this.mio, null, 1) + '\n');
    } catch (e) { /* se reintenta en el siguiente guardado */ }
  }
  todos() {
    const lista = [this.mio];
    if (this.hayCarpeta()) {
      const d = path.join(this.dir, 'equipos');
      try {
        for (const f of fs.readdirSync(d)) {
          if (f.endsWith('.json') && f !== `${this.equipo}.json`) { const x = this.leer(path.join(d, f)); if (x) lista.push(x); }
        }
      } catch (e) { /* sin otros equipos */ }
    }
    return G.combinar(lista);
  }
  /** Calcula pendientes y estimación del tema; fija la línea base la primera vez que se mide */
  calcular(codigo, uri, texto) {
    const estado = (() => { try { return fs.readFileSync(path.join(path.dirname(uri.fsPath), '.build', 'estado'), 'utf8').trim(); } catch (e) { return null; } })();
    const p = G.pendientes(texto, estado);
    const comb = this.todos();
    if (!comb.temas[codigo] || comb.temas[codigo].base == null) { this.tema(codigo).base = p.otros; this.guardar(); }
    const datos = this.todos();
    return { p, e: G.estimar(p, datos.temas[codigo], datos.ritmo), ritmo: G.ritmo(datos.ritmo) };
  }
  hecho(codigo) { const t = this.todos().temas[codigo]; return !!(t && t.hecho && t.hecho.valor); }
  marcar(codigo, valor) { this.tema(codigo).hecho = { valor, fecha: new Date().toISOString() }; this.guardar(); }
  sumar(codigo, minutos, unidades) {
    const t = this.tema(codigo);
    t.minutos = Math.round(((t.minutos || 0) + minutos) * 10) / 10;
    t.unidades = Math.round(((t.unidades || 0) + unidades) * 100) / 100;
    this.guardar();
  }
}

async function textoDe(uri) {
  const abierto = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (abierto) return abierto.getText();
  try { return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'); } catch (e) { return ''; }
}

// ---------------------------------------------------------------- Acciones (panel superior)
class Acciones {
  constructor() { this._ev = new vscode.EventEmitter(); this.onDidChangeTreeData = this._ev.event; }
  getTreeItem(e) { return e; }
  getChildren() {
    const item = (label, icono, command, tooltip) => {
      const t = new vscode.TreeItem(label);
      t.iconPath = new vscode.ThemeIcon(icono);
      t.command = { command, title: label };
      t.tooltip = tooltip;
      return t;
    };
    return [
      item('Compilar tema', 'play', 'tcee.compilar', 'Compila el tema que se muestra en el índice (⌘⌥B)'),
      item('Sincronizar con GitHub', 'sync', 'tcee.sincronizar', 'Guarda, trae y sube los cambios de main y temario'),
    ];
  }
}

// ---------------------------------------------------------------- Índice (panel inferior)
class Indice {
  constructor() {
    this._ev = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._ev.event;
    this.actual = null;   // Uri del último tema en el que se ha estado
    this.fijado = null;   // Uri fijada con 📌
    this.nodos = [];
    this.view = null;
  }
  get mostrado() { return this.fijado || this.actual; }

  async refrescar() {
    const uri = this.mostrado;
    if (!this.view) return;
    if (!uri) {
      this.nodos = [];
      this.view.title = 'Índice';
      this.view.description = '';
      this.view.message = 'Abre el main.tex de un tema para ver su índice.';
      if (this.alRefrescar) this.alRefrescar(null, '');
      this._ev.fire();
      return;
    }
    const texto = await textoDe(uri);
    if (this.alRefrescar) this.alRefrescar(uri, texto);
    const codigo = codigoTema(uri.fsPath) || '';
    const titulo = tituloTema(texto);
    this.nodos = indiceTema(texto).map((n) => ({ ...n, uri }));
    // id estable por epígrafe (número + título): mantiene el estado plegado/desplegado entre ediciones
    const usados = new Map();
    const pon = (lista) => lista.forEach((n) => {
      n.uri = uri;
      const base = `${codigo}|${n.numero || '*'}|${n.titulo}`;
      const k = (usados.get(base) || 0) + 1; usados.set(base, k);
      n.id = k > 1 ? `${base}|${k}` : base;
      pon(n.hijos);
    });
    pon(this.nodos);
    this.view.title = (titulo && titulo.corto) || codigo || 'Índice';
    this.view.description = codigo + (this.fijado ? '  📌' : '');
    this.view.message = undefined; // sin subtítulo: solo el título del tema
    this._ev.fire();
  }

  getTreeItem(n) {
    const t = new vscode.TreeItem(
      `${n.numero ? n.numero + '  ' : ''}${n.titulo}`,
      n.hijos.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );
    t.id = n.id;
    if (n.vacio) { t.iconPath = new vscode.ThemeIcon('circle-large-outline'); t.description = 'vacío'; }
    t.tooltip = `${n.numero} ${n.titulo}${n.vacio ? '\n(sin contenido todavía)' : ''}\nLínea ${n.linea + 1}`;
    t.command = { command: 'tcee.irA', title: 'Ir', arguments: [n.uri, n.linea] };
    return t;
  }
  getChildren(n) { return n ? n.hijos : this.nodos; }
}

function esTema(doc) { return doc && doc.uri.scheme === 'file' && codigoTema(doc.uri.fsPath); }

function activate(context) {
  const acciones = new Acciones();
  const indice = new Indice();
  const vistaAcciones = vscode.window.createTreeView('tcee.acciones', { treeDataProvider: acciones });
  context.subscriptions.push(vistaAcciones);
  const progreso = new Progreso(context);

  // ---- Tiempo restante: en la cabecera de Acciones, fijo; botón ✓ Hecho al lado
  let ultimo = null; // {codigo, p, e, ritmo}
  const pintar = (uri, texto) => {
    const codigo = uri && codigoTema(uri.fsPath);
    if (!codigo) { ultimo = null; vistaAcciones.title = 'Acciones'; vscode.commands.executeCommand('setContext', 'tcee.hayTema', false); return; }
    const r = progreso.calcular(codigo, uri, texto);
    ultimo = { codigo, ...r };
    vistaAcciones.title = `Tiempo restante: ${G.formatoTiempo(r.e.minutos)} (${r.e.pct} %)`;
    vscode.commands.executeCommand('setContext', 'tcee.hayTema', true);
    vscode.commands.executeCommand('setContext', 'tcee.hecho', r.e.hecho);
  };
  indice.alRefrescar = pintar;

  // ---- Cronómetro automático: cuenta solo con VS Code delante, un tema abierto y tecleando en él
  const ultimaEdicion = new Map();       // código → instante de la última pulsación
  let sesion = null;                     // {codigo, uri, inicio (unidades al empezar), minutos}
  let ultimoTic = Date.now();
  const cerrarSesion = async () => {
    if (!sesion) return;
    const s = sesion; sesion = null;
    if (s.minutos < 0.05) return;
    const ahora = G.pendientes(await textoDe(s.uri), null).unidades;
    progreso.sumar(s.codigo, s.minutos, Math.max(0, s.inicio - ahora));
    indice.refrescar();
  };
  const tic = async () => {
    const ahora = Date.now();
    const dt = Math.min(ahora - ultimoTic, 60000) / 60000;
    ultimoTic = ahora;
    const ed = vscode.window.activeTextEditor;
    const codigo = ed && esTema(ed.document) ? codigoTema(ed.document.uri.fsPath) : null;
    const activo = codigo && vscode.window.state.focused
      && ahora - (ultimaEdicion.get(codigo) || 0) < MINUTOS_SIN_TECLEAR * 60000
      && !progreso.hecho(codigo);
    if (!activo) { await cerrarSesion(); return; }
    if (!sesion || sesion.codigo !== codigo) {
      await cerrarSesion();
      sesion = { codigo, uri: ed.document.uri, inicio: G.pendientes(ed.document.getText(), null).unidades, minutos: 0 };
    }
    sesion.minutos += dt;
    if (sesion.minutos >= 5) { const s = sesion; await cerrarSesion(); sesion = { ...s, inicio: G.pendientes(ed.document.getText(), null).unidades, minutos: 0 }; }
  };
  const reloj = setInterval(tic, 30000);
  context.subscriptions.push({ dispose: () => { clearInterval(reloj); cerrarSesion(); } });
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
    if (!e.contentChanges.length || !esTema(e.document)) return;
    const c = codigoTema(e.document.uri.fsPath);
    if (!ultimaEdicion.has(c) || Date.now() - ultimaEdicion.get(c) > MINUTOS_SIN_TECLEAR * 60000) ultimoTic = Date.now();
    ultimaEdicion.set(c, Date.now());
  }));

  const cambiarHecho = async (valor) => {
    if (!ultimo) return;
    await cerrarSesion();
    progreso.marcar(ultimo.codigo, valor);
    indice.refrescar();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('tcee.hecho', () => cambiarHecho(true)),
    vscode.commands.registerCommand('tcee.noHecho', () => cambiarHecho(false)),
    vscode.commands.registerCommand('tcee.detalleTiempo', () => {
      if (!ultimo) { vscode.window.showInformationMessage('Abre el main.tex de un tema.'); return; }
      const { p, e, ritmo } = ultimo;
      vscode.window.showInformationMessage(
        `${ultimo.codigo}: ${G.formatoTiempo(e.minutos)} (${e.pct} %)${e.hecho ? ' · marcado como hecho' : ''}`,
        { modal: true, detail:
          `Epígrafes vacíos: ${p.vacios} de ${p.vacios + p.llenos} (sin contar Introducción, Conclusión ni Preguntas Test)\n`
          + (p.faltan ? `Tema poco desarrollado (${p.palabras} palabras en el cuerpo): se suman ${p.faltan} epígrafes\n` : '')
          + `Notas pendientes: ${p.notas}\nOJO: ${p.ojo}\n`
          + `Errores OCR/Markdown: ${p.ocr}\nSin PDF en la última compilación: ${p.sinPdf ? 'sí' : 'no'}\n\n`
          + `Tu ritmo: ${ritmo.toFixed(0)} min por unidad de trabajo`
          + (progreso.hayCarpeta() ? '' : '\n\nAviso: falta la carpeta «progreso» (tarea «Descargar el temario»). Mientras, se guarda en VS Code.') }
      );
    })
  );
  indice.view = vscode.window.createTreeView('tcee.indice', { treeDataProvider: indice, showCollapseAll: true });
  context.subscriptions.push(indice.view);

  // Regla 1: el índice sigue al tema donde está el cursor. Regla 2: si la pestaña no es un tema, se mantiene el último.
  const alCambiarEditor = (ed) => {
    if (ed && esTema(ed.document) && (!indice.actual || indice.actual.toString() !== ed.document.uri.toString())) {
      indice.actual = ed.document.uri;
      if (!indice.fijado) indice.refrescar();
    }
  };
  alCambiarEditor(vscode.window.activeTextEditor || vscode.window.visibleTextEditors.find((e) => esTema(e.document)));
  if (!indice.actual) indice.refrescar();

  let espera = null;
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(alCambiarEditor),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const m = indice.mostrado;
      if (!m || e.document.uri.toString() !== m.toString()) return;
      clearTimeout(espera);
      espera = setTimeout(() => indice.refrescar(), 600);
    }),
    vscode.workspace.onDidSaveTextDocument((d) => {
      const m = indice.mostrado;
      if (m && d.uri.toString() === m.toString()) indice.refrescar();
    }),

    vscode.commands.registerCommand('tcee.irA', async (uri, linea) => {
      const doc = await vscode.workspace.openTextDocument(uri);
      const visible = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
      const ed = await vscode.window.showTextDocument(doc, { viewColumn: visible ? visible.viewColumn : undefined, preserveFocus: false });
      const pos = new vscode.Position(linea, 0);
      ed.selection = new vscode.Selection(pos, pos);
      ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
    }),

    // Regla 3: fijar / soltar el índice
    vscode.commands.registerCommand('tcee.fijar', () => {
      if (!indice.mostrado) return;
      indice.fijado = indice.mostrado;
      vscode.commands.executeCommand('setContext', 'tcee.fijado', true);
      indice.refrescar();
    }),
    vscode.commands.registerCommand('tcee.soltar', () => {
      indice.fijado = null;
      vscode.commands.executeCommand('setContext', 'tcee.fijado', false);
      const ed = vscode.window.activeTextEditor;
      if (ed && esTema(ed.document)) indice.actual = ed.document.uri;
      indice.refrescar();
    }),
    vscode.commands.registerCommand('tcee.refrescar', () => indice.refrescar()),

    vscode.commands.registerCommand('tcee.compilar', async () => {
      const uri = indice.mostrado;
      if (!uri) { vscode.window.showInformationMessage('Abre primero el main.tex de un tema.'); return; }
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
      await doc.save();
      vscode.commands.executeCommand('latex-workshop.build');
    }),
    vscode.commands.registerCommand('tcee.sincronizar', async () => {
      await vscode.workspace.saveAll(false);
      const tareas = await vscode.tasks.fetchTasks();
      const t = tareas.find((x) => x.name === 'Sincronizar todos los temas con GitHub');
      if (t) vscode.tasks.executeTask(t);
      else vscode.window.showWarningMessage('No encuentro la tarea de sincronización. ¿Está abierto el espacio de trabajo TCEE?');
    })
  );
  vscode.commands.executeCommand('setContext', 'tcee.fijado', false);
  const vigia = vscode.workspace.createFileSystemWatcher('**/temario/**/.build/estado');
  context.subscriptions.push(vigia, vigia.onDidChange(() => indice.refrescar()), vigia.onDidCreate(() => indice.refrescar()));
}

function deactivate() {}
module.exports = { activate, deactivate };
