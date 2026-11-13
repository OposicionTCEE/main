// Prueba de «Dónde se abre Claude Code» (claudeCode.js; main/AJUSTES.md), con VS Code simulado (pruebas/vscode_simulado.js).
// Lo importante: el encargo siempre queda copiado y escrito; con «ventana aparte», la segunda vez va a la misma ventana;
// y nunca se mueve a otra ventana un editor que no sea la conversación nueva (un tema, por ejemplo).
// Uso: node pruebas/claude_code.js   (sale con código 1 si alguna comprobación falla)
'use strict';
const { instalar } = require('./vscode_simulado');

let fallos = 0;
const comprobar = (nombre, ok, detalle) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${!ok && detalle ? ` (${detalle})` : ''}`); if (!ok) fallos++; };
const ENC = 'Lee main/CLAUDE.md… Quiero tratar: ';

(async () => {
  // ---- barra lateral (por defecto, como hasta la v0.52)
  let sim = instalar();
  let { abrirClaude } = require('../claudeCode');
  let r = await abrirClaude(ENC, 'añade al final qué quieres tratar y pulsa Intro');
  comprobar('por defecto: barra lateral con el encargo escrito', r === 'barraLateral' && sim.barraLateral[0] === ENC, r);
  comprobar('el encargo queda copiado', sim.portapapeles.texto === ENC);
  comprobar('el aviso dice qué hacer', /añade al final qué quieres tratar/.test(sim.mensajes[0] || ''), sim.mensajes[0]);

  // ---- pestaña
  sim = instalar(); ({ abrirClaude } = require('../claudeCode'));
  sim.guardado.workspace['tcee.claudeAbrirEn'] = 'pestana';
  r = await abrirClaude(ENC, 'pulsa Intro');
  const enPestana = sim.grupos[0].tabs.find((t) => t.mensaje === ENC);
  comprobar('pestaña: conversación nueva en el editor con el encargo', r === 'pestana' && !!enPestana && sim.grupos.length === 1, r);
  comprobar('pestaña: Claude Code queda con preferencia «panel»', sim.guardado.global['claudeCode.preferredLocation'] === 'panel');

  // ---- ventana aparte: primera vez → ventana nueva; segunda → la misma
  sim = instalar(); ({ abrirClaude } = require('../claudeCode'));
  sim.guardado.workspace['tcee.claudeAbrirEn'] = 'ventanaNueva';
  const tema = sim.anadir(sim.grupos[0], sim.texto('3.B.20/main.tex'));
  r = await abrirClaude(ENC, 'pulsa Intro');
  comprobar('1.ª vez: ventana nueva', r === 'nueva' && sim.grupos.length === 2, `${r}, grupos ${sim.grupos.length}`);
  comprobar('1.ª vez: el tema sigue en la ventana principal', sim.grupos[0].tabs.includes(tema));
  comprobar('1.ª vez: en la ventana nueva solo está la conversación', sim.grupos[1].tabs.length === 1 && sim.grupos[1].tabs[0].mensaje === ENC);
  sim.grupos[0].activeTab = tema; sim.vscode.window.tabGroups.activeTabGroup = sim.grupos[0];   // el usuario vuelve a su tema
  r = await abrirClaude('segundo', 'pulsa Intro');
  comprobar('2.ª vez: a la misma ventana', r === 'misma' && sim.grupos.length === 2 && sim.grupos[1].tabs.length === 2, `${r}, grupos ${sim.grupos.length}`);
  comprobar('2.ª vez: el tema no se ha movido', sim.grupos[0].tabs.includes(tema) && !sim.grupos[1].tabs.includes(tema));

  // ---- ventana aparte tras recargar: vale una ventana que solo tenga conversaciones de Claude
  sim = instalar(); ({ abrirClaude } = require('../claudeCode'));
  sim.guardado.workspace['tcee.claudeAbrirEn'] = 'ventanaNueva';
  sim.anadir(sim.grupos[0], sim.texto('3.A.1/main.tex'));
  const aparte = sim.nuevoGrupo('aparte'); sim.anadir(aparte, sim.claude(), false);
  sim.vscode.window.tabGroups.activeTabGroup = sim.grupos[0];
  r = await abrirClaude(ENC, 'pulsa Intro');
  comprobar('tras recargar: usa la ventana de Claude que ya había', r === 'misma' && aparte.tabs.length === 2 && sim.grupos.length === 2, `${r}, grupos ${sim.grupos.length}`);

  // ---- en la ventana principal solo hay una conversación de Claude: no es «la ventana de Claude», se abre una aparte
  sim = instalar(); ({ abrirClaude } = require('../claudeCode'));
  sim.guardado.workspace['tcee.claudeAbrirEn'] = 'ventanaNueva';
  sim.anadir(sim.grupos[0], sim.claude());
  r = await abrirClaude(ENC, 'pulsa Intro');
  comprobar('principal con solo Claude: ventana nueva igualmente', r === 'nueva' && sim.grupos.length === 2 && sim.grupos[0].tabs.length === 1, `${r}, grupos ${sim.grupos.length}`);

  // ---- si la conversación nueva no queda como editor activo, no se mueve nada
  sim = instalar(); ({ abrirClaude } = require('../claudeCode'));
  sim.guardado.workspace['tcee.claudeAbrirEn'] = 'ventanaNueva';
  const otro = sim.anadir(sim.grupos[0], sim.texto('3.A.2/main.tex'));
  const original = sim.ordenes['claude-vscode.editor.open'];
  sim.ordenes['claude-vscode.editor.open'] = async (...a) => { await original(...a); sim.grupos[0].activeTab = otro; };   // Claude la abre de fondo
  r = await abrirClaude(ENC, 'pulsa Intro');
  comprobar('conversación de fondo: no se mueve ningún editor', r === 'pestana' && sim.grupos.length === 1 && sim.grupos[0].tabs.includes(otro), `${r}, grupos ${sim.grupos.length}`);
  comprobar('conversación de fondo: el aviso lo dice', /no he podido llevarlo a una ventana aparte/.test(sim.mensajes[0] || ''), sim.mensajes[0]);

  // ---- sin las órdenes de Claude Code: el enlace vscode:// (y el encargo copiado)
  sim = instalar(); ({ abrirClaude } = require('../claudeCode'));
  delete sim.ordenes['claude-vscode.editor.open']; delete sim.ordenes['claude-vscode.sidebar.open'];
  r = await abrirClaude(ENC, 'pulsa Intro');
  comprobar('sin órdenes de Claude Code: enlace y encargo copiado', r === 'barraLateral' && sim.portapapeles.texto === ENC, r);

  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
