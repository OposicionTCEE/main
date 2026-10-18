// Pruebas de la fusión al guardar (main/EDICION_SIMULTANEA.md). Uso, desde la carpeta TCEE:
//   node main/scripts/prueba_fusion.js                 → prueba la extensión de main/extension
//   node main/scripts/prueba_fusion.js <extension.js>  → prueba otra copia (la 0.48 no la pasa: líneas pegadas y prueba A, el fallo corregido)
// Parte 1: las funciones de fusion.js (diferencias, fusión, ediciones, resolver), con casos aleatorios y un tema real si está.
// Parte 2: activarFusion con un VS Code simulado que se comporta como el de verdad (ver comentario de la parte 2).
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert'), Module = require('module');
const EXT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'extension', 'extension.js'));

// ===================== Parte 1: fusion.js =====================
{
  const F = require(path.join(path.dirname(EXT), 'fusion.js'));
  let n = 0;
  // 1. diferencias reconstruyen b
  function rnd(seed){ let s=seed; return ()=> (s = (s*1103515245+12345) % 2147483648) / 2147483648; }
  for (let t=0; t<3000; t++) {
    const r = rnd(t+1);
    const base = Array.from({length: Math.floor(r()*40)}, () => 'l' + Math.floor(r()*8));
    const mut = (arr) => { const a = arr.slice(); const k = Math.floor(r()*5); for (let i=0;i<k;i++){ const p=Math.floor(r()*(a.length+1)); const op=r(); if(op<0.33) a.splice(p,0,'n'+Math.floor(r()*8)); else if(op<0.66) a.splice(p,1); else a[p]='m'+Math.floor(r()*8);} return a.filter(x=>x!==undefined); };
    const b = mut(base);
    // reconstrucción
    let out=[], pos=0;
    for (const d of F.diferencias(base,b)) { out.push(...base.slice(pos,d.a0), ...b.slice(d.b0,d.b1)); pos=d.a1; }
    out.push(...base.slice(pos));
    assert.deepStrictEqual(out, b); 
    // ediciones
    const A=base.join('\n'), B=b.join('\n');
    assert.strictEqual(F.aplicar(A, F.ediciones(A,B)), B);
    // fusión: si solo cambia un lado, resultado = ese lado
    assert.strictEqual(F.fusionar(A, B, A).texto, B);
    assert.strictEqual(F.fusionar(A, A, B).texto, B);
    assert.strictEqual(F.fusionar(A, B, B).texto, B);
    n++;
  }
  // 2. cambios en partes distintas se combinan sin conflicto
  const base = Array.from({length: 200}, (_, i) => 'Línea ' + i).join('\n');
  const L = base.split('\n');
  const tuyo = L.slice(); tuyo[20] = 'Línea 20 retocada por el usuario'; tuyo.splice(50, 0, 'Párrafo nuevo del usuario');
  const disco = L.slice(); disco[150] = 'Línea 150 cambiada por Claude'; disco.push('Anexo nuevo de Claude');
  const r = F.fusionar(base, tuyo.join('\n'), disco.join('\n'));
  assert.strictEqual(r.conflictos.length, 0);
  const esperado = tuyo.slice(); esperado[151] = 'Línea 150 cambiada por Claude'; esperado.push('Anexo nuevo de Claude');
  assert.strictEqual(r.texto, esperado.join('\n'));
  // 3. mismo trozo: conflicto, tuyo + bloque comentado; resolver en ambos sentidos
  const t2 = L.slice(); t2[80] = 'Versión del usuario';
  const d2 = L.slice(); d2[80] = 'Versión de Claude'; d2[10] = 'Claude toca otra cosa';
  const r2 = F.fusionar(base, t2.join('\n'), d2.join('\n'), 'x');
  assert.strictEqual(r2.conflictos.length, 1);
  assert.ok(r2.texto.includes('Versión del usuario\n' + F.MARCA_INI + ' [x-1]'));
  assert.ok(r2.texto.includes('% Versión de Claude\n' + F.MARCA_FIN + ' [x-1]'));
  assert.ok(r2.texto.includes('Claude toca otra cosa'));
  const mia = F.resolver(r2.texto, r2.conflictos[0], 'tuya');
  const suya = F.resolver(r2.texto, r2.conflictos[0], 'disco');
  const e1 = t2.slice(); e1[10] = 'Claude toca otra cosa';
  assert.strictEqual(mia, e1.join('\n'));
  assert.strictEqual(suya, d2.join('\n'));
  // 3b. líneas pegadas pero distintas: se combinan; dos inserciones en el mismo sitio: conflicto
  { const t = L.slice(); t[30] = 'Usuario 30'; const d = L.slice(); d[31] = 'Claude 31'; d[29] = 'Claude 29';
    const r = F.fusionar(base, t.join('\n'), d.join('\n')); assert.strictEqual(r.conflictos.length, 0);
    const e = L.slice(); e[29] = 'Claude 29'; e[30] = 'Usuario 30'; e[31] = 'Claude 31'; assert.strictEqual(r.texto, e.join('\n')); }
  { const t = L.slice(); t.splice(40, 0, 'Nuevo del usuario'); const d = L.slice(); d.splice(40, 0, 'Nuevo de Claude');
    const r = F.fusionar(base, t.join('\n'), d.join('\n')); assert.strictEqual(r.conflictos.length, 1); }
  { const t = L.slice(); t.splice(40, 1); const d = L.slice(); d.splice(41, 0, 'Insertado por Claude tras la 40');   // borra la 40 / inserta tras ella
    const r = F.fusionar(base, t.join('\n'), d.join('\n')); assert.strictEqual(r.conflictos.length, 0);
    const e = L.slice(); e.splice(40, 1, 'Insertado por Claude tras la 40'); assert.strictEqual(r.texto, e.join('\n')); }
  // 3c. propiedad: cambios aleatorios en mitades distintas del fichero (separadas por una línea intacta) se combinan siempre
  for (let k = 0; k < 2000; k++) {
    const r = rnd(k + 7), N = 10 + Math.floor(r() * 40), m = Math.floor(N / 2);
    const B = Array.from({ length: N }, (_, i) => 'b' + i);
    const mutar = (a0, a1, pre) => { const a = B.slice(a0, a1); const q = 1 + Math.floor(r() * 4);
      for (let i = 0; i < q; i++) { const p = Math.floor(r() * (a.length + 1)), op = r();
        if (op < 0.33) a.splice(p, 0, pre + i); else if (op < 0.66 && a.length) a.splice(Math.min(p, a.length - 1), 1); else if (a.length) a[Math.min(p, a.length - 1)] = pre + 'm' + i; }
      return a; };
    const izq = mutar(0, m, 'u'), der = mutar(m + 1, N, 'c');
    const T = izq.concat(B.slice(m)), D = B.slice(0, m + 1).concat(der);
    const res = F.fusionar(B.join('\n'), T.join('\n'), D.join('\n'));
    assert.strictEqual(res.conflictos.length, 0); assert.strictEqual(res.texto, izq.concat([B[m]], der).join('\n'));
  }
  // 3d. un conflicto cuyo trozo ya lleva un bloque de conflicto: no se anida, se deja el tuyo
  { const t = L.slice(); t[90] = 'Usuario 90'; const d = L.slice(); d[90] = 'Claude 90';
    const r1 = F.fusionar(base, t.join('\n'), d.join('\n'), 'a'); const conBloque = r1.texto;
    const d3 = d.slice(); d3[90] = 'Claude 90 otra vez';
    const r3 = F.fusionar(base, conBloque, d3.join('\n'), 'b');
    assert.strictEqual(r3.conflictos.length, 0); assert.strictEqual(r3.omitidos, 1); assert.strictEqual(r3.texto, conBloque); }
  // 4. tema real grande
  const real = path.join(__dirname, '..', '..', 'temario', 'Ejercicio-3', 'Parte-B', '3.B.34', 'main.tex');
  const tema = fs.existsSync(real) ? fs.readFileSync(real, 'utf8') : Array.from({ length: 1700 }, (_, i) => `Párrafo ${i} con texto de relleno.`).join('\n');
  const TL = tema.split('\n');
  const tu = TL.slice(); tu[1200] = tu[1200] + ' (añadido del usuario)';
  const cl = TL.slice(); cl.splice(1500, 3, 'Claude reescribe tres líneas'); cl[100] = '% Claude en el preámbulo';
  let t0 = Date.now(); const r4 = F.fusionar(tema, tu.join('\n'), cl.join('\n')); const ms = Date.now() - t0;
  assert.strictEqual(r4.conflictos.length, 0);
  const e4 = cl.slice(); e4[1200] = tu[1200];
  assert.strictEqual(r4.texto, e4.join('\n'));
  assert.strictEqual(F.aplicar(tu.join('\n'), F.ediciones(tu.join('\n'), r4.texto)), r4.texto);
  // 5. reescritura total (peor caso)
  const rev = TL.slice().reverse().join('\n');
  t0 = Date.now(); const r5 = F.fusionar(tema, tu.join('\n'), rev); const ms5 = Date.now() - t0;
  console.log('aleatorias', n, '| tema real', TL.length, 'líneas en', ms, 'ms | peor caso', ms5, 'ms, conflictos', r5.conflictos.length);
  console.log('parte 1 bien');
}

