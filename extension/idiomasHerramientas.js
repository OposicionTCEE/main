// Herramientas locales de la pestaña Idiomas (fase 2): LanguageTool (corrector) y Ollama (modelo de lenguaje), instalados con Homebrew
// por scripts/idiomas/instalar_herramientas.sh. Se arrancan solo cuando hacen falta y se paran tras unos minutos sin uso (memoria y batería:
// el Mac tiene 8 GB). Una tarea pesada cada vez: mientras corre el modelo no se arranca LanguageTool y al revés. Reglas: main/IDIOMAS.md
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { tr } = require('./media/i18n-idiomas.js');

const RUTAS_BIN = [process.env.TCEE_BIN, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'].filter(Boolean);
const existe = (f) => { try { fs.accessSync(f); return true; } catch (e) { return false; } };
const bin = (n) => { for (const d of RUTAS_BIN) if (existe(path.join(d, n))) return path.join(d, n); return null; };
const MODELO = process.env.TCEE_MODELO_IDIOMAS || 'qwen2.5:3b';
const PUERTO_LT = Number(process.env.TCEE_PUERTO_LT || 8081);
const URL_OLLAMA = (() => { const h = String(process.env.OLLAMA_HOST || '127.0.0.1:11434').replace(/^https?:\/\//, '').replace(/^0\.0\.0\.0/, '127.0.0.1'); return `http://${/:\d+$/.test(h) ? h : `${h}:11434`}`; })();
const REPOSO_MS = 8 * 60 * 1000;   // se paran tras 8 minutos sin uso
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Petición HTTP local (sin dependencias). cuerpo: objeto (JSON) o cadena (formulario) */
function pedir(url, { metodo = 'GET', cuerpo, tipo, tiempo = 10000 } = {}) {
  return new Promise((ok, mal) => {
    const u = new URL(url);
    const datos = cuerpo === undefined ? null : Buffer.from(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: metodo,
      headers: datos ? { 'Content-Type': tipo || 'application/json', 'Content-Length': datos.length } : {} }, (res) => {
      const trozos = []; res.on('data', (d) => trozos.push(d));
      res.on('end', () => {
        const txt = Buffer.concat(trozos).toString('utf8');
        if (res.statusCode >= 400) return mal(new Error(`HTTP ${res.statusCode}: ${txt.slice(0, 200)}`));
        try { ok(JSON.parse(txt)); } catch (e) { ok(txt); }
      });
    });
    req.on('error', mal);
    req.setTimeout(tiempo, () => { req.destroy(new Error('tiempo agotado')); });
    if (datos) req.write(datos);
    req.end();
  });
}

/** idiomaUI(lengua): lengua del panel ('es' | 'en' | 'fr') para los errores que llegan a la pantalla (por defecto, castellano) */
function crearHerramientas({ avisar = () => {}, idiomaUI = () => 'es' } = {}) {
  const T = (s, args, l) => tr(idiomaUI(l), s, args);
  const procesos = { lt: null, ollama: null };
  const temporizadores = {};
  let ocupado = Promise.resolve();   // cola: una tarea pesada cada vez

  const rutas = () => ({ lt: bin('languagetool-server'), ollama: bin('ollama'), ffmpeg: bin('ffmpeg'), whisper: bin('whisper-cli') || bin('whisper-cpp') });
  async function vivo(nombre) {
    try {
      if (nombre === 'lt') { await pedir(`http://127.0.0.1:${PUERTO_LT}/v2/languages`, { tiempo: 1500 }); return true; }
      await pedir(`${URL_OLLAMA}/api/tags`, { tiempo: 1500 }); return true;
    } catch (e) { return false; }
  }
  async function modeloDescargado() {
    try { const r = await pedir(`${URL_OLLAMA}/api/tags`, { tiempo: 2000 }); return (r.models || []).some((m) => (m.name || '').startsWith(MODELO)); } catch (e) { return null; }
  }

  /** Qué está instalado (para la pantalla): {lt, ollama, modelo, ffmpeg, whisper, falta[]} */
  async function estado() {
    const r = rutas();
    const modeloWhisper = existe(path.join(require('os').homedir(), '.tcee', 'modelos', 'ggml-large-v3-turbo.bin'));
    let modelo = null;
    if (r.ollama) {
      modelo = await modeloDescargado();
      if (modelo === null) modelo = existe(path.join(require('os').homedir(), '.ollama', 'models', 'manifests', 'registry.ollama.ai', 'library', ...MODELO.split(':')));
    }
    const ltActivo = await vivo('lt'), ollamaActivo = await vivo('ollama');
    if (ollamaActivo && !modelo) modelo = await modeloDescargado();
    // un Ollama o un LanguageTool ya en marcha (p. ej. la aplicación de Ollama) cuentan como instalados aunque no estén en Homebrew
    const e = { lt: !!r.lt || ltActivo, ollama: !!r.ollama || ollamaActivo, modelo: !!modelo, nombreModelo: MODELO, ffmpeg: !!r.ffmpeg, whisper: !!r.whisper && modeloWhisper, ltActivo, ollamaActivo };
    e.falta = [!e.lt && 'LanguageTool', !e.ollama && 'Ollama', e.ollama && !e.modelo && T('modelo {0}', [MODELO]), !e.ffmpeg && 'ffmpeg', !e.whisper && 'whisper'].filter(Boolean);
    return e;
  }

  function programarParada(nombre) {
    clearTimeout(temporizadores[nombre]);
    temporizadores[nombre] = setTimeout(() => parar(nombre), REPOSO_MS);
  }
  function parar(nombre) {
    clearTimeout(temporizadores[nombre]);
    const p = procesos[nombre]; procesos[nombre] = null;
    if (p && p.exitCode === null) { try { p.kill('SIGTERM'); } catch (e) { /* ya parado */ } }
  }
  async function arrancar(nombre) {
    if (await vivo(nombre)) { programarParada(nombre); return; }
    const r = rutas();
    // una cosa pesada cada vez: si arranca el modelo, se para LanguageTool, y al revés
    parar(nombre === 'lt' ? 'ollama' : 'lt');
    if (nombre === 'lt') {
      if (!r.lt) throw new Error(T('Falta LanguageTool: pulsa «Instalar herramientas» en Ajustes de Idiomas.'));
      procesos.lt = spawn(r.lt, ['--port', String(PUERTO_LT), '--allow-origin', '*'], { stdio: 'ignore', env: { ...process.env, JAVA_TOOL_OPTIONS: '-Xmx700m' } });
    } else {
      if (!r.ollama) throw new Error(T('Falta Ollama: pulsa «Instalar herramientas» en Ajustes de Idiomas.'));
      procesos.ollama = spawn(r.ollama, ['serve'], { stdio: 'ignore', env: { ...process.env, OLLAMA_KEEP_ALIVE: '4m', OLLAMA_MAX_LOADED_MODELS: '1', OLLAMA_NUM_PARALLEL: '1' } });
    }
    procesos[nombre].on('error', () => { procesos[nombre] = null; });
    for (let i = 0; i < 60; i++) { await dormir(500); if (await vivo(nombre)) { programarParada(nombre); return; } }
    parar(nombre);   // no se deja un proceso a medio arrancar ocupando memoria
    throw new Error(nombre === 'lt' ? T('LanguageTool no arranca (¿falta Java?). Repite «Instalar herramientas».') : T('Ollama no arranca. Repite «Instalar herramientas».'));
  }

  // «tiempo agotado» (de pedir) llega a la pantalla dentro de «Modelo local: …»: se traduce aquí
  const traducirError = (e) => { if (e && e.message === 'tiempo agotado') e.message = T('tiempo agotado'); throw e; };
  const enCola = (fn) => { const r = ocupado.then(fn, fn).catch(traducirError); ocupado = r.catch(() => {}); return r; };

  /** Corrector: errores de LanguageTool [{inicio, largo, mensaje, sugerencias, regla, categoria, tipo}] */
  function corregirTexto(texto, lengua) {
    return enCola(async () => {
      await arrancar('lt');
      const idioma = lengua === 'en' ? 'en-GB' : lengua === 'fr' ? 'fr' : lengua;
      const cuerpo = `language=${encodeURIComponent(idioma)}&text=${encodeURIComponent(texto)}${lengua === 'fr' ? '&level=picky' : ''}`;
      const r = await pedir(`http://127.0.0.1:${PUERTO_LT}/v2/check`, { metodo: 'POST', cuerpo, tipo: 'application/x-www-form-urlencoded', tiempo: 60000 });
      programarParada('lt');
      return (r.matches || []).map((m) => ({ inicio: m.offset, largo: m.length, mensaje: m.message, breve: m.shortMessage || '',
        sugerencias: (m.replacements || []).slice(0, 4).map((x) => x.value), regla: m.rule && m.rule.id, categoria: m.rule && m.rule.category && m.rule.category.name,
        tipo: m.rule && m.rule.issueType, fragmento: texto.substr(m.offset, m.length) }));
    });
  }

  /**
   * Pregunta al modelo local. formato: esquema JSON de la respuesta (Ollama «structured outputs»). Devuelve el objeto ya leído.
   * Si la respuesta no es JSON válido, se reintenta una vez.
   */
  function preguntar({ sistema, mensaje, formato, temperatura = 0.2, contexto = 8192, tiempo = 240000 }) {
    return enCola(async () => {
      await arrancar('ollama');
      if (!(await modeloDescargado())) throw new Error(T('Falta el modelo {0}: pulsa «Instalar herramientas» en Ajustes de Idiomas.', [MODELO]));
      for (let intento = 0; intento < 2; intento++) {
        const r = await pedir(`${URL_OLLAMA}/api/chat`, { metodo: 'POST', tiempo, cuerpo: {
          model: MODELO, stream: false, format: formato || 'json', keep_alive: '4m',
          options: { temperature: temperatura, num_ctx: contexto, repeat_penalty: 1.15, num_predict: 1200 },   // sin bucles de frases repetidas y con tope de longitud
          messages: [...(sistema ? [{ role: 'system', content: sistema }] : []), { role: 'user', content: mensaje }] } });
        programarParada('ollama');
        const txt = (r.message && r.message.content) || '';
        try { return JSON.parse(txt); } catch (e) { if (intento) throw new Error(T('El modelo local no devolvió una respuesta válida. Prueba otra vez.')); }
      }
      return null;
    });
  }

  function cerrarTodo() { parar('lt'); parar('ollama'); }
  return { estado, corregirTexto, preguntar, cerrarTodo, MODELO };
}

module.exports = { crearHerramientas, pedir, MODELO };
