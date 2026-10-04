// Pestaña «Relaciones» del Panel Oposición: modelos compartidos entre temas, fragmentos para comparar y recomendaciones de armonización.
// Reglas: main/RELACIONES.md
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('./desarrollos');

const PRIO = { alta: 3, media: 2, baja: 1 };

function crearRelaciones({ raiz, desarrollos }) {
  let arm = null, armMtime = 0;
  const memo = new Map(); // código|familia|huella del tema → resumen automático

  /** Informes de armonización escritos por Claude (analisis/armonizacion.json), releídos si cambian */
  function informes() {
    const f = path.join(raiz(), 'main', 'analisis', 'armonizacion.json');
    try { const m = fs.statSync(f).mtimeMs; if (!arm || m !== armMtime) { arm = JSON.parse(fs.readFileSync(f, 'utf8')); armMtime = m; } } catch (e) { arm = { modelos: {} }; }
    return arm.modelos || {};
  }

  /** Modelos que comparten al menos dos temas: {familia: [códigos]} */
  function compartidos(dev) {
    const r = {};
    for (const [f, cods] of Object.entries(dev.por_familia || {})) { const u = [...new Set(cods)].sort(); if (u.length >= 2) r[f] = u; }
    return r;
  }

  /** Resumen automático del desarrollo de un modelo en un tema (con memoria mientras el tema no cambie) */
  function auto(codigo, familia, cache, dev) {
    const t = cache[codigo];
    if (!t) return null;
    const clave = `${codigo}|${familia}|${t.texto.length}|${D.huella(t.texto.slice(0, 2000) + t.texto.slice(-2000))}`;
    if (memo.has(clave)) return memo.get(clave);
    const eps = ((dev.por_tema || {})[codigo] || []).filter((x) => x.familia === familia).flatMap((x) => (x.epigrafes || '').split(' | ')).filter(Boolean);
    const nodos = D.localizar(t.texto, familia, eps);
    const r = { nodos, ...D.resumenAuto(t.texto, nodos) };
    memo.set(clave, r);
    return r;
  }

  /** Estado del informe de un tema: 'al día', 'cambiado' (el desarrollo cambió desde el informe) o 'sin informe' */
  function estado(inf, codigo, a) {
    const t = inf && inf.temas && inf.temas[codigo];
    if (!t) return 'sin informe';
    if (!a || !t.huella) return 'al día';
    return a.huella === t.huella ? 'al día' : 'cambiado';
  }

  /** Datos de la pestaña (ligeros): modelos del tema abierto y recomendaciones ordenadas */
  function vista(cache, abierto, dev) {
    const comp = compartidos(dev), inf = informes();
    const recomendaciones = Object.entries(comp).map(([familia, temas]) => {
      const i = inf[familia];
      const as = temas.map((c) => auto(c, familia, cache, dev));
      const div = D.divergencia(as);
      const errores = i ? (i.divergencias || []).filter((d) => d.error && d.verificacion === 'confirmado').length : 0;
      const cambiados = temas.filter((c, k) => estado(i, c, as[k]) === 'cambiado');
      const prioridad = i ? i.prioridad : 'sin informe';
      // orden: prioridad del informe, errores confirmados, divergencia automática; un tema cambiado sube un poco
      const puntos = 10 * (PRIO[prioridad] || 2) + 3 * errores + 5 * div.total + (cambiados.length ? 2 : 0);
      return { familia, temas, prioridad, motivo: i ? i.motivo_prioridad : 'Aún no hay informe de Claude para este modelo.', errores,
        divergencia: div.total, cambiados, puntos };
    }).sort((a, b) => b.puntos - a.puntos);
    const delAbierto = abierto ? recomendaciones.filter((r) => r.temas.includes(abierto)) : [];
    return { abierto, modelosAbierto: delAbierto.map(({ familia, temas, prioridad, errores, cambiados }) => ({ familia, temas, prioridad, errores, cambiados })), recomendaciones };
  }

  /** Detalle de un modelo: informe de Claude + por tema su resumen (Claude), su estado y lo extraído automáticamente */
  function detalle(familia, cache, dev, nombres) {
    const comp = compartidos(dev), inf = informes()[familia] || null;
    const temas = (comp[familia] || []).map((c) => {
      const a = auto(c, familia, cache, dev);
      const t = (inf && inf.temas && inf.temas[c]) || null;
      return {
        codigo: c, titulo: nombres[c] || c, estado: estado(inf, c, a), resumen: t,
        epigrafes: a ? a.nodos.map((n) => ({ numero: n.numero, titulo: n.titulo, linea: n.linea })) : [],
        ecuaciones: a ? a.partes.flatMap((p) => p.ecuaciones).slice(0, 8) : [],
      };
    });
    return {
      familia,
      informe: inf && { prioridad: inf.prioridad, motivo: inf.motivo_prioridad, enfoque: inf.enfoque_comun, divergencias: inf.divergencias || [],
        propuesta: inf.propuesta, referencia: inf.referencia },
      temas,
    };
  }

  return { vista, detalle };
}

module.exports = { crearRelaciones };
