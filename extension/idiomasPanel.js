// Pestaña «Idiomas» del Panel Oposición (lado de la extensión): paquete de contenido (repositorio idiomas, TCEE/idiomas)
// y datos del usuario solo en local (TCEE/idiomas-<nombre>/). Reglas: main/IDIOMAS.md
'use strict';
const fs = require('fs');
const path = require('path');
const I = require('./idiomas');

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const escribir = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1) + '\n'); fs.renameSync(f + '.tmp', f); };
const LENGUAS = { en: 'Inglés', fr: 'Francés' };

function crearIdiomas({ raiz, globalState }) {
  const dirPaquete = () => path.join(raiz(), 'idiomas');
  // ---------------------------------------------------------------- paquete (releído si cambia materias.json)
  const cachePaquete = {};
  function paquete(l) {
    const f = path.join(dirPaquete(), l, 'materias.json');
    let m = 0; try { m = fs.statSync(f).mtimeMs; } catch (e) { return null; }
    const ft = path.join(dirPaquete(), l, 'titulos.json');
    try { m += fs.statSync(ft).mtimeMs; } catch (e) { /* paquete antiguo sin títulos en la lengua */ }
    const c = cachePaquete[l];
    if (c && c.m === m) return c;
    const tl = leer(ft, { titulos: {} }).titulos || {};
    const materias = (leer(f, { materias: [] }).materias || []).map((x) => ({ ...x, ...(tl[x.id] || {}) }));
    let fichas = []; try { fichas = fs.readdirSync(path.join(dirPaquete(), l, 'fichas')).filter((x) => x.endsWith('.json')); } catch (e) { /* aún no hay */ }
    const conFicha = new Set();
    const titulos = {};
    for (const x of fichas) {
      const d = leer(path.join(dirPaquete(), l, 'fichas', x), null);
      if (d && d.id) {
        conFicha.add(d.id);
        const tipos = {}; for (const e of d.ejercicios || []) tipos[e.tipo] = (tipos[e.tipo] || 0) + 1;
        titulos[d.id] = { titulo_es: d.titulo_es, descripcion_es: d.descripcion_es, n: (d.ejercicios || []).length, tipos,
          nEjemplos: (d.ejemplos || []).length, nErrores: (d.errores_hispanohablantes || []).length, fuenteNombre: d.fuente && d.fuente.nombre };
      }
    }
    cachePaquete[l] = { m, materias, conFicha, titulos };
    return cachePaquete[l];
  }
  const ficha = (l, id) => leer(path.join(dirPaquete(), l, 'fichas', `${id.split('.').slice(2).join('.')}.json`), null);

  // ---------------------------------------------------------------- perfiles (TCEE/idiomas-<nombre>/)
  const perfiles = () => {
    try {
      return fs.readdirSync(raiz()).filter((d) => d.startsWith('idiomas-') && fs.existsSync(path.join(raiz(), d, 'perfil.json')))
        .map((d) => ({ dir: d, nombre: (leer(path.join(raiz(), d, 'perfil.json'), {}).nombre || d.slice(8)) }));
    } catch (e) { return []; }
  };
  const dirActivo = () => {
    const ps = perfiles(); if (!ps.length) return null;
    const elegido = globalState.get('tcee.idiomasPerfil');
    return path.join(raiz(), (ps.find((p) => p.dir === elegido) || ps[0]).dir);
  };
  const f = (n) => { const d = dirActivo(); return d ? path.join(d, n) : null; };
  const perfil = () => (f('perfil.json') ? leer(f('perfil.json'), null) : null);
  const registros = () => leer(f('materias.json') || '', {});
  const errores = () => leer(f('errores.json') || '', []);
  const anotaciones = () => leer(f('anotaciones.json') || '', {});
  /** Anotación del usuario sobre una ficha (vacía = se borra) */
  function anotar({ id, texto }) {
    if (!dirActivo()) throw new Error('No hay perfil.');
    const a = anotaciones(); const t = String(texto || '').replace(/\s+$/, '');
    if (t) a[id] = { texto: t, fecha: new Date().toISOString() }; else delete a[id];
    escribir(f('anotaciones.json'), a);
    return a[id] || null;
  }
  function sesiones() {
    const x = f('sesiones.jsonl'); if (!x) return [];
    try { return fs.readFileSync(x, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { return []; }
  }

  function crearPerfil(p) {
    const nombre = String(p.nombre || '').trim();
    if (!nombre) throw new Error('Escribe un nombre para el perfil.');
    const dir = `idiomas-${I.slug(nombre)}`;
    const ruta = path.join(raiz(), dir, 'perfil.json');
    if (fs.existsSync(ruta)) throw new Error(`Ya existe un perfil «${nombre}».`);
    const segundo = p.segundo || 'fr';
    escribir(ruta, {
      nombre, creado: new Date().toISOString(), segundo,
      idiomas: { en: { nivel: p.niveles && p.niveles.en || 'B1' }, [segundo]: { nivel: p.niveles && p.niveles[segundo] || 'B1' } },
      compromisos: p.compromisos || [], medios: [], ajustes: { ejercicios: 10 }, avisos: {},
    });
    globalState.update('tcee.idiomasPerfil', dir);
  }
  function guardarPerfil(cambios) {
    const p = perfil(); if (!p) throw new Error('No hay perfil.');
    const nuevo = { ...p, ...cambios, idiomas: { ...p.idiomas, ...(cambios.idiomas || {}) }, ajustes: { ...p.ajustes, ...(cambios.ajustes || {}) } };
    escribir(f('perfil.json'), nuevo);
  }

  // ---------------------------------------------------------------- vista general
  function datos() {
    const p = perfil();
    const regs = registros();
    const ses = sesiones();
    const paquetes = {};
    for (const l of Object.keys(LENGUAS)) {
      const k = paquete(l); if (!k) continue;
      paquetes[l] = { materias: k.materias.map((m) => ({ ...m, ...(k.titulos[m.id] || {}), ficha: k.conFicha.has(m.id), estado: I.estadoMateria(regs[m.id]) })) };
    }
    const lenguas = p ? ['en', p.segundo] : [];
    const nivel = {};
    for (const l of lenguas) {
      const k = paquete(l); if (!k) continue;
      nivel[l] = { gramatica: I.estimarNivel(k.materias, regs, 'gramatica'), lexico: I.estimarNivel(k.materias, regs, 'lexico') };
    }
    const ahora = new Date();
    const pendientes = {};
    for (const l of lenguas) pendientes[l] = Object.entries(regs).filter(([id, r]) => id.startsWith(`${l}.`) && r.tarjeta && new Date(r.tarjeta.due) <= ahora).length;
    return {
      perfil: p, perfiles: perfiles(), lenguas: LENGUAS, hayPaquete: Object.keys(paquetes).length > 0, paquetes,
      registros: Object.fromEntries(Object.entries(regs).map(([id, r]) => [id, { sesiones: r.sesiones, notas: r.notas, ultima: r.ultima, due: r.tarjeta && r.tarjeta.due }])),
      errores: errores().filter((e) => !e.resuelto).slice(-300),
      sesiones: ses.slice(-60),
      compromisos: p ? I.compromisos(p.compromisos, ses).map((c) => ({ ...c, texto: I.textoRegla(c.regla) })) : [],
      nivel, pendientes, anotaciones: p ? anotaciones() : {},
    };
  }

  // ---------------------------------------------------------------- sesiones
  /** Prepara una sesión: tipo gramatica | lexico | repaso | azar | ficha (una materia concreta) | errores (de una materia) */
  function empezar({ lengua, clase: tipo, materia }) {
    const p = perfil(); if (!p) throw new Error('Crea primero tu perfil.');
    const k = paquete(lengua); if (!k) throw new Error('Falta el paquete de idiomas: ejecuta «Sincronizar».');
    const regs = registros();
    const n = (p.ajustes && p.ajustes.ejercicios) || 10;
    const nivel = (p.idiomas[lengua] || {}).nivel || 'B1';
    const nivelDe = Object.fromEntries(k.materias.map((m) => [m.id, m.nivel]));
    const semilla = Date.now();
    let partes = [];
    const rec = (bloque) => I.recomendar(k.materias, regs, { bloque, nivel, conFicha: k.conFicha, semilla });
    if (tipo === 'ficha' || tipo === 'errores') partes = [{ id: materia, n }];
    else if (tipo === 'gramatica' || tipo === 'lexico') { const m = rec(tipo)[0]; if (m) partes = [{ id: m.id, n }]; }
    else if (tipo === 'repaso') {
      const vencidas = Object.entries(regs).filter(([id, r]) => id.startsWith(`${lengua}.`) && r.tarjeta && new Date(r.tarjeta.due) <= new Date() && k.conFicha.has(id))
        .sort((a, b) => a[1].tarjeta.due.localeCompare(b[1].tarjeta.due)).slice(0, 3).map(([id]) => id);
      if (!vencidas.length) throw new Error('No tienes fichas pendientes de repaso en este idioma.');
      partes = vencidas.map((id) => ({ id, n: Math.max(4, Math.round(n / vencidas.length)) }));
    } else if (tipo === 'azar') {
      const g = rec('gramatica').slice(0, 4), l = rec('lexico').slice(0, 4);
      const elegidas = I.barajar([...g, ...l], semilla).slice(0, 2);
      partes = elegidas.map((m) => ({ id: m.id, n: Math.max(4, Math.round(n / 2)) }));
    }
    if (!partes.length) throw new Error('No hay fichas disponibles para esta sesión todavía.');
    const bloques = partes.map(({ id, n: cuantos }) => {
      const fi = ficha(lengua, id);
      if (!fi) throw new Error(`Falta la ficha ${id}.`);
      // ejercicios adecuados al nivel: si la ficha queda por debajo del tuyo, más de producción; si queda por encima, más de reconocimiento
      const ajuste = I.nivelNum(nivel) - I.nivelNum(fi.nivel || nivelDe[id] || nivel);
      let ejercicios = I.elegirEjercicios(fi, regs[id], cuantos, semilla, ajuste);
      if (tipo === 'errores') {
        const fallados = new Set(errores().filter((e) => e.materia === id && !e.resuelto).map((e) => e.ejercicio));
        ejercicios = [...fi.ejercicios.filter((e) => fallados.has(e.id)), ...ejercicios.filter((e) => !fallados.has(e.id))].slice(0, cuantos);
      }
      // al navegador no se mandan las respuestas: se corrige aquí
      return { ficha: { ...fi, ejercicios: undefined }, ejercicios: ejercicios.map(({ respuestas, explicacion, ...e }) => e) };
    });
    return { id: `s${semilla}`, lengua, tipo, inicio: new Date().toISOString(), bloques };
  }

  function responder({ lengua, materia, ejercicio, respuesta }) {
    const fi = ficha(lengua, materia); if (!fi) throw new Error('Ficha no encontrada.');
    const ej = (fi.ejercicios || []).find((e) => e.id === ejercicio); if (!ej) throw new Error('Ejercicio no encontrado.');
    const r = I.corregir(ej, respuesta);
    return { ...r, respuestas: ej.respuestas, explicacion: ej.explicacion };
  }

  /** Guarda la sesión: por materia, nota, repaso (ts-fsrs) y ejercicios; errores al cuaderno; línea en sesiones.jsonl */
  function terminar({ sesion, resultados, segundos }) {
    if (!dirActivo()) throw new Error('No hay perfil.');
    const regs = registros();
    const errs = errores();
    const ahora = new Date().toISOString();
    const porMateria = {};
    for (const r of resultados) (porMateria[r.materia] = porMateria[r.materia] || []).push(r);
    const resumen = [];
    for (const [id, rs] of Object.entries(porMateria)) {
      const nota = rs.filter((x) => x.ok).length / rs.length;
      const reg = regs[id] || { intentos: 0, aciertos: 0, sesiones: 0, notas: [], ejercicios: {} };
      reg.intentos += rs.length; reg.aciertos += rs.filter((x) => x.ok).length; reg.sesiones += 1; reg.ultima = ahora;
      reg.notas = [...(reg.notas || []), Math.round(nota * 100) / 100].slice(-10);
      reg.tarjeta = I.repasar(reg.tarjeta, nota);
      reg.ejercicios = reg.ejercicios || {};
      for (const x of rs) {
        const e = reg.ejercicios[x.ejercicio] || { fallos: 0 };
        e.ultima = ahora;
        if (x.ok) { if (e.fallos) e.corregido = true; } else { e.fallos += 1; e.corregido = false; }
        reg.ejercicios[x.ejercicio] = e;
        const previo = errs.find((q) => q.materia === id && q.ejercicio === x.ejercicio && !q.resuelto);
        if (!x.ok) {
          if (previo) { previo.veces += 1; previo.respuesta = x.respuesta; previo.fecha = ahora; }
          else errs.push({ lengua: sesion.lengua, materia: id, ejercicio: x.ejercicio, frase: x.frase, enunciado: x.enunciado, respuesta: x.respuesta, correcta: x.correcta, fecha: ahora, veces: 1 });
        } else if (previo) { previo.resuelto = ahora; }
      }
      regs[id] = reg;
      resumen.push({ materia: id, nota, proximo: reg.tarjeta.due });
    }
    escribir(f('materias.json'), regs);
    escribir(f('errores.json'), errs.slice(-2000));
    const linea = { id: sesion.id, fecha: sesion.inicio, lengua: sesion.lengua, tipo: sesion.tipo, minutos: Math.round((segundos || 0) / 6) / 10,
      materias: resumen.map((r) => r.materia), ejercicios: resultados.length, aciertos: resultados.filter((x) => x.ok).length };
    fs.appendFileSync(f('sesiones.jsonl'), JSON.stringify(linea) + '\n');
    return { resumen, linea };
  }

  function descartarError({ materia, ejercicio }) {
    const errs = errores();
    for (const e of errs) if (e.materia === materia && e.ejercicio === ejercicio && !e.resuelto) e.resuelto = new Date().toISOString();
    escribir(f('errores.json'), errs);
  }

  /** Ruta de la carpeta de un perfil (para borrarla desde la extensión, que la manda a la Papelera) */
  function rutaPerfil(dir) {
    const p = perfiles().find((x) => x.dir === dir);
    if (!p) throw new Error('Ese perfil no existe.');
    return { ruta: path.join(raiz(), p.dir), nombre: p.nombre };
  }
  const olvidarPerfil = (dir) => (globalState.get('tcee.idiomasPerfil') === dir ? globalState.update('tcee.idiomasPerfil', undefined) : undefined);

  return { datos, crearPerfil, anotar, rutaPerfil, olvidarPerfil, guardarPerfil, empezar, responder, terminar, descartarError, ficha, elegirPerfil: (dir) => globalState.update('tcee.idiomasPerfil', dir), dirActivo };
}

module.exports = { crearIdiomas };
