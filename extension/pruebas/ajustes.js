// Prueba de la ventanita Ajustes y del catálogo de acciones (main/AJUSTES.md), sin abrir VS Code.
// Comprueba que acciones.js, ajustes.js, extension.js y package.json cuentan lo mismo, y que ocultar y guardar funcionan.
// Uso: node pruebas/ajustes.js   (sale con código 1 si alguna comprobación falla)
'use strict';
const fs = require('fs');
const path = require('path');
const { instalar } = require('./vscode_simulado');

let fallos = 0;
const comprobar = (nombre, ok, detalle) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${!ok && detalle ? ` (${detalle})` : ''}`); if (!ok) fallos++; };

(async () => {
  const sim = instalar();
  const pj = require('../package.json');
  const props = pj.contributes.configuration.properties;
  const { ACCIONES, AJUSTES, VistaAcciones } = require('../acciones');
  const { SECCIONES, guardar } = require('../ajustes');
  const ext = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
  const ordenes = new Set(pj.contributes.commands.map((c) => c.command));

  // ---- catálogo de acciones
  const ids = ACCIONES.map((a) => a.id);
  comprobar('ids de acción sin repetir', new Set(ids).size === ids.length);
  const enumOcultas = props['tcee.accionesOcultas'].items.enum;
  comprobar('package.json enumera las mismas acciones que el catálogo', JSON.stringify(enumOcultas) === JSON.stringify(ids), `${enumOcultas} ≠ ${ids}`);
  for (const a of [...ACCIONES, AJUSTES]) {
    comprobar(`«${a.titulo}»: su orden está declarada en package.json`, ordenes.has(a.orden), a.orden);
    comprobar(`«${a.titulo}»: su orden se registra en extension.js`, ext.includes(`registerCommand('${a.orden}'`), a.orden);
  }

  // ---- la ventanita y package.json coinciden
  const claves = new Set(['tcee.accionesOcultas']);
  for (const s of SECCIONES) for (const e of s.entradas) {
    if (e.tipo === 'accion') { comprobar(`acción ${e.id} en la ventanita existe en el catálogo`, ids.includes(e.id)); continue; }
    const p = props[`tcee.${e.clave}`];
    claves.add(`tcee.${e.clave}`);
    comprobar(`ajuste tcee.${e.clave} declarado en package.json`, !!p);
    if (!p) continue;
    if (e.tipo === 'siNo') comprobar(`tcee.${e.clave} es de sí o no`, p.type === 'boolean');
    if (e.tipo === 'opcion') {
      comprobar(`tcee.${e.clave}: mismas opciones y orden que package.json`, JSON.stringify(e.opciones.map((o) => o.valor)) === JSON.stringify(p.enum));
      comprobar(`tcee.${e.clave}: mismos nombres que package.json`, JSON.stringify(e.opciones.map((o) => o.titulo)) === JSON.stringify(p.enumItemLabels));
      comprobar(`tcee.${e.clave}: valor por defecto válido`, p.enum.includes(p.default));
    }
  }
  const sueltas = Object.keys(props).filter((k) => !claves.has(k));
  comprobar('todos los ajustes de package.json están en la ventanita', !sueltas.length, sueltas.join(', '));
  const indice = pj.contributes.views.tceePanel.find((v) => v.id === 'tcee.indice');
  comprobar('el Índice se oculta con tcee.indiceVisible', indice.when === 'config.tcee.indiceVisible');
  comprobar('⚙ en la cabecera de Acciones', pj.contributes.menus['view/title'].some((m) => m.command === 'tcee.ajustes' && m.when === 'view == tcee.acciones'));

  // ---- vista Acciones
  const vista = new VistaAcciones(pj);
  let titulos = vista.getChildren().map((t) => t.label);
  comprobar('sin ajustes: se ven todas las acciones y Ajustes al final', JSON.stringify(titulos) === JSON.stringify([...ACCIONES.map((a) => a.titulo), 'Ajustes']), titulos.join(' | '));
  const atajosItem = vista.getChildren().find((t) => t.id === 'atajos');
  comprobar('Atajos lleva su atajo al lado (sale de package.json)', !!atajosItem.description, atajosItem.description);
  await guardar('accionesOcultas', ['compilar', 'atajos', 'ajustes']);
  titulos = vista.getChildren().map((t) => t.label);
  comprobar('ocultas Compilar y Atajos: no se ven; Ajustes sigue (aunque se intente ocultar)', !titulos.includes('Compilar tema') && !titulos.includes('Atajos') && titulos[titulos.length - 1] === 'Ajustes', titulos.join(' | '));
  comprobar('se guarda en el espacio de trabajo (TCEE.code-workspace)', JSON.stringify(sim.guardado.workspace['tcee.accionesOcultas']) === JSON.stringify(['compilar', 'atajos', 'ajustes']));

  // ---- guardar: lo que queda igual que por defecto no se escribe
  await guardar('accionesOcultas', []);
  comprobar('volver a mostrarlas todas quita el ajuste del fichero', !('tcee.accionesOcultas' in sim.guardado.workspace));
  await guardar('claudeAbrirEn', 'ventanaNueva');
  comprobar('elegir dónde se abre Claude Code se guarda', sim.guardado.workspace['tcee.claudeAbrirEn'] === 'ventanaNueva');
  sim.guardado.global['tcee.botonAtajos'] = false;   // el usuario lo tenía apagado en sus ajustes de usuario
  await guardar('botonAtajos', true);
  comprobar('si los ajustes de usuario dicen otra cosa, se escribe explícito', sim.guardado.workspace['tcee.botonAtajos'] === true);

  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
