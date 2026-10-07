// Pestaña Idiomas, fases 2–3 (lado de la extensión): biblioteca de textos (leer y resumir, escuchar y resumir, preguntas, dictado),
// expresión escrita (tareas, rúbrica, LanguageTool y modelo local), oral (grabación con ffmpeg, transcripción con whisper, métricas, tribunal)
// y sesión tipo examen. Datos del usuario solo en su carpeta TCEE/idiomas-<nombre>/ (escritos/, audio/, textos.json). Reglas: main/IDIOMAS.md
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const I = require('./idiomas');
const X = require('./idiomasTextos');
const C = require('./cante');

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const escribir = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1) + '\n'); fs.renameSync(f + '.tmp', f); };
const dos = (n) => String(n).padStart(2, '0');
const sello = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
const HZ = 16000;
// frases que whisper se inventa en los silencios en inglés y francés (las del castellano están en cante.js)
const ALUCINACIONES_LENGUA = /thank(s| you) for watching|please subscribe|subtitles by|sous-titr|merci d'avoir regard|abonnez-vous|amara\.org/i;

function crearPracticas({ dirPaquete, dirPerfil, perfil, herramientas, cante = () => null, avisar = () => {}, alCambiar = () => {} }) {
  const fp = (n) => { const d = dirPerfil(); if (!d) throw new Error('Crea primero tu perfil.'); return path.join(d, n); };
  const anotarSesion = (linea) => fs.appendFileSync(fp('sesiones.jsonl'), JSON.stringify(linea) + '\n');

  // ---------------------------------------------------------------- biblioteca
  const cache = {};
  function indice(l) {
    const f = path.join(dirPaquete(), l, 'textos.json');
    let m = 0; try { m = fs.statSync(f).mtimeMs; } catch (e) { return []; }
    if (cache[l] && cache[l].m === m) return cache[l].textos;
    cache[l] = { m, textos: leer(f, { textos: [] }).textos || [] };
    return cache[l].textos;
  }
  const texto = (l, id) => leer(path.join(dirPaquete(), l, 'textos', `${id.split('.').slice(2).join('.')}.json`), null);
  const registros = () => (dirPerfil() ? leer(fp('textos.json'), {}) : {});

  /** Biblioteca para la pantalla: índice + lo hecho por el usuario en cada texto + el texto recomendado para cada modo */
  function biblioteca({ lengua }) {
    const xs = indice(lengua), regs = registros();
    const p = perfil() || {}; const nivel = ((p.idiomas || {})[lengua] || {}).nivel || 'B1';
    const lista = xs.map((t) => ({ ...t, hecho: regs[t.id] || null }));
    // recomendado: de tu nivel o uno por encima, sin hacer (o lo más antiguo), sin repetir el campo de los últimos textos
    const ultimos = Object.values(regs).filter((r) => r.lengua === lengua).sort((a, b) => (b.ultima || '').localeCompare(a.ultima || '')).slice(0, 3).map((r) => r.campo);
    const n = I.nivelNum(nivel);
    const candidatos = lista.filter((t) => [n, n + 1].includes(I.nivelNum(t.nivel))).sort((a, b) =>
      (a.hecho ? 1 : 0) - (b.hecho ? 1 : 0) || (ultimos.includes(a.campo) ? 1 : 0) - (ultimos.includes(b.campo) ? 1 : 0)
      || ((a.hecho || {}).ultima || '').localeCompare((b.hecho || {}).ultima || '') || ((a.tipo === 'prensa' ? 0 : 1) - (b.tipo === 'prensa' ? 0 : 1)));
    return { textos: lista, recomendado: candidatos[0] ? candidatos[0].id : (lista[0] && lista[0].id), nivel };
  }

  /** Abre un texto para practicar. Al navegador va lo necesario para leer, escuchar y contestar; las soluciones se piden al corregir */
  function abrir({ lengua, id, longitud }) {
    const t = texto(lengua, id); if (!t) throw new Error('Texto no encontrado. Ejecuta «Sincronizar» para actualizar el paquete de idiomas.');
    const r = X.recortar(t, longitud === 'completo' ? 'completo' : (Number(longitud) || longitud || 'estandar'));
    return {
      id: t.id, lengua, titulo: t.titulo, titulo_es: t.titulo_es, nivel: t.nivel, campo: t.campo, tipo: t.tipo, fuente: t.fuente, audio: r.entero ? t.audio : null,
      parrafos: r.parrafos, k: r.k, total: t.parrafos.length, entero: r.entero, palabras: r.palabras, extension: X.extensionResumen(r.palabras),
      preguntas: r.preguntas.map(({ id: pid, tipo, parrafo, enunciado, pregunta, opciones }) => ({ id: pid, tipo, parrafo, enunciado, pregunta, opciones })),
      dictado: X.frasesDictado(r.parrafos, 5),
      glosario: r.glosario, tribunal: (t.tribunal || []).map((x) => ({ pregunta: x.pregunta, pista_es: x.pista_es })),
      palabras_clave: t.palabras_clave || [],
    };
  }

  /** Corrige una pregunta de comprensión: vf / eleccion / vocabulario con respuesta fija; abierta con el modelo local (o autoevaluación) */
  async function responder({ lengua, id, pregunta, respuesta }) {
    const t = texto(lengua, id); if (!t) throw new Error('Texto no encontrado.');
    const p = (t.preguntas || []).find((x) => x.id === pregunta); if (!p) throw new Error('Pregunta no encontrada.');
    const base = { correcta: p.respuestas[0], respuestas: p.respuestas, cita: p.cita || '', explicacion: p.explicacion || '', parrafo: p.parrafo };
    if (p.tipo === 'abierta') {
      if (!String(respuesta || '').trim()) return { ...base, ok: false, nota: 0, comentario: 'Sin respuesta.' };
      const e = await herramientas.estado();
      if (!e.ollama || !e.modelo) return { ...base, autoevaluar: true };
      const pr = X.promptAbierta({ lengua, pregunta: p.pregunta, modelo: p.respuestas[0], cita: p.cita, respuesta });
      let r;
      try { r = await herramientas.preguntar(pr); } catch (e) { return { ...base, autoevaluar: true, aviso: `Modelo local: ${e.message}` }; }
      return { ...base, ok: r.nota === 2, parcial: r.nota === 1, nota: r.nota, comentario: r.comentario };
    }
    if (p.tipo === 'vf' || p.tipo === 'eleccion') {
      const ok = p.respuestas.some((x) => I.normalizar(x) === I.normalizar(respuesta));
      return { ...base, ok };
    }
    const r = I.corregir({ tipo: 'hueco', respuestas: p.respuestas }, respuesta);
    return { ...base, ...r };
  }

  /** Dictado: comparación palabra a palabra con la frase original */
  const dictado = ({ original, escrito }) => X.comparar(original, escrito);

  /** Guarda lo hecho con un texto (comprensión, dictado) y la línea de sesión */
  function terminarTexto({ lengua, id, modo, comprension, dictado: dic, segundos, longitud }) {
    const regs = registros(); const t = texto(lengua, id) || {};
    const r = regs[id] || { lengua, campo: t.campo, veces: 0, modos: {}, comprension: [], dictado: [], resumen: [] };
    r.veces += 1; r.ultima = new Date().toISOString(); r.modos[modo] = (r.modos[modo] || 0) + 1;
    if (comprension && comprension.total) r.comprension = [...r.comprension, Math.round((comprension.bien / comprension.total) * 100) / 100].slice(-10);
    if (dic && dic.total) r.dictado = [...r.dictado, Math.round(dic.nota * 100) / 100].slice(-10);
    regs[id] = r; escribir(fp('textos.json'), regs);
    anotarSesion({ id: `t${Date.now()}`, fecha: new Date(Date.now() - (segundos || 0) * 1000).toISOString(), lengua, tipo: modo === 'escucha' ? 'escucha' : 'lectura',
      minutos: Math.round((segundos || 0) / 6) / 10, materias: [], texto: id, longitud, ejercicios: (comprension && comprension.total) || 0, aciertos: (comprension && comprension.bien) || 0 });
    return r;
  }

  // ---------------------------------------------------------------- escritura (resúmenes y tareas) con LanguageTool y el modelo local
  /**
   * Corrige un escrito. clase: 'resumen' (de un texto de la biblioteca: id + k párrafos) o 'tarea' (de escritura.json).
   * Pasos: LanguageTool (si está), comprobaciones objetivas y valoración con el modelo (si está). Guarda en escritos/.
   */
  async function corregirEscrito({ lengua, clase, id, k, tareaId, texto: escrito, segundos, modo, notas, sinSesion }, aviso = () => {}) {
    const limpio = String(escrito || '').trim();
    if (X.palabras(limpio) < 20) throw new Error('Escribe al menos unas frases (20 palabras) para poder corregirlo.');
    const e = await herramientas.estado();
    const out = { id: `${sello()}_${clase}`, fecha: new Date().toISOString(), lengua, clase, modo: modo || null, texto: limpio, palabras: X.palabras(limpio),
      segundos: Math.round(segundos || 0), notas: notas || '', herramientas: { lt: e.lt, modelo: e.ollama && e.modelo }, avisos: [] };
    let original = '', ideas = [], tarea = null;
    if (clase === 'resumen') {
      const t = texto(lengua, id); if (!t) throw new Error('Texto no encontrado.');
      const r = X.recortar(t, X.LONGITUDES.completo); const kk = Math.min(Number(k) || t.parrafos.length, t.parrafos.length);
      original = t.parrafos.slice(0, kk).join('\n\n');
      ideas = (t.ideas_clave || []).filter((x) => (x.parrafos || [0]).some((i) => i < kk));
      out.textoId = id; out.titulo = t.titulo; out.k = kk; out.extension = X.extensionResumen(X.palabras(original));
      out.ideas = ideas; out.resumenModelo = kk >= t.parrafos.length ? t.resumen_modelo : '';
      out.copiado = X.copiado(original, limpio);
      void r;
    } else {
      tarea = tareas(lengua).find((x) => x.id === tareaId); if (!tarea) throw new Error('Tarea no encontrada.');
      out.tareaId = tareaId; out.titulo = tarea.titulo_es; out.extension = tarea.palabras; out.modelo = tarea.modelo || '';
    }
    if (e.lt) {
      aviso('Revisando la gramática y la ortografía con LanguageTool…');
      try { out.errores = await herramientas.corregirTexto(limpio, lengua); } catch (x) { out.avisos.push(`LanguageTool: ${x.message}`); out.errores = []; }
    } else { out.errores = null; out.avisos.push('LanguageTool no está instalado: sin corrección gramatical automática.'); }
    if (e.ollama && e.modelo) {
      aviso('Valorando con el modelo local (puede tardar uno o dos minutos)…');
      try {
        const pr = clase === 'resumen'
          ? X.promptResumen({ lengua, texto: original, ideas, resumen: limpio, errores: out.errores, extension: out.extension })
          : X.promptEscrito({ lengua, tarea, texto: limpio, errores: out.errores });
        const v = await herramientas.preguntar(pr);
        out.valoracion = v; out.nota = X.notaRubrica(v.criterios || {});
        if (clase === 'resumen' && Array.isArray(v.ideas)) out.ideasEstado = Object.fromEntries(v.ideas.map((x) => [x.n, x.estado]));
      } catch (x) { out.avisos.push(`Modelo local: ${x.message}`); }
    } else out.avisos.push('El modelo local no está instalado: valora tú mismo las ideas y la rúbrica.');
    escribir(fp(path.join('escritos', `${out.id}.json`)), out);
    if (clase === 'resumen') {
      const regs = registros(); const t = texto(lengua, id) || {};
      const r = regs[id] || { lengua, campo: t.campo, veces: 0, modos: {}, comprension: [], dictado: [], resumen: [] };
      r.ultima = new Date().toISOString(); if (out.nota != null) r.resumen = [...(r.resumen || []), out.nota].slice(-10);
      regs[id] = r; escribir(fp('textos.json'), regs);
    }
    // dentro de un texto o de un examen, el tiempo ya lo anota la actividad entera (no se cuenta dos veces)
    if (!sinSesion) anotarSesion({ id: out.id, fecha: new Date(Date.now() - out.segundos * 1000).toISOString(), lengua, tipo: clase === 'resumen' ? (modo === 'escucha' ? 'escucha' : 'lectura') : 'escrito',
      minutos: Math.round(out.segundos / 6) / 10, materias: [], texto: id || tareaId, ejercicios: 1, aciertos: out.nota != null ? out.nota / 10 : 0 });
    return out;
  }
  /** Autoevaluación (sin modelo, o para corregir la del modelo): ideas recogidas y notas de la rúbrica */
  function autoevaluar({ id, ideasEstado, criterios }) {
    const f = fp(path.join('escritos', `${id}.json`)); const e = leer(f, null); if (!e) throw new Error('Escrito no encontrado.');
    if (ideasEstado) e.ideasEstado = ideasEstado;
    if (criterios) { e.auto = criterios; e.nota = X.notaRubrica(criterios); }
    escribir(f, e); return e;
  }
  function escritos({ lengua }) {
    let fs_ = []; try { fs_ = fs.readdirSync(fp('escritos')).filter((x) => x.endsWith('.json')); } catch (e) { return []; }
    return fs_.map((x) => leer(path.join(fp('escritos'), x), null)).filter((e) => e && e.lengua === lengua)
      .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 60).map(({ texto: tx, valoracion, errores, ...r }) => ({ ...r, extracto: tx.slice(0, 160) }));
  }
  const escrito = ({ id }) => leer(fp(path.join('escritos', `${id}.json`)), null);

  const tareas = (l) => leer(path.join(dirPaquete(), l, 'escritura.json'), { tareas: [] }).tareas || [];
  const listaTareas = ({ lengua }) => tareas(lengua).map(({ modelo, ...t }) => ({ ...t, tieneModelo: !!modelo }));
  const expresiones = ({ lengua }) => leer(path.join(dirPaquete(), lengua, 'expresiones.json'), { funciones: [] }).funciones || [];

  // ---------------------------------------------------------------- tribunal: preguntas generales y del texto
  function preguntasTribunal({ lengua, textoId, n = 4, bloques }) {
    const gen = leer(path.join(dirPaquete(), lengua, 'tribunal.json'), { preguntas: [] }).preguntas || [];
    const deTexto = textoId ? ((texto(lengua, textoId) || {}).tribunal || []).map((x, i) => ({ ...x, id: `${textoId}#${i}`, bloque: 'texto' })) : [];
    const p = perfil() || {}; const nv = I.nivelNum(((p.idiomas || {})[lengua] || {}).nivel || 'B1');
    const generales = I.barajar(gen.filter((x) => (!bloques || !bloques.length || bloques.includes(x.bloque)) && I.nivelNum(x.nivel) <= nv + 1));
    const delTexto = deTexto.slice(0, Math.min(deTexto.length, Math.ceil(n / 2)));
    return [...delTexto, ...generales].slice(0, n);
  }

  // ---------------------------------------------------------------- oral: grabación (ffmpeg) y transcripción (whisper), una cada vez
  const dirAudio = () => fp('audio');
  const marca = () => path.join(dirAudio(), 'grabando.json');
  let transcribiendo = null; const cola = [];
  function grabacionEnCurso() {
    let m; try { m = JSON.parse(fs.readFileSync(marca(), 'utf8')); } catch (e) { return null; }
    let mtime = 0; try { mtime = fs.statSync(m.wav).mtimeMs; } catch (e) { /* aún sin audio */ }
    if (vivo(m.pid) && Date.now() - Math.max(mtime, m.inicio) < 15000) return { ...m, nivel: C.nivel(m.registro) };
    cerrarGrabacion(m, Date.now(), false);   // ffmpeg se paró solo (tope, corte, Mac apagado): se guarda lo grabado
    return null;
  }
  /** Ficha de una grabación ya parada y transcripción en cola (o se borra si se descarta o no hay audio) */
  function cerrarGrabacion(m, fin, descartar) {
    try { fs.unlinkSync(marca()); } catch (e) { /* */ }
    try { fs.unlinkSync(m.registro); } catch (e) { /* */ }
    let bytes = 0; try { bytes = fs.statSync(m.wav).size; } catch (e) { /* */ }
    const segundos = Math.round(Math.min((fin - m.inicio) / 1000, bytes / (HZ * 2) + 1));
    if (descartar || bytes < HZ * 2 * 2) { try { fs.unlinkSync(m.wav); } catch (e) { /* */ } return null; }
    escribir(path.join(dirAudio(), `${m.id}.json`), { id: m.id, lengua: m.lengua, clase: m.clase, ref: m.ref, fecha: new Date(m.inicio).toISOString(), segundos, audio: path.basename(m.wav), estado: 'pendiente' });
    if (!cola.includes(m.id)) cola.push(m.id);
    setTimeout(siguiente, 0);
    return m.id;
  }
  /** Al abrir VS Code: cierra la grabación que se cortó y vuelve a poner en cola lo que quedó sin transcribir */
  function retomar() {
    try {
      if (!dirPerfil()) return;
      grabacionEnCurso();
      for (const x of fs.readdirSync(dirAudio()).filter((n) => n.endsWith('.json') && n !== 'grabando.json')) {
        const f = leer(path.join(dirAudio(), x), null);
        if (f && f.estado === 'pendiente' && !cola.includes(f.id)) cola.push(f.id);
      }
      siguiente();
    } catch (e) { /* sin carpeta de audio aún */ }
  }
  async function grabar({ lengua, clase, ref, micro }) {
    const h = C.herramientas();
    if (!h.ffmpeg) throw new Error('Falta ffmpeg: pulsa «Instalar herramientas» en Ajustes de Idiomas.');
    if (grabacionEnCurso()) throw new Error('Ya hay una grabación en curso.');
    const ec = cante(); if (ec && ec.grabando) throw new Error('Se está grabando un cante: termínalo antes de grabar aquí (el micrófono es uno).');
    const lista = await C.microfonos(h.ffmpeg);
    const mic = C.elegirMicro(lista, micro || ((perfil() || {}).ajustes || {}).micro);
    if (!mic) throw new Error('ffmpeg no encuentra ningún micrófono. Revisa Ajustes del Sistema › Privacidad y seguridad › Micrófono › Visual Studio Code.');
    fs.mkdirSync(dirAudio(), { recursive: true });
    const id = `${sello()}_${clase}`;
    const wav = path.join(dirAudio(), `${id}.wav`), registro = path.join(dirAudio(), `${id}.log`);
    const fd = fs.openSync(registro, 'w');
    const p = spawn(h.ffmpeg, ['-hide_banner', '-nostdin', '-f', 'avfoundation', '-i', `:${mic.indice}`, '-t', '1800', '-af', 'ebur128=framelog=info',
      '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', '-flush_packets', '1', '-y', wav], { detached: true, stdio: ['ignore', 'ignore', fd] });
    fs.closeSync(fd); p.unref();
    const m = { id, pid: p.pid, lengua, clase, ref: ref || null, inicio: Date.now(), wav, registro, micro: mic.nombre };
    fs.writeFileSync(marca(), JSON.stringify(m, null, 1));
    setTimeout(() => { if (!vivo(p.pid) && (leer(marca(), {}).pid === p.pid)) { try { fs.unlinkSync(marca()); } catch (e) { /* */ } avisar('La grabación no ha arrancado: revisa el permiso de micrófono de Visual Studio Code.', true); alCambiar(); } }, 2500);
    return { id, inicio: m.inicio, micro: mic.nombre };
  }
  /** Para la grabación y la transcribe (en cola). Devuelve el id de la grabación */
  async function pararGrabacion({ descartar } = {}) {
    const m = grabacionEnCurso(); if (!m) return null;
    const fin = Date.now();
    try { process.kill(m.pid, 'SIGINT'); } catch (e) { /* ya parado */ }
    for (let i = 0; i < 50 && vivo(m.pid); i++) await new Promise((r) => setTimeout(r, 100));
    if (vivo(m.pid)) { try { process.kill(m.pid, 'SIGKILL'); } catch (e) { /* */ } }
    return cerrarGrabacion(m, fin, descartar);
  }
  const ficha = (id) => leer(path.join(dirAudio(), `${id}.json`), null);
  async function siguiente() {
    if (transcribiendo || !cola.length) return;
    const id = cola.shift(); const f = ficha(id); if (!f) return siguiente();
    const h = C.herramientas();
    if (h.falta.length) {
      for (const x of [id, ...cola.splice(0)]) { const g = ficha(x); if (g) escribir(path.join(dirAudio(), `${x}.json`), { ...g, estado: 'error', error: `Falta ${h.falta.join(', ')}` }); }
      avisar(`No puedo transcribir: falta ${h.falta.join(', ')}. Pulsa «Instalar herramientas» en Ajustes de Idiomas.`, true); alCambiar(); return;
    }
    // un whisper cada vez también con el cante (Mac de 8 GB): si el cante está transcribiendo, se espera
    const ec = cante(); if (ec && ec.transcribiendo) { cola.unshift(id); setTimeout(siguiente, 15000); return; }
    transcribiendo = { id, pct: 0 }; alCambiar(true);
    const wav = path.join(dirAudio(), f.audio), base = path.join(os.tmpdir(), `tcee-idi-${id}`), limpio = path.join(os.tmpdir(), `tcee-idi-${id}.wav`);
    try {
      // copia limpia: si ffmpeg no cerró bien el WAV, su cabecera no dice la duración y se relee como audio en bruto (como en el cante)
      const tam = fs.statSync(wav).size; let ok = false;
      try { await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', wav, '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', limpio]); ok = fs.statSync(limpio).size > tam * 0.9; } catch (e) { ok = false; }
      if (!ok) await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-f', 's16le', '-ar', String(HZ), '-ac', '1', '-i', wav, '-c:a', 'pcm_s16le', limpio]);
      await correr(h.whisper, ['-m', h.modelo, '-f', limpio, '-l', f.lengua, '-oj', '-of', base, '-pp', '-ml', '60', '-sow', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1)))],
        (l) => { const x = l.match(/progress\s*=\s*(\d+)%/); if (x && transcribiendo) { transcribiendo.pct = Number(x[1]); alCambiar(true); } });
      const j = leer(`${base}.json`, { transcription: [] });
      const segmentos = (j.transcription || []).map((s) => ({ t0: (s.offsets ? s.offsets.from : 0) / 1000, t1: (s.offsets ? s.offsets.to : 0) / 1000, texto: (s.text || '').trim() }))
        .filter((s) => s.texto && !C.ALUCINACIONES.test(s.texto) && !ALUCINACIONES_LENGUA.test(s.texto) && !/^\[.*\]$|^\(.*\)$/.test(s.texto));
      const metricas = X.metricasOral(segmentos, f.lengua, f.segundos);
      escribir(path.join(dirAudio(), `${id}.json`), { ...ficha(id), estado: 'transcrito', segmentos, texto: metricas.texto, metricas });
      // audio comprimido en mp3 (el panel de VS Code no reproduce AAC); si falla, se conserva el WAV
      try {
        const mp3 = wav.replace(/\.wav$/, '.mp3');
        await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', limpio, '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
        try { fs.unlinkSync(wav); } catch (e) { /* */ }
        escribir(path.join(dirAudio(), `${id}.json`), { ...ficha(id), audio: path.basename(mp3) });
      } catch (e) { /* se queda el WAV */ }
    } catch (e) {
      escribir(path.join(dirAudio(), `${id}.json`), { ...ficha(id), estado: 'error', error: String(e.message || e).slice(0, 300) });
      avisar(`No se pudo transcribir la grabación: ${e.message || e}`, true);
    } finally {
      for (const x of [`${base}.json`, limpio]) { try { fs.unlinkSync(x); } catch (e) { /* */ } }
      transcribiendo = null; alCambiar(true); siguiente();
    }
  }
  function correr(prog, args, alLinea) {
    return new Promise((ok, mal) => {
      const p = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let resto = '', ultimo = '';
      const leerSalida = (d) => { resto += d.toString(); const ls = resto.split(/\r|\n/); resto = ls.pop(); ls.forEach((l) => { if (l.trim()) ultimo = l; if (alLinea) alLinea(l); }); };
      p.stdout.on('data', leerSalida); p.stderr.on('data', leerSalida); p.on('error', mal);
      p.on('close', (c) => (c === 0 ? ok() : mal(new Error(`${path.basename(prog)} terminó con error (${c}): ${ultimo.slice(0, 200)}`))));
    });
  }
  function estadoOral() {
    let g = null; try { g = dirPerfil() ? grabacionEnCurso() : null; } catch (e) { g = null; }
    return { grabando: g && { id: g.id, clase: g.clase, inicio: g.inicio, nivel: g.nivel, micro: g.micro }, transcribiendo, cola: cola.slice() };
  }
  const rutaAudio = (id) => { const f = ficha(id); return f ? path.join(dirAudio(), f.audio) : null; };

  /**
   * Valora una grabación ya transcrita. clase: lectura (lectura en voz alta: se compara con el texto), exposicion (sobre un texto),
   * tribunal (respuesta a una pregunta: ref = {pregunta, ideas, textoId}) o resumen (lees tu resumen: se compara con lo escrito).
   */
  async function valorarOral({ id, ref, sinSesion }, aviso = () => {}) {
    const f = ficha(id); if (!f) throw new Error('Grabación no encontrada.');
    if (f.estado !== 'transcrito') throw new Error(f.estado === 'error' ? `No se pudo transcribir: ${f.error}` : 'La grabación aún se está transcribiendo.');
    if (f.valoracionOral && !ref) return f;   // ya valorada: no se repite (ni se cuenta otra sesión)
    const r = { ...(f.ref || {}), ...(ref || {}) };
    const out = { metricas: f.metricas, velocidad: X.valorarVelocidad(f.metricas.ppm) };
    let original = '';
    if (r.textoId) { const t = texto(f.lengua, r.textoId); if (t) original = t.parrafos.slice(0, r.k || t.parrafos.length).join('\n\n'); }
    if ((f.clase === 'lectura' && original) || (f.clase === 'resumen' && r.escrito)) {
      const cmp = X.comparar(f.clase === 'lectura' ? original : r.escrito, f.texto);
      out.lectura = { resumen: cmp.resumen, saltadas: cmp.palabras.filter((x) => x.tipo === 'falta').map((x) => x.o).slice(0, 40),
        cambiadas: cmp.palabras.filter((x) => x.tipo === 'mal').map((x) => `${x.o} → ${x.e}`).slice(0, 40) };
    }
    const e = await herramientas.estado();
    if (e.ollama && e.modelo && (f.clase === 'exposicion' || f.clase === 'tribunal')) {
      aviso('Valorando con el modelo local…');
      try {
        if (f.clase === 'tribunal') out.valoracion = await herramientas.preguntar(X.promptTribunal({ lengua: f.lengua, pregunta: r.pregunta, ideas: r.ideas, transcripcion: f.texto, segundos: f.segundos, texto: original }));
        else {
          const t = texto(f.lengua, r.textoId) || {};
          const ideas = (t.ideas_clave || []).filter((x) => (x.parrafos || [0]).some((i) => i < (r.k || 1e9)));
          out.valoracion = await herramientas.preguntar(X.promptExposicion({ lengua: f.lengua, texto: original, ideas, transcripcion: f.texto, segundos: f.segundos }));
          out.ideas = ideas; out.nota = X.notaRubrica(out.valoracion.criterios || {});
        }
      } catch (x) { out.aviso = `Modelo local: ${x.message}`; }
    } else if (f.clase === 'exposicion' || f.clase === 'tribunal') out.aviso = 'El modelo local no está instalado: revisa tú la transcripción.';
    escribir(path.join(dirAudio(), `${id}.json`), { ...f, ref: r, valoracionOral: out });
    if (f.clase === 'tribunal' && out.valoracion && Number.isFinite(out.valoracion.contenido)) out.nota = Math.round(((out.valoracion.contenido + (out.valoracion.lengua || 0)) / 8) * 100) / 10;
    if (!f.valoracionOral && !sinSesion) anotarSesion({ id, fecha: f.fecha, lengua: f.lengua, tipo: 'oral', minutos: Math.round(f.segundos / 6) / 10, materias: [], clase: f.clase, ejercicios: 1,
      aciertos: out.nota != null ? out.nota / 10 : out.lectura ? out.lectura.resumen.nota : 0 });
    return { ...ficha(id), valoracionOral: out };
  }
  function grabaciones({ lengua }) {
    let xs = []; try { xs = fs.readdirSync(dirAudio()).filter((x) => x.endsWith('.json') && x !== 'grabando.json'); } catch (e) { return []; }
    return xs.map((x) => leer(path.join(dirAudio(), x), null)).filter((g) => g && g.lengua === lengua).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 40)
      .map(({ segmentos, ...g }) => g);
  }

  // ---------------------------------------------------------------- sesión tipo examen (BOE-A-2025-26902): se guarda al terminar
  function guardarExamen(x) {
    const id = `${sello()}_examen`;
    escribir(fp(path.join('examenes', `${id}.json`)), { ...x, id, fecha: new Date().toISOString() });
    anotarSesion({ id, fecha: x.inicio || new Date().toISOString(), lengua: x.lengua, tipo: 'examen', minutos: Math.round((x.segundos || 0) / 6) / 10, materias: [],
      ejercicios: 1, aciertos: x.nota != null ? x.nota / 10 : 0 });
    return id;
  }

  return { retomar, biblioteca, abrir, responder, dictado, terminarTexto, corregirEscrito, autoevaluar, escritos, escrito, listaTareas, expresiones,
    preguntasTribunal, grabar, pararGrabacion, estadoOral, valorarOral, grabaciones, rutaAudio, guardarExamen, tarea: ({ lengua, id }) => tareas(lengua).find((t) => t.id === id) || null };
}

module.exports = { crearPracticas };
