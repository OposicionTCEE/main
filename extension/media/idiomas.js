// Panel Oposición, pestaña «Idiomas»: academia continua de inglés y segundo idioma (A1→C2). Fase 1: perfil, ajustes, compromisos,
// sesiones de gramática, léxico, repaso y al azar, mapa de materias, cuaderno de errores y nivel estimado. Reglas: main/IDIOMAS.md
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const DESC_NIVEL = {
    A1: 'Frases muy básicas: presentarte, pedir algo sencillo.', A2: 'Situaciones cotidianas: compras, viajes, trabajo sencillo.',
    B1: 'Te desenvuelves: cuentas experiencias y das opiniones sencillas.', B2: 'Sigues debates y artículos; argumentas con cierta soltura.',
    C1: 'Textos largos y complejos; te expresas con fluidez y precisión.', C2: 'Lo entiendes prácticamente todo; matizas como un nativo.',
  };
  const BLOQUES = [['gramatica', 'Gramática'], ['lexico', 'Léxico'], ['fonetica', 'Fonética'], ['destrezas', 'Destrezas']];
  const TIPOS = [
    ['gramatica', 'Gramática', 'La ficha que más te conviene ahora, con ejercicios.'],
    ['lexico', 'Léxico', 'Vocabulario y expresiones por tema o función.'],
    ['repaso', 'Repaso', 'Fichas cuyo repaso ha vencido.'],
    ['azar', 'Al azar', 'Dos fichas elegidas según tus puntos débiles.'],
    ['escrito', 'Escrito', 'Próximamente (fase 2).', true], ['escucha', 'Escucha', 'Próximamente (fase 2).', true],
    ['oral', 'Oral', 'Próximamente (fase 3).', true], ['examen', 'Tipo examen', 'Próximamente (fase 3).', true],
  ];
  const ESTADO = { nueva: ['Nueva', ''], aprendiendo: ['Aprendiendo', 'apr'], dominada: ['Dominada', 'dom'], repasar: ['Para repasar', 'rep'] };
  const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  let X = null;            // datos de la extensión
  let el = null, ctx = null, pedido = false;
  let vista = 'inicio';    // inicio | ajustes | ficha | sesion | fin | nuevo
  let fichaAbierta = null, S = null, fin = null, tic = null;
  const st = () => ctx.estado;
  const lengua = () => (X && X.perfil ? (st().idiLengua && [ 'en', X.perfil.segundo ].includes(st().idiLengua) ? st().idiLengua : 'en') : 'en');
  const enviar = (m) => ctx.enviar(m);

  function recibir(m) {
    if (m.tipo === 'idiDatos') { X = m.datos; if (!X.perfil) vista = 'nuevo'; else if (vista === 'nuevo') vista = 'inicio'; pintarAqui(); }
    if (m.tipo === 'idiFicha') { fichaAbierta = m.ficha; vista = 'ficha'; pintarAqui(); }
    if (m.tipo === 'idiSesion') { empezarSesion(m.sesion); }
    if (m.tipo === 'idiCorreccion') { corregido(m.clave, m.resultado); }
    if (m.tipo === 'idiFin') { fin = m.fin; vista = 'fin'; pintarAqui(); }
  }
  const pintarAqui = () => { if (el && document.body.contains(el)) pintarVista(); };

  function pintar(e, D, c) {
    el = e; ctx = c;
    if (!pedido) { pedido = true; enviar({ tipo: 'idiCargar' }); }
    pintarVista();
  }

  function pintarVista() {
    if (!X) { el.innerHTML = '<p class="vacio">Cargando idiomas…</p>'; return; }
    if (!X.hayPaquete) {
      el.innerHTML = `<div class="idi"><h2>Idiomas</h2><p class="vacio">Falta el paquete de contenido. Ejecuta la tarea <b>Sincronizar</b>
        (descarga la carpeta <code>idiomas</code>) y vuelve a abrir esta pestaña.</p><button id="idi-recargar">Volver a mirar</button></div>`;
      el.querySelector('#idi-recargar').onclick = () => enviar({ tipo: 'idiCargar' });
      return;
    }
    if (!X.perfil || vista === 'nuevo') return pNuevo();
    ({ inicio: pInicio, ajustes: pAjustes, ficha: pFicha, sesion: pSesion, fin: pFin })[vista]();
  }

  // ------------------------------------------------------------------ primer uso: perfil
  function pNuevo() {
    const borrador = st().idiBorrador || { nombre: '', segundo: 'fr', niveles: { en: 'B1', fr: 'B1' }, compromisos: [] };
    el.innerHTML = `<div class="idi idi-nuevo">
      <h2>Bienvenido a Idiomas</h2>
      <p class="ayuda">Tu perfil y todo tu progreso se guardan solo en este Mac, en la carpeta <code>TCEE/idiomas-&lt;nombre&gt;</code>.
        El nivel que indiques es orientativo: el panel lo irá ajustando con tus resultados y te avisará si encaja mejor otro.</p>
      <label class="idi-campo">Nombre <input id="idi-nombre" type="text" value="${esc(borrador.nombre)}" placeholder="Tu nombre"></label>
      <label class="idi-campo">Segundo idioma <select id="idi-segundo">${Object.entries(X.lenguas).filter(([k]) => k !== 'en').map(([k, v]) => `<option value="${k}" ${borrador.segundo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <span class="apagado">El inglés es obligatorio.</span></label>
      <h3>Tu nivel aproximado</h3>
      <div class="idi-niveles">${['en', borrador.segundo].map((l) => `<div><b>${X.lenguas[l]}</b>${selectorNivel(`idi-nv-${l}`, borrador.niveles[l] || 'B1')}</div>`).join('')}</div>
      <h3>Compromiso (opcional)</h3>
      <p class="ayuda">Puedes no poner ninguno: siempre podrás empezar una sesión cuando quieras. También se cambia luego en Ajustes.</p>
      <div id="idi-reglas"></div>
      <p><button class="primario" id="idi-crear">Crear perfil</button></p></div>`;
    pintarReglas(el.querySelector('#idi-reglas'), borrador.compromisos, () => {});
    const leerBorrador = () => {
      borrador.nombre = el.querySelector('#idi-nombre').value; borrador.segundo = el.querySelector('#idi-segundo').value;
      for (const l of ['en', borrador.segundo]) { const s = el.querySelector(`#idi-nv-${l}`); if (s) borrador.niveles[l] = s.value; }
      st().idiBorrador = borrador; ctx.guardar();
    };
    el.querySelectorAll('input,select').forEach((i) => i.addEventListener('change', leerBorrador));
    el.querySelector('#idi-segundo').onchange = () => { leerBorrador(); pNuevo(); };
    el.querySelector('#idi-crear').onclick = () => { leerBorrador(); enviar({ tipo: 'idiCrearPerfil', perfil: borrador }); delete st().idiBorrador; ctx.guardar(); };
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
      <label>· <input type="number" min="0" max="600" step="5" data-k="minutos" value="${r.minutos || ''}" placeholder="—"> min (vacío = sin duración)</label>
      <button data-quitar="${i}" title="Quitar">✕</button></div>`;
    const repintar = () => {
      cont.innerHTML = `${reglas.map(fila).join('') || '<p class="apagado">Sin compromisos: sesiones cuando quieras.</p>'}
        <button id="idi-nueva-regla">+ Añadir compromiso</button>`;
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

  // ------------------------------------------------------------------ inicio
  function pInicio() {
    const l = lengua(), P = X.perfil, paq = X.paquetes[l] || { materias: [] };
    const nvDecl = (P.idiomas[l] || {}).nivel || 'B1';
    const est = X.nivel[l] || {};
    const filtro = st().idiBloque || 'gramatica';
    el.innerHTML = `<div class="idi">
      <div class="idi-cab">
        <div class="idi-lenguas">${['en', P.segundo].map((k) => `<button class="${k === l ? 'primario' : ''}" data-lengua="${k}">${esc(X.lenguas[k])}</button>`).join('')}</div>
        <span class="apagado">Perfil: <b>${esc(P.nombre)}</b> · nivel indicado ${esc(nvDecl)}</span>
        <button id="idi-ajustes">⚙ Ajustes</button>
      </div>
      ${avisosNivel(l, nvDecl, est)}
      ${compromisosHtml()}
      <h3>Empezar sesión ahora</h3>
      <div class="idi-tipos">${TIPOS.map(([k, t, d, off]) => `<button class="idi-tipo" data-tipo="${k}" ${off ? 'disabled' : ''}>
        <b>${t}${k === 'repaso' && X.pendientes[l] ? ` (${X.pendientes[l]})` : ''}</b><small>${d}</small></button>`).join('')}</div>
      <h3>Mapa de materias</h3>
      <div class="idi-filtros">${BLOQUES.map(([k, t]) => `<button class="${k === filtro ? 'primario' : ''}" data-bloque="${k}">${t}</button>`).join('')}
        <span class="idi-leyenda">${Object.values(ESTADO).map(([t, c]) => `<i class="idi-m ${c}"></i>${t}`).join('')}<i class="idi-m sin"></i>Ficha en preparación</span></div>
      <div class="idi-mapa">${NIVELES.map((n) => {
        const ms = paq.materias.filter((m) => m.bloque === filtro && m.nivel === n);
        return ms.length ? `<div class="idi-col"><div class="idi-niv ${n === nvDecl ? 'actual' : ''}">${n}</div>${ms.map((m) => {
          const [, c] = ESTADO[m.estado] || ESTADO.nueva;
          return `<button class="idi-m ${m.ficha ? c : 'sin'}" data-materia="${esc(m.id)}" ${m.ficha ? '' : 'disabled'} title="${esc(m.descripcion_es || m.descripcion)}">${esc(m.titulo_es || m.titulo)}</button>`;
        }).join('')}</div>` : '';
      }).join('')}</div>
      ${cuadernoHtml(l)}
      ${historialHtml(l)}
    </div>`;
    el.querySelectorAll('[data-lengua]').forEach((b) => b.onclick = () => { st().idiLengua = b.dataset.lengua; ctx.guardar(); pInicio(); });
    el.querySelectorAll('[data-bloque]').forEach((b) => b.onclick = () => { st().idiBloque = b.dataset.bloque; ctx.guardar(); pInicio(); });
    el.querySelector('#idi-ajustes').onclick = () => { vista = 'ajustes'; pintarVista(); };
    el.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => enviar({ tipo: 'idiEmpezar', lengua: l, clase: b.dataset.tipo }));
    el.querySelectorAll('[data-materia]').forEach((b) => b.onclick = () => enviar({ tipo: 'idiFicha', lengua: l, id: b.dataset.materia }));
    el.querySelectorAll('[data-practicar-errores]').forEach((b) => b.onclick = () => enviar({ tipo: 'idiEmpezar', lengua: l, clase: 'errores', materia: b.dataset.practicarErrores }));
    el.querySelectorAll('[data-descartar]').forEach((b) => b.onclick = () => { const [materia, ejercicio] = b.dataset.descartar.split('|'); enviar({ tipo: 'idiDescartarError', materia, ejercicio }); });
    el.querySelectorAll('[data-ajustar-nivel]').forEach((b) => b.onclick = () => enviar({ tipo: 'idiGuardarPerfil', cambios: { idiomas: { [l]: { nivel: b.dataset.ajustarNivel } } } }));
  }

  /** Aviso cuando el nivel estimado (gramática o léxico) difiere del indicado, y huecos de niveles inferiores */
  function avisosNivel(l, decl, est) {
    const out = [];
    for (const [b, t] of [['gramatica', 'gramática'], ['lexico', 'léxico']]) {
      const e = est[b]; if (!e) continue;
      if (e.nivel && e.nivel !== decl) {
        const sube = NIVELES.indexOf(e.nivel) > NIVELES.indexOf(decl);
        out.push(`<div class="idi-aviso">Tus resultados en <b>${t}</b> (${e.materias} materias trabajadas) encajan mejor con <b>${e.nivel}</b> que con ${decl}.
          ${sube ? 'Podrías subir el material.' : 'Conviene reforzar la base.'} <button data-ajustar-nivel="${e.nivel}">Cambiar mi nivel a ${e.nivel}</button></div>`);
      }
      if (e.huecos && e.huecos.length) out.push(`<div class="idi-aviso suave">En ${t} hay ${e.huecos.length} materia(s) de niveles inferiores que aún flojean: aparecerán antes en tus sesiones.</div>`);
    }
    return out.join('');
  }

  function compromisosHtml() {
    const cs = X.compromisos || [];
    if (!cs.length) return '<p class="apagado idi-sin-reglas">Sin compromisos fijados: practica cuando quieras. (Se añaden en ⚙ Ajustes.)</p>';
    return `<div class="idi-reglas-estado">${cs.map((c) => {
      const pct = c.regla.minutos ? Math.min(100, Math.round(100 * c.minutos / c.regla.minutos)) : (c.cumplido ? 100 : 0);
      return `<div class="idi-regla-est ${c.cumplido ? 'ok' : c.tocaHoy ? 'hoy' : ''}"><b>${esc(c.texto)}</b>
        <span>${c.regla.minutos ? `${c.minutos} de ${c.regla.minutos} min` : `${c.sesiones} sesión(es)`} ${c.regla.cada === 'dia' ? 'hoy' : `del ${fecha(c.desde)} al ${fecha(c.hasta)}`}${c.cumplido ? ' ✓' : c.tocaHoy ? ' · toca hoy' : ''}</span>
        <div class="carga"><span style="width:${pct}%"></span></div></div>`;
    }).join('')}</div>`;
  }
  const fecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); };

  function cuadernoHtml(l) {
    const errs = (X.errores || []).filter((e) => e.lengua === l);
    if (!errs.length) return '';
    const porMateria = {};
    for (const e of errs) (porMateria[e.materia] = porMateria[e.materia] || []).push(e);
    const titulo = (id) => { const m = (X.paquetes[l] || { materias: [] }).materias.find((x) => x.id === id); return m ? (m.titulo_es || m.titulo) : id; };
    return `<h3>Cuaderno de errores <span class="apagado">(${errs.length})</span></h3>
      <div class="idi-cuaderno">${Object.entries(porMateria).sort((a, b) => b[1].length - a[1].length).map(([id, es]) => `<details>
        <summary><b>${esc(titulo(id))}</b> · ${es.length} error(es) <button data-practicar-errores="${esc(id)}">Practicar</button></summary>
        <ul>${es.map((e) => `<li><span class="idi-mal">${esc(e.respuesta || '(en blanco)')}</span> → <span class="idi-bien">${esc(e.correcta)}</span>
          <span class="apagado">${esc(e.frase || '')}${e.veces > 1 ? ` · ${e.veces} veces` : ''}</span>
          <a data-descartar="${esc(id)}|${esc(e.ejercicio)}" title="Quitar del cuaderno">quitar</a></li>`).join('')}</ul></details>`).join('')}</div>`;
  }

  function historialHtml(l) {
    const ss = (X.sesiones || []).filter((s) => s.lengua === l).slice(-8).reverse();
    if (!ss.length) return '';
    const T = Object.fromEntries(TIPOS.map(([k, t]) => [k, t]));
    return `<h3>Últimas sesiones</h3><ul class="idi-hist">${ss.map((s) => `<li>${new Date(s.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
      · ${esc(T[s.tipo] || (s.tipo === 'ficha' ? 'Ficha' : s.tipo === 'errores' ? 'Errores' : s.tipo))} · ${s.aciertos}/${s.ejercicios} · ${Math.round(s.minutos)} min</li>`).join('')}</ul>`;
  }

  // ------------------------------------------------------------------ ajustes
  function pAjustes() {
    const P = JSON.parse(JSON.stringify(X.perfil));
    P.compromisos = P.compromisos || []; P.medios = P.medios || []; P.ajustes = P.ajustes || {};
    el.innerHTML = `<div class="idi idi-ajustes">
      <p><a id="idi-volver">← Volver</a></p><h2>Ajustes de idiomas</h2>
      <h3>Perfil</h3>
      <p>Nombre: <b>${esc(P.nombre)}</b> · carpeta <code>${esc(X.perfiles.find((p) => p.nombre === P.nombre) ? X.perfiles.find((p) => p.nombre === P.nombre).dir : '')}</code>
        ${X.perfiles.length > 1 ? ` · cambiar a <select id="idi-perfil">${X.perfiles.map((p) => `<option value="${esc(p.dir)}" ${p.nombre === P.nombre ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>` : ''}
        · <a id="idi-otro">crear otro perfil</a></p>
      <h3>Nivel orientativo</h3>
      <div class="idi-niveles">${['en', P.segundo].map((l) => `<div><b>${X.lenguas[l]}</b>${selectorNivel(`idi-nv-${l}`, (P.idiomas[l] || {}).nivel || 'B1')}</div>`).join('')}</div>
      <h3>Compromisos</h3><div id="idi-reglas"></div>
      <h3>Sesiones</h3>
      <label class="idi-campo">Ejercicios por sesión <input type="number" id="idi-n" min="4" max="40" value="${P.ajustes.ejercicios || 10}"></label>
      <h3>Medios de suscripción (fase 4)</h3>
      <p class="ayuda">Un enlace por línea (por ejemplo, la sección de un periódico). Solo se descargarán estos, una vez por semana, desde tu navegador
        y con tu sesión iniciada; se borran al renovarse y no salen de este Mac. El riesgo frente a las condiciones de uso de cada medio es tuyo.</p>
      <textarea id="idi-medios" rows="4" placeholder="https://www.economist.com/finance-and-economics">${esc(P.medios.join('\n'))}</textarea>
      <p><button class="primario" id="idi-guardar">Guardar</button></p></div>`;
    pintarReglas(el.querySelector('#idi-reglas'), P.compromisos, () => {});
    el.querySelector('#idi-volver').onclick = () => { vista = 'inicio'; pintarVista(); };
    el.querySelector('#idi-otro').onclick = () => { vista = 'nuevo'; pintarVista(); };
    const sp = el.querySelector('#idi-perfil'); if (sp) sp.onchange = () => enviar({ tipo: 'idiElegirPerfil', dir: sp.value });
    el.querySelector('#idi-guardar').onclick = () => {
      const idiomas = {}; for (const l of ['en', P.segundo]) idiomas[l] = { nivel: el.querySelector(`#idi-nv-${l}`).value };
      const medios = el.querySelector('#idi-medios').value.split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
      enviar({ tipo: 'idiGuardarPerfil', cambios: { idiomas, compromisos: P.compromisos, medios, ajustes: { ejercicios: Number(el.querySelector('#idi-n').value) || 10 } } });
      vista = 'inicio';
    };
  }

  // ------------------------------------------------------------------ ficha (estudio)
  function explicacionHtml(f) {
    return `${(f.explicacion || []).map((b) => b.tipo === 'texto' ? `<p>${esc(b.texto)}</p>`
      : b.tipo === 'lista' ? `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
        : `<table class="idi-tabla"><thead><tr>${b.cabecera.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.filas.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}
      ${(f.ejemplos || []).length ? `<h4>Ejemplos</h4><ul class="idi-ejemplos">${f.ejemplos.map((e) => `<li><b>${esc(e.frase)}</b> <span class="apagado">${esc(e.traduccion || '')}</span></li>`).join('')}</ul>` : ''}
      ${(f.errores_hispanohablantes || []).length ? `<h4>Errores típicos de hispanohablantes</h4><ul class="idi-ejemplos">${f.errores_hispanohablantes.map((e) => `<li><span class="idi-mal">${esc(e.mal)}</span> → <span class="idi-bien">${esc(e.bien)}</span> <span class="apagado">${esc(e.nota || '')}</span></li>`).join('')}</ul>` : ''}
      ${fuenteHtml(f.fuente)}`;
  }
  const fuenteHtml = (fu) => (fu && fu.nombre && fu.nombre !== 'propia'
    ? `<p class="apagado idi-fuente">Fuente: ${esc(fu.nombre)}${fu.autores ? `, ${esc(fu.autores)}` : ''}${fu.licencia ? ` (${esc(fu.licencia)})` : ''}${fu.url ? ` · ${esc(fu.url)}` : ''}</p>` : '');

  function pFicha() {
    const f = fichaAbierta;
    if (!f) { vista = 'inicio'; return pintarVista(); }
    const r = (X.registros || {})[f.id];
    el.innerHTML = `<div class="idi idi-ficha"><p><a id="idi-volver">← Volver</a></p>
      <h2>${esc(f.titulo_es || f.titulo)} <span class="idi-nivel">${esc(f.nivel)}</span></h2>
      <p class="idi-resumen">${esc(f.resumen || '')}</p>
      ${r && r.notas ? `<p class="apagado">Trabajada ${r.sesiones} vez/veces · última nota ${Math.round(100 * r.notas[r.notas.length - 1])} %${r.due ? ` · próximo repaso ${new Date(r.due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}</p>` : ''}
      ${explicacionHtml(f)}
      <p><button class="primario" id="idi-practicar">Practicar esta ficha</button></p></div>`;
    el.querySelector('#idi-volver').onclick = () => { vista = 'inicio'; pintarVista(); };
    el.querySelector('#idi-practicar').onclick = () => enviar({ tipo: 'idiEmpezar', lengua: lengua(), clase: 'ficha', materia: f.id });
  }

  // ------------------------------------------------------------------ sesión
  function empezarSesion(sesion) {
    S = { sesion, i: 0, resultados: [], t0: Date.now(), corrigiendo: false, respuesta: '', orden: [], verFicha: sesion.tipo === 'ficha' ? false : sesion.tipo !== 'repaso' };
    S.items = sesion.bloques.flatMap((b, k) => b.ejercicios.map((e) => ({ ...e, materia: b.ficha.id, k })));
    vista = 'sesion';
    clearInterval(tic); tic = setInterval(() => { const r = el && el.querySelector('#idi-reloj'); if (r) r.textContent = reloj((Date.now() - S.t0) / 1000); }, 1000);
    pintarVista();
  }
  const reloj = (seg) => { seg = Math.round(seg); return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`; };

  function pSesion() {
    if (!S) { vista = 'inicio'; return pintarVista(); }
    const it = S.items[S.i];
    const b = S.sesion.bloques[it.k];
    const hecho = S.resultados.find((r) => r.indice === S.i);
    el.innerHTML = `<div class="idi idi-sesion">
      <div class="idi-cab"><b>${esc(b.ficha.titulo_es || b.ficha.titulo)}</b> <span class="idi-nivel">${esc(b.ficha.nivel)}</span>
        <span class="apagado">Ejercicio ${S.i + 1} de ${S.items.length} · <span id="idi-reloj">${reloj((Date.now() - S.t0) / 1000)}</span></span>
        <button id="idi-ver-ficha">${S.verFicha ? 'Ocultar la ficha' : 'Ver la ficha'}</button> <button id="idi-salir">Terminar</button></div>
      ${S.verFicha ? `<div class="idi-ficha-mini">${explicacionHtml(b.ficha)}</div>` : ''}
      <div class="idi-ej">
        <p class="idi-enun">${esc(it.enunciado || '')}</p>
        ${campoEjercicio(it, hecho)}
        <div id="idi-veredicto">${hecho ? veredicto(hecho) : ''}</div>
      </div>
      <p>${hecho ? `<button class="primario" id="idi-sig">${S.i + 1 < S.items.length ? 'Siguiente →' : 'Ver resultado'}</button>` : `${it.tipo === 'eleccion' ? '' : '<button class="primario" id="idi-comprobar">Comprobar</button> '}<button id="idi-nose">No lo sé</button>`}</p>
    </div>`;
    el.querySelector('#idi-ver-ficha').onclick = () => { S.verFicha = !S.verFicha; pSesion(); };
    el.querySelector('#idi-salir').onclick = () => terminar();
    const inp = el.querySelector('#idi-resp');
    if (inp && !hecho) { inp.focus(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); comprobar(); } }); }
    el.querySelectorAll('[data-op]').forEach((o) => o.onclick = () => { if (hecho) return; S.respuesta = o.dataset.op; comprobar(); });
    el.querySelectorAll('[data-pal]').forEach((o) => o.onclick = () => { if (hecho) return; S.orden.push(Number(o.dataset.pal)); pSesion(); });
    const deshacer = el.querySelector('#idi-deshacer'); if (deshacer) deshacer.onclick = () => { S.orden.pop(); pSesion(); };
    const c = el.querySelector('#idi-comprobar'); if (c) c.onclick = () => comprobar(false);
    const n = el.querySelector('#idi-nose'); if (n) n.onclick = () => { S.respuesta = ''; comprobar(true); };
    const s = el.querySelector('#idi-sig'); if (s) { s.focus(); s.onclick = siguiente; }
  }

  function campoEjercicio(it, hecho) {
    const frase = esc(it.frase || '').replace('___', '<span class="idi-hueco">____</span>');
    if (it.tipo === 'eleccion') {
      return `<p class="idi-frase">${frase}</p><div class="idi-ops">${(it.opciones || []).map((o) => `<button data-op="${esc(o)}" class="${hecho && hecho.respuesta === o ? (hecho.ok ? 'ok' : 'mal') : ''}" ${hecho ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>`;
    }
    if (it.tipo === 'ordenar') {
      const usadas = new Set(S.orden);
      return `<p class="idi-frase idi-construida">${S.orden.map((i) => esc(it.palabras[i])).join(' ') || '<span class="apagado">Pulsa las palabras en orden…</span>'}</p>
        <div class="idi-ops">${(it.palabras || []).map((p, i) => `<button data-pal="${i}" ${usadas.has(i) || hecho ? 'disabled' : ''}>${esc(p)}</button>`).join('')}
        ${!hecho && S.orden.length ? '<button id="idi-deshacer">↶</button>' : ''}</div>`;
    }
    // hueco, transformar, corregir: se escribe la respuesta
    const pista = it.tipo === 'hueco' ? 'Escribe lo que va en el hueco' : 'Escribe la frase completa';
    return `<p class="idi-frase">${frase}</p><input id="idi-resp" type="text" autocomplete="off" spellcheck="false" placeholder="${pista}"
      value="${esc(hecho ? hecho.respuesta : S.respuesta || '')}" ${hecho ? 'disabled' : ''}>`;
  }

  function comprobar(enBlanco) {
    if (S.corrigiendo) return;
    const it = S.items[S.i];
    let resp = S.respuesta;
    if (it.tipo === 'ordenar') resp = S.orden.map((i) => it.palabras[i]).join(' ');
    else if (it.tipo !== 'eleccion') { const inp = el.querySelector('#idi-resp'); resp = inp ? inp.value : ''; }
    if (!enBlanco && !String(resp).trim()) return;
    S.corrigiendo = true;
    enviar({ tipo: 'idiResponder', clave: S.i, lengua: S.sesion.lengua, materia: it.materia, ejercicio: it.id, respuesta: enBlanco ? '' : resp });
    S.pendiente = enBlanco ? '' : resp;
  }

  function corregido(clave, r) {
    if (!S || clave !== S.i) return;
    const it = S.items[S.i];
    S.resultados.push({ indice: S.i, materia: it.materia, ejercicio: it.id, ok: r.ok, casi: r.casi, respuesta: S.pendiente, correcta: r.correcta,
      respuestas: r.respuestas, explicacion: r.explicacion, frase: it.frase || (it.palabras || []).join(' '), enunciado: it.enunciado });
    S.corrigiendo = false;
    pSesion();
  }
  const veredicto = (h) => `<div class="idi-ver ${h.ok ? 'ok' : 'mal'}"><b>${h.ok ? '✓ Correcto' : h.casi ? '✗ Casi: revisa acentos o mayúsculas' : h.respuesta ? '✗ No es correcto' : 'Respuesta'}</b>
    ${h.ok && h.respuestas.length < 2 ? '' : `<div>${h.ok ? 'También valdría' : 'Correcto'}: ${h.respuestas.filter((x) => !h.ok || x !== h.respuesta).map((x) => `<b>${esc(x)}</b>`).join(' · ')}</div>`}
    ${h.explicacion ? `<div class="apagado">${esc(h.explicacion)}</div>` : ''}</div>`;

  function siguiente() {
    S.respuesta = ''; S.orden = [];
    if (S.i + 1 < S.items.length) { S.i += 1; pSesion(); } else terminar();
  }

  function terminar() {
    clearInterval(tic);
    if (!S || !S.resultados.length) { S = null; vista = 'inicio'; return pintarVista(); }
    const resultados = S.resultados.map(({ materia, ejercicio, ok, respuesta, correcta, frase, enunciado }) => ({ materia, ejercicio, ok, respuesta, correcta, frase, enunciado }));
    enviar({ tipo: 'idiTerminar', sesion: { id: S.sesion.id, lengua: S.sesion.lengua, tipo: S.sesion.tipo, inicio: S.sesion.inicio }, resultados, segundos: (Date.now() - S.t0) / 1000 });
  }

  function pFin() {
    const r = S ? S.resultados : [];
    const ok = r.filter((x) => x.ok).length;
    const titulos = Object.fromEntries((S ? S.sesion.bloques : []).map((b) => [b.ficha.id, b.ficha.titulo_es || b.ficha.titulo]));
    el.innerHTML = `<div class="idi idi-fin"><h2>Sesión terminada: ${ok} de ${r.length}</h2>
      <ul>${(fin && fin.resumen || []).map((x) => `<li><b>${esc(titulos[x.materia] || x.materia)}</b>: ${Math.round(100 * x.nota)} % · próximo repaso
        ${new Date(x.proximo).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</li>`).join('')}</ul>
      ${r.some((x) => !x.ok) ? `<h3>Para revisar</h3><ul class="idi-ejemplos">${r.filter((x) => !x.ok).map((x) => `<li>${esc(x.frase)}<br>
        <span class="idi-mal">${esc(x.respuesta || '(en blanco)')}</span> → <span class="idi-bien">${esc(x.correcta)}</span> <span class="apagado">${esc(x.explicacion || '')}</span></li>`).join('')}</ul>
        <p class="apagado">Estos errores quedan en tu cuaderno y volverán a salir en los próximos repasos.</p>` : ''}
      <p><button class="primario" id="idi-volver">Volver al inicio</button></p></div>`;
    el.querySelector('#idi-volver').onclick = () => { S = null; fin = null; vista = 'inicio'; pintarVista(); };
  }

  window.TCEE_IDI = { pintar, recibir };
})();
