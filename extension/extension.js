// Panel TCEE para VS Code: acciones (arriba) e índice del tema (abajo)
'use strict';
const vscode = require('vscode');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { codigoTema, tituloTema, indiceTema } = require('./parser');
const G = require('./progreso');
const I = require('./inferencia');

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
    const r = { temas: { ...a.temas }, dias: { ...(a.dias || {}) } };
    for (const [f, d] of Object.entries(b.dias || {})) r.dias[f] = Math.max(r.dias[f] || 0, d);
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
  /** avisa a quien escuche (Panel Oposición) de que ha cambiado el progreso */
  alCambiar(f) { (this.oyentes || (this.oyentes = [])).push(f); }
  avisar() { (this.oyentes || []).forEach((f) => { try { f(); } catch (e) { /* nada */ } }); }
  /** minutos trabajados por día, sumando todos los Mac: {'2026-10-04': 95, …} */
  dias() {
    const r = {};
    const lista = [this.mio];
    if (this.hayCarpeta()) {
      try {
        for (const f of fs.readdirSync(path.join(this.dir, 'equipos'))) {
          if (f.endsWith('.json') && f !== `${this.equipo}.json`) { const x = this.leer(path.join(this.dir, 'equipos', f)); if (x) lista.push(x); }
        }
      } catch (e) { /* sin otros equipos */ }
    }
    lista.forEach((x) => Object.entries(x.dias || {}).forEach(([f, m]) => { r[f] = (r[f] || 0) + m; }));
    return r;
  }
  guardar(silencio) {
    this._todos = null;
    this.ctx.globalState.update('tcee.progreso', this.mio);
    if (!this.hayCarpeta()) return;
    try {
      fs.mkdirSync(path.dirname(this.fichero()), { recursive: true });
      fs.writeFileSync(this.fichero(), JSON.stringify(this.mio, null, 1) + '\n');
    } catch (e) { /* se reintenta en el siguiente guardado */ }
    if (!silencio) this.avisar();
  }
  /** Progreso de todos los Mac combinado. Se guarda 5 s para no releer los ficheros de los otros Mac en cada tema */
  todos() {
    if (this._todos && Date.now() - this._todos.t < 5000) return this._todos.v;
    const v = this.leerTodos();
    this._todos = { t: Date.now(), v };
    return v;
  }
  leerTodos() {
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
    return { p, ...this.estimar(codigo, p) };
  }
  /** Estimación a partir de los pendientes ya calculados (el Panel Oposición los guarda mientras el tema no cambie) */
  estimar(codigo, p) {
    const comb = this.todos();
    if (!comb.temas[codigo] || comb.temas[codigo].base == null) { this.tema(codigo).base = p.otros; this.guardar(true); }
    const datos = this.todos();
    return { e: G.estimar(p, datos.temas[codigo], datos.ritmo), ritmo: G.ritmo(datos.ritmo) };
  }
  hecho(codigo) { const t = this.todos().temas[codigo]; return !!(t && t.hecho && t.hecho.valor); }
  marcar(codigo, valor) { this.tema(codigo).hecho = { valor, fecha: new Date().toISOString() }; this.guardar(); }
  sumar(codigo, minutos, unidades) {
    const t = this.tema(codigo);
    t.minutos = Math.round(((t.minutos || 0) + minutos) * 10) / 10;
    t.unidades = Math.round(((t.unidades || 0) + unidades) * 100) / 100;
    const hoy = new Date();
    const f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    this.mio.dias = this.mio.dias || {};
    this.mio.dias[f] = Math.round(((this.mio.dias[f] || 0) + minutos) * 10) / 10;
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
      item('Sincronizar con GitHub', 'sync', 'tcee.sincronizar', 'Guarda, trae y sube los cambios de main, temario y progreso'),
      item('Nueva nota', 'note', 'tcee.nota', 'Añade una nota al final de \\modificaciones del tema que elijas'),
      item('Panel Oposición', 'dashboard', 'tcee.panelOposicion', 'Calendario, tiempo restante de todos los temas y relaciones entre temas (se abre en una ventana aparte)'),
      item('Rehacer informes', 'beaker', 'tcee.rehacerInformes', 'Comprueba qué informes de armonización (pestaña Relaciones) están desactualizados y prepara el encargo para Claude Code'),
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
  // último grupo de editores de texto usado (en la ventana principal: el Panel Oposición no es un editor de texto)
  let ultimaColumna = vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn;
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((ed) => { if (ed && ed.viewColumn) ultimaColumna = ed.viewColumn; }),
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

    // opciones.principal: desde el Panel Oposición (que vive en otra ventana) se abre en el último grupo de editores de texto
    // que usaste, es decir, en la ventana principal, y no como pestaña nueva junto al panel
    vscode.commands.registerCommand('tcee.irA', async (uri, linea, opciones) => {
      const doc = await vscode.workspace.openTextDocument(uri);
      const visible = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
      const columna = opciones && opciones.principal ? (ultimaColumna || vscode.ViewColumn.One) : (visible ? visible.viewColumn : undefined);
      const ed = await vscode.window.showTextDocument(doc, { viewColumn: columna, preserveFocus: false, preview: false });
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
  // ---- Nueva nota: texto → tema de destino (sugerido por inferencia) → ¿viene del tema abierto?
  let indiceNotas = null;           // índice de búsqueda de todos los temas (se rehace si cambia algún tema)
  const construirIndiceNotas = async () => {
    if (indiceNotas) return indiceNotas;
    const uris = await vscode.workspace.findFiles('temario/Ejercicio-*/Parte-*/*/main.tex');
    const temas = [];
    for (const u of uris) { const c = codigoTema(u.fsPath); if (c) temas.push({ codigo: c, uri: u, texto: await textoDe(u) }); }
    let familias = {};
    try {
      const raiz = vscode.workspace.workspaceFolders[0].uri.fsPath;
      familias = JSON.parse(fs.readFileSync(path.join(raiz, 'main', 'analisis', 'desarrollos.json'), 'utf8')).por_familia || {};
    } catch (e) { /* sin modelos: se infiere con el resto de reglas */ }
    indiceNotas = { ...I.construirIndice(temas, familias), uris: new Map(temas.map((t) => [t.codigo, t.uri])) };
    return indiceNotas;
  };
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((d) => { if (esTema(d)) indiceNotas = null; }));

  context.subscriptions.push(vscode.commands.registerCommand('tcee.nota', async () => {
    const abierto = indice.mostrado ? codigoTema(indice.mostrado.fsPath) : null;
    const preparando = construirIndiceNotas();   // se prepara mientras escribes
    const texto = await vscode.window.showInputBox({
      title: 'Nueva nota (1/2)',
      prompt: 'Escribe la nota. Si sabes el tema, puedes poner su código (p. ej. 3B29) y irá directo.',
      ignoreFocusOut: true,
    });
    if (!texto || !texto.trim()) return;
    const idx = await preparando;
    const recientes = context.globalState.get('tcee.notaRecientes', []);
    const sug = I.sugerir(idx, texto, { abierto, recientes });

    // Paso 2: tema de destino (los sugeridos primero; escribe para buscar entre todos)
    const top = sug.filter((x) => x.puntos > 0).slice(0, 5);
    const resto = sug.filter((x) => !top.includes(x)).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
    const elemento = (x, sugerido) => ({
      label: `${x.codigo}  ${x.titulo}`, codigo: x.codigo,
      description: sugerido ? `$(sparkle) ${x.motivo}` : x.completo,
    });
    const items = [
      { label: 'Sugeridos', kind: vscode.QuickPickItemKind.Separator },
      ...top.map((x) => elemento(x, true)),
      { label: 'Todos los temas', kind: vscode.QuickPickItemKind.Separator },
      ...resto.map((x) => elemento(x, false)),
    ];
    const destino = await vscode.window.showQuickPick(items, {
      title: 'Nueva nota (2/2): ¿a qué tema va?',
      placeHolder: 'Intro acepta la primera sugerencia · escribe código o palabras para buscar',
      matchOnDescription: true, ignoreFocusOut: true,
    });
    if (!destino || !destino.codigo) return;

    // Paso 3 (solo si hay un tema abierto distinto del destino): ¿la nota viene de él?
    let origen = null;
    if (abierto && abierto !== destino.codigo) {
      const vincular = context.globalState.get('tcee.notaVincular', true);
      const si = { label: `$(link) Desde ${abierto}`, detail: 'La nota surge del tema que estás trabajando', v: true };
      const no = { label: '$(circle-slash) Sin relación con el tema abierto', detail: 'Solo anotas algo que has leído o pensado', v: false };
      const r = await vscode.window.showQuickPick(vincular ? [si, no] : [no, si], {
        title: `Nota para ${destino.codigo}: ¿viene de ${abierto}?`, ignoreFocusOut: true,
      });
      if (!r) return;
      origen = r.v ? abierto : null;
      context.globalState.update('tcee.notaVincular', r.v);
    }

    // Escribir la nota al final de \modificaciones{…}
    const uri = idx.uris.get(destino.codigo);
    const doc = await vscode.workspace.openTextDocument(uri);
    const actual = doc.getText();
    const ins = I.insercion(actual, I.lineaNota(texto, origen));
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(doc.positionAt(ins.desde), doc.positionAt(ins.hasta)), ins.insertar);
    if (!(await vscode.workspace.applyEdit(edit))) { vscode.window.showErrorMessage(`No se pudo añadir la nota a ${destino.codigo}.`); return; }
    await doc.save();
    indiceNotas = null;
    context.globalState.update('tcee.notaRecientes', [destino.codigo, ...recientes.filter((c) => c !== destino.codigo)].slice(0, 5));
    if (indice.mostrado && indice.mostrado.toString() === uri.toString()) indice.refrescar();

    const linea = doc.positionAt(ins.desde + ins.insertar.length - 2).line;
    vscode.window.showInformationMessage(`Nota añadida a ${destino.codigo}${origen ? ` (desde ${origen})` : ''}.`, 'Ver').then((b) => {
      if (b) vscode.commands.executeCommand('tcee.irA', uri, linea);
    });
  }));

  // ---- Rehacer informes de armonización: estado con scripts/armonizacion.js y encargo a Claude Code (main/RELACIONES.md, apartado 4)
  context.subscriptions.push(vscode.commands.registerCommand('tcee.rehacerInformes', rehacerInformes));

  // ---- Panel Oposición (pestaña): calendario, tiempo restante de todos los temas y relaciones
  const panelOpo = require('./panelOposicion').crear(context, {
    progreso, textoDe, temaMostrado: () => indice.mostrado,
    alMarcar: () => indice.refrescar(),
  });
  context.subscriptions.push(vscode.commands.registerCommand('tcee.panelOposicion', () => panelOpo.abrir()));
  const avisoEditor = vscode.window.onDidChangeActiveTextEditor(() => panelOpo.temaCambiado());
  context.subscriptions.push(avisoEditor, vscode.workspace.onDidSaveTextDocument((d) => { if (esTema(d)) panelOpo.refrescar(); }));

  const vigia = vscode.workspace.createFileSystemWatcher('**/temario/**/.build/estado');
  context.subscriptions.push(vigia, vigia.onDidChange(() => indice.refrescar()), vigia.onDidCreate(() => indice.refrescar()));
}

