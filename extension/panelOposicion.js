// Panel Oposición: pestaña con el calendario de vueltas, el tiempo restante de todos los temas y las relaciones entre temas
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { codigoTema, tituloTema, indiceTema } = require('./parser');
const G = require('./progreso');
const { crearCalendarios } = require('./calendarioPanel');
const { crearRelaciones } = require('./relacionesPanel');
const { crearCante } = require('./cante');
const { crearTest } = require('./testPanel');
const { crearIdiomas } = require('./idiomasPanel');
const { crearPracticas } = require('./idiomasPracticas');
const { crearHerramientas } = require('./idiomasHerramientas');
const { crearClases } = require('./idiomasClases');

function crear(context, { progreso, textoDe, temaMostrado, alMarcar }) {
  let panel = null;
  let cache = null;          // {codigo: {uri, titulo, completo}} de todos los temas
  let espera = null, ocupado = false, pendiente = false;
  const raiz = () => vscode.workspace.workspaceFolders[0].uri.fsPath;

  const desarrollos = () => {
    try { return JSON.parse(fs.readFileSync(path.join(raiz(), 'main', 'analisis', 'desarrollos.json'), 'utf8')); } catch (e) { return { por_tema: {}, por_familia: {} }; }
  };
  // bloques temáticos (config/bloques.json), releídos si cambia el fichero
  let bloques = null, bloquesMtime = 0;
  const leerBloques = () => {
    const f = path.join(raiz(), 'main', 'config', 'bloques.json');
    try { const m = fs.statSync(f).mtimeMs; if (!bloques || m !== bloquesMtime) { bloques = JSON.parse(fs.readFileSync(f, 'utf8')); bloquesMtime = m; } } catch (e) { bloques = { ejercicios: {} }; }
    return bloques;
  };
  const calendarios = crearCalendarios({ ctx: context, progreso, raiz, desarrollos });
  const relaciones = crearRelaciones({ raiz, desarrollos });
  const test = crearTest({ raiz, progreso });
  const idiomas = crearIdiomas({ raiz, globalState: context.globalState });
  // Idiomas, fases 2–3: textos, escritura, oral y examen; LanguageTool y Ollama se arrancan solo cuando hacen falta
  const herrIdiomas = crearHerramientas();
  context.subscriptions.push({ dispose: () => herrIdiomas.cerrarTodo() });
  const practicas = crearPracticas({
    dirPaquete: () => path.join(raiz(), 'idiomas'), dirPerfil: () => idiomas.dirActivo(), perfil: () => idiomas.perfil(), herramientas: herrIdiomas,
    // un micrófono y un whisper cada vez entre el cante, el oral y las clases
    cante: () => { try { const a = cante.estado(), b = clases.estado(); return { grabando: a.grabando || b.grabando, transcribiendo: a.transcribiendo || b.transcribiendo }; } catch (e) { return null; } },
    avisar: (texto, error) => { if (panel) panel.webview.postMessage({ tipo: 'aviso', texto, error: !!error }); },
    alCambiar: () => { if (panel) panel.webview.postMessage({ tipo: 'idiOral', estado: practicas.estadoOral() }); },
  });
  // Clases con profesores (main/IDIOMAS.md, «Clases»): audio, ficheros y transcripción en la carpeta del perfil
  const clases = crearClases({
    dirPerfil: () => idiomas.dirActivo(),
    otroOcupado: () => { try { const a = cante.estado(), b = practicas.estadoOral(); return { grabando: a.grabando || b.grabando, transcribiendo: a.transcribiendo || b.transcribiendo }; } catch (e) { return null; } },
    avisar: (texto, error) => { if (panel) panel.webview.postMessage({ tipo: 'aviso', texto, error: !!error }); },
    alCambiar: () => { if (panel) panel.webview.postMessage({ tipo: 'idiClaseEstado', estado: clases.estado() }); },
  });
  // Cante: grabación y transcripción (main/CANTE.md). alCambiar(ligero): solo el estado en vivo (nivel, % transcrito) o todo el panel
  const cante = crearCante({
    raiz, progreso,
    avisar: (texto, error) => { if (panel) panel.webview.postMessage({ tipo: 'aviso', texto, error: !!error }); else (error ? vscode.window.showWarningMessage : vscode.window.showInformationMessage)(texto); },
    alCambiar: (ligero) => { if (!panel) return; if (ligero) panel.webview.postMessage({ tipo: 'canteEstado', estado: cante.estado() }); else enviar(); },
  });
  setTimeout(() => { try { cante.retomar(); } catch (e) { /* sin carpeta aún */ } }, 5000);
  setTimeout(() => { try { practicas.retomar(); clases.retomar(); } catch (e) { /* sin perfil aún */ } }, 8000);
  let latido = null;   // mientras se graba, el nivel del micrófono se envía cada medio segundo
  const vigilarGrabacion = () => {
    const g = panel && cante.estado().grabando;
    if (g && !latido) latido = setInterval(() => { if (!panel) { clearInterval(latido); latido = null; return; } const e = cante.estado(); panel.webview.postMessage({ tipo: 'canteEstado', estado: e }); if (!e.grabando) { clearInterval(latido); latido = null; } }, 500);
  };
  const minutosDe = () => Object.fromEntries(Object.values(cache || {}).map((t) => [t.codigo, t.minutos]));

  // Para no releer los 145 temas en cada refresco: lista de ficheros guardada (se rehace si se crea o borra un tema)
  // y, por tema, texto y pendientes guardados mientras no cambien el fichero, el documento abierto ni su última compilación
  let uris = null;
  const porTema = new Map();
  const vigiaTemas = vscode.workspace.createFileSystemWatcher('**/temario/Ejercicio-*/Parte-*/*/main.tex', false, true, false);
  vigiaTemas.onDidCreate(() => { uris = null; }); vigiaTemas.onDidDelete(() => { uris = null; });
  context.subscriptions.push(vigiaTemas);
  const marcaDe = (u) => {
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === u.toString());
    let m = '', e = '';
    try { m = fs.statSync(u.fsPath).mtimeMs; } catch (x) { /* sin fichero */ }
    try { e = fs.statSync(path.join(path.dirname(u.fsPath), '.build', 'estado')).mtimeMs; } catch (x) { /* sin compilar */ }
    return `${doc ? `v${doc.version}` : m}|${e}`;
  };

  async function temas() {
    if (!uris) uris = await vscode.workspace.findFiles('temario/Ejercicio-*/Parte-*/*/main.tex');
    const lista = [];
    for (const u of uris) {
      const codigo = codigoTema(u.fsPath);
      if (!codigo) continue;
      const marca = marcaDe(u);
      let c = porTema.get(codigo);
      if (!c || c.marca !== marca) {
        const texto = await textoDe(u);
        const { p } = progreso.calcular(codigo, u, texto);
        c = { marca, texto, t: tituloTema(texto) || {}, p };
        porTema.set(codigo, c);
      }
      const { texto, t } = c;
      const { e, test: tt } = progreso.estimar(codigo, c.p);
      lista.push({ codigo, uri: u, texto, titulo: t.corto || codigo, completo: t.completo || '', parte: codigo.slice(0, 3), minutos: e.minutos, pct: e.pct, hecho: e.hecho, errTest: (tt && tt.errores) || 0 });
    }
    lista.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
    cache = Object.fromEntries(lista.map((t) => [t.codigo, t]));
    return lista;
  }

  function mapa(lista, dev) {
    const pares = new Map();
    for (const [familia, cods] of Object.entries(dev.por_familia || {})) {
      const cs = [...new Set(cods)].sort();
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const k = `${cs[i]}|${cs[j]}`;
        (pares.get(k) || pares.set(k, []).get(k)).push(familia);
      }
    }
    return {
      nodos: lista.map((t) => ({ codigo: t.codigo, titulo: t.titulo, parte: t.parte, hecho: t.hecho, pct: t.pct,
        modelos: ((dev.por_tema || {})[t.codigo] || []).map((m) => m.familia) })),
      aristas: [...pares.entries()].map(([k, f]) => { const [a, b] = k.split('|'); return { a, b, familias: f }; }),
      familias: Object.keys(dev.por_familia || {}).sort((a, b) => a.localeCompare(b, 'es')),
    };
  }

  async function datos() {
    const lista = await temas();
    const dev = desarrollos();
    const nombres = Object.fromEntries(lista.map((t) => [t.codigo, t.titulo]));
    const hechos = new Set(lista.filter((t) => t.hecho).map((t) => t.codigo));
    const abierto = temaMostrado() ? codigoTema(temaMostrado().fsPath) : null;
    const cal = calendarios.vista(cache, minutosDe());
    return {
      temas: lista.map(({ codigo, titulo, completo, parte, minutos, pct, hecho, errTest }) => ({ codigo, titulo, completo, parte, minutos, pct, hecho, errTest, tiempo: G.formatoTiempo(minutos) })),
      total: { tiempo: G.formatoTiempo(lista.reduce((s, t) => s + t.minutos, 0)), hechos: hechos.size, n: lista.length },
      relaciones: { ...relaciones.vista(cache, abierto, dev), nombres },
      calendario: cal,
      bloques: leerBloques(),
      cante: { ...cante.estado(), lista: cante.lista(), abierto, semana: ((cal.cal && cal.cal.semanas) || []).filter((s) => s.estado === 'en curso').flatMap((s) => s.orden),
        objetivo: context.globalState.get('tcee.canteObjetivo', 30), micro: context.globalState.get('tcee.canteMicro', '') },
      mapa: mapa(lista, dev),
    };
  }

  async function enviar() {
    if (!panel) return;
    if (ocupado) { pendiente = true; return; }
    ocupado = true;
    try { panel.webview.postMessage({ tipo: 'datos', datos: await datos() }); vigilarGrabacion(); }
    catch (e) { panel.webview.postMessage({ tipo: 'error', texto: String(e && e.message || e) }); }
    ocupado = false;
    if (pendiente) { pendiente = false; refrescar(); }
  }
  function refrescar() { if (!panel) return; clearTimeout(espera); espera = setTimeout(enviar, 800); }
  progreso.alCambiar(refrescar);

  async function irA(codigo, epigrafe) {
    const t = cache && cache[codigo];
    if (!t) return;
    let linea = 0;
    if (epigrafe) {
      const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const buscado = norm(epigrafe.split('|')[0]);
      const plano = []; const rec = (ns) => ns.forEach((n) => { plano.push(n); rec(n.hijos); });
      rec(indiceTema(t.texto));
      const n = plano.find((x) => norm(x.titulo) === buscado) || plano.find((x) => norm(x.titulo).includes(buscado) || buscado.includes(norm(x.titulo)));
      if (n) linea = n.linea;
    }
    vscode.commands.executeCommand('tcee.irA', t.uri, linea, { principal: true });
  }

  async function alMensaje(m) {
    if (m.tipo === 'listo') return enviar();
    if (m.tipo && m.tipo.startsWith('cal')) {
      if (!cache) await temas();
      let r;
      try { r = calendarios.mensaje(m, cache, minutosDe()); } catch (e) { r = { ok: false, aviso: String(e && e.message || e) }; }
      if (r.previa) { panel.webview.postMessage({ tipo: 'previa', previa: r.previa }); return; }
      if (r.traer) { panel.webview.postMessage({ tipo: 'traer', traer: r.traer }); return; }
      if (r.aviso) panel.webview.postMessage({ tipo: 'aviso', texto: r.aviso, error: r.ok === false });
      if (r.ok !== false) enviar();
      return;
    }
    if (m.tipo === 'abrirUrl') { if (/^https:\/\//.test(m.url || '')) vscode.env.openExternal(vscode.Uri.parse(m.url)); return; }
    if (m.tipo === 'abrir') return irA(m.codigo, m.epigrafe);
    if (m.tipo === 'hecho') { progreso.marcar(m.codigo, !!m.valor); alMarcar(); return; }
    if (m.tipo === 'relDetalle') {
      if (!cache) await temas();
      const nombres = Object.fromEntries(Object.values(cache).map((t) => [t.codigo, t.titulo]));
      panel.webview.postMessage({ tipo: 'relDetalle', detalle: relaciones.detalle(m.familia, cache, desarrollos(), nombres) });
      return;
    }
    if (m.tipo && m.tipo.startsWith('cante')) return mensajeCante(m);
    if (m.tipo && m.tipo.startsWith('test')) return mensajeTest(m);
    if (m.tipo && m.tipo.startsWith('idi')) return mensajeIdiomas(m);
    if (m.tipo === 'abrirLinea') {
      if (!cache) await temas();
      const t = cache[m.codigo]; if (t) vscode.commands.executeCommand('tcee.irA', t.uri, Math.max(0, m.linea), { principal: true });
    }
  }

  /** Pestaña Test: el banco (≈700 KB) se manda solo al abrir la pestaña, no en cada refresco del panel */
  function mensajeTest(m) {
    const enviarHistorial = () => panel.webview.postMessage({ tipo: 'testHistorial', historial: test.historial() });
    try {
      if (m.tipo === 'testCargar') {
        panel.webview.postMessage({ tipo: 'testDatos', banco: test.leerBanco(), historial: test.historial(), cobertura: test.cobertura(),
          imgBase: panel.webview.asWebviewUri(vscode.Uri.file(test.carpeta())).toString(), hayProgreso: progreso.hayCarpeta() });
      } else if (m.tipo === 'testGuardar') { test.guardar(m.sesion); enviarHistorial(); progreso.testCambiado(); alMarcar(); }
      else if (m.tipo === 'testBorrar') {
        vscode.window.showWarningMessage('¿Borrar esta sesión del historial? Sus respuestas dejarán de contar en las estadísticas.', { modal: true }, 'Borrar')
          .then((r) => { if (r) { test.borrar(m.id); enviarHistorial(); progreso.testCambiado(); alMarcar(); } });
      }
    } catch (e) { panel.webview.postMessage({ tipo: 'aviso', texto: String(e.message || e), error: true }); }
  }

  /** Pestaña Idiomas (main/IDIOMAS.md): los datos van y vienen solo cuando la pestaña los pide */
  async function mensajeIdiomas(m) {
    const responder = (tipo, x) => panel.webview.postMessage({ tipo, ...x });
    try {
      if (m.tipo === 'idiCargar') return responder('idiDatos', { datos: idiomas.datos() });
      if (m.tipo.startsWith('idiP')) return mensajePracticas(m, responder);
      if (m.tipo === 'idiCrearPerfil') { idiomas.crearPerfil(m.perfil); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiGuardarPerfil') { idiomas.guardarPerfil(m.cambios); responder('aviso', { texto: 'Ajustes guardados.' }); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiElegirPerfil') { await idiomas.elegirPerfil(m.dir); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiFicha') return responder('idiFicha', { ficha: idiomas.ficha(m.lengua, m.id) });
      if (m.tipo === 'idiEmpezar') return responder('idiSesion', { sesion: idiomas.empezar(m) });
      if (m.tipo === 'idiResponder') return responder('idiCorreccion', { clave: m.clave, resultado: idiomas.responder(m) });
      if (m.tipo === 'idiTerminar') { const r = idiomas.terminar(m); responder('idiFin', { fin: r }); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiRevision') return responder('idiRevisionOk', { revision: idiomas.marcarRevision(m) });
      if (m.tipo === 'idiGuardarEntrada') return responder('idiMiDicc', { lista: idiomas.guardarEntrada(m.entrada) });
      if (m.tipo === 'idiBorrarEntrada') return responder('idiMiDicc', { lista: idiomas.borrarEntrada(m) });
      if (m.tipo === 'idiBuscar') return responder('idiResultados', { clave: m.clave, ...idiomas.buscar(m) });
      if (m.tipo === 'idiDefinir') return responder('idiDefinicion', { clave: m.clave, definicion: idiomas.definir(m) });
      if (m.tipo === 'idiVerbosInicio') return responder('idiVerbos', { info: idiomas.verbosInicio() });
      if (m.tipo === 'idiVerbosBuscar') return responder('idiVerbosLista', { clave: m.clave, lista: idiomas.verbosBuscar(m) });
      if (m.tipo === 'idiVerbosSesion') return responder('idiVerbosSesion', { sesion: idiomas.verbosSesion(m) });
      if (m.tipo === 'idiVerbosTerminar') { responder('idiVerbos', { info: idiomas.verbosTerminar(m) }); return responder('idiDatos', { datos: idiomas.datos() }); }
      if (m.tipo === 'idiLibreta') return responder('idiLibreta', { fichas: idiomas.fichasAnotadas() });
      if (m.tipo === 'idiAnotar') return responder('idiAnotado', { id: m.id, nota: idiomas.anotar(m) });
      if (m.tipo === 'idiEliminarPerfil') {
        const { ruta, nombre } = idiomas.rutaPerfil(m.dir);
        const si = await vscode.window.showWarningMessage(`¿Eliminar el perfil «${nombre}»?`,
          { modal: true, detail: `Se moverá a la Papelera la carpeta ${path.basename(ruta)} con todo su progreso, errores y anotaciones. Desde la Papelera se puede recuperar.` }, 'Eliminar');
        if (si !== 'Eliminar') return;
        await vscode.workspace.fs.delete(vscode.Uri.file(ruta), { recursive: true, useTrash: true });
        await idiomas.olvidarPerfil(m.dir);
        responder('aviso', { texto: `Perfil «${nombre}» eliminado (está en la Papelera).` });
        return responder('idiDatos', { datos: idiomas.datos() });
      }
      if (m.tipo === 'idiDescartarError') { idiomas.descartarError(m); return responder('idiDatos', { datos: idiomas.datos() }); }
    } catch (e) { responder('aviso', { texto: String(e.message || e), error: true }); }
  }

  /** Idiomas, fases 2–3: biblioteca de textos, escritura, oral y examen (idiomasPracticas.js). Las respuestas llevan la clave del que pregunta */
  async function mensajePracticas(m, responder) {
    const r = (x) => responder('idiPRespuesta', { clave: m.clave, accion: m.tipo, ...x });
    const aviso = (texto) => responder('idiPProgreso', { clave: m.clave, texto });
    try {
      switch (m.tipo) {
        case 'idiPBiblioteca': return r({ datos: practicas.biblioteca(m) });
        case 'idiPAbrir': return r({ texto: practicas.abrir(m) });
        case 'idiPResponder': return r({ resultado: await practicas.responder(m) });
        case 'idiPDictado': return r({ resultado: practicas.dictado(m) });
        case 'idiPTerminarTexto': r({ registro: practicas.terminarTexto(m) }); return responder('idiDatos', { datos: idiomas.datos() });
        case 'idiPCorregir': { const x = await practicas.corregirEscrito(m, aviso); r({ escrito: x }); return responder('idiDatos', { datos: idiomas.datos() }); }
        case 'idiPAutoevaluar': return r({ escrito: practicas.autoevaluar(m) });
        case 'idiPEscritos': return r({ lista: practicas.escritos(m) });
        case 'idiPEscrito': return r({ escrito: practicas.escrito(m) });
        case 'idiPTareas': return r({ tareas: practicas.listaTareas(m), expresiones: practicas.expresiones(m) });
        case 'idiPTarea': return r({ tarea: practicas.tarea(m) });
        case 'idiPHerramientas': return r({ estado: await herrIdiomas.estado() });
        case 'idiPInstalar': {
          const t = vscode.window.createTerminal({ name: 'Herramientas de idiomas', cwd: raiz() });
          t.show(); t.sendText(`bash "${path.join(raiz(), 'main', 'scripts', 'idiomas', 'instalar_herramientas.sh')}"`);
          return r({ ok: true });
        }
        case 'idiPTribunal': return r({ preguntas: practicas.preguntasTribunal(m) });
        case 'idiPGrabar': return r({ grabacion: await practicas.grabar(m), estado: practicas.estadoOral() });
        case 'idiPParar': return r({ id: await practicas.pararGrabacion(m), estado: practicas.estadoOral() });
        case 'idiPEstadoOral': return r({ estado: practicas.estadoOral() });
        case 'idiPTranscribir': return r({ estado: practicas.transcribir(m) });
        case 'idiPValorarOral': { const x = await practicas.valorarOral(m, aviso); r({ grabacion: x }); return responder('idiDatos', { datos: idiomas.datos() }); }
        case 'idiPGrabaciones': return r({ lista: practicas.grabaciones(m) });
        case 'idiPAudio': { const f = practicas.rutaAudio(m.id); return r({ url: f && fs.existsSync(f) ? panel.webview.asWebviewUri(vscode.Uri.file(f)).toString() : null }); }
        case 'idiPClases': return r({ lista: clases.lista(m) });
        case 'idiPClaseCrear': return r({ clase: clases.crear(m) });
        case 'idiPClase': return r({ clase: clases.clase(m.id), estado: clases.estado() });
        case 'idiPClaseCambiar': return r({ clase: clases.cambiar(m) });
        case 'idiPClaseImportar': {
          const audio = m.que === 'audio';
          const xs = await vscode.window.showOpenDialog({ canSelectMany: !audio, openLabel: audio ? 'Añadir audio' : 'Añadir ficheros',
            filters: audio ? { 'Audio o vídeo': ['m4a', 'mp3', 'wav', 'aac', 'caf', 'aif', 'aiff', 'ogg', 'opus', 'flac', 'mp4', 'mov', 'm4v', 'webm'] } : undefined });
          if (!xs || !xs.length) return r({ cancelado: true });
          return r(await clases.importar({ id: m.id, rutas: xs.map((u) => u.fsPath) }, aviso));
        }
        case 'idiPClaseQuitarAdjunto': return r({ clase: clases.quitarAdjunto(m) });
        case 'idiPClaseQuitarAudio': {
          const si = await vscode.window.showWarningMessage('¿Borrar este audio de la clase y su transcripción?', { modal: true }, 'Borrar');
          return r(si === 'Borrar' ? { clase: clases.quitarAudio(m) } : { cancelado: true });
        }
        case 'idiPClaseAdjunto': {
          const x = clases.leerAdjunto(m);
          if (x.texto === null || !/\.(txt|md|vtt|srt|csv)$/i.test(m.fichero)) { vscode.env.openExternal(vscode.Uri.file(x.ruta)); return r({ fuera: true }); }
          return r({ texto: x.texto });
        }
        case 'idiPClaseCarpeta': vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path.join(clases.ruta(m.id), 'clase.json'))); return r({});
        case 'idiPClaseMicros': return r({ lista: await clases.microfonos() });
        case 'idiPClaseGrabar': return r({ grabacion: await clases.grabar(m), estado: clases.estado() });
        case 'idiPClaseParar': { aviso('Guardando y comprimiendo el audio…'); const a = await clases.parar(m); return r({ audio: a, estado: clases.estado() }); }
        case 'idiPClaseEstado': return r({ estado: clases.estado() });
        case 'idiPClaseTranscribir': return r({ estado: clases.transcribir(m) });
        case 'idiPClaseAudioUrl': return r({ url: panel.webview.asWebviewUri(vscode.Uri.file(path.join(clases.ruta(m.id), path.basename(m.fichero)))).toString() });
        case 'idiPClaseEliminar': {
          const c = clases.clase(m.id); if (!c) return r({ cancelado: true });
          const si = await vscode.window.showWarningMessage(`¿Eliminar la clase «${c.titulo}»?`, { modal: true, detail: 'Su carpeta (audio, ficheros y transcripción) irá a la Papelera del Mac.' }, 'Eliminar');
          if (si !== 'Eliminar') return r({ cancelado: true });
          await vscode.workspace.fs.delete(vscode.Uri.file(clases.eliminar(m)), { recursive: true, useTrash: true });
          return r({ eliminada: true });
        }
        case 'idiPGuardarExamen': { const id = practicas.guardarExamen(m.examen); r({ id }); return responder('idiDatos', { datos: idiomas.datos() }); }
        default: return null;
      }
    } catch (e) { return r({ error: String(e.message || e) }); }
  }

  async function mensajeCante(m) {
    try {
      if (m.tipo === 'canteEmpezar') {
        if (!cache) await temas();
        const t = cache[m.codigo];
        if (!t) throw new Error('Elige un tema.');
        context.globalState.update('tcee.canteObjetivo', Number(m.objetivo) || 0);
        if (m.micro) context.globalState.update('tcee.canteMicro', m.micro);
        await cante.empezar({ codigo: t.codigo, titulo: t.completo || t.titulo, objetivo: (Number(m.objetivo) || 0) * 60, micro: m.micro, texto: t.texto });
      } else if (m.tipo === 'canteTerminar') {
        const id = await cante.terminar(false);
        if (id) { panel.webview.postMessage({ tipo: 'canteSeleccionar', id }); panel.webview.postMessage({ tipo: 'canteDetalle', detalle: cante.leer(id) }); }
      } else if (m.tipo === 'canteDescartar') {
        const r = await vscode.window.showWarningMessage('¿Descartar este cante? Se borra la grabación y no se transcribe.', { modal: true }, 'Descartar');
        if (r) await cante.terminar(true);
      } else if (m.tipo === 'canteVer') {
        panel.webview.postMessage({ tipo: 'canteDetalle', detalle: cante.leer(m.id) });
      } else if (m.tipo === 'canteEliminar') {
        const r = await vscode.window.showWarningMessage('¿Eliminar este cante? Se borran la transcripción y el audio.', { modal: true }, 'Eliminar');
        if (r) { cante.eliminar(m.id); panel.webview.postMessage({ tipo: 'canteDetalle', detalle: null }); }
      } else if (m.tipo === 'canteAudio') {
        const f = cante.rutaAudio(m.id);
        if (f) vscode.env.openExternal(vscode.Uri.file(f)); else vscode.window.showWarningMessage('No encuentro el audio de este cante en este Mac (los audios no se sincronizan por GitHub).');
      } else if (m.tipo === 'canteReintentar') {
        cante.encolar(m.id);
      } else if (m.tipo === 'canteCancelar') {
        cante.cancelar();
      } else if (m.tipo === 'canteMicros') {
        panel.webview.postMessage({ tipo: 'canteMicros', micros: await cante.microfonos() });
      } else if (m.tipo === 'canteInstalar') {
        const t = (await vscode.tasks.fetchTasks()).find((x) => x.name === 'Instalar herramientas de cante');
        if (t) vscode.tasks.executeTask(t); else vscode.window.showWarningMessage('No encuentro la tarea «Instalar herramientas de cante». Sincroniza y vuelve a abrir el espacio de trabajo TCEE.');
      } else if (m.tipo === 'canteCopiar') {
        const f = cante.leer(m.id); if (f && f.texto) { await vscode.env.clipboard.writeText(f.texto); panel.webview.postMessage({ tipo: 'aviso', texto: 'Transcripción copiada.' }); }
      }
    } catch (e) { panel.webview.postMessage({ tipo: 'aviso', texto: String(e.message || e), error: true }); }
  }

  function html(webview) {
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = (f) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', f));
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; media-src ${webview.cspSource} https://voa-audio.voanews.eu https://*.voanews.eu; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${url('katex/katex.min.css')}"><link rel="stylesheet" href="${url('panel.css')}"><title>Panel Oposición</title></head>
<body><div id="app"><p class="vacio">Calculando los temas…</p></div>
<script nonce="${nonce}" src="${url('katex/katex.min.js')}"></script>
<script nonce="${nonce}" src="${url('calendario.js')}"></script>
<script nonce="${nonce}" src="${url('temas.js')}"></script>
<script nonce="${nonce}" src="${url('relaciones.js')}"></script>
<script nonce="${nonce}" src="${url('cante.js')}"></script>
<script nonce="${nonce}" src="${url('test.js')}"></script>
<script nonce="${nonce}" src="${url('idiomasPracticas.js')}"></script>
<script nonce="${nonce}" src="${url('idiomas.js')}"></script>
<script nonce="${nonce}" src="${url('panel.js')}"></script></body></html>`;
  }

  return {
    async abrir() {
      if (panel) { panel.reveal(); refrescar(); return; }
      panel = vscode.window.createWebviewPanel('tceeOposicion', 'Panel Oposición', vscode.ViewColumn.Active, {
        enableScripts: true, retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media'), vscode.Uri.file(test.carpeta()), vscode.Uri.file(raiz())],
      });
      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'tcee.svg');
      panel.webview.html = html(panel.webview);
      panel.webview.onDidReceiveMessage(alMensaje);
      panel.onDidDispose(() => { panel = null; });
      // siempre en una ventana aparte (ventanas auxiliares de VS Code, 1.85 o posterior)
      try { await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow'); } catch (e) { /* se queda en la ventana principal */ }
    },
    refrescar,
    temaCambiado() { if (panel) refrescar(); },
  };
}

module.exports = { crear };
