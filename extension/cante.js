// Pestaña «Cante» del Panel Oposición: graba el cante con el micrófono del Mac (ffmpeg), cronometra y lo transcribe al terminar (whisper.cpp, sin conexión).
// Reglas y decisiones: main/CANTE.md
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const HZ = 16000;                        // whisper trabaja con audio mono a 16 kHz
const BYTES_SEG = HZ * 2;                // PCM de 16 bits
const MAX_SEG = 4 * 3600;                // tope de seguridad de una grabación
const MODELO = 'ggml-large-v3-turbo.bin';
const RUTAS_BIN = [process.env.TCEE_BIN, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'].filter(Boolean);   // TCEE_BIN: solo para pruebas
// frases que whisper «inventa» en silencios largos (vienen de subtítulos con los que se entrenó)
const ALUCINACIONES = /amara\.org|subt[ií]tulos (realizados|por)|gracias por ver el v[ií]deo|suscr[ií]bete/i;

const existe = (f) => { try { fs.accessSync(f); return true; } catch (e) { return false; } };
const bin = (...nombres) => { for (const d of RUTAS_BIN) for (const n of nombres) if (existe(path.join(d, n))) return path.join(d, n); return null; };
const leerJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
const dos = (n) => String(n).padStart(2, '0');

/** Programas y modelo necesarios. falta: lista de lo que no está instalado */
function herramientas() {
  const modelo = path.join(os.homedir(), '.tcee', 'modelos', MODELO);
  const h = { ffmpeg: bin('ffmpeg'), whisper: bin('whisper-cli', 'whisper-cpp'), modelo: existe(modelo) ? modelo : null };
  h.falta = [!h.ffmpeg && 'ffmpeg', !h.whisper && 'whisper.cpp', !h.modelo && 'modelo de idioma'].filter(Boolean);
  return h;
}

/** Carpeta de audios: ~/.tcee_carpeta_cantes si existe; si no, «OPO - TCEE/Cantes» en iCloud; si no, TCEE/.cantes-audio */
function carpetaAudio(raiz) {
  const conf = path.join(os.homedir(), '.tcee_carpeta_cantes');
  if (existe(conf)) { const d = fs.readFileSync(conf, 'utf8').trim().replace(/^~/, os.homedir()); if (d) return d; }
  const icloud = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'OPO - TCEE');
  return existe(icloud) ? path.join(icloud, 'Cantes') : path.join(raiz, '.cantes-audio');
}

/** Micrófonos que ve ffmpeg: [{indice, nombre}] */
function microfonos(ffmpeg) {
  return new Promise((ok) => execFile(ffmpeg, ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { timeout: 10000 }, (e, out, err) => {
    const lineas = String(err || '').split('\n');
    const i = lineas.findIndex((l) => /audio devices/i.test(l));
    ok(i < 0 ? [] : lineas.slice(i + 1).map((l) => l.match(/\[(\d+)\]\s+(.+)$/)).filter(Boolean).map((m) => ({ indice: Number(m[1]), nombre: m[2].trim() })));
  }));
}
/** Micrófono por defecto: el elegido antes; si no, el integrado del Mac; si no, el primero que no sea virtual ni un iPhone */
function elegirMicro(lista, preferido) {
  return lista.find((m) => m.nombre === preferido)
    || lista.find((m) => /macbook|built-?in|integrad/i.test(m.nombre))
    || lista.find((m) => !/iphone|ipad|zoom|teams|blackhole|virtual|soundflower|aggregate|loopback/i.test(m.nombre))
    || lista[0] || null;
}

/** Palabras clave del tema para orientar a whisper (título y autores en mayúsculas): mejora nombres propios y términos */
function pista(titulo, texto) {
  const autores = [...new Set((texto || '').match(/\b[A-ZÁÉÍÓÚÑ]{4,}(?:-[A-ZÁÉÍÓÚÑ]{3,})?\b/g) || [])]
    .filter((a) => !/^(NOTA|OJO|TCEE|PIB|IVA|BCE|FMI|OCDE|UE)$/.test(a)).slice(0, 25);
  return `Exposición oral del tema «${titulo}» de la oposición a Técnico Comercial y Economista del Estado.${autores.length ? ` Autores: ${autores.join(', ')}.` : ''}`.slice(0, 600);
}

/** Último nivel de micrófono (LUFS momentáneos) escrito por el filtro ebur128 en el registro de ffmpeg */
function nivel(registro) {
  try {
    const fd = fs.openSync(registro, 'r'); const tam = fs.fstatSync(fd).size; const n = Math.min(4096, tam);
    const b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, tam - n); fs.closeSync(fd);
    const ms = [...b.toString('utf8').matchAll(/\bM:\s*(-?[\d.]+|-inf)/g)];
    if (!ms.length) return null;
    const v = ms[ms.length - 1][1];
    return v === '-inf' ? -120 : Number(v);
  } catch (e) { return null; }
}

