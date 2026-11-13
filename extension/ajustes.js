// Ventanita «Ajustes» del Panel TCEE (acción Ajustes de la barra lateral y ⚙ en la cabecera de Acciones).
// La lista es declarativa: cada entrada es un ajuste declarado en package.json (contributes.configuration) y se pinta sola.
// Se guardan en el espacio de trabajo (TCEE.code-workspace): viajan con Sincronizar y son iguales en todos los Macs.
// Reglas y cómo añadir un ajuste: main/AJUSTES.md. La prueba pruebas/ajustes.js comprueba que esta lista y package.json coinciden.
'use strict';
const vscode = require('vscode');
const { ACCIONES, ocultas } = require('./acciones');

/** Valores de «Dónde se abre Claude Code» (los usa también claudeCode.js) */
const DONDE_CLAUDE = [
  { valor: 'barraLateral', titulo: 'En la barra lateral', detalle: 'A la derecha, junto al panel TCEE (como hasta ahora).' },
  { valor: 'pestana', titulo: 'En una pestaña', detalle: 'En una pestaña nueva del editor, junto a tus temas.' },
  { valor: 'ventanaNueva', titulo: 'En una ventana aparte', detalle: 'En tu ventana de Claude si ya hay una abierta; si no, en una ventana nueva.' },
];

/**
 * Secciones de la ventanita, en orden. Tipos de entrada:
 *  - accion: mostrar u ocultar una acción de la vista Acciones (se guarda en la lista tcee.accionesOcultas)
 *  - siNo: ajuste de sí o no (clave sin «tcee.»)
 *  - opcion: ajuste con valores fijos (clave + opciones [{valor, titulo, detalle}], en el orden de package.json)
 */
const SECCIONES = [
  { titulo: 'Acciones de la barra lateral', entradas: ACCIONES.map((a) => ({ tipo: 'accion', id: a.id, titulo: a.titulo })) },
  { titulo: 'Barra lateral y barra inferior', entradas: [
    { tipo: 'siNo', clave: 'indiceVisible', titulo: 'Índice del tema (debajo de Acciones)' },
    { tipo: 'siNo', clave: 'botonAtajos', titulo: 'Botón «Atajos» en la barra inferior (al editar un tema)' },
  ] },
  { titulo: 'Claude Code', entradas: [
    { tipo: 'opcion', clave: 'claudeAbrirEn', titulo: 'Dónde se abre (Notas del tema con Claude y Rehacer informes)', opciones: DONDE_CLAUDE },
  ] },
  { titulo: 'Al abrir un tema', entradas: [
    { tipo: 'siNo', clave: 'notasContraidasAlAbrir', titulo: 'Contraer las notas al pie' },
    { tipo: 'siNo', clave: 'preambuloContraidoAlAbrir', titulo: 'Plegar el preámbulo' },
  ] },
  { titulo: 'Al guardar', entradas: [
    { tipo: 'siNo', clave: 'fusionAlGuardar', titulo: 'Combinar tus cambios con los de Claude (fusión al guardar)' },
  ] },
];

const conf = () => vscode.workspace.getConfiguration('tcee');

/** En el espacio de trabajo si hay uno abierto (TCEE.code-workspace); si no, en los ajustes de usuario */
const destino = () => (vscode.workspace.workspaceFile || (vscode.workspace.workspaceFolders || []).length
  ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global);

/** Guarda un ajuste. Si queda igual que el valor por defecto se quita del fichero (que no se llene de valores que no cambian nada) */
async function guardar(clave, valor) {
  const def = (conf().inspect(clave) || {}).defaultValue;
  const igual = JSON.stringify(valor) === JSON.stringify(def);
  await conf().update(clave, igual ? undefined : valor, destino());
  // si en los ajustes de usuario había otro valor, quitarlo del espacio de trabajo no basta: se escribe explícito
  if (igual && JSON.stringify(conf().get(clave)) !== JSON.stringify(valor)) await conf().update(clave, valor, destino());
}

/** Valor actual de una entrada (true = se ve, en las acciones) */
const valor = (e) => (e.tipo === 'accion' ? !ocultas().has(e.id) : conf().get(e.clave));

/** Cambia una entrada de sí o no (o una acción visible/oculta) */
async function alternar(e) {
  if (e.tipo === 'accion') {
    const o = ocultas();
    if (o.has(e.id)) o.delete(e.id); else o.add(e.id);
    await guardar('accionesOcultas', ACCIONES.map((a) => a.id).filter((id) => o.has(id)));   // en el orden del catálogo
  } else {
    await guardar(e.clave, !valor(e));
  }
}

function elementos() {
  const items = [];
  for (const s of SECCIONES) {
    items.push({ label: s.titulo, kind: vscode.QuickPickItemKind.Separator });
    for (const e of s.entradas) {
      const v = valor(e);
      if (e.tipo === 'accion') items.push({ label: `$(${v ? 'eye' : 'eye-closed'}) ${e.titulo}`, description: v ? 'se ve' : 'oculta', entrada: e });
      else if (e.tipo === 'siNo') items.push({ label: `$(${v ? 'pass-filled' : 'circle-large-outline'}) ${e.titulo}`, description: v ? 'sí' : 'no', entrada: e });
      else {
        const o = e.opciones.find((x) => x.valor === v) || e.opciones[0];
        items.push({ label: `$(settings) ${e.titulo}`, description: o.titulo, detail: o.detalle, entrada: e });
      }
    }
  }
  return items;
}

/** Abre la ventanita. activa: entrada que queda marcada (al volver de elegir una opción) */
function abrir(context, activa) {
  const qp = vscode.window.createQuickPick();
  qp.title = `Ajustes del Panel TCEE · versión ${context.extension.packageJSON.version}`;
  qp.placeholder = 'Intro cambia lo marcado · Esc cierra · Se guardan en TCEE.code-workspace: iguales en todos tus Macs';
  qp.matchOnDescription = true;
  const pintar = (e) => {
    qp.items = elementos();
    const it = e && qp.items.find((x) => x.entrada === e);
    if (it) qp.activeItems = [it];
  };
  let siguiente = null;   // al elegir una opción se abre otra lista y luego se vuelve aquí
  qp.onDidAccept(async () => {
    const it = qp.activeItems[0];
    if (!it || !it.entrada) return;
    const e = it.entrada;
    if (e.tipo === 'opcion') { siguiente = e; qp.hide(); return; }
    qp.busy = true;
    try { await alternar(e); } catch (x) { vscode.window.showErrorMessage(`No he podido guardar el ajuste: ${x.message}`); }
    qp.busy = false;
    pintar(e);
  });
  qp.onDidHide(() => { qp.dispose(); if (siguiente) elegirOpcion(context, siguiente); });
  pintar(activa);
  qp.show();
}

/** Lista de valores de un ajuste de tipo «opcion»; al elegir (o con Esc) vuelve a la ventanita */
async function elegirOpcion(context, e) {
  const actual = valor(e);
  const items = e.opciones.map((o) => ({ label: `$(${o.valor === actual ? 'pass-filled' : 'circle-large-outline'}) ${o.titulo}`, detail: o.detalle, o }));
  const elegido = await vscode.window.showQuickPick(items, { title: e.titulo, placeHolder: 'Elige y pulsa Intro (Esc vuelve sin cambiar)' });
  if (elegido && elegido.o.valor !== actual) {
    try { await guardar(e.clave, elegido.o.valor); } catch (x) { vscode.window.showErrorMessage(`No he podido guardar el ajuste: ${x.message}`); }
  }
  abrir(context, e);
}

module.exports = { SECCIONES, DONDE_CLAUDE, abrir, guardar };
