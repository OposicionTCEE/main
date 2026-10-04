// Panel Oposición (lado de la página). Recibe los datos de la extensión y pinta cuatro pestañas.
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const estado = Object.assign({ pestana: 'temas', orden: 'codigo', asc: true, filtro: '', familia: '', aislados: false }, vscode.getState() || {});
  let D = null;
  const app = document.getElementById('app');
  const guardar = () => vscode.setState(estado);
  const enviar = (m) => vscode.postMessage(m);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const porCodigo = (a, b) => a.localeCompare(b, 'es', { numeric: true });
  const fechaCorta = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); };
  const sumarSemana = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); const x = new Date(a, m - 1, d + 7 * n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.tipo === 'datos') { D = m.datos; pintar(); }
    if (m.tipo === 'error') app.innerHTML = `<p class="vacio">No se pudo calcular el panel: ${esc(m.texto)}</p>`;
  });

  function pintar() {
    if (!D) return;
    const pest = [['temas', 'Temas'], ['plan', 'Plan semanal'], ['relaciones', 'Relaciones del tema'], ['mapa', 'Mapa de relaciones']];
    app.innerHTML = `
      <header>
        <div class="resumen"><strong>Tiempo restante del temario: ${esc(D.total.tiempo)}</strong>
          <span>${D.total.hechos} de ${D.total.n} temas hechos</span></div>
        <nav>${pest.map(([k, t]) => `<button class="pest ${estado.pestana === k ? 'activa' : ''}" data-pest="${k}">${t}</button>`).join('')}</nav>
      </header>
      <main id="cuerpo"></main>`;
    app.querySelectorAll('[data-pest]').forEach((b) => b.onclick = () => { estado.pestana = b.dataset.pest; guardar(); pintar(); });
    const cuerpo = document.getElementById('cuerpo');
    ({ temas: pTemas, plan: pPlan, relaciones: pRelaciones, mapa: pMapa })[estado.pestana](cuerpo);
  }

  // ------------------------------------------------------------------ Temas
  function pTemas(el) {
    const cols = [['codigo', 'Código'], ['titulo', 'Tema'], ['minutos', 'Tiempo restante'], ['pct', '%'], ['hecho', 'Hecho']];
    const f = estado.filtro.toLowerCase();
    const filas = D.temas.filter((t) => !f || `${t.codigo} ${t.titulo} ${t.completo}`.toLowerCase().includes(f))
      .sort((a, b) => {
        const k = estado.orden;
        const r = k === 'codigo' ? porCodigo(a.codigo, b.codigo) : k === 'titulo' ? a.titulo.localeCompare(b.titulo, 'es') : (a[k] - b[k]) || porCodigo(a.codigo, b.codigo);
        return estado.asc ? r : -r;
      });
    el.innerHTML = `
      <div class="barra"><input id="filtro" type="search" placeholder="Buscar por código o palabras del título…" value="${esc(estado.filtro)}"></div>
      <table class="temas"><thead><tr>${cols.map(([k, t]) => `<th data-orden="${k}" class="${estado.orden === k ? (estado.asc ? 'asc' : 'desc') : ''}">${t}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((t) => `
        <tr class="${t.hecho ? 'hecho' : ''}">
          <td class="cod"><a data-abrir="${t.codigo}">${t.codigo}</a></td>
          <td><a data-abrir="${t.codigo}" title="${esc(t.completo)}">${esc(t.titulo)}</a></td>
          <td class="num">${t.hecho ? '—' : esc(t.tiempo)}</td>
          <td class="num"><span class="pct"><span style="width:${t.pct}%"></span></span>${t.pct} %</td>
          <td class="centro"><input type="checkbox" data-hecho="${t.codigo}" ${t.hecho ? 'checked' : ''} title="Listo para pasar a estudiar sobre esquema"></td>
        </tr>`).join('')}</tbody></table>`;
    const inp = el.querySelector('#filtro');
    inp.oninput = () => { estado.filtro = inp.value; guardar(); pTemas(el); const i = el.querySelector('#filtro'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    el.querySelectorAll('[data-orden]').forEach((th) => th.onclick = () => {
      const k = th.dataset.orden; estado.asc = estado.orden === k ? !estado.asc : true; estado.orden = k; guardar(); pTemas(el);
    });
    enlaces(el);
    el.querySelectorAll('[data-hecho]').forEach((c) => c.onchange = () => enviar({ tipo: 'hecho', codigo: c.dataset.hecho, valor: c.checked }));
  }

  // ------------------------------------------------------------------ Plan semanal
  function pPlan(el) {
    const P = D.plan;
    const pasadas = P.historial.length ? `
      <section><h3>Semanas anteriores</h3><ul class="historial">${P.historial.map((h) => {
        const faltan = h.planificados.filter((c) => !h.hechos.includes(c));
        return `<li><span class="sem">Semana del ${fechaCorta(h.lunes)}</span> ${h.hechos.length} de ${h.planificados.length} temas hechos
          ${faltan.length ? `<span class="apagado">· faltan ${faltan.map((c) => `<a data-abrir="${c}">${c}</a>`).join(', ')}</span>` : '✓'}</li>`;
      }).join('')}</ul></section>` : '';
    el.innerHTML = `
      <div class="barra">
        <label>Horas disponibles por semana <input id="horas" type="number" min="1" max="100" step="1" value="${P.horasSemana}"></label>
        <span class="apagado">Esta semana llevas ${esc(P.estaSemana)} de ${P.horasSemana} h</span>
      </div>
      <p class="ayuda">Reparto automático de los temas no hechos, de menos a más avanzados. Con ◀ ▶ mueves un tema de semana (queda fijado 📌); con ✕ vuelve al reparto automático.</p>
      ${P.semanas.length ? P.semanas.map((s, i) => `
        <section class="semana ${i === 0 ? 'actual' : ''}">
          <h3>${i === 0 ? 'Esta semana' : `Semana del ${fechaCorta(s.lunes)}`} <span class="apagado">· ${esc(s.total)} de ${esc(s.cap)}${i === 0 ? ' (lo que queda de semana)' : ''}</span></h3>
          <div class="carga"><span style="width:${Math.min(100, Math.round(s.lleno * 100))}%" class="${s.lleno > 1.001 ? 'exceso' : ''}"></span></div>
          <ul>${s.temas.map((t) => `
            <li>
              <a data-abrir="${t.codigo}" class="cod">${t.codigo}</a> <a data-abrir="${t.codigo}">${esc(t.titulo)}</a>
              <span class="apagado">${esc(t.tiempo)}${{ empieza: ' · empieza', sigue: ' · continúa', termina: ' · termina' }[t.parte] || ''}</span>
              ${t.fijado ? '<span title="Fijado a esta semana">📌</span>' : ''}
              <span class="mover">
                ${i > 0 ? `<button data-fijar="${t.codigo}" data-lunes="${sumarSemana(s.lunes, -1)}" title="A la semana anterior">◀</button>` : ''}
                <button data-fijar="${t.codigo}" data-lunes="${sumarSemana(s.lunes, 1)}" title="A la semana siguiente">▶</button>
                ${t.fijado ? `<button data-fijar="${t.codigo}" data-lunes="" title="Volver al reparto automático">✕</button>` : ''}
              </span>
            </li>`).join('')}</ul>
        </section>`).join('') : '<p class="vacio">No queda ningún tema pendiente. 🎉</p>'}
      ${pasadas}`;
    const h = el.querySelector('#horas');
    h.onchange = () => enviar({ tipo: 'horas', valor: h.value });
    el.querySelectorAll('[data-fijar]').forEach((b) => b.onclick = () => enviar({ tipo: 'fijar', codigo: b.dataset.fijar, lunes: b.dataset.lunes || null }));
    enlaces(el);
  }

  // ------------------------------------------------------------------ Relaciones del tema abierto
  function pRelaciones(el) {
    const R = D.relaciones;
    if (!R.abierto) { el.innerHTML = '<p class="vacio">Abre el main.tex de un tema para ver con qué otros temas comparte modelos.</p>'; return; }
    if (!R.modelos.length) {
      el.innerHTML = `<p class="vacio"><strong>${esc(R.abierto)} · ${esc(R.titulo)}</strong><br>No desarrolla matemáticamente ningún modelo según el análisis de desarrollos. Mira el «Mapa de relaciones».</p>`; return;
    }
    el.innerHTML = `<h2><a data-abrir="${R.abierto}">${esc(R.abierto)} · ${esc(R.titulo)}</a></h2>
      <p class="ayuda">Modelos que este tema desarrolla y otros temas donde también se desarrollan. Pulsa un epígrafe para saltar a él.</p>
      ${R.modelos.map((m) => `
        <section class="modelo">
          <h3>${esc(m.familia)} <span class="apagado">· ${esc(m.area)} · ${esc(m.grado)}</span></h3>
          <p>Aquí: ${m.epigrafes.split(' | ').map((e) => `<a data-abrir="${R.abierto}" data-epigrafe="${esc(e)}">${esc(e)}</a>`).join(' · ')}</p>
          ${m.otros.length ? `<ul>${m.otros.map((o) => `
            <li><a data-abrir="${o.codigo}" class="cod">${o.codigo}</a> ${esc(o.titulo)} <span class="apagado">(${esc(o.grado)})</span><br>
              ${o.epigrafes.split(' | ').filter(Boolean).map((e) => `<a data-abrir="${o.codigo}" data-epigrafe="${esc(e)}" class="epi">${esc(e)}</a>`).join(' · ')}</li>`).join('')}</ul>`
            : '<p class="apagado">Solo se desarrolla en este tema.</p>'}
        </section>`).join('')}`;
    enlaces(el);
  }

  // ------------------------------------------------------------------ Mapa global
  let posiciones = null;
  function pMapa(el) {
    const M = D.mapa;
    const fam = estado.familia;
    const conAristas = new Set(M.aristas.flatMap((a) => [a.a, a.b]));
    const nodos = M.nodos.filter((n) => estado.aislados || conAristas.has(n.codigo));
    const ids = new Set(nodos.map((n) => n.codigo));
    const aristas = M.aristas.filter((a) => ids.has(a.a) && ids.has(a.b));
    const W = 1000, H = 640;
    if (!posiciones || posiciones.n !== nodos.length) posiciones = { n: nodos.length, p: disponer(nodos, aristas, W, H) };
    const pos = posiciones.p;
    const tiene = (n) => fam && n.modelos.includes(fam);
    el.innerHTML = `
      <div class="barra">
        <label>Resaltar modelo <select id="familia"><option value="">— ninguno —</option>${M.familias.map((f) => `<option ${f === fam ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
        <label><input id="aislados" type="checkbox" ${estado.aislados ? 'checked' : ''}> Mostrar temas sin modelos compartidos</label>
        <span class="leyenda"><i class="p3A"></i>3.A <i class="p3B"></i>3.B <i class="p4B"></i>4.B · borde grueso = hecho</span>
      </div>
      <p class="ayuda">Dos temas se unen si desarrollan un mismo modelo; cuanto más gruesa la línea, más modelos comparten. Pasa el ratón por un tema para ver sus vecinos; púlsalo para abrirlo.</p>
      <svg id="mapa" viewBox="0 0 ${W} ${H}">
        <g class="aristas">${aristas.map((a) => `<line data-a="${a.a}" data-b="${a.b}" x1="${pos[a.a].x}" y1="${pos[a.a].y}" x2="${pos[a.b].x}" y2="${pos[a.b].y}"
          stroke-width="${Math.min(6, a.familias.length * 1.2)}" class="${fam && a.familias.includes(fam) ? 'resaltada' : fam ? 'tenue' : ''}"><title>${esc(a.a)} – ${esc(a.b)}: ${esc(a.familias.join(', '))}</title></line>`).join('')}</g>
        <g class="nodos">${nodos.map((n) => `<g class="nodo p${n.parte.replace('.', '')} ${n.hecho ? 'hecho' : ''} ${fam ? (tiene(n) ? 'resaltado' : 'tenue') : ''}" data-abrir="${n.codigo}" data-nodo="${n.codigo}" transform="translate(${pos[n.codigo].x},${pos[n.codigo].y})">
          <circle r="${7 + Math.min(8, n.modelos.length)}"></circle><text dy="-12">${esc(n.codigo)}</text>
          <title>${esc(n.codigo)} · ${esc(n.titulo)} — ${n.pct} %${n.modelos.length ? `\nModelos: ${esc(n.modelos.join(', '))}` : ''}</title></g>`).join('')}</g>
      </svg>`;
    el.querySelector('#familia').onchange = (e) => { estado.familia = e.target.value; guardar(); pMapa(el); };
    el.querySelector('#aislados').onchange = (e) => { estado.aislados = e.target.checked; posiciones = null; guardar(); pMapa(el); };
    const svg = el.querySelector('#mapa');
    svg.querySelectorAll('[data-nodo]').forEach((g) => {
      g.onmouseenter = () => {
        const c = g.dataset.nodo; const vec = new Set([c]);
        svg.querySelectorAll('line').forEach((l) => { const s = l.dataset.a === c || l.dataset.b === c; l.classList.toggle('vecina', s); if (s) { vec.add(l.dataset.a); vec.add(l.dataset.b); } });
        svg.classList.add('foco'); svg.querySelectorAll('[data-nodo]').forEach((x) => x.classList.toggle('vecino', vec.has(x.dataset.nodo)));
      };
      g.onmouseleave = () => { svg.classList.remove('foco'); svg.querySelectorAll('.vecina,.vecino').forEach((x) => x.classList.remove('vecina', 'vecino')); };
    });
    enlaces(el);
  }

  /** Disposición por fuerzas (repulsión entre todos, muelles en las aristas, gravedad al centro por partes) */
  function disponer(nodos, aristas, W, H) {
    const p = {};
    const centros = { '3.A': [W * 0.28, H * 0.45], '3.B': [W * 0.7, H * 0.4], '4.B': [W * 0.55, H * 0.75] };
    let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    nodos.forEach((n) => { const c = centros[n.parte] || [W / 2, H / 2]; p[n.codigo] = { x: c[0] + (azar() - 0.5) * 200, y: c[1] + (azar() - 0.5) * 200, vx: 0, vy: 0, parte: n.parte }; });
    const L = nodos.map((n) => p[n.codigo]);
    for (let it = 0; it < 400; it++) {
      const t = 1 - it / 400;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]; let dx = a.x - b.x, dy = a.y - b.y; const d2 = Math.max(25, dx * dx + dy * dy);
        const f = 2200 / d2; const d = Math.sqrt(d2); dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      aristas.forEach((e) => {
        const a = p[e.a], b = p[e.b]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 70) * 0.012 * Math.min(3, e.familias.length);
        a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
      });
      L.forEach((a) => {
        const c = centros[a.parte] || [W / 2, H / 2];
        a.vx += (c[0] - a.x) * 0.004; a.vy += (c[1] - a.y) * 0.004;
        a.x += Math.max(-20, Math.min(20, a.vx)) * t; a.y += Math.max(-20, Math.min(20, a.vy)) * t;
        a.vx *= 0.6; a.vy *= 0.6;
        a.x = Math.max(25, Math.min(W - 25, a.x)); a.y = Math.max(25, Math.min(H - 15, a.y));
      });
    }
    return p;
  }

  function enlaces(el) {
    el.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', (ev) => {
      ev.stopPropagation(); enviar({ tipo: 'abrir', codigo: a.dataset.abrir, epigrafe: a.dataset.epigrafe || null });
    }));
  }

  enviar({ tipo: 'listo' });
})();
