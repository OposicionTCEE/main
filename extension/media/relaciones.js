// Pestaña «Relaciones» (lado de la página): mapa de temas unidos por modelos a la izquierda; a la derecha,
// los modelos del tema abierto con los desarrollos de los otros temas, o las recomendaciones de armonización.
// Lo usa panel.js: window.TCEE_REL.pintar(el, D, ctx)
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinEj = (c) => c.replace(/^[34]\./, '');
  let ctx = null, D = null, el = null;
  let detalle = null;           // último detalle recibido {familia, informe, temas}
  let posiciones = null;
  const PRIO_TXT = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja', 'sin informe': 'Sin informe' };

  /** Ecuación con KaTeX (sin conexión); si no se puede dibujar, se enseña el código */
  function mate(tex) {
    try { return window.katex.renderToString(tex, { displayMode: true, throwOnError: true, strict: 'ignore', output: 'html' }); }
    catch (e) { return `<pre class="tex" title="No se pudo dibujar esta ecuación">${esc(tex)}</pre>`; }
  }

  function pintar(contenedor, datos, c) {
    ctx = c; D = datos; el = contenedor;
    const st = ctx.estado, R = D.relaciones;
    if (!st.relModo) st.relModo = R.abierto ? 'tema' : 'recom';
    if (st.relModo === 'tema' && !R.abierto) st.relModo = 'recom';
    // en modo tema, el modelo elegido debe ser del tema abierto
    if (st.relModo === 'tema' && R.abierto && !R.modelosAbierto.some((m) => m.familia === st.relFamilia)) st.relFamilia = R.modelosAbierto[0] ? R.modelosAbierto[0].familia : null;
    const fam = st.relModo === 'tema' ? st.relFamilia : st.relDetalleFam;
    el.innerHTML = `<div class="rel">
      <div class="rel-mapa">${mapa(fam)}</div>
      <aside class="rel-lado">${lado()}</aside>
    </div>`;
    conectar();
    if (fam && (!detalle || detalle.familia !== fam)) { detalle = null; ctx.enviar({ tipo: 'relDetalle', familia: fam }); }
  }

  // ------------------------------------------------------------ mapa (izquierda)
  function mapa(fam) {
    const M = D.mapa, R = D.relaciones;
    const conAristas = new Set(M.aristas.flatMap((a) => [a.a, a.b]));
    const nodos = M.nodos.filter((n) => conAristas.has(n.codigo));
    const aristas = M.aristas;
    const W = 900, H = 720;
    if (!posiciones || posiciones.n !== nodos.length) posiciones = { n: nodos.length, p: disponer(nodos, aristas, W, H) };
    const pos = posiciones.p;
    const ab = R.abierto;
    const vecinos = new Set(ab ? aristas.filter((a) => a.a === ab || a.b === ab).flatMap((a) => [a.a, a.b]) : []);
    const conFam = new Set(fam ? nodos.filter((n) => n.modelos.includes(fam)).map((n) => n.codigo) : []);
    const foco = ab && conAristas.has(ab);
    const clsN = (n) => [
      'nodo', `p${n.parte.replace('.', '')}`,
      n.codigo === ab ? 'abierto' : '', vecinos.has(n.codigo) ? 'vecino' : '', conFam.has(n.codigo) ? 'con-modelo' : '',
      foco && !vecinos.has(n.codigo) && n.codigo !== ab ? 'lejano' : '',
    ].filter(Boolean).join(' ');
    const clsA = (a) => [(ab && (a.a === ab || a.b === ab)) ? 'del-abierto' : foco ? 'lejana' : '', fam && a.familias.includes(fam) ? 'del-modelo' : ''].filter(Boolean).join(' ');
    return `<svg class="rel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de temas unidos por modelos que comparten">
      <g>${aristas.map((a) => `<line class="${clsA(a)}" x1="${pos[a.a].x}" y1="${pos[a.a].y}" x2="${pos[a.b].x}" y2="${pos[a.b].y}" stroke-width="${Math.min(6, 1 + a.familias.length)}"><title>${esc(a.a)} – ${esc(a.b)}: ${esc(a.familias.join(', '))}</title></line>`).join('')}</g>
      <g>${nodos.map((n) => `<g class="${clsN(n)}" data-abrir="${esc(n.codigo)}" transform="translate(${pos[n.codigo].x},${pos[n.codigo].y})">
        <circle r="${n.codigo === ab ? 13 : 8 + Math.min(6, n.modelos.length)}"></circle><text dy="-14">${esc(n.codigo)}</text>
        <title>${esc(n.codigo)} ${esc(n.titulo)}${n.modelos.length ? `\nModelos: ${esc(n.modelos.join(', '))}` : ''}</title></g>`).join('')}</g>
    </svg>
    <p class="rel-leyenda">${[...new Set(nodos.map((n) => n.parte))].sort().map((p) => `<i class="p${esc(p.replace('.', ''))}"></i>${esc(p)}`).join(' ')}. Dos temas se unen si desarrollan un mismo modelo; la línea es más gruesa cuantos más modelos comparten.${ab ? ` Resaltado: ${esc(ab)} y los temas con los que comparte modelos.` : ''}</p>`;
  }

  /** Disposición por fuerzas (repulsión entre todos, muelles en las aristas, gravedad al centro de cada parte) */
  function disponer(nodos, aristas, W, H) {
    const p = {};
    const centros = { '3.A': [W * 0.3, H * 0.45], '3.B': [W * 0.72, H * 0.4], '4.B': [W * 0.55, H * 0.8] };
    let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    nodos.forEach((n) => { const c = centros[n.parte] || [W / 2, H / 2]; p[n.codigo] = { x: c[0] + (azar() - 0.5) * 200, y: c[1] + (azar() - 0.5) * 200, vx: 0, vy: 0, parte: n.parte }; });
    const L = nodos.map((n) => p[n.codigo]);
    for (let it = 0; it < 400; it++) {
      const t = 1 - it / 400;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]; let dx = a.x - b.x, dy = a.y - b.y; const d2 = Math.max(25, dx * dx + dy * dy);
        const f = 2600 / d2; const d = Math.sqrt(d2); dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      aristas.forEach((e) => {
        const a = p[e.a], b = p[e.b]; if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 75) * 0.012 * Math.min(3, e.familias.length);
        a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
      });
      L.forEach((a) => {
        const c = centros[a.parte] || [W / 2, H / 2];
        a.vx += (c[0] - a.x) * 0.004; a.vy += (c[1] - a.y) * 0.004;
        a.x += Math.max(-20, Math.min(20, a.vx)) * t; a.y += Math.max(-20, Math.min(20, a.vy)) * t;
        a.vx *= 0.6; a.vy *= 0.6;
        a.x = Math.max(30, Math.min(W - 30, a.x)); a.y = Math.max(30, Math.min(H - 20, a.y));
      });
    }
    return p;
  }

  // ------------------------------------------------------------ panel derecho
  function lado() {
    const st = ctx.estado, R = D.relaciones;
    const modos = `<div class="rel-modos" role="tablist">
      <button role="tab" class="${st.relModo === 'tema' ? 'activo' : ''}" data-rel-modo="tema" ${R.abierto ? '' : 'disabled title="Abre el main.tex de un tema"'}>${R.abierto ? `Tema ${esc(R.abierto)}` : 'Tema abierto'}</button>
      <button role="tab" class="${st.relModo === 'recom' ? 'activo' : ''}" data-rel-modo="recom">Qué armonizar</button>
    </div>`;
    if (st.relModo === 'tema') return modos + ladoTema();
    return modos + (st.relDetalleFam ? ladoDetalleRecom() : ladoRecom());
  }

  function ladoTema() {
    const st = ctx.estado, R = D.relaciones;
    if (!R.modelosAbierto.length) return `<p class="rel-vacio">${esc(R.abierto)} no comparte ningún modelo desarrollado con otros temas.</p>`;
    const sel = `<label class="rel-sel">Modelo que comparte con otros temas
      <select data-rel-familia>${R.modelosAbierto.map((m) => `<option value="${esc(m.familia)}" ${m.familia === st.relFamilia ? 'selected' : ''}>${esc(m.familia)} (${m.temas.length} temas)</option>`).join('')}</select></label>`;
    if (!detalle || detalle.familia !== st.relFamilia) return sel + '<p class="apagado">Buscando los desarrollos…</p>';
    const otros = detalle.temas.filter((t) => t.codigo !== R.abierto), propio = detalle.temas.find((t) => t.codigo === R.abierto);
    const misErrores = detalle.informe ? detalle.informe.divergencias.filter((d) => d.error && d.temas.includes(R.abierto)) : [];
    return `${sel}
      ${detalle.informe ? `<p class="rel-prio p-${esc(detalle.informe.prioridad)}">${esc(PRIO_TXT[detalle.informe.prioridad] || '')} de armonizar. <a data-rel-ver="${esc(detalle.familia)}">Ver el informe completo</a></p>` : ''}
      ${misErrores.length ? `<div class="rel-errores"><p><strong>Posibles errores en este tema (${misErrores.length})</strong></p>${misErrores.map(divergencia).join('')}</div>` : ''}
      ${otros.map((t) => tarjeta(t)).join('')}
      ${propio ? `<details class="rel-propio"><summary>Así lo desarrolla ${esc(R.abierto)} (este tema)</summary>${tarjeta(propio, true)}</details>` : ''}`;
  }

  function ladoRecom() {
    const R = D.relaciones;
    return `<p class="rel-intro">Modelos que se desarrollan en varios temas, ordenados por lo que más conviene armonizar: prioridad del informe, errores confirmados y diferencias de notación y ecuaciones.</p>
      <ol class="rel-recom">${R.recomendaciones.map((r) => `<li><button class="rel-item" data-rel-ver="${esc(r.familia)}">
        <span class="rel-item-cab"><strong>${esc(r.familia)}</strong><span class="rel-prio-chip p-${esc(r.prioridad.replace(' ', '-'))}">${esc(r.prioridad)}</span></span>
        <span class="rel-item-meta">${r.temas.map(sinEj).join(', ')}${r.errores ? ` · ${r.errores} posible${r.errores > 1 ? 's' : ''} error${r.errores > 1 ? 'es' : ''}` : ''}${r.cambiados.length ? ` · ${r.cambiados.map(sinEj).join(', ')} cambió desde el informe` : ''}</span>
        <span class="rel-item-motivo">${esc(r.motivo)}</span></button></li>`).join('')}</ol>`;
  }

  function ladoDetalleRecom() {
    const st = ctx.estado;
    const vuelta = '<button class="rel-volver" data-rel-volver>‹ Todos los modelos</button>';
    if (!detalle || detalle.familia !== st.relDetalleFam) return vuelta + '<p class="apagado">Cargando el informe…</p>';
    const I = detalle.informe;
    if (!I) return `${vuelta}<h3>${esc(detalle.familia)}</h3><p>Aún no hay informe de Claude para este modelo.</p>${detalle.temas.map((t) => tarjeta(t)).join('')}`;
    const errores = I.divergencias.filter((d) => d.error), otras = I.divergencias.filter((d) => !d.error);
    return `${vuelta}<h3>${esc(detalle.familia)}</h3>
      <p class="rel-prio p-${esc(I.prioridad)}">${esc(PRIO_TXT[I.prioridad])}. ${esc(I.motivo)}</p>
      <section><h4>Enfoque común</h4><p>${esc(I.enfoque)}</p></section>
      ${otras.length ? `<section><h4>Diferencias</h4>${otras.map(divergencia).join('')}</section>` : ''}
      ${errores.length ? `<section class="rel-errores"><h4>Posibles errores (${errores.length})</h4>${errores.map(divergencia).join('')}</section>` : ''}
      <section><h4>Propuesta</h4><p>${esc(I.propuesta)}</p>${I.referencia ? `<p class="apagado">Tema de referencia: <a data-abrir="${esc(I.referencia)}">${esc(I.referencia)}</a></p>` : ''}</section>
      <section><h4>Cómo lo desarrolla cada tema</h4>${detalle.temas.map((t) => tarjeta(t)).join('')}</section>`;
  }

  function divergencia(d) {
    const ir = d.error && d.linea && d.temas.length === 1 ? ` <a data-rel-linea="${d.linea}" data-rel-tema="${esc(d.temas[0])}">Ir a la línea ${d.linea} de ${esc(d.temas[0])}</a>` : '';
    return `<div class="rel-div ${d.error ? 'es-error' : ''}"><span class="rel-aspecto">${esc(d.aspecto)}</span> ${esc(d.descripcion.replace(/^Posible error:\s*/i, ''))}
      <span class="apagado">(${d.temas.map(esc).join(', ')}${d.verificacion && d.verificacion !== 'confirmado' ? '; ' + esc(d.verificacion) : ''})</span>${ir}</div>`;
  }

  /** Tarjeta con el resumen de un tema: lo escrito por Claude y, si el tema cambió, las ecuaciones actuales */
  function tarjeta(t, sinCabecera) {
    const r = t.resumen;
    const cab = sinCabecera ? '' : `<header><a data-abrir="${esc(t.codigo)}"${t.epigrafes[0] ? ` data-epigrafe="${esc(t.epigrafes[0].titulo)}"` : ''}><strong>${esc(t.codigo)}</strong> ${esc(t.titulo)}</a>
      <span class="rel-estado e-${t.estado.replace(' ', '-')}">${{ 'al día': 'resumen al día', cambiado: 'el tema ha cambiado desde el resumen', 'sin informe': 'sin resumen de Claude' }[t.estado]}</span></header>`;
    const epis = t.epigrafes.length ? `<p class="rel-epis">${t.epigrafes.map((e) => `<a data-abrir="${esc(t.codigo)}" data-epigrafe="${esc(e.titulo)}">${esc(e.numero)} ${esc(e.titulo)}</a>`).join(' · ')}</p>` : '';
    const lista = (xs) => (xs && xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    let cuerpo = '';
    if (r) {
      cuerpo = `${r.papel ? `<p class="rel-papel">${esc(r.papel)}</p>` : ''}
        ${r.contexto ? `<h5>Contexto</h5><p>${esc(r.contexto)}</p>` : ''}
        ${r.supuestos && r.supuestos.length ? `<h5>Supuestos</h5>${lista(r.supuestos)}` : ''}
        ${r.ecuaciones && r.ecuaciones.length ? `<h5>Ecuaciones clave</h5>${r.ecuaciones.map((e) => `<div class="rel-eq">${mate(e.tex)}<p class="apagado">${esc(e.que)}</p></div>`).join('')}` : ''}
        ${r.desarrollo ? `<h5>Desarrollo</h5><p>${esc(r.desarrollo)}</p>` : ''}
        ${r.implicaciones && r.implicaciones.length ? `<h5>Implicaciones</h5>${lista(r.implicaciones)}` : ''}`;
    }
    // si no hay resumen o el tema ha cambiado, se enseñan las ecuaciones tal como están ahora en el tema
    const actuales = (!r || t.estado === 'cambiado') && t.ecuaciones.length
      ? `<details ${r ? '' : 'open'}><summary>Ecuaciones actuales del tema (${t.ecuaciones.length})</summary>${t.ecuaciones.map((e) => `<div class="rel-eq">${mate(e.tex)}<p class="apagado">${esc(e.pie)}</p></div>`).join('')}</details>` : '';
    return `<article class="rel-tarjeta">${cab}${epis}${cuerpo}${actuales}${!r && !t.ecuaciones.length ? '<p class="apagado">No se ha localizado el desarrollo en el texto actual.</p>' : ''}</article>`;
  }

  // ------------------------------------------------------------ eventos
  function conectar() {
    const st = ctx.estado;
    const rep = () => { ctx.guardar(); ctx.repintar(); };
    el.querySelectorAll('[data-rel-modo]').forEach((b) => { b.onclick = () => { st.relModo = b.dataset.relModo; rep(); }; });
    const s = el.querySelector('[data-rel-familia]'); if (s) s.onchange = () => { st.relFamilia = s.value; rep(); };
    el.querySelectorAll('[data-rel-ver]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); st.relModo = 'recom'; st.relDetalleFam = b.dataset.relVer; rep(); el.querySelector('.rel-lado').scrollTop = 0; }; });
    el.querySelectorAll('[data-rel-volver]').forEach((b) => { b.onclick = () => { st.relDetalleFam = null; rep(); }; });
    el.querySelectorAll('[data-rel-linea]').forEach((a) => { a.onclick = (e) => { e.stopPropagation(); ctx.enviar({ tipo: 'abrirLinea', codigo: a.dataset.relTema, linea: Number(a.dataset.relLinea) - 1 }); }; });
  }

  window.TCEE_REL = {
    pintar,
    detalle(d) { detalle = d; if (ctx && el && ctx.estado.pestana === 'relaciones') ctx.repintar(); },
  };
})();