function crearCante({ raiz, progreso, avisar, alCambiar }) {
  const dirTx = () => (progreso.hayCarpeta() ? path.join(progreso.dir, 'cantes') : path.join(raiz(), '.cantes-texto'));
  const dirAudio = () => carpetaAudio(raiz());
  const marca = () => path.join(dirAudio(), 'grabando.json');   // grabación en curso (sobrevive a recargar la ventana)
  let transcribiendo = null;   // {id, pct}
  let proceso = null, cancelado = false;   // programa que corre ahora en la transcripción (para poder cancelarla)
  const cola = [];

  // ---------------------------------------------------------------- grabación
  /** Grabación en curso. Si ffmpeg ya no está grabando (Mac apagado, proceso cortado) se cierra con lo que se llegó a grabar */
  function enCurso() {
    const m = leerJson(marca(), null);
    if (!m) return null;
    let mtime = 0; try { mtime = fs.statSync(m.wav).mtimeMs; } catch (e) { /* aún sin fichero */ }
    const creciendo = Date.now() - Math.max(mtime, m.inicio) < 15000;   // un PID reutilizado por otro programa no cuenta
    if (vivo(m.pid) && creciendo) return m;
    cerrar(m, { cortada: true });
    return null;
  }

  /** Cierra una grabación ya parada: ficha en progreso/cantes y transcripción en cola (o la borra si se descarta) */
  function cerrar(m, { fin, descartar, cortada } = {}) {
    try { fs.unlinkSync(marca()); } catch (e) { /* ya no está */ }
    try { fs.unlinkSync(m.registro); } catch (e) { /* sin registro */ }
    let bytes = 0; try { bytes = fs.statSync(m.wav).size; } catch (e) { /* sin audio */ }
    if (descartar || bytes <= BYTES_SEG) {
      try { fs.unlinkSync(m.wav); } catch (e) { /* sin audio */ }
      if (!descartar) avisar('No se ha grabado audio (¿micrófono sin permiso u ocupado?). Revisa Ajustes del Sistema › Privacidad y seguridad › Micrófono › Visual Studio Code.', true);
      alCambiar();
      return;
    }
    const duracion = Math.round(cortada ? bytes / BYTES_SEG : ((fin || Date.now()) - m.inicio) / 1000);
    guardarFicha({ id: m.id, codigo: m.codigo, titulo: m.titulo, fecha: new Date(m.inicio).toISOString(), duracion, objetivo: m.objetivo,
      micro: m.micro, audio: path.basename(m.wav), pista: m.pista, estado: 'pendiente', ...(cortada ? { cortada: true } : {}) });
    // no se transcribe sola: consume mucha batería unos minutos; se lanza con «Transcribir» cuando convenga
    if (cortada) avisar(`La grabación del cante de ${m.codigo} se cortó (¿se apagó el Mac?). Se ha guardado lo grabado (${Math.round(duracion / 60) || 'menos de 1'} min): pulsa «Transcribir» cuando quieras.`, true);
    alCambiar();
    return m.id;
  }

  async function empezar({ codigo, titulo, objetivo, micro, texto }) {
    const h = herramientas();
    if (!h.ffmpeg) throw new Error('Falta ffmpeg. Pulsa «Instalar herramientas de cante».');
    if (enCurso()) throw new Error('Ya hay un cante grabándose.');
    const lista = await microfonos(h.ffmpeg);
    const mic = elegirMicro(lista, micro);
    if (!mic) throw new Error('ffmpeg no encuentra ningún micrófono. Revisa Ajustes del Sistema › Privacidad y seguridad › Micrófono › Visual Studio Code.');
    fs.mkdirSync(dirAudio(), { recursive: true });
    const ahora = new Date();
    const id = `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}_${dos(ahora.getHours())}${dos(ahora.getMinutes())}_${codigo}`;
    const wav = path.join(dirAudio(), `${id}.wav`);
    const registro = path.join(dirAudio(), `${id}.log`);
    const fd = fs.openSync(registro, 'w');
    // audio → mono 16 kHz PCM; ebur128 escribe el nivel en el registro (sirve para el medidor y para avisar si no llega sonido)
    const p = spawn(h.ffmpeg, ['-hide_banner', '-nostdin', '-f', 'avfoundation', '-i', `:${mic.indice}`, '-t', String(MAX_SEG),
      '-af', 'ebur128=framelog=info', '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', '-flush_packets', '1', '-y', wav],
    { detached: true, stdio: ['ignore', 'ignore', fd] });
    fs.closeSync(fd);
    p.unref();
    const m = { id, pid: p.pid, codigo, titulo, inicio: ahora.getTime(), objetivo: Number(objetivo) || 0, micro: mic.nombre, wav, registro, pista: pista(titulo, texto) };
    fs.writeFileSync(marca(), JSON.stringify(m, null, 1));
    // si ffmpeg se cierra enseguida (permiso de micrófono denegado, dispositivo ocupado…) se avisa
    setTimeout(() => {
      if (vivo(p.pid) || !leerJson(marca(), null)) return;
      let err = ''; try { err = fs.readFileSync(registro, 'utf8').split('\n').filter((l) => /error|denied|not permitted|could not/i.test(l)).slice(-2).join(' '); } catch (e) { /* sin registro */ }
      if (err) avisar(`ffmpeg: ${err.slice(0, 300)}`, true);
      cerrar(m, {});
    }, 2500);
    alCambiar();
    return m;
  }

  /** Para la grabación (SIGINT: ffmpeg cierra el fichero bien), guarda la ficha y encola la transcripción */
  async function terminar(descartar) {
    const m = leerJson(marca(), null);
    if (!m) return;
    const fin = Date.now();
    if (vivo(m.pid)) { try { process.kill(m.pid, 'SIGINT'); } catch (e) { /* ya parado */ } }
    for (let i = 0; i < 50 && vivo(m.pid); i++) await new Promise((r) => setTimeout(r, 100));
    if (vivo(m.pid)) { try { process.kill(m.pid, 'SIGKILL'); } catch (e) { /* ya parado */ } }
    return cerrar(m, { fin, descartar });
  }

  // ---------------------------------------------------------------- fichas (progreso/cantes/<id>.json)
  const fichero = (id) => path.join(dirTx(), `${id}.json`);
  function guardarFicha(f) { if (!f || !f.id) return; fs.mkdirSync(dirTx(), { recursive: true }); fs.writeFileSync(fichero(f.id), JSON.stringify(f, null, 1) + '\n'); }
  function lista() {
    let fs_ = []; try { fs_ = fs.readdirSync(dirTx()).filter((f) => f.endsWith('.json')); } catch (e) { /* aún no hay cantes */ }
    return fs_.map((f) => leerJson(path.join(dirTx(), f), null)).filter((f) => f && f.id && f.fecha)
      .map(({ segmentos, texto, ...r }) => ({ ...r, palabras: texto ? texto.split(/\s+/).filter(Boolean).length : 0,
        audioExiste: existe(path.join(dirAudio(), r.audio || '')) || existe(path.join(dirAudio(), (r.audio || '').replace(/\.wav$/, '.m4a'))) }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  const leer = (id) => leerJson(fichero(id), null);
  function eliminar(id) {
    const f = leer(id);
    if (f) for (const a of [f.audio, (f.audio || '').replace(/\.wav$/, '.m4a')]) { try { fs.unlinkSync(path.join(dirAudio(), a)); } catch (e) { /* no estaba */ } }
    try { fs.unlinkSync(fichero(id)); } catch (e) { /* no estaba */ }
    alCambiar();
  }
  function rutaAudio(id) {
    const f = leer(id); if (!f) return null;
    return [f.audio, (f.audio || '').replace(/\.wav$/, '.m4a')].map((a) => path.join(dirAudio(), a)).find(existe) || null;
  }

  // ---------------------------------------------------------------- transcripción (una cada vez, en segundo plano)
  function encolar(id) { if (!cola.includes(id) && (!transcribiendo || transcribiendo.id !== id)) cola.push(id); siguiente(); }

  async function siguiente() {
    if (transcribiendo || !cola.length) return;
    const id = cola.shift();
    const f = leer(id); if (!f) return siguiente();
    const h = herramientas();
    if (h.falta.length) { avisar(`No puedo transcribir: falta ${h.falta.join(', ')}. Pulsa «Instalar herramientas de cante».`, true); return; }
    transcribiendo = { id, pct: 0, codigo: f.codigo };
    cancelado = false;
    alCambiar();
    const wav = path.join(dirAudio(), f.audio);
    const limpio = path.join(os.tmpdir(), `tcee-${id}.wav`);
    const base = path.join(os.tmpdir(), `tcee-${id}`);
    try {
      // copia limpia del audio; si el WAV quedó a medias (ventana cerrada, Mac apagado) su cabecera no indica la duración
      // y se relee como PCM en bruto (los primeros bytes de cabecera son un chasquido de milisegundos)
      const tam = fs.statSync(wav).size;
      let ok = false;
      try { await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', wav, '-ac', '1', '-ar', String(HZ), '-c:a', 'pcm_s16le', limpio]); ok = fs.statSync(limpio).size > tam * 0.9; } catch (e) { ok = false; }
      if (!ok) await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-f', 's16le', '-ar', String(HZ), '-ac', '1', '-i', wav, '-c:a', 'pcm_s16le', limpio]);
      const args = ['-m', h.modelo, '-f', limpio, '-l', 'es', '-oj', '-of', base, '-pp', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1)))];
      if (f.pista) args.push('--prompt', f.pista);
      await correr(h.whisper, args, (linea) => {
        const m = linea.match(/progress\s*=\s*(\d+)%/);
        if (m && transcribiendo) { transcribiendo.pct = Number(m[1]); alCambiar(true); }
      });
      const j = leerJson(`${base}.json`, { transcription: [] });
      const segmentos = (j.transcription || []).map((s) => ({ t: Math.round((s.offsets ? s.offsets.from : 0) / 1000), texto: (s.text || '').trim() }))
        .filter((s) => s.texto && !ALUCINACIONES.test(s.texto));
      // audio comprimido para guardar (≈20 MB por hora) en lugar del WAV (≈115 MB por hora)
      const m4a = wav.replace(/\.wav$/, '.m4a');
      await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', limpio, '-c:a', 'aac', '-b:a', '48k', m4a]);
      try { fs.unlinkSync(wav); } catch (e) { /* ya no está */ }
      if (!leer(id)) { try { fs.unlinkSync(m4a); } catch (e) { /* no estaba */ } return; }   // se eliminó mientras se transcribía
      guardarFicha({ ...leer(id), audio: path.basename(m4a), estado: 'transcrito', modelo: MODELO, segmentos, texto: segmentos.map((s) => s.texto).join(' ') });
      avisar(`Transcripción lista: cante de ${f.codigo}.`);
    } catch (e) {
      if (cancelado) { guardarFicha({ ...leer(id), estado: 'pendiente' }); avisar(`Transcripción del cante de ${f.codigo} cancelada. Queda pendiente.`); }
      else {
        guardarFicha({ ...leer(id), estado: 'error', error: String(e.message || e).slice(0, 400) });
        avisar(`No se pudo transcribir el cante de ${f.codigo}: ${e.message || e}`, true);
      }
    } finally {
      for (const x of [limpio, `${base}.json`]) { try { fs.unlinkSync(x); } catch (e) { /* no estaba */ } }
      transcribiendo = null;
      alCambiar();
      siguiente();
    }
  }

  function correr(prog, args, alLinea) {
    return new Promise((ok, mal) => {
      if (cancelado) { mal(new Error('cancelado')); return; }
      const p = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proceso = p;
      let cola_ = '', ultimo = '';
      const leerSalida = (d) => { cola_ += d.toString(); const ls = cola_.split(/\r|\n/); cola_ = ls.pop(); ls.forEach((l) => { if (l.trim()) ultimo = l; if (alLinea) alLinea(l); }); };
      p.stdout.on('data', leerSalida); p.stderr.on('data', leerSalida);
      p.on('error', mal);
      p.on('close', (c) => { proceso = null; return c === 0 ? ok() : mal(new Error(`${path.basename(prog)} terminó con error (${c}): ${ultimo.slice(0, 200)}`)); });
    });
  }

  /** Para la transcripción en curso y vacía la cola (los cantes quedan pendientes) */
  function cancelar() {
    cola.length = 0;
    if (!transcribiendo) { alCambiar(); return; }
    cancelado = true;
    if (proceso) { try { proceso.kill('SIGTERM'); } catch (e) { /* ya terminó */ } }
  }

  /** Al abrir VS Code: cierra una grabación que se cortó mientras estaba cerrado. Los pendientes NO se transcriben solos */
  function retomar() {
    enCurso();
  }

  /** Estado para la página: grabación en curso (con nivel del micrófono), transcripción en curso, herramientas */
  function estado() {
    const g = enCurso();
    const h = herramientas();
    return {
      falta: h.falta,
      carpetaAudio: dirAudio(),
      grabando: g && { id: g.id, codigo: g.codigo, titulo: g.titulo, inicio: g.inicio, objetivo: g.objetivo, micro: g.micro, nivel: nivel(g.registro) },
      transcribiendo,
      cola: cola.slice(),
    };
  }

  return { herramientas, microfonos: async () => { const h = herramientas(); return h.ffmpeg ? microfonos(h.ffmpeg) : []; },
    empezar, terminar, lista, leer, eliminar, rutaAudio, encolar, cancelar, retomar, estado };
}

module.exports = { crearCante, herramientas, elegirMicro, pista, nivel, ALUCINACIONES };
