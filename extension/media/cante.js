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
  // audios adjuntos por juntar: {archivos: [{ruta, nombre, fecha, duracion}], fecha: 'aaaa-mm-ddThh:mm'}
  let adj = null, juntando = false;
  let verAudio = null;        // id del cante guardado cuyo audio se ha vuelto a mostrar («Recuperar audio»)
  // escucha y marcas del cante abierto. El reproductor vive fuera de la página para que un repintado no corte el audio
  const AUD = new Audio(); AUD.preload = 'auto';
  let ESC = null;            // {id, url, onda, paso, error}
  let descIni = null;        // inicio de un descarte a medio marcar (s)
  let arrastre = null;       // 'ini' | 'fin' mientras se arrastra un límite de la exposición
  let guardarT = null;

  // ---- tramos (mismas reglas que normalizarTramos/calcularTramos de extension/cante.js; CANTE.md, apartado 6)
  const r1 = (x) => Math.round(x * 100) / 100;   // centésimas: se marcan palabras sueltas
  function normalizar(t, dur) {
    const lim = (x) => r1(Math.max(0, Math.min(dur || 0, Number(x) || 0)));
    let exposicion = null;
    if (t && Array.isArray(t.exposicion)) { const [a, b] = t.exposicion.map(lim).sort((x, y) => x - y); if (b - a >= 0.05) exposicion = [a, b]; }
    const ds = ((t && t.descartar) || []).map((d) => d.map(lim).sort((x, y) => x - y)).filter(([a, b]) => b - a >= 0.05).sort((x, y) => x[0] - y[0]);
    const descartar = [];
    for (const d of ds) { const u = descartar[descartar.length - 1]; if (u && d[0] <= u[1]) u[1] = Math.max(u[1], d[1]); else descartar.push(d.slice()); }
    return { exposicion, descartar };
  }
  function restar([a, b], ds) { const r = []; let x = a; for (const [c, d] of ds) { if (d <= x || c >= b) continue; if (c > x) r.push([x, c]); x = Math.max(x, d); } if (x < b) r.push([x, b]); return r; }
  const largo = (xs) => xs.reduce((n, [a, b]) => n + (b - a), 0);
  function calcular(f) {
    const dur = Number(f.duracion) || 0, t = normalizar(f.tramos, dur), expo = t.exposicion || [0, dur];
    const exposicion = restar(expo, t.descartar);
    const complementario = t.exposicion ? [...restar([0, expo[0]], t.descartar), ...restar([expo[1], dur], t.descartar)] : [];
    return { t, marcado: !!(t.exposicion || t.descartar.length), exposicion, complementario, descartar: t.descartar, real: Math.round(largo(exposicion)) };
  }
  // palabras con su instante; los cantes transcritos antes de la v0.44 solo tienen frases: cada frase cuenta como una «palabra»
  const palabrasDe = (seg) => (seg.palabras && seg.palabras.length ? seg.palabras : [[seg.t, seg.texto]]);
  const contar = (x) => String(x).split(/\s+/).filter(Boolean).length;
  const palabrasExpoDe = (f, c) => (f.segmentos || []).flatMap(palabrasDe).filter(([t]) => tipoEn(c, t) === 'exposicion').reduce((n, [, w]) => n + contar(w), 0);
  let W = [];                // palabras del cante abierto: [{s, p, t, w, tipo}] (p = null si es una frase entera)
  let selK = null;           // [primera, última] palabra seleccionada en el texto
  // ---- voces (CANTE.md, apartado 8): hablante de un instante; mismas reglas que hablanteEn de extension/voces.js
  function hablanteEn(tramos, t) {
    if (!tramos || !tramos.length) return null;
    let mejor = null, dist = Infinity;
    for (const [a, b, h] of tramos) { if (t >= a && t < b) return h; const d = t < a ? a - t : t - b; if (d < dist) { dist = d; mejor = h; } if (a > t + dist) break; }
    return mejor;
  }
  const tipoEn = (c, x) => { const en = (xs) => xs.some(([a, b]) => x >= a && x < b); return en(c.descartar) ? 'descartado' : en(c.complementario) ? 'complementario' : 'exposicion'; };

  function pintar(elemento, datos, contexto) {
    el = elemento; D = datos; C = datos.cante; ctx = contexto;
    if (!micros && !C.falta.includes('ffmpeg')) ctx.enviar({ tipo: 'canteMicros' });
    const v = ctx.estado.canteVer, enLista = v && C.lista.find((f) => f.id === v);
    if (v && !enLista) { ctx.estado.canteVer = null; detalle = null; ctx.guardar(); }
    else if (v && (!detalle || detalle.id !== v || detalle.estado !== enLista.estado)) ctx.enviar({ tipo: 'canteVer', id: v });
    const firma = JSON.stringify([C.lista, C.falta, C.cola, C.transcribiendo && C.transcribiendo.id, C.identificando && C.identificando.id, C.voces, !!C.grabando, D.temas.length, C.abierto, C.semana]);
    if (firma === ultimaFirma && el.querySelector('.cante')) return;
    ultimaFirma = firma;
    render();
  }
  let ultimaFirma = null;

  let seleccionando = false, repintarLuego = false;
  function render() {
    // a mitad de una selección con el ratón no se repinta (se perdería): se hace al soltar
    if (seleccionando) { repintarLuego = true; return; }
    const dcha = el.querySelector('.cante-dcha'), scD = dcha ? dcha.scrollTop : 0;
    renderAhora();
    const d2 = el.querySelector('.cante-dcha'); if (d2) d2.scrollTop = scD;   // el texto no salta arriba al marcar
  }
  function renderAhora() {
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
      <p class="cante-botones"><button class="primario grande" data-c="empezar" ${adj ? 'disabled' : ''}>● Empezar cante</button>
        <button class="grande" data-c="adjuntar" ${juntando ? 'disabled' : ''}>📎 Adjuntar audio</button></p>
      ${adj ? adjuntos() : `<p class="apagado">Al pulsar <em>Empezar cante</em> arrancan a la vez el cronómetro y la grabación. No verás el texto mientras hablas.
        Con <em>Adjuntar audio</em> eliges uno o varios audios ya grabados (notas de voz, WhatsApp…), que se juntan en un único cante.
        En los dos casos, el cante se guarda y lo transcribes con <em>Transcribir</em> cuando te venga bien.</p>`}</section>`;
  }

  /** Tarjeta de los audios elegidos: orden, fecha del cante y «Juntar» */
  function adjuntos() {
    const xs = adj.archivos;
    const total = xs.reduce((n, x) => n + (x.duracion || 0), 0);
    return `<div class="cante-adj">
      <p><strong>${xs.length === 1 ? '1 audio' : `${xs.length} audios`}</strong> · ${esc(reloj(total))} en total. Se juntan en este orden:</p>
      <ol class="cante-adj-lista">${xs.map((x, i) => `<li><span class="cante-adj-nombre" title="${esc(x.ruta)}">${esc(x.nombre)}</span>
        <span class="apagado">${x.duracion != null ? esc(reloj(x.duracion)) : '¿?'} · ${x.fecha ? esc(fechaCorta(x.fecha)) : ''}</span>
        <span class="cante-adj-bot"><button data-a="subir" data-i="${i}" ${i ? '' : 'disabled'} title="Subir">↑</button><button data-a="bajar" data-i="${i}" ${i < xs.length - 1 ? '' : 'disabled'} title="Bajar">↓</button><button data-a="quitar" data-i="${i}" title="Quitar">✕</button></span></li>`).join('')}</ol>
      <label class="cante-campo">Fecha del cante<input id="c-fecha" type="datetime-local" value="${esc(adj.fecha)}"></label>
      <p class="apagado">Por defecto, la fecha del audio más antiguo. Tus ficheros no se modifican: se crea una copia unida.</p>
      <p class="cante-botones"><button class="primario" data-c="juntar" ${juntando || !xs.length ? 'disabled' : ''}>${juntando ? 'Juntando…' : xs.length > 1 ? 'Juntar y crear el cante' : 'Crear el cante'}</button>
        <button data-c="adjMas" ${juntando ? 'disabled' : ''}>Añadir más</button> <button data-c="adjCancelar" ${juntando ? 'disabled' : ''}>Cancelar</button></p></div>`;
  }
  const local = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function fechaPorDefecto() { const fs_ = adj.archivos.map((x) => x.fecha).filter(Boolean).sort(); return fs_.length ? local(fs_[0]) : local(new Date().toISOString()); }

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
        const dur = f.marcado ? f.real : f.duracion;
        const pasado = f.objetivo && dur > f.objetivo;
        const ppm = f.palabrasExpo && dur ? Math.round(f.palabrasExpo / (dur / 60)) : '';
        return `<tr class="${ctx.estado.canteVer === f.id ? 'sel' : ''}" data-ver="${esc(f.id)}">
          <td class="nowrap">${esc(fechaCorta(f.fecha))}</td><td><strong>${esc(f.codigo)}</strong> ${ESTADOS[f.estado] ? `<span class="etiqueta ${f.estado === 'error' ? 'mal' : ''}">${esc(ESTADOS[f.estado])}</span>` : ''}${enMarcha(f.id) ? ' <span class="etiqueta">transcribiendo</span>' : ''}${f.guardado ? ' <span title="Guardado: no se puede editar">🔒</span>' : ''}</td>
          <td class="num ${pasado ? 'pasado' : ''}" ${f.marcado ? `title="Exposición marcada; el audio dura ${esc(reloj(f.duracion))}"` : ''}>${esc(reloj(dur))}${f.marcado ? '<span class="cante-marcado">✂</span>' : ''}${f.objetivo ? ` <span class="apagado">/ ${esc(reloj(f.objetivo))}</span>` : ''}</td>
          <td class="num">${ppm}</td></tr>`;
      }).join('')}</tbody></table></section>`;
  }

  function vistaDetalle() {
    const f = detalle;
    if (!f) return '<p class="apagado cante-vacio">Elige un cante del historial para leer su transcripción.</p>';
    const c = calcular(f), dur = c.real;
    const palabrasExpo = palabrasExpoDe(f, c);
    const ppm = palabrasExpo && dur ? Math.round(palabrasExpo / (dur / 60)) : null;
    const dif = f.objetivo ? dur - f.objetivo : null;
    // párrafos de aproximadamente un minuto y del mismo tipo (exposición, complementario, descartado), con la marca de tiempo al margen
    // cada palabra lleva su tipo, así que un párrafo puede cortarse a mitad de frase
    const mismo = W.length && W.cante === f.id;
    W = []; W.cante = f.id; if (!mismo) selK = null;
    (f.segmentos || []).forEach((sg, si) => { const conP = !!(sg.palabras && sg.palabras.length);
      palabrasDe(sg).forEach(([t, w], pi) => W.push({ s: si, p: conP ? pi : null, t, w, tipo: tipoEn(c, t), h: f.voces ? hablanteEn(f.voces.tramos, t) : null })); });
    const parrafos = [];
    W.forEach((x, k) => { const ult = parrafos[parrafos.length - 1], cambioFrase = !k || W[k - 1].s !== x.s;
      if (!ult || ult.tipo !== x.tipo || ult.h !== x.h || (cambioFrase && x.t - ult.t >= 60)) parrafos.push({ t: x.t, tipo: x.tipo, h: x.h, ks: [k] }); else ult.ks.push(k); });
    if (selK && (selK[1] >= W.length)) selK = null;
    const porFrase = W.length && W.some((x) => x.p == null);
    // ✕ al principio de cada bloque marcado: quita esa marca (la exposición entera o ese descarte)
    const primeraExpo = c.t.exposicion ? parrafos.findIndex((p) => p.tipo === 'exposicion') : -1;
    const quitarDe = (p, i) => {
      if (p.tipo === 'exposicion' && i === primeraExpo) return { q: 'e', titulo: 'Quitar la marca de exposición (todo vuelve a contar como exposición)' };
      if (p.tipo === 'descartado') {
        const t0 = W[p.ks[0]].t, d = c.descartar.findIndex(([a, b]) => t0 >= a && t0 < b);
        const prev = p.ks[0] > 0 ? W[p.ks[0] - 1] : null;
        if (d >= 0 && !(prev && prev.tipo === 'descartado' && prev.t >= c.descartar[d][0])) return { q: `d${d}`, titulo: 'Quitar este descarte' };
      }
      return null;
    };
    const enLista = C.lista.find((x) => x.id === f.id);
    const hayAudio = enLista ? enLista.audioExiste : true;
    const bloq = !!f.guardado;   // guardado: solo la transcripción de la exposición (CANTE.md, apartado 7)
    if (verAudio && verAudio !== f.id) verAudio = null;
    const conAudio = hayAudio && (!bloq || verAudio === f.id);
    const visibles = bloq ? parrafos.filter((p) => p.tipo === 'exposicion') : parrafos;
    const hsV = f.voces ? Object.keys(f.voces.nombres || {}).map(Number).sort((a, b) => a - b) : [];
    const nuevaV = hsV.length ? Math.max(...hsV) + 1 : 0;
    return `<div class="cante-detalle${bloq ? ' bloqueado' : ''}">
      <h3>${esc(f.codigo)} · ${esc(f.titulo)}</h3>
      <p class="apagado">${esc(fecha(f.fecha))} · ${c.marcado ? `exposición ${esc(reloj(dur))} <span class="cante-de">(audio de ${esc(reloj(f.duracion))})</span>` : esc(reloj(f.duracion))}${dif != null ? ` (${dif > 0 ? '+' : '−'}${esc(reloj(Math.abs(dif)))} ${dif > 0 ? 'sobre' : 'bajo'} el objetivo de ${esc(minutos(f.objetivo))})` : ''}${ppm ? ` · ${ppm} palabras/min` : ''}${f.origen === 'adjunto' ? ` · adjuntado (${esc((f.archivos || []).length)} ${(f.archivos || []).length === 1 ? 'audio' : 'audios'})` : ''}</p>
      ${conAudio ? marcas(f, c) : hayAudio ? '' : '<p class="apagado">El audio de este cante no está en este Mac (los audios no se sincronizan por GitHub): no se pueden marcar tramos.</p>'}
      <p class="cante-botones">
        ${bloq ? `<span class="cante-candado" title="Guardado el ${esc(fecha(f.guardado))}">🔒 Guardado</span><button data-c="editar">Editar</button>
          ${hayAudio ? `<button data-c="verAudio">${verAudio === f.id ? 'Ocultar audio' : '🎧 Recuperar audio'}</button>` : ''}`
    : `<button class="primario" data-c="guardar" ${f.estado === 'transcrito' && !enMarcha(f.id) ? '' : 'disabled title="Se puede guardar cuando esté transcrito"'}>💾 Guardar</button>`}
        ${(f.estado === 'error' || f.estado === 'pendiente') && !enMarcha(f.id) && !bloq ? '<button class="primario" data-c="reintentar">Transcribir</button>' : ''}
        <button class="peligro" data-c="eliminar">Eliminar</button></p>
      ${bloq ? '' : seccionVoces(f, bloq, hayAudio)}
      ${f.estado === 'error' ? `<p class="rel-div es-error">${esc(f.error || 'Error al transcribir.')}</p>` : ''}
      ${f.estado === 'pendiente' && !enMarcha(f.id) ? '<p class="apagado">Pendiente de transcribir. Tarda unos minutos y el Mac trabaja a tope (gasta batería): mejor con el cargador puesto.</p>' : ''}
      ${enMarcha(f.id) ? '<p class="apagado">Transcribiendo…</p>' : ''}
      ${parrafos.length ? `${bloq ? '' : `<div class="cante-seltxt" id="c-seltxt">
          <div class="cante-seltxt-f"><span class="apagado" id="c-selinfo"></span><button data-s="no" class="enlace" style="visibility:hidden">Quitar selección</button></div>
          <div class="cante-seltxt-f"><button data-s="expo" disabled>Exposición = selección</button><button data-s="desc" disabled>Descartar selección</button>
          ${f.voces ? `<span class="cante-seltxt-voz"><span class="apagado">Voz:</span>${hsV.map((h) => `<button data-sv="${h}" disabled title="Las palabras seleccionadas las dice ${esc(nombreVoz(f, h))}"><i class="cante-punto v${h % 6}"></i> ${esc(nombreVoz(f, h))}</button>`).join('')}<button data-sv="${nuevaV}" disabled title="Otra voz distinta"><i class="cante-punto v${nuevaV % 6}"></i> Otra</button></span>` : ''}</div></div>`}
        ${porFrase && !bloq ? `<p class="apagado cante-aviso-frase">Este cante se transcribió sin el instante de cada palabra: al seleccionar se marca la frase entera (unos segundos de margen).
          ${!enMarcha(f.id) && hayAudio ? '<button class="enlace" data-c="retranscribir">Volver a transcribir con precisión por palabra</button>' : ''}</p>` : ''}
        <div class="cante-texto" id="c-texto">${visibles.map((p, i) => { const qx = bloq ? null : quitarDe(p, i); return `<p class="t-${p.tipo}${qx ? ' con-marca' : ''}"><span class="cante-t" data-ir="${p.t}" title="Escuchar desde aquí">${esc(reloj(p.t))}</span><span>${p.h != null ? `<span class="cante-voz v${p.h % 6}${bloq ? '' : ' clic'}" ${bloq ? '' : `data-hk="${p.ks[0]}" title="Cambiar la voz de esta intervención"`}>${esc(nombreVoz(f, p.h))}</span> ` : ''}${qx ? `<button class="cante-quitar" data-quitar="${qx.q}" title="${esc(qx.titulo)}">✕</button>` : ''}${p.tipo !== 'exposicion' ? `<em class="cante-tipo">${p.tipo === 'complementario' ? 'Material complementario' : 'Descartado'}</em> ` : (qx ? '<em class="cante-tipo">Exposición</em> ' : '')}${p.ks.map((k) => `<span class="w" data-k="${k}">${esc(W[k].w)}</span>`).join(' ')}</span></p>`; }).join('')}</div>`
        : f.estado === 'transcrito' ? '<p class="apagado">La transcripción está vacía: no se reconoció voz en la grabación.</p>' : ''}
    </div>`;
  }

  /** Pone la voz h en [a, b] y deja el resto como estaba (parte los tramos que se solapan y une los seguidos de la misma voz) */
  function asignarVoz(tramos, a, b, h) {
    const r = [];
    for (const [x, y, k] of tramos) { if (y <= a || x >= b) r.push([x, y, k]); else { if (x < a) r.push([x, a, k]); if (y > b) r.push([b, y, k]); } }
    r.push([a, b, h]); r.sort((p, q) => p[0] - q[0]);
    const m = []; for (const t of r) { const u = m[m.length - 1]; if (u && u[2] === t[2] && t[0] - u[1] < 0.05) u[1] = Math.max(u[1], t[1]); else m.push(t.slice()); }
    return m.map(([x, y, k]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100, k]);
  }
  /** Lista de voces junto a «ancla»: la elegida pasa a ser la de [a, b] (solo ese trozo) */
  function menuVoz(ancla, a, b, actual) {
    document.querySelectorAll('.cante-menuvoz').forEach((x) => x.remove());
    const f = detalle; if (!f || !f.voces) return;
    const hs = Object.keys(f.voces.nombres || {}).map(Number).sort((x, y) => x - y), nueva = hs.length ? Math.max(...hs) + 1 : 0;
    const m = document.createElement('div'); m.className = 'cante-menuvoz';
    m.innerHTML = `<p class="apagado">${esc(reloj(a))} – ${esc(reloj(b))}: ¿quién habla?</p>${hs.map((h) => `<button data-mv="${h}" ${h === actual ? 'disabled' : ''}><i class="cante-punto v${h % 6}"></i> ${esc(nombreVoz(f, h))}</button>`).join('')}
      <button data-mv="${nueva}"><i class="cante-punto v${nueva % 6}"></i> Otra voz (Hablante ${nueva + 1})</button>`;
    document.body.appendChild(m);
    const r = ancla.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.left))}px`;
    m.style.top = `${r.bottom + m.offsetHeight + 6 > window.innerHeight ? Math.max(8, r.top - m.offsetHeight - 6) : r.bottom + 6}px`;
    const fuera = (ev) => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera, true); } };
    setTimeout(() => document.addEventListener('mousedown', fuera, true), 0);
    m.querySelectorAll('[data-mv]').forEach((x) => x.onclick = () => {
      const h = Number(x.dataset.mv);
      m.remove(); document.removeEventListener('mousedown', fuera, true);
      f.voces.tramos = asignarVoz(f.voces.tramos, a, b, h);
      if (!(h in f.voces.nombres)) f.voces.nombres = { ...f.voces.nombres, [h]: `Hablante ${h + 1}` };
      selK = null; selAncla = null;
      ctx.enviar({ tipo: 'canteVocesTramos', id: f.id, tramos: f.voces.tramos, nombres: f.voces.nombres });
      render();
    });
  }
  const nombreVoz = (f, h) => ((f.voces && f.voces.nombres) || {})[h] || `Hablante ${h + 1}`;
  const selectorVoces = () => `<select id="c-nvoces" title="Cuántas voces hay en la grabación">${[[0, 'Nº de voces: automático'], [2, '2 voces'], [3, '3 voces'], [4, '4 voces']]
    .map(([v, t]) => `<option value="${v}" ${Number(ctx.estado.canteNVoces || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  /** Identificar voces: botón, avance o leyenda con los nombres (editables) y el tiempo de cada voz */
  function seccionVoces(f, bloq, hayAudio) {
    const iv = C.identificando;
    if (iv && iv.id === f.id) return `<section class="cante-voces"><p><strong>👥 Identificando voces…</strong> <span id="c-vpct">${iv.pct || 0} %</span></p><span class="pct ancho"><span id="c-vbarra" style="width:${iv.pct || 0}%"></span></span>
      <p class="apagado">Tarda unos minutos y el Mac trabaja a tope; puedes seguir con otra cosa.</p></section>`;
    if (f.estado !== 'transcrito' || !hayAudio) return '';
    if (!f.voces) {
      if (bloq) return '';
      if (!C.voces) return `<section class="cante-voces"><p class="apagado">👥 Para distinguir quién habla (tú, la preparadora…) falta instalar «Identificar voces» (unos 70 MB).</p>
        <p><button data-c="instalar">Instalar herramientas de cante</button></p></section>`;
      return `<section class="cante-voces"><p class="cante-botones"><button data-c="voces" ${iv ? 'disabled title="Hay otra identificación en marcha"' : ''}>👥 Identificar voces</button>${selectorVoces()}</p>
        <p class="apagado">Distingue quién habla en cada momento. Funciona mejor con voces claras que no se pisen; si sabes cuántas voces hay, elígelo.</p></section>`;
    }
    const seg = {}; for (const [a, b, h] of f.voces.tramos) seg[h] = (seg[h] || 0) + (b - a);
    const hs = Object.keys(f.voces.nombres || {}).map(Number).sort((a, b) => a - b);
    return `<section class="cante-voces"><p class="cante-voces-ley">👥 ${hs.map((h) => `<span class="cante-voz-ed"><i class="cante-punto v${h % 6}"></i>
        <input type="text" data-voz="${h}" value="${esc(nombreVoz(f, h))}" ${bloq ? 'disabled' : ''} title="Nombre de esta voz"> <span class="apagado">${esc(reloj(seg[h] || 0))}</span></span>`).join('')}</p>
      ${bloq ? '' : `<p class="cante-botones"><button class="enlace" data-c="voces" ${iv ? 'disabled' : ''}>Volver a identificar</button>${selectorVoces()}</p>`}</section>`;
  }

  // ------------------------------------------------------------ escucha y marcas (CANTE.md, apartado 6)
  function marcas(f, c) {
    const listo = ESC && ESC.id === f.id && ESC.url;
    if (!ESC || ESC.id !== f.id) { ESC = { id: f.id }; AUD.pause(); AUD.removeAttribute('src'); descIni = null; ctx.enviar({ tipo: 'canteEscucha', id: f.id }); }
    if (ESC.error) return '<p class="rel-div es-error">No se pudo preparar el audio para escucharlo aquí.</p>';
    if (!listo) return '<p class="apagado">Preparando el audio para escucharlo y marcar tramos…</p>';
    const e = c.t.exposicion;
    const comp = largo(c.complementario), desc = largo(c.descartar);
    return `<section class="cante-marcas">
      <div class="cante-repro"><button class="primario" data-r="play">${AUD.paused ? '▶' : '❚❚'}</button>
        <span class="cante-pos"><span id="c-pos">${esc(reloj(AUD.currentTime || 0))}</span> / ${esc(reloj(f.duracion))}</span>
        <button data-r="-10" title="Atrás 10 s">−10 s</button><button data-r="-2" title="Atrás 2 s">−2 s</button><button data-r="+2" title="Adelante 2 s">+2 s</button><button data-r="+10" title="Adelante 10 s">+10 s</button>
        <select id="c-vel" title="Velocidad">${[1, 1.25, 1.5, 2].map((v) => `<option value="${v}" ${AUD.playbackRate === v ? 'selected' : ''}>${String(v).replace('.', ',')}×</option>`).join('')}</select></div>
      <canvas id="c-onda" class="cante-onda" height="90"></canvas>
      <div class="cante-leyenda"><span class="l-expo">Exposición</span>${e ? '<span class="l-comp">Material complementario</span>' : ''}${c.descartar.length || descIni != null ? '<span class="l-desc">Descartado</span>' : ''}
        <span class="apagado">Pulsa en la onda para ir a ese punto${e && !f.guardado ? '; arrastra los bordes de la exposición para ajustarlos' : ''}.</span></div>
      ${f.guardado ? '' : `<p class="cante-botones">
        <button data-m="ini" title="La exposición empieza en el punto que suena ahora">⟦ Inicio de la exposición aquí</button>
        <button data-m="fin" title="La exposición termina en el punto que suena ahora">Fin de la exposición aquí ⟧</button>
        <button data-m="desc" class="${descIni != null ? 'activo' : ''}">${descIni != null ? `✂ Fin del descarte aquí (desde ${esc(reloj(descIni))})` : '✂ Descartar desde aquí'}</button>
        ${descIni != null ? '<button data-m="descNo">Cancelar descarte</button>' : ''}</p>`}
      <p class="cante-resumen">${e ? `Exposición de <a data-ir="${e[0]}">${esc(reloj(e[0]))}</a> a <a data-ir="${e[1]}">${esc(reloj(e[1]))}</a>: <strong>${esc(reloj(c.real))}</strong> reales${comp ? ` · material complementario ${esc(reloj(comp))}` : ''}`
        : `Sin marcar: todo el audio cuenta como exposición (<strong>${esc(reloj(c.real))}</strong>).`}${desc ? ` · descartado ${esc(reloj(desc))}` : ''}
        ${e && !f.guardado ? ' <button class="enlace" data-m="quitarExpo">Quitar la exposición</button>' : ''}</p>
      ${c.descartar.length ? `<ul class="cante-descartes">${c.descartar.map(([a, b], i) => `<li>Descartado <a data-ir="${a}">${esc(reloj(a))}</a>–<a data-ir="${b}">${esc(reloj(b))}</a> ${f.guardado ? '' : `<button class="enlace" data-m="descQuitar" data-i="${i}">quitar</button>`}</li>`).join('')}</ul>` : ''}
    </section>`;
  }

  /** Cambia los tramos del cante abierto, repinta y guarda (con un pequeño retraso, por si se arrastra) */
  function cambiarTramos(t) {
    const f = detalle; if (!f) return;
    f.tramos = normalizar(t, f.duracion);
    if (!f.tramos.exposicion && !f.tramos.descartar.length) delete f.tramos;
    const c = calcular(f), x = C.lista.find((y) => y.id === f.id);
    if (x) { x.marcado = c.marcado; x.real = c.real; x.palabrasExpo = palabrasExpoDe(f, c); }
    clearTimeout(guardarT); guardarT = setTimeout(() => ctx.enviar({ tipo: 'canteTramos', id: f.id, tramos: f.tramos || null }), arrastre ? 600 : 150);
    if (!arrastre) render(); else dibujar();
  }
  const tramosActuales = () => normalizar(detalle && detalle.tramos, detalle && detalle.duracion);

  function dibujar() {
    const cv = el && el.querySelector('#c-onda'); const f = detalle;
    if (!cv || !f || !ESC || !ESC.onda) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const dur = f.duracion || 1, X = (t) => (t / dur) * w, css = getComputedStyle(document.body);
    const col = (v, d) => (css.getPropertyValue(v) || d).trim() || d;
    const c = calcular(f);
    const banda = (xs, color) => { g.fillStyle = color; xs.forEach(([a, b]) => g.fillRect(X(a), 0, Math.max(1, X(b) - X(a)), h)); };
    banda(c.exposicion, 'rgba(60, 170, 110, .20)');
    banda(c.complementario, 'rgba(210, 150, 40, .20)');
    banda(c.descartar, 'rgba(128, 128, 128, .35)');
    if (descIni != null) banda([[Math.min(descIni, AUD.currentTime), Math.max(descIni, AUD.currentTime)]], 'rgba(128, 128, 128, .25)');
    // onda: el pico más alto de cada columna
    const o = ESC.onda, n = o.length, mid = h / 2;
    g.fillStyle = col('--vscode-foreground', '#888'); g.globalAlpha = 0.65;
    for (let px = 0; px < w; px++) {
      const i0 = Math.floor((px / w) * n), i1 = Math.max(i0 + 1, Math.floor(((px + 1) / w) * n));
      let m = 0; for (let i = i0; i < i1 && i < n; i++) if (o[i] > m) m = o[i];
      const a = Math.max(1, (m / 100) * (h / 2 - 4)); g.fillRect(px, mid - a, 1, a * 2);
    }
    g.globalAlpha = 1;
    const e = c.t.exposicion;
    if (e) { g.fillStyle = 'rgb(40, 150, 90)'; [e[0], e[1]].forEach((t) => g.fillRect(X(t) - 1.5, 0, 3, h)); }
    g.fillStyle = col('--vscode-editorCursor-foreground', '#e55'); g.fillRect(X(AUD.currentTime || 0) - 1, 0, 2, h);
  }

  function irA(t, tocar) {
    if (!ESC || !ESC.url) return;
    AUD.currentTime = Math.max(0, Math.min((detalle && detalle.duracion) || 0, Number(t) || 0));
    if (tocar && AUD.paused) AUD.play().catch(() => {});
    actualizarPos();
  }
  let wActual = null;
  function resaltarPalabra() {
    if (!el || !W.length || !ESC || !ESC.url) return;
    const t = AUD.currentTime || 0; let lo = 0, hi = W.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (W[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    const sp = k >= 0 ? el.querySelector(`.w[data-k="${k}"]`) : null;
    if (sp === wActual) return;
    if (wActual) wActual.classList.remove('actual');
    wActual = sp; if (sp) sp.classList.add('actual');
  }
  function actualizarPos() {
    resaltarPalabra();
    const p = el && el.querySelector('#c-pos'); if (p) p.textContent = reloj(AUD.currentTime || 0);
    const b = el && el.querySelector('[data-r="play"]'); if (b) b.textContent = AUD.paused ? '▶' : '❚❚';
    dibujar();
  }
  AUD.addEventListener('timeupdate', actualizarPos);
  AUD.addEventListener('play', actualizarPos);
  AUD.addEventListener('pause', actualizarPos);
  AUD.addEventListener('seeked', actualizarPos);
  window.addEventListener('resize', () => dibujar());

  // ---- marcar seleccionando el texto y corregir palabras
  // La selección es propia, palabra a palabra (no la del navegador): pulsar una palabra la elige; arrastrar amplía hasta la palabra
  // sobre la que se suelta; Mayúsculas + clic amplía desde la palabra elegida antes; Esc la quita.
  let selAncla = null;
  function pintarSeleccion() {
    const caja = el && el.querySelector('#c-texto'), info = el && el.querySelector('#c-selinfo');
    if (caja) {
      caja.querySelectorAll('.w.sel').forEach((x) => x.classList.remove('sel'));
      if (selK) for (let k = selK[0]; k <= selK[1]; k++) { const sp = caja.querySelector(`.w[data-k="${k}"]`); if (sp) sp.classList.add('sel'); }
    }
    el && el.querySelectorAll('[data-s="expo"], [data-s="desc"], [data-sv]').forEach((b) => { b.disabled = !selK || !ESC || !ESC.url; });
    const no = el && el.querySelector('[data-s="no"]'); if (no) no.style.visibility = selK ? 'visible' : 'hidden';   // sin mover nada de sitio
    if (info) {
      if (selK) { const [a, b] = tramoSel(), n = selK[1] - selK[0] + 1; info.textContent = `Selección: ${n === 1 ? '1 palabra' : `${n} palabras`}, ${reloj(a)} – ${reloj(b)}`; }
      else info.textContent = 'Pulsa o arrastra sobre las palabras para seleccionar';
      info.title = `Pulsa una palabra (o arrastra hasta otra) para seleccionar; Mayúsculas + clic amplía; Esc quita la selección. Doble clic corrige ${W.some((x) => x.p == null) ? 'la frase' : 'la palabra'}.`;
    }
  }
  /** Instantes [inicio, fin] de la selección: desde la primera palabra hasta el comienzo de la siguiente a la última */
  function tramoSel() { const [a, b] = selK; return [W[a].t, b + 1 < W.length ? W[b + 1].t : detalle.duracion]; }
  const palabraEn = (x, y) => { const e = document.elementFromPoint(x, y); const w = e && e.closest && e.closest('#c-texto .w'); return w ? Number(w.dataset.k) : null; };
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && selK && !document.querySelector('.cante-editor')) { selK = null; selAncla = null; pintarSeleccion(); } });

  function conectarSeleccion(caja) {
    caja.onmousedown = (ev) => {
      if (ev.button !== 0) return;   // (el doble clic, además, abre la corrección)
      const sp = ev.target.closest('.w'); if (!sp) return;
      ev.preventDefault(); window.getSelection().removeAllRanges();
      const k = Number(sp.dataset.k);
      if (ev.shiftKey && selAncla != null) selK = [Math.min(selAncla, k), Math.max(selAncla, k)];
      else { selAncla = k; selK = [k, k]; }
      pintarSeleccion();
      seleccionando = true;
      const dcha = el.querySelector('.cante-dcha');
      const mover = (e2) => {
        // cerca del borde de arriba o de abajo, el texto se desplaza solo
        if (dcha) { const r = dcha.getBoundingClientRect(); if (e2.clientY < r.top + 30) dcha.scrollTop -= 18; else if (e2.clientY > r.bottom - 30) dcha.scrollTop += 18; }
        const k2 = palabraEn(e2.clientX, e2.clientY);
        if (k2 != null && selAncla != null) { const n = [Math.min(selAncla, k2), Math.max(selAncla, k2)]; if (!selK || n[0] !== selK[0] || n[1] !== selK[1]) { selK = n; pintarSeleccion(); } }
      };
      const soltar = () => {
        document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
        seleccionando = false;
        if (repintarLuego) { repintarLuego = false; render(); }
      };
      document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
    };
  }

  function corregir(span) {
    const k = Number(span.dataset.k), x = W[k]; if (!x || !detalle) return;
    document.querySelectorAll('.cante-editor').forEach((e) => e.remove());
    const otras = x.p != null ? W.filter((y, i) => i !== k && y.p != null && y.w === x.w).length : 0;
    const ed = document.createElement('div'); ed.className = 'cante-editor';
    ed.innerHTML = `${x.p == null ? `<textarea rows="3">${esc(x.w)}</textarea>` : `<input type="text" value="${esc(x.w)}">`}
      ${otras ? `<label><input type="checkbox" id="c-todas"> Cambiar también las otras ${otras} apariciones de «${esc(x.w)}»</label>` : ''}
      <p class="cante-botones"><button class="primario" data-e="ok">Guardar</button><button data-e="no">Cancelar</button><span class="apagado">Vacío = borrar. Intro guarda, Esc cancela.</span></p>`;
    document.body.appendChild(ed);
    const r = span.getBoundingClientRect();
    ed.style.left = `${Math.max(8, Math.min(window.innerWidth - ed.offsetWidth - 8, r.left))}px`;
    ed.style.top = `${Math.min(window.innerHeight - ed.offsetHeight - 8, r.bottom + 6)}px`;
    const campo = ed.querySelector('input[type="text"], textarea'); campo.focus(); campo.select();
    const cerrar = () => ed.remove();
    const guardar = () => {
      const nuevo = campo.value.replace(/\s+/g, ' ').trim();
      const todas = !!(ed.querySelector('#c-todas') || {}).checked;
      cerrar();
      if (nuevo === x.w) return;
      const segs = JSON.parse(JSON.stringify(detalle.segmentos || []));
      const cambiar = (y) => { if (y.p == null) segs[y.s].texto = nuevo; else segs[y.s].palabras[y.p][1] = nuevo; };
      cambiar(x);
      if (todas) W.forEach((y) => { if (y.p != null && y.w === x.w) cambiar(y); });
      segs.forEach((sg) => { if (sg.palabras && sg.palabras.length) { sg.palabras = sg.palabras.filter((p) => p[1]); sg.texto = sg.palabras.map((p) => p[1]).join(' '); } });
      detalle.segmentos = segs.filter((sg) => sg.texto);
      detalle.texto = detalle.segmentos.map((sg) => sg.texto).join(' ');
      detalle.editado = true;
      ctx.enviar({ tipo: 'canteSegmentos', id: detalle.id, segmentos: detalle.segmentos });
      render();
    };
    ed.querySelector('[data-e="ok"]').onclick = guardar;
    ed.querySelector('[data-e="no"]').onclick = cerrar;
    campo.onkeydown = (ev) => { if (ev.key === 'Escape') cerrar(); if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); guardar(); } };
  }

  function conectarMarcas() {
    const caja = el.querySelector('#c-texto');
    if (caja && detalle && !detalle.guardado) {
      caja.ondblclick = (ev) => { const sp = ev.target.closest('.w'); if (!sp) return; window.getSelection().removeAllRanges(); corregir(sp); };
      conectarSeleccion(caja);
    }
    el.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
      if (b.dataset.s === 'no') { selK = null; selAncla = null; pintarSeleccion(); return; }
      if (!selK) return;
      const [a, z] = tramoSel(), t = tramosActuales();
      if (b.dataset.s === 'expo') t.exposicion = [a, z]; else t.descartar.push([a, z]);
      selK = null; selAncla = null;
      cambiarTramos(t);
    });
    // asignar las palabras seleccionadas a una voz: un botón por voz, sin menú
    el.querySelectorAll('[data-sv]').forEach((b) => b.onclick = () => {
      const f = detalle; if (!selK || !f || !f.voces) return;
      const [a, z] = tramoSel(), h = Number(b.dataset.sv);
      f.voces.tramos = asignarVoz(f.voces.tramos, a, z, h);
      if (!(h in f.voces.nombres)) f.voces.nombres = { ...f.voces.nombres, [h]: `Hablante ${h + 1}` };
      selK = null; selAncla = null;
      ctx.enviar({ tipo: 'canteVocesTramos', id: f.id, tramos: f.voces.tramos, nombres: f.voces.nombres });
      render();
    });
    el.querySelectorAll('[data-hk]').forEach((ch) => {
      ch.onmousedown = (ev) => ev.stopPropagation();   // no empieza una selección
      ch.onclick = (ev) => {
        ev.stopPropagation();
        // la intervención entera: las palabras seguidas de la misma voz
        let k0 = Number(ch.dataset.hk), k1 = k0; const h = W[k0].h;
        while (k0 > 0 && W[k0 - 1].h === h) k0--;
        while (k1 + 1 < W.length && W[k1 + 1].h === h) k1++;
        menuVoz(ch, W[k0].t, k1 + 1 < W.length ? W[k1 + 1].t : detalle.duracion, h);
      };
    });
    el.querySelectorAll('[data-quitar]').forEach((b) => b.onclick = (ev) => {
      ev.stopPropagation();
      const q = b.dataset.quitar, t = tramosActuales();
      if (q === 'e') t.exposicion = null; else t.descartar.splice(Number(q.slice(1)), 1);
      cambiarTramos(t);
    });
    pintarSeleccion();
    const cv = el.querySelector('#c-onda');
    if (cv && detalle) {
      const tEn = (ev) => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * detalle.duracion; };
      const borde = (ev) => { const e = tramosActuales().exposicion; if (!e || detalle.guardado) return null; const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, X = (t) => (t / detalle.duracion) * r.width;
        return Math.abs(x - X(e[0])) <= 6 ? 'ini' : Math.abs(x - X(e[1])) <= 6 ? 'fin' : null; };
      const cabezal = (ev) => { const r = cv.getBoundingClientRect(); return Math.abs(ev.clientX - r.left - ((AUD.currentTime || 0) / detalle.duracion) * r.width) <= 6; };
      cv.onmousemove = (ev) => { if (!arrastre) cv.style.cursor = borde(ev) ? 'ew-resize' : cabezal(ev) ? 'grab' : 'pointer'; };
      cv.onmousedown = (ev) => {
        const b = borde(ev);
        if (!b) {
          // pulsar lleva a ese punto y, sin soltar, se arrastra la línea del momento actual
          ev.preventDefault(); irA(tEn(ev)); cv.style.cursor = 'grabbing';
          const mover = (e2) => irA(tEn(e2));
          const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); cv.style.cursor = 'grab'; };
          document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
          return;
        }
        arrastre = b; ev.preventDefault();
        const mover = (e2) => { const t = tramosActuales(), x = t.exposicion.slice(); x[arrastre === 'ini' ? 0 : 1] = tEn(e2); t.exposicion = x; cambiarTramos(t); };
        const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); arrastre = null; cambiarTramos(tramosActuales()); };
        document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
      };
      dibujar();
    }
    if (ESC && ESC.url && AUD.getAttribute('src') !== ESC.url) AUD.src = ESC.url;
    const vel = el.querySelector('#c-vel'); if (vel) vel.onchange = () => { AUD.playbackRate = Number(vel.value) || 1; };
    el.querySelectorAll('[data-ir]').forEach((a) => a.onclick = () => irA(Number(a.dataset.ir), true));
    el.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
      const r = b.dataset.r;
      if (r === 'play') { if (AUD.paused) AUD.play().catch(() => {}); else AUD.pause(); return; }
      irA((AUD.currentTime || 0) + Number(r));
    });
    el.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
      const m = b.dataset.m, ahora = AUD.currentTime || 0, t = tramosActuales(), dur = detalle.duracion;
      if (m === 'ini') { const fin = t.exposicion && t.exposicion[1] > ahora + 1 ? t.exposicion[1] : dur; t.exposicion = [ahora, fin]; }
      if (m === 'fin') { const ini = t.exposicion && t.exposicion[0] < ahora - 1 ? t.exposicion[0] : 0; t.exposicion = [ini, ahora]; }
      if (m === 'quitarExpo') t.exposicion = null;
      if (m === 'desc') { if (descIni == null) { descIni = ahora; render(); return; } t.descartar.push([descIni, ahora]); descIni = null; }
      if (m === 'descNo') { descIni = null; render(); return; }
      if (m === 'descQuitar') t.descartar.splice(Number(b.dataset.i), 1);
      cambiarTramos(t);
    });
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
    else if (C.identificando) {
      const p = document.getElementById('c-vpct'), b = document.getElementById('c-vbarra');
      if (p && b) { p.textContent = `${C.identificando.pct} %`; b.style.width = `${C.identificando.pct}%`; }
    }
    if (!C.grabando && C.transcribiendo) {
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
    el.querySelectorAll('[data-ver]').forEach((tr) => tr.onclick = () => { ctx.estado.canteVer = tr.dataset.ver; ctx.guardar(); ctx.enviar({ tipo: 'canteVer', id: tr.dataset.ver }); });
    el.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => {
      const a = b.dataset.c, id = detalle && detalle.id;
      if (a === 'empezar') { b.disabled = true; ctx.enviar({ tipo: 'canteEmpezar', codigo: tema.value, objetivo: obj.value, micro: mic.value }); setTimeout(() => { b.disabled = false; }, 4000); }
      if (a === 'terminar') { b.disabled = true; b.textContent = 'Guardando…'; ctx.enviar({ tipo: 'canteTerminar' }); }
      if (a === 'descartar') ctx.enviar({ tipo: 'canteDescartar' });
      if (a === 'instalar') ctx.enviar({ tipo: 'canteInstalar' });
      if (a === 'reintentar') { b.disabled = true; ctx.enviar({ tipo: 'canteReintentar', id }); }
      if (a === 'cancelar') { b.disabled = true; ctx.enviar({ tipo: 'canteCancelar' }); }
      if (a === 'eliminar') ctx.enviar({ tipo: 'canteEliminar', id });
      if (a === 'adjuntar' || a === 'adjMas') ctx.enviar({ tipo: 'canteAdjuntarElegir' });
      if (a === 'adjCancelar') { adj = null; render(); }
      if (a === 'juntar' && adj) {
        const fe = sel('#c-fecha');
        juntando = true; render();
        ctx.enviar({ tipo: 'canteJuntar', codigo: (sel('#c-tema') || {}).value || ctx.estado.canteTema, objetivo: (sel('#c-obj') || {}).value, fecha: fe && fe.value ? new Date(fe.value).toISOString() : null, rutas: adj.archivos.map((x) => x.ruta) });
      }
      if (a === 'voces' && detalle) { b.disabled = true; const nv = sel('#c-nvoces'); ctx.enviar({ tipo: 'canteVoces', id: detalle.id, n: nv ? Number(nv.value) : 0 }); }
      if (a === 'verAudio' && detalle) { verAudio = verAudio === detalle.id ? null : detalle.id; if (!verAudio) AUD.pause(); render(); }
      if (a === 'guardar' && detalle) { b.disabled = true; ctx.enviar({ tipo: 'canteGuardar', id: detalle.id }); setTimeout(() => { b.disabled = false; }, 3000); }
      if (a === 'editar' && detalle) ctx.enviar({ tipo: 'canteEditar', id: detalle.id });
      if (a === 'retranscribir' && detalle) ctx.enviar({ tipo: 'canteRetranscribir', id: detalle.id });
    });
    const fe = sel('#c-fecha'); if (fe && adj) fe.onchange = () => { adj.fecha = fe.value; };
    const nv = sel('#c-nvoces'); if (nv) nv.onchange = () => { ctx.estado.canteNVoces = Number(nv.value); ctx.guardar(); };
    el.querySelectorAll('[data-voz]').forEach((i) => i.onchange = () => {
      if (!detalle || !detalle.voces) return;
      detalle.voces.nombres = { ...detalle.voces.nombres, [i.dataset.voz]: i.value.trim() || `Hablante ${Number(i.dataset.voz) + 1}` };
      ctx.enviar({ tipo: 'canteVocesNombres', id: detalle.id, nombres: detalle.voces.nombres });
      render();
    });
    el.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i), xs = adj.archivos;
      if (b.dataset.a === 'subir' && i > 0) [xs[i - 1], xs[i]] = [xs[i], xs[i - 1]];
      if (b.dataset.a === 'bajar' && i < xs.length - 1) [xs[i + 1], xs[i]] = [xs[i], xs[i + 1]];
      if (b.dataset.a === 'quitar') xs.splice(i, 1);
      if (!xs.length) adj = null;
      render();
    });
    conectarMarcas();
  }

  /** Respuestas de la extensión: audios elegidos, fin de «Juntar», copia para escuchar */
  function recibir(m) {
    if (m.tipo === 'canteAdjuntos') {
      const nuevos = (m.archivos || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      if (!adj) adj = { archivos: [], fecha: '' };
      const ya = new Set(adj.archivos.map((x) => x.ruta));
      adj.archivos.push(...nuevos.filter((x) => !ya.has(x.ruta)));
      adj.fecha = fechaPorDefecto();
      if (!adj.archivos.length) adj = null;
    }
    if (m.tipo === 'canteJuntado') { juntando = false; if (m.ok) adj = null; }
    if (m.tipo === 'canteEscucha') { if (!ESC || ESC.id !== m.id) return; ESC = m.error ? { id: m.id, error: true } : { id: m.id, url: m.url, onda: m.onda, paso: m.paso }; }
    if (el && C && !C.grabando) render();
  }

  window.TCEE_CANTE = {
    pintar,
    estado,
    seleccionar(id) { if (ctx) { ctx.estado.canteVer = id; ctx.guardar(); } },
    detalle(d) { detalle = d; if (!d) { ctx.estado.canteVer = null; ctx.guardar(); } if (el && C && !C.grabando) render(); },
    micros(l) { micros = l || []; if (el && C && !C.grabando) render(); },
    recibir,
    salir() { AUD.pause(); },   // al cambiar de pestaña, el audio no sigue sonando
  };
})();
