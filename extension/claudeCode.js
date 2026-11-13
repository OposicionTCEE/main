// Abre Claude Code con un encargo ya escrito, donde diga el ajuste tcee.claudeAbrirEn (main/AJUSTES.md, «Dónde se abre Claude Code»).
// Lo usan «Notas del tema con Claude» y «Rehacer informes».
//  - barraLateral: en la barra lateral (como hasta la v0.52).
//  - pestana: en una pestaña nueva del editor.
//  - ventanaNueva: se abre como pestaña y se lleva a la ventana de Claude que abrió el panel, si sigue abierta (o a un grupo que solo
//    tenga conversaciones de Claude, p. ej. tras recargar); si no la hay, a una ventana nueva. Si no se puede mover, se queda en la pestaña y se dice.
// El encargo se copia siempre al portapapeles: si una versión de Claude Code no admite el mensaje prellenado, basta con pegarlo (⌘V).
// Cada paso queda en Salida › «Panel TCEE: Claude Code», para saber qué pasó si algo no sale como se espera.
'use strict';
const vscode = require('vscode');

let salida = null;
function log(t) {
  if (!salida) salida = vscode.window.createOutputChannel('Panel TCEE: Claude Code');
  salida.appendLine(`${new Date().toLocaleTimeString('es-ES')}  ${t}`);
}

const esClaude = (tab) => !!tab && tab.input instanceof vscode.TabInputWebview && /claude/i.test(tab.input.viewType);
const pestanas = () => vscode.window.tabGroups.all.flatMap((g) => g.tabs.filter(esClaude).map((t) => ({ g, t })));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
/** Espera hasta que cond() devuelva algo (o null si pasa el tiempo) */
async function esperar(cond, ms) {
  const fin = Date.now() + ms;
  for (;;) { const r = cond(); if (r) return r; if (Date.now() > fin) return null; await pausa(100); }
}

/** Grupo de la ventana de Claude abierta por el panel (se olvida al cerrarla o al recargar) */
let grupoVentana = null;

/**
 * Grupo al que llevar una conversación nueva: el de la ventana de Claude del panel o, si no (p. ej. tras recargar), el último grupo
 * con solo conversaciones de Claude que no sea el primero (el primero es siempre de la ventana principal: VS Code cuenta primero sus grupos)
 */
function ventanaDeClaude() {
  const grupos = vscode.window.tabGroups.all;
  if (grupoVentana && grupos.includes(grupoVentana) && grupoVentana.tabs.some(esClaude)) return grupoVentana;
  const solo = grupos.filter((g) => g.viewColumn > 1 && g.tabs.length && g.tabs.every(esClaude));
  return solo.length ? solo[solo.length - 1] : null;
}

/** Sitio preferido de Claude Code («sidebar» o «panel» = pestaña): su orden «editor.open» lo respeta en modo programático */
async function preferir(sitio) {
  const c = vscode.workspace.getConfiguration('claudeCode');
  if (c.get('preferredLocation') !== sitio) await c.update('preferredLocation', sitio, vscode.ConfigurationTarget.Global);
}

/** Abre una conversación nueva con el encargo escrito, en la barra lateral («sidebar») o en una pestaña («panel») */
async function abrirConMensaje(encargo, sitio) {
  const cmds = await vscode.commands.getCommands(true);
  if (cmds.includes('claude-vscode.editor.open') && (sitio === 'panel' || cmds.includes('claude-vscode.sidebar.open'))) {
    // «sidebar.open» guarda la preferencia sin esperar: por eso se fija antes y se espera (si no, «editor.open» aún lee la anterior)
    await preferir(sitio);
    if (sitio === 'sidebar') await vscode.commands.executeCommand('claude-vscode.sidebar.open');
    await vscode.commands.executeCommand('claude-vscode.editor.open', undefined, encargo, undefined, undefined, undefined,
      { programmatic: 'honor-preferred-location' });
    log(`abierto con claude-vscode.editor.open (${sitio})`);
    return true;
  }
  // sin esas órdenes: el enlace vscode:// abre una pestaña con el mensaje (documentado por Claude Code)
  log('sin claude-vscode.editor.open: enlace vscode://anthropic.claude-code/open');
  return vscode.env.openExternal(vscode.Uri.parse('vscode://anthropic.claude-code/open?prompt=' + encodeURIComponent(encargo)));
}

