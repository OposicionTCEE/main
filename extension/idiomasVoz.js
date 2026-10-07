// Voces neuronales para la pestaña Idiomas (Piper, libre y sin conexión): instaladas por scripts/idiomas/instalar_herramientas.sh en
// ~/.tcee/piper (programa) y ~/.tcee/voces (tres voces por idioma). La extensión mantiene vivo un servidor (scripts/idiomas/voz.py) mientras
// se usa y lo para a los 5 minutos sin uso. El audio de cada frase se guarda en ~/.tcee/voz-cache (se borra lo de más de 3 días).
// Si Piper no está, la pantalla usa la voz del sistema. Reglas: main/IDIOMAS.md, «Voces».
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const BASE = path.join(os.homedir(), '.tcee');
const DIR_VOCES = path.join(BASE, 'voces');
const CACHE = path.join(BASE, 'voz-cache');
const PYTHON = path.join(BASE, 'piper', 'bin', 'python');
const REPOSO_MS = 5 * 60 * 1000;
// nombres para la pantalla de las voces que instala el instalador (las demás se muestran con su nombre de fichero)
const NOMBRES = {
  'en_GB-cori-high': 'Cori (mujer, inglés británico)', 'en_GB-alan-medium': 'Alan (hombre, inglés británico)', 'en_GB-vctk-medium': 'Varias voces británicas (al azar)',
  'fr_FR-siwis-medium': 'Siwis (mujer, francés)', 'fr_FR-tom-medium': 'Tom (hombre, francés)', 'fr_FR-mls-medium': 'Varias voces francesas (al azar)',
};

function crearVoz({ guion, alListo = () => {} }) {
  let proc = null, resto = '', temporizador = null;
  const pendientes = new Map();   // id → {dir}

  function voces() {
    let fs_ = []; try { fs_ = fs.readdirSync(DIR_VOCES).filter((f) => f.endsWith('.onnx') && fs.existsSync(path.join(DIR_VOCES, `${f}.json`))); } catch (e) { return []; }
    return fs_.map((f) => {
      const id = f.replace(/\.onnx$/, '');
      let conf = {}; try { conf = JSON.parse(fs.readFileSync(path.join(DIR_VOCES, `${f}.json`), 'utf8')); } catch (e) { /* sin config */ }
      const lengua = ((conf.language && conf.language.family) || id.slice(0, 2)).toLowerCase();
      return { id, lengua, nombre: NOMBRES[id] || id, hablantes: conf.num_speakers || 1 };
    });
  }
  const disponible = () => fs.existsSync(PYTHON) && voces().length > 0;

  function limpiarCache() {
    try {
      const limite = Date.now() - 3 * 24 * 3600 * 1000;
      for (const d of fs.readdirSync(CACHE)) {
        const r = path.join(CACHE, d);
        try { if (fs.statSync(r).mtimeMs < limite) fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* */ }
      }
    } catch (e) { /* aún no hay caché */ }
  }
  limpiarCache();

  function arrancar() {
    if (proc && proc.exitCode === null) return proc;
    proc = spawn(PYTHON, [guion()], { stdio: ['pipe', 'pipe', 'ignore'] });
    resto = '';
    proc.stdout.on('data', (d) => {
      resto += d.toString(); const ls = resto.split('\n'); resto = ls.pop();
      for (const l of ls) {
        let m; try { m = JSON.parse(l); } catch (e) { continue; }
        if (!m.id || !pendientes.has(m.id)) continue;
        const p = pendientes.get(m.id);
        if (m.i !== undefined) alListo({ clave: m.id, i: m.i, fichero: path.join(p.dir, `${m.i}.wav`) });
        if (m.fin || m.error) { pendientes.delete(m.id); if (m.error) alListo({ clave: m.id, error: m.error }); }
      }
    });
    proc.on('exit', () => { proc = null; for (const [id] of pendientes) alListo({ clave: id, error: 'El programa de voz se ha cerrado.' }); pendientes.clear(); });
    proc.on('error', () => { proc = null; });
    return proc;
  }
  function programarParada() { clearTimeout(temporizador); temporizador = setTimeout(parar, REPOSO_MS); }
  function parar() { clearTimeout(temporizador); if (proc) { try { proc.kill(); } catch (e) { /* */ } proc = null; } }

  /**
   * Elige voz (la pedida o una al azar del idioma; en las de varios hablantes, un hablante al azar) y lanza la síntesis de las frases.
   * Devuelve {clave, voz, hablante, nombre}; cada frase lista llega por alListo({clave, i, fichero}).
   */
  function preparar({ lengua, frases, voz, hablante, velocidad }) {
    const vs = voces().filter((v) => v.lengua === lengua);
    if (!fs.existsSync(PYTHON) || !vs.length) throw new Error('Las voces neuronales no están instaladas: pulsa «Instalar herramientas» en Ajustes de Idiomas.');
    let v = vs.find((x) => x.id === voz);
    if (!v) v = vs[Math.floor(Math.random() * vs.length)];
    let h = v.hablantes > 1 ? (Number.isInteger(hablante) && voz === v.id ? hablante : Math.floor(Math.random() * v.hablantes)) : null;
    const vel = Math.round((Number(velocidad) || 1) * 100) / 100;
    const xs = (frases || []).map((f) => String(f).trim()).filter(Boolean);
    const clave = crypto.createHash('sha1').update(JSON.stringify([v.id, h, vel, xs])).digest('hex').slice(0, 20);
    const dir = path.join(CACHE, clave);
    fs.mkdirSync(dir, { recursive: true });
    try { fs.utimesSync(dir, new Date(), new Date()); } catch (e) { /* */ }
    pendientes.set(clave, { dir });
    arrancar().stdin.write(`${JSON.stringify({ id: clave, modelo: path.join(DIR_VOCES, `${v.id}.onnx`), hablante: h, velocidad: vel, frases: xs, dir })}\n`);
    programarParada();
    return { clave, voz: v.id, hablante: h, nombre: v.nombre + (h !== null ? ` · hablante ${h + 1}` : ''), n: xs.length };
  }

  return { voces, disponible, preparar, parar, carpetaCache: CACHE };
}

module.exports = { crearVoz };
