// Panel TCEE para VS Code: acciones (arriba) e índice del tema (abajo)
'use strict';
const vscode = require('vscode');
const { codigoTema, tituloTema, indiceTema } = require('./parser');

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
      this._ev.fire();
      return;
    }
    let texto;
    const abierto = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    try {
      texto = abierto ? abierto.getText() : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    } catch (e) {
      texto = '';
    }
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
  context.subscriptions.push(vscode.window.createTreeView('tcee.acciones', { treeDataProvider: acciones }));
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
}

function deactivate() {}
module.exports = { activate, deactivate };
