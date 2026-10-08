// Pestaña «Idiomas» del Panel Oposición (lado de la extensión): paquete de contenido (repositorio idiomas, TCEE/idiomas)
// y datos del usuario solo en local (TCEE/idiomas-<nombre>/). Reglas: main/IDIOMAS.md
'use strict';
const fs = require('fs');
const path = require('path');
const I = require('./idiomas');
const { tr } = require('./media/i18n-idiomas.js');

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const escribir = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1) + '\n'); fs.renameSync(f + '.tmp', f); };
const LENGUAS = { en: 'Inglés', fr: 'Francés' };   // en castellano: la pantalla los traduce al pintarlos (ui('Inglés'))

/**
 * Ruta de un fichero del paquete de idiomas: con la interfaz en la lengua estudiada (enLengua), la copia traducida de <l>/lengua/<rel>
 * si existe (mismos ids y estructura; las explicaciones, en la lengua estudiada); si no, la original <l>/<rel>.
 */
function rutaPaquete(dir, l, rel, enLengua) {
  if (enLengua) { const t = path.join(dir, l, 'lengua', rel); if (fs.existsSync(t)) return t; }
  return path.join(dir, l, rel);
}
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };

function crearIdiomas({ raiz, globalState }) {
  const dirPaquete = () => path.join(raiz(), 'idiomas');
  // ---------------------------------------------------------------- lengua de la interfaz (main/IDIOMAS.md, «Panel en la lengua estudiada»)
  // Castellano si el perfil lo pide en Ajustes; si no, la lengua de la petición (o la última vista: hay mensajes que no la llevan)
  let ultimaLengua = 'en';
  const valida = (l) => l === 'en' || l === 'fr';
  /** Sin efectos: 'es' | 'en' | 'fr' para esa lengua (o la última vista) */
  function uiDe(lengua) {
    let p = null; try { p = perfil(); } catch (e) { p = null; }
    if (p && p.ajustes && p.ajustes.idiomaFichas === 'es') return 'es';
    return valida(lengua) ? lengua : ultimaLengua;
  }
  /** Como uiDe, pero recuerda la lengua de la petición (para los mensajes que no la traen). Lo llama panelOposicion.js con cada mensaje */
  function idiomaUI(lengua) { if (valida(lengua)) ultimaLengua = lengua; return uiDe(lengua); }
  /** Texto para la pantalla en la lengua del panel: t('Falta la ficha {0}.', [id], lengua) */
  const t = (s, args, lengua) => tr(uiDe(lengua), s, args);
  /** Fichero del paquete en la lengua del panel (copia de <l>/lengua/ si la interfaz no está en castellano y existe) */
  const ruta = (l, rel) => rutaPaquete(dirPaquete(), l, rel, uiDe(l) !== 'es');
  // ---------------------------------------------------------------- paquete (releído si cambia materias.json, las fichas o el modo de lengua)
  const cachePaquete = {};
  function paquete(l) {
    const enLengua = uiDe(l) !== 'es';
    const f = ruta(l, 'materias.json');
    let m = 0; try { m = fs.statSync(f).mtimeMs; } catch (e) { return null; }
    const ft = ruta(l, 'titulos.json');
    m += mtime(ft) + mtime(path.join(dirPaquete(), l, 'fichas')) + (enLengua ? mtime(path.join(dirPaquete(), l, 'lengua', 'fichas')) : 0);
    const clave = `${l}|${enLengua ? 'lengua' : 'es'}`;
    const c = cachePaquete[clave];
    if (c && c.m === m && c.f === f) return c;
    const tl = leer(ft, { titulos: {} }).titulos || {};
    const materias = (leer(f, { materias: [] }).materias || []).map((x) => ({ ...x, ...(tl[x.id] || {}) }));
    let fichas = []; try { fichas = fs.readdirSync(path.join(dirPaquete(), l, 'fichas')).filter((x) => x.endsWith('.json')); } catch (e) { /* aún no hay */ }
    const conFicha = new Set();
    const titulos = {};
    for (const x of fichas) {
      const d = leer(ruta(l, path.join('fichas', x)), null);
      if (d && d.id) {
        conFicha.add(d.id);
        const tipos = {}; for (const e of d.ejercicios || []) tipos[e.tipo] = (tipos[e.tipo] || 0) + 1;
        titulos[d.id] = { titulo_es: d.titulo_es, descripcion_es: d.descripcion_es, descripcion_larga_es: d.descripcion_larga_es, n: (d.ejercicios || []).length, tipos,
          nEjemplos: (d.ejemplos || []).length, nErrores: (d.errores_hispanohablantes || []).length, fuenteNombre: d.fuente && d.fuente.nombre };
      }
    }
    cachePaquete[clave] = { m, f, materias, conFicha, titulos };
    return cachePaquete[clave];
  }
  const ficha = (l, id) => leer(ruta(l, path.join('fichas', `${id.split('.').slice(2).join('.')}.json`)), null);
  /** Tras cambiar «Idioma del panel» en Ajustes: se vacían las cachés que dependen de la lengua (también se distinguen por modo) */
  const vaciarCaches = () => { for (const k of Object.keys(cachePaquete)) delete cachePaquete[k]; };

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
  /**
   * Anotaciones del usuario sobre una ficha: {texto (nota general), marcas: [{id, k (bloque), inicio, cita, color, nota}]}.
   * Las marcas son subrayados sobre el texto de la ficha; si llevan nota, se ven como un recuadro debajo del bloque. Vacía = se borra.
   */
  function anotar({ id, anotacion, texto }) {
    if (!dirActivo()) throw new Error(t('No hay perfil.'));
    const a = anotaciones();
    const x = anotacion || { ...(a[id] || {}), texto };
    const limpio = { texto: String(x.texto || '').replace(/\s+$/, ''), marcas: (x.marcas || []).filter((m) => m && m.k && (m.cita || m.nota)) };
    if (limpio.texto || limpio.marcas.length) a[id] = { ...limpio, fecha: new Date().toISOString() }; else delete a[id];
    escribir(f('anotaciones.json'), a);
    return a[id] || null;
  }
  function sesiones() {
    const x = f('sesiones.jsonl'); if (!x) return [];
    try { return fs.readFileSync(x, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { return []; }
  }

  function crearPerfil(p) {
    const nombre = String(p.nombre || '').trim();
    if (!nombre) throw new Error(t('Escribe un nombre para el perfil.'));
    const dir = `idiomas-${I.slug(nombre)}`;
    const ruta = path.join(raiz(), dir, 'perfil.json');
    if (fs.existsSync(ruta)) throw new Error(t('Ya existe un perfil «{0}».', [nombre]));
    const segundo = p.segundo || 'fr';
    escribir(ruta, {
      nombre, creado: new Date().toISOString(), segundo,
      idiomas: { en: { nivel: p.niveles && p.niveles.en || 'B1' }, [segundo]: { nivel: p.niveles && p.niveles[segundo] || 'B1' } },
      compromisos: p.compromisos || [], medios: [], ajustes: { ejercicios: 10 }, avisos: {},
    });
    globalState.update('tcee.idiomasPerfil', dir);
  }
  function guardarPerfil(cambios) {
    const p = perfil(); if (!p) throw new Error(t('No hay perfil.'));
    const nuevo = { ...p, ...cambios, idiomas: { ...p.idiomas, ...(cambios.idiomas || {}) }, ajustes: { ...p.ajustes, ...(cambios.ajustes || {}) } };
    escribir(f('perfil.json'), nuevo);
    if ((p.ajustes || {}).idiomaFichas !== nuevo.ajustes.idiomaFichas) vaciarCaches();
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
      registros: Object.fromEntries(Object.entries(regs).map(([id, r]) => [id, { sesiones: r.sesiones, notas: r.notas, ultima: r.ultima, due: r.tarjeta && r.tarjeta.due,
        vistos: Object.keys(r.ejercicios || {}).length, bien: Object.values(r.ejercicios || {}).filter((e) => !e.fallos || e.corregido).length }])),
      errores: errores().filter((e) => !e.resuelto).slice(-300),
      sesiones: ses.slice(-60),
      // texto en la lengua del panel de la última pestaña vista; textos: el de cada lengua del panel, por si la pantalla cambia de pestaña sin recargar
      compromisos: p ? I.compromisos(p.compromisos, ses).map((c) => ({ ...c, texto: I.textoRegla(c.regla, uiDe()),
        textos: Object.fromEntries(['es', ...lenguas].map((x) => [x, I.textoRegla(c.regla, x === 'es' ? 'es' : uiDe(x))])) })) : [],
      nivel, pendientes, anotaciones: p ? anotaciones() : {},
      revision: p ? revision().map((x) => `${x.materia}|${x.ejercicio}`) : [], miDiccionario: p ? miDiccionario() : [],
      hayDiccionario: Object.fromEntries(Object.keys(LENGUAS).map((l) => [l, fs.existsSync(path.join(dirPaquete(), l, 'diccionario.json'))])),
    };
  }

  // ---------------------------------------------------------------- sesiones
  /** Prepara una sesión: tipo gramatica | lexico | repaso | azar | ficha (una materia concreta) | errores (de una materia) */
  function empezar({ lengua, clase: tipo, materia }) {
    const p = perfil(); if (!p) throw new Error(t('Crea primero tu perfil.', [], lengua));
    const k = paquete(lengua); if (!k) throw new Error(t('Falta el paquete de idiomas: ejecuta «Sincronizar».', [], lengua));
    const regs = registros();
    const n = (p.ajustes && p.ajustes.ejercicios) || 10;
    const nivel = (p.idiomas[lengua] || {}).nivel || 'B1';
    const nivelDe = Object.fromEntries(k.materias.map((m) => [m.id, m.nivel]));
    const semilla = Date.now();
    let partes = [];
    const rec = (bloque) => I.recomendar(k.materias, regs, { bloque, nivel, conFicha: k.conFicha, semilla });
    if (tipo === 'errores' && !materia) {
      // repaso de todo el cuaderno: las fichas con más errores pendientes, solo los ejercicios fallados, hasta n
      const porFicha = {};
      for (const e of errores()) if (!e.resuelto && e.lengua === lengua && k.conFicha.has(e.materia)) (porFicha[e.materia] = porFicha[e.materia] || new Set()).add(e.ejercicio);
      let quedan = Math.max(n, 12);
      partes = Object.entries(porFicha).sort((a, b) => b[1].size - a[1].size).map(([id, xs]) => {
        const c = Math.min(xs.size, quedan); quedan -= c; return { id, n: c, solo: xs };
      }).filter((x) => x.n > 0);
      if (!partes.length) throw new Error(t('No tienes errores pendientes en este idioma.', [], lengua));
    } else if (tipo === 'ficha' || tipo === 'errores') partes = [{ id: materia, n }];
    else if (tipo === 'gramatica' || tipo === 'lexico') { const m = rec(tipo)[0]; if (m) partes = [{ id: m.id, n }]; }
    else if (tipo === 'repaso') {
      const vencidas = Object.entries(regs).filter(([id, r]) => id.startsWith(`${lengua}.`) && r.tarjeta && new Date(r.tarjeta.due) <= new Date() && k.conFicha.has(id))
        .sort((a, b) => a[1].tarjeta.due.localeCompare(b[1].tarjeta.due)).slice(0, 3).map(([id]) => id);
      if (!vencidas.length) throw new Error(t('No tienes fichas pendientes de repaso en este idioma.', [], lengua));
      partes = vencidas.map((id) => ({ id, n: Math.max(4, Math.round(n / vencidas.length)) }));
    } else if (tipo === 'azar') {
      const g = rec('gramatica').slice(0, 4), l = rec('lexico').slice(0, 4);
      const elegidas = I.barajar([...g, ...l], semilla).slice(0, 2);
      partes = elegidas.map((m) => ({ id: m.id, n: Math.max(4, Math.round(n / 2)) }));
    }
    if (!partes.length) throw new Error(t('No hay fichas disponibles para esta sesión todavía.', [], lengua));
    const bloques = partes.map(({ id, n: cuantos, solo }) => {
      const fi = ficha(lengua, id);
      if (!fi) throw new Error(t('Falta la ficha {0}.', [id], lengua));
      // ejercicios adecuados al nivel: si la ficha queda por debajo del tuyo, más de producción; si queda por encima, más de reconocimiento
      const ajuste = I.nivelNum(nivel) - I.nivelNum(fi.nivel || nivelDe[id] || nivel);
      let ejercicios = I.elegirEjercicios(fi, regs[id], cuantos, semilla, ajuste);
      if (solo) ejercicios = I.barajar(fi.ejercicios.filter((e) => solo.has(e.id)), semilla).slice(0, cuantos);
      else if (tipo === 'errores') {
        const fallados = new Set(errores().filter((e) => e.materia === id && !e.resuelto).map((e) => e.ejercicio));
        ejercicios = [...fi.ejercicios.filter((e) => fallados.has(e.id)), ...ejercicios.filter((e) => !fallados.has(e.id))].slice(0, cuantos);
      }
      // al navegador no se mandan las respuestas: se corrige aquí
      return { ficha: { ...fi, ejercicios: undefined }, ejercicios: ejercicios.map(({ id: eid, tipo: t, enunciado, frase, opciones, palabras }) => ({ id: eid, tipo: t, enunciado, frase, opciones, palabras })) };
    });
    return { id: `s${semilla}`, lengua, tipo, inicio: new Date().toISOString(), bloques };
  }

  function responder({ lengua, materia, ejercicio, respuesta }) {
    const fi = ficha(lengua, materia); if (!fi) throw new Error(t('Ficha no encontrada.', [], lengua));
    const ej = (fi.ejercicios || []).find((e) => e.id === ejercicio); if (!ej) throw new Error(t('Ejercicio no encontrado.', [], lengua));
    const r = I.corregir(ej, respuesta);
    // tras responder ya se puede enseñar todo: explicación ampliada, la de su respuesta concreta, las de cada opción, traducción y glosario
    return { ...r, respuestas: ej.respuestas, explicacion: ej.explicacion, breve: ej.explicacion_breve || '', traduccion: ej.traduccion || '',
      suya: r.ok ? ((ej.por_opcion || {})[Object.keys(ej.por_opcion || {}).find((o) => I.normalizar(o) === I.normalizar(respuesta))] || null) : I.explicarRespuesta(ej, respuesta),
      porOpcion: ej.por_opcion || null, glosario: ej.glosario || [], frase: ej.frase || '' };
  }

  /** Guarda la sesión: por materia, nota, repaso (ts-fsrs) y ejercicios; errores al cuaderno; línea en sesiones.jsonl */
  function terminar({ sesion, resultados, segundos }) {
    if (!dirActivo()) throw new Error(t('No hay perfil.'));
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

  // ---------------------------------------------------------------- preguntas marcadas para revisar (revision.json del perfil)
  const revision = () => leer(f('revision.json') || '', []);
  function marcarRevision({ lengua, materia, ejercicio, marcado, respuesta, correcta, frase }) {
    if (!dirActivo()) throw new Error(t('No hay perfil.'));
    const xs = revision().filter((x) => !(x.materia === materia && x.ejercicio === ejercicio));
    if (marcado) xs.push({ lengua, materia, ejercicio, frase, respuesta, correcta, fecha: new Date().toISOString() });
    escribir(f('revision.json'), xs);
    return xs.map((x) => `${x.materia}|${x.ejercicio}`);
  }

  // ---------------------------------------------------------------- diccionario personal (diccionario.json del perfil)
  const miDiccionario = () => leer(f('diccionario.json') || '', []);
  function guardarEntrada(e) {
    if (!dirActivo()) throw new Error(t('No hay perfil.'));
    const xs = miDiccionario();
    const texto = String(e.texto || '').trim(); if (!texto) throw new Error(t('Falta la palabra.', [], e.lengua));
    const limpia = { id: e.id || `d${Date.now().toString(36)}`, lengua: e.lengua, texto, definicion: String(e.definicion || '').trim(),
      tipo: e.tipo === 'estructura' ? 'estructura' : 'palabra', campo: String(e.campo || 'General').trim() || 'General',
      ficha: e.ficha || null, contexto: String(e.contexto || '').slice(0, 300), fecha: e.fecha || new Date().toISOString() };
    if (String(e.definicion_es || '').trim()) limpia.definicion_es = String(e.definicion_es).trim();
    const i = xs.findIndex((x) => x.id === limpia.id);
    if (i >= 0) xs[i] = limpia; else xs.push(limpia);
    escribir(f('diccionario.json'), xs);
    return xs;
  }
  function borrarEntrada({ id }) { const xs = miDiccionario().filter((x) => x.id !== id); escribir(f('diccionario.json'), xs); return xs; }

  // ---------------------------------------------------------------- diccionario bilingüe del paquete (<l>/diccionario.json, de Wiktionary)
  // entradas: [palabra, categoría, pronunciación, [traducciones al español], [definiciones en español]]
  const cacheDicc = {};
  const plano = (x) => String(x || '').replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").trim();
  const raizEs = (w) => (w.length > 5 && /es$/.test(w) && !/[aeiou]es$/.test(w) ? w.slice(0, -2) : w.length > 4 && /s$/.test(w) ? w.slice(0, -1) : w);
  const VACIAS = new Set('de la el los las un una unos unas y o a en con por para que se su sus del al lo es como mas muy sin sobre'.split(' '));
  function dicc(l) {
    const fp = path.join(dirPaquete(), l, 'diccionario.json');
    let m = 0; try { m = fs.statSync(fp).mtimeMs; } catch (e) { return null; }
    if (cacheDicc[l] && cacheDicc[l].m === m) return cacheDicc[l];
    const d = leer(fp, { entradas: [] });
    const ent = d.entradas || [];
    const porPalabra = new Map(), inverso = new Map(), porTrad = new Map();
    ent.forEach((x, i) => {
      const k = plano(x[0]); if (!porPalabra.has(k)) porPalabra.set(k, []); porPalabra.get(k).push(i);
      for (const t of x[3] || []) for (const parte of String(t).split(/[,;]\s*/)) {   // «Ordenador, computadora» → dos claves
        const kt = plano(parte.replace(/\(.*?\)/g, '')); if (!kt) continue;
        if (!porTrad.has(kt)) porTrad.set(kt, []); if (!porTrad.get(kt).includes(i)) porTrad.get(kt).push(i);
      }
      // índice inverso: palabra española → [entrada, peso] (2 si está en una traducción, 1 si solo en una definición)
      const pesos = new Map();
      for (const [txt, p] of [[(x[3] || []).join(' '), 2], [(x[4] || []).join(' '), 1]]) {
        for (const w of txt.split(/[^\p{L}']+/u).map(plano).filter((w) => w.length > 2 && !VACIAS.has(w)).map(raizEs)) pesos.set(w, Math.max(pesos.get(w) || 0, p));
      }
      for (const [w, p] of pesos) { if (!inverso.has(w)) inverso.set(w, []); inverso.get(w).push([i, p]); }
    });
    cacheDicc[l] = { m, ent, porPalabra, claves: [...porPalabra.keys()].sort(), inverso, porTrad, clavesTrad: [...porTrad.keys()].sort(), fuente: d.fuente || '' };
    return cacheDicc[l];
  }
  const entrada = (x) => ({ palabra: x[0], cat: x[1] || '', ipa: x[2] || '', trad: x[3] || [], glosas: x[4] || [] });
  /** Búsqueda: «directa» (palabra o expresión en la lengua estudiada → castellano) o «inversa» (describe en castellano lo que buscas) */
  function buscar({ lengua, q, modo }) {
    const D = dicc(lengua); if (!D) return { resultados: [], falta: true };
    const t = plano(q); if (!t) return { resultados: [] };
    let ids = [];
    const prefijo = (claves, mapa, lim) => {
      const xs = []; let lo = 0, hi = claves.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (claves[mid] < t) lo = mid + 1; else hi = mid; }
      for (let j = lo; j < claves.length && claves[j].startsWith(t) && xs.length < lim; j++) if (claves[j] !== t) xs.push(...mapa.get(claves[j]));
      return xs;
    };
    if (modo === 'espanol') {
      // castellano → lengua estudiada: traducción exacta, luego traducciones que empiezan igual, luego las que contienen la palabra
      const exactas = D.porTrad.get(t) || [];
      const pref = prefijo(D.clavesTrad, D.porTrad, 40);
      const cont = (D.inverso.get(raizEs(t)) || []).filter(([, p]) => p === 2).map(([i]) => i);
      const vistos = new Set(); ids = [];
      for (const i of [...exactas.sort((a, b) => D.ent[a][0].length - D.ent[b][0].length), ...pref, ...cont]) if (!vistos.has(i)) { vistos.add(i); ids.push(i); }
    } else if (modo === 'inverso') {
      const toks = [...new Set(t.split(/[^\p{L}']+/u).filter((w) => w.length > 2 && !VACIAS.has(w)).map(raizEs))];
      const puntos = new Map();
      for (const w of toks) for (const [i, p] of D.inverso.get(w) || []) puntos.set(i, (puntos.get(i) || 0) + p);
      ids = [...puntos.entries()].sort((a, b) => {
        const ea = D.ent[a[0]], eb = D.ent[b[0]];
        const exa = (ea[3] || []).some((x) => plano(x) === t) ? 1 : 0, exb = (eb[3] || []).some((x) => plano(x) === t) ? 1 : 0;
        return b[1] - a[1] || exb - exa || ea[0].length - eb[0].length;
      }).slice(0, 40).map(([i]) => i);
    } else {
      ids = [...(D.porPalabra.get(t) || [])];
      // prefijo, en orden alfabético (búsqueda binaria en las claves ordenadas)
      let lo = 0, hi = D.claves.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (D.claves[mid] < t) lo = mid + 1; else hi = mid; }
      for (let j = lo; j < D.claves.length && D.claves[j].startsWith(t) && ids.length < 40; j++) if (D.claves[j] !== t) ids.push(...D.porPalabra.get(D.claves[j]));
    }
    const enL = uiDe(lengua) !== 'es';
    return { resultados: ids.slice(0, 40).map((i) => { const x = entrada(D.ent[i]); if (enL) x.definicion_l = definicionL(lengua, x.palabra); return x; }), fuente: D.fuente };
  }
  /** Definición breve para el diccionario personal: traducciones de la entrada exacta (o, si no hay, su primera definición) */
  /** Definición de una palabra o expresión: la forma tal cual y, si no está, su forma base (wielded → wield, levied → levy, chevaux → cheval…) */
  // definiciones en la lengua estudiada (<l>/definiciones.json: Open English WordNet / Wiktionnaire), para el panel en esa lengua
  const cacheDefs = {};
  function defsL(l) {
    const fp = path.join(dirPaquete(), l, 'definiciones.json');
    let m = 0; try { m = fs.statSync(fp).mtimeMs; } catch (e) { return null; }
    if (cacheDefs[l] && cacheDefs[l].m === m) return cacheDefs[l].d;
    const d = leer(fp, { definiciones: {} }).definiciones || {};
    cacheDefs[l] = { m, d }; return d;
  }
  /** Primera definición en la lengua estudiada de una palabra (o de su forma base), o '' */
  function definicionL(l, palabra) {
    const D = defsL(l); if (!D) return '';
    const w = plano(palabra).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const crudo = String(palabra || '').toLowerCase().trim();
    for (const k of [crudo, w, ...formasBase(l, w)]) if (D[k] && D[k].length) return D[k][0][1];
    return '';
  }
  function definirConLema({ lengua, texto }) {
    const D = dicc(lengua); if (!D) return { definicion: '', lema: null };
    const limpio = plano(texto).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');   // sin comillas ni puntuación pegada a la selección
    // con el panel en la lengua estudiada: definición en esa lengua (y el castellano aparte, en gris)
    const conL = (r) => (uiDe(lengua) !== 'es' ? { ...r, definicion_l: definicionL(lengua, r.lema || texto) } : r);
    for (const k of [limpio, ...formasBase(lengua, limpio)]) {
      const xs = (D.porPalabra.get(k) || []).map((i) => entrada(D.ent[i]));
      const trad = [...new Set(xs.flatMap((x) => x.trad))].slice(0, 5);
      const def = trad.length ? trad.join(', ') : (xs[0] && xs[0].glosas[0]) || '';
      if (def) return conL({ definicion: def, lema: k === limpio ? null : (xs[0] && xs[0].palabra) || k });
    }
    return conL({ definicion: '', lema: null });
  }
  const definir = (m) => definirConLema(m).definicion;
  // irregulares frecuentes del inglés (el diccionario trae algunos, como «went», pero no todos)
  const IRREG_EN = { children: 'child', men: 'man', women: 'woman', people: 'person', feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose', data: 'datum', criteria: 'criterion', phenomena: 'phenomenon',
    was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', had: 'have', has: 'have', did: 'do', done: 'do', does: 'do', made: 'make', said: 'say', took: 'take', taken: 'take', gave: 'give', given: 'give',
    came: 'come', became: 'become', got: 'get', gotten: 'get', saw: 'see', seen: 'see', knew: 'know', known: 'know', thought: 'think', brought: 'bring', bought: 'buy', sought: 'seek', caught: 'catch', taught: 'teach',
    fought: 'fight', held: 'hold', kept: 'keep', left: 'leave', lost: 'lose', meant: 'mean', met: 'meet', paid: 'pay', sold: 'sell', sent: 'send', spent: 'spend', told: 'tell', found: 'find', felt: 'feel', led: 'lead',
    rose: 'rise', risen: 'rise', fell: 'fall', fallen: 'fall', grew: 'grow', grown: 'grow', drew: 'draw', drawn: 'draw', drove: 'drive', driven: 'drive', wrote: 'write', written: 'write', began: 'begin', begun: 'begin',
    ran: 'run', shown: 'show', struck: 'strike', stood: 'stand', understood: 'understand', won: 'win', wore: 'wear', worn: 'wear', chose: 'choose', chosen: 'choose', spoke: 'speak', spoken: 'speak', broke: 'break',
    broken: 'break', froze: 'freeze', frozen: 'freeze', hid: 'hide', hidden: 'hide', laid: 'lay', lain: 'lie', lay: 'lie', dealt: 'deal', built: 'build', lent: 'lend', bent: 'bend', shot: 'shoot', shut: 'shut',
    set: 'set', cut: 'cut', put: 'put', hit: 'hit', let: 'let', cost: 'cost', spread: 'spread', bore: 'bear', borne: 'bear', tore: 'tear', torn: 'tear', swore: 'swear', sworn: 'swear', withdrew: 'withdraw',
    withdrawn: 'withdraw', undertook: 'undertake', undertaken: 'undertake', overcame: 'overcome', forgave: 'forgive', forgiven: 'forgive', forgot: 'forget', forgotten: 'forget', better: 'good', best: 'good', worse: 'bad', worst: 'bad' };
  /** Formas base candidatas (de más a menos probable). Solo reglas de flexión: no inventa palabras, se comprueban contra el diccionario. */
  function formasBase(l, w) {
    const c = [], add = (x) => { if (x && x !== w && x.length > 1 && !c.includes(x)) c.push(x); };
    const cons = /[bcdfghjklmnpqrstvwxz]/;
    if (l === 'en') {
      add(IRREG_EN[w]);
      if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
      if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
      if (/ves$/.test(w)) { add(w.slice(0, -3) + 'f'); add(w.slice(0, -3) + 'fe'); }
      if (/(s|x|z|ch|sh|o)es$/.test(w)) add(w.slice(0, -2));
      if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
      for (const suf of ['ed', 'ing', 'er', 'est']) {
        if (!w.endsWith(suf) || w.length <= suf.length + 2) continue;
        const r = w.slice(0, -suf.length);
        add(r); add(`${r}e`);
        if (r.length > 2 && r[r.length - 1] === r[r.length - 2] && cons.test(r[r.length - 1])) add(r.slice(0, -1));   // stopped → stop
        if (/i$/.test(r)) add(`${r.slice(0, -1)}y`);   // happier → happy
      }
      if (/ly$/.test(w)) { add(w.slice(0, -2)); if (/ily$/.test(w)) add(`${w.slice(0, -3)}y`); }
    } else if (l === 'fr') {
      const vb = verbos(); const inf = vb && formasVerbo(vb).get(w); if (inf) add(inf);
      if (/aux$/.test(w)) { add(w.slice(0, -3) + 'al'); add(w.slice(0, -3) + 'ail'); }
      if (/eaux$/.test(w)) add(w.slice(0, -1));
      if (/[sx]$/.test(w)) add(w.slice(0, -1));
      for (const [suf, por] of [['ées', 'er'], ['és', 'er'], ['ée', 'er'], ['é', 'er'], ['ies', 'ir'], ['is', 'ir'], ['ie', 'ir'], ['euses', 'eux'], ['euse', 'eux'], ['ives', 'if'], ['ive', 'if'],
        ['elles', 'el'], ['elle', 'el'], ['ennes', 'en'], ['enne', 'en'], ['es', ''], ['e', '']]) if (w.endsWith(suf)) add(w.slice(0, -suf.length) + por);
    }
    return c;
  }
  /** Francés: forma conjugada → infinitivo, a partir de las conjugaciones de Verbiste (se calcula una vez) */
  let cacheFormas = null;
  function formasVerbo(d) {
    if (cacheFormas && cacheFormas.d === d) return cacheFormas.m;
    const m = new Map();
    for (const v of d.verbos) {
      const p = I.paradigma(d, v[0]); if (!p) continue;
      const poner = (f) => { for (const x of String(f || '').split(/\s*[/,]\s*/)) { const k = plano(x.split(' ').pop()); if (k && !m.has(k)) m.set(k, v[0]); } };
      for (const t of Object.values(p.tiempos)) for (const fila of t) for (const f of fila.formas || []) poner(f);
      poner(p.participios.presente); p.participios.pasado.forEach(poner);
    }
    cacheFormas = { d, m }; return m;
  }

  // ---------------------------------------------------------------- entrenador de verbos (francés; idiomas/fr/verbos.json, Verbiste)
  let cacheVerbos = null;
  function verbos() {
    const fp = path.join(dirPaquete(), 'fr', 'verbos.json');
    let m = 0; try { m = fs.statSync(fp).mtimeMs; } catch (e) { return null; }
    if (cacheVerbos && cacheVerbos.m === m) return cacheVerbos.d;
    const d = I.prepararVerbos(leer(fp, { verbos: [], plantillas: {} }));
    d.porFrecuencia = [...d.verbos].sort((a, b) => b[4] - a[4]);
    cacheVerbos = { m, d }; return d;
  }
  const statsVerbos = () => leer(f('verbos.json') || '', {});
  const fichasConjugacion = () => ['grupo1', 'grupo2', 'grupo3', 'irregulares', 'compuestos']
    .map((n) => leer(ruta('fr', path.join('conjugacion', `${n}.json`)), null)).filter(Boolean);
  const traduccion = (v) => definir({ lengua: 'fr', texto: v }).split(', ').slice(0, 3).join(', ');
  function verbosInicio() {
    const d = verbos(); if (!d) return { falta: true };
    const st = statsVerbos();
    const debiles = Object.entries(st).filter(([, x]) => x.i >= 2 && x.a / x.i < 0.8).sort((a, b) => a[1].a / a[1].i - b[1].a / b[1].i).slice(0, 8)
      .map(([k, x]) => { const [verbo, tiempo] = k.split('|'); return { verbo, tiempo, pct: Math.round((100 * x.a) / x.i), i: x.i }; });
    const practicadas = Object.values(st).reduce((a, x) => a + x.i, 0);
    const fichas = fichasConjugacion();
    const paradigmas = {};
    for (const fc of fichas) for (const m of fc.modelos || []) if (!paradigmas[m.verbo]) { const p = I.paradigma(d, m.verbo); if (p) paradigmas[m.verbo] = { ...p, trad: traduccion(m.verbo) }; }
    return { tiempos: I.TIEMPOS_FR, fichas, paradigmas, total: d.verbos.length, debiles, practicadas,
      grupos: [1, 2, 3].map((g) => d.verbos.filter((v) => v[3] === g).length) };
  }
  function verbosBuscar({ q }) {
    const d = verbos(); if (!d) return [];
    const t = plano(q); if (!t) return [];
    return d.porFrecuencia.filter((v) => plano(v[0]).startsWith(t)).slice(0, 15).map((v) => ({ verbo: v[0], grupo: v[3], trad: traduccion(v[0]) }));
  }
  /** Sesión del entrenador: modo «tabla» (verbo + tiempo, todas las personas) o «mezcla» (una forma por pregunta) */
  function verbosSesion({ grupos, tiempos, elegidos, aleatorios, frecuentes, modo, n, debiles }) {
    const d = verbos(); if (!d) throw new Error(t('Falta la base de verbos en el paquete de idiomas: ejecuta «Sincronizar».', [], 'fr'));
    const ts = (tiempos || []).filter((t) => I.TIEMPOS_FR.some((x) => x[0] === t));
    if (!ts.length) throw new Error(t('Elige al menos un tiempo.', [], 'fr'));
    let pares = [];
    if (debiles) {
      const st = statsVerbos();
      pares = Object.entries(st).filter(([k, x]) => x.i && x.a / x.i < 0.8 && ts.includes(k.split('|')[1])).sort((a, b) => a[1].a / a[1].i - b[1].a / b[1].i)
        .slice(0, 12).map(([k]) => k.split('|'));
      if (!pares.length) throw new Error(t('Aún no hay verbos flojos en esos tiempos: practica primero unas cuantas sesiones.', [], 'fr'));
    } else {
      let vs = (elegidos || []).filter((v) => d.porVerbo.has(v));
      const gs = (grupos && grupos.length ? grupos : [1, 2, 3]).map(Number);
      if (!vs.length || aleatorios) {
        let pool = d.porFrecuencia.filter((v) => gs.includes(v[3]));
        if (frecuentes) pool = pool.slice(0, gs.length === 3 ? 300 : 120);
        vs = vs.concat(I.barajar(pool.map((v) => v[0])).filter((v) => !vs.includes(v)).slice(0, aleatorios || 3));
      }
      for (const v of vs) for (const t of ts) pares.push([v, t]);
    }
    const trads = {};
    const tr = (v) => (trads[v] = trads[v] !== undefined ? trads[v] : traduccion(v));
    const nombre = (t) => { const x = I.TIEMPOS_FR.find((y) => y[0] === t); return x ? `${x[1]} · ${x[2]}` : t; };
    if (modo === 'mezcla') {
      const todas = [];
      for (const [v, t] of pares) for (const fila of I.conjugar(d, v, t) || []) todas.push({ verbo: v, grupo: d.porVerbo.get(v)[3], tiempo: t, nombreTiempo: nombre(t), trad: tr(v), ...fila });
      const items = I.barajar(todas).slice(0, Math.max(5, Number(n) || 15));
      if (!items.length) throw new Error(t('No hay formas para esa combinación.', [], 'fr'));
      return { modo, items, inicio: new Date().toISOString() };
    }
    const items = pares.map(([v, t]) => ({ verbo: v, grupo: d.porVerbo.get(v)[3], tiempo: t, nombreTiempo: nombre(t), trad: tr(v), filas: I.conjugar(d, v, t) || [] })).filter((x) => x.filas.length);
    if (!items.length) throw new Error(t('No hay formas para esa combinación.', [], 'fr'));
    return { modo: 'tabla', items, inicio: new Date().toISOString() };
  }
  function verbosTerminar({ resultados, segundos, inicio }) {
    if (!dirActivo()) throw new Error(t('No hay perfil.'));
    const st = statsVerbos(); const ahora = new Date().toISOString();
    for (const r of resultados || []) {
      const k = `${r.verbo}|${r.tiempo}`; const x = st[k] || { i: 0, a: 0, fallos: {} };
      x.i += 1; if (r.ok) x.a += 1; else x.fallos[r.persona] = (x.fallos[r.persona] || 0) + 1; x.u = ahora; st[k] = x;
    }
    escribir(f('verbos.json'), st);
    const ok = (resultados || []).filter((x) => x.ok).length;
    fs.appendFileSync(f('sesiones.jsonl'), JSON.stringify({ id: `v${Date.now()}`, fecha: inicio || ahora, lengua: 'fr', tipo: 'verbos', minutos: Math.round((segundos || 0) / 6) / 10,
      materias: [], ejercicios: (resultados || []).length, aciertos: ok }) + '\n');
    return verbosInicio();
  }

  /** Para la Libreta: las fichas que tienen anotaciones */
  function fichasAnotadas() {
    const conj = fichasConjugacion();
    return Object.keys(anotaciones()).map((id) => { const l = id.split('.')[0]; const fi = id.startsWith('fr.v.') ? conj.find((x) => x.id === id) : ficha(l, id); return fi ? { ...fi, ejercicios: undefined } : null; }).filter(Boolean);
  }

  /** Ruta de la carpeta de un perfil (para borrarla desde la extensión, que la manda a la Papelera) */
  function rutaPerfil(dir) {
    const p = perfiles().find((x) => x.dir === dir);
    if (!p) throw new Error(t('Ese perfil no existe.'));
    return { ruta: path.join(raiz(), p.dir), nombre: p.nombre };
  }
  const olvidarPerfil = (dir) => (globalState.get('tcee.idiomasPerfil') === dir ? globalState.update('tcee.idiomasPerfil', undefined) : undefined);

  return { idiomaUI, uiDe, t, rutaPaquete: (l, rel) => ruta(l, rel), vaciarCaches, datos, perfil, verbosInicio, verbosBuscar, verbosSesion, verbosTerminar, crearPerfil, anotar, marcarRevision, guardarEntrada, borrarEntrada, buscar, definir, definirConLema, fichasAnotadas, rutaPerfil, olvidarPerfil, guardarPerfil, empezar, responder, terminar, descartarError, ficha, elegirPerfil: (dir) => globalState.update('tcee.idiomasPerfil', dir), dirActivo };
}

module.exports = { crearIdiomas, rutaPaquete };
