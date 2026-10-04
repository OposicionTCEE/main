// Calendario de vueltas (lado de la página). Vista mensual + detalle de la semana y del día + creación de calendarios.
// Lo usa panel.js: window.TCEE_CAL.pintar(el, D, ctx)
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const masDias = (s, n) => { const d = f(s); d.setDate(d.getDate() + n); return iso(d); };
  const largo = (s) => f(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const corto = (s) => f(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const mesTitulo = (a, m) => { const t = new Date(a, m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const parteDe = (c) => c.split('.')[1];
  const sinEj = (c) => c.replace(/^[34]\./, '');
  const PARTE_TXT = { entero: '', empieza: 'empieza', sigue: 'continúa', termina: 'termina' };
  // etiquetas de un tema: breve (en el calendario) y corto (resumen del contenido, como en el calendario de la preparadora)
  const et = (T, c) => (T && T[c]) || { breve: c, corto: c, titulo: c };

  let ctx = null; // {enviar, estado, guardar, repintar}

  function pintar(el, D, c) {
    ctx = c;
    const V = D.calendario;
    const st = ctx.estado;
    if (!V || !V.cal) { el.innerHTML = barra(V) + `<div class="cal-vacio"><p>Aún no hay ningún calendario.</p><button class="primario" data-cal-nuevo>Crear el primero</button></div>` + formulario(V); conectar(el, D); return; }
    const cal = V.cal;
    // mes visible: el guardado, o el del día de hoy si cae dentro del calendario, o el del primer cante
    const primero = cal.semanas[0].inicio, ultimo = cal.semanas[cal.semanas.length - 1].cante;
    if (!st.calMes) { const base = V.hoy >= primero && V.hoy <= ultimo ? V.hoy : primero; st.calMes = base.slice(0, 7); }
    // semana seleccionada: la elegida, o la de hoy, o la primera
    if (st.calSemana == null || st.calSemana >= cal.semanas.length) {
      const w = cal.semanas.findIndex((s) => V.hoy <= s.cante);
      st.calSemana = w >= 0 ? w : 0;
    }
    el.innerHTML = `${barra(V)}${aviso(V)}
      <div class="cal-cuerpo">
        <div class="cal-mes">${mes(V)}</div>
        <aside class="cal-lado">${detalleSemana(V)}${detalleDia(V)}</aside>
      </div>${formulario(V)}`;
    conectar(el, D);
  }

  // ------------------------------------------------------------ barra superior
  function barra(V) {
    const lista = (V && V.lista) || [];
    const [a, m] = (ctx.estado.calMes || '2026-01').split('-').map(Number);
    return `<div class="cal-barra">
      <label class="cal-sel">Calendario
        <select data-cal-activar>${lista.length ? lista.map((c) => `<option value="${esc(c.id)}" ${V.activo === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('') : '<option>—</option>'}</select>
      </label>
      <button data-cal-nuevo>Nuevo calendario</button>
      ${V && V.cal ? (ctx.estado.calBorrar === V.cal.id
        ? `<span class="cal-confirmar">¿Eliminar «${esc(V.cal.nombre)}»? <button class="peligro" data-cal-borrar-si>Eliminar definitivamente</button><button data-cal-borrar-no>Cancelar</button></span>`
        : '<button data-cal-borrar>Eliminar calendario</button>') : ''}
      ${V && V.cal ? (ctx.estado.calReorg ? `<span class="cal-confirmar">¿Rehacer por temática todas las semanas por venir? <button class="primario" data-cal-reorg-si>Reorganizar</button><button data-cal-reorg-no>Cancelar</button></span>`
        : '<button data-cal-reorg title="Rehace las semanas que aún no han empezado con el contenido actual de los temas">Reorganizar semanas por venir</button>') : ''}
      ${V && V.cal ? `<span class="cal-nav"><button data-cal-mes="-1" aria-label="Mes anterior">‹</button><strong>${esc(mesTitulo(a, m - 1))}</strong><button data-cal-mes="1" aria-label="Mes siguiente">›</button><button data-cal-hoy>Hoy</button></span>` : ''}
    </div>`;
  }

  // ------------------------------------------------------------ aviso de semanas sobrecargadas
  function aviso(V) {
    const sc = (V && V.sobrecarga) || [];
    if (sc.length < 2) return '';
    const k = V.cal.opciones.temasSemana;
    return `<div class="cal-sobrecarga" role="status">
      <p><strong>${sc.length} semanas por venir tienen más de ${k} temas</strong> (${sc.map((w) => `semana ${w + 1}`).join(', ')}). Te recomiendo ampliar el calendario.</p>
      <div class="cal-botones">
        <button data-cal-ampliar="parcial" title="Los temas que peor encajan en cada semana sobrecargada forman semanas nuevas al final">Añadir semanas con los temas que sobran</button>
        <button data-cal-ampliar="completo" title="Rehace todas las semanas por venir por temática, con las semanas que hagan falta; la semana en curso no se toca">Reorganizar todas las semanas por venir</button>
      </div></div>`;
  }

  // ------------------------------------------------------------ vista mensual
  function mes(V) {
    const [a, m] = ctx.estado.calMes.split('-').map(Number);
    const ini = new Date(a, m - 1, 1); ini.setDate(1 - ((ini.getDay() + 6) % 7));
    const fin = new Date(a, m, 0); fin.setDate(fin.getDate() + (6 - ((fin.getDay() + 6) % 7)));
    const cab = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="cal-cab">${d}</div>`).join('');
    let celdas = '';
    for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
      const k = iso(d), info = V.dias[k], fuera = d.getMonth() !== m - 1;
      const sem = info ? info.semana : null;
      const cls = ['cal-dia', fuera ? 'fuera' : '', info ? `t-${info.tipo}` : 'sin', k === V.hoy ? 'hoy' : '', k === ctx.estado.calDia ? 'elegido' : '',
        sem != null ? `banda${sem % 2}` : '', sem === ctx.estado.calSemana ? 'semana-elegida' : '',
        sem != null && V.cal.semanas[sem].estado === 'trabajada' ? 'trabajada' : ''].filter(Boolean).join(' ');
      let dentro = '';
      if (info && info.tipo === 'cante') {
        const s = V.cal.semanas[sem];
        dentro = `<span class="cal-cante">Cante S${s.n}</span>
          <span class="cal-cantados">${s.temas.map((c) => `<i class="mini p${parteDe(c)}" title="${esc(c)} ${esc(et(V.titulos, c).corto)}">${esc(sinEj(c))}</i>`).join('')}</span>`;
      } else if (info && info.tipo === 'estudio') {
        dentro = info.temas.map((t) => `<span class="chip p${parteDe(t.codigo)}" title="${esc(t.codigo)} ${esc(et(V.titulos, t.codigo).corto)}${PARTE_TXT[t.parte] ? ` (${PARTE_TXT[t.parte]}: ${Math.round(t.fraccion * 100)} % del tema)` : ''}"><b>${esc(sinEj(t.codigo))}</b> <span class="breve">${esc(et(V.titulos, t.codigo).breve)}</span>${t.parte !== 'entero' ? `<small>${Math.round(t.fraccion * 100)} %</small>` : ''}</span>`).join('');
      } else if (info && info.tipo === 'libre') dentro = '<span class="cal-etq">Libre</span>';
      else if (info && info.tipo === 'librado') dentro = '<span class="cal-etq">Librado</span>';
      const primeraSem = info && V.cal.semanas[sem].inicio === k;
      celdas += `<div class="${cls}" data-cal-dia="${k}" tabindex="${info ? 0 : -1}">
        <span class="cal-num">${d.getDate()}${primeraSem ? `<em>S${sem + 1}</em>` : ''}</span>${dentro}</div>`;
    }
    return `<div class="cal-rejilla">${cab}${celdas}</div>
      <p class="cal-leyenda"><i class="mini pA"></i>Parte A <i class="mini pB"></i>Parte B <span class="cal-muestra trabajada"></span>semana trabajada <span class="cal-muestra t-libre"></span>libre <span class="cal-muestra banda0"></span><span class="cal-muestra banda1"></span>semanas alternas. El % es la parte del tema que toca ese día.</p>`;
  }

  // ------------------------------------------------------------ detalle de la semana
  function detalleSemana(V) {
    const w = ctx.estado.calSemana, s = V.cal.semanas[w];
    if (!s) return '';
    const total = V.cal.opciones.temasSemana;
    return `<section class="cal-sem">
      <header>
        <button data-cal-semana="${w - 1}" ${w === 0 ? 'disabled' : ''} aria-label="Semana anterior">‹</button>
        <div><h3>Semana ${s.n}</h3><p>${esc(s.bloque || 'Sin bloque temático')}</p></div>
        <button data-cal-semana="${w + 1}" ${w === V.cal.semanas.length - 1 ? 'disabled' : ''} aria-label="Semana siguiente">›</button>
      </header>
      <p class="cal-cuando">Cante el ${esc(largo(s.cante))}. <span class="cal-estado e-${s.estado.replace(' ', '-')}">${{ trabajada: 'Semana trabajada', 'en curso': 'Semana en curso', 'por venir': 'Por venir' }[s.estado]}</span></p>
      ${s.sobrecarga ? `<p class="cal-aviso">Esta semana tiene ${s.temas.length} temas (lo previsto son ${total}).</p>` : ''}
      ${s.sinDias.length ? '<p class="cal-aviso">No queda ningún día de estudio en esta semana: libera algún día o pasa temas a la siguiente.</p>' : ''}
      <ol class="cal-temas">${s.orden.map((c, i) => `
        <li class="p${parteDe(c)}">
          <span class="cod">${esc(sinEj(c))}</span>
          <a data-abrir="${esc(c)}" class="cal-titulo" title="${esc(et(V.titulos, c).titulo)}: abrir el tema">${esc(et(V.titulos, c).corto)}</a>
          <span class="cal-acc">
            <button data-cal-orden="${esc(c)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Estudiarlo antes">↑</button>
            <button data-cal-orden="${esc(c)}" data-dir="1" ${i === s.orden.length - 1 ? 'disabled' : ''} title="Estudiarlo después">↓</button>
            <button data-cal-pasar="${esc(c)}" title="Pasarlo a la semana siguiente o a la que mejor encaje">Mover a otra semana</button>
          </span>
        </li>`).join('')}</ol>
      <div class="cal-elegir" data-cal-eleccion hidden></div>
      ${s.estado !== 'trabajada' ? `<div class="cal-botones"><button data-cal-traer>Traer un tema a esta semana</button></div>` : ''}
      ${traerCaja(V, w)}
    </section>`;
  }

  // ------------------------------------------------------------ traer un tema de semanas por venir
  function traerCaja(V, w) {
    const T = ctx.estado.calTraer;
    if (!T || T.semana !== w) return '';
    if (T.cargando) return '<div class="cal-elegir"><p class="apagado">Buscando los temas que mejor encajan…</p></div>';
    if (!T.mejores.length) return '<div class="cal-elegir"><p>No hay temas en semanas por venir que se puedan traer.</p><div class="cal-botones"><button data-cal-traer-no>Cerrar</button></div></div>';
    return `<div class="cal-elegir"><p>Temas que mejor encajan en esta semana:</p>
      <div class="cal-sugerencias">${T.mejores.map((x) => `<button class="sug p${parteDe(x.codigo)}" data-cal-traer-tema="${esc(x.codigo)}" title="${esc(x.corto)}">
        <b>${esc(sinEj(x.codigo))}</b> ${esc(x.breve)}<small>ahora en la semana ${x.semanaDesde}</small></button>`).join('')}</div>
      <label class="cal-otro">O elige otro <select data-cal-traer-otro><option value="">—</option>${T.todos.map((x) => `<option value="${esc(x.codigo)}">${esc(sinEj(x.codigo))} ${esc(x.breve)} (semana ${x.semanaDesde})</option>`).join('')}</select></label>
      <div class="cal-botones"><button data-cal-traer-no>Cancelar</button></div></div>`;
  }

  // ------------------------------------------------------------ detalle del día elegido
  function detalleDia(V) {
    const k = ctx.estado.calDia, info = k && V.dias[k];
    if (!info) return '<p class="cal-pista">Pulsa un día del calendario para librarlo, estudiar en tu día libre o mover el cante.</p>';
    const s = V.cal.semanas[info.semana];
    let acciones = '';
    if (info.tipo === 'estudio') {
      acciones = `<p>¿Libras este día?</p>
        <div class="cal-botones">
          <button data-cal-librar="repartir">Repartir sus temas en la semana</button>
          <button data-cal-librar="absorber" title="La semana siguiente tendrá más temas; el resto del calendario no se mueve">Pasarlos a la semana siguiente</button>
          <button data-cal-librar="recolocar" title="Cada tema va a la semana por venir donde mejor encaja por contenido y carga de trabajo">Recolocarlos donde mejor encajen</button>
        </div>`;
    } else if (info.tipo === 'libre') acciones = '<div class="cal-botones"><button data-cal-estudiar>Estudiar este día</button></div>';
    else if (info.tipo === 'librado') acciones = '<div class="cal-botones"><button data-cal-estudiar>Volver a estudiar este día</button></div>';
    if (info.tipo !== 'cante') {
      acciones += `<div class="cal-botones"><button data-cal-cante="${info.semana}">Cantar aquí la semana ${s.n} (en vez del ${esc(corto(s.cante))})</button>`;
      const ant = V.cal.semanas[info.semana - 1];
      if (ant) acciones += `<button data-cal-cante="${info.semana - 1}">Retrasar aquí el cante de la semana ${ant.n} (era el ${esc(corto(ant.cante))})</button>`;
      acciones += '</div>';
    }
    const temas = info.temas.length ? `<ul class="cal-hoy">${info.temas.map((t) => `<li class="p${parteDe(t.codigo)}"><a data-abrir="${esc(t.codigo)}">${esc(sinEj(t.codigo))} ${esc(et(V.titulos, t.codigo).corto)}</a>${PARTE_TXT[t.parte] ? ` <span class="apagado">(${PARTE_TXT[t.parte]})</span>` : ''}</li>`).join('')}</ul>` : '';
    const tipoTxt = { estudio: 'Día de estudio', libre: 'Día libre', librado: 'Día librado', cante: 'Día de cante' }[info.tipo];
    return `<section class="cal-diasel"><h3>${esc(largo(k))}</h3><p class="apagado">${tipoTxt}, semana ${s.n}</p>${temas}${acciones}</section>`;
  }

  // ------------------------------------------------------------ formulario de nuevo calendario
  function formulario(V) {
    const st = ctx.estado;
    if (!st.calForm) return '';
    const o = st.calForm;
    const previa = st.calPrevia;
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    return `<div class="cal-modal" role="dialog" aria-label="Nuevo calendario"><form class="cal-form" data-cal-form>
      <h2>Nuevo calendario</h2>
      <label>Nombre <input name="nombre" value="${esc(o.nombre)}" required></label>
      <div class="fila">
        <label>Ejercicio <select name="ejercicio"><option value="3" selected>3er ejercicio</option><option value="4" disabled>4º ejercicio (falta su programa)</option></select></label>
        <label>Temas por semana <input name="temasSemana" type="number" min="1" max="20" value="${o.temasSemana}"></label>
      </div>
      <fieldset><legend>Cómo se ordenan los temas</legend>
        <label class="radio"><input type="radio" name="modo" value="tematico" ${o.modo === 'tematico' ? 'checked' : ''}> Temático: juntos los temas relacionados</label>
        <label class="radio"><input type="radio" name="modo" value="correlativo" ${o.modo === 'correlativo' ? 'checked' : ''}> Correlativo: toda la Parte A y después toda la B</label>
        <label class="radio"><input type="radio" name="modo" value="aleatorio" ${o.modo === 'aleatorio' ? 'checked' : ''}> Aleatorio</label>
        <label class="check"><input type="checkbox" name="intercalar" ${o.intercalar ? 'checked' : ''} ${o.modo === 'correlativo' ? 'disabled' : ''}> Intercalar Parte A y Parte B en cada semana</label>
      </fieldset>
      <div class="fila">
        <label>Empezar por <select name="inicioTipo">
          <option value="basico" ${o.inicioTipo === 'basico' ? 'selected' : ''}>Lo más básico</option>
          <option value="tema" ${o.inicioTipo === 'tema' ? 'selected' : ''}>Un tema concreto</option>
          <option value="azar" ${o.inicioTipo === 'azar' ? 'selected' : ''}>Un tema al azar</option></select></label>
        <label>Tema de inicio <select name="inicioTema" ${o.inicioTipo === 'tema' ? '' : 'disabled'}>${(V && V.programa || []).map((t) => `<option value="${esc(t.codigo)}" ${o.inicioTema === t.codigo ? 'selected' : ''}>${esc(sinEj(t.codigo))} ${esc(t.breve)}</option>`).join('')}</select></label>
      </div>
      <div class="fila">
        <label>Primer cante <input name="primerCante" type="date" value="${esc(o.primerCante)}" required></label>
        <label>Día libre <select name="diaLibre">${dias.map((d, i) => `<option value="${i}" ${Number(o.diaLibre) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      ${previa ? `<div class="cal-previa"><h3>Vista previa</h3><ol>${previa.semanas.map((s) => `<li><span class="apagado">${esc(corto(s.cante))}</span> ${s.bloque ? `<strong>${esc(s.bloque)}</strong>` : ''}<br><span class="previa-temas">${s.temas.map((c) => `<span class="chip p${parteDe(c)}" title="${esc(et(previa.titulos, c).corto)}"><b>${esc(sinEj(c))}</b> <span class="breve">${esc(et(previa.titulos, c).breve)}</span></span>`).join('')}</span></li>`).join('')}</ol></div>` : (st.calCalculando ? '<p class="apagado">Calculando…</p>' : '')}
      <div class="cal-botones fin">
        <button type="button" data-cal-cancelar>Cancelar</button>
        <button type="button" data-cal-previa>${previa ? 'Otra variante' : 'Vista previa'}</button>
        <button type="submit" class="primario">Crear calendario</button>
      </div>
    </form></div>`;
  }

  function leerForm(form) {
    const d = new FormData(form);
    const casilla = (n) => { const x = form.querySelector(`input[name=${n}]`); return x && x.disabled ? !!ctx.estado.calForm[n] : d.get(n) === 'on'; };
    return {
      nombre: d.get('nombre') || 'Calendario', ejercicio: String(d.get('ejercicio') || '3'), temasSemana: Number(d.get('temasSemana')) || 5,
      modo: d.get('modo') || 'tematico', intercalar: casilla('intercalar'),
      inicioTipo: d.get('inicioTipo') || 'basico', inicioTema: d.get('inicioTema') || ctx.estado.calForm.inicioTema || '3.A.1',
      primerCante: d.get('primerCante'), diaLibre: Number(d.get('diaLibre')), semilla: ctx.estado.calForm.semilla,
    };
  }

  // ------------------------------------------------------------ eventos
  function conectar(el, D) {
    const st = ctx.estado, V = D.calendario;
    const rep = () => { ctx.guardar(); ctx.repintar(); };
    const q = (sel, fn) => el.querySelectorAll(sel).forEach(fn);
    q('[data-cal-activar]', (s) => { s.onchange = () => { st.calMes = null; st.calSemana = null; st.calDia = null; ctx.enviar({ tipo: 'calActivar', id: s.value }); }; });
    q('[data-cal-nuevo]', (b) => { b.onclick = () => {
      const prox = new Date(); prox.setDate(prox.getDate() + ((2 - ((prox.getDay() + 6) % 7) + 7) % 7 || 7)); // próximo miércoles
      st.calForm = { nombre: 'Nueva vuelta, 3er ejercicio', temasSemana: 5, modo: 'tematico', intercalar: true, inicioTipo: 'basico', inicioTema: '3.A.1', primerCante: iso(prox), diaLibre: 5, semilla: 1 };
      st.calPrevia = null; rep();
    }; });
    q('[data-cal-mes]', (b) => { b.onclick = () => { const [a, m] = st.calMes.split('-').map(Number); const d = new Date(a, m - 1 + Number(b.dataset.calMes), 1); st.calMes = iso(d).slice(0, 7); rep(); }; });
    q('[data-cal-hoy]', (b) => { b.onclick = () => { st.calMes = V.hoy.slice(0, 7); st.calDia = V.hoy; const w = V.dias[V.hoy]; if (w) st.calSemana = w.semana; rep(); }; });
    q('[data-cal-dia]', (c) => {
      const elegir = () => { const k = c.dataset.calDia; if (!V.dias[k]) return; st.calDia = k; st.calSemana = V.dias[k].semana; rep(); };
      c.onclick = elegir; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } };
    });
    q('[data-cal-semana]', (b) => { b.onclick = () => { st.calSemana = Number(b.dataset.calSemana); st.calDia = null; const s = V.cal.semanas[st.calSemana]; st.calMes = s.cante.slice(0, 7); rep(); }; });
    q('[data-cal-traer]', (b) => { b.onclick = () => { st.calTraer = { semana: st.calSemana, cargando: true }; rep(); ctx.enviar({ tipo: 'calTraerSug', semana: st.calSemana }); }; });
    q('[data-cal-traer-no]', (b) => { b.onclick = () => { st.calTraer = null; rep(); }; });
    const traerTema = (codigo) => { const w = st.calTraer.semana; st.calTraer = null; ctx.guardar(); ctx.enviar({ tipo: 'calTraer', semana: w, codigo }); };
    q('[data-cal-traer-tema]', (b) => { b.onclick = () => traerTema(b.dataset.calTraerTema); });
    q('[data-cal-traer-otro]', (x) => { x.onchange = () => { if (x.value) traerTema(x.value); }; });
    q('[data-cal-orden]', (b) => { b.onclick = () => ctx.enviar({ tipo: 'calOrden', semana: st.calSemana, codigo: b.dataset.calOrden, dir: Number(b.dataset.dir) }); });
    q('[data-cal-pasar]', (b) => { b.onclick = () => {
      const caja = el.querySelector('[data-cal-eleccion]');
      caja.hidden = false;
      caja.innerHTML = `<p>¿Dónde va ${esc(sinEj(b.dataset.calPasar))}?</p>
        <div class="cal-botones"><button data-modo="absorber">A la semana siguiente</button><button data-modo="recolocar" title="A la semana por venir donde mejor encaja por contenido y carga de trabajo">Donde mejor encaje</button><button data-modo="">Cancelar</button></div>`;
      caja.querySelectorAll('[data-modo]').forEach((x) => { x.onclick = () => { caja.hidden = true; if (x.dataset.modo) ctx.enviar({ tipo: 'calPasar', semana: st.calSemana, codigo: b.dataset.calPasar, modo: x.dataset.modo }); }; });
      caja.querySelector('button').focus();
    }; });
    q('[data-cal-borrar]', (b) => { b.onclick = () => { st.calBorrar = V.cal.id; rep(); }; });
    q('[data-cal-borrar-no]', (b) => { b.onclick = () => { st.calBorrar = null; rep(); }; });
    q('[data-cal-borrar-si]', (b) => { b.onclick = () => { const id = st.calBorrar; st.calBorrar = null; st.calMes = null; st.calSemana = null; st.calDia = null; ctx.guardar(); ctx.enviar({ tipo: 'calBorrar', id }); }; });
    q('[data-cal-reorg]', (b) => { b.onclick = () => { st.calReorg = true; rep(); }; });
    q('[data-cal-reorg-no]', (b) => { b.onclick = () => { st.calReorg = false; rep(); }; });
    q('[data-cal-reorg-si]', (b) => { b.onclick = () => { st.calReorg = false; ctx.guardar(); ctx.enviar({ tipo: 'calAmpliar', modo: 'completo' }); }; });
    q('[data-cal-ampliar]', (b) => { b.onclick = () => { b.disabled = true; b.textContent = 'Reorganizando…'; ctx.enviar({ tipo: 'calAmpliar', modo: b.dataset.calAmpliar }); }; });
    q('[data-cal-librar]', (b) => { b.onclick = () => ctx.enviar({ tipo: 'calLibrar', dia: st.calDia, accion: b.dataset.calLibrar }); });
    q('[data-cal-estudiar]', (b) => { b.onclick = () => ctx.enviar({ tipo: 'calEstudiar', dia: st.calDia }); });
    q('[data-cal-cante]', (b) => { b.onclick = () => ctx.enviar({ tipo: 'calCante', semana: Number(b.dataset.calCante), dia: st.calDia }); });
    // formulario
    const form = el.querySelector('[data-cal-form]');
    if (form) {
      const actualizar = () => { Object.assign(st.calForm, leerForm(form)); };
      form.onchange = (e) => {
        actualizar();
        if (e.target.name === 'nombre') return;
        st.calPrevia = null; st.calForm.semilla = 1; rep(); // otra configuración: la vista previa anterior ya no vale
      };
      el.querySelector('[data-cal-cancelar]').onclick = () => { st.calForm = null; st.calPrevia = null; rep(); };
      el.querySelector('[data-cal-previa]').onclick = () => {
        actualizar();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(st.calForm.primerCante || '')) { form.querySelector('input[name=primerCante]').reportValidity(); return; }
        if (st.calPrevia) st.calForm.semilla = (st.calForm.semilla || 1) + 1;
        st.calCalculando = true; st.calPrevia = null; rep(); ctx.enviar({ tipo: 'calPrevia', opciones: leerFormEstado() });
      };
      form.onsubmit = (e) => { e.preventDefault(); actualizar(); ctx.enviar({ tipo: 'calCrear', opciones: leerFormEstado() }); st.calForm = null; st.calPrevia = null; st.calMes = null; st.calSemana = null; st.calDia = null; ctx.guardar(); };
      const primero = form.querySelector('input[name=nombre]'); if (primero && !st.calPrevia) primero.focus();
    }
  }
  function leerFormEstado() {
    const o = { ...ctx.estado.calForm };
    if (o.modo === 'correlativo') o.intercalar = false;
    o.inicio = { tipo: o.inicioTipo || 'basico', tema: o.inicioTipo === 'tema' ? o.inicioTema : null };
    delete o.inicioTipo; delete o.inicioTema;
    return o;
  }

  window.TCEE_CAL = {
    pintar,
    previa(p) { if (!ctx) return; ctx.estado.calPrevia = p; ctx.estado.calCalculando = false; ctx.repintar(); },
    traer(t) { if (!ctx || !ctx.estado.calTraer || ctx.estado.calTraer.semana !== t.semana) return; ctx.estado.calTraer = { ...t, cargando: false }; ctx.repintar(); },
    fallo() { if (!ctx || !ctx.estado.calCalculando) return; ctx.estado.calCalculando = false; ctx.repintar(); },
  };
})();
