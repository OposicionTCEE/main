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

// ---------------------------------------------------------------- tramos (CANTE.md, apartado 6)
// ficha.tramos = { exposicion: [ini, fin] | null, descartar: [[ini, fin], …] } en segundos.
// Sin exposición marcada, todo el audio es exposición. Con exposición marcada, lo que queda fuera es material complementario.
// Lo descartado no cuenta para nada (tampoco dentro de la exposición: resta de la duración real).
const r1 = (x) => Math.round(x * 100) / 100;   // centésimas: se marcan palabras sueltas
function normalizarTramos(t, dur) {
  const lim = (x) => r1(Math.max(0, Math.min(dur || 0, Number(x) || 0)));
  let exposicion = null;
  if (t && Array.isArray(t.exposicion)) {
    const [a, b] = t.exposicion.map(lim).sort((x, y) => x - y);
    if (b - a >= 0.05) exposicion = [a, b];
  }
  const ds = ((t && t.descartar) || []).map((d) => d.map(lim).sort((x, y) => x - y)).filter(([a, b]) => b - a >= 0.05).sort((x, y) => x[0] - y[0]);
  const descartar = [];
  for (const d of ds) { const u = descartar[descartar.length - 1]; if (u && d[0] <= u[1]) u[1] = Math.max(u[1], d[1]); else descartar.push(d.slice()); }
  return { exposicion, descartar };
}
/** Resta de intervalos: [a, b] menos la lista ordenada ds */
function restar([a, b], ds) {
  const r = []; let x = a;
  for (const [c, d] of ds) { if (d <= x || c >= b) continue; if (c > x) r.push([x, c]); x = Math.max(x, d); }
  if (x < b) r.push([x, b]);
  return r;
}
const largo = (xs) => xs.reduce((s, [a, b]) => s + (b - a), 0);
/** Tramos efectivos: exposición (sin lo descartado), complementario, descartado y duración real (s) */
function calcularTramos(f) {
  const dur = Number(f.duracion) || 0;
  const t = normalizarTramos(f.tramos, dur);
  const expo = t.exposicion || [0, dur];
  const exposicion = restar(expo, t.descartar);
  const fuera = t.exposicion ? [...restar([0, expo[0]], t.descartar), ...restar([expo[1], dur], t.descartar)] : [];
  return { marcado: !!(t.exposicion || t.descartar.length), exposicion, complementario: fuera, descartar: t.descartar, real: Math.round(largo(exposicion)) };
}
/** Tipo del instante x: 'exposicion' | 'complementario' | 'descartado' */
function tipoEn(c, x) {
  const en = (xs) => xs.some(([a, b]) => x >= a && x < b);
  return en(c.descartar) ? 'descartado' : en(c.complementario) ? 'complementario' : 'exposicion';
}

/**
 * Palabras con su instante a partir de los tokens del JSON completo de whisper (-ojf), leído como latin1:
 * whisper escribe los bytes UTF-8 tal cual y una letra con tilde puede quedar partida entre dos tokens, así que se juntan los bytes
 * de cada palabra antes de decodificarlos. Devuelve [[t (s, 2 decimales), palabra], …]
 */
function palabrasDeTokens(tokens) {
  const r = [];
  let cur = null;
  const cerrar = () => {
    if (!cur) return;
    let w = Buffer.from(cur.b, 'latin1').toString('utf8');
    if (w.includes('\ufffd')) w = cur.b;   // el fichero traía escapes \u: ya era texto
    w = w.trim();
    if (w) r.push([cur.t, w]);
    cur = null;
  };
  for (const k of tokens || []) {
    const tx = String(k.text || '');
    if (!tx || /^\[_.*\]$/.test(tx.trim())) continue;   // fichas especiales: [_BEG_], [_TT_150], [_EOT_]…
    const t = k.offsets && k.offsets.from >= 0 ? Math.round(k.offsets.from / 10) / 100 : null;
    if (/^\s/.test(tx) || !cur) { cerrar(); cur = { t, b: tx }; } else cur.b += tx;
    if (cur.t == null && t != null) cur.t = t;
  }
  cerrar();
  return r.filter((x) => x[0] != null);
}
/** Palabras de un segmento: las suyas si las tiene; si no, el segmento entero como una sola «palabra» */
const palabrasDe = (seg) => (seg.palabras && seg.palabras.length ? seg.palabras : [[seg.t, seg.texto]]);
const contar = (x) => String(x).split(/\s+/).filter(Boolean).length;

