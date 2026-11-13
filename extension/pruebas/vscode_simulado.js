// VS Code simulado para probar módulos de la extensión con Node, sin abrir VS Code (pruebas/ajustes.js, pruebas/claude_code.js).
// Solo lo que usan esos módulos: ajustes (con valores por defecto de package.json), órdenes, pestañas y grupos, mensajes.
// Uso: const vs = require('./vscode_simulado').instalar();  …  require('../ajustes')   (instalar() antes de cargar el módulo)
'use strict';
const Module = require('module');
const path = require('path');

function crear() {
  const pj = require(path.join(__dirname, '..', 'package.json'));
  const props = pj.contributes.configuration.properties;
  const guardado = { workspace: {}, global: {} };   // 'tcee.x' → valor
  const mensajes = [], ejecutadas = [], portapapeles = { texto: '' };
  const oyentes = [];

  const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
  function getConfiguration(seccion) {
    const k = (c) => `${seccion}.${c}`;
    const def = (c) => (props[k(c)] || {}).default;
    return {
      get: (c, d) => { const x = k(c); if (x in guardado.workspace) return guardado.workspace[x]; if (x in guardado.global) return guardado.global[x]; const v = def(c); return v === undefined ? d : v; },
      inspect: (c) => ({ defaultValue: def(c), workspaceValue: guardado.workspace[k(c)], globalValue: guardado.global[k(c)] }),
      update: async (c, v, destino) => {
        const donde = destino === ConfigurationTarget.Global ? guardado.global : guardado.workspace;
        if (v === undefined) delete donde[k(c)]; else donde[k(c)] = v;
        oyentes.forEach((f) => f({ affectsConfiguration: (s) => k(c) === s || k(c).startsWith(`${s}.`) }));
      },
    };
  }

  // pestañas y grupos (varias ventanas: los grupos se cuentan todos, como hace VS Code con «position» y viewColumn)
  class TabInputWebview { constructor(viewType) { this.viewType = viewType; } }
  class TabInputText { constructor(uri) { this.uri = uri; } }
  const grupos = [];
  const tabGroups = {
    get all() { return grupos.slice(); },
    activeTabGroup: null,
  };
  function nuevoGrupo(ventana) {
    const g = { tabs: [], activeTab: null, ventana, get viewColumn() { return grupos.indexOf(g) + 1; } };
    grupos.push(g); return g;
  }
  function anadir(g, tab, activar = true) {
    g.tabs.push(tab); tab.group = g;
    if (activar) { g.activeTab = tab; tabGroups.activeTabGroup = g; }
    return tab;
  }
  function quitar(tab) {
    const g = tab.group; g.tabs.splice(g.tabs.indexOf(tab), 1);
    if (g.activeTab === tab) g.activeTab = g.tabs[g.tabs.length - 1] || null;
    if (!g.tabs.length && g.ventana !== 'principal') grupos.splice(grupos.indexOf(g), 1);   // una ventana aparte vacía se cierra
  }
  const claude = () => ({ input: new TabInputWebview('mainThreadWebview-claudeVSCodePanel'), label: 'Claude Code' });

  const ordenes = {
    'claude-vscode.sidebar.open': async () => {},
    'claude-vscode.editor.open': async (...a) => {
      const o = a[5] || {};
      const sitio = getConfiguration('claudeCode').get('preferredLocation');
      if (o.programmatic === 'honor-preferred-location' && sitio === 'sidebar') { sim.barraLateral.push(a[1]); return; }
      const g = tabGroups.activeTabGroup || grupos[0];
      const t = anadir(g, claude()); t.mensaje = a[1];
    },
    moveActiveEditor: async (args) => {
      const g = tabGroups.activeTabGroup, t = g && g.activeTab;
      const destino = args && args.by === 'group' && args.to === 'position' ? grupos[(args.value || 1) - 1] : null;
      if (!t || !destino || destino === g) return;
      quitar(t); anadir(destino, t);
    },
    'workbench.action.moveEditorToNewWindow': async () => {
      const g = tabGroups.activeTabGroup, t = g && g.activeTab;
      if (!t) return;
      quitar(t); anadir(nuevoGrupo(`aparte${grupos.length}`), t);
    },
  };

  const sim = {
    guardado, mensajes, ejecutadas, portapapeles, grupos, nuevoGrupo, anadir, claude, barraLateral: [], ordenes,
    texto: (uri) => ({ input: new TabInputText(uri), label: uri }),
  };
  const principal = nuevoGrupo('principal');
  tabGroups.activeTabGroup = principal;

  const vscode = {
    ConfigurationTarget,
    QuickPickItemKind: { Separator: -1, Default: 0 },
    TabInputWebview, TabInputText,
    EventEmitter: class { constructor() { this.l = []; this.event = (f) => { this.l.push(f); return { dispose() {} }; }; } fire(x) { this.l.forEach((f) => f(x)); } },
    TreeItem: class { constructor(label) { this.label = label; } },
    ThemeIcon: class { constructor(id) { this.id = id; } },
    Uri: { parse: (s) => ({ toString: () => s }) },
    workspace: {
      getConfiguration, workspaceFile: { fsPath: '/TCEE/main/TCEE.code-workspace' }, workspaceFolders: [{ uri: { fsPath: '/TCEE' } }],
      onDidChangeConfiguration: (f) => { oyentes.push(f); return { dispose() {} }; },
    },
    window: {
      tabGroups,
      showInformationMessage: (t) => { mensajes.push(t); return Promise.resolve(); },
      showErrorMessage: (t) => { mensajes.push(`ERROR: ${t}`); return Promise.resolve(); },
      createOutputChannel: () => ({ appendLine: (l) => sim.registro.push(l) }),
    },
    commands: {
      getCommands: async () => Object.keys(ordenes),
      executeCommand: async (c, ...a) => { ejecutadas.push(c); if (!ordenes[c]) throw new Error(`orden desconocida ${c}`); return ordenes[c](...a); },
    },
    env: { clipboard: { writeText: async (t) => { portapapeles.texto = t; } }, openExternal: async () => true },
  };
  sim.vscode = vscode; sim.registro = [];
  return sim;
}

/** Hace que require('vscode') devuelva la simulación (una nueva cada vez) y borra de la caché los módulos de la extensión */
function instalar() {
  const sim = crear();
  const original = Module._load;
  Module._load = function (pedido, ...resto) { return pedido === 'vscode' ? sim.vscode : original.call(this, pedido, ...resto); };
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(__dirname, '..')) && !k.includes(`${path.sep}pruebas${path.sep}`)) delete require.cache[k];
  return sim;
}

module.exports = { instalar };
