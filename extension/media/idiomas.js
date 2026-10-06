// Panel Oposición, pestaña «Idiomas»: academia continua de inglés y segundo idioma (A1→C2).
// Pantalla: barra superior (idioma, perfil, compromisos) · izquierda 1/3 (empezar sesión, cuaderno de errores) · derecha 2/3 (fichas como tarjetas,
// por bloque y nivel). Ficha: secciones fijas (de qué trata, reglas, ejemplos, errores típicos, material, mis anotaciones).
// Práctica: ficha plegable a la izquierda y ejercicios a la derecha. Reglas: main/IDIOMAS.md
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const DESC_NIVEL = {
    A1: 'Frases muy básicas: presentarte, pedir algo sencillo.', A2: 'Situaciones cotidianas: compras, viajes, trabajo sencillo.',
    B1: 'Te desenvuelves: cuentas experiencias y das opiniones sencillas.', B2: 'Sigues debates y artículos; argumentas con cierta soltura.',
    C1: 'Textos largos y complejos; te expresas con fluidez y precisión.', C2: 'Lo entiendes prácticamente todo; matizas como un nativo.',
  };
  const BLOQUES = ['gramatica', 'lexico', 'fonetica', 'destrezas'];
  // Rótulos de las tarjetas en cada lengua (el usuario elige en Ajustes: la lengua estudiada o castellano)
  const T = {
    es: { gramatica: 'Gramática', lexico: 'Léxico', fonetica: 'Fonética', destrezas: 'Destrezas', todas: 'Todas las materias',
      nueva: 'Nueva', aprendiendo: 'Aprendiendo', dominada: 'Dominada', repasar: 'Para repasar', prep: 'Ficha en preparación',
      ejercicios: 'ejercicios', sesiones: (n) => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`, nota: 'Última nota', repaso: 'Repaso',
      fichas: (n) => `${n} ${n === 1 ? 'ficha' : 'fichas'}`, dominadas: (n) => `${n} dominada${n === 1 ? '' : 's'}`, conNota: 'Con anotaciones',
      vacio: 'No hay materias de este bloque en este nivel.', oficial: 'Rótulo oficial', sinEmpezar: 'Sin empezar', loc: 'es-ES' },
    fr: { gramatica: 'Grammaire', lexico: 'Lexique', fonetica: 'Phonétique', destrezas: 'Compétences', todas: 'Toutes les matières',
      nueva: 'Nouvelle', aprendiendo: 'En cours', dominada: 'Maîtrisée', repasar: 'À réviser', prep: 'Fiche en préparation',
      ejercicios: 'exercices', sesiones: (n) => `${n} séance${n === 1 ? '' : 's'}`, nota: 'Dernière note', repaso: 'Révision',
      fichas: (n) => `${n} fiche${n === 1 ? '' : 's'}`, dominadas: (n) => `${n} maîtrisée${n === 1 ? '' : 's'}`, conNota: 'Avec des notes',
      vacio: 'Aucune matière de ce bloc à ce niveau.', oficial: 'Intitulé officiel', sinEmpezar: 'Pas encore commencée', loc: 'fr-FR' },
    en: { gramatica: 'Grammar', lexico: 'Vocabulary', fonetica: 'Pronunciation', destrezas: 'Skills', todas: 'All topics',
      nueva: 'New', aprendiendo: 'Learning', dominada: 'Mastered', repasar: 'Due for review', prep: 'Coming soon',
      ejercicios: 'exercises', sesiones: (n) => `${n} session${n === 1 ? '' : 's'}`, nota: 'Last score', repaso: 'Review',
      fichas: (n) => `${n} card${n === 1 ? '' : 's'}`, dominadas: (n) => `${n} mastered`, conNota: 'With notes',
      vacio: 'No topics in this block at this level.', oficial: 'Official label', sinEmpezar: 'Not started', loc: 'en-GB' },
  };
  // Seis destrezas y competencias (Marco Común Europeo) + sesiones especiales
  const DESTREZAS = [
    ['gramatica', '🧩', 'Gramática', 'Competencia gramatical'],
    ['lexico', '🔤', 'Léxico', 'Vocabulario y expresiones'],
    ['lectura', '📖', 'Comprensión lectora', 'Fase 2', true],
    ['escucha', '🎧', 'Comprensión auditiva', 'Fase 2', true],
    ['escrito', '✍️', 'Expresión escrita', 'Fase 2', true],
    ['oral', '🗣️', 'Expresión oral', 'Fase 3', true],
  ];
  const ESPECIALES = [
    ['repaso', '⟳', 'Repaso', 'Fichas con el repaso vencido'],
    ['azar', '🎲', 'Al azar', 'Según tus puntos débiles'],
    ['examen', '🎓', 'Examen', 'Fase 3', true],
  ];
  const NOMBRE_SESION = { gramatica: 'Gramática', lexico: 'Léxico', repaso: 'Repaso', azar: 'Al azar', ficha: 'Ficha', errores: 'Errores', examen: 'Examen' };
  const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const VOZ = { fr: 'fr-FR', en: 'en-GB' };

  let X = null;            // datos de la extensión
  let raiz = null, ctx = null, pedido = false;
  let vista = 'inicio';    // inicio | ajustes | ficha | sesion | fin | nuevo
  let fichaAbierta = null, S = null, fin = null, tic = null, desdeVista = 'inicio';
  const st = () => ctx.estado;
  const enviar = (m) => ctx.enviar(m);
  const lengua = () => (X && X.perfil && [ 'en', X.perfil.segundo ].includes(st().idiLengua) ? st().idiLengua : 'en');
  const L = () => (X && X.perfil && X.perfil.ajustes && X.perfil.ajustes.idiomaFichas === 'es' ? T.es : T[lengua()] || T.es);
  const nivelDecl = (l) => ((X.perfil.idiomas[l] || {}).nivel || 'B1');
  const tituloDe = (m) => (L() === T.es ? (m.titulo_es || m.titulo) : (m.titulo_l || m.titulo_es || m.titulo));
  const descDe = (m) => (L() === T.es ? (m.descripcion_larga_es || m.descripcion_es || m.descripcion) : (m.descripcion_larga_l || m.descripcion_l || m.descripcion_es || m.descripcion));
  const materia = (l, id) => ((X.paquetes[l] || { materias: [] }).materias.find((m) => m.id === id) || null);

  // ------------------------------------------------------------------ mensajes
  function recibir(m) {
    if (m.tipo === 'idiDatos') { X = m.datos; if (!X.perfil) vista = 'nuevo'; else if (vista === 'nuevo') vista = 'inicio'; if (vista !== 'sesion' && vista !== 'ficha') pintarVista(); else if (vista === 'ficha') refrescarPieFicha(); }
    if (m.tipo === 'idiFicha') { fichaAbierta = m.ficha; if (vista !== 'ficha') desdeVista = vista; vista = 'ficha'; pintarVista(); window.scrollTo(0, 0); }
    if (m.tipo === 'idiSesion') empezarSesion(m.sesion);
    if (m.tipo === 'idiCorreccion') corregido(m.clave, m.resultado);
    if (m.tipo === 'idiFin') { fin = m.fin; vista = 'fin'; pintarVista(); }
    // idiAnotado: lo guardado ya está en X.anotaciones (se actualiza al escribir); no se pisa con la respuesta, que puede llegar con retraso
  }

  /** El panel repinta todas las pestañas cuando cambian los datos generales: se conserva lo ya pintado (texto escrito, foco) */
  function pintar(e, D, c) {
    ctx = c;
    if (!pedido) { pedido = true; enviar({ tipo: 'idiCargar' }); }
    if (raiz && raiz.childNodes.length && X) {
      const foco = document.activeElement && raiz.contains(document.activeElement) ? document.activeElement : null;
      e.appendChild(raiz); if (foco) foco.focus();
      return;
    }
    raiz = document.createElement('div'); raiz.className = 'idi-raiz'; e.appendChild(raiz);
    pintarVista();
  }
  const enPantalla = () => raiz && document.body.contains(raiz);

  function pintarVista() {
    if (!raiz) return;
    if (!X) { raiz.innerHTML = '<p class="vacio">Cargando idiomas…</p>'; return; }
    if (!X.hayPaquete) {
      raiz.innerHTML = `<div class="idi-centro"><div class="idi-tarjeta-grande"><h2>Falta el paquete de idiomas</h2>
        <p>Ejecuta la tarea <b>Descargar o actualizar el paquete de idiomas</b> (o <b>Sincronizar</b>) y pulsa el botón.</p>
        <button class="primario" id="idi-recargar">Volver a mirar</button></div></div>`;
      raiz.querySelector('#idi-recargar').onclick = () => enviar({ tipo: 'idiCargar' });
      return;
    }
    if (!X.perfil || vista === 'nuevo') return pNuevo();
    ({ inicio: pInicio, ajustes: pAjustes, ficha: pFicha, sesion: pSesion, fin: pFin })[vista]();
  }
  const ir = (v) => { vista = v; pintarVista(); window.scrollTo(0, 0); };

  // ------------------------------------------------------------------ primer uso: perfil
  function pNuevo() {
    const borrador = st().idiBorrador || { nombre: '', segundo: 'fr', niveles: { en: 'B1', fr: 'B1' }, compromisos: [] };
    raiz.innerHTML = `<div class="idi-centro"><div class="idi-tarjeta-grande">
      ${X.perfil ? '<p><a id="idi-volver">← Volver</a></p>' : ''}
      <h2>${X.perfil ? 'Nuevo perfil' : 'Bienvenido a Idiomas'}</h2>
      <p class="ayuda">Tu perfil y todo tu progreso se guardan solo en este Mac, en la carpeta <code>TCEE/idiomas-&lt;nombre&gt;</code>.
        El nivel que indiques es orientativo: el panel lo irá ajustando con tus resultados y te avisará si encaja mejor otro.</p>
      <div class="idi-form">
        <label>Nombre <input id="idi-nombre" type="text" value="${esc(borrador.nombre)}" placeholder="Tu nombre"></label>
        <label>Segundo idioma <select id="idi-segundo">${Object.entries(X.lenguas).filter(([k]) => k !== 'en').map(([k, v]) => `<option value="${k}" ${borrador.segundo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <small>El inglés es obligatorio.</small></label>
        ${['en', borrador.segundo].map((l) => `<label>Nivel aproximado de ${X.lenguas[l].toLowerCase()} ${selectorNivel(`idi-nv-${l}`, borrador.niveles[l] || 'B1')}</label>`).join('')}
      </div>
      <h3>Compromiso (opcional)</h3>
      <p class="ayuda">Puedes no poner ninguno: siempre podrás empezar una sesión cuando quieras. También se cambia luego en Ajustes.</p>
      <div id="idi-reglas"></div>
      <p class="idi-acciones"><button class="primario" id="idi-crear">Crear perfil</button></p></div></div>`;
    pintarReglas(raiz.querySelector('#idi-reglas'), borrador.compromisos, () => {});
    const leerBorrador = () => {
      borrador.nombre = raiz.querySelector('#idi-nombre').value; borrador.segundo = raiz.querySelector('#idi-segundo').value;
      for (const l of ['en', borrador.segundo]) { const s = raiz.querySelector(`#idi-nv-${l}`); if (s) borrador.niveles[l] = s.value; }
      st().idiBorrador = borrador; ctx.guardar();
    };
    raiz.querySelectorAll('input,select').forEach((i) => i.addEventListener('change', leerBorrador));
    raiz.querySelector('#idi-segundo').onchange = () => { leerBorrador(); pNuevo(); };
    const v = raiz.querySelector('#idi-volver'); if (v) v.onclick = () => ir('ajustes');
    raiz.querySelector('#idi-crear').onclick = () => { leerBorrador(); enviar({ tipo: 'idiCrearPerfil', perfil: borrador }); delete st().idiBorrador; ctx.guardar(); vista = 'inicio'; };
  }
  const selectorNivel = (id, actual) => `<select id="${id}">${NIVELES.map((n) => `<option value="${n}" ${n === actual ? 'selected' : ''}>${n} · ${DESC_NIVEL[n]}</option>`).join('')}</select>`;

  /** Editor de reglas de compromiso: cada una «idioma · cada… · días · minutos», todas opcionales */
  function pintarReglas(cont, reglas, alCambiar) {
    const lenguas = { cualquiera: 'Cualquier idioma', ...X.lenguas };
    const fila = (r, i) => `<div class="idi-regla" data-i="${i}">
      <select data-k="lengua">${Object.entries(lenguas).map(([k, v]) => `<option value="${k}" ${r.lengua === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select data-k="cada"><option value="dia" ${r.cada === 'dia' ? 'selected' : ''}>cada día</option><option value="semana" ${r.cada === 'semana' ? 'selected' : ''}>cada semana</option>
        <option value="semanas" ${r.cada === 'semanas' ? 'selected' : ''}>cada varias semanas</option></select>
      ${r.cada === 'semanas' ? `<label>cada <input type="number" min="2" max="8" data-k="n" value="${r.n || 2}"> semanas</label>` : ''}
      ${r.cada !== 'dia' ? `<span class="idi-dias" title="Días concretos (opcional)">${DIAS.map((d, j) => `<label><input type="checkbox" data-dia="${j + 1}" ${(r.dias || []).includes(j + 1) ? 'checked' : ''}>${d}</label>`).join('')}</span>` : ''}
      <label><input type="number" min="0" max="600" step="5" data-k="minutos" value="${r.minutos || ''}" placeholder="—"> min</label>
      <button class="idi-x" data-quitar="${i}" title="Quitar">✕</button></div>`;
    const repintar = () => {
      cont.innerHTML = `${reglas.map(fila).join('') || '<p class="apagado">Sin compromisos: sesiones cuando quieras.</p>'}
        <p class="apagado idi-mini">Minutos vacíos = basta con hacer una sesión.</p><button id="idi-nueva-regla">+ Añadir compromiso</button>`;
      cont.querySelector('#idi-nueva-regla').onclick = () => { reglas.push({ lengua: X.perfil ? X.perfil.segundo : 'fr', cada: 'semana', dias: [], minutos: 30, desde: hoyIso() }); repintar(); alCambiar(); };
      cont.querySelectorAll('[data-quitar]').forEach((b) => b.onclick = () => { reglas.splice(Number(b.dataset.quitar), 1); repintar(); alCambiar(); });
      cont.querySelectorAll('.idi-regla').forEach((f) => {
        const r = reglas[Number(f.dataset.i)];
        f.querySelectorAll('[data-k]').forEach((i) => i.onchange = () => {
          const k = i.dataset.k; r[k] = i.type === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value;
          if (k === 'cada') { r.desde = hoyIso(); if (r.cada === 'dia') r.dias = []; repintar(); }
          alCambiar();
        });
        f.querySelectorAll('[data-dia]').forEach((c) => c.onchange = () => {
          const d = Number(c.dataset.dia); r.dias = (r.dias || []).filter((x) => x !== d); if (c.checked) r.dias.push(d); r.dias.sort(); alCambiar();
        });
      });
    };
    repintar();
  }
  const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fechaCorta = (iso, loc = 'es-ES') => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // ------------------------------------------------------------------ inicio
  function pInicio() {
    const l = lengua(), P = X.perfil;
    raiz.innerHTML = `<div class="idi2">
      ${barraSuperior(l, P)}
      ${avisosNivel(l, nivelDecl(l), X.nivel[l] || {})}
      <div class="idi-cuerpo">
        <aside class="idi-izq">
          <section class="idi-caja">
            <h3>Empezar sesión</h3>
            <p class="idi-sub">Destrezas y competencias</p>
            <div class="idi-destrezas">${DESTREZAS.map(botonSesion).join('')}</div>
            <div class="idi-especiales">${ESPECIALES.map(botonSesion).join('')}</div>
          </section>
          ${cuadernoHtml(l)}
          ${historialHtml(l)}
        </aside>
        <section class="idi-der">${fichasHtml(l)}</section>
      </div></div>`;
    const sel = raiz.querySelector('#idi-lengua'); sel.onchange = () => { st().idiLengua = sel.value; ctx.guardar(); pInicio(); };
    raiz.querySelector('#idi-ajustes').onclick = () => ir('ajustes');
    raiz.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => enviar({ tipo: 'idiEmpezar', lengua: l, clase: b.dataset.tipo }));
    raiz.querySelectorAll('[data-materia]').forEach((b) => {
      b.onclick = () => enviar({ tipo: 'idiFicha', lengua: l, id: b.dataset.materia });
      b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } };
    });
    raiz.querySelectorAll('[data-practicar-errores]').forEach((b) => b.onclick = (e) => { e.preventDefault(); enviar({ tipo: 'idiEmpezar', lengua: l, clase: 'errores', materia: b.dataset.practicarErrores }); });
    raiz.querySelectorAll('[data-descartar]').forEach((b) => b.onclick = () => { const [m, ej] = b.dataset.descartar.split('|'); enviar({ tipo: 'idiDescartarError', materia: m, ejercicio: ej }); });
    raiz.querySelectorAll('[data-ajustar-nivel]').forEach((b) => b.onclick = () => enviar({ tipo: 'idiGuardarPerfil', cambios: { idiomas: { [l]: { nivel: b.dataset.ajustarNivel } } } }));
    const sb = raiz.querySelector('#idi-bloque'); sb.onchange = () => { st().idiBloque = sb.value; ctx.guardar(); pInicio(); };
    const np = raiz.querySelector('.idi-niv-puntos');
    if (np) np.onkeydown = (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); verNivel(l, e.key === 'ArrowLeft' ? -1 : 1); const x = raiz.querySelector('.idi-punto.activo'); if (x) x.focus(); } };
    raiz.querySelectorAll('[data-nivel-ir]').forEach((b) => b.onclick = () => { st().idiNivelVista = { ...(st().idiNivelVista || {}), [l]: b.dataset.nivelIr }; ctx.guardar(); pInicio(); });
  }
  const verNivel = (l, paso) => {
    const i = NIVELES.indexOf(nivelVista(l)) + paso;
    if (i < 0 || i >= NIVELES.length) return;
    st().idiNivelVista = { ...(st().idiNivelVista || {}), [l]: NIVELES[i] }; ctx.guardar(); pInicio();
  };
  const nivelVista = (l) => ((st().idiNivelVista || {})[l] || nivelDecl(l));

  function barraSuperior(l, P) {
    const ini = (P.nombre || '?').trim().charAt(0).toUpperCase();
    return `<header class="idi-top">
      <div class="idi-top-izq"><label for="idi-lengua">IDIOMA:</label>
        <select id="idi-lengua" class="idi-sel-grande">${['en', P.segundo].map((k) => `<option value="${k}" ${k === l ? 'selected' : ''}>${esc(X.lenguas[k])}</option>`).join('')}</select></div>
      <div class="idi-top-der">
        <div class="idi-perfil">
          <span class="idi-avatar">${esc(ini)}</span>
          <span><b>${esc(P.nombre)}</b><small>${['en', P.segundo].map((k) => `${esc(X.lenguas[k])} ${esc(nivelDecl(k))}`).join(' · ')}</small></span>
          <button id="idi-ajustes" title="Perfil, niveles, compromisos y preferencias">⚙ Ajustes</button>
        </div>
        ${compromisosHtml()}
      </div></header>`;
  }

  function botonSesion([k, icono, nombre, desc, off]) {
    const n = k === 'repaso' ? X.pendientes[lengua()] || 0 : 0;
    return `<button class="idi-sesion-btn ${off ? 'off' : ''} ${k === 'repaso' && n ? 'avisa' : ''}" data-tipo="${k}" ${off || (k === 'repaso' && !n) ? 'disabled' : ''}
      title="${esc(off ? `${nombre}: llegará en la ${desc.toLowerCase()}` : desc)}">
      <span class="idi-ico">${icono}</span><b>${esc(nombre)}${k === 'repaso' && n ? ` <span class="idi-num">${n}</span>` : ''}</b><small>${esc(k === 'repaso' && !n ? 'Nada pendiente hoy' : desc)}</small></button>`;
  }

  /** Aviso cuando el nivel estimado (gramática o léxico) difiere del indicado, y huecos de niveles inferiores */
  function avisosNivel(l, decl, est) {
    const out = [];
    for (const [b, t] of [['gramatica', 'gramática'], ['lexico', 'léxico']]) {
      const e = est[b]; if (!e) continue;
      if (e.nivel && e.nivel !== decl) {
        const sube = NIVELES.indexOf(e.nivel) > NIVELES.indexOf(decl);
        out.push(`<div class="idi-aviso">💡 Tus resultados en <b>${t}</b> (${e.materias} materias trabajadas) encajan mejor con <b>${e.nivel}</b> que con ${decl}.
          ${sube ? 'Podrías subir el material.' : 'Conviene reforzar la base.'} <button data-ajustar-nivel="${e.nivel}">Cambiar mi nivel a ${e.nivel}</button></div>`);
      }
      if (e.huecos && e.huecos.length) out.push(`<div class="idi-aviso suave">En ${t} hay ${e.huecos.length} materia(s) de niveles inferiores que aún flojean: aparecerán antes en tus sesiones.</div>`);
    }
    return out.length ? `<div class="idi-avisos">${out.join('')}</div>` : '';
  }

  function compromisosHtml() {
    const cs = X.compromisos || [];
    if (!cs.length) return '<p class="idi-sin-reglas">Sin compromisos fijados <span>(Añádelos en ⚙ Ajustes.)</span></p>';
    return `<div class="idi-reglas-estado">${cs.map((c) => {
      const pct = c.regla.minutos ? Math.min(100, Math.round(100 * c.minutos / c.regla.minutos)) : (c.cumplido ? 100 : 0);
      return `<div class="idi-regla-est ${c.cumplido ? 'ok' : c.tocaHoy ? 'hoy' : ''}" title="${esc(c.texto)}"><b>${esc(c.texto)}</b>
        <span>${c.regla.minutos ? `${c.minutos} de ${c.regla.minutos} min` : `${c.sesiones} sesión(es)`} ${c.regla.cada === 'dia' ? 'hoy' : `del ${fecha(c.desde)} al ${fecha(c.hasta)}`}${c.cumplido ? ' ✓' : c.tocaHoy ? ' · toca hoy' : ''}</span>
        <div class="carga"><span style="width:${pct}%"></span></div></div>`;
    }).join('')}</div>`;
  }
  const fecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); };

  function cuadernoHtml(l) {
    const errs = (X.errores || []).filter((e) => e.lengua === l);
    const porMateria = {};
    for (const e of errs) (porMateria[e.materia] = porMateria[e.materia] || []).push(e);
    const titulo = (id) => { const m = materia(l, id); return m ? (m.titulo_es || m.titulo) : id; };
    return `<section class="idi-caja"><h3>Cuaderno de errores ${errs.length ? `<span class="idi-num gris">${errs.length}</span>` : ''}</h3>
      ${errs.length ? `<div class="idi-cuaderno">${Object.entries(porMateria).sort((a, b) => b[1].length - a[1].length).map(([id, es]) => `<details>
        <summary><span class="idi-cu-tit">${esc(titulo(id))}</span><span class="idi-num rojo">${es.length}</span><button data-practicar-errores="${esc(id)}" title="Repetir estos ejercicios">Practicar</button></summary>
        <ul>${es.map((e) => `<li><div class="idi-cu-frase">${esc(e.frase || '')}</div><span class="idi-mal">${esc(e.respuesta || '(en blanco)')}</span> → <span class="idi-bien">${esc(e.correcta)}</span>
          ${e.veces > 1 ? `<span class="apagado"> · ${e.veces} veces</span>` : ''} <a class="idi-quitar" data-descartar="${esc(id)}|${esc(e.ejercicio)}" title="Ya lo tengo claro: quitar del cuaderno">quitar</a></li>`).join('')}</ul></details>`).join('')}</div>`
        : '<p class="apagado">Sin errores pendientes. Los fallos de tus sesiones aparecerán aquí, agrupados por ficha, y volverán a salir hasta que los aciertes.</p>'}</section>`;
  }

  function historialHtml(l) {
    const ss = (X.sesiones || []).filter((s) => s.lengua === l).slice(-6).reverse();
    if (!ss.length) return '';
    return `<section class="idi-caja"><h3>Últimas sesiones</h3><ul class="idi-hist">${ss.map((s) => {
      const pct = s.ejercicios ? Math.round((100 * s.aciertos) / s.ejercicios) : 0;
      return `<li><span>${fechaCorta(s.fecha)}</span><span>${esc(NOMBRE_SESION[s.tipo] || s.tipo)}</span>
        <span class="idi-hist-barra" title="${s.aciertos} de ${s.ejercicios}"><i style="width:${pct}%"></i></span><span>${pct} %</span><span class="apagado">${Math.round(s.minutos)} min</span></li>`;
    }).join('')}</ul></section>`;
  }

  // ------------------------------------------------------------------ fichas (tarjetas)
  function fichasHtml(l) {
    const t = L(), paq = X.paquetes[l] || { materias: [] };
    const bloque = st().idiBloque || 'gramatica';
    const nv = nivelVista(l), decl = nivelDecl(l);
    const ms = paq.materias.filter((m) => (bloque === 'todas' || m.bloque === bloque) && m.nivel === nv);
    const conFicha = ms.filter((m) => m.ficha);
    const dom = conFicha.filter((m) => m.estado === 'dominada').length;
    const porNivel = Object.fromEntries(NIVELES.map((n) => [n, paq.materias.filter((m) => (bloque === 'todas' || m.bloque === bloque) && m.nivel === n && m.ficha)]));
    return `<div class="idi-der-cab">
        <select id="idi-bloque" class="idi-sel-grande" title="Mapa de materias">${[...BLOQUES, 'todas'].map((b) => `<option value="${b}" ${b === bloque ? 'selected' : ''}>${esc(t[b])}</option>`).join('')}</select>
        <div class="idi-niv-puntos" role="tablist" aria-label="Nivel">${NIVELES.map((n) => {
          const xs = porNivel[n], d = xs.filter((m) => m.estado === 'dominada').length;
          return `<button role="tab" aria-selected="${n === nv}" class="idi-punto n-${n} ${n === nv ? 'activo' : ''} ${n === decl ? 'tuyo' : ''}" data-nivel-ir="${n}"
            title="${n}${n === decl ? ' (tu nivel)' : ''}: ${xs.length} fichas, ${d} dominadas">${n}${n === decl ? '<sup>●</sup>' : ''}<i style="width:${xs.length ? (100 * d) / xs.length : 0}%"></i></button>`;
        }).join('')}</div>
      </div>
      <p class="idi-der-res"><span>${esc(DESC_NIVEL[nv])}</span><span>${esc(t.fichas(conFicha.length))} · ${esc(t.dominadas(dom))}</span></p>
      ${ms.length ? `<div class="idi-cartas">${ms.map((m) => carta(m, t)).join('')}</div>` : `<p class="vacio">${esc(t.vacio)}</p>`}`;
  }

  function carta(m, t) {
    const r = (X.registros || {})[m.id];
    const tieneNota = X.anotaciones && X.anotaciones[m.id];
    const otraLengua = t === T.es ? (m.titulo_l || '') : (m.titulo_es || '');
    if (!m.ficha) {
      return `<article class="idi-carta prep n-${m.nivel}"><div class="idi-carta-fila"><span class="idi-chip-niv">${m.nivel}</span><span class="idi-chip-bloque">${esc(t[m.bloque] || m.bloque)}</span></div>
        <h4>${esc(tituloDe(m))}</h4><p class="idi-carta-desc">${esc(descDe(m))}</p><div class="idi-carta-pie"><span class="apagado">⏳ ${esc(t.prep)}</span></div></article>`;
    }
    const media = r && r.notas && r.notas.length ? r.notas.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, r.notas.length) : null;
    return `<article class="idi-carta est-${m.estado} n-${m.nivel}" data-materia="${esc(m.id)}" tabindex="0" title="${esc(otraLengua)}">
      <div class="idi-carta-fila"><span class="idi-chip-niv">${m.nivel}</span><span class="idi-chip-bloque">${esc(t[m.bloque] || m.bloque)}</span>
        ${m.oficial ? `<span class="idi-chip-of" title="${esc(`${t.oficial} (${m.id.startsWith('fr.') ? 'Inventaire linguistique des contenus clés, Eaquals–CIEP' : 'Core Inventory for General English, British Council–EAQUALS'}): ${m.oficial}`)}">📘</span>` : ''}
        ${tieneNota ? `<span class="idi-chip-nota" title="${esc(t.conNota)}">📝</span>` : ''}
        <span class="idi-chip-est">${esc(t[m.estado] || t.nueva)}</span></div>
      <h4>${esc(tituloDe(m))}</h4>
      <p class="idi-carta-desc">${esc(descDe(m))}</p>
      <div class="idi-carta-pie">${r && r.sesiones
        ? `<span class="idi-anillo" style="--p:${Math.round((media || 0) * 100)}" title="${esc(t.nota)}"><b>${Math.round((r.notas[r.notas.length - 1] || 0) * 100)}</b></span>
           <span class="idi-carta-datos"><span>${esc(t.sesiones(r.sesiones))}</span>${r.due ? `<span>${esc(t.repaso)}: ${esc(fechaCorta(r.due, t.loc))}</span>` : ''}</span>`
        : `<span class="idi-carta-datos"><span>${esc(t.sinEmpezar)}</span><span>${m.n || 0} ${esc(t.ejercicios)}</span></span>`}</div>
    </article>`;
  }

  // ------------------------------------------------------------------ ajustes
  function pAjustes() {
    const P = JSON.parse(JSON.stringify(X.perfil));
    P.compromisos = P.compromisos || []; P.medios = P.medios || []; P.ajustes = P.ajustes || {};
    const actual = X.perfiles.find((p) => p.nombre === P.nombre) || {};
    raiz.innerHTML = `<div class="idi-centro ancho"><p><a id="idi-volver">← Volver</a></p><h2>Ajustes de idiomas</h2>
      <div class="idi-ajustes-rejilla">
      <section class="idi-caja"><h3>Perfil</h3>
        <p><b>${esc(P.nombre)}</b> <span class="apagado">· carpeta <code>${esc(actual.dir || '')}</code></span></p>
        ${X.perfiles.length > 1 ? `<label class="idi-fila">Cambiar a <select id="idi-perfil">${X.perfiles.map((p) => `<option value="${esc(p.dir)}" ${p.dir === actual.dir ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>` : ''}
        <p class="idi-acciones"><button id="idi-otro">+ Crear otro perfil</button> <button class="peligro" id="idi-borrar">Eliminar este perfil…</button></p>
        <p class="apagado idi-mini">Al eliminarlo, su carpeta va a la Papelera del Mac (se puede recuperar desde allí).</p></section>
      <section class="idi-caja"><h3>Nivel orientativo</h3>
        <div class="idi-form">${['en', P.segundo].map((l) => `<label>${X.lenguas[l]} ${selectorNivel(`idi-nv-${l}`, (P.idiomas[l] || {}).nivel || 'B1')}</label>`).join('')}</div></section>
      <section class="idi-caja"><h3>Tarjetas de las fichas</h3>
        <p class="ayuda">Idioma del título, la descripción y el progreso de cada tarjeta.</p>
        <div class="segmentos" role="radiogroup">
          <button class="${P.ajustes.idiomaFichas === 'es' ? '' : 'activo'}" data-idfichas="lengua">Idioma estudiado</button>
          <button class="${P.ajustes.idiomaFichas === 'es' ? 'activo' : ''}" data-idfichas="es">Castellano</button></div>
        <p class="apagado idi-mini">Las explicaciones de dentro de la ficha están siempre en castellano.</p></section>
      <section class="idi-caja"><h3>Sesiones</h3>
        <label class="idi-fila">Ejercicios por sesión <input type="number" id="idi-n" min="4" max="40" value="${P.ajustes.ejercicios || 10}"></label></section>
      <section class="idi-caja doble"><h3>Compromisos</h3><div id="idi-reglas"></div></section>
      <section class="idi-caja doble"><h3>Medios de suscripción <span class="apagado">(fase 4)</span></h3>
        <p class="ayuda">Un enlace por línea (por ejemplo, la sección de un periódico). Solo se descargarán estos, una vez por semana, desde tu navegador
          y con tu sesión iniciada; se borran al renovarse y no salen de este Mac. El riesgo frente a las condiciones de uso de cada medio es tuyo.</p>
        <textarea id="idi-medios" rows="4" placeholder="https://www.economist.com/finance-and-economics">${esc(P.medios.join('\n'))}</textarea></section>
      </div>
      <p class="idi-acciones"><button class="primario" id="idi-guardar">Guardar ajustes</button></p></div>`;
    pintarReglas(raiz.querySelector('#idi-reglas'), P.compromisos, () => {});
    raiz.querySelector('#idi-volver').onclick = () => ir('inicio');
    raiz.querySelector('#idi-otro').onclick = () => ir('nuevo');
    raiz.querySelector('#idi-borrar').onclick = () => enviar({ tipo: 'idiEliminarPerfil', dir: actual.dir });
    raiz.querySelectorAll('[data-idfichas]').forEach((b) => b.onclick = () => {
      P.ajustes.idiomaFichas = b.dataset.idfichas;
      raiz.querySelectorAll('[data-idfichas]').forEach((x) => x.classList.toggle('activo', x === b));
    });
    const sp = raiz.querySelector('#idi-perfil'); if (sp) sp.onchange = () => { vista = 'inicio'; enviar({ tipo: 'idiElegirPerfil', dir: sp.value }); };
    raiz.querySelector('#idi-guardar').onclick = () => {
      const idiomas = {}; for (const l of ['en', P.segundo]) idiomas[l] = { nivel: raiz.querySelector(`#idi-nv-${l}`).value };
      const medios = raiz.querySelector('#idi-medios').value.split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
      enviar({ tipo: 'idiGuardarPerfil', cambios: { idiomas, compromisos: P.compromisos, medios,
        ajustes: { ejercicios: Number(raiz.querySelector('#idi-n').value) || 10, idiomaFichas: P.ajustes.idiomaFichas || 'lengua' } } });
      vista = 'inicio';
    };
  }

  // ------------------------------------------------------------------ ficha: estructura fija
  const vozDisponible = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  function decir(texto, l) {
    if (!vozDisponible()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto); u.lang = VOZ[l] || l; u.rate = 0.92;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang && x.lang.replace('_', '-').startsWith((VOZ[l] || l).slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  /** Cuerpo de la ficha: las mismas secciones, en el mismo orden, para todas. Los bloques llevan data-k para anclar subrayados y notas. */
  function cuerpoFicha(f, l, { compacta } = {}) {
    const m = materia(l, f.id) || {};
    const bloques = f.explicacion || [];
    const sec = (clase, k, icono, titulo, html, abierta = true) => (html ? `<details class="idi-sec ${clase}" ${abierta ? 'open' : ''}>
      <summary><span class="idi-sec-ico">${icono}</span>${titulo}<button class="idi-sec-nota" data-nota-sec="${k}" title="Añadir un recuadro de nota al final de esta sección">＋ nota</button></summary>
      <div class="idi-sec-cuerpo" data-k="${k}">${html}</div></details>` : '');
    const cx = f.contexto || {};
    const que = `<p class="idi-desc-es" data-k="desc">${esc(f.descripcion_larga_es || f.descripcion_es || m.descripcion_es || '')}</p>
      ${cx.que_es || cx.por_que_importa || cx.cuando_se_usa ? `<div class="idi-ctx-rejilla">${[['que_es', '🔎', 'Qué es'], ['por_que_importa', '⭐', 'Por qué importa'], ['cuando_se_usa', '🕒', 'Cuándo se usa']]
        .filter(([c]) => cx[c]).map(([c, i, t]) => `<div class="idi-ctx"><h5>${i} ${t}</h5><p data-k="ctx-${c}">${esc(cx[c])}</p></div>`).join('')}</div>` : ''}
      ${f.resumen ? `<p class="idi-resumen" data-k="resumen">${esc(f.resumen)}</p>` : ''}`;
    const reglas = bloques.map((b, i) => (b.tipo === 'texto' ? `<div class="idi-clave" data-k="r${i}">${esc(b.texto)}</div>`
      : b.tipo === 'lista' ? `<ul class="idi-lista" data-k="r${i}">${b.items.map((x) => `<li>${resaltar(x)}</li>`).join('')}</ul>`
        : `<div class="idi-tabla-env" data-k="r${i}"><table class="idi-tabla"><thead><tr>${b.cabecera.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.filas.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)).join('');
    const ejemplos = (f.ejemplos || []).length ? `<div class="idi-ejemplos-rejilla">${f.ejemplos.map((e, i) => `<div class="idi-ejemplo" data-k="ej${i}">
        <div class="idi-ej-frase">${vozDisponible() ? `<button class="idi-voz" data-decir="${esc(e.frase)}" title="Escuchar">🔊</button>` : ''}<b>${esc(e.frase)}</b></div>
        ${e.traduccion ? `<div class="idi-ej-trad">${esc(e.traduccion)}</div>` : ''}</div>`).join('')}</div>` : '';
    const errores = (f.errores_hispanohablantes || []).length ? `<div class="idi-errores-rejilla">${f.errores_hispanohablantes.map((e, i) => `<div class="idi-error" data-k="err${i}">
        <div class="idi-err-mal">✗ ${esc(e.mal)}</div><div class="idi-err-bien">✓ ${esc(e.bien)}</div>${e.nota ? `<div class="idi-err-nota">${esc(e.nota)}</div>` : ''}</div>`).join('')}</div>` : '';
    const rel = relacionadas(l, m);
    const material = `${fuenteHtml(f.fuente)}
      ${m.oficial ? `<p>📘 <b>${l === 'fr' ? 'Inventaire linguistique des contenus clés des niveaux du CECRL' : 'Core Inventory for General English'}</b>
        (${l === 'fr' ? 'Eaquals–CIEP' : 'British Council–EAQUALS'}): <i>${esc(m.oficial)}</i>${m.nivel_oficial ? ` · nivel ${esc(m.nivel_oficial)}` : ''}</p>` : ''}
      ${rel.length ? `<p class="idi-rel-tit">Fichas relacionadas</p><div class="idi-rel">${rel.map((r) => `<button class="idi-rel-chip n-${r.nivel}" data-abrir-ficha="${esc(r.id)}"><span class="idi-chip-niv">${r.nivel}</span>${esc(r.titulo_es || r.titulo)}</button>`).join('')}</div>` : ''}
      <p class="idi-rel-tit">Conjugar y escuchar</p><p class="idi-mini">${l === 'fr'
        ? '<a href="https://leconjugueur.lefigaro.fr/" data-externo>Le Conjugueur</a> · <a href="https://tatoeba.org/fra/sentences/search?from=fra&to=spa" data-externo>Frases de Tatoeba</a> · <a href="https://forvo.com/languages/fr/" data-externo>Pronunciación (Forvo)</a>'
        : '<a href="https://dictionary.cambridge.org/" data-externo>Cambridge Dictionary</a> · <a href="https://tatoeba.org/eng/sentences/search?from=eng&to=spa" data-externo>Frases de Tatoeba</a> · <a href="https://youglish.com/english" data-externo>YouGlish</a>'}</p>`;
    return `<p class="idi-pista-marcas">✎ Selecciona cualquier texto de la ficha para <b>subrayarlo</b> o <b>anotarlo</b>; con «＋ nota» añades un recuadro al final de una sección.</p>
      <div class="idi-nota-general" data-k="general"></div>
      ${sec('s-que', 'sec-que', '🎯', 'De qué trata', que)}
      ${sec('s-reglas', 'sec-reglas', '📐', 'Reglas y claves', reglas)}
      ${sec('s-ejemplos', 'sec-ejemplos', '💬', `Ejemplos <span class="apagado">(${(f.ejemplos || []).length})</span>`, ejemplos)}
      ${sec('s-errores', 'sec-errores', '⚠️', `Errores típicos de hispanohablantes <span class="apagado">(${(f.errores_hispanohablantes || []).length})</span>`, errores)}
      ${sec('s-material', 'sec-material', '📎', 'Material complementario', material, !compacta)}`;
  }

  // ------------------------------------------------------------------ anotaciones sobre la ficha: subrayados y recuadros de nota
  // Cada marca: {id, k (bloque con data-k), inicio, cita, color, caja (recuadro visible), nota}. Se guardan en anotaciones.json del perfil.
  const COLORES = [['amarillo', 'Amarillo'], ['verde', 'Verde'], ['azul', 'Azul'], ['rosa', 'Rosa']];
  const anotDe = (id) => { const a = (X.anotaciones || {})[id] || {}; return { texto: a.texto || '', marcas: (a.marcas || []).map((m) => ({ ...m })) }; };
  let tGuardar = null;
  function guardarAnot(id, a) {
    X.anotaciones = X.anotaciones || {};
    if (a.texto || a.marcas.length) X.anotaciones[id] = { ...a, fecha: new Date().toISOString() }; else delete X.anotaciones[id];
    clearTimeout(tGuardar); tGuardar = setTimeout(() => enviar({ tipo: 'idiAnotar', id, anotacion: a }), 600);
  }
  /** Nodos de texto de un bloque, sin los recuadros, botones ni campos de escritura */
  function nodosTexto(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.idi-recuadro, textarea, button, .idi-barra-marca') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const xs = []; let n; while ((n = w.nextNode())) xs.push(n); return xs;
  }
  const textoDe = (el) => nodosTexto(el).map((n) => n.data).join('');
  /** Envuelve en <mark> el tramo [a, b) del texto del bloque, aunque cruce varios nodos */
  function envolver(el, a, b, m) {
    let pos = 0;
    for (const n of nodosTexto(el)) {
      const ini = pos, fin = pos + n.data.length; pos = fin;
      if (fin <= a || ini >= b) continue;
      let nodo = n;
      const desde = Math.max(a, ini) - ini, hasta = Math.min(b, fin) - ini;
      if (hasta < nodo.data.length) nodo.splitText(hasta);
      if (desde > 0) nodo = nodo.splitText(desde);
      if (!nodo.data.trim()) continue;
      const mk = document.createElement('mark'); mk.className = `idi-marca c-${m.color || 'amarillo'}${m.nota ? ' con-nota' : ''}`; mk.dataset.m = m.id;
      if (m.nota) mk.title = m.nota;
      nodo.parentNode.insertBefore(mk, nodo); mk.appendChild(nodo);
    }
  }
  function recuadro(m, etiqueta) {
    const d = document.createElement('div');
    d.className = `idi-recuadro c-${m.color || 'amarillo'}`; d.dataset.caja = m.id;
    d.innerHTML = `<div class="idi-recuadro-cab"><span>📝 ${etiqueta ? esc(etiqueta) : m.cita ? `«${esc(m.cita.length > 70 ? `${m.cita.slice(0, 70)}…` : m.cita)}»` : 'Nota'}</span>
      <button data-quitar-caja="${esc(m.id)}" title="Quitar la nota">✕</button></div><textarea rows="2" placeholder="Escribe tu nota…" data-nota="${esc(m.id)}">${esc(m.nota || '')}</textarea>`;
    return d;
  }
  /** Pinta (de nuevo) subrayados y recuadros de la ficha en el contenedor y engancha la barra de marcar */
  function aplicarMarcas(cont, fid) {
    cont.querySelectorAll('mark.idi-marca').forEach((mk) => { const p = mk.parentNode; while (mk.firstChild) p.insertBefore(mk.firstChild, mk); p.removeChild(mk); p.normalize(); });
    cont.querySelectorAll('.idi-recuadro').forEach((d) => d.remove());
    const a = anotDe(fid);
    const gen = cont.querySelector('[data-k="general"]');
    if (gen && a.texto) {
      const d = recuadro({ id: '__general', nota: a.texto, color: 'amarillo' }, 'Nota general'); gen.appendChild(d);
    }
    for (const m of a.marcas) {
      const el = cont.querySelector(`[data-k="${CSS.escape(m.k)}"]`); if (!el) continue;
      if (m.cita) {
        const t = textoDe(el);
        let i = t.substr(m.inicio || 0, m.cita.length) === m.cita ? (m.inicio || 0) : -1;
        if (i < 0) { let best = -1, j = t.indexOf(m.cita); while (j >= 0) { if (best < 0 || Math.abs(j - (m.inicio || 0)) < Math.abs(best - (m.inicio || 0))) best = j; j = t.indexOf(m.cita, j + 1); } i = best; }
        if (i >= 0) envolver(el, i, i + m.cita.length, m);
      }
      if (m.caja) {
        const d = recuadro(m);
        if (/^sec-/.test(m.k)) el.appendChild(d); else el.insertAdjacentElement('afterend', d);
      }
    }
    // recuadros: escribir guarda solo; ✕ quita la nota (el subrayado se queda)
    cont.querySelectorAll('[data-nota]').forEach((ta) => ta.addEventListener('input', () => {
      const b = anotDe(fid);
      if (ta.dataset.nota === '__general') b.texto = ta.value;
      else { const m = b.marcas.find((x) => x.id === ta.dataset.nota); if (m) m.nota = ta.value; }
      guardarAnot(fid, b);
      const mk = cont.querySelector(`mark[data-m="${CSS.escape(ta.dataset.nota)}"]`); if (mk) mk.title = ta.value;
    }));
    cont.querySelectorAll('[data-quitar-caja]').forEach((bt) => bt.onclick = () => {
      const b = anotDe(fid), id = bt.dataset.quitarCaja;
      if (id === '__general') b.texto = '';
      else { const m = b.marcas.find((x) => x.id === id); if (m && m.cita) { m.caja = false; m.nota = ''; } else b.marcas = b.marcas.filter((x) => x.id !== id); }
      guardarAnot(fid, b); aplicarMarcas(cont, fid);
    });
  }
  let barra = null;
  const quitarBarra = () => { if (barra) { barra.remove(); barra = null; } };
  function mostrarBarra(rect, botones) {
    quitarBarra();
    barra = document.createElement('div'); barra.className = 'idi-barra-marca';
    barra.innerHTML = botones;
    document.body.appendChild(barra);
    const w = barra.offsetWidth;
    barra.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2))}px`;
    barra.style.top = `${Math.max(8, rect.top - barra.offsetHeight - 8)}px`;
    barra.addEventListener('mousedown', (e) => e.preventDefault());   // no perder la selección
    return barra;
  }
  const botonesColor = (actual) => COLORES.map(([c, t]) => `<button class="idi-bm-color c-${c} ${c === actual ? 'activo' : ''}" data-color="${c}" title="Subrayar en ${t.toLowerCase()}"></button>`).join('');
  /** Selección de texto → barra para subrayar o anotar; clic en un subrayado → cambiar color, anotar o quitar */
  function habilitarMarcas(cont, fid) {
    aplicarMarcas(cont, fid);
    cont.addEventListener('mouseup', (ev) => {
      if (ev.target.closest('textarea, button, a, .idi-recuadro')) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const r = sel.getRangeAt(0);
        const kA = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('[data-k]');
        const kB = (r.endContainer.nodeType === 1 ? r.endContainer : r.endContainer.parentElement).closest('[data-k]');
        if (!kA || kA !== kB || !cont.contains(kA) || kA.dataset.k === 'general') return;
        const cita = r.toString().replace(/\s+/g, ' ').trim(); if (!cita) return;
        const pre = document.createRange(); pre.setStart(kA, 0); pre.setEnd(r.startContainer, r.startOffset);
        const aprox = pre.toString().length;
        const b = mostrarBarra(r.getBoundingClientRect(), `${botonesColor('')}<button class="idi-bm-nota" data-accion="nota">✎ Nota</button>`);
        const crear = (color, caja) => {
          const t = textoDe(kA); let inicio = t.indexOf(cita), j = inicio;
          while (j >= 0) { if (Math.abs(j - aprox) < Math.abs(inicio - aprox)) inicio = j; j = t.indexOf(cita, j + 1); }
          if (inicio < 0) return;
          const a = anotDe(fid);
          const m = { id: `m${Date.now().toString(36)}`, k: kA.dataset.k, inicio, cita, color, caja, nota: '' };
          a.marcas.push(m); guardarAnot(fid, a); sel.removeAllRanges(); quitarBarra(); aplicarMarcas(cont, fid);
          if (caja) { const ta = cont.querySelector(`[data-nota="${m.id}"]`); if (ta) ta.focus(); }
        };
        b.querySelectorAll('[data-color]').forEach((x) => x.onclick = () => crear(x.dataset.color, false));
        b.querySelector('[data-accion="nota"]').onclick = () => crear('amarillo', true);
      }, 0);
    });
    cont.addEventListener('click', (ev) => {
      const mk = ev.target.closest('mark.idi-marca');
      if (!mk || !window.getSelection().isCollapsed) return;
      const a = anotDe(fid), m = a.marcas.find((x) => x.id === mk.dataset.m); if (!m) return;
      const b = mostrarBarra(mk.getBoundingClientRect(), `${botonesColor(m.color)}<button class="idi-bm-nota" data-accion="nota">${m.caja ? '✎ Ver nota' : '✎ Nota'}</button><button data-accion="quitar" title="Quitar el subrayado y su nota">🗑</button>`);
      b.querySelectorAll('[data-color]').forEach((x) => x.onclick = () => { m.color = x.dataset.color; guardarAnot(fid, a); quitarBarra(); aplicarMarcas(cont, fid); });
      b.querySelector('[data-accion="nota"]').onclick = () => { m.caja = true; guardarAnot(fid, a); quitarBarra(); aplicarMarcas(cont, fid); const ta = cont.querySelector(`[data-nota="${m.id}"]`); if (ta) ta.focus(); };
      b.querySelector('[data-accion="quitar"]').onclick = () => { a.marcas = a.marcas.filter((x) => x.id !== m.id); guardarAnot(fid, a); quitarBarra(); aplicarMarcas(cont, fid); };
    });
    cont.querySelectorAll('[data-nota-sec]').forEach((bt) => bt.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const det = bt.closest('details'); if (det) det.open = true;
      const a = anotDe(fid); const m = { id: `m${Date.now().toString(36)}`, k: bt.dataset.notaSec, cita: '', color: 'amarillo', caja: true, nota: '' };
      a.marcas.push(m); guardarAnot(fid, a); aplicarMarcas(cont, fid);
      const ta = cont.querySelector(`[data-nota="${m.id}"]`); if (ta) ta.focus();
    });
  }
  document.addEventListener('mousedown', (e) => { if (barra && !barra.contains(e.target)) quitarBarra(); });
  window.addEventListener('scroll', quitarBarra, true);

  /** Resalta en negrita lo que va antes de «:» en una lista de reglas */
  const resaltar = (s) => { const t = esc(s); const i = t.indexOf(':'); return i > 0 && i < 70 ? `<b>${t.slice(0, i)}</b>${t.slice(i)}` : t; };
  const fuenteHtml = (fu) => (fu && fu.nombre && fu.nombre !== 'propia'
    ? `<p>📚 Fuente: <b>${esc(fu.nombre)}</b>${fu.autores ? `, ${esc(fu.autores)}` : ''}${fu.licencia ? ` (${esc(fu.licencia)})` : ''}${fu.url ? ` · <a href="${esc(fu.url)}" data-externo>ver la página original</a>` : ''}</p>`
    : '<p class="apagado">Ficha propia del panel (CC BY-SA 4.0).</p>');
  function relacionadas(l, m) {
    if (!m || !m.id) return [];
    const nv = NIVELES.indexOf(m.nivel);
    const pal = (s) => new Set(String(s || '').toLowerCase().split(/[^a-záéíóúñü]+/).filter((w) => w.length > 4));
    const p0 = pal(`${m.titulo_es || m.titulo} ${m.descripcion}`);
    return (X.paquetes[l] || { materias: [] }).materias.filter((x) => x.id !== m.id && x.ficha && x.bloque === m.bloque && Math.abs(NIVELES.indexOf(x.nivel) - nv) <= 1)
      .map((x) => { let c = 0; for (const w of pal(`${x.titulo_es || x.titulo} ${x.descripcion}`)) if (p0.has(w)) c += 1; return { x, c }; })
      .sort((a, b) => b.c - a.c || NIVELES.indexOf(a.x.nivel) - NIVELES.indexOf(b.x.nivel)).slice(0, 5).map((y) => y.x);
  }
  /** Enlaces y botones del cuerpo de la ficha (voz, relacionadas, enlaces externos, anotaciones con guardado automático) */
  function enlazarFicha(cont, f, l) {
    cont.querySelectorAll('[data-decir]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); decir(b.dataset.decir, l); });
    cont.querySelectorAll('[data-abrir-ficha]').forEach((b) => b.onclick = () => { if (vista === 'sesion' && !confirmarSalida()) return; enviar({ tipo: 'idiFicha', lengua: l, id: b.dataset.abrirFicha }); });
    cont.querySelectorAll('[data-externo]').forEach((a) => a.onclick = (e) => { e.preventDefault(); enviar({ tipo: 'abrirUrl', url: a.getAttribute('href') }); });
    habilitarMarcas(cont, f.id);
  }
  const confirmarSalida = () => { if (S && S.resultados.length) { terminar(); return false; } clearInterval(tic); S = null; return true; };

  function cabeceraFicha(f, l, m) {
    const r = (X.registros || {})[f.id];
    const t = L();
    return `<div class="idi-ficha-cab n-${f.nivel}">
      <div class="idi-carta-fila"><span class="idi-chip-niv">${esc(f.nivel)}</span><span class="idi-chip-bloque">${esc(t[m.bloque] || '')}</span>
        <span class="idi-chip-est">${esc(t[m.estado] || t.nueva)}</span></div>
      <h2>${esc(m.titulo_l || f.titulo)}</h2>
      <p class="idi-ficha-sub">${esc(f.titulo_es || m.titulo_es || '')}</p>
      <div class="idi-ficha-stats">
        ${r && r.sesiones ? `<span><b>${r.sesiones}</b> sesiones</span><span>última nota <b>${Math.round(100 * r.notas[r.notas.length - 1])} %</b></span>
          ${r.due ? `<span>próximo repaso <b>${fechaCorta(r.due)}</b></span>` : ''}` : '<span>Aún sin practicar</span>'}
        <span><b>${m.n || '?'}</b> ejercicios</span></div>
    </div>`;
  }
  function pFicha() {
    const f = fichaAbierta;
    if (!f) return ir('inicio');
    const l = lengua(), m = materia(l, f.id) || {};
    raiz.innerHTML = `<div class="idi-centro ancho idi-ficha">
      <div class="idi-ficha-barra"><a id="idi-volver">← Volver a las fichas</a><button class="primario" id="idi-practicar">▶ Practicar esta ficha</button></div>
      ${cabeceraFicha(f, l, m)}
      <div class="idi-ficha-cuerpo">${cuerpoFicha(f, l)}</div>
      <p class="idi-acciones centro"><button class="primario" id="idi-practicar2">▶ Practicar esta ficha</button></p></div>`;
    raiz.querySelector('#idi-volver').onclick = () => ir('inicio');
    const practicar = () => enviar({ tipo: 'idiEmpezar', lengua: l, clase: 'ficha', materia: f.id });
    raiz.querySelector('#idi-practicar').onclick = practicar; raiz.querySelector('#idi-practicar2').onclick = practicar;
    enlazarFicha(raiz, f, l);
  }
  function refrescarPieFicha() { /* los datos generales cambiaron con la ficha abierta: no se repinta para no perder lo escrito */ }

  // ------------------------------------------------------------------ sesión: ficha a la izquierda (plegable), ejercicios a la derecha
  function empezarSesion(sesion) {
    S = { sesion, i: 0, resultados: [], t0: Date.now(), corrigiendo: false, respuesta: '', orden: [] };
    S.items = sesion.bloques.flatMap((b, k) => b.ejercicios.map((e) => ({ ...e, materia: b.ficha.id, k })));
    if (st().idiFichaPlegada == null) st().idiFichaPlegada = false;
    vista = 'sesion';
    clearInterval(tic); tic = setInterval(() => { const r = raiz && raiz.querySelector('#idi-reloj'); if (r) r.textContent = reloj((Date.now() - S.t0) / 1000); }, 1000);
    pintarVista(); window.scrollTo(0, 0);
  }
  const reloj = (seg) => { seg = Math.round(seg); return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`; };

  function pSesion() {
    if (!S) return ir('inicio');
    const it = S.items[S.i];
    const b = S.sesion.bloques[it.k];
    const l = S.sesion.lengua, m = materia(l, b.ficha.id) || {};
    const hecho = S.resultados.find((r) => r.indice === S.i);
    const plegada = !!st().idiFichaPlegada;
    const cambiaFicha = !S.fichaPintada || S.fichaPintada !== b.ficha.id || S.plegadaPintada !== plegada || !raiz.querySelector('.idi-practica');
    if (cambiaFicha) {
      raiz.innerHTML = `<div class="idi-practica ${plegada ? 'plegada' : ''}">
        <aside class="idi-pr-ficha">
          <div class="idi-pr-ficha-cab"><button id="idi-plegar" title="${plegada ? 'Desplegar la ficha' : 'Plegar la ficha'}">${plegada ? '▶' : '◀'}</button>
            ${plegada ? '<span class="idi-vertical">Ficha</span>' : `<span class="idi-chip-niv n-${b.ficha.nivel}">${esc(b.ficha.nivel)}</span><b>${esc(m.titulo_l || b.ficha.titulo)}</b>`}</div>
          ${plegada ? '' : `<div class="idi-pr-ficha-cuerpo"><p class="idi-ficha-sub">${esc(b.ficha.titulo_es || '')}</p>${cuerpoFicha(b.ficha, l, { compacta: true })}</div>`}
        </aside>
        <section class="idi-pr-ej" id="idi-pr-ej"></section></div>`;
      S.fichaPintada = b.ficha.id; S.plegadaPintada = plegada;
      raiz.querySelector('#idi-plegar').onclick = () => { st().idiFichaPlegada = !plegada; ctx.guardar(); pSesion(); };
      if (!plegada) enlazarFicha(raiz.querySelector('.idi-pr-ficha'), b.ficha, l);
    }
    const zona = raiz.querySelector('#idi-pr-ej');
    zona.innerHTML = `<div class="idi-pr-cab">
        <span class="idi-pr-tipo">${esc(NOMBRE_SESION[S.sesion.tipo] || 'Sesión')}${S.sesion.bloques.length > 1 ? ` · ficha ${it.k + 1} de ${S.sesion.bloques.length}` : ''}</span>
        <span class="apagado">⏱ <span id="idi-reloj">${reloj((Date.now() - S.t0) / 1000)}</span></span>
        <button id="idi-salir">Terminar</button></div>
      <div class="idi-pr-puntos">${S.items.map((x, j) => { const r = S.resultados.find((y) => y.indice === j); return `<i class="${r ? (r.ok ? 'ok' : 'mal') : j === S.i ? 'actual' : ''}"></i>`; }).join('')}</div>
      <div class="idi-ej-tarjeta">
        <p class="idi-ej-num">Ejercicio ${S.i + 1} de ${S.items.length} <span class="idi-ej-tipo">${esc(TIPO_EJ[it.tipo] || it.tipo)}</span></p>
        <p class="idi-enun">${esc(it.enunciado || '')}</p>
        ${campoEjercicio(it, hecho)}
        <div id="idi-veredicto">${hecho ? veredicto(hecho) : ''}</div>
        <div class="idi-ej-botones">${hecho ? `<button class="primario" id="idi-sig">${S.i + 1 < S.items.length ? 'Siguiente →' : 'Ver resultado'}</button>`
          : '<button class="primario" id="idi-comprobar">Comprobar</button><button id="idi-nose">No lo sé</button>'}</div>
      </div>
      <p class="apagado idi-mini centro">Intro = comprobar / siguiente</p>`;
    zona.querySelector('#idi-salir').onclick = () => terminar();
    const inp = zona.querySelector('#idi-resp');
    if (inp && !hecho) { inp.focus(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); comprobar(false); } }); }
    const c = zona.querySelector('#idi-comprobar'); if (c) c.onclick = () => comprobar(false);
    const n = zona.querySelector('#idi-nose'); if (n) n.onclick = () => { S.respuesta = ''; comprobar(true); };
    const s = zona.querySelector('#idi-sig'); if (s) { s.focus({ preventScroll: true }); s.onclick = siguiente; }
    zona.querySelectorAll('[data-decir]').forEach((vz) => vz.onclick = () => decir(vz.dataset.decir, l));
  }
  const TIPO_EJ = { hueco: 'Completa', eleccion: 'Elige', transformar: 'Transforma', corregir: 'Corrige', ordenar: 'Ordena' };

  /** Siempre se escribe la respuesta: en «elige» las opciones y en «ordena» las palabras se muestran solo como pista */
  function campoEjercicio(it, hecho) {
    const frase = esc(it.frase || '').replace('___', '<span class="idi-hueco">____</span>');
    let pistas = '';
    if (it.tipo === 'eleccion') {
      pistas = `<div class="idi-pistas"><small>Opciones (escríbela):</small>${(it.opciones || []).map((o) => `<span class="idi-pista ${hecho ? (hecho.respuestas.includes(o) ? 'ok' : normal(hecho.respuesta) === normal(o) ? 'mal' : '') : ''}">${esc(o)}</span>`).join('')}</div>`;
    } else if (it.tipo === 'ordenar') {
      pistas = `<div class="idi-pistas"><small>Palabras:</small>${(it.palabras || []).map((w) => `<span class="idi-pista">${esc(w)}</span>`).join('')}</div>`;
    }
    const pista = it.tipo === 'hueco' || it.tipo === 'eleccion' ? 'Escribe lo que va en el hueco' : it.tipo === 'ordenar' ? 'Escribe la frase ordenada' : 'Escribe la frase completa';
    return `${it.tipo === 'ordenar' ? '' : `<p class="idi-frase">${frase}</p>`}${pistas}<input id="idi-resp" class="idi-resp" type="text" autocomplete="off" spellcheck="false" placeholder="${pista}"
      value="${esc(hecho ? hecho.respuesta : S.respuesta || '')}" ${hecho ? 'disabled' : ''}>`;
  }
  const normal = (x) => String(x || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();

  function comprobar(enBlanco) {
    if (S.corrigiendo) return;
    const it = S.items[S.i];
    const inp = raiz.querySelector('#idi-resp'); const resp = inp ? inp.value : '';
    if (!enBlanco && !String(resp).trim()) return;
    S.corrigiendo = true;
    enviar({ tipo: 'idiResponder', clave: S.i, lengua: S.sesion.lengua, materia: it.materia, ejercicio: it.id, respuesta: enBlanco ? '' : resp });
    S.pendiente = enBlanco ? '' : resp;
  }

  function corregido(clave, r) {
    if (!S || clave !== S.i) return;
    const it = S.items[S.i];
    S.resultados.push({ indice: S.i, materia: it.materia, ejercicio: it.id, ok: r.ok, casi: r.casi, respuesta: S.pendiente, correcta: r.correcta,
      respuestas: r.respuestas, explicacion: r.explicacion, breve: r.breve, traduccion: r.traduccion, suya: r.suya, porOpcion: r.porOpcion,
      glosario: r.glosario || [], tipo: it.tipo, frase: it.frase || (it.palabras || []).join(' '), enunciado: it.enunciado });
    S.corrigiendo = false;
    pSesion();
  }
  /** Palabras de la respuesta del usuario que no están en la correcta (para señalarlas) */
  function marcarDiferencias(suya, buena) {
    const enBuena = new Set(normal(buena).split(' ').map((w) => w.replace(/[,;:]/g, '')));
    return String(suya).split(/(\s+)/).map((w) => (/^\s+$/.test(w) || !w || enBuena.has(normal(w).replace(/[,;:]/g, '')) ? esc(w) : `<span class="idi-dif">${esc(w)}</span>`)).join('');
  }
  const veredicto = (h) => {
    const buena = h.respuestas[0] || '';
    const completa = buena && /___/.test(h.frase || '') ? h.frase.replace('___', buena).replace(/\s*\([^)]*\)\s*([.!?…]?)\s*$/, '$1') : (h.tipo === 'ordenar' || h.tipo === 'transformar' || h.tipo === 'corregir' ? buena : '');
    const otras = h.respuestas.filter((x) => normal(x) !== normal(h.ok ? h.respuesta : buena));
    const titulo = h.ok ? '✓ Correcto' : h.casi ? '✗ Casi: revisa los acentos o las mayúsculas' : h.respuesta ? '✗ No es correcto' : 'La respuesta era…';
    const porQueSuya = h.suya ? `<div class="idi-ver-bloque suya"><h5>${h.ok ? '👍 Por qué tu respuesta es correcta' : `🔍 Por qué «${esc(h.respuesta)}» no vale`}</h5><p>${esc(h.suya)}</p></div>`
      : !h.ok && h.respuesta ? `<div class="idi-ver-bloque suya"><h5>🔍 Qué cambia respecto a la solución</h5>
        <p>${h.casi ? 'Las palabras son las correctas, pero falla algún acento o una mayúscula: en esta lengua el acento distingue palabras, así que cuenta como fallo.' : 'Las partes en rojo de tu respuesta no aparecen en la solución; compáralas con ella y relee la regla de abajo.'}</p></div>` : '';
    const opciones = h.porOpcion ? `<details class="idi-ver-bloque opciones" ${h.ok ? '' : 'open'}><summary>🔁 Todas las opciones, una a una</summary><ul>${Object.entries(h.porOpcion).map(([o, t]) => `<li class="${h.respuestas.includes(o) ? 'ok' : 'mal'}">
        <b>${h.respuestas.includes(o) ? '✓' : '✗'} ${esc(o)}</b> — ${esc(t)}</li>`).join('')}</ul></details>` : '';
    return `<div class="idi-ver ${h.ok ? 'ok' : 'mal'}">
      <div class="idi-ver-cab">${titulo}</div>
      <div class="idi-ver-par">
        ${h.respuesta ? `<div><small>Tu respuesta</small><span class="${h.ok ? 'idi-bien' : 'idi-tuya-mal'}">${h.ok ? esc(h.respuesta) : marcarDiferencias(h.respuesta, buena)}</span></div>` : ''}
        ${h.ok ? '' : `<div><small>Respuesta correcta</small><b class="idi-bien">${esc(buena)}</b></div>`}
        ${otras.length ? `<div><small>También vale</small>${otras.map((x) => `<b>${esc(x)}</b>`).join(' · ')}</div>` : ''}
      </div>
      ${completa ? `<div class="idi-ver-frase">${vozDisponible() ? `<button class="idi-voz" data-decir="${esc(completa)}" title="Escuchar la frase">🔊</button>` : ''}<span><b>${esc(completa)}</b>${h.traduccion ? `<br><span class="apagado">${esc(h.traduccion)}</span>` : ''}</span></div>` : ''}
      ${porQueSuya}
      ${h.explicacion ? `<div class="idi-ver-bloque regla"><h5>📐 La regla, aplicada a esta frase</h5><p>${esc(h.explicacion)}</p></div>` : ''}
      ${opciones}
      ${(h.glosario || []).length ? `<div class="idi-ver-bloque glosario"><h5>📖 Vocabulario</h5><div class="idi-glos">${h.glosario.map((g) => `<span><b>${esc(g.palabra)}</b> ${esc(g.significado)}</span>`).join('')}</div></div>` : ''}
    </div>`;
  };

  function siguiente() {
    S.respuesta = '';
    if (S.i + 1 < S.items.length) { S.i += 1; pSesion(); } else terminar();
  }

  function terminar() {
    clearInterval(tic);
    if (!S || !S.resultados.length) { S = null; return ir('inicio'); }
    const resultados = S.resultados.map(({ materia: mt, ejercicio, ok, respuesta, correcta, frase, enunciado }) => ({ materia: mt, ejercicio, ok, respuesta, correcta, frase, enunciado }));
    enviar({ tipo: 'idiTerminar', sesion: { id: S.sesion.id, lengua: S.sesion.lengua, tipo: S.sesion.tipo, inicio: S.sesion.inicio }, resultados, segundos: (Date.now() - S.t0) / 1000 });
  }

  function pFin() {
    const r = S ? S.resultados : [];
    const ok = r.filter((x) => x.ok).length;
    const pct = r.length ? Math.round((100 * ok) / r.length) : 0;
    const titulos = Object.fromEntries((S ? S.sesion.bloques : []).map((b) => [b.ficha.id, b.ficha.titulo_es || b.ficha.titulo]));
    raiz.innerHTML = `<div class="idi-centro idi-fin">
      <div class="idi-tarjeta-grande centro">
        <span class="idi-anillo grande" style="--p:${pct}"><b>${pct}%</b></span>
        <h2>${ok} de ${r.length} ${pct >= 90 ? '· ¡Excelente!' : pct >= 70 ? '· Bien' : pct >= 50 ? '· Vas por buen camino' : '· A repasar'}</h2>
        <p class="apagado">${S ? reloj((Date.now() - S.t0) / 1000) : ''} de práctica</p>
        <div class="idi-fin-fichas">${(fin && fin.resumen || []).map((x) => `<div><b>${esc(titulos[x.materia] || x.materia)}</b><span>${Math.round(100 * x.nota)} %</span>
          <span class="apagado">próximo repaso: ${new Date(x.proximo).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span></div>`).join('')}</div>
      </div>
      ${r.some((x) => !x.ok) ? `<section class="idi-caja"><h3>Para revisar</h3><div class="idi-errores-rejilla">${r.filter((x) => !x.ok).map((x) => `<div class="idi-error">
        <div class="idi-cu-frase">${esc(x.frase)}</div><div class="idi-err-mal">✗ ${esc(x.respuesta || '(en blanco)')}</div><div class="idi-err-bien">✓ ${esc(x.correcta)}</div>
        ${x.breve || x.explicacion ? `<div class="idi-err-nota">${esc(x.breve || x.explicacion)}</div>` : ''}
        ${x.breve && x.explicacion ? `<details class="idi-mini"><summary>Explicación completa</summary><p>${esc(x.explicacion)}</p></details>` : ''}</div>`).join('')}</div>
        <p class="apagado idi-mini">Estos errores quedan en tu cuaderno y volverán a salir en los próximos repasos.</p></section>` : ''}
      <p class="idi-acciones centro"><button class="primario" id="idi-volver">Volver al inicio</button></p></div>`;
    raiz.querySelector('#idi-volver').onclick = () => { S = null; fin = null; ir('inicio'); };
  }

  window.TCEE_IDI = { pintar, recibir };
})();
