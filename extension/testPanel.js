// Pestaña «Test» del Panel Oposición: banco de preguntas (repositorio test) e historial de respuestas (repositorio privado progreso).
// Reglas: main/TEST.md
'use strict';
const fs = require('fs');
const path = require('path');

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };

function crearTest({ raiz, progreso }) {
  let banco = null, bancoMtime = 0;
  const fBanco = () => path.join(raiz(), 'test', 'preguntas.json');
  const dirHist = () => (progreso.hayCarpeta() ? path.join(progreso.dir, 'test') : null);
  const fMio = () => { const d = dirHist(); return d ? path.join(d, `${progreso.equipo}.json`) : null; };

  /** Banco de preguntas, releído si cambia el fichero. null si aún no se ha descargado el repositorio test */
  function leerBanco() {
    try {
      const m = fs.statSync(fBanco()).mtimeMs;
      if (!banco || m !== bancoMtime) { banco = JSON.parse(fs.readFileSync(fBanco(), 'utf8')); bancoMtime = m; }
      return banco;
    } catch (e) { return null; }
  }

  /** Sesiones de todos los Mac (cada Mac escribe solo su fichero, para no chocar al sincronizar) */
  function historial() {
    const d = dirHist(); if (!d) return [];
    let fs_ = []; try { fs_ = fs.readdirSync(d).filter((f) => f.endsWith('.json')); } catch (e) { /* aún no hay */ }
    return fs_.flatMap((f) => (leer(path.join(d, f), { sesiones: [] }).sesiones || [])).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  }

  function guardar(sesion) {
    const f = fMio();
    if (!f) throw new Error('Falta la carpeta «progreso»: la sesión no se ha guardado.');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const mio = leer(f, { sesiones: [] });
    mio.sesiones = (mio.sesiones || []).filter((s) => s.id !== sesion.id);
    mio.sesiones.push(sesion);
    fs.writeFileSync(f, JSON.stringify(mio, null, 1) + '\n');
  }

  function borrar(id) {
    const f = fMio(); if (!f) return;
    const mio = leer(f, { sesiones: [] });
    mio.sesiones = (mio.sesiones || []).filter((s) => s.id !== id);
    fs.writeFileSync(f, JSON.stringify(mio, null, 1) + '\n');
  }

  /** Informes de cobertura (main/analisis/cobertura.json): ¿está cada pregunta en su tema? */
  const cobertura = () => (leer(path.join(raiz(), 'main', 'analisis', 'cobertura.json'), { preguntas: {} }).preguntas || {});

  return { leerBanco, historial, guardar, borrar, cobertura, carpeta: () => path.join(raiz(), 'test') };
}

module.exports = { crearTest };
