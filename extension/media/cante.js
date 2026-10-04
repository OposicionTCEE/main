// Panel Oposición, pestaña «Cante»: cronómetro y grabación; la transcripción se hace al terminar y se consulta en el historial.
// Reglas: main/CANTE.md
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reloj = (seg) => { seg = Math.max(0, Math.floor(seg)); const h = Math.floor(seg / 3600), m = Math.floor(seg / 60) % 60, s = seg % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const minutos = (seg) => (seg >= 3600 ? `${Math.floor(seg / 3600)} h ${Math.round((seg % 3600) / 60)} min` : `${Math.round(seg / 60)} min`);
  const fecha = (iso) => new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fechaCorta = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`; };
  const ESTADOS = { pendiente: 'por transcribir', transcrito: '', error: 'error al transcribir', 'sin audio': 'sin audio' };
  const enMarcha = (id) => !!(C && ((C.transcribiendo && C.transcribiendo.id === id) || C.cola.includes(id)));

  let D = null, C = null, ctx = null, el = null, tic = null, micros = null, detalle = null, silencio = 0;

  function pintar(elemento, datos, contexto) {
    el = elemento; D = datos; C = datos.cante; ctx = contexto;
    if (!micros && !C.falta.includes('ffmpeg')) ctx.enviar({ tipo: 'canteMicros' });
    const v = ctx.estado.canteVer, enLista = v && C.lista.find((f) => f.id === v);
    if (v && !enLista) { ctx.estado.canteVer = null; detalle = null; ctx.guardar(); }
    else if (v && (!detalle || detalle.id !== v || detalle.estado !== enLista.estado)) ctx.enviar({ tipo: 'canteVer', id: v });
    render();
  }

  function render() {
    clearInterval(tic); tic = null;
    if (C.grabando) { el.innerHTML = grabando(); conectar(); tic = setInterval(actualizarReloj, 250); actualizarReloj(); medidor(); return; }
    el.innerHTML = `<div class="cante">
      <div class="cante-izq">${C.falta.length ? instalar() : formulario()}${proceso()}${historial()}</div>
      <aside class="cante-dcha">${vistaDetalle()}</aside></div>`;
    conectar();
  }

  // ------------------------------------------------------------ antes de empezar
  function instalar() {
    return `<section class="cante-tarjeta aviso-instalar"><h3>Falta instalar: ${esc(C.falta.join(', '))}</h3>
      <p>La grabación y la transcripción funcionan en tu Mac, sin conexión y sin coste. Se instalan una sola vez (unos 2 GB, sobre todo el modelo de idioma).</p>
      <p><button class="primario" data-c="instalar">Instalar herramientas de cante</button></p>
      <p class="apagado">Se abre un terminal abajo: si te pide la contraseña del Mac, escríbela (no se ve mientras escribes) y pulsa Intro. Cuando ponga <em>Todo listo</em>, vuelve aquí.</p></section>`;
  }

  function formulario() {
    const temas = D.temas;
    const titulo = Object.fromEntries(temas.map((t) => [t.codigo, t.titulo]));
    const elegido = ctx.estado.canteTema || C.abierto || C.semana[0] || (temas[0] && temas[0].codigo);
    const opt = (c) => `<option value="${esc(c)}" ${c === elegido ? 'selected' : ''}>${esc(c)} · ${esc(titulo[c] || '')}</option>`;
    const partes = [...new Set(temas.map((t) => t.parte))];
    const grupos = [
      C.abierto ? `<optgroup label="Tema abierto">${opt(C.abierto)}</optgroup>` : '',
      C.semana.length ? `<optgroup label="Semana en curso del calendario">${C.semana.filter((c) => titulo[c]).map(opt).join('')}</optgroup>` : '',
      ...partes.map((p) => `<optgroup label="${esc(p)}">${temas.filter((t) => t.parte === p).map((t) => opt(t.codigo)).join('')}</optgroup>`),
    ].join('');
    const objetivo = ctx.estado.canteObjetivo != null ? ctx.estado.canteObjetivo : C.objetivo;
    const microSel = ctx.estado.canteMicro != null ? ctx.estado.canteMicro : C.micro;
    const microOpts = micros ? micros.map((m) => `<option ${m.nombre === microSel ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('') : '';
    return `<section class="cante-tarjeta"><h3>Nuevo cante</h3>
      <label class="cante-campo">Tema<select id="c-tema">${grupos}</select></label>
      <div class="cante-fila">
        <label class="cante-campo">Tiempo objetivo (minutos)<input id="c-obj" type="number" min="0" max="240" step="1" value="${esc(objetivo)}"></label>
        <label class="cante-campo">Micrófono<select id="c-mic"><option value="">Automático${micros && micros.length ? '' : ' (buscando…)'}</option>${microOpts}</select></label>
      </div>
      <p><button class="primario grande" data-c="empezar">● Empezar cante</button></p>
      <p class="apagado">Al pulsar arrancan a la vez el cronómetro y la grabación. No verás el texto mientras hablas. Al terminar, el cante se guarda y lo transcribes con <em>Transcribir</em> cuando te venga bien.</p></section>`;
  }

  function proceso() {
    const t = C.transcribiendo;
    if (!t && !C.cola.length) return '';
    return `<section class="cante-tarjeta"><p><strong>Transcribiendo${t ? ` el cante de ${esc(t.codigo)}` : ''}…</strong> <span id="c-pct">${t ? t.pct : 0} %</span></p>
      <span class="pct ancho"><span id="c-barra" style="width:${t ? t.pct : 0}%"></span></span>
      <p class="apagado">Se hace en segundo plano: puedes seguir trabajando o cerrar esta pestaña.${C.cola.length ? ` Después: ${C.cola.length} más.` : ''}</p>
      <p><button data-c="cancelar">Cancelar</button> <span class="apagado">El cante queda pendiente y puedes transcribirlo más tarde.</span></p></section>`;
  }

  function historial() {
    if (!C.lista.length) return '<section class="cante-tarjeta"><h3>Historial</h3><p class="apagado">Aún no hay cantes grabados.</p></section>';
    return `<section class="cante-tarjeta"><h3>Historial</h3><table class="temas cante-lista"><thead><tr><th>Fecha</th><th>Tema</th><th>Duración</th><th>Palabras/min</th></tr></thead><tbody>
      ${C.lista.map((f) => {
        const pasado = f.objetivo && f.duracion > f.objetivo;
        const ppm = f.palabras && f.duracion ? Math.round(f.palabras / (f.duracion / 60)) : '';
        return `<tr class="${ctx.estado.canteVer === f.id ? 'sel' : ''}" data-ver="${esc(f.id)}">
          <td class="nowrap">${esc(fechaCorta(f.fecha))}</td><td><strong>${esc(f.codigo)}</strong> ${ESTADOS[f.estado] ? `<span class="etiqueta ${f.estado === 'error' ? 'mal' : ''}">${esc(ESTADOS[f.estado])}</span>` : ''}${(f.estado === 'pendiente' || f.estado === 'error') && !enMarcha(f.id) ? ` <button class="mini-b" data-transcribir="${esc(f.id)}">Transcribir</button>` : enMarcha(f.id) ? ' <span class="etiqueta">en cola</span>' : ''}</td>
          <td class="num ${pasado ? 'pasado' : ''}">${esc(reloj(f.duracion))}${f.objetivo ? ` <span class="apagado">/ ${esc(reloj(f.objetivo))}</span>` : ''}</td>
          <td class="num">${ppm}</td></tr>`;
      }).join('')}</tbody></table></section>`;
  }

  function vistaDetalle() {
    const f = detalle;
    if (!f) return '<p class="apagado cante-vacio">Elige un cante del historial para leer su transcripción.</p>';
    const ppm = f.texto && f.duracion ? Math.round(f.texto.split(/\s+/).length / (f.duracion / 60)) : null;
    const dif = f.objetivo ? f.duracion - f.objetivo : null;
    // párrafos de aproximadamente un minuto, con la marca de tiempo al margen
    const parrafos = [];
    (f.segmentos || []).forEach((s) => { const ult = parrafos[parrafos.length - 1]; if (!ult || s.t - ult.t >= 60) parrafos.push({ t: s.t, texto: s.texto }); else ult.texto += ` ${s.texto}`; });
    return `<div class="cante-detalle">
      <h3>${esc(f.codigo)} · ${esc(f.titulo)}</h3>
      <p class="apagado">${esc(fecha(f.fecha))} · ${esc(reloj(f.duracion))}${dif != null ? ` (${dif > 0 ? '+' : '−'}${esc(reloj(Math.abs(dif)))} ${dif > 0 ? 'sobre' : 'bajo'} el objetivo de ${esc(minutos(f.objetivo))})` : ''}${ppm ? ` · ${ppm} palabras/min` : ''}</p>
      <p class="cante-botones">
        <button class="primario" data-c="audio">Escuchar audio</button>
        ${f.texto ? '<button class="" data-c="copiar">Copiar texto</button>' : ''}
        ${(f.estado === 'error' || f.estado === 'pendiente') && !enMarcha(f.id) ? '<button class="primario" data-c="reintentar">Transcribir</button>' : ''}
        <button class="peligro" data-c="eliminar">Eliminar</button></p>
      ${f.estado === 'error' ? `<p class="rel-div es-error">${esc(f.error || 'Error al transcribir.')}</p>` : ''}
      ${f.estado === 'pendiente' && !enMarcha(f.id) ? '<p class="apagado">Pendiente de transcribir. Tarda unos minutos y el Mac trabaja a tope (gasta batería): mejor con el cargador puesto.</p>' : ''}
      ${enMarcha(f.id) ? '<p class="apagado">Transcribiendo…</p>' : ''}
      ${parrafos.length ? `<div class="cante-texto">${parrafos.map((p) => `<p><span class="cante-t">${esc(reloj(p.t))}</span>${esc(p.texto)}</p>`).join('')}</div>`
        : f.estado === 'transcrito' ? '<p class="apagado">La transcripción está vacía: no se reconoció voz en la grabación.</p>' : ''}
    </div>`;
  }

  // ------------------------------------------------------------ grabando
  function grabando() {
    const g = C.grabando;
    return `<div class="cante-grabando">
      <p class="cante-tema"><span class="punto-rec"></span> Grabando · <strong>${esc(g.codigo)}</strong> ${esc(g.titulo)}</p>
      <div id="c-reloj" class="cante-reloj">00:00</div>
      ${g.objetivo ? `<div class="cante-objetivo"><span class="pct ancho"><span id="c-prog"></span></span><p id="c-resto" class="apagado"></p></div>` : ''}
      <div class="cante-nivel"><span class="apagado">${esc(g.micro || "Micrófono")}</span><span class="medidor"><span id="c-nivel"></span></span></div>
      <p id="c-silencio" class="cante-silencio" hidden>No llega sonido del micrófono. Si sigue así, termina y revisa el permiso de micrófono de Visual Studio Code.</p>
      <p class="cante-botones"><button class="primario grande" data-c="terminar">■ Terminar</button> <button class="" data-c="descartar">Descartar</button></p>
      <p class="apagado">Puedes cambiar de ventana: la grabación sigue aunque cierres esta pestaña o recargues VS Code.</p></div>`;
  }

  function actualizarReloj() {
    const g = C && C.grabando; if (!g) return;
    const seg = (Date.now() - g.inicio) / 1000;
    const r = document.getElementById('c-reloj'); if (!r) return;
    r.textContent = reloj(seg);
    if (g.objetivo) {
      const pasado = seg > g.objetivo;
      r.classList.toggle('pasado', pasado);
      const p = document.getElementById('c-prog');
      p.style.width = `${Math.min(100, (seg / g.objetivo) * 100)}%`; p.classList.toggle('pasado', pasado);
      document.getElementById('c-resto').textContent = pasado ? `+${reloj(seg - g.objetivo)} sobre el objetivo de ${minutos(g.objetivo)}` : `Objetivo ${minutos(g.objetivo)} · quedan ${reloj(g.objetivo - seg)}`;
    }
  }

  /** Estado en vivo enviado por la extensión (nivel del micrófono, % transcrito) */
  function estado(e) {
    if (!C) return;
    const antes = !!C.grabando;
    Object.assign(C, e);
    if (antes !== !!C.grabando) { ctx.repintar(); return; }
    if (C.grabando) medidor();
    else if (C.transcribiendo) {
      const p = document.getElementById('c-pct'), b = document.getElementById('c-barra');
      if (p && b) { p.textContent = `${C.transcribiendo.pct} %`; b.style.width = `${C.transcribiendo.pct}%`; } else ctx.repintar();
    }
  }

  function medidor() {
    {
      const n = C.grabando.nivel;
      const barra = document.getElementById('c-nivel');
      if (barra) barra.style.width = n == null ? '0%' : `${Math.max(0, Math.min(100, ((n + 60) / 50) * 100))}%`;
      silencio = n != null && n < -55 ? silencio + 1 : 0;          // llega cada medio segundo
      const av = document.getElementById('c-silencio'); if (av) av.hidden = silencio < 16;
    }
  }

  function conectar() {
    const sel = (id) => el.querySelector(id);
    const tema = sel('#c-tema'), obj = sel('#c-obj'), mic = sel('#c-mic');
    if (tema) tema.onchange = () => { ctx.estado.canteTema = tema.value; ctx.guardar(); };
    if (obj) obj.oninput = () => { ctx.estado.canteObjetivo = obj.value; ctx.guardar(); };
    if (mic) mic.onchange = () => { ctx.estado.canteMicro = mic.value; ctx.guardar(); };
    el.querySelectorAll('[data-transcribir]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); b.disabled = true; ctx.enviar({ tipo: 'canteReintentar', id: b.dataset.transcribir }); });
    el.querySelectorAll('[data-ver]').forEach((tr) => tr.onclick = () => { ctx.estado.canteVer = tr.dataset.ver; ctx.guardar(); ctx.enviar({ tipo: 'canteVer', id: tr.dataset.ver }); });
    el.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => {
      const a = b.dataset.c, id = detalle && detalle.id;
      if (a === 'empezar') { b.disabled = true; ctx.enviar({ tipo: 'canteEmpezar', codigo: tema.value, objetivo: obj.value, micro: mic.value }); setTimeout(() => { b.disabled = false; }, 4000); }
      if (a === 'terminar') { b.disabled = true; b.textContent = 'Guardando…'; ctx.enviar({ tipo: 'canteTerminar' }); }
      if (a === 'descartar') ctx.enviar({ tipo: 'canteDescartar' });
      if (a === 'instalar') ctx.enviar({ tipo: 'canteInstalar' });
      if (a === 'audio') ctx.enviar({ tipo: 'canteAudio', id });
      if (a === 'copiar') ctx.enviar({ tipo: 'canteCopiar', id });
      if (a === 'reintentar') { b.disabled = true; ctx.enviar({ tipo: 'canteReintentar', id }); }
      if (a === 'cancelar') { b.disabled = true; ctx.enviar({ tipo: 'canteCancelar' }); }
      if (a === 'eliminar') ctx.enviar({ tipo: 'canteEliminar', id });
    });
  }

  window.TCEE_CANTE = {
    pintar,
    estado,
    seleccionar(id) { if (ctx) { ctx.estado.canteVer = id; ctx.guardar(); } },
    detalle(d) { detalle = d; if (!d) { ctx.estado.canteVer = null; ctx.guardar(); } if (el && C && !C.grabando) render(); },
    micros(l) { micros = l || []; if (el && C && !C.grabando) render(); },
  };
})();
