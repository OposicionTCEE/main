// Panel Oposición, pestaña «Temas»: una carta por tema, agrupadas por bloque (config/bloques.json).
// Se elige el ejercicio (3º o 4º) y las partes (A, B o ambas). Sin bloques definidos (4º), se agrupa por parte.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const porCodigo = (a, b) => a.localeCompare(b, 'es', { numeric: true });
  const horas = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };
  const color = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : 'var(--acento)');

  function pintar(el, D, ctx) {
    const st = ctx.estado;
    if (!st.temasEj) st.temasEj = '3';
    if (!Array.isArray(st.temasPartes) || !st.temasPartes.length) st.temasPartes = ['A', 'B'];
    st.temasCerrados = st.temasCerrados || {};
    const ej = st.temasEj, partes = st.temasPartes, f = (st.filtro || '').toLowerCase();
    const porCod = Object.fromEntries(D.temas.map((t) => [t.codigo, t]));
    const ejercicios = [...new Set(D.temas.map((t) => t.codigo[0]))].sort();
    if (!ejercicios.includes(ej) && ejercicios.length) st.temasEj = ejercicios[0];

    const visible = (codigo) => codigo[0] === st.temasEj && partes.includes(codigo[2])
      && (!f || `${codigo} ${(porCod[codigo] || {}).titulo || ''} ${(porCod[codigo] || {}).completo || ''}`.toLowerCase().includes(f));

    // bloques del ejercicio elegido; los temas sin bloque van a «Otros temas»; sin bloques definidos, uno por parte
    const def = ((D.bloques && D.bloques.ejercicios) || {})[st.temasEj];
    let grupos;
    if (def && def.bloques && def.bloques.length) {
      const asignados = new Set(def.bloques.flatMap((b) => b.temas));
      const sueltos = D.temas.filter((t) => t.codigo[0] === st.temasEj && !asignados.has(t.codigo)).map((t) => t.codigo).sort(porCodigo);
      const orden = def.grupos || [...new Set(def.bloques.map((b) => b.grupo))];
      grupos = orden.map((g) => ({ nombre: g, bloques: def.bloques.filter((b) => b.grupo === g) }));
      if (sueltos.length) grupos.push({ nombre: 'Sin bloque', bloques: [{ id: 'otros', nombre: 'Otros temas', temas: sueltos }] });
    } else {
      grupos = [{ nombre: '', bloques: ['A', 'B'].map((p) => ({ id: `parte-${p}`, nombre: `Parte ${p}`, color: p === 'A' ? '#4a78b5' : '#5a9a6b',
        temas: D.temas.filter((t) => t.codigo.startsWith(`${st.temasEj}.${p}`)).map((t) => t.codigo).sort(porCodigo) })) }];
    }

    // resumen de lo que se ve
    const vistos = D.temas.filter((t) => visible(t.codigo));
    const pend = vistos.filter((t) => !t.hecho);
    const resumen = `${vistos.length} temas · ${vistos.length - pend.length} hechos · ${horas(vistos.reduce((s, t) => s + t.minutos, 0))} restantes`;

    const bloqueHtml = (b) => {
      const codigos = b.temas.filter(visible);
      if (!codigos.length) return '';
      const temas = codigos.map((c) => porCod[c]).filter(Boolean);
      const hechos = temas.filter((t) => t.hecho).length;
      const resta = temas.reduce((s, t) => s + t.minutos, 0);   // los hechos valen 0 salvo errores de test
      const cerrado = !!st.temasCerrados[`${st.temasEj}:${b.id}`];
      return `<section class="tb-bloque" style="--b:${color(b.color)}">
        <button class="tb-cab" data-plegar="${esc(`${st.temasEj}:${b.id}`)}" aria-expanded="${!cerrado}">
          <span class="tb-flecha">${cerrado ? '▸' : '▾'}</span><span class="tb-punto"></span>
          <span class="tb-nombre">${esc(b.nombre)}</span>
          <span class="tb-cifras">${hechos} / ${codigos.length} hechos${resta ? ` · ${esc(horas(resta))}` : ''}</span>
          <span class="tb-barra" title="${codigos.length ? Math.round((hechos / codigos.length) * 100) : 0} % hecho"><span style="width:${codigos.length ? (hechos / codigos.length) * 100 : 0}%"></span></span>
        </button>
        ${cerrado ? '' : `<div class="tb-cartas">${codigos.map((c) => carta(c, porCod[c])).join('')}</div>`}</section>`;
    };

    const carta = (c, t) => {
      if (!t) return `<div class="tb-carta falta"><div class="tb-fila"><span class="tb-cod">${esc(c)}</span></div><p class="tb-tit apagado">Sin carpeta en el temario</p></div>`;
      return `<article class="tb-carta ${t.hecho && !t.minutos ? 'hecho' : ''}" data-abrir="${esc(c)}" tabindex="0" title="${esc(t.completo || t.titulo)}">
        <div class="tb-fila"><span class="tb-cod">${esc(c)}</span>
          <label class="tb-hecho" title="Listo para pasar a estudiar sobre esquema"><input type="checkbox" data-hecho="${esc(c)}" ${t.hecho ? 'checked' : ''}> Hecho</label></div>
        <p class="tb-tit">${esc(t.titulo)}</p>
        ${t.errTest ? `<span class="tb-errtest" title="Preguntas de test de este tema cuya última respuesta fue un error: cuentan como trabajo pendiente">✗ ${t.errTest} ${t.errTest === 1 ? 'error' : 'errores'} de test</span>` : ''}
        <div class="tb-pie">${t.hecho && !t.minutos ? '<span class="tb-ok">✓ Listo para estudiar</span>'
          : `<span class="pct ancho"><span style="width:${t.pct}%"></span></span><span class="tb-tiempo">${esc(t.tiempo)} · ${t.pct} %</span>`}</div>
      </article>`;
    };

    const cuerpo = grupos.map((g) => {
      const html = g.bloques.map(bloqueHtml).join('');
      return html ? `${g.nombre ? `<h2 class="tb-grupo">${esc(g.nombre)}</h2>` : ''}<div class="tb-bloques">${html}</div>` : '';
    }).join('');

    el.innerHTML = `
      <div class="tb-controles">
        <div class="segmentos" role="radiogroup" aria-label="Ejercicio">${ejercicios.map((e) => `<button role="radio" aria-checked="${e === st.temasEj}" class="${e === st.temasEj ? 'activo' : ''}" data-ej="${e}">${e}º ejercicio</button>`).join('')}</div>
        <div class="segmentos" role="group" aria-label="Partes">${['A', 'B'].map((p) => `<button aria-pressed="${partes.includes(p)}" class="${partes.includes(p) ? 'activo' : ''}" data-parte="${p}">Parte ${p}</button>`).join('')}</div>
        <input id="filtro" type="search" placeholder="Buscar por código o palabras del título…" value="${esc(st.filtro || '')}">
        <span class="apagado tb-resumen">${esc(resumen)}</span>
      </div>
      ${cuerpo || '<p class="vacio">No hay temas con esos filtros.</p>'}`;

    el.querySelectorAll('[data-ej]').forEach((b) => b.onclick = () => { st.temasEj = b.dataset.ej; ctx.guardar(); pintar(el, D, ctx); });
    el.querySelectorAll('[data-parte]').forEach((b) => b.onclick = () => {
      const p = b.dataset.parte;
      // al menos una parte: pulsar la única activa no la apaga
      st.temasPartes = partes.includes(p) ? (partes.length > 1 ? partes.filter((x) => x !== p) : partes) : [...partes, p].sort();
      ctx.guardar(); pintar(el, D, ctx);
    });
    el.querySelectorAll('[data-plegar]').forEach((b) => b.onclick = () => {
      const k = b.dataset.plegar; st.temasCerrados[k] = !st.temasCerrados[k]; ctx.guardar(); pintar(el, D, ctx);
    });
    const inp = el.querySelector('#filtro');
    inp.oninput = () => { st.filtro = inp.value; ctx.guardar(); pintar(el, D, ctx); const i = el.querySelector('#filtro'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    el.querySelectorAll('[data-hecho]').forEach((c) => {
      c.onclick = (ev) => ev.stopPropagation();
      c.onchange = () => ctx.enviar({ tipo: 'hecho', codigo: c.dataset.hecho, valor: c.checked });
    });
    el.querySelectorAll('.tb-hecho').forEach((l) => l.onclick = (ev) => ev.stopPropagation());
    el.querySelectorAll('article[data-abrir]').forEach((a) => {
      a.onclick = () => ctx.enviar({ tipo: 'abrir', codigo: a.dataset.abrir });
      a.onkeydown = (ev) => { if (ev.key === 'Enter') ctx.enviar({ tipo: 'abrir', codigo: a.dataset.abrir }); };
    });
  }

  window.TCEE_TEMAS = { pintar };
})();
