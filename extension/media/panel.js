// Panel Oposición (lado de la página). Recibe los datos de la extensión y pinta cuatro pestañas (calendario.js, relaciones.js y cante.js aparte).
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const estado = Object.assign({ pestana: 'calendario', orden: 'codigo', asc: true, filtro: '', familia: '', aislados: false }, vscode.getState() || {});
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
    if (m.tipo === 'previa' && window.TCEE_CAL) window.TCEE_CAL.previa(m.previa);
    if (m.tipo === 'traer' && window.TCEE_CAL) window.TCEE_CAL.traer(m.traer);
    if (m.tipo === 'relDetalle' && window.TCEE_REL) window.TCEE_REL.detalle(m.detalle);
    if (m.tipo === 'canteEstado' && window.TCEE_CANTE && estado.pestana === 'cante') window.TCEE_CANTE.estado(m.estado);
    if (m.tipo === 'canteDetalle' && window.TCEE_CANTE) window.TCEE_CANTE.detalle(m.detalle);
    if (m.tipo === 'canteSeleccionar' && window.TCEE_CANTE) window.TCEE_CANTE.seleccionar(m.id);
    if (m.tipo === 'canteMicros' && window.TCEE_CANTE) window.TCEE_CANTE.micros(m.micros);
    if (m.tipo === 'aviso') { aviso(m.texto, m.error); if (m.error && window.TCEE_CAL) window.TCEE_CAL.fallo(); }
  });

  /** Mensaje breve abajo a la derecha (se va solo) */
  function aviso(texto, error) {
    const a = document.createElement('div');
    a.className = `aviso${error ? ' error' : ''}`; a.setAttribute('role', 'status'); a.textContent = texto;
    document.body.appendChild(a);
    setTimeout(() => a.remove(), 6000);
  }

  function pintar() {
    if (!D) return;
    const pest = [['calendario', 'Calendario'], ['temas', 'Temas'], ['relaciones', 'Relaciones'], ['cante', D.cante && D.cante.grabando ? '● Cante' : 'Cante']];
    app.innerHTML = `
      <header>
        <div class="resumen"><strong>Tiempo restante del temario: ${esc(D.total.tiempo)}</strong>
          <span>${D.total.hechos} de ${D.total.n} temas hechos</span></div>
        <nav>${pest.map(([k, t]) => `<button class="pest ${estado.pestana === k ? 'activa' : ''}" data-pest="${k}">${t}</button>`).join('')}</nav>
      </header>
      <main id="cuerpo"></main>`;
    app.querySelectorAll('[data-pest]').forEach((b) => b.onclick = () => { estado.pestana = b.dataset.pest; guardar(); pintar(); });
    const cuerpo = document.getElementById('cuerpo');
    const pCalendario = (el) => { window.TCEE_CAL.pintar(el, D, { estado, guardar, enviar, repintar: pintar }); enlaces(el); };
    const pRelaciones = (el) => { window.TCEE_REL.pintar(el, D, { estado, guardar, enviar, repintar: pintar }); enlaces(el); };
    const pCante = (el) => window.TCEE_CANTE.pintar(el, D, { estado, guardar, enviar, repintar: pintar });
    ({ calendario: pCalendario, temas: pTemas, relaciones: pRelaciones, cante: pCante })[estado.pestana in { calendario: 1, temas: 1, relaciones: 1, cante: 1 } ? estado.pestana : 'calendario'](cuerpo);
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

  function enlaces(el) {
    el.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', (ev) => {
      ev.stopPropagation(); enviar({ tipo: 'abrir', codigo: a.dataset.abrir, epigrafe: a.dataset.epigrafe || null });
    }));
  }

  enviar({ tipo: 'listo' });
})();
