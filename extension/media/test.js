// Panel Oposición, pestaña «Test»: practicar el primer ejercicio con el banco de preguntas (repositorio test).
// Modos: por tema o bloque, simulacro de examen, repaso de falladas y aleatorio. Las respuestas se guardan en progreso/test.
// Reglas: main/TEST.md
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const porCodigo = (a, b) => a.localeCompare(b, 'es', { numeric: true });
  const reloj = (seg) => { seg = Math.max(0, Math.round(seg)); const h = Math.floor(seg / 3600), m = Math.floor(seg / 60) % 60, s = seg % 60;
    return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`; };
  const num = (x, d = 2) => x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
  const barajar = (l) => { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MODOS = [['tema', 'Por tema o bloque'], ['simulacro', 'Simulacro de examen'], ['falladas', 'Repaso de falladas'], ['aleatorio', 'Aleatorio']];

  let B = null, H = [], imgBase = '', hayProgreso = true, pedido = false;
  let el = null, D = null, ctx = null, tic = null, confirmar = false, abiertas = {};
  const st = () => ctx.estado;

  /** Texto con fórmulas \( … \), \[ … \] o $$ … $$ renderizadas con KaTeX (el resto, escapado) */
  function tx(s) {
    const rx = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g;
    let out = '', ult = 0, m;
    while ((m = rx.exec(s || ''))) {
      out += esc(s.slice(ult, m.index));
      const f = m[1] || m[2] || m[3], disp = !m[1];
      try { out += window.katex ? window.katex.renderToString(f, { displayMode: disp, throwOnError: false, strict: 'ignore' }) : esc(m[0]); } catch (e) { out += esc(m[0]); }
      ult = rx.lastIndex;
    }
    return out + esc((s || '').slice(ult));
  }

  /** Texto sin marcas de fórmula, para los resúmenes de una línea */
  const plano = (s) => (s || '').replace(/\\[()[\]]/g, '').replace(/\\(frac|cdot|text|mathrm)\b/g, ' ').replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}^_$]/g, '').replace(/\s+/g, ' ');

  // ------------------------------------------------------------ datos derivados
  const porId = () => (B._porId || (B._porId = Object.fromEntries(B.preguntas.map((q) => [q.id, q]))));
  const bloques = () => (((D.bloques || {}).ejercicios || {})['3'] || {}).bloques || [];
  const bloqueDe = (tema) => bloques().find((b) => b.temas.includes(tema));
  const acierta = (q, r) => !!r && r.length > 0 && r.length === q.correctas.length && r.every((x) => q.correctas.includes(x));
  /** Última respuesta a cada pregunta (de todas las sesiones de todos los Mac): {id: {ok: true|false|null, fecha}} */
  function ultimas() {
    const u = {};
    for (const s of H) for (const r of s.respuestas || []) u[r.id] = { ok: r.ok, fecha: s.fecha };
    return u;
  }
  const falladas = (u) => B.preguntas.filter((q) => u[q.id] && u[q.id].ok !== true);
  const puntuar = (aciertos, errores) => { const p = (B.puntuacion || { acierto: 1, error: -1 / 3 }); return aciertos * p.acierto + errores * p.error; };

  // ------------------------------------------------------------ pintar
  function pintar(elemento, datos, contexto) {
    el = elemento; D = datos; ctx = contexto;
    clearInterval(tic); tic = null;
    if (!B) {
      if (!pedido) { pedido = true; ctx.enviar({ tipo: 'testCargar' }); }
      el.innerHTML = '<p class="vacio">Cargando el banco de preguntas…</p>';
      return;
    }
    if (B.vacio) {
      el.innerHTML = `<div class="cante-tarjeta aviso-instalar"><h3>Falta el banco de preguntas</h3>
        <p>No encuentro <code>TCEE/test/preguntas.json</code>. Pulsa <strong>Sincronizar</strong> en Acciones: la primera vez descarga el repositorio <em>test</em>. Después vuelve a esta pestaña.</p>
        <p><button data-t="recargar">Volver a buscar</button></p></div>`;
      el.querySelector('[data-t=recargar]').onclick = () => { B = null; pedido = false; pintar(el, D, ctx); };
      return;
    }
    const run = st().testRun;
    if (run && !run.fin) return pintarExamen(run);
    if (run && run.fin) return pintarResultado(run);
    pintarInicio();
  }

  // ------------------------------------------------------------ inicio
  function pintarInicio() {
    const s = st();
    s.testModo = s.testModo || 'tema';
    s.testSel = s.testSel || [];
    const u = ultimas();
    const cuenta = {}; B.preguntas.forEach((q) => { cuenta[q.tema] = (cuenta[q.tema] || 0) + 1; });
    const sel = new Set(s.testSel);
    const opciones = {
      tema: () => {
        const grupos = [...new Set(bloques().map((b) => b.grupo))];
        const nSel = B.preguntas.filter((q) => sel.has(q.tema) && (!s.testNuevas || !u[q.id])).length;
        return `<p class="apagado">Marca bloques enteros o despliega uno para elegir temas sueltos.</p>
          <div class="ts-bloques">${grupos.map((g) => `<h4 class="tb-grupo">${esc(g)}</h4>${bloques().filter((b) => b.grupo === g).map((b) => {
            const n = b.temas.reduce((a, t) => a + (cuenta[t] || 0), 0);
            const todos = b.temas.filter((t) => cuenta[t]).every((t) => sel.has(t)) && n > 0;
            const algunos = b.temas.some((t) => sel.has(t));
            const ab = abiertas[b.id];
            return `<div class="ts-bloque" style="--b:${esc(b.color || 'var(--acento)')}">
              <div class="ts-bfila"><button class="ts-mini" data-abrir-b="${esc(b.id)}" aria-expanded="${!!ab}">${ab ? '▾' : '▸'}</button>
                <label><input type="checkbox" data-bloque="${esc(b.id)}" ${todos ? 'checked' : ''} ${n ? '' : 'disabled'}> <span class="tb-punto"></span> ${esc(b.nombre)}</label>
                <span class="apagado">${n} preguntas</span>${algunos && !todos ? '<span class="etiqueta">parcial</span>' : ''}</div>
              ${ab ? `<div class="ts-temas">${b.temas.map((t) => `<label class="${cuenta[t] ? '' : 'apagado'}"><input type="checkbox" data-tema="${esc(t)}" ${sel.has(t) ? 'checked' : ''} ${cuenta[t] ? '' : 'disabled'}> ${esc(t)} <span class="apagado">${esc(titulo(t))} · ${cuenta[t] || 0}</span></label>`).join('')}</div>` : ''}
            </div>`;
          }).join('')}`).join('')}</div>
          <div class="ts-fila">
            <label><input type="checkbox" data-op="testNuevas" ${s.testNuevas ? 'checked' : ''}> Solo preguntas que nunca he respondido</label>
            <label>Máximo <input type="number" min="1" data-op="testN" value="${esc(s.testN || '')}" placeholder="todas"> preguntas</label>
          </div>
          ${correccion()}
          ${empezar(nSel ? Math.min(nSel, Number(s.testN) || nSel) : 0)}`;
      },
      simulacro: () => {
        const ex = B.examenes || [];
        const e = s.testExamen || '';
        const n = e ? B.preguntas.filter((q) => q.examen === e).length : Number(s.testNsim) || 50;
        const min = s.testMin != null && s.testMin !== '' ? Number(s.testMin) : Math.round(n * 1.2);
        return `<label class="cante-campo">Examen<select data-op="testExamen">
            <option value="" ${e ? '' : 'selected'}>Mezclado: preguntas al azar de todas las convocatorias</option>
            ${[...ex].reverse().map((x) => `<option value="${esc(x.nombre)}" ${x.nombre === e ? 'selected' : ''}>${esc(x.nombre.replace('Examen oficial de ', ''))} · ${x.preguntas} preguntas</option>`).join('')}</select></label>
          ${e ? '<p class="apagado">Solo están las preguntas de ese examen que tienes clasificadas en algún tema: no es el examen completo.</p>'
            : `<label class="cante-campo">Número de preguntas<input type="number" min="1" max="${B.preguntas.length}" data-op="testNsim" value="${esc(s.testNsim || 50)}"></label>`}
          <label class="cante-campo">Tiempo límite (minutos; 0 = sin límite)<input type="number" min="0" data-op="testMin" value="${esc(min)}"></label>
          <p class="apagado">Corrección al final. Cada acierto suma 1 y cada error resta 1/3; en blanco no cuenta.</p>
          ${empezar(Math.min(n, B.preguntas.length))}`;
      },
      falladas: () => {
        const f = falladas(u);
        return `<p>${f.length ? `Tienes <strong>${f.length}</strong> preguntas cuya última respuesta fue un error o quedó en blanco.` : 'No tienes preguntas falladas pendientes.'}</p>
          <p class="apagado">Al acertarlas dejan de aparecer aquí.</p>
          <div class="ts-fila"><label>Máximo <input type="number" min="1" data-op="testNf" value="${esc(s.testNf || '')}" placeholder="todas"> preguntas</label></div>
          ${correccion()}${empezar(f.length ? Math.min(f.length, Number(s.testNf) || f.length) : 0)}`;
      },
      aleatorio: () => `<div class="ts-fila"><label>Número de preguntas <input type="number" min="1" max="${B.preguntas.length}" data-op="testNa" value="${esc(s.testNa || 20)}"></label></div>
        ${correccion()}${empezar(Math.min(Number(s.testNa) || 20, B.preguntas.length))}`,
    };
    el.innerHTML = `<div class="ts">
      <section class="cante-tarjeta ts-nueva"><h3>Nueva prueba</h3>
        <div class="segmentos ts-modos" role="radiogroup">${MODOS.map(([k, t]) => `<button role="radio" aria-checked="${s.testModo === k}" class="${s.testModo === k ? 'activo' : ''}" data-modo="${k}">${t}</button>`).join('')}</div>
        <div class="ts-opciones">${opciones[s.testModo]()}</div>
      </section>
      <aside class="ts-lado">${estadisticas(u)}</aside></div>`;
    conectarInicio();
  }
  const titulo = (t) => { const x = (D.temas || []).find((y) => y.codigo === t); return x ? x.titulo : ''; };
  const correccion = () => {
    const c = st().testCorr || 'momento';
    return `<div class="ts-fila"><span>Corrección:</span>
      <label><input type="radio" name="corr" data-corr="momento" ${c === 'momento' ? 'checked' : ''}> al momento, pregunta a pregunta</label>
      <label><input type="radio" name="corr" data-corr="final" ${c === 'final' ? 'checked' : ''}> al final</label></div>`;
  };
  const empezar = (n) => `<p><button class="primario grande" data-t="empezar" ${n ? '' : 'disabled'}>Empezar${n ? ` (${n} preguntas)` : ''}</button></p>`;

  function estadisticas(u) {
    const total = B.preguntas.length;
    const vistas = B.preguntas.filter((q) => u[q.id]);
    const bien = vistas.filter((q) => u[q.id].ok === true).length;
    const fil = bloques().map((b) => {
      const qs = B.preguntas.filter((q) => b.temas.includes(q.tema));
      if (!qs.length) return '';
      const ok = qs.filter((q) => u[q.id] && u[q.id].ok === true).length, ko = qs.filter((q) => u[q.id] && u[q.id].ok !== true).length;
      return `<div class="ts-est" style="--b:${esc(b.color || 'var(--acento)')}"><span class="ts-est-n">${esc(b.nombre)}</span>
        <span class="ts-apilada" title="${ok} acertadas · ${ko} falladas o en blanco · ${qs.length - ok - ko} sin hacer"><span class="ok" style="width:${(ok / qs.length) * 100}%"></span><span class="ko" style="width:${(ko / qs.length) * 100}%"></span></span>
        <span class="apagado num">${ok + ko ? Math.round((ok / (ok + ko)) * 100) : 0} %</span></div>`;
    }).join('');
    const ses = [...H].reverse().slice(0, 12);
    return `<section class="cante-tarjeta"><h3>Tu progreso</h3>
        <p><strong>${vistas.length}</strong> de ${total} preguntas respondidas alguna vez · <strong>${vistas.length ? Math.round((bien / vistas.length) * 100) : 0} %</strong> acertadas en tu último intento.</p>
        <p class="apagado ts-leyenda"><i class="ok"></i> acertada <i class="ko"></i> fallada o en blanco <i></i> sin hacer · el % es sobre las respondidas</p>
        ${fil}
        ${hayProgreso ? '' : '<p class="rel-div es-error">Falta la carpeta «progreso»: tus respuestas no se guardarán.</p>'}</section>
      <section class="cante-tarjeta"><h3>Últimas pruebas</h3>${ses.length ? `<table class="temas ts-ses"><tbody>${ses.map((x) => `<tr>
        <td class="nowrap">${esc(new Date(x.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</td><td>${esc(x.titulo)}</td>
        <td class="num"><strong>${num(x.resumen.nota10)}</strong></td><td class="num apagado">${x.resumen.aciertos}/${x.resumen.n}</td>
        <td><button class="ts-mini" data-borrar="${esc(x.id)}" title="Borrar del historial">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="apagado">Aún no has hecho ninguna.</p>'}</section>`;
  }

  function conectarInicio() {
    const s = st();
    el.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { s.testModo = b.dataset.modo; ctx.guardar(); pintarInicio(); });
    el.querySelectorAll('[data-abrir-b]').forEach((b) => b.onclick = () => { abiertas[b.dataset.abrirB] = !abiertas[b.dataset.abrirB]; pintarInicio(); });
    el.querySelectorAll('[data-bloque]').forEach((c) => c.onchange = () => {
      const b = bloques().find((x) => x.id === c.dataset.bloque); const sel = new Set(s.testSel);
      b.temas.forEach((t) => (c.checked ? sel.add(t) : sel.delete(t))); s.testSel = [...sel]; ctx.guardar(); pintarInicio();
    });
    el.querySelectorAll('[data-tema]').forEach((c) => c.onchange = () => {
      const sel = new Set(s.testSel); c.checked ? sel.add(c.dataset.tema) : sel.delete(c.dataset.tema); s.testSel = [...sel]; ctx.guardar(); pintarInicio();
    });
    el.querySelectorAll('[data-op]').forEach((i) => {
      const k = i.dataset.op;
      if (i.type === 'checkbox') i.onchange = () => { s[k] = i.checked; ctx.guardar(); pintarInicio(); };
      else if (i.tagName === 'SELECT') i.onchange = () => { s[k] = i.value; s.testMin = null; ctx.guardar(); pintarInicio(); };
      else i.onchange = () => { s[k] = i.value; ctx.guardar(); pintarInicio(); };
    });
    el.querySelectorAll('[data-corr]').forEach((r) => r.onchange = () => { s.testCorr = r.dataset.corr; ctx.guardar(); });
    el.querySelectorAll('[data-borrar]').forEach((b) => b.onclick = () => ctx.enviar({ tipo: 'testBorrar', id: b.dataset.borrar }));
    const e = el.querySelector('[data-t=empezar]'); if (e) e.onclick = comenzar;
  }

  function comenzar() {
    const s = st(), u = ultimas();
    let qs, titulo_, limite = 0, corr = s.testCorr || 'momento';
    if (s.testModo === 'tema') {
      const sel = new Set(s.testSel);
      qs = barajar(B.preguntas.filter((q) => sel.has(q.tema) && (!s.testNuevas || !u[q.id])));
      if (Number(s.testN)) qs = qs.slice(0, Number(s.testN));
      const bs = bloques().filter((b) => b.temas.filter((t) => B.preguntas.some((q) => q.tema === t)).every((t) => sel.has(t)) && b.temas.some((t) => sel.has(t)));
      titulo_ = bs.length && bs.length <= 2 ? bs.map((b) => b.nombre).join(' + ') : sel.size <= 3 ? [...sel].sort(porCodigo).join(', ') : `${sel.size} temas`;
    } else if (s.testModo === 'simulacro') {
      corr = 'final';
      if (s.testExamen) { qs = B.preguntas.filter((q) => q.examen === s.testExamen).sort((a, b) => (a.numero || 0) - (b.numero || 0)); titulo_ = `Simulacro · ${s.testExamen.replace('Examen oficial de ', '')}`; }
      else { qs = barajar(B.preguntas).slice(0, Number(s.testNsim) || 50); titulo_ = 'Simulacro mezclado'; }
      const min = s.testMin != null && s.testMin !== '' ? Number(s.testMin) : Math.round(qs.length * 1.2);
      limite = Math.max(0, min) * 60;
    } else if (s.testModo === 'falladas') {
      qs = barajar(falladas(u)); if (Number(s.testNf)) qs = qs.slice(0, Number(s.testNf)); titulo_ = 'Repaso de falladas';
    } else { qs = barajar(B.preguntas).slice(0, Number(s.testNa) || 20); titulo_ = 'Aleatorio'; }
    if (!qs.length) return;
    s.testRun = { id: `t${Date.now().toString(36)}`, modo: s.testModo, titulo: titulo_, inicio: Date.now(), limite, correccion: corr,
      ids: qs.map((q) => q.id), resp: {}, comprobadas: {}, i: 0, fin: null };
    confirmar = false; ctx.guardar(); pintar(el, D, ctx);
  }

  // ------------------------------------------------------------ examen
  function pintarExamen(run) {
    const q = porId()[run.ids[run.i]];
    if (!q) { run.ids = run.ids.filter((id) => porId()[id]); run.i = Math.min(run.i, run.ids.length - 1); if (!run.ids.length) { st().testRun = null; ctx.guardar(); return pintar(el, D, ctx); } return pintarExamen(run); }
    const r = run.resp[q.id] || [];
    const visto = run.correccion === 'momento' && run.comprobadas[q.id];
    const b = bloqueDe(q.tema);
    const multi = q.tipo === 'multi' || q.correctas.length > 1;
    const estadoN = (id, k) => {
      const qq = porId()[id], rr = run.resp[id];
      const cls = [k === run.i ? 'actual' : ''];
      if (run.correccion === 'momento' && run.comprobadas[id]) cls.push(acierta(qq, rr) ? 'ok' : rr && rr.length ? 'ko' : 'blanco');
      else if (rr && rr.length) cls.push('resp');
      return cls.join(' ');
    };
    const sinResp = run.ids.filter((id) => !(run.resp[id] || []).length).length;
    el.innerHTML = `<div class="ts-run">
      <div class="ts-barra"><strong>${esc(run.titulo)}</strong><span class="apagado">Pregunta ${run.i + 1} de ${run.ids.length}</span>
        <span id="ts-reloj" class="ts-reloj"></span>
        ${confirmar ? `<span class="ts-confirma">${run.correccion === 'momento' ? (run.ids.length - Object.keys(run.comprobadas).length ? `Las ${run.ids.length - Object.keys(run.comprobadas).length} que no has comprobado no contarán. ` : '') : sinResp ? `Te quedan ${sinResp} sin responder: contarán en blanco. ` : ''}¿Terminar y corregir? <button class="primario" data-t="fin-si">Sí, terminar</button> <button data-t="fin-no">Seguir</button></span>`
          : '<button data-t="terminar">Terminar</button>'}</div>
      <div class="ts-cuerpo">
        <article class="ts-preg" style="--b:${esc((b && b.color) || 'var(--acento)')}">
          <p class="ts-meta"><span class="tb-cod">${esc(q.tema)}</span> ${b ? `<span class="tb-punto"></span> <span class="apagado">${esc(b.nombre)}</span>` : ''}
            ${visto || run.fin ? `<span class="apagado ts-origen">${esc(q.examen || '')}${q.numero ? ` · pregunta ${q.numero}` : ''}</span>` : ''}</p>
          <div class="ts-enun">${tx(q.enunciado)}</div>
          ${q.imagen && !q.imagen_falta ? `<img class="ts-img" src="${esc(`${imgBase}/${q.imagen}`)}" alt="Imagen de la pregunta">` : q.imagen ? '<p class="rel-div es-error">Esta pregunta usa una imagen que no está en el banco.</p>' : ''}
          ${multi ? '<p class="apagado">Hay más de una respuesta correcta: márcalas todas.</p>' : ''}
          <div class="ts-ops">${q.opciones.map((o) => {
            const marcada = r.includes(o.id);
            let cls = marcada ? 'marcada' : '';
            if (visto) cls = q.correctas.includes(o.id) ? 'correcta' : marcada ? 'erronea' : 'apagada';
            return `<button class="ts-op ${cls}" data-op-id="${esc(o.id)}" ${visto ? 'disabled' : ''}><span class="ts-letra">${esc(o.id)}</span><span>${tx(o.text)}</span></button>`;
          }).join('')}</div>
          ${visto ? `<p class="ts-veredicto ${acierta(q, r) ? 'ok' : r.length ? 'ko' : ''}">${acierta(q, r) ? '✓ Correcta' : r.length ? `✗ Incorrecta: la respuesta es ${q.correctas.join(', ')}` : `En blanco: la respuesta es ${q.correctas.join(', ')}`}</p>
            ${q.justificacion ? `<div class="ts-just">${tx(q.justificacion)}</div>` : ''}` : ''}
          <div class="ts-nav">
            <button data-t="ant" ${run.i ? '' : 'disabled'}>← Anterior</button>
            ${visto ? '' : `<button data-t="blanco" ${r.length ? '' : 'disabled'}>Borrar respuesta</button>`}
            <span class="ts-esp"></span>
            ${run.correccion === 'momento' && !visto ? `<button class="primario" data-t="comprobar">${r.length ? 'Comprobar' : 'Dejar en blanco'}</button>`
              : run.i < run.ids.length - 1 ? '<button class="primario" data-t="sig">Siguiente →</button>' : '<button class="primario" data-t="terminar">Terminar</button>'}
          </div>
          <p class="apagado ts-atajos">Teclado: A–D o 1–4 para marcar · Intro para seguir · ← → para moverte</p>
        </article>
        <aside class="ts-mapa">${run.ids.map((id, k) => `<button class="${estadoN(id, k)}" data-ir="${k}">${k + 1}</button>`).join('')}</aside>
      </div></div>`;
    const ponerReloj = () => {
      const t = (Date.now() - run.inicio) / 1000, x = document.getElementById('ts-reloj'); if (!x) return;
      if (run.limite) { const resta = run.limite - t; x.textContent = `⏱ ${reloj(resta)}`; x.classList.toggle('poco', resta < 300); if (resta <= 0) terminar(); }
      else x.textContent = `⏱ ${reloj(t)}`;
    };
    ponerReloj(); tic = setInterval(ponerReloj, 1000);
    el.querySelectorAll('[data-op-id]').forEach((o) => o.onclick = () => marcar(o.dataset.opId));
    el.querySelectorAll('[data-ir]').forEach((o) => o.onclick = () => { run.i = Number(o.dataset.ir); confirmar = false; guardarRun(); });
    const on = (k, f) => { const x = el.querySelector(`[data-t=${k}]`); if (x) x.onclick = f; };
    on('ant', () => mover(-1)); on('sig', () => mover(1)); on('blanco', () => { delete run.resp[q.id]; guardarRun(); });
    on('comprobar', () => { run.comprobadas[q.id] = true; guardarRun(); });
    on('terminar', () => { confirmar = true; pintarExamen(run); }); on('fin-no', () => { confirmar = false; pintarExamen(run); }); on('fin-si', terminar);
  }
  const runActual = () => ctx && st().testRun && !st().testRun.fin ? st().testRun : null;
  function guardarRun() { ctx.guardar(); clearInterval(tic); pintarExamen(st().testRun); }
  function mover(d) { const run = runActual(); if (!run) return; run.i = Math.max(0, Math.min(run.ids.length - 1, run.i + d)); confirmar = false; guardarRun(); }
  function marcar(letra) {
    const run = runActual(); if (!run) return;
    const q = porId()[run.ids[run.i]];
    if (run.correccion === 'momento' && run.comprobadas[q.id]) return;
    if (!q.opciones.some((o) => o.id === letra)) return;
    const multi = q.tipo === 'multi' || q.correctas.length > 1;
    const r = run.resp[q.id] || [];
    run.resp[q.id] = multi ? (r.includes(letra) ? r.filter((x) => x !== letra) : [...r, letra].sort()) : (r[0] === letra ? [] : [letra]);
    guardarRun();
  }
  function terminar() {
    const run = runActual(); if (!run) return;
    clearInterval(tic);
    // con corrección al momento solo cuentan las preguntas comprobadas: las que no llegaste a ver no son fallos.
    // En corrección al final (y en simulacro) cuentan todas, como en el examen: las no contestadas van en blanco.
    run.contadas = run.correccion === 'momento' ? run.ids.filter((id) => run.comprobadas[id]) : [...run.ids];
    if (!run.contadas.length) { st().testRun = null; confirmar = false; ctx.guardar(); return pintar(el, D, ctx); }
    run.fin = Date.now();
    const respuestas = run.contadas.map((id) => { const q = porId()[id], r = run.resp[id] || []; return { id, r, ok: r.length ? acierta(q, r) : null }; });
    const aciertos = respuestas.filter((x) => x.ok === true).length, errores = respuestas.filter((x) => x.ok === false).length, n = respuestas.length;
    const puntos = puntuar(aciertos, errores);
    run.resumen = { n, aciertos, errores, blancos: n - aciertos - errores, puntos: Math.round(puntos * 100) / 100, nota10: Math.round((Math.max(0, puntos) / n) * 1000) / 100 };
    ctx.enviar({ tipo: 'testGuardar', sesion: { id: run.id, fecha: new Date(run.inicio).toISOString(), modo: run.modo, titulo: run.titulo,
      duracion: Math.round((run.fin - run.inicio) / 1000), correccion: run.correccion, respuestas, resumen: run.resumen } });
    confirmar = false; ctx.guardar(); pintar(el, D, ctx);
  }

  // ------------------------------------------------------------ resultado
  function pintarResultado(run) {
    const R = run.resumen;
    const filas = (run.contadas || run.ids).map((id) => ({ k: run.ids.indexOf(id), q: porId()[id], r: run.resp[id] || [] })).filter((x) => x.q);
    const porBloque = {};
    filas.forEach(({ q, r }) => { const b = bloqueDe(q.tema); const k = b ? b.nombre : 'Sin bloque';
      const o = porBloque[k] || (porBloque[k] = { color: b && b.color, n: 0, ok: 0, ko: 0 }); o.n++; if (r.length) acierta(q, r) ? o.ok++ : o.ko++; });
    const f = st().testFiltroRes || 'todas';
    const ver = filas.filter(({ q, r }) => f === 'todas' || (f === 'falladas' ? !acierta(q, r) : acierta(q, r)));
    el.innerHTML = `<div class="ts-res">
      <section class="cante-tarjeta ts-nota">
        <div><span class="ts-grande">${num(R.nota10)}</span><span class="apagado"> / 10</span></div>
        <div class="ts-cifras"><span><strong>${num(R.puntos)}</strong> puntos de ${R.n}</span>
          <span class="ok">✓ ${R.aciertos} aciertos</span><span class="ko">✗ ${R.errores} errores</span><span class="apagado">○ ${R.blancos} en blanco</span>
          <span class="apagado">⏱ ${reloj((run.fin - run.inicio) / 1000)}</span></div>
        <p class="apagado">${esc(run.titulo)} · acierto +1, error −1/3, en blanco 0 · nota = puntos / preguntas × 10</p>
        <p class="cante-botones"><button class="primario" data-t="nueva">Nueva prueba</button>
          ${R.errores + R.blancos ? '<button data-t="repasar">Repasar las falladas de esta prueba</button>' : ''}</p>
      </section>
      <section class="cante-tarjeta"><h3>Por bloque</h3>${Object.entries(porBloque).map(([nombre, o]) => `<div class="ts-est" style="--b:${esc(o.color || 'var(--acento)')}">
        <span class="ts-est-n">${esc(nombre)}</span><span class="ts-apilada"><span class="ok" style="width:${(o.ok / o.n) * 100}%"></span><span class="ko" style="width:${(o.ko / o.n) * 100}%"></span></span>
        <span class="apagado num">${o.ok}/${o.n}</span></div>`).join('')}</section>
      <section class="cante-tarjeta"><h3>Revisión</h3>
        <div class="segmentos">${[['todas', 'Todas'], ['falladas', 'Falladas y en blanco'], ['bien', 'Acertadas']].map(([k, t]) => `<button class="${f === k ? 'activo' : ''}" data-filtro="${k}">${t}</button>`).join('')}</div>
        <div class="ts-rev">${ver.map(({ k, q, r }) => {
          const ok = acierta(q, r), abierta = abiertas[`r${q.id}`];
          return `<div class="ts-rev-item ${ok ? 'ok' : r.length ? 'ko' : 'blanco'}">
            <button class="ts-rev-cab" data-rev="${esc(q.id)}"><span class="ts-rev-icono">${ok ? '✓' : r.length ? '✗' : '○'}</span><span class="tb-cod">${k + 1}. ${esc(q.tema)}</span>
              <span class="ts-rev-txt">${esc(plano(q.enunciado))}</span></button>
            ${abierta ? `<div class="ts-rev-det"><div class="ts-enun">${tx(q.enunciado)}</div>
              ${q.imagen && !q.imagen_falta ? `<img class="ts-img" src="${esc(`${imgBase}/${q.imagen}`)}" alt="">` : ''}
              <div class="ts-ops">${q.opciones.map((o) => `<div class="ts-op ${q.correctas.includes(o.id) ? 'correcta' : r.includes(o.id) ? 'erronea' : 'apagada'}"><span class="ts-letra">${esc(o.id)}</span><span>${tx(o.text)}${r.includes(o.id) ? ' <em class="apagado">(tu respuesta)</em>' : ''}</span></div>`).join('')}</div>
              ${q.justificacion ? `<div class="ts-just">${tx(q.justificacion)}</div>` : ''}
              <p class="apagado">${esc(q.examen || '')}${q.numero ? ` · pregunta ${q.numero}` : ''} · <a data-abrir="${esc(q.tema)}">abrir el tema ${esc(q.tema)}</a></p></div>` : ''}</div>`;
        }).join('') || '<p class="apagado">Ninguna.</p>'}</div></section></div>`;
    el.querySelector('[data-t=nueva]').onclick = () => { st().testRun = null; ctx.guardar(); pintar(el, D, ctx); };
    const rep = el.querySelector('[data-t=repasar]');
    if (rep) rep.onclick = () => {
      const ids = filas.filter(({ q, r }) => !acierta(q, r)).map(({ q }) => q.id);
      st().testRun = { id: `t${Date.now().toString(36)}`, modo: 'falladas', titulo: 'Repaso de la prueba anterior', inicio: Date.now(), limite: 0, correccion: 'momento',
        ids: barajar(ids), resp: {}, comprobadas: {}, i: 0, fin: null };
      ctx.guardar(); pintar(el, D, ctx);
    };
    el.querySelectorAll('[data-filtro]').forEach((b) => b.onclick = () => { st().testFiltroRes = b.dataset.filtro; ctx.guardar(); pintarResultado(run); });
    el.querySelectorAll('[data-rev]').forEach((b) => b.onclick = () => { const k = `r${b.dataset.rev}`; abiertas[k] = !abiertas[k]; pintarResultado(run); });
    el.querySelectorAll('[data-abrir]').forEach((a) => a.onclick = () => ctx.enviar({ tipo: 'abrir', codigo: a.dataset.abrir }));
  }

  // atajos de teclado durante una prueba
  document.addEventListener('keydown', (e) => {
    const run = runActual();
    if (!run || !el || !el.isConnected || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target.tagName || ''))) return;
    const k = e.key.toUpperCase();
    if ('ABCD'.includes(k) && k.length === 1) { marcar(k); e.preventDefault(); }
    else if ('1234'.includes(k) && k.length === 1) { marcar('ABCD'[Number(k) - 1]); e.preventDefault(); }
    else if (e.key === 'ArrowRight') mover(1);
    else if (e.key === 'ArrowLeft') mover(-1);
    else if (e.key === 'Enter') {
      const q = porId()[run.ids[run.i]];
      if (run.correccion === 'momento' && !run.comprobadas[q.id]) { run.comprobadas[q.id] = true; guardarRun(); }
      else if (run.i < run.ids.length - 1) mover(1);
      else { confirmar = true; pintarExamen(run); }
      e.preventDefault();
    }
  });

  window.TCEE_TEST = {
    pintar,
    recibir(m) {
      if (m.tipo === 'testDatos') { B = m.banco || { vacio: true }; H = m.historial || []; imgBase = m.imgBase || ''; hayProgreso = m.hayProgreso !== false; }
      if (m.tipo === 'testHistorial') H = m.historial || [];
      if (el && el.isConnected && ctx && st().pestana === 'test') pintar(el, D, ctx);
    },
  };
})();
