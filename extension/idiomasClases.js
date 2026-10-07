// Pestaña Idiomas: «Clases» con profesores (Meet, Teams…). Cada clase guarda datos, notas, ficheros adjuntos, el audio (grabado con el
// micrófono del Mac o subido desde el iPhone) y su transcripción con whisper, en TCEE/idiomas-<nombre>/clases/<id>/. Para ocupar poco:
// el audio se guarda en mp3 mono de 32 kbit/s (unos 14 MB por hora) y los documentos de Word se pasan a texto. Reglas: main/IDIOMAS.md
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const C = require('./cante');

const HZ = 16000;
const MAX_SEG = 3 * 3600;   // una clase no pasa de 3 horas
const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const escribir = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1) + '\n'); fs.renameSync(f + '.tmp', f); };
const dos = (n) => String(n).padStart(2, '0');
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clase';
const AUDIO = /\.(m4a|mp3|wav|aac|caf|aiff?|ogg|opus|flac|mp4|mov|m4v|webm)$/i;
const TEXTO = /\.(txt|md|vtt|srt|csv)$/i;
const CONVERTIBLE = /\.(docx?|rtf|rtfd|odt|html?|pages|webarchive)$/i;   // textutil (macOS) los pasa a texto
const ALUCINACIONES = /thank(s| you) for watching|please subscribe|subtitles by|sous-titr|merci d'avoir regard|abonnez-vous|amara\.org|subt[ií]tulos (realizados|por)|gracias por ver/i;

