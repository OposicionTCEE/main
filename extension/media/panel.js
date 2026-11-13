// Panel Oposición (lado de la página). Recibe los datos de la extensión y pinta seis pestañas (calendario.js, temas.js, relaciones.js, cante.js, test.js e idiomas.js aparte).
// La cabecera y el contenedor de la pestaña son fijos y cada repintado conserva la posición de lectura (desplazamiento.js).
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
    if (m.tipo === 'error') { carcasa = null; app.innerHTML = `<p class="vacio">No se pudo calcular el panel: ${esc(m.texto)}</p>`; }
    if (m.tipo === 'previa' && window.TCEE_CAL) window.TCEE_CAL.previa(m.previa);
    if (m.tipo === 'traer' && window.TCEE_CAL) window.TCEE_CAL.traer(m.traer);
    if (m.tipo === 'relDetalle' && window.TCEE_REL) window.TCEE_REL.detalle(m.detalle);
    if (m.tipo === 'canteEstado' && window.TCEE_CANTE && estado.pestana === 'cante') window.TCEE_CANTE.estado(m.estado);
    if ((m.tipo === 'testDatos' || m.tipo === 'testHistorial') && window.TCEE_TEST) window.TCEE_TEST.recibir(m);
    if (m.tipo && m.tipo.startsWith('idi') && window.TCEE_IDI) window.TCEE_IDI.recibir(m);
    if (m.tipo === 'canteDetalle' && window.TCEE_CANTE) window.TCEE_CANTE.detalle(m.detalle);
    if (m.tipo === 'canteSeleccionar' && window.TCEE_CANTE) window.TCEE_CANTE.seleccionar(m.id);
    if (m.tipo === 'canteMicros' && window.TCEE_CANTE) window.TCEE_CANTE.micros(m.micros);
    if (['canteAdjuntos', 'canteJuntado', 'canteEscucha'].includes(m.tipo) && window.TCEE_CANTE) window.TCEE_CANTE.recibir(m);
    if (m.tipo === 'aviso') { aviso(m.texto, m.error); if (m.error && window.TCEE_CAL) window.TCEE_CAL.fallo(); }
  });

  /** Mensaje breve abajo a la derecha (se va solo) */
  function aviso(texto, error) {
    const a = document.createElement('div');
    a.className = `aviso${error ? ' error' : ''}`; a.setAttribute('role', 'status'); a.textContent = texto;
    document.body.appendChild(a);
    setTimeout(() => a.remove(), 6000);
  }

  // ---- carcasa estable (CANTE.md, «Posición de lectura»): la cabecera y el contenedor de la pestaña se crean una sola vez.
  // Los datos llegan cada vez que se guarda un tema, se cambia de editor, termina una compilación o avanza una transcripción:
  // solo se actualiza lo que cambia y la pestaña se repinta sin mover la lectura (media/desplazamiento.js).
  const PESTANAS = [['calendario', 'Calendario'], ['temas', 'Temas'], ['relaciones', 'Relaciones'], ['cante', 'Cante'], ['test', 'Test'], ['idiomas', 'Idiomas']];
  const ctxDe = (extra) => Object.assign({ estado, guardar, enviar, repintar: pintar }, extra);
  const PINTORES = {
    calendario: (el) => { window.TCEE_CAL.pintar(el, D, ctxDe()); enlaces(el); },
    temas: (el) => window.TCEE_TEMAS.pintar(el, D, { estado, guardar, enviar }),
    relaciones: (el) => { window.TCEE_REL.pintar(el, D, ctxDe()); enlaces(el); },
    cante: (el) => window.TCEE_CANTE.pintar(el, D, ctxDe()),
    test: (el) => window.TCEE_TEST.pintar(el, D, ctxDe()),
    idiomas: (el) => window.TCEE_IDI.pintar(el, D, ctxDe({ aviso })),
  };
  const DESPL = window.TCEE_DESPLAZAMIENTO || { foto: () => null, restaurar: () => {}, conservar: (r, f) => f() };
  let carcasa = null;          // {resumen, botones: {pestaña: botón}, cuerpo, pestana}
  const posiciones = {};       // pestaña → foto de su posición al dejarla, para volver al mismo sitio

  function crearCarcasa() {
    app.innerHTML = `
      <header>
        <div class="resumen"></div>
        <nav>${PESTANAS.map(([k, t]) => `<button class="pest" data-pest="${k}">${t}</button>`).join('')}</nav>
      </header>
      <main id="cuerpo"></main>`;
    carcasa = { resumen: app.querySelector('.resumen'), botones: {}, cuerpo: app.querySelector('#cuerpo'), pestana: null };
    app.querySelectorAll('[data-pest]').forEach((b) => {
      carcasa.botones[b.dataset.pest] = b;
      b.onclick = () => { if (b.dataset.pest !== 'cante' && window.TCEE_CANTE) window.TCEE_CANTE.salir(); estado.pestana = b.dataset.pest; guardar(); pintar(); };
    });
  }

  function pintar() {
    if (!D) return;
    if (!carcasa || !carcasa.cuerpo.isConnected) crearCarcasa();
    // cabecera: solo los textos que cambian
    const resumen = `<strong>Tiempo restante del temario: ${esc(D.total.tiempo)}</strong><span>${D.total.hechos} de ${D.total.n} temas hechos</span>`;
    if (carcasa.resumen.innerHTML !== resumen) carcasa.resumen.innerHTML = resumen;
    const pestana = PINTORES[estado.pestana] ? estado.pestana : 'calendario';
    for (const [k, t] of PESTANAS) {
      const b = carcasa.botones[k], texto = k === 'cante' && D.cante && D.cante.grabando ? '● Cante' : t;
      if (b.textContent !== texto) b.textContent = texto;
      b.classList.toggle('activa', k === pestana);
    }
    const cuerpo = carcasa.cuerpo;
    if (carcasa.pestana === pestana) { DESPL.conservar(cuerpo, () => PINTORES[pestana](cuerpo)); return; }
    // cambio de pestaña: se guarda dónde se estaba leyendo y se vuelve al sitio de la nueva, si ya se había visitado
    if (carcasa.pestana) posiciones[carcasa.pestana] = DESPL.foto(cuerpo);
    cuerpo.replaceChildren();
    carcasa.pestana = pestana;
    PINTORES[pestana](cuerpo);
    DESPL.restaurar(cuerpo, posiciones[pestana] || { pagina: 0, cajas: [] });
  }

  function enlaces(el) {
    el.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', (ev) => {
      ev.stopPropagation(); enviar({ tipo: 'abrir', codigo: a.dataset.abrir, epigrafe: a.dataset.epigrafe || null });
    }));
  }

  enviar({ tipo: 'listo' });
})();
