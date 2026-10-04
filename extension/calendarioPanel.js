// Calendario de vueltas dentro del Panel Oposición: guardar/cargar calendarios, crear nuevos y aplicar los ajustes del día a día.
// Reglas: main/CALENDARIO.md · Lógica pura: calendario.js y afinidad.js
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./calendario');
const AF = require('./afinidad');

const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function crearCalendarios({ ctx, progreso, raiz, desarrollos }) {
  const carpeta = () => (progreso.hayCarpeta() ? path.join(progreso.dir, 'calendarios') : null);
  const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

  function todos() {
    const r = { ...(ctx.globalState.get('tcee.calendarios', {})) };
    const d = carpeta();
    if (d) {
      try { for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) { const c = leerJson(path.join(d, f)); if (c && c.id) r[c.id] = c; } } catch (e) { /* sin calendarios */ }
    }
    return r;
  }
  function guardar(cal) {
    const enVs = ctx.globalState.get('tcee.calendarios', {});
    const d = carpeta();
    if (d) {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, `${cal.id}.json`), JSON.stringify(cal, null, 1) + '\n');
      delete enVs[cal.id];
    } else enVs[cal.id] = cal;
    ctx.globalState.update('tcee.calendarios', enVs);
  }
  function borrar(id) {
    const enVs = ctx.globalState.get('tcee.calendarios', {}); delete enVs[id]; ctx.globalState.update('tcee.calendarios', enVs);
    const d = carpeta(); if (d) { try { fs.unlinkSync(path.join(d, `${id}.json`)); } catch (e) { /* ya no estaba */ } }
    if (ctx.globalState.get('tcee.calActivo') === id) ctx.globalState.update('tcee.calActivo', null);
  }
  function activo() {
    const t = todos(); const id = ctx.globalState.get('tcee.calActivo');
    if (id && t[id]) return t[id];
    const lista = Object.values(t).sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
    return lista[0] || null;
  }

  function programa(ejercicio) {
    return leerJson(path.join(raiz(), 'main', 'config', `programa_${ejercicio}.json`));
  }

  /** Afinidad del ejercicio con el temario actual (cacheTemas: {código: {texto}}) */
  function afinidad(ejercicio, cacheTemas, conReferencia) {
    const prog = programa(ejercicio);
    if (!prog) return null;
    const temas = prog.temas.map((t) => ({ ...t, texto: cacheTemas[t.codigo] ? cacheTemas[t.codigo].texto : null }));
    const refs = conReferencia ? Object.values(todos()).filter((c) => c.referencia && c.ejercicio === ejercicio)
      .map((c) => c.referenciaSemanas || c.semanas.map((s) => s.temas)) : [];
    return { af: AF.calcular(temas, desarrollos(), refs), prog };
  }

  function generar(op, cacheTemas) {
    const { af, prog } = afinidad(op.ejercicio, cacheTemas, op.referencia) || {};
    if (!prog) throw new Error(`Falta el programa del ${op.ejercicio}º ejercicio (main/config/programa_${op.ejercicio}.json).`);
    const titulos = Object.fromEntries(prog.temas.map((t) => [t.codigo, t.titulo || t.corto]));
    return C.crear(prog.temas.map((t) => t.codigo), op, af, titulos);
  }

  /** Datos para pintar el calendario activo: días con su tipo y los temas que tocan */
  function vista(cacheTemas, minutos) {
    const t = todos();
    const cal = activo();
    const lista = Object.values(t).map((c) => ({ id: c.id, nombre: c.nombre, referencia: !!c.referencia, ejercicio: c.ejercicio }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const base = { lista, hoy: hoyIso(), nombresDia: NOMBRES_DIA };
    if (!cal) return { ...base, cal: null };
    const prog = programa(cal.ejercicio) || { temas: [] };
    const titulos = Object.fromEntries(prog.temas.map((x) => [x.codigo, x.titulo || x.corto]));
    const pesos = {};
    prog.temas.forEach((x) => { if (cacheTemas[x.codigo]) pesos[x.codigo] = minutos[x.codigo] || 0; });
    const dias = {};
    const semanas = cal.semanas.map((s, w) => {
      const inicio = C.inicioSemana(cal, w);
      const rep = C.repartir(cal, w, pesos);
      for (let d = inicio; d <= s.cante; d = C.masDias(d, 1)) {
        let tipo = 'estudio';
        if (d === s.cante) tipo = 'cante';
        else if ((cal.librados || {})[d]) tipo = 'librado';
        else if (!(d in rep.dias)) tipo = 'libre';
        dias[d] = { tipo, semana: w, temas: rep.dias[d] || [], estudioExtra: !!(cal.estudio || {})[d] };
      }
      const cantados = s.temas.filter((c) => (cal.cantados || {})[c]).length;
      return { n: w + 1, cante: s.cante, inicio, temas: s.temas, orden: s.orden && s.orden.length === s.temas.length ? s.orden : s.temas,
        bloque: s.bloque, cantados, sinDias: rep.sinDias, sobrecarga: s.temas.length > cal.opciones.temasSemana };
    });
    return { ...base, activo: cal.id, titulos, cal: { id: cal.id, nombre: cal.nombre, ejercicio: cal.ejercicio, referencia: !!cal.referencia,
      opciones: cal.opciones, diaLibre: cal.diaLibre, cantados: cal.cantados || {}, semanas }, dias,
      sinCarpeta: prog.temas.filter((x) => !cacheTemas[x.codigo]).map((x) => x.codigo) };
  }

  /** Aplica un mensaje de la página. Devuelve {ok, aviso?, previa?} */
  function mensaje(m, cacheTemas, minutos) {
    if (m.tipo === 'calActivar') { ctx.globalState.update('tcee.calActivo', m.id); return { ok: true }; }
    if (m.tipo === 'calPrevia') {
      const cal = generar(m.opciones, cacheTemas);
      const prog = programa(m.opciones.ejercicio);
      const titulos = Object.fromEntries(prog.temas.map((x) => [x.codigo, x.titulo || x.corto]));
      return { ok: true, previa: { semanas: cal.semanas.map((s) => ({ cante: s.cante, bloque: s.bloque, temas: s.temas })), titulos } };
    }
    if (m.tipo === 'calCrear') {
      const cal = generar(m.opciones, cacheTemas);
      guardar(cal); ctx.globalState.update('tcee.calActivo', cal.id);
      return { ok: true };
    }
    if (m.tipo === 'calBorrar') { borrar(m.id); return { ok: true }; }

    const cal = activo();
    if (!cal) return { ok: false, aviso: 'No hay ningún calendario.' };
    cal.librados = cal.librados || {}; cal.estudio = cal.estudio || {}; cal.cantados = cal.cantados || {};
    const pesos = {};
    Object.keys(cacheTemas).forEach((c) => { pesos[c] = minutos[c] || 0; });
    let r = { ok: true };
    switch (m.tipo) {
      case 'calLibrar': r = C.librar(cal, m.dia, m.accion, pesos); break;
      case 'calEstudiar': C.estudiar(cal, m.dia); break;
      case 'calCante': r = C.moverCante(cal, m.semana, m.dia); break;
      case 'calCantado': if (m.valor) cal.cantados[m.codigo] = hoyIso(); else delete cal.cantados[m.codigo]; break;
      case 'calOrden': C.reordenar(cal, m.semana, m.codigo, m.dir); break;
      case 'calPasar': C.pasarSiguiente(cal, m.semana, m.codigo, m.modo); break;
      default: return { ok: false };
    }
    if (r.ok === false) return { ok: false, aviso: r.motivo };
    guardar(cal);
    if (m.tipo === 'calLibrar' && r.movidos && r.movidos.length) r.aviso = `Pasan a la semana siguiente: ${r.movidos.join(', ')}.`;
    return r;
  }

  return { vista, mensaje };
}

module.exports = { crearCalendarios };
