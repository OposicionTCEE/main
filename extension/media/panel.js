// Panel Oposición (lado de la página). Recibe los datos de la extensión y pinta cinco pestañas (calendario.js, temas.js, relaciones.js, cante.js y test.js aparte).
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
    if ((m.tipo === 'testDatos' || m.tipo === 'testHistorial') && window.TCEE_TEST) window.TCEE_TEST.recibir(m);
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
    const pest = [['calendario', 'Calendario'], ['temas', 'Temas'], ['relaciones', 'Relaciones'], ['cante', D.cante && D.cante.grabando ? '● Cante' : 'Cante'], ['test', 'Test']];
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
    const pTest = (el) => window.TCEE_TEST.pintar(el, D, { estado, guardar, enviar, repintar: pintar });
    ({ calendario: pCalendario, temas: pTemas, relaciones: pRelaciones, cante: pCante, test: pTest })[estado.pestana in { calendario: 1, temas: 1, relaciones: 1, cante: 1, test: 1 } ? estado.pestana : 'calendario'](cuerpo);
  }

  // ------------------------------------------------------------------ Temas (media/temas.js)
  function pTemas(el) { window.TCEE_TEMAS.pintar(el, D, { estado, guardar, enviar }); }

  function enlaces(el) {
    el.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', (ev) => {
      ev.stopPropagation(); enviar({ tipo: 'abrir', codigo: a.dataset.abrir, epigrafe: a.dataset.epigrafe || null });
    }));
  }

  enviar({ tipo: 'listo' });
})();