/** Pestaña nueva y, después, a la ventana de Claude (la misma si se puede). Devuelve 'misma' | 'nueva' | 'pestana' | null */
async function enVentana(encargo) {
  const candidato = ventanaDeClaude();   // antes de abrir: luego el grupo donde cae la pestaña nueva podría parecer «solo de Claude»
  const antes = new Set(pestanas().map((x) => x.t));
  if (!(await abrirConMensaje(encargo, 'panel'))) return null;
  const nueva = await esperar(() => pestanas().find((x) => !antes.has(x.t)), 6000);
  if (!nueva) { log('no aparece la pestaña nueva de Claude: no se mueve nada'); return 'pestana'; }
  if (candidato && nueva.g === candidato) { log('ya está en la ventana de Claude'); grupoVentana = candidato; return 'misma'; }
  await pausa(300);   // que la conversación termine de cargar antes de moverla
  // solo se mueve el editor activo: nunca otro (un tema, por ejemplo)
  const activo = vscode.window.tabGroups.activeTabGroup;
  if (activo !== nueva.g || activo.activeTab !== nueva.t) { log('la pestaña nueva no es la activa: se queda donde está'); return 'pestana'; }
  if (candidato && vscode.window.tabGroups.all.includes(candidato)) {
    const n = candidato.tabs.filter(esClaude).length;
    try {
      // «position» cuenta los grupos de todas las ventanas en el mismo orden que viewColumn; si no existe, no hace nada
      await vscode.commands.executeCommand('moveActiveEditor', { to: 'position', by: 'group', value: candidato.viewColumn });
    } catch (e) { log(`moveActiveEditor falló: ${e.message}`); }
    if (await esperar(() => candidato.tabs.filter(esClaude).length > n, 2000)) { log(`llevada a la ventana de Claude (grupo ${candidato.viewColumn})`); grupoVentana = candidato; return 'misma'; }
    log('no se pudo llevar a la ventana de Claude: se abre otra');
  }
  const g = vscode.window.tabGroups.activeTabGroup;
  if (!esClaude(g.activeTab)) { log('el editor activo ya no es la conversación: no se mueve'); return 'pestana'; }
  await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
  const g2 = await esperar(() => { const x = vscode.window.tabGroups.activeTabGroup; return x !== g && esClaude(x.activeTab) ? x : null; }, 3000);
  if (g2) { grupoVentana = g2; log(`ventana nueva de Claude (grupo ${g2.viewColumn})`); return 'nueva'; }
  log('moveEditorToNewWindow no confirmó la ventana nueva');
  return 'nueva';
}

/**
 * Abre Claude Code con el encargo escrito donde diga el ajuste y avisa al usuario.
 * indicacion: lo que tiene que hacer después (p. ej. «añade al final qué quieres tratar y pulsa Intro»).
 */
async function abrirClaude(encargo, indicacion) {
  await vscode.env.clipboard.writeText(encargo);
  const donde = vscode.workspace.getConfiguration('tcee').get('claudeAbrirEn', 'barraLateral');
  log(`abrir en: ${donde}`);
  let r = null;
  try {
    if (donde === 'ventanaNueva') r = await enVentana(encargo);
    else r = (await abrirConMensaje(encargo, donde === 'pestana' ? 'panel' : 'sidebar')) ? donde : null;
  } catch (e) { log(`error: ${e.message}`); r = null; }
  const pegar = '(Si no aparece escrito, está copiado: pégalo con ⌘V.)';
  const texto = {
    barraLateral: `Encargo escrito en Claude Code: ${indicacion}. ${pegar}`,
    pestana: donde === 'ventanaNueva'
      ? `Claude Code se ha abierto en una pestaña: no he podido llevarlo a una ventana aparte. ${indicacion[0].toUpperCase()}${indicacion.slice(1)}. ${pegar}`
      : `Encargo escrito en Claude Code: ${indicacion}. ${pegar}`,
    misma: `Encargo escrito en tu ventana de Claude Code: ${indicacion}. ${pegar}`,
    nueva: `Encargo escrito en una ventana nueva de Claude Code (los siguientes irán a esa misma mientras siga abierta): ${indicacion}. ${pegar}`,
  }[r];
  vscode.window.showInformationMessage(texto || `Encargo copiado. Abre Claude Code, pégalo (⌘V) y ${indicacion}.`);
  return r;
}

module.exports = { abrirClaude };
