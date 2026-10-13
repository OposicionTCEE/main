// «Identificar voces»: quién habla en cada momento de un audio (cantes y clases). Sin conexión: sherpa-onnx en ~/.tcee/voces-id,
// lanzado con main/scripts/diarizar.py. Reglas: main/CANTE.md, apartado 8 (y IDIOMAS.md, «Clases con profesores»).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const BASE = path.join(os.homedir(), '.tcee');
const PYTHON = path.join(BASE, 'voces-id', 'bin', 'python');
const SEG = path.join(BASE, 'modelos', 'voces', 'segmentacion.onnx');
const EMB = path.join(BASE, 'modelos', 'voces', 'voz.onnx');
const existe = (f) => { try { fs.accessSync(f); return true; } catch (e) { return false; } };

/** ¿Está instalado? (programa y modelos) */
const instalado = () => existe(PYTHON) && existe(SEG) && existe(EMB);

/** Hablante del instante t según los tramos [[ini, fin, h], …] ordenados; en un hueco, el del tramo más cercano */
function hablanteEn(tramos, t) {
  if (!tramos || !tramos.length) return null;
  let mejor = null, dist = Infinity;
  for (const [a, b, h] of tramos) {
    if (t >= a && t < b) return h;
    const d = t < a ? a - t : t - b;
    if (d < dist) { dist = d; mejor = h; }
    if (a > t + dist) break;
  }
  return mejor;
}

function crearVoces({ raiz }) {
  let ocupado = null, proc = null;   // una identificación cada vez (el Mac trabaja a tope unos minutos)

  /**
   * Identifica las voces de un audio. n: número de voces (0 = automático). alPct(p) informa del avance.
   * Devuelve [[ini, fin, hablante], …] (s). ffmpeg pasa antes el audio a mono 16 kHz.
   */
  async function identificar({ ffmpeg, audio, n, alPct = () => {}, quien }) {
    if (!instalado()) throw new Error('Falta instalar «Identificar voces»: pulsa «Instalar herramientas de cante» (o «Instalar herramientas» en Ajustes de Idiomas).');
    if (ocupado) throw new Error('Ya se están identificando las voces de otro audio. Espera a que termine.');
    ocupado = { quien, pct: 0 };
    const wav = path.join(os.tmpdir(), `tcee-voces-${Date.now()}.wav`);
    try {
      await correr(ffmpeg, ['-hide_banner', '-nostdin', '-y', '-i', audio, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
      const script = path.join(raiz(), 'main', 'scripts', 'diarizar.py');
      const hilos = String(Math.max(2, Math.min(8, os.cpus().length - 1)));
      let tramos = null, error = null;
      await correr(PYTHON, [script, '--wav', wav, '--seg', SEG, '--emb', EMB, '--n', String(Number(n) || 0), '--hilos', hilos], (l) => {
        let j; try { j = JSON.parse(l); } catch (e) { return; }
        if (j.pct != null) { ocupado.pct = j.pct; alPct(j.pct); }
        if (j.tramos) tramos = j.tramos;
        if (j.error) error = j.error;
      });
      if (error) throw new Error(error);
      if (!tramos) throw new Error('El programa no devolvió resultado.');
      return tramos;
    } finally {
      try { fs.unlinkSync(wav); } catch (e) { /* no se creó */ }
      ocupado = null; proc = null;
    }
  }

  function correr(prog, args, alLinea) {
    return new Promise((ok, mal) => {
      const p = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc = p;
      let resto = '', err = '';
      p.stdout.on('data', (d) => { resto += d.toString(); const ls = resto.split('\n'); resto = ls.pop(); if (alLinea) ls.forEach(alLinea); });
      p.stderr.on('data', (d) => { err = (err + d.toString()).slice(-600); });
      p.on('error', mal);
      p.on('close', (c) => { if (resto && alLinea) alLinea(resto); return c === 0 ? ok() : mal(new Error(`${path.basename(prog)} terminó con error (${c}): ${err.trim().split('\n').slice(-2).join(' ').slice(0, 300)}`)); });
    });
  }

  return { identificar, instalado, estado: () => ocupado && { ...ocupado }, cancelar: () => { if (proc) { try { proc.kill('SIGTERM'); } catch (e) { /* ya terminó */ } } } };
}

module.exports = { crearVoces, hablanteEn, instalado };
