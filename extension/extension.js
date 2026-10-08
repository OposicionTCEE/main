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
    const test = this.test()[codigo];
    return { e: G.estimar(p, datos.temas[codigo], datos.ritmo, test), ritmo: G.ritmo(datos.ritmo), test };
  }
  /**
   * Preguntas de test por tema cuya ÚLTIMA respuesta (de cualquier Mac) fue error o blanco: {'3.A.8': {errores, blancos}}.
   * Banco: TCEE/test/preguntas.json; respuestas: progreso/test/*.json (TEST.md). Se guarda 5 s, como todos().
   */
  test() {
    if (this._test && Date.now() - this._test.t < 5000) return this._test.v;
    const v = {};
    try {
      const raiz = path.dirname(this.dir);
      const banco = this.leer(path.join(raiz, 'test', 'preguntas.json'));
      const tema = Object.fromEntries(((banco && banco.preguntas) || []).map((q) => [q.id, q.tema]));
      const d = path.join(this.dir, 'test');
      const sesiones = (fs.existsSync(d) ? fs.readdirSync(d) : []).filter((f) => f.endsWith('.json'))
        .flatMap((f) => ((this.leer(path.join(d, f)) || {}).sesiones || [])).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      const ultima = {};
      for (const s of sesiones) for (const r of s.respuestas || []) ultima[r.id] = r.ok;
      for (const [id, ok] of Object.entries(ultima)) {
        const c = tema[id]; if (!c || ok === true) continue;
        const x = v[c] || (v[c] = { errores: 0, blancos: 0 });
        if (ok === false) x.errores++; else x.blancos++;
      }
    } catch (e) { /* sin banco o sin respuestas: no cuenta */ }
    this._test = { t: Date.now(), v };
    return v;
  }
  /** Tras guardar una prueba de test: recalcular y avisar al panel */
  testCambiado() { this._test = null; this.avisar(); }
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
    const item = (label, icono, command, tooltip, atajo) => {
      const t = new vscode.TreeItem(label);
      if (atajo) t.description = atajo;   // el atajo a la vista, para irlo aprendiendo
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
      item('Atajos', 'keyboard', 'tcee.atajos', 'Todos los atajos del Panel TCEE en una ventana (se cierra con Esc; ⚙ cambia un atajo). Atajo: ⌘⌥K', '⌘⌥K'),
      item('Notas del tema con Claude', 'comment-discussion', 'tcee.notasClaude', 'Abre Claude Code con el encargo ya escrito (tema, pasada y documentos que debe leer: CLAUDE.md y GUIA_TEMAS.md). Solo tienes que añadir qué quieres tratar'),
      item('Rehacer informes', 'beaker', 'tcee.rehacerInformes', 'Comprueba qué informes faltan o están desactualizados (armonización de modelos y cobertura de las preguntas de test falladas) y prepara el encargo para Claude Code'),
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
    const err = (r.test && r.test.errores) || 0;
    vistaAcciones.title = `Tiempo restante: ${G.formatoTiempo(r.e.minutos)} (${r.e.pct} %)${err ? ` · ✗ ${err} ${err === 1 ? 'error' : 'errores'} de test` : ''}`;
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
          + `Errores OCR/Markdown: ${p.ocr}\nSin PDF en la última compilación: ${p.sinPdf ? 'sí' : 'no'}\n`
          + `Test (última respuesta a cada pregunta): ${(ultimo.test || {}).errores || 0} errores y ${(ultimo.test || {}).blancos || 0} en blanco`
          + `${e.hecho && e.test ? ' · cuentan aunque el tema esté hecho' : ''}\n\n`
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

    // ⌘B / ⌘I en un .tex: envuelve cada selección en \textbf{…} / \textit{…}; si ya lo está, lo quita.
    // Sin selección, escribe \textbf{} con el cursor dentro.
    vscode.commands.registerCommand('tcee.negrita', () => envolver('textbf')),
    vscode.commands.registerCommand('tcee.cursiva', () => envolver('textit')),

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

  // ---- Notas del tema con Claude: encargo prellenado en Claude Code (main/GUIA_TEMAS.md, §8)
  context.subscriptions.push(vscode.commands.registerCommand('tcee.notasClaude', () => notasConClaude(indice.mostrado)));

  // ---- Panel Oposición (pestaña): calendario, tiempo restante de todos los temas y relaciones
  activarFormulas(context);
  activarNotas(context);
  activarEscritura(context);

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
function armonizacion(raiz, args, script = 'armonizacion.js') {
  const { execFile } = require('child_process');
  return new Promise((ok, mal) => execFile(process.execPath, [path.join(raiz, 'main', 'scripts', script), ...args],
    { cwd: raiz, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, maxBuffer: 4 << 20 },
    (e, out, err) => (e ? mal(new Error((err || e.message).trim())) : ok(out))));
}

async function rehacerInformes() {
  const raiz = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath;
  if (!raiz) { vscode.window.showWarningMessage('Abre primero el espacio de trabajo TCEE.'); return; }
  let salida, salidaCob = '';
  try {
    salida = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Comprobando los informes…' },
      async () => { try { salidaCob = await armonizacion(raiz, ['estado'], 'cobertura.js'); } catch (e) { /* sin banco de test */ } return armonizacion(raiz, ['estado']); });
  } catch (e) { vscode.window.showErrorMessage(`No he podido comprobar los informes: ${e.message}`); return; }
  const lineas = (t) => t.split('\n').filter((l) => l.startsWith('  ')).map((l) => l.trim());
  const pendientes = lineas(salida), pendCob = lineas(salidaCob);
  if (!pendientes.length && !pendCob.length) { vscode.window.showInformationMessage('Los informes de armonización y de cobertura del test están al día. No hay nada que rehacer.'); return; }
  const modelos = pendientes.map((l) => l.split(' — ')[0]);
  const temasCob = pendCob.map((l) => l.split(' — ')[0]);
  const encargo = [
    modelos.length ? `Actualiza los informes de armonización siguiendo main/RELACIONES.md (apartado 4), solo para estos modelos: ${modelos.join('; ')}. `
      + 'Usa «node main/scripts/armonizacion.js preparar --pendientes», escribe los informes, haz la verificación independiente de los posibles errores '
      + 'y termina con «node main/scripts/armonizacion.js unir».' : '',
    temasCob.length ? `Analiza la cobertura de las preguntas de test falladas siguiendo main/TEST.md (apartado «Cobertura») para los temas ${temasCob.join(', ')}: `
      + '«node main/scripts/cobertura.js preparar --errores», escribe los informes y termina con «node main/scripts/cobertura.js unir».' : '',
    'No modifiques ningún tema. Al acabar, dime qué ha cambiado y sincroniza con GitHub.',
  ].filter(Boolean).join(' ');
  const resumen = [pendientes.length ? `Armonización (pestaña Relaciones):\n${pendientes.join('\n')}` : '', pendCob.length ? `Cobertura del test (¿están las preguntas falladas en su tema?):\n${pendCob.join('\n')}` : ''].filter(Boolean).join('\n\n');
  const n = modelos.length + temasCob.length;
  const elegido = await vscode.window.showInformationMessage(
    `Hay ${n} ${n === 1 ? 'informe' : 'informes'} por rehacer`,
    { modal: true, detail: `${resumen}\n\nLos rehace Claude Code (consume uso de tu plan: cuantos más, más). `
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

/** Cuenta notas y etiquetas del tema (main/GUIA_TEMAS.md, §7 y §8.2) */
function contarNotas(texto) {
  const cuerpo = texto.slice(Math.max(0, texto.indexOf('\\begin{document}')));
  const n = (rx) => (cuerpo.match(rx) || []).length;
  return {
    magenta: n(/\\textcolor\{magenta\}/g),
    etiquetas: n(/\\textcolor\{orange\}\{\\textsuperscript\{\[(?:Probable|Suposici[óo]n)\]\}\}/g),
  };
}

/** Abre Claude Code con el encargo de notas del tema ya escrito; el usuario añade qué quiere tratar */
async function notasConClaude(mostrado) {
  let uri = null;
  const ed = vscode.window.activeTextEditor;
  if (ed && codigoTema(ed.document.uri.fsPath)) uri = ed.document.uri;
  else if (mostrado && codigoTema(mostrado.fsPath)) uri = mostrado;
  if (!uri) {
    const uris = await vscode.workspace.findFiles('temario/Ejercicio-*/Parte-*/*/main.tex');
    const items = uris.map((u) => ({ label: codigoTema(u.fsPath), uri: u }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
    const e = await vscode.window.showQuickPick(items, { title: 'Notas del tema con Claude (1/2): ¿qué tema?', placeHolder: 'Escribe el código, p. ej. 3.A.43' });
    if (!e) return;
    uri = e.uri;
  }
  const codigo = codigoTema(uri.fsPath);
  const raiz = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath;
  const rel = raiz ? path.relative(raiz, uri.fsPath).split(path.sep).join('/') : uri.fsPath;
  let c = { magenta: 0, etiquetas: 0 };
  try {
    const abierto = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    c = contarNotas(abierto ? abierto.getText() : fs.readFileSync(uri.fsPath, 'utf8'));
  } catch (e) { /* sin recuento */ }
  const primera = { label: 'Primera pasada', pasada: 'primera',
    detail: 'Primera vez que Claude trabaja estas notas: deja en naranja [Probable] / [Suposición] lo que no sea seguro' };
  const segunda = { label: 'Segunda pasada', pasada: 'segunda',
    detail: 'Ya revisaste la primera y dejaste notas nuevas: resuelve lo nuevo y quita las etiquetas naranjas anteriores' };
  const opciones = c.etiquetas ? [segunda, primera] : [primera, segunda];
  opciones[0].description = c.etiquetas ? `recomendada: hay ${c.etiquetas} etiquetas de la pasada anterior` : 'recomendada: no hay etiquetas anteriores';
  const p = await vscode.window.showQuickPick(opciones, {
    title: `Notas del tema con Claude (2/2): ${codigo} · ${c.magenta} ${c.magenta === 1 ? 'nota magenta' : 'notas magenta'}`,
    placeHolder: '¿Qué pasada es?',
  });
  if (!p) return;
  const encargo = `Lee main/CLAUDE.md y main/GUIA_TEMAS.md (sobre todo el §8, protocolo de trabajo) antes de empezar. `
    + `Tema: ${codigo} (${rel}). Pasada: ${p.pasada}`
    + (p.pasada === 'segunda' ? ' (quita las etiquetas naranjas de la pasada anterior y no pongas nuevas)' : ' (etiqueta en naranja lo que no sea seguro)')
    + `. Notas magenta en el tema: ${c.magenta}. Empieza con el plan y espera mi visto bueno. Quiero tratar: `;
  // se copia siempre: si la versión de Claude Code no admite el mensaje prellenado, basta con pegarlo
  await vscode.env.clipboard.writeText(encargo);
  let abierto = false;
  // en la barra lateral: «sidebar.open» fija la barra lateral como sitio preferido y «editor.open» en modo programático
  // la respeta y le pasa el mensaje (Claude Code 2.1.29x). Si no existen esas órdenes, el enlace vscode:// lo abre en una pestaña.
  const cmds = await vscode.commands.getCommands(true);
  if (cmds.includes('claude-vscode.sidebar.open') && cmds.includes('claude-vscode.editor.open')) {
    try {
      // «sidebar.open» guarda la preferencia sin esperar: si no se espera aquí, «editor.open» aún lee «panel» y abre una pestaña
      const conf = vscode.workspace.getConfiguration('claudeCode');
      if (conf.get('preferredLocation') !== 'sidebar') await conf.update('preferredLocation', 'sidebar', vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('claude-vscode.sidebar.open');
      await vscode.commands.executeCommand('claude-vscode.editor.open', undefined, encargo, undefined, undefined, undefined,
        { programmatic: 'honor-preferred-location' });
      abierto = true;
    } catch (e) { /* abajo */ }
  }
  if (!abierto) {
    try { abierto = await vscode.env.openExternal(vscode.Uri.parse('vscode://anthropic.claude-code/open?prompt=' + encodeURIComponent(encargo))); } catch (e) { /* abajo */ }
  }
  if (abierto) {
    vscode.window.showInformationMessage('Encargo escrito en Claude Code: añade al final qué quieres tratar y pulsa Intro. (Si no aparece escrito, está copiado: pégalo con ⌘V.)');
  } else {
    vscode.window.showInformationMessage('Encargo copiado. Abre Claude Code, pégalo (⌘V), añade qué quieres tratar y pulsa Intro.');
  }
}

/** Envuelve (o desenvuelve) las selecciones del editor activo en \<macro>{…} */
async function envolver(macro) {
  const ed = vscode.window.activeTextEditor;
  if (!ed) return;
  const E = require('./escritura');
  const rx = new RegExp(`^\\\\${macro}\\{([\\s\\S]*)\\}$`);
  const sels = ed.selections;
  const textos = sels.map((s) => ed.document.getText(s));
  // ya envueltas todas (y no vacías): se quita la orden
  if (textos.every((t) => t && rx.test(t))) {
    await ed.edit((e) => sels.forEach((s, i) => e.replace(s, textos[i].match(rx)[1])));
    return;
  }
  const doc = ed.document;
  // un solo cursor dentro de un \macro{…} (main/ESCRITURA.md):
  //  - sin selección: el cursor sale detrás de la } para seguir escribiendo sin la orden;
  //  - todo el contenido seleccionado: se quita la orden;
  //  - una parte seleccionada: solo esa parte deja de llevar la orden (\textbf{a}b\textbf{c}).
  if (sels.length === 1) {
    const s = sels[0], texto = doc.getText(), ini = doc.offsetAt(s.start), fin = doc.offsetAt(s.end);
    const g = E.grupoQueRodea(texto, ini, fin, macro);
    if (g) {
      if (s.isEmpty) {
        // \textbf{} vacío: se borra (suele ser un error); si tiene texto, el cursor sale detrás de la }
        if (!texto.slice(g.abre + 1, g.cierra).trim()) {
          await ed.edit((e) => e.delete(new vscode.Range(doc.positionAt(g.inicio), doc.positionAt(g.cierra + 1))));
          const p = doc.positionAt(g.inicio); ed.selection = new vscode.Selection(p, p); return;
        }
        const p = doc.positionAt(g.cierra + 1); ed.selection = new vscode.Selection(p, p); return;
      }
      const contenido = texto.slice(g.abre + 1, g.cierra);
      const todo = new vscode.Range(doc.positionAt(g.inicio), doc.positionAt(g.cierra + 1));
      if (texto.slice(g.abre + 1, ini).trim() === '' && texto.slice(fin, g.cierra).trim() === '') {
        await ed.edit((e) => e.replace(todo, contenido));
        const p0 = doc.positionAt(g.inicio + (ini - g.abre - 1)), p1 = doc.positionAt(g.inicio + (fin - g.abre - 1));
        ed.selection = new vscode.Selection(p0, p1);
        return;
      }
      const sel = texto.slice(ini, fin);
      if (!E.equilibrado(sel)) { vscode.window.setStatusBarMessage('La selección corta un grupo { } por la mitad: no se cambia.', 3000); return; }
      const A = texto.slice(g.abre + 1, ini), B = texto.slice(fin, g.cierra);
      const pa = A.trim() ? `\\${macro}{${A}}` : A, pb = B.trim() ? `\\${macro}{${B}}` : B;
      await ed.edit((e) => e.replace(todo, pa + sel + pb));
      const p0 = doc.positionAt(g.inicio + pa.length), p1 = doc.positionAt(g.inicio + pa.length + sel.length);
      ed.selection = new vscode.Selection(p0, p1);
      return;
    }
  }
  // también si la selección es el contenido de \macro{…}: se quita la orden de alrededor (varios cursores)
  const rodea = sels.map((s) => {
    if (s.isEmpty) return null;
    const ini = doc.offsetAt(s.start), fin = doc.offsetAt(s.end), pre = `\\${macro}{`;
    if (ini < pre.length) return null;
    const antes = doc.getText(new vscode.Range(doc.positionAt(ini - pre.length), s.start));
    const despues = doc.getText(new vscode.Range(s.end, doc.positionAt(fin + 1)));
    return antes === pre && despues === '}' ? new vscode.Range(doc.positionAt(ini - pre.length), doc.positionAt(fin + 1)) : null;
  });
  if (rodea.every(Boolean)) {
    await ed.edit((e) => rodea.forEach((r, i) => e.replace(r, textos[i])));
    return;
  }
  // appendText escapa la barra invertida; el texto seleccionado (aunque lleve $ o llaves) se inserta tal cual
  await ed.insertSnippet(new vscode.SnippetString().appendText(`\\${macro}{`).appendVariable('TM_SELECTED_TEXT', '').appendTabstop(0).appendText('}'));
}

// ---------------------------------------------------------------- Vista previa de fórmulas (formulas.js; reglas en main/FORMULAS.md)
/**
 * Notas al pie contraíbles (main/NOTAS.md). VS Code solo contrae líneas enteras: se ofrecen como tramos plegables
 * las líneas del contenido de cada \footnote y, al abrir un .tex, se contraen todas (si no se ha desactivado).
 */
function activarNotas(context) {
  const N = require('./notas');
  const memo = new Map();   // uri → {version, tramos}
  const tramos = (doc) => {
    const k = doc.uri.toString(), m = memo.get(k);
    if (m && m.version === doc.version) return m.tramos;
    const t = N.tramos(doc.getText());
    memo.set(k, { version: doc.version, tramos: t });
    return t;
  };
  context.subscriptions.push(vscode.languages.registerFoldingRangeProvider({ language: 'latex' }, {
    provideFoldingRanges(doc) { return tramos(doc).map((r) => new vscode.FoldingRange(r.inicio, r.fin, vscode.FoldingRangeKind.Region)); },
  }));

  const estado = new Map();   // uri → true si están contraídas
  const aplicar = async (ed, contraer) => {
    if (!ed || ed.document.languageId !== 'latex') return;
    const lineas = tramos(ed.document).map((r) => r.inicio);
    if (!lineas.length) { vscode.window.setStatusBarMessage('No hay notas al pie que se puedan contraer en este tema.', 3000); return; }
    // la nota donde está el cursor se deja abierta al contraer, para no esconder lo que se está escribiendo
    const cur = ed.selection.active.line;
    const sel = contraer ? tramos(ed.document).filter((r) => !(cur >= r.inicio && cur <= r.fin + 1)).map((r) => r.inicio) : lineas;
    await vscode.commands.executeCommand(contraer ? 'editor.fold' : 'editor.unfold', { levels: 1, direction: 'up', selectionLines: sel });
    estado.set(ed.document.uri.toString(), contraer);
  };
  // al abrir un tema, una vez: contraídas
  let ajustando = false;
  const vistos = new Set();
  const alAbrir = (ed) => {
    if (!ed || ed.document.languageId !== 'latex' || ed.document.uri.scheme !== 'file') return;
    const k = ed.document.uri.toString();
    if (vistos.has(k)) return;
    vistos.add(k);
    if (vscode.workspace.getConfiguration('tcee').get('notasContraidasAlAbrir', true) === false) return;
    // VS Code calcula los tramos plegables justo después de abrir: se espera un momento
    setTimeout(() => { if (vscode.window.activeTextEditor === ed) aplicar(ed, true); }, 700);
  };
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(alAbrir),
    vscode.workspace.onDidCloseTextDocument((d) => { vistos.delete(d.uri.toString()); estado.delete(d.uri.toString()); memo.delete(d.uri.toString()); }),
    vscode.commands.registerCommand('tcee.notasContraer', () => aplicar(vscode.window.activeTextEditor, true)),
    vscode.commands.registerCommand('tcee.notasExpandir', () => aplicar(vscode.window.activeTextEditor, false)),
    vscode.commands.registerCommand('tcee.notasAlternar', () => {
      const ed = vscode.window.activeTextEditor; if (!ed) return;
      const k = ed.document.uri.toString();
      return aplicar(ed, !(estado.get(k) ?? false));
    }),
    // nueva nota ya escrita en varias líneas, para que se pueda contraer (VS Code añade la sangría de la línea actual)
    vscode.commands.registerCommand('tcee.nuevaNota', () => {
      const ed = vscode.window.activeTextEditor; if (!ed) return;
      const dentro = ed.document.getText(ed.selection);
      const s = new vscode.SnippetString().appendText('\\footnote{%\n    ');
      if (dentro) s.appendText(dentro); else s.appendTabstop(0);
      s.appendText('\n}');
      return ed.insertSnippet(s);
    }),
    // el % tras \footnote{ se pone y se quita solo (NOTAS.md, apartado «El % automático»):
    //  - si la línea acaba en «\footnote{» y la nota sigue en la línea de abajo, se añade el % (si no, LaTeX vería un espacio tras el número);
    //  - si tras «\footnote{%» hay texto en la misma línea (al juntar dos líneas), se quita (si no, ese texto quedaría como comentario).
    vscode.workspace.onDidChangeTextDocument((e) => {
      const ed = vscode.window.activeTextEditor;
      if (ajustando || !ed || e.document !== ed.document || e.document.languageId !== 'latex' || !e.contentChanges.length) return;
      const doc = e.document, lineas = new Set();
      for (const ch of e.contentChanges) {
        const n = (ch.text.match(/\n/g) || []).length;
        for (let l = Math.max(0, ch.range.start.line - 1); l <= Math.min(doc.lineCount - 1, ch.range.start.line + n + 1); l++) lineas.add(l);
      }
      const cursores = new Set(ed.selections.map((x) => x.active.line));
      const cambios = [];
      for (const l of lineas) {
        const t = doc.lineAt(l).text;
        const a = t.match(/^(.*\\footnote\s*(?:\[[^\]]*\])?\{)[ \t]*$/);
        if (a && !cursores.has(l) && l + 1 < doc.lineCount && !/(^|[^\\])%/.test(a[1])) {
          cambios.push([new vscode.Range(l, a[1].length, l, t.length), '%']);
          continue;
        }
        const b = t.match(/^(.*\\footnote\s*(?:\[[^\]]*\])?\{)(%[ \t]*)(?=[^\s%])/);
        if (b && !/(^|[^\\])%/.test(b[1])) cambios.push([new vscode.Range(l, b[1].length, l, b[1].length + b[2].length), '']);
      }
      if (!cambios.length) return;
      ajustando = true;
      ed.edit((w) => cambios.forEach(([r, x]) => w.replace(r, x)), { undoStopBefore: false, undoStopAfter: false })
        .then(() => { ajustando = false; }, () => { ajustando = false; });
    }),
  );
  alAbrir(vscode.window.activeTextEditor);
}

/**
 * Ayudas de escritura (main/ESCRITURA.md): ⌃U mayúsculas, ⌃H resaltado \hl, $ automático, \color → \textcolor{}{} con la paleta
 * de config/colores.json (salta al texto al completar un color), \high → \hl{}, colores y resaltado visibles en el editor y ⌃⌘A atajos.
 */
function activarEscritura(context) {
  const E = require('./escritura');
  const raiz = path.resolve(context.extensionUri.fsPath, '..');   // main/ (en la instalación, se busca también en la carpeta TCEE)
  let pal = null;
  const paleta = () => {
    if (pal) return pal;
    const cands = [raiz, ...(vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath), ...(vscode.workspace.workspaceFolders || []).map((f) => path.join(f.uri.fsPath, 'main'))];
    for (const c of cands) { const v = E.paleta(c); if (v.length) { pal = v; break; } }
    return pal || [];
  };
  const hexDe = (c) => { const p = paleta().find((x) => x.color === c); return p ? p.hex : E.XCOLOR[c]; };
  const valido = (c) => !!hexDe(c);
  const latex = { language: 'latex' };

  // ⌃U: mayúsculas sin tocar órdenes, fórmulas ni comentarios
  context.subscriptions.push(vscode.commands.registerCommand('tcee.mayusculas', async () => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    const sels = ed.selections.map((s) => (s.isEmpty ? ed.document.getWordRangeAtPosition(s.active) : s)).filter(Boolean);
    await ed.edit((e) => sels.forEach((r) => e.replace(r, E.mayusculas(ed.document.getText(r)))));
  }));
  // ⌃C: rodear la selección de color (\textcolor{|}{selección}); el cursor queda en el color, con la paleta abierta
  context.subscriptions.push(vscode.commands.registerCommand('tcee.colorear', async () => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    const s = new vscode.SnippetString().appendText('\\textcolor{').appendTabstop(1).appendText('}{');
    if (ed.selections.every((x) => x.isEmpty)) s.appendTabstop(2); else s.appendVariable('TM_SELECTED_TEXT', '');
    s.appendText('}').appendTabstop(0);
    await ed.insertSnippet(s);
    vscode.commands.executeCommand('editor.action.triggerSuggest');
  }));
  // Intro dentro de una lista (lnum, la, itemize, enumerate): línea nueva con \item; en un \item vacío, sale de la lista
  let enListaAntes = false;
  const marcarLista = (ed) => {
    const v = !!(ed && ed.document.languageId === 'latex' && ed.selections.length === 1 && E.enLista(ed.document.getText(), ed.document.offsetAt(ed.selection.active)));
    if (v !== enListaAntes) { enListaAntes = v; vscode.commands.executeCommand('setContext', 'tcee.enLista', v); }
  };
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => marcarLista(e.textEditor)),
    vscode.window.onDidChangeActiveTextEditor(marcarLista),
    vscode.commands.registerCommand('tcee.intro', async () => {
      const ed = vscode.window.activeTextEditor; if (!ed) return;
      const doc = ed.document, p = ed.selection.active, texto = doc.getText();
      const l = E.enLista(texto, doc.offsetAt(p));
      if (!l || !ed.selection.isEmpty) return vscode.commands.executeCommand('type', { text: '\n' });
      const linea = doc.lineAt(p.line);
      if (linea.text.trim() === '\\item') {
        // \item vacío: se quita y el cursor sale debajo del \end{…}
        const fin = E.finDeEntorno(texto, l.inicio, l.nombre);
        if (fin < 0) return;
        const finPos = doc.positionAt(fin);
        await ed.edit((w) => { w.insert(finPos, '\n'); w.delete(linea.rangeIncludingLineBreak); });
        const q = doc.positionAt(E.finDeEntorno(doc.getText(), l.inicio, l.nombre) + 1);
        ed.selection = new vscode.Selection(q, q);
        return;
      }
      // sangría del \item en el que se está (o de la línea actual)
      let k = p.line; while (k > 0 && !/^\s*\\item\b/.test(doc.lineAt(k).text) && doc.offsetAt(new vscode.Position(k, 0)) > l.inicio) k--;
      const sangria = (doc.lineAt(/^\s*\\item\b/.test(doc.lineAt(k).text) ? k : p.line).text.match(/^[ \t]*/) || [''])[0];
      await ed.edit((w) => w.insert(p, `\n${sangria}\\item `));
    }),
  );
  // ⌃H: resaltado amarillo (\hl del paquete soul), con la misma lógica que ⌘B
  context.subscriptions.push(vscode.commands.registerCommand('tcee.resaltar', async () => {
    await envolver('hl');
    const ed = vscode.window.activeTextEditor, t = ed ? ed.document.getText() : '';
    const pre = t.slice(0, Math.max(0, t.indexOf('\\begin{document}')));
    if (ed && !/\\usepackage(\[[^\]]*\])?\{[^}]*\bsoul/.test(pre))
      vscode.window.showWarningMessage('Este tema no carga el paquete «soul»: el resaltado (\\hl) dará error al compilar. Hay que añadir al preámbulo \\usepackage{soul}\\sethlcolor{yellow} (ver ESCRITURA.md).');
  }));

  // $: par con el cursor en medio, envolver la selección, o uno solo si hay texto pegado
  context.subscriptions.push(vscode.commands.registerCommand('tcee.dolar', async () => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    const doc = ed.document;
    if (ed.selections.length !== 1) return vscode.commands.executeCommand('type', { text: '$' });
    const s = ed.selection;
    if (!s.isEmpty) {
      const t = doc.getText(s);
      await ed.edit((e) => e.replace(s, `$${t}$`));
      const a = doc.offsetAt(s.start) + 1;
      ed.selection = new vscode.Selection(doc.positionAt(a), doc.positionAt(a + t.length));
      return;
    }
    const p = s.active, linea = doc.lineAt(p.line).text;
    const accion = E.dolar(linea[p.character - 1] || '', linea[p.character] || '');
    if (accion === 'saltar') { const q = p.translate(0, 1); ed.selection = new vscode.Selection(q, q); return; }
    if (accion === 'uno') return vscode.commands.executeCommand('type', { text: '$' });
    await ed.insertSnippet(new vscode.SnippetString('\\$$0\\$'));
  }));

  // \color → \textcolor{}{} (y abre la lista de colores); \high → \hl{}
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider(latex, {
    provideCompletionItems(doc, pos) {
      const linea = doc.lineAt(pos.line).text.slice(0, pos.character);
      // dentro del primer argumento de \textcolor: la paleta con su significado y los demás colores de xcolor
      const mc = linea.match(/\\textcolor\{([A-Za-z]*)$/);
      if (mc) {
        const rango = new vscode.Range(pos.translate(0, -mc[1].length), pos);
        const vistos = new Set();
        // solo la paleta (config/colores.json), cada color con su significado al lado, sin pasar el ratón
        const items = paleta().map((c, i) => {
          const it = new vscode.CompletionItem({ label: c.color, detail: `  → ${c.significado}` }, vscode.CompletionItemKind.Color);
          it.documentation = c.hex; it.sortText = `0${i}`; it.range = rango; it.preselect = i === 0;
          it.filterText = c.color;
          return it;
        });
        return new vscode.CompletionList(items, false);
      }
      const m = linea.match(/\\([A-Za-z]*)$/);
      if (!m) return;
      const rango = new vscode.Range(pos.translate(0, -m[0].length), pos);
      const items = [];
      if (m[1].length >= 3 && 'color'.startsWith(m[1].toLowerCase())) {
        const it = new vscode.CompletionItem({ label: '\\color', description: '→ \\textcolor{color}{texto}' }, vscode.CompletionItemKind.Snippet);
        it.insertText = new vscode.SnippetString('\\\\textcolor{$1}{$2}$0'); it.filterText = '\\color'; it.sortText = '!0'; it.preselect = true; it.range = rango;
        it.command = { command: 'editor.action.triggerSuggest', title: 'colores' };
        it.documentation = 'Texto en color. Al escribir un color válido, el cursor salta al texto. Significados en config/colores.json.';
        items.push(it);
      }
      // \lnum y \la → lista con su primer \item; \cita → bloque de cita (cursor en el texto; Tab: Autor, Año, Obra)
      const bloque = (nombre, desc, snippet, orden) => {
        const it = new vscode.CompletionItem({ label: `\\${nombre}`, description: desc }, vscode.CompletionItemKind.Snippet);
        it.insertText = new vscode.SnippetString(snippet); it.filterText = `\\${nombre}`; it.sortText = `!${orden}`; it.preselect = true; it.range = rango;
        return it;
      };
      const ml = m[1].toLowerCase();
      if (ml.length >= 2 && 'lnum'.startsWith(ml)) items.push(bloque('lnum', '→ lista numerada (1. 2. 3.)', '\\begin{lnum}\n\t\\item $0\n\\end{lnum}', 2));
      if (ml === 'la') items.push(bloque('la', '→ lista alfabética (a) b) c))', '\\begin{la}\n\t\\item $0\n\\end{la}', 3));
      if (ml.length >= 2 && 'cita'.startsWith(ml)) items.push(bloque('cita', '→ cita textual (Tab: Autor, Año, Obra)', '\\begin{cita}[${2:Autor}][${3:Año}][${4:Obra}]\n\t$1\n\\end{cita}$0', 4));
      if ((m[1].length >= 3 && 'highlight'.startsWith(m[1].toLowerCase())) || m[1] === 'hl') {
        const it = new vscode.CompletionItem({ label: '\\highlight', description: '→ \\hl{texto} (resaltado amarillo, ⌃H)' }, vscode.CompletionItemKind.Snippet);
        it.insertText = new vscode.SnippetString('\\\\hl{$1}$0'); it.filterText = '\\highlight'; it.sortText = '!1'; it.preselect = true; it.range = rango;
        items.push(it);
      }
      return items;
    },
  }, '\\', '{'));

  // al completar un color válido en \textcolor{…}, el cursor salta al segundo argumento
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
    const ed = vscode.window.activeTextEditor;
    if (!ed || e.document !== ed.document || e.document.languageId !== 'latex' || e.contentChanges.length !== 1) return;
    const ch = e.contentChanges[0];
    if (!ch.text || ch.text.includes('\n')) return;
    setTimeout(() => {
      if (vscode.window.activeTextEditor !== ed || ed.selections.length !== 1 || !ed.selection.isEmpty) return;
      const p = ed.selection.active, linea = ed.document.lineAt(p.line).text;
      const m = linea.slice(0, p.character).match(/\\textcolor\{([A-Za-z]+)$/);
      if (!m || !valido(m[1]) || !linea.slice(p.character).startsWith('}{')) return;
      // si el texto ya está escrito (por ejemplo, al rodear una selección con ⌃C), el cursor sale detrás de la } final;
      // si está vacío, entra en el segundo {} para escribirlo
      const doc = ed.document, abre = doc.offsetAt(p) + 1, cierra = E.cierre(doc.getText(), abre);
      const q = cierra > abre + 1 ? doc.positionAt(cierra + 1) : p.translate(0, 2);
      ed.selection = new vscode.Selection(q, q);
      vscode.commands.executeCommand('hideSuggestWidget');
    }, 0);
  }));

  // al pasar el ratón por el color de \textcolor{color}: su significado
  context.subscriptions.push(vscode.languages.registerHoverProvider(latex, {
    provideHover(doc, pos) {
      const r = doc.getWordRangeAtPosition(pos, /\\textcolor\{[A-Za-z]+\}/);
      if (!r) return null;
      const c = doc.getText(r).match(/\{([A-Za-z]+)\}/)[1];
      const p = paleta().find((x) => x.color === c);
      const md = new vscode.MarkdownString();
      if (p) md.appendMarkdown(`**${c}** → ${p.significado}`);
      else if (E.XCOLOR[c]) md.appendMarkdown(`**${c}**: color sin significado asignado (config/colores.json).`);
      else md.appendMarkdown(`**⚠ «${c}» no es un color que LaTeX conozca**: el texto no saldrá en el PDF o dará error. ¿Errata?`);
      return new vscode.Hover(md, r);
    },
  }));

  // en el editor: el texto de \textcolor en su color y el de \hl con fondo amarillo
  const tipos = new Map();
  const tipo = (hex) => {
    if (!tipos.has(hex)) tipos.set(hex, vscode.window.createTextEditorDecorationType({ color: hex }));
    return tipos.get(hex);
  };
  const amarillo = vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(255, 221, 0, 0.30)', borderRadius: '2px' });
  const pista = vscode.window.createTextEditorDecorationType({ before: { color: new vscode.ThemeColor('editorGhostText.foreground'), fontStyle: 'italic' } });
  // «Autor», «Año» u «Obra» sin cambiar en una cita: subrayado ondulado, para ver de un vistazo lo que falta
  const falta = vscode.window.createTextEditorDecorationType({ textDecoration: 'underline wavy', color: new vscode.ThemeColor('editorWarning.foreground') });
  context.subscriptions.push(pista, falta);
  context.subscriptions.push(amarillo, { dispose: () => tipos.forEach((t) => t.dispose()) });
  const decorar = (ed) => {
    if (!ed || ed.document.languageId !== 'latex') return;
    const t = ed.document.getText(), doc = ed.document;
    const porColor = new Map(), hl = [];
    const rx = /\\(textcolor\{([A-Za-z]+)\}|hl)\s*\{/g; let m;
    while ((m = rx.exec(t))) {
      if (E.escapado(t, m.index)) continue;
      const a = m.index + m[0].length - 1, b = E.cierre(t, a);
      if (b < 0) continue;
      const r = new vscode.Range(doc.positionAt(a + 1), doc.positionAt(b));
      if (m[2]) { const h = hexDe(m[2]); if (h && m[2] !== 'black' && m[2] !== 'white') { if (!porColor.has(h)) porColor.set(h, []); porColor.get(h).push(r); } } else hl.push(r);
    }
    // \begin{cita}[…][…][…]: en los corchetes vacíos, el dato que va (Autor, Año, Obra) en gris, sin escribirlo en el texto
    const pistas = [], faltan = [];
    const rc = /\\begin\{cita\}/g; let mc;
    while ((mc = rc.exec(t))) {
      let i = mc.index + mc[0].length;
      for (const nombre of ['Autor', 'Año', 'Obra']) {
        if (t[i] !== '[') break;
        const j = t.indexOf(']', i);
        if (j < 0) break;
        if (j === i + 1) { const p = doc.positionAt(i + 1); pistas.push({ range: new vscode.Range(p, p), renderOptions: { before: { contentText: nombre } } }); }
        else if (t.slice(i + 1, j) === nombre) faltan.push(new vscode.Range(doc.positionAt(i + 1), doc.positionAt(j)));   // sin rellenar: se subraya
        i = j + 1;
      }
    }
    ed.setDecorations(pista, pistas);
    ed.setDecorations(falta, faltan);
    tipos.forEach((ty, h) => { if (!porColor.has(h)) ed.setDecorations(ty, []); });
    porColor.forEach((rs, h) => ed.setDecorations(tipo(h), rs));
    ed.setDecorations(amarillo, hl);
  };
  let espera = null;
  const programar = (ed) => { clearTimeout(espera); espera = setTimeout(() => decorar(ed), 300); };
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((ed) => decorar(ed)),
    vscode.workspace.onDidChangeTextDocument((e) => { const ed = vscode.window.activeTextEditor; if (ed && e.document === ed.document) programar(ed); }),
  );
  decorar(vscode.window.activeTextEditor);

  // ⌃⌘A: atajos del Panel TCEE (sacados de package.json; sin los de escritura como $), se cierra con Esc
  context.subscriptions.push(vscode.commands.registerCommand('tcee.atajos', () => {
    const pj = context.extension.packageJSON.contributes;
    const titulos = Object.fromEntries((pj.commands || []).map((c) => [c.command, c.title]));
    const mac = process.platform === 'darwin';
    const bonito = (k) => k.split(' ').map((acorde) => acorde.split('+').map((x) => (mac
      ? ({ cmd: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' }[x] || x.toUpperCase()) : x[0].toUpperCase() + x.slice(1))).join(mac ? '' : '+')).join(' ');
    // atajos por defecto (package.json) y, encima, los que el usuario haya cambiado en VS Code (keybindings.json)
    const atajo = {};
    (pj.keybindings || []).forEach((k) => { atajo[k.command] = (mac && k.mac) || k.key; });
    try {
      const dir = mac ? path.join(require('os').homedir(), 'Library', 'Application Support', 'Code', 'User')
        : process.platform === 'win32' ? path.join(process.env.APPDATA || '', 'Code', 'User') : path.join(require('os').homedir(), '.config', 'Code', 'User');
      const txt = require('fs').readFileSync(path.join(dir, 'keybindings.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[\]}])/g, '$1');
      for (const k of JSON.parse(txt)) {
        if (typeof k.command !== 'string') continue;
        if (k.command.startsWith('-tcee.')) { if (atajo[k.command.slice(1)] === k.key) atajo[k.command.slice(1)] = null; }
        else if (k.command.startsWith('tcee.')) atajo[k.command] = k.key;
      }
    } catch (e) { /* sin atajos propios */ }
    const boton = { iconPath: new vscode.ThemeIcon('gear'), tooltip: 'Cambiar este atajo' };
    const qp = vscode.window.createQuickPick();
    qp.title = 'Atajos del Panel TCEE · Esc cierra · Intro lo ejecuta · ⚙ lo cambia';
    qp.matchOnDescription = true;
    qp.items = Object.entries(atajo).filter(([c]) => !['tcee.dolar', 'tcee.intro'].includes(c)).map(([c, k]) => ({
      label: k ? bonito(k) : '(sin atajo)', description: titulos[c] || c, comando: c, buttons: [boton],
    }));
    qp.onDidAccept(() => { const it = qp.selectedItems[0]; qp.hide(); if (it) vscode.commands.executeCommand(it.comando); });
    // ⚙: abre los atajos de VS Code filtrados por esa orden; allí se pulsa el lápiz y la combinación nueva (VS Code avisa si ya se usa)
    qp.onDidTriggerItemButton((e) => { qp.hide(); vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', e.item.comando); });
    qp.onDidHide(() => qp.dispose());
    qp.show();
  }));
  // botón «⌨ Atajos» en la barra inferior mientras se edita un .tex: un clic y se ven todos
  const barra = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
  barra.text = '$(keyboard) Atajos'; barra.command = 'tcee.atajos'; barra.tooltip = 'Atajos del Panel TCEE (⌘⌥K)';
  const verBarra = (ed) => (ed && ed.document.languageId === 'latex' ? barra.show() : barra.hide());
  context.subscriptions.push(barra, vscode.window.onDidChangeActiveTextEditor(verBarra));
  verBarra(vscode.window.activeTextEditor);
}

function activarFormulas(context) {
  const F = require('./formulas');
  const cache = new Map();
  const color = () => ([vscode.ColorThemeKind.Light, vscode.ColorThemeKind.HighContrastLight].includes(vscode.window.activeColorTheme.kind) ? '#1f1f1f' : '#e6e6e6');
  /** SVG de la fórmula en la posición, o {error}; null si no hay fórmula */
  const svgEn = (doc, pos) => {
    const texto = doc.getText();
    const r = F.localizar(texto, doc.offsetAt(pos));
    if (!r || !r.tex.trim()) return null;
    const clave = `${color()}|${r.display}|${r.tex}`;
    if (!cache.has(clave)) {
      let v;
      try {
        const svg = F.dibujar(r.tex, r.display, color(), 1.1, F.macros(texto, r.tex));
        // órdenes desconocidas: MathJax las pinta en rojo en lugar de fallar
        v = { svg, aviso: /fill="red"|mathcolor="red"/.test(svg) ? 'En rojo: órdenes que la vista previa no conoce (¿errata o definidas fuera del preámbulo?).' : '' };
      } catch (e) { v = { error: F.explicarError(e.message || e, r.tex) }; }
      if (cache.size > 80) cache.delete(cache.keys().next().value);
      cache.set(clave, v);
    }
    return { ...cache.get(clave), rango: new vscode.Range(doc.positionAt(r.inicio), doc.positionAt(r.fin)) };
  };

  /** Guarda el SVG en la carpeta de la extensión y devuelve su dirección (para fórmulas que no caben incrustadas) */
  const fs_ = require('fs'), path_ = require('path'), crypto_ = require('crypto');
  // en la carpeta de la propia extensión: VS Code siempre deja mostrar imágenes de ahí en las ventanitas
  const dirSvg = path_.join(context.extensionUri.fsPath, '.formulas');
  const aFichero = (svg) => {
    fs_.mkdirSync(dirSvg, { recursive: true });
    const f = path_.join(dirSvg, `${crypto_.createHash('sha1').update(svg).digest('hex').slice(0, 16)}.svg`);
    if (!fs_.existsSync(f)) {
      fs_.writeFileSync(f, svg);
      try { const v = fs_.readdirSync(dirSvg); if (v.length > 300) v.slice(0, 100).forEach((x) => fs_.unlinkSync(path_.join(dirSvg, x))); } catch (e) { /* limpieza opcional */ }
    }
    return vscode.Uri.file(f).toString();
  };

  // al pasar el ratón
  context.subscriptions.push(vscode.languages.registerHoverProvider({ language: 'latex' }, {
    provideHover(doc, pos) {
      const r = svgEn(doc, pos);
      if (!r) return null;
      let md;
      if (r.svg) {
        // la ventanita no admite más de ~100.000 caracteres: las fórmulas grandes van como fichero en lugar de incrustadas
        const b64 = Buffer.from(r.svg).toString('base64');
        const img = b64.length < 90000 ? `data:image/svg+xml;base64,${b64}` : aFichero(r.svg);
        md = new vscode.MarkdownString(`![fórmula](${img})${r.aviso ? `\n\n*${r.aviso}*` : ''}${b64.length < 90000 ? '' : '\n\n*Fórmula grande: si no se ve, pulsa ⌘⌥M para verla en el panel.*'}`);
      } else {
        md = new vscode.MarkdownString();
        md.appendMarkdown('**⚠ No se puede dibujar esta fórmula**\n\n');
        md.appendText(r.error);
      }
      return new vscode.Hover(md, r.rango);
    },
  }));

  // imágenes (\imagenfit{Fig1.png}{…}{…}, \includegraphics{…}) al pasar el ratón por su línea
  const I = require('./imagenes');
  const dirMini = path_.join(context.globalStorageUri.fsPath, 'miniaturas');
  context.subscriptions.push(vscode.languages.registerHoverProvider({ language: 'latex' }, {
    async provideHover(doc, pos) {
      const texto = doc.getText();
      const r = I.localizar(texto, doc.offsetAt(pos));
      if (!r) return null;
      const rango = new vscode.Range(doc.positionAt(r.inicioLinea), doc.positionAt(r.finLinea));
      const md = new vscode.MarkdownString();
      md.isTrusted = { enabledCommands: ['vscode.open'] };
      // errata en el nombre de la orden (p. ej. \imagenit): LaTeX no la conoce y la imagen no sale en el PDF
      if (!I.ordenDefinida(texto, r.orden)) {
        const buenas = I.ordenesDeImagen(texto).map((o) => [o, I.distancia(o, r.orden)]).sort((a, b) => a[1] - b[1]);
        md.appendMarkdown('**⚠ Orden desconocida**\n\n');
        md.appendText(`La orden \\${r.orden} no está definida en este tema${buenas.length && buenas[0][1] <= 3 ? `: ¿errata de \\${buenas[0][0]}?` : '.'} En el PDF esta imagen no sale.`);
        md.appendMarkdown('\n\n');
      }
      const f = I.resolver(path_.dirname(doc.uri.fsPath), r.nombre);
      if (f.error) {
        md.appendMarkdown('**⚠ No se puede mostrar la imagen**\n\n');
        md.appendText(f.error);
        return new vscode.Hover(md, rango);
      }
      let m;
      try { m = await I.miniatura(f.fichero, dirMini); } catch (e) { m = { fichero: f.fichero }; }
      const abrir = `command:vscode.open?${encodeURIComponent(JSON.stringify([vscode.Uri.file(f.fichero)]))}`;
      md.appendMarkdown(`![${path_.basename(f.fichero)}](${m.uri || vscode.Uri.file(f.fichero).toString()})\n\n`);
      md.appendMarkdown(`*${path_.basename(f.fichero)}* · [Abrir la imagen](${abrir})`);
      if (!m.uri) md.appendMarkdown('\n\n*Imagen grande: si no se ve, pulsa «Abrir la imagen».*');
      return new vscode.Hover(md, rango);
    },
  }));

  // panel que sigue al cursor (⌘⌥M)
  let panel = null, espera = null;
  const pintar = () => {
    const ed = vscode.window.activeTextEditor;
    if (!panel || !ed || ed.document.languageId !== 'latex') return;
    const r = svgEn(ed.document, ed.selection.active);
    const fondo = 'var(--vscode-editor-background)', tinta = 'var(--vscode-foreground)';
    const cuerpo = !r ? '<p class="nada">Coloca el cursor dentro de una fórmula (por ejemplo, dentro de un \\eqblock).</p>'
      : r.svg ? `<div class="f">${r.svg}</div>${r.aviso ? `<p class="nada">${r.aviso}</p>` : ''}` : `<p class="err"><strong>⚠ No se puede dibujar esta fórmula</strong><br>${r.error.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p>`;
    panel.webview.html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<style>body{background:${fondo};color:${tinta};font-family:var(--vscode-font-family);padding:16px;overflow:auto}.f{overflow-x:auto}.nada{opacity:.6}.err{color:var(--vscode-errorForeground)}</style></head><body>${cuerpo}</body></html>`;
  };
  const programar = () => { clearTimeout(espera); espera = setTimeout(pintar, 200); };
  context.subscriptions.push(
    vscode.commands.registerCommand('tcee.vistaFormulas', () => {
      if (panel) { panel.dispose(); return; }
      panel = vscode.window.createWebviewPanel('tceeFormula', 'Fórmula', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: false });
      panel.onDidDispose(() => { panel = null; });
      pintar();
    }),
    vscode.window.onDidChangeTextEditorSelection((e) => { if (panel && e.textEditor.document.languageId === 'latex') programar(); }),
    vscode.workspace.onDidChangeTextDocument((e) => { if (panel && vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) programar(); }),
    vscode.window.onDidChangeActiveColorTheme(() => { cache.clear(); programar(); }),
  );
}

function deactivate() {}
module.exports = { activate, deactivate, _pruebas: { activarEscritura, activarNotas, envolver } };   // _pruebas: solo para probar fuera de VS Code
