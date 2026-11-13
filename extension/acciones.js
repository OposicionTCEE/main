// Barra lateral TCEE, vista «Acciones»: catálogo único de las acciones. Lo usan la vista (qué se ve y en qué orden),
// la ventanita Ajustes (mostrar u ocultar cada una, ajustes.js) y Atajos (el atajo de cada orden, también el cambiado por el usuario).
// Reglas y cómo añadir una acción: main/AJUSTES.md.
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Acciones de la vista, en el orden en que se ven. «id» es lo que se guarda en el ajuste tcee.accionesOcultas:
 * no cambiarlo nunca (se perdería lo que el usuario ocultó). Una acción nueva se añade aquí y sale visible.
 */
const ACCIONES = [
  { id: 'compilar', titulo: 'Compilar tema', icono: 'play', orden: 'tcee.compilar',
    ayuda: 'Compila el tema que se muestra en el índice' },
  { id: 'revisar', titulo: 'Revisar', icono: 'open-preview', orden: 'tcee.revisar',
    ayuda: 'Ventana aparte con el tema a la izquierda y su PDF a la derecha, con el desplazamiento sincronizado. El PDF no cambia solo: botón «Actualizar»' },
  { id: 'sincronizar', titulo: 'Sincronizar con GitHub', icono: 'sync', orden: 'tcee.sincronizar',
    ayuda: 'Guarda, trae y sube los cambios de main, temario y progreso' },
  { id: 'nota', titulo: 'Nueva nota', icono: 'note', orden: 'tcee.nota',
    ayuda: 'Añade una nota al final de \\modificaciones del tema que elijas' },
  { id: 'panelOposicion', titulo: 'Panel Oposición', icono: 'dashboard', orden: 'tcee.panelOposicion',
    ayuda: 'Calendario, tiempo restante de todos los temas, relaciones, cante, test e idiomas (se abre en una ventana aparte)' },
  { id: 'atajos', titulo: 'Atajos', icono: 'keyboard', orden: 'tcee.atajos',
    ayuda: 'Todos los atajos del Panel TCEE en una ventana (se cierra con Esc; ⚙ cambia un atajo)' },
  { id: 'notasClaude', titulo: 'Notas del tema con Claude', icono: 'comment-discussion', orden: 'tcee.notasClaude',
    ayuda: 'Abre Claude Code con el encargo ya escrito (tema, pasada y documentos que debe leer: CLAUDE.md y GUIA_TEMAS.md). Solo tienes que añadir qué quieres tratar. Dónde se abre: en Ajustes' },
  { id: 'rehacerInformes', titulo: 'Rehacer informes', icono: 'beaker', orden: 'tcee.rehacerInformes',
    ayuda: 'Comprueba qué informes faltan o están desactualizados (armonización de modelos y cobertura de las preguntas de test falladas) y prepara el encargo para Claude Code' },
];

/** Siempre visible y siempre la última: sin ella no se podría volver a mostrar lo ocultado */
const AJUSTES = { id: 'ajustes', titulo: 'Ajustes', icono: 'gear', orden: 'tcee.ajustes',
  ayuda: 'Qué se ve en la barra lateral, dónde se abre Claude Code y los demás ajustes del Panel TCEE (iguales en todos tus Macs)' };

const MAC = process.platform === 'darwin';

/** «cmd+alt+k» → «⌘⌥K» en el Mac (o «Ctrl+Alt+K» en otros sistemas) */
function bonito(k) {
  return k.split(' ').map((acorde) => acorde.split('+').map((x) => (MAC
    ? ({ cmd: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' }[x] || x.toUpperCase()) : x[0].toUpperCase() + x.slice(1))).join(MAC ? '' : '+')).join(' ');
}

/** Carpeta de ajustes de usuario de VS Code (donde está keybindings.json) */
function carpetaUsuario() {
  if (MAC) return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || '', 'Code', 'User');
  return path.join(os.homedir(), '.config', 'Code', 'User');
}

/**
 * Atajo de cada orden tcee.*: el de package.json y, encima, el que el usuario haya puesto o quitado en VS Code (keybindings.json).
 * Devuelve {orden: 'cmd+alt+k' | null}. null = el usuario lo quitó.
 */
function atajos(pj) {
  const atajo = {};
  ((pj.contributes || pj).keybindings || []).forEach((k) => { atajo[k.command] = (MAC && k.mac) || k.key; });   // package.json entero o su «contributes»
  try {
    const txt = fs.readFileSync(path.join(carpetaUsuario(), 'keybindings.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[\]}])/g, '$1');
    for (const k of JSON.parse(txt)) {
      if (typeof k.command !== 'string') continue;
      if (k.command.startsWith('-tcee.')) { if (atajo[k.command.slice(1)] === k.key) atajo[k.command.slice(1)] = null; }
      else if (k.command.startsWith('tcee.')) atajo[k.command] = k.key;
    }
  } catch (e) { /* sin atajos propios */ }
  return atajo;
}

/** Ids de las acciones ocultas (ajuste tcee.accionesOcultas) */
function ocultas() {
  const v = vscode.workspace.getConfiguration('tcee').get('accionesOcultas', []);
  return new Set(Array.isArray(v) ? v : []);
}

/** Proveedor de la vista Acciones: las acciones visibles, en orden, y Ajustes al final */
class VistaAcciones {
  constructor(pj) { this.pj = pj; this._ev = new vscode.EventEmitter(); this.onDidChangeTreeData = this._ev.event; }
  refrescar() { this._ev.fire(); }
  getTreeItem(e) { return e; }
  getChildren() {
    const o = ocultas(), at = atajos(this.pj);
    return [...ACCIONES.filter((a) => !o.has(a.id)), AJUSTES].map((a) => {
      const t = new vscode.TreeItem(a.titulo);
      t.id = a.id;
      const k = at[a.orden] ? bonito(at[a.orden]) : '';
      if (k) t.description = k;   // el atajo a la vista, para irlo aprendiendo
      t.iconPath = new vscode.ThemeIcon(a.icono);
      t.command = { command: a.orden, title: a.titulo };
      t.tooltip = k ? `${a.ayuda}. Atajo: ${k}` : a.ayuda;
      return t;
    });
  }
}

module.exports = { ACCIONES, AJUSTES, VistaAcciones, bonito, atajos, ocultas };