/** Duración de un fichero de audio o vídeo (s), leída de la cabecera con ffmpeg */
function duracionDe(ffmpeg, f) {
  return new Promise((ok) => execFile(ffmpeg, ['-hide_banner', '-nostdin', '-i', f], { timeout: 20000 }, (e, out, err) => {
    const m = String(err || '').match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    const audio = /Stream #.*Audio:/.test(String(err || ''));
    ok({ duracion: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null, audio });
  }));
}

function crearCante({ raiz, progreso, avisar, alCambiar, cacheEscucha, voces }) {
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
      .map((f) => { const c = calcularTramos(f); return { ...f, real: c.real, marcado: c.marcado,
        palabrasExpo: (f.segmentos || []).flatMap(palabrasDe).filter(([t]) => tipoEn(c, t) === 'exposicion').reduce((n, [, w]) => n + contar(w), 0) }; })
      .map(({ segmentos, texto, ...r }) => ({ ...r, palabras: texto ? texto.split(/\s+/).filter(Boolean).length : 0,
        audioExiste: existe(path.join(dirAudio(), r.audio || '')) || existe(path.join(dirAudio(), (r.audio || '').replace(/\.wav$/, '.m4a'))) }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  const leer = (id) => leerJson(fichero(id), null);
  function eliminar(id) {
    const f = leer(id);
    if (f) for (const a of [f.audio, (f.audio || '').replace(/\.wav$/, '.m4a')]) { try { fs.unlinkSync(path.join(dirAudio(), a)); } catch (e) { /* no estaba */ } }
    try { fs.unlinkSync(fichero(id)); } catch (e) { /* no estaba */ }
    if (cacheEscucha) for (const x of [`${id}.mp3`, `${id}.onda.json`]) { try { fs.unlinkSync(path.join(cacheEscucha, x)); } catch (e) { /* no estaba */ } }
    alCambiar();
  }
  function rutaAudio(id) {
    const f = leer(id); if (!f) return null;
    return [f.audio, (f.audio || '').replace(/\.wav$/, '.m4a')].map((a) => path.join(dirAudio(), a)).find(existe) || null;
  }

  // ---------------------------------------------------------------- audios adjuntos (CANTE.md, apartado 6)
  /** Datos de los ficheros elegidos: [{ruta, nombre, fecha (ISO, última modificación), duracion (s), audio}] */
  async function infoAdjuntos(rutas) {
    const h = herramientas();
    if (!h.ffmpeg) throw new Error('Falta ffmpeg. Pulsa «Instalar herramientas de cante».');
    const r = [];
    for (const ruta of rutas) {
      let fecha = null; try { fecha = fs.statSync(ruta).mtime.toISOString(); } catch (e) { /* sin fecha */ }
      const d = await duracionDe(h.ffmpeg, ruta);
      r.push({ ruta, nombre: path.basename(ruta), fecha, duracion: d.duracion, audio: d.audio });
    }
    return r;
  }

  /** Junta los audios (en el orden dado) en un único WAV del cante y crea su ficha, pendiente de transcribir. Los originales no se tocan */
  async function juntar({ codigo, titulo, objetivo, fecha, rutas, texto }) {
    const h = herramientas();
    if (!h.ffmpeg) throw new Error('Falta ffmpeg. Pulsa «Instalar herramientas de cante».');
    if (!rutas || !rutas.length) throw new Error('No hay audios que juntar.');
    for (const r of rutas) if (!existe(r)) throw new Error(`No encuentro «${path.basename(r)}».`);
    const d = new Date(fecha || Date.now());
    if (Number.isNaN(d.getTime())) throw new Error('La fecha no es válida.');
    fs.mkdirSync(dirAudio(), { recursive: true });
    const base = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}${dos(d.getMinutes())}_${codigo}`;
    let id = base;
    for (let i = 2; existe(fichero(id)) || existe(path.join(dirAudio(), `${id}.wav`)) || existe(path.join(dirAudio(), `${id}.m4a`)); i++) id = `${base}-${i}`;
    const wav = path.join(dirAudio(), `${id}.wav`);
    // cada entrada se pasa a mono 16 kHz (el formato de whisper) y se encadenan en el orden elegido
    const args = ['-hide_banner', '-nostdin', '-y'];
    rutas.forEach((r) => args.push('-i', r));
    const filtro = rutas.map((r, i) => `[${i}:a:0]aresample=${HZ},aformat=sample_fmts=s16:channel_layouts=mono[a${i}]`).join(';')
      + `;${rutas.map((r, i) => `[a${i}]`).join('')}concat=n=${rutas.length}:v=0:a=1[s]`;
    args.push('-filter_complex', filtro, '-map', '[s]', '-c:a', 'pcm_s16le', wav);
    try { await correrSimple(h.ffmpeg, args); } catch (e) { try { fs.unlinkSync(wav); } catch (x) { /* no se creó */ } throw e; }
    let bytes = 0; try { bytes = fs.statSync(wav).size; } catch (e) { /* sin audio */ }
    if (bytes <= BYTES_SEG) { try { fs.unlinkSync(wav); } catch (e) { /* sin audio */ } throw new Error('Los ficheros no tienen sonido que se pueda leer.'); }
    guardarFicha({ id, codigo, titulo, fecha: d.toISOString(), duracion: Math.round((await duracionDe(h.ffmpeg, wav)).duracion || bytes / BYTES_SEG), objetivo: Number(objetivo) || 0,
      micro: null, origen: 'adjunto', archivos: rutas.map((r) => path.basename(r)), originales: rutas, audio: path.basename(wav), pista: pista(titulo, texto), estado: 'pendiente' });
    alCambiar();
    return id;
  }

  function correrSimple(prog, args) {
    return new Promise((ok, mal) => execFile(prog, args, { maxBuffer: 16 << 20 }, (e, out, err) => (e
      ? mal(new Error(`${path.basename(prog)}: ${String(err || e.message).trim().split('\n').slice(-2).join(' ').slice(0, 300)}`)) : ok())));
  }

  /** Guarda los tramos marcados (sin repintar el panel: la página ya los muestra) */
  function guardarTramos(id, tramos) {
    const f = leer(id); if (!f || f.guardado) return null;
    const t = normalizarTramos(tramos, f.duracion);
    const n = { ...f }; delete n.tramos;
    if (t.exposicion || t.descartar.length) n.tramos = t;
    guardarFicha(n);
    return calcularTramos(n);
  }

  // ---------------------------------------------------------------- identificar voces (CANTE.md, apartado 8)
  let identificando = null;   // {id, pct}
  async function identificarVoces(id, n) {
    const f = leer(id); if (!f) return;
    if (f.guardado) throw new Error('El cante está guardado: pulsa «Editar» para identificar las voces.');
    if (transcribiendo) throw new Error('Espera a que termine la transcripción en marcha.');
    const h = herramientas(), audio = rutaAudio(id);
    if (!h.ffmpeg || !audio) throw new Error('No encuentro el audio de este cante en este Mac.');
    identificando = { id, pct: 0, codigo: f.codigo }; alCambiar();
    try {
      const tramos = await voces.identificar({ ffmpeg: h.ffmpeg, audio, n, quien: id, alPct: (p) => { if (identificando) { identificando.pct = p; alCambiar(true); } } });
      const g = leer(id); if (!g) return;
      const nh = new Set(tramos.map((x) => x[2])).size;
      const nombres = Object.fromEntries([...Array(nh).keys()].map((k) => [k, ((g.voces || {}).nombres || {})[k] || `Hablante ${k + 1}`]));
      guardarFicha({ ...g, voces: { tramos, n: Number(n) || 0, nombres, fecha: new Date().toISOString() } });
      avisar(`Voces identificadas en el cante de ${f.codigo}: ${nh === 1 ? 'una voz' : `${nh} voces`}. Puedes ponerles nombre.`);
    } catch (e) { avisar(`No se pudieron identificar las voces: ${e.message || e}`, true); }
    finally { identificando = null; alCambiar(); siguiente(); }
  }
  function nombresVoces(id, nombres) {
    const f = leer(id); if (!f || f.guardado || !f.voces) return null;
    const n = {}; for (const k of Object.keys(f.voces.nombres || {})) n[k] = String((nombres || {})[k] || f.voces.nombres[k]).trim().slice(0, 40) || f.voces.nombres[k];
    guardarFicha({ ...f, voces: { ...f.voces, nombres: n } });
    return n;
  }

  /** Guardar (bloquear) o Editar (desbloquear). Al guardar se olvidan las rutas de los originales (la extensión los manda a la Papelera) */
  function bloquear(id, si) {
    const f = leer(id); if (!f) return null;
    if (si && f.estado !== 'transcrito') throw new Error('Solo se puede guardar un cante ya transcrito.');
    const n = { ...f };
    if (si) { n.guardado = new Date().toISOString(); delete n.originales; } else delete n.guardado;
    guardarFicha(n);
    return n;
  }
  /** Ficheros originales de un cante adjuntado que siguen en el Mac */
  const originales = (id) => ((leer(id) || {}).originales || []).filter(existe);

  /** Guarda la transcripción corregida por el usuario (mismos segmentos e instantes; cambia solo el texto) */
  function guardarSegmentos(id, segs) {
    const f = leer(id); if (!f || f.guardado || !Array.isArray(segs)) return false;
    const limpios = segs.map((x) => {
      const seg = { t: Number(x.t) || 0, texto: '' };
      if (Array.isArray(x.palabras) && x.palabras.length) {
        seg.palabras = x.palabras.map(([t, w]) => [Number(t) || 0, String(w || '').replace(/\s+/g, ' ').trim()]).filter(([, w]) => w);
        seg.texto = seg.palabras.map((p) => p[1]).join(' ');
        if (!seg.palabras.length) delete seg.palabras;
      } else seg.texto = String(x.texto || '').replace(/\s+/g, ' ').trim();
      return seg;
    }).filter((x) => x.texto);
    guardarFicha({ ...f, segmentos: limpios, texto: limpios.map((x) => x.texto).join(' '), editado: true });
    return true;
  }

  /** Copia para escuchar en el panel (MP3: el reproductor de VS Code no lee AAC) y forma de onda (pico cada 0,1 s, de 0 a 100) */
  async function escucha(id) {
    const h = herramientas();
    const origen = rutaAudio(id);
    if (!h.ffmpeg || !origen || !cacheEscucha) return null;
    fs.mkdirSync(cacheEscucha, { recursive: true });
    const mp3 = path.join(cacheEscucha, `${id}.mp3`), onda = path.join(cacheEscucha, `${id}.onda.json`);
    const tOrigen = fs.statSync(origen).mtimeMs;
    const vigente = (x) => { try { return fs.statSync(x).mtimeMs >= tOrigen; } catch (e) { return false; } };
    if (!vigente(mp3)) {
      // un WAV cortado no indica su duración: se relee como audio en bruto
      try { await correrSimple(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', origen, '-vn', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', mp3]); }
      catch (e) { await correrSimple(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-f', 's16le', '-ar', String(HZ), '-ac', '1', '-i', origen, '-c:a', 'libmp3lame', '-b:a', '48k', mp3]); }
    }
    // la caché guarda solo las copias de los 6 últimos cantes escuchados (≈20 MB por hora de audio cada una)
    try { fs.utimesSync(mp3, new Date(), fs.statSync(mp3).mtime); } catch (e) { /* recién creada */ }
    try {
      fs.readdirSync(cacheEscucha).filter((x) => x.endsWith('.mp3')).map((x) => ({ x, t: fs.statSync(path.join(cacheEscucha, x)).atimeMs }))
        .sort((a, b) => b.t - a.t).slice(6).forEach(({ x }) => fs.unlinkSync(path.join(cacheEscucha, x)));
    } catch (e) { /* sin caché */ }
    if (!vigente(onda)) {
      const picos = await new Promise((ok, mal) => {
        const p = spawn(h.ffmpeg, ['-hide_banner', '-nostdin', '-i', mp3, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
        const r = []; let max = 0, n = 0, resto = null;
        p.stdout.on('data', (b) => {
          if (resto) { b = Buffer.concat([resto, b]); resto = null; }
          const fin = b.length - (b.length % 2);
          for (let i = 0; i < fin; i += 2) { const v = Math.abs(b.readInt16LE(i)); if (v > max) max = v; if (++n === 800) { r.push(max); max = 0; n = 0; } }
          if (fin < b.length) resto = b.subarray(fin);
        });
        p.on('error', mal);
        p.on('close', () => { if (n) r.push(max); ok(r); });
      });
      const tope = Math.max(1, ...picos.slice().sort((a, b) => a - b).slice(Math.floor(picos.length * 0.99)));
      fs.writeFileSync(onda, JSON.stringify(picos.map((v) => Math.min(100, Math.round((v / tope) * 100)))));
    }
    return { mp3, onda: leerJson(onda, []), paso: 0.1 };
  }

  // ---------------------------------------------------------------- transcripción (una cada vez, en segundo plano)
  function encolar(id) { if (!cola.includes(id) && (!transcribiendo || transcribiendo.id !== id)) cola.push(id); siguiente(); }

  async function siguiente() {
    if (transcribiendo || !cola.length) return;
    if (voces && voces.estado()) { setTimeout(siguiente, 10000); return; }   // primero termina «Identificar voces» (los dos cargan mucho el Mac)
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
      // -ojf: JSON completo, con el instante de cada token (para marcar tramos seleccionando el texto)
      const args = ['-m', h.modelo, '-f', limpio, '-l', 'es', '-ojf', '-of', base, '-pp', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1)))];
      if (f.pista) args.push('--prompt', f.pista);
      await correr(h.whisper, args, (linea) => {
        const m = linea.match(/progress\s*=\s*(\d+)%/);
        if (m && transcribiendo) { transcribiendo.pct = Number(m[1]); alCambiar(true); }
      });
      const j = leerJson(`${base}.json`, { transcription: [] });
      let jb = null; try { jb = JSON.parse(fs.readFileSync(`${base}.json`, 'latin1')); } catch (e) { /* sin tokens: solo frases */ }
      const segmentos = (j.transcription || []).map((s, i) => {
        const seg = { t: Math.round((s.offsets ? s.offsets.from : 0) / 1000), texto: (s.text || '').trim() };
        const ps = jb && jb.transcription && jb.transcription[i] ? palabrasDeTokens(jb.transcription[i].tokens) : [];
        if (ps.length) { seg.palabras = ps; seg.texto = ps.map((p) => p[1]).join(' '); }
        return seg;
      }).filter((s) => s.texto && !ALUCINACIONES.test(s.texto));
      // audio comprimido para guardar (≈20 MB por hora) en lugar del WAV (≈115 MB por hora)
      // (al volver a transcribir, el audio ya es .m4a: no se recomprime ni se borra)
      const m4a = wav.replace(/\.wav$/, '.m4a');
      if (wav !== m4a) {
        await correr(h.ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', limpio, '-c:a', 'aac', '-b:a', '48k', m4a]);
        try { fs.unlinkSync(wav); } catch (e) { /* ya no está */ }
      }
      if (!leer(id)) { try { fs.unlinkSync(m4a); } catch (e) { /* no estaba */ } return; }   // se eliminó mientras se transcribía
      const nueva = { ...leer(id), audio: path.basename(m4a), estado: 'transcrito', modelo: MODELO, segmentos, texto: segmentos.map((s) => s.texto).join(' ') };
      delete nueva.editado;
      guardarFicha(nueva);
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
      identificando,
      voces: !!(voces && voces.instalado()),
      cola: cola.slice(),
    };
  }

  return { herramientas, microfonos: async () => { const h = herramientas(); return h.ffmpeg ? microfonos(h.ffmpeg) : []; },
    empezar, terminar, lista, leer, eliminar, rutaAudio, encolar, cancelar, retomar, estado, infoAdjuntos, juntar, guardarTramos, escucha, guardarSegmentos, bloquear, originales, identificarVoces, nombresVoces };
}

module.exports = { crearCante, herramientas, microfonos, elegirMicro, pista, nivel, ALUCINACIONES, normalizarTramos, calcularTramos, tipoEn, palabrasDeTokens };