/** Ejecuta scripts/armonizacion.js con el Node que trae VS Code (no depende de que haya Node instalado) */
function armonizacion(raiz, args) {
  const { execFile } = require('child_process');
  return new Promise((ok, mal) => execFile(process.execPath, [path.join(raiz, 'main', 'scripts', 'armonizacion.js'), ...args],
    { cwd: raiz, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, maxBuffer: 4 << 20 },
    (e, out, err) => (e ? mal(new Error((err || e.message).trim())) : ok(out))));
}

async function rehacerInformes() {
  const raiz = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath;
  if (!raiz) { vscode.window.showWarningMessage('Abre primero el espacio de trabajo TCEE.'); return; }
  let salida;
  try {
    salida = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Comprobando los informes de armonización…' },
      () => armonizacion(raiz, ['estado']));
  } catch (e) { vscode.window.showErrorMessage(`No he podido comprobar los informes: ${e.message}`); return; }
  const pendientes = salida.split('\n').filter((l) => l.startsWith('  ')).map((l) => l.trim());
  if (!pendientes.length) { vscode.window.showInformationMessage('Todos los informes de armonización están al día. No hay nada que rehacer.'); return; }
  const modelos = pendientes.map((l) => l.split(' — ')[0]);
  const encargo = `Actualiza los informes de armonización siguiendo main/RELACIONES.md (apartado 4), solo para estos modelos: ${modelos.join('; ')}. `
    + 'Usa «node main/scripts/armonizacion.js preparar --pendientes», escribe los informes, haz la verificación independiente de los posibles errores '
    + 'y termina con «node main/scripts/armonizacion.js unir». No modifiques ningún tema. Al acabar, dime qué ha cambiado y sincroniza con GitHub.';
  const elegido = await vscode.window.showInformationMessage(
    `Hay ${modelos.length} ${modelos.length === 1 ? 'informe' : 'informes'} por rehacer`,
    { modal: true, detail: `${pendientes.join('\n')}\n\nLos rehace Claude Code (consume uso de tu plan: cuantos más modelos, más). `
      + 'Copiaré el encargo y abriré Claude Code: solo tendrás que pegarlo (⌘V) y pulsar Intro.' },
    'Copiar encargo y abrir Claude Code');
  if (!elegido) return;
  await vscode.env.clipboard.writeText(encargo);
  // abre Claude Code si su extensión está instalada (el nombre exacto del comando depende de la versión)
  const cmds = (await vscode.commands.getCommands(true)).filter((c) => /^claude/i.test(c));
  const abrir = ['claude-vscode.sidebar.open', 'claude-vscode.editor.open', 'claude-vscode.editor.openLast', 'claude-code.focus']
    .find((c) => cmds.includes(c)) || cmds.find((c) => /(open|focus)/i.test(c) && !/settings|log|terminal/i.test(c));
  if (abrir) { try { await vscode.commands.executeCommand(abrir); } catch (e) { /* se abre a mano */ } }
  vscode.window.showInformationMessage(abrir ? 'Encargo copiado: pégalo (⌘V) en Claude Code y pulsa Intro.'
    : 'Encargo copiado. Abre Claude Code, pégalo (⌘V) y pulsa Intro.');
}

function deactivate() {}
module.exports = { activate, deactivate };