// ===================== Parte 2: activarFusion con VS Code simulado =====================
{
  // Simula VS Code (lo justo) para probar activarFusion con lo que hace de verdad VS Code:
  //  - el primer cambio tras guardar llega con isDirty === false (dato desfasado; issue microsoft/vscode#27231);
  //  - si el documento no tiene cambios y el disco cambia, VS Code lo recarga (evento de cambio con isDirty false);
  //  - el guardado puede reintentarse (onWillSave dos veces antes de onDidSave).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcee-fusion-'));
  const fich = path.join(dir, 'main.tex');
  const L = Array.from({ length: 300 }, (_, i) => 'Línea ' + i);
  fs.writeFileSync(fich, L.join('\n'));
  const ev = {}; const on = (n) => (f) => { (ev[n] = ev[n] || []).push(f); return { dispose() {} }; };
  const emit = (n, x) => (ev[n] || []).forEach((g) => g(x));
  class Pos { constructor(l, c) { this.line = l; this.character = c; } }
  class Range { constructor(a, b, c, d) { if (a instanceof Pos) { this.start = a; this.end = b; } else { this.start = new Pos(a, b); this.end = new Pos(c, d); } } }
  const doc = { uri: { scheme: 'file', fsPath: fich, toString: () => 'file://' + fich }, languageId: 'latex', texto: L.join('\n'), isDirty: false,
    getText() { return this.texto; },
    positionAt(o) { const t = this.texto.slice(0, o).split('\n'); return new Pos(t.length - 1, t[t.length - 1].length); },
    offsetAt(p) { const ls = this.texto.split('\n'); let o = 0; for (let i = 0; i < p.line; i++) o += ls[i].length + 1; return o + p.character; } };
  const avisos = [], registro = [];
  let ajuste = true, elegir = 'Quedarme con la mía';
  const cfg = { files: 'overwriteFileOnDisk' };
  const vscode = { Range, Position: Pos, TextEdit: { replace: (r, t) => ({ r, t }) }, WorkspaceEdit: class { constructor() { this.e = []; } replace(u, r, t) { this.e.push({ r, t }); } },
    TextEditorRevealType: {}, ConfigurationTarget: { Workspace: 2 },
    workspace: { textDocuments: [doc], onDidOpenTextDocument: on('open'), onDidCloseTextDocument: on('close'), onDidChangeTextDocument: on('change'),
      onWillSaveTextDocument: on('willSave'), onDidSaveTextDocument: on('didSave'), onDidChangeConfiguration: on('config'),
      workspaceFile: { fsPath: '/x/TCEE.code-workspace' }, applyEdit: async (w) => { aplicar(w.e); doc.isDirty = true; emit('change', { document: doc, contentChanges: [1] }); return true; }, workspaceFolders: [],
      getConfiguration: (s) => ({ get: (k, def) => (s === 'tcee' && k === 'fusionAlGuardar' ? ajuste : s === 'files' && k === 'saveConflictResolution' ? cfg.files : def),
        inspect: () => ({ workspaceLanguageValue: cfg.files }), update: async (k, v) => { cfg.files = v; } }) },
    window: { setStatusBarMessage: (m) => avisos.push(m), showWarningMessage: async (m, ...b) => { avisos.push(m); return elegir; }, showInformationMessage: async (m) => { avisos.push(m); },
      showTextDocument: async () => ({ revealRange() {} }), createOutputChannel: () => ({ appendLine: (l) => registro.push(l), show() {}, dispose() {} }) },
    commands: { registerCommand: () => ({ dispose() {} }) } };
  function aplicar(eds) { // de atrás adelante, como VS Code
    const o = eds.map((e) => ({ d: doc.offsetAt(e.r.start), h: doc.offsetAt(e.r.end), t: e.t })).sort((a, b) => b.d - a.d);
    for (const e of o) doc.texto = doc.texto.slice(0, e.d) + e.t + doc.texto.slice(e.h);
  }
  const orig = Module._load; Module._load = function (r, ...a) { return r === 'vscode' ? vscode : orig.call(this, r, ...a); };
  const ext = require(EXT);
  ext._pruebas.activarFusion({ subscriptions: [] });

  let recienGuardado = true;   // el primer cambio tras guardar (o al abrir) llega con isDirty desfasado
  const teclear = (f) => {
    const ls = doc.texto.split('\n'); f(ls); doc.texto = ls.join('\n');
    if (recienGuardado) { recienGuardado = false; emit('change', { document: doc, contentChanges: [1] }); doc.isDirty = true; emit('change', { document: doc, contentChanges: [] }); }
    else { doc.isDirty = true; emit('change', { document: doc, contentChanges: [1] }); }
  };
  const claude = (f) => {   // Claude escribe en el disco; si el editor no tiene cambios, VS Code lo recarga
    const ls = fs.readFileSync(fich, 'utf8').split('\n'); f(ls); fs.writeFileSync(fich, ls.join('\n'));
    if (!doc.isDirty) { doc.texto = ls.join('\n'); emit('change', { document: doc, contentChanges: [1] }); recienGuardado = true; }
  };
  async function guardar({ reintento = false } = {}) {
    for (let vez = 0; vez < (reintento ? 2 : 1); vez++) {
      const prom = []; emit('willSave', { document: doc, waitUntil: (p) => prom.push(p) });
      for (const p of prom) aplicar(await p);
    }
    fs.writeFileSync(fich, doc.texto); doc.isDirty = false; recienGuardado = true; emit('didSave', doc);
    await new Promise((r) => setTimeout(r, 30));
  }
  const disco = () => fs.readFileSync(fich, 'utf8');
  const lineas = () => doc.texto.split('\n');
  const sinMarcas = () => assert.ok(!doc.texto.includes('PANEL TCEE'), 'no debería haber bloques de conflicto:\n' + doc.texto.split('\n').filter((l) => l.includes('PANEL')).join('\n'));

  (async () => {
    // A) lo del vídeo: el usuario escribe, se autoguarda, sigue escribiendo… y Claude no toca nada. No puede cambiar nada.
    teclear((ls) => { ls[10] = 'Línea 10 a'; }); await guardar();
    teclear((ls) => { ls[10] = 'Línea 10 ab'; });            // primer cambio tras guardar: isDirty desfasado
    teclear((ls) => { ls[200] = 'Línea 200 del usuario'; });  // otro cambio, lejos
    await guardar();
    assert.strictEqual(lineas()[10], 'Línea 10 ab', 'se ha revertido lo que escribió el usuario'); sinMarcas();
    teclear((ls) => { ls[10] = 'Línea 10 abc'; }); teclear((ls) => { ls[10] = 'Línea 10 abcd'; }); await guardar();
    assert.strictEqual(lineas()[10], 'Línea 10 abcd'); sinMarcas();
    console.log('A ok: escribir y autoguardar sin Claude no cambia nada');

    // B) Claude cambia otra parte mientras el usuario escribe: se combinan
    teclear((ls) => { ls[20] = 'Línea 20 del usuario'; });
    claude((ls) => { ls[250] = 'Línea 250 de Claude'; ls.push('Anexo de Claude'); });
    await guardar();
    assert.strictEqual(lineas()[20], 'Línea 20 del usuario'); assert.strictEqual(lineas()[250], 'Línea 250 de Claude');
    assert.strictEqual(lineas()[lineas().length - 1], 'Anexo de Claude'); assert.strictEqual(disco(), doc.texto); sinMarcas();
    console.log('B ok: combinados sin conflicto');

    // C) líneas pegadas: el usuario la 30, Claude la 31 → se combinan
    teclear((ls) => { ls[30] = 'Línea 30 del usuario'; });
    claude((ls) => { ls[31] = 'Línea 31 de Claude'; });
    await guardar();
    assert.strictEqual(lineas()[30], 'Línea 30 del usuario'); assert.strictEqual(lineas()[31], 'Línea 31 de Claude'); sinMarcas();
    console.log('C ok: líneas pegadas combinadas');

    // C2) la misma línea y VS Code reintenta el guardado (onWillSave dos veces): un solo bloque, no anidado
    teclear((ls) => { ls[40] = 'Línea 40 del usuario'; });
    claude((ls) => { ls[40] = 'Línea 40 de Claude'; });
    await guardar({ reintento: true });
    assert.strictEqual(lineas()[40], 'Línea 40 del usuario');
    assert.strictEqual((disco().match(/PANEL TCEE: VERSIÓN DEL DISCO/g) || []).length, 1, 'un solo bloque en lo guardado');
    await new Promise((r) => setTimeout(r, 30));   // el aviso responde «Quedarme con la mía»: el bloque desaparece
    await guardar(); sinMarcas(); assert.strictEqual(lineas()[40], 'Línea 40 del usuario'); assert.strictEqual(disco(), doc.texto);
    console.log('C2 ok: guardado reintentado, un solo bloque y resuelto');

    // D) Claude escribe con el editor sin cambios (VS Code recarga) y luego el usuario escribe justo al lado: nada de conflictos falsos
    claude((ls) => { ls[60] = 'Línea 60 de Claude'; });
    assert.strictEqual(lineas()[60], 'Línea 60 de Claude');
    teclear((ls) => { ls[61] = 'Línea 61 del usuario'; }); await guardar();
    assert.strictEqual(lineas()[60], 'Línea 60 de Claude'); assert.strictEqual(lineas()[61], 'Línea 61 del usuario'); sinMarcas();
    console.log('D ok: tras recargar, escribir al lado de lo de Claude no da conflicto');

    // E) los dos en la misma línea: conflicto; el usuario elige la del disco
    elegir = 'Usar la del disco';
    teclear((ls) => { ls[100] = 'Línea 100 del usuario'; });
    claude((ls) => { ls[100] = 'Línea 100 de Claude'; });
    await guardar(); await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(lineas()[100], 'Línea 100 de Claude'); sinMarcas(); await guardar();
    assert.strictEqual(disco(), doc.texto);
    console.log('E ok: conflicto resuelto con la del disco');

    // F) muchos guardados seguidos tecleando: nunca aparece nada raro
    elegir = undefined;
    for (let i = 0; i < 20; i++) { teclear((ls) => { ls[150] = 'Línea 150 ' + 'x'.repeat(i + 1); }); if (i % 3 === 0) teclear((ls) => { ls[150 + i] = 'otra ' + i; }); await guardar(); }
    assert.strictEqual(lineas()[150], 'Línea 150 ' + 'x'.repeat(20)); sinMarcas();
    console.log('F ok: 20 autoguardados seguidos sin cambios raros');

    // G) con el ajuste apagado no hace nada y VS Code vuelve a preguntar
    if (ev.config) {
      ajuste = false; emit('config', { affectsConfiguration: (s) => s === 'tcee.fusionAlGuardar' }); await new Promise((r) => setTimeout(r, 30));
      assert.strictEqual(cfg.files, 'askUser');
      teclear((ls) => { ls[5] = 'Línea 5 del usuario'; }); claude((ls) => { ls[6] = 'Línea 6 de Claude'; });
      await guardar(); assert.strictEqual(lineas()[6], 'Línea 6');   // sin fusión no se mete lo del disco (VS Code preguntaría)
      ajuste = true; emit('config', { affectsConfiguration: (s) => s === 'tcee.fusionAlGuardar' }); await new Promise((r) => setTimeout(r, 30));
      assert.strictEqual(cfg.files, 'overwriteFileOnDisk');
      console.log('G ok: ajuste apagado y vuelto a encender');
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('parte 2 bien');
  })().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
}