function crearClases({ dirPerfil, otroOcupado = () => null, avisar = () => {}, alCambiar = () => {} }) {
  const dirClases = () => { const d = dirPerfil(); if (!d) throw new Error('Crea primero tu perfil.'); return path.join(d, 'clases'); };
  const dirClase = (id) => { if (!/^[\w.-]+$/.test(String(id))) throw new Error('Clase no válida.'); return path.join(dirClases(), id); };
  const fClase = (id) => path.join(dirClase(id), 'clase.json');
  const clase = (id) => leer(fClase(id), null);
  const guardar = (c) => { escribir(fClase(c.id), c); return c; };
  const marca = () => path.join(dirClases(), 'grabando.json');
  let transcribiendo = null; const cola = [];

  // ---------------------------------------------------------------- clases
  function lista({ lengua } = {}) {
    let ds = []; try { ds = fs.readdirSync(dirClases()).filter((d) => fs.existsSync(path.join(dirClases(), d, 'clase.json'))); } catch (e) { return []; }
    return ds.map((d) => clase(d)).filter((c) => c && (!lengua || c.lengua === lengua)).sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(({ transcripciones, notas, ...c }) => ({ ...c, notas: (notas || '').slice(0, 160), transcritos: (transcripciones || []).length,
        minutos: Math.round((c.audios || []).reduce((a, x) => a + (x.segundos || 0), 0) / 60) }));
  }
  function crear({ lengua, titulo, profesor, fecha }) {
    const f = fecha ? new Date(fecha) : new Date();
    const id = `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}_${dos(new Date().getHours())}${dos(new Date().getMinutes())}_${lengua}-${slug(titulo || profesor)}`;
    fs.mkdirSync(path.join(dirClases(), id, 'adjuntos'), { recursive: true });
    return guardar({ id, lengua, titulo: String(titulo || '').trim() || 'Clase', profesor: String(profesor || '').trim(), fecha: f.toISOString(),
      notas: '', adjuntos: [], audios: [], transcripciones: [], creada: new Date().toISOString() });
  }
  function cambiar({ id, cambios }) {
    const c = clase(id); if (!c) throw new Error('Clase no encontrada.');
    for (const k of ['titulo', 'profesor', 'notas', 'fecha', 'revisar']) if (cambios && k in cambios) c[k] = cambios[k];
    return guardar(c);
  }
  const ruta = (id) => dirClase(id);

  // ---------------------------------------------------------------- ficheros: texto y documentos (pequeños) o audio (comprimido)
  /** Añade ficheros elegidos por el usuario. Los audios se convierten a mp3 mono 32 kbit/s; Word y similares, a texto */
  async function importar({ id, rutas }, aviso = () => {}) {
    const c = clase(id); if (!c) throw new Error('Clase no encontrada.');
    const dAdj = path.join(dirClase(id), 'adjuntos'); fs.mkdirSync(dAdj, { recursive: true });
    const resultado = [];
    for (const r of rutas || []) {
      const base = path.basename(r);
      try {
        if (AUDIO.test(base)) {
          aviso(`Comprimiendo el audio «${base}»…`);
          const a = await anadirAudio(c, r, 'subido', base);
          resultado.push(`${base}: audio de ${Math.round(a.segundos / 60)} min`);
          continue;
        }
        let destino = path.join(dAdj, libre(dAdj, base)), tipo = 'fichero';
        if (CONVERTIBLE.test(base) && process.platform === 'darwin') {
          destino = path.join(dAdj, libre(dAdj, base.replace(CONVERTIBLE, '.txt')));
          await ejecutar('/usr/bin/textutil', ['-convert', 'txt', '-output', destino, r]);
          tipo = 'texto';
        } else {
          fs.copyFileSync(r, destino);
          tipo = TEXTO.test(base) ? 'texto' : /\.pdf$/i.test(base) ? 'pdf' : /\.(png|jpe?g|gif|webp|heic)$/i.test(base) ? 'imagen' : 'fichero';
        }
        c.adjuntos.push({ fichero: path.basename(destino), original: base, tipo, bytes: fs.statSync(destino).size, fecha: new Date().toISOString() });
        resultado.push(`${base}${tipo === 'texto' && !TEXTO.test(base) ? ' (pasado a texto)' : ''}`);
      } catch (e) { resultado.push(`${base}: no se pudo añadir (${String(e.message || e).slice(0, 120)})`); }
    }
    guardar({ ...clase(id), adjuntos: c.adjuntos, audios: clase(id).audios });
    return { clase: clase(id), resultado };
  }
  const libre = (dir, nombre) => { let n = nombre, i = 2; while (fs.existsSync(path.join(dir, n))) { n = nombre.replace(/(\.[^.]*)?$/, `-${i++}$1`); } return n; };
  function quitarAdjunto({ id, fichero }) {
    const c = clase(id); if (!c) throw new Error('Clase no encontrada.');
    try { fs.unlinkSync(path.join(dirClase(id), 'adjuntos', path.basename(fichero))); } catch (e) { /* ya no está */ }
    c.adjuntos = c.adjuntos.filter((a) => a.fichero !== fichero);
    return guardar(c);
  }
  function quitarAudio({ id, fichero }) {
    const c = clase(id); if (!c) throw new Error('Clase no encontrada.');
    try { fs.unlinkSync(path.join(dirClase(id), path.basename(fichero))); } catch (e) { /* ya no está */ }
    c.audios = c.audios.filter((a) => a.fichero !== fichero);
    c.transcripciones = (c.transcripciones || []).filter((t) => t.audio !== fichero);
    return guardar(c);
  }
  /** Texto de un adjunto (para verlo en la pantalla; los .txt pequeños) */
  function leerAdjunto({ id, fichero }) {
    const f = path.join(dirClase(id), 'adjuntos', path.basename(fichero));
    const st = fs.statSync(f); if (st.size > 400000) return { texto: null, ruta: f };
    return { texto: fs.readFileSync(f, 'utf8'), ruta: f };
  }

  async function anadirAudio(c, origen, como, nombre) {
    const h = C.herramientas();
    if (!h.ffmpeg) throw new Error('Falta ffmpeg: pulsa «Instalar herramientas» en Ajustes de Idiomas.');
    const n = (c.audios || []).length + 1;
    const fichero = `audio-${n}.mp3`;
    const destino = path.join(dirClase(c.id), fichero);
    await ejecutar(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', origen, '-vn', '-ac', '1', '-ar', String(HZ), '-c:a', 'libmp3lame', '-b:a', '32k', destino]);
    const segundos = await duracion(h.ffmpeg, destino);
    const fresco = clase(c.id) || c;
    fresco.audios = [...(fresco.audios || []), { fichero, origen: como, nombre: nombre || '', segundos, bytes: fs.statSync(destino).size, fecha: new Date().toISOString() }];
    guardar(fresco); c.audios = fresco.audios;
    return fresco.audios[fresco.audios.length - 1];
  }
  function duracion(ffmpeg, f) {
    return new Promise((ok) => execFile(ffmpeg, ['-hide_banner', '-i', f], { timeout: 20000 }, (e, out, err) => {
      const m = String(err || '').match(/Duration:\s*(\d+):(\d+):([\d.]+)/); ok(m ? Math.round(+m[1] * 3600 + +m[2] * 60 + +m[3]) : 0);
    }));
  }
  function ejecutar(prog, args, alLinea) {
    return new Promise((ok, mal) => {
      const p = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let resto = '', ultimo = '';
      const leerSalida = (d) => { resto += d.toString(); const ls = resto.split(/\r|\n/); resto = ls.pop(); ls.forEach((l) => { if (l.trim()) ultimo = l; if (alLinea) alLinea(l); }); };
      p.stdout.on('data', leerSalida); p.stderr.on('data', leerSalida); p.on('error', mal);
      p.on('close', (k) => (k === 0 ? ok() : mal(new Error(`${path.basename(prog)} terminó con error (${k}): ${ultimo.slice(0, 200)}`))));
    });
  }

  // ---------------------------------------------------------------- grabación con el micrófono del Mac (sin tocar Meet ni Teams)
  function grabacionEnCurso() {
    let m; try { m = JSON.parse(fs.readFileSync(marca(), 'utf8')); } catch (e) { return null; }
    let mtime = 0; try { mtime = fs.statSync(m.wav).mtimeMs; } catch (e) { /* aún sin audio */ }
    if (vivo(m.pid) && Date.now() - Math.max(mtime, m.inicio) < 15000) return { ...m, nivel: C.nivel(m.registro) };
    cerrar(m);   // se cortó (tope, Mac apagado): se guarda lo grabado
    return null;
  }
  async function microfonos() { const h = C.herramientas(); return h.ffmpeg ? C.microfonos(h.ffmpeg) : []; }
  async function grabar({ id, micro }) {
    const c = clase(id); if (!c) throw new Error('Clase no encontrada.');
    const h = C.herramientas();
    if (!h.ffmpeg) throw new Error('Falta ffmpeg: pulsa «Instalar herramientas» en Ajustes de Idiomas.');
    if (grabacionEnCurso()) throw new Error('Ya se está grabando una clase.');
    const o = otroOcupado(); if (o && o.grabando) throw new Error('Hay otra grabación en marcha (cante u oral): termínala antes.');
    const lista = await C.microfonos(h.ffmpeg);
    const mic = lista.find((m) => m.nombre === micro) || C.elegirMicro(lista, null);
    if (!mic) throw new Error('ffmpeg no encuentra ningún micrófono. Revisa Ajustes del Sistema › Privacidad y seguridad › Micrófono › Visual Studio Code.');
    const wav = path.join(dirClase(id), `grabando-${Date.now()}.wav`), registro = wav.replace(/\.wav$/, '.log');
    const fd = fs.openSync(registro, 'w');
    const p = spawn(h.ffmpeg, ['-hide_banner', '-nostdin', '-f', 'avfoundation', '-i', `:${mic.indice}`, '-t', String(MAX_SEG), '-af', 'ebur128=framelog=info',
      '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', '-flush_packets', '1', '-y', wav], { detached: true, stdio: ['ignore', 'ignore', fd] });
    fs.closeSync(fd); p.unref();
    const m = { clase: id, pid: p.pid, inicio: Date.now(), wav, registro, micro: mic.nombre };
    escribir(marca(), m);
    setTimeout(() => { if (!vivo(p.pid) && leer(marca(), {}).pid === p.pid) { cerrar(m); avisar('La grabación de la clase no ha arrancado: revisa el permiso de micrófono de Visual Studio Code.', true); alCambiar(); } }, 2500);
    return { inicio: m.inicio, micro: mic.nombre };
  }
  async function parar({ descartar } = {}) {
    const m = grabacionEnCurso(); if (!m) return null;
    try { process.kill(m.pid, 'SIGINT'); } catch (e) { /* ya parado */ }
    for (let i = 0; i < 50 && vivo(m.pid); i++) await new Promise((r) => setTimeout(r, 100));
    if (vivo(m.pid)) { try { process.kill(m.pid, 'SIGKILL'); } catch (e) { /* */ } }
    return cerrar(m, descartar);
  }
  /** Cierra una grabación parada: la comprime a mp3 y la añade a la clase (el WAV se borra) */
  async function cerrar(m, descartar) {
    try { fs.unlinkSync(marca()); } catch (e) { /* */ }
    try { fs.unlinkSync(m.registro); } catch (e) { /* */ }
    let bytes = 0; try { bytes = fs.statSync(m.wav).size; } catch (e) { /* */ }
    if (descartar || bytes < HZ * 2 * 2) { try { fs.unlinkSync(m.wav); } catch (e) { /* */ } alCambiar(); return null; }
    const c = clase(m.clase); if (!c) return null;
    try {
      // si el WAV quedó a medias, se relee como audio en bruto (como en el cante)
      const limpio = m.wav.replace(/\.wav$/, '-limpio.wav'); const h = C.herramientas();
      let ok = false;
      try { await ejecutar(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', m.wav, '-c:a', 'pcm_s16le', limpio]); ok = fs.statSync(limpio).size > bytes * 0.9; } catch (e) { ok = false; }
      if (!ok) await ejecutar(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-f', 's16le', '-ar', String(HZ), '-ac', '1', '-i', m.wav, '-c:a', 'pcm_s16le', limpio]);
      const a = await anadirAudio(c, limpio, 'grabado', `Grabación (${m.micro})`);
      for (const x of [m.wav, limpio]) { try { fs.unlinkSync(x); } catch (e) { /* */ } }
      alCambiar();
      return a;
    } catch (e) { avisar(`No se pudo guardar la grabación de la clase (el WAV sigue en su carpeta): ${e.message}`, true); alCambiar(); return null; }
  }

  // ---------------------------------------------------------------- transcripción (al pulsar «Transcribir»; una cada vez)
  function transcribir({ id, fichero, idioma }) {
    const c = clase(id); if (!c) throw new Error('Clase no encontrada.');
    if (!c.audios.some((a) => a.fichero === fichero)) throw new Error('Audio no encontrado.');
    if (!cola.some((x) => x.id === id && x.fichero === fichero) && !(transcribiendo && transcribiendo.id === id && transcribiendo.fichero === fichero)) cola.push({ id, fichero, idioma: idioma || c.lengua });
    siguiente();
    return estado();
  }
  async function siguiente() {
    if (transcribiendo || !cola.length) return;
    const o = otroOcupado(); if (o && o.transcribiendo) { setTimeout(siguiente, 15000); return; }   // un whisper cada vez (8 GB)
    const t = cola.shift();
    const h = C.herramientas();
    if (h.falta.length) { avisar(`No puedo transcribir: falta ${h.falta.join(', ')}.`, true); cola.length = 0; alCambiar(); return; }
    transcribiendo = { ...t, pct: 0 }; alCambiar(true);
    const base = path.join(os.tmpdir(), `tcee-clase-${Date.now()}`), wav = `${base}.wav`;
    try {
      await ejecutar(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', path.join(dirClase(t.id), t.fichero), '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', wav]);
      const args = ['-m', h.modelo, '-f', wav, '-l', t.idioma === 'auto' ? 'auto' : t.idioma, '-oj', '-of', base, '-pp', '-ml', '80', '-sow',
        '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1)))];
      await ejecutar(h.whisper, args, (l) => { const x = l.match(/progress\s*=\s*(\d+)%/); if (x && transcribiendo) { transcribiendo.pct = Number(x[1]); alCambiar(true); } });
      const j = leer(`${base}.json`, { transcription: [] });
      const segmentos = (j.transcription || []).map((s) => ({ t: Math.round((s.offsets ? s.offsets.from : 0) / 100) / 10, texto: (s.text || '').trim() }))
        .filter((s) => s.texto && !ALUCINACIONES.test(s.texto) && !/^\[.*\]$|^\(.*\)$/.test(s.texto));
      const c = clase(t.id);
      if (c) {
        c.transcripciones = [...(c.transcripciones || []).filter((x) => x.audio !== t.fichero), { audio: t.fichero, idioma: t.idioma, fecha: new Date().toISOString(), segmentos }];
        guardar(c);
        // copia en texto plano (para leerla fuera del panel o revisarla con Claude)
        fs.writeFileSync(path.join(dirClase(t.id), t.fichero.replace(/\.mp3$/, '.txt')), segmentos.map((s) => `[${Math.floor(s.t / 60)}:${dos(Math.floor(s.t % 60))}] ${s.texto}`).join('\n') + '\n');
        avisar(`Transcripción lista: ${c.titulo}.`);
      }
    } catch (e) { avisar(`No se pudo transcribir la clase: ${e.message}`, true); }
    finally {
      for (const x of [wav, `${base}.json`]) { try { fs.unlinkSync(x); } catch (e) { /* */ } }
      transcribiendo = null; alCambiar(true); siguiente();
    }
  }

  function estado() {
    let g = null; try { g = dirPerfil() ? grabacionEnCurso() : null; } catch (e) { g = null; }
    return { grabando: g && { clase: g.clase, inicio: g.inicio, nivel: g.nivel, micro: g.micro }, transcribiendo, cola: cola.map((x) => ({ id: x.id, fichero: x.fichero })) };
  }
  function eliminar({ id }) { return dirClase(id); }   // la extensión la manda a la Papelera

  return { lista, crear, cambiar, clase, ruta, importar, quitarAdjunto, quitarAudio, leerAdjunto, microfonos, grabar, parar, transcribir, estado, eliminar,
    retomar: () => { try { if (dirPerfil()) grabacionEnCurso(); } catch (e) { /* */ } } };
}

module.exports = { crearClases };
