// Panel Oposición, pestaña «Idiomas», fases 2–3: biblioteca de textos (leer y resumir, escuchar y resumir, preguntas, dictado),
// expresión escrita (tareas, rúbrica, LanguageTool y modelo local), expresión oral (grabación, transcripción, métricas), tribunal y
// sesión tipo examen (BOE-A-2025-26902). La pestaña principal (idiomas.js) le pasa sus utilidades con crear(api). Reglas: main/IDIOMAS.md
(function () {
  'use strict';
  const LONG = [['corto', 'Corto', '≈150 palabras'], ['estandar', 'Estándar', '≈400'], ['largo', 'Largo', '≈800'], ['completo', 'Completo', 'todo el texto']];
  const TIPOS_TAREA = { opinion: 'Opinión', carta: 'Carta', correo: 'Correo', replica: 'Réplica', informe: 'Informe', propuesta: 'Propuesta', critica: 'Crítica', nota: 'Nota' };
  const CAMPOS = ['economía', 'empresa y trabajo', 'finanzas', 'comercio internacional', 'Europa e instituciones', 'política y sociedad', 'medio ambiente y energía',
    'ciencia y tecnología', 'salud', 'educación', 'cultura y arte', 'historia', 'geografía y viajes', 'deporte', 'vida cotidiana'];
  const RUBRICA = [['tarea', 'Cumplimiento de la tarea'], ['coherencia', 'Coherencia y cohesión'], ['registro', 'Registro y adecuación'],
    ['correccion', 'Corrección gramatical y ortográfica'], ['vocabulario', 'Riqueza y precisión del vocabulario']];
  const BANDAS = ['Insuficiente', 'Flojo', 'Suficiente', 'Bien', 'Excelente'];
  const NOMBRE_ORAL = { lectura: 'Lectura en voz alta', exposicion: 'Exposición sobre un texto', tribunal: 'Preguntas del tribunal', resumen: 'Lectura de tu resumen' };
  // nombres de los bloques de preguntas del tribunal (se traducen al pintar)
  const BLOQUE_TRIB = { texto: 'sobre el texto', economia: 'economía', opinion: 'opinión', motivacion: 'motivación', actualidad: 'actualidad', comercio: 'comercio',
    cultura: 'cultura', espana: 'España', presentacion: 'presentación', europa: 'Europa' };

  function crear(A) {
    const ui = A.ui, idiomaUI = A.idiomaUI;
    const { esc } = A;
    /** Panel en la lengua estudiada (no en castellano): títulos y datos en esa lengua */
    const enL = () => idiomaUI() !== 'es';
    const nPal = (n) => (n === 1 ? ui('{0} palabra', n) : ui('{0} palabras', n));
    const nombreLengua = () => ui(l() === 'fr' ? 'francés' : 'inglés');
    let clave = 0;
    const esperas = new Map();
    /** Petición a la extensión con respuesta (promesa). Los avisos de progreso de esa petición van a alProgreso */
    function pedir(tipo, datos = {}, alProgreso) {
      const k = ++clave;
      return new Promise((ok, mal) => { esperas.set(k, { ok, mal, alProgreso }); A.enviar({ tipo, clave: k, ...datos }); });
    }
    function recibir(m) {
      if (m.tipo === 'idiPRespuesta') {
        const e = esperas.get(m.clave); if (!e) return; esperas.delete(m.clave);
        if (m.error) e.mal(new Error(m.error)); else e.ok(m);
      } else if (m.tipo === 'idiPProgreso') { const e = esperas.get(m.clave); if (e && e.alProgreso) e.alProgreso(m.texto); }
      else if (m.tipo === 'idiOral') { O.estado = m.estado; alEstadoOral(); }
      else if (m.tipo === 'idiClaseEstado') alEstadoClase(m.estado);
      else if (m.tipo === 'idiVoz') recibirVoz(m);
    }
    const fallo = (e) => A.aviso(String(e.message || e), true);
    const P = { modo: 'lectura' };    // estado de las vistas de esta parte
    const vEl = () => A.vistaEl();
    const l = () => A.lengua();
    const cab = (titulo, extra = '') => `<div class="idi-p-cab"><a data-volver>← ${ui('Inicio')}</a><h2>${titulo}</h2>${extra}</div>`;
    const enlazarVolver = (z, destino = 'inicio') => z.querySelectorAll('[data-volver]').forEach((a) => a.onclick = () => { parar(); A.ir(destino); });
    const palabras = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
    const reloj = (s) => A.reloj(Math.max(0, s));
    let tic = null;
    const conReloj = (fn) => { clearInterval(tic); tic = setInterval(fn, 1000); };
    function parar() { clearInterval(tic); tic = null; Lector.parar(); clearInterval(O.sondeo); O.sondeo = null; if (typeof K !== 'undefined') { clearInterval(K.sondeo); K.sondeo = null; } }

    // ================================================================== voz: neuronal (Piper, si está instalada) o la del sistema, frase a frase
    // VS Code solo deja sonar un audio si lo inicia un clic, y cada elemento de audio nuevo vuelve a pedirlo: por eso hay UN solo elemento,
    // que se «desbloquea» con el primer clic en el panel (un instante de silencio) y en el que suenan todas las frases. Antes se creaba uno por
    // frase y VS Code rechazaba todos los que no salían de un clic: sonaba la primera frase y se saltaban las demás (main/IDIOMAS.md, «Voces»).
    // La velocidad se aplica al reproducir (playbackRate, conservando el tono): cambia al instante y no obliga a generar de nuevo el audio.
    const NV = { info: null, elegida: {}, fallo: false, handlers: new Map() };   // elegida: voz del texto en curso, por lengua
    const confVoz = () => { const t = (A.st().idiVoz = A.st().idiVoz || {}); t[l()] = { motor: 'piper', voz: 'azar', velocidad: 0.95, ...(t[l()] || {}) }; return t[l()]; };
    const velocidad = () => Number(confVoz().velocidad) || 1;
    const VELOCIDADES = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2];
    const selectorVelocidad = () => `<select data-vel title="${ui('Velocidad de lectura')}">${VELOCIDADES.map((v) => `<option value="${v}" ${velocidad() === v ? 'selected' : ''}>${v === 1 ? ui('normal') : `× ${v}`}</option>`).join('')}</select>`;
    const usarPiper = () => !NV.fallo && confVoz().motor !== 'mac' && NV.info && NV.info.disponible && NV.info.voces.some((v) => v.lengua === l());
    async function cargarVoces() { try { NV.info = await pedir('idiPVoces'); } catch (e) { NV.info = { disponible: false, voces: [] }; } return NV.info; }
    /** Pide a la extensión el audio de unas frases con la voz del texto en curso (la elige al azar la primera vez). Siempre a velocidad normal. */
    async function vozPiper(frases) {
      const c = confVoz(), el = NV.elegida[l()];
      const voz = c.voz !== 'azar' ? c.voz : el ? el.voz : 'azar';
      const { voz: r } = await pedir('idiPVoz', { lengua: l(), frases, voz, hablante: el && el.voz === voz ? el.hablante : undefined, velocidad: 1 });
      NV.elegida[l()] = { voz: r.voz, hablante: r.hablante, nombre: r.nombre };
      return r;
    }
    function falloVoz(msg) { NV.fallo = true; A.aviso(ui('Voz neuronal: {0}. Uso la voz del sistema.', msg), true); }
    function recibirVoz(m) { const h = NV.handlers.get(m.clave); if (h) h(m); }

    // el único elemento de audio
    const AU = { el: null, libre: false, n: 0, url: null };
    const SILENCIO = (() => {   // 0,05 s de silencio en WAV (para desbloquear el audio con el primer clic)
      const n = 400, b = new Uint8Array(44 + 2 * n), d = new DataView(b.buffer), txt = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
      txt(0, 'RIFF'); d.setUint32(4, 36 + 2 * n, true); txt(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
      d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); txt(36, 'data'); d.setUint32(40, 2 * n, true);
      let s = ''; b.forEach((x) => s += String.fromCharCode(x)); return `data:audio/wav;base64,${btoa(s)}`;
    })();
    function audioEl() { if (!AU.el) { AU.el = new Audio(); AU.el.preload = 'auto'; try { AU.el.preservesPitch = true; } catch (e) { /* */ } } return AU.el; }
    function desbloquear() {
      if (AU.libre) return;
      const a = audioEl(); if (AU.url) return;   // ya hay una frase en él (su play() del clic lo desbloquea)
      a.src = SILENCIO; const pr = a.play(); if (pr) pr.then(() => { AU.libre = true; }).catch(() => { /* se reintenta en el siguiente clic */ });
    }
    document.addEventListener('pointerdown', desbloquear, true);
    document.addEventListener('keydown', desbloquear, true);

    const Lector = {
      frases: [], i: 0, activo: false, alCambiar: null, prep: null, espera: null, pausada: null, avisado: false,
      voces() { return (window.speechSynthesis ? window.speechSynthesis.getVoices() : []).filter((v) => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(l())); },
      cargar(parrafos) {
        this.parar(); this.i = 0; this.prep = null; this.avisado = false; NV.elegida[l()] = null;   // cada texto, una voz nueva (si está «al azar»)
        this.frases = [];
        parrafos.forEach((p, k) => String(p).split(/(?<=[.!?…»"”])\s+(?=[A-ZÀ-ÖØ-Þ«"“(0-9])/).forEach((f) => { if (f.trim()) this.frases.push({ t: f.trim(), p: k }); }));
      },
      /** Una frase suelta (pregunta del tribunal, dictado, ejemplos). vel: velocidad para esta frase (si no, la elegida). */
      hablar(texto, alFin, vel) {
        if (usarPiper()) {
          vozPiper([texto]).then((r) => {
            NV.handlers.set(r.clave, (m) => {
              if (m.error) { NV.handlers.delete(r.clave); falloVoz(m.error); this.hablarSistema(texto, alFin, vel); return; }
              if (m.i !== 0) return; NV.handlers.delete(r.clave);
              this.sonar(m.url, (err) => { if (err) { this.avisarFallo(err); this.hablarSistema(texto, alFin, vel); } else if (alFin) alFin(); }, vel);
            });
          }).catch((e) => { falloVoz(e.message); this.hablarSistema(texto, alFin, vel); });
          return;
        }
        this.hablarSistema(texto, alFin, vel);
      },
      /** La voz del sistema (la del Mac): sin voces neuronales, o de respaldo para una frase que no se pudo reproducir */
      hablarSistema(texto, alFin, vel) {
        if (!window.speechSynthesis) { A.aviso(ui('Este VS Code no tiene voz sintética disponible.'), true); if (alFin) alFin(true); return; }
        const u = new SpeechSynthesisUtterance(texto);
        const conf = confVoz();
        u.lang = l() === 'fr' ? 'fr-FR' : 'en-GB';
        const v = this.voces().find((x) => x.name === conf.nombreMac) || this.voces().find((x) => /premium|enhanced|mejorada/i.test(x.name)) || this.voces()[0];
        if (v) u.voice = v;
        u.rate = vel || velocidad();
        this.u = u;   // se guarda: si no, Chromium puede liberarlo y no llega nunca onend
        u.onend = () => { if (this.u === u) this.u = null; if (alFin) alFin(); }; u.onerror = () => { if (this.u === u) this.u = null; if (alFin) alFin(true); };
        window.speechSynthesis.speak(u);
      },
      /** Pone una frase en el elemento de audio. alFin() al terminar; alFin(motivo) si no se puede reproducir. */
      sonar(url, alFin, vel) {
        const a = audioEl(), id = ++AU.n;
        a.onended = () => { if (AU.n === id) { AU.url = null; alFin(); } };
        a.onerror = () => { if (AU.n === id) { AU.url = null; alFin(a.error ? ui('código {0}', a.error.code) : ui('error de audio')); } };
        AU.url = url; a.src = url;
        a.defaultPlaybackRate = a.playbackRate = vel || velocidad();
        const pr = a.play();
        if (pr) pr.then(() => { AU.libre = true; }).catch((e) => { if (AU.n !== id || (e && e.name === 'AbortError')) return; AU.url = null; alFin(e ? e.name : ui('no se pudo reproducir')); });
      },
      avisarFallo(motivo) {
        if (this.avisado) return; this.avisado = true;
        A.aviso(ui('Voz neuronal: una frase no se pudo reproducir ({0}). La leo con la voz del sistema para no saltarla; si se repite, cuéntaselo a Claude.', motivo), true);
      },
      async play(desde) {
        if (desde !== undefined) { this.i = desde; this.cortarAudio(); }
        // se reanuda en el punto exacto si la frase pausada sigue en el audio
        const a = AU.el;
        if (desde === undefined && this.pausada && this.pausada.i === this.i && a && AU.url === this.pausada.url && a.paused && !a.ended) {
          this.activo = true; this.pausada = null; this.notificar();
          a.playbackRate = velocidad();
          a.play().catch((e) => { if (e && e.name !== 'AbortError') { this.pausada = null; this.cortarAudio(); this.paso(); } });
          return;
        }
        this.pausada = null;
        if (this.i >= this.frases.length) this.i = 0;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.activo = true;
        if (usarPiper() && !this.prep) {
          this.notificar();
          try {
            const r = await vozPiper(this.frases.map((f) => f.t));
            this.prep = { clave: r.clave, urls: [], nombre: r.nombre };
            NV.handlers.set(r.clave, (m) => {
              if (m.error) { falloVoz(m.error); this.prep = null; if (this.activo) this.paso(); return; }
              if (!this.prep || this.prep.clave !== r.clave) return;
              this.prep.urls[m.i] = m.url;
              if (this.activo && this.espera === m.i) { this.espera = null; this.paso(); }
            });
          } catch (e) { falloVoz(e.message); }
        }
        this.paso();
      },
      paso() {
        if (!this.activo) return;
        if (this.i >= this.frases.length) { this.activo = false; this.notificar(true); return; }
        this.notificar();
        const yo = this.i;
        const siguiente = () => { if (!this.activo || this.i !== yo) return; this.i += 1; this.paso(); };
        if (this.prep && usarPiper()) {
          const url = this.prep.urls[yo];
          // si una frase no se puede reproducir, se lee con la voz del sistema: nunca se salta en silencio
          if (url) this.sonar(url, (err) => { if (!err) return siguiente(); if (!this.activo || this.i !== yo) return; this.avisarFallo(err); this.hablarSistema(this.frases[yo].t, siguiente); });
          else this.espera = yo;   // aún se está generando: se espera
          return;
        }
        this.hablar(this.frases[yo].t, siguiente);
      },
      cortarAudio() { AU.n += 1; AU.url = null; if (AU.el) AU.el.pause(); this.espera = null; this.pausada = null; },
      /** Pausa: con la voz neuronal se queda en el punto exacto; con la del sistema, se repite la frase al seguir */
      pausa() {
        this.activo = false; this.espera = null;
        if (AU.el && AU.url && !AU.el.paused) { this.pausada = { i: this.i, url: AU.url }; AU.el.pause(); } else this.cortarAudio();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.notificar();
      },
      parar() { this.activo = false; this.cortarAudio(); if (window.speechSynthesis) window.speechSynthesis.cancel(); },
      /** Velocidad: se aplica al momento a la frase que suena (con la voz del sistema, desde la frase siguiente) */
      cambiarVelocidad(v) { confVoz().velocidad = v; A.guardar(); if (AU.el) AU.el.defaultPlaybackRate = AU.el.playbackRate = v; },
      /** Cambió la voz: se vuelve a generar desde la frase actual */
      reiniciar(otraVoz) { const a = this.activo; this.parar(); this.prep = null; if (otraVoz) NV.elegida[l()] = null; if (a) this.play(); else this.notificar(); },
      atras() { const a = this.activo; this.parar(); this.i = Math.max(0, this.i - 1); if (a) this.play(); else this.notificar(); },
      notificar(fin) { if (this.alCambiar) this.alCambiar(fin); },
      textoBoton(fin, inicial) { return this.activo ? `⏸ ${ui('Pausa')}` : fin ? `↺ ${ui('Otra vez')}` : (this.i || this.pausada) ? `▶ ${ui('Seguir')}` : inicial; },
      nombreVoz() { return usarPiper() ? (NV.elegida[l()] ? NV.elegida[l()].nombre : ui('voz neuronal al azar')) : ui('voz del sistema'); },
    };
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {};

    // ================================================================== biblioteca
    async function pBiblioteca() {
      const modo = P.modo;
      vEl().innerHTML = `<div class="idi-p">${cab(modo === 'escucha' ? `🎧 ${ui('Comprensión auditiva')}` : `📖 ${ui('Comprensión lectora')}`,
        `<div class="segmentos idi-p-modos"><button data-modo="lectura" class="${modo === 'lectura' ? 'activo' : ''}">📖 ${ui('Comprensión lectora')}</button><button data-modo="escucha" class="${modo === 'escucha' ? 'activo' : ''}">🎧 ${ui('Comprensión auditiva')}</button></div>`)}
        <p class="ayuda">${modo === 'escucha'
    ? ui('Como en el examen escrito: una voz te lee el texto (no lo ves), tomas notas y luego escribes el resumen en la lengua del texto. Después puedes contestar preguntas, hacer un dictado y ver el texto.')
    : ui('Lees el texto, tomas notas y escribes un resumen en la lengua del texto. Después puedes contestar preguntas de comprensión y repasar el vocabulario.')}</p>
        <div id="idi-bib"><p class="apagado">${ui('Cargando la biblioteca…')}</p></div>${modo === 'escucha' ? cajaMedios() : ''}</div>`;
      enlazarVolver(vEl()); enlazarUrls(vEl());
      vEl().querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { P.modo = b.dataset.modo; pBiblioteca(); });
      try {
        const { datos } = await pedir('idiPBiblioteca', { lengua: l() });
        P.bib = datos; pintarBiblioteca();
      } catch (e) { fallo(e); }
    }
    function pintarBiblioteca() {
      const z = vEl().querySelector('#idi-bib'); if (!z || !P.bib) return;
      const f = (A.st().idiBibFiltro = A.st().idiBibFiltro || { nivel: '', campo: '', tipo: '', hechos: 'todos' });
      const ORDEN_TIPO = { prensa: 0, noticia: 1, divulgacion: 2, enciclopedia: 3 };
      const nvU = A.NIVELES.indexOf(P.bib.nivel);
      const xs = P.bib.textos.slice().sort((a, b) => Math.abs(A.NIVELES.indexOf(a.nivel) - nvU) - Math.abs(A.NIVELES.indexOf(b.nivel) - nvU) || ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo]).filter((t) => (!f.nivel || t.nivel === f.nivel) && (!f.campo || t.campo === f.campo) && (!f.tipo || t.tipo === f.tipo)
        && (f.hechos === 'todos' || (f.hechos === 'nuevos' ? !t.hecho : !!t.hecho)));
      const rec = P.bib.textos.find((t) => t.id === P.bib.recomendado);
      if (!P.bib.textos.length) { z.innerHTML = `<p class="vacio">${ui('La biblioteca de este idioma aún no está en el paquete: ejecuta «Sincronizar».')}</p>`; return; }
      z.innerHTML = `${rec ? `<section class="idi-caja idi-rec"><h3>${ui('Te propongo')}</h3>${cartaTexto(rec, true)}</section>` : ''}
        <div class="idi-filtros">
          <select data-f="nivel"><option value="">${ui('Todos los niveles')}</option>${A.NIVELES.map((n) => `<option ${f.nivel === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select data-f="campo"><option value="">${ui('Todos los temas')}</option>${CAMPOS.filter((c) => P.bib.textos.some((t) => t.campo === c)).map((c) => `<option value="${esc(c)}" ${f.campo === c ? 'selected' : ''}>${esc(ui(c))}</option>`).join('')}</select>
          <select data-f="tipo"><option value="">${ui('Todos los tipos')}</option>${[['prensa', 'Prensa (análisis)'], ['noticia', 'Noticias'], ['divulgacion', 'Divulgación'], ['enciclopedia', 'Enciclopedia']].map(([k, v]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${ui(v)}</option>`).join('')}</select>
          <select data-f="hechos">${[['todos', 'Hechos y sin hacer'], ['nuevos', 'Sin hacer'], ['hechos', 'Ya hechos']].map(([k, v]) => `<option value="${k}" ${f.hechos === k ? 'selected' : ''}>${ui(v)}</option>`).join('')}</select>
          <span class="apagado">${xs.length === 1 ? ui('{0} texto', 1) : ui('{0} textos', xs.length)}</span></div>
        <div class="idi-textos">${xs.map((t) => cartaTexto(t)).join('') || `<p class="vacio">${ui('Ningún texto con esos filtros.')}</p>`}</div>`;
      z.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { f[s.dataset.f] = s.value; A.guardar(); pintarBiblioteca(); });
      z.querySelectorAll('[data-texto]').forEach((c) => {
        c.onclick = () => prepararTexto(c.dataset.texto);
        c.onkeydown = (e) => { if (e.key === 'Enter') prepararTexto(c.dataset.texto); };
      });
    }
    const TIPO_TXT = { prensa: ['📰', 'Prensa'], noticia: ['🗞', 'Noticia'], divulgacion: ['💡', 'Divulgación'], enciclopedia: ['📚', 'Enciclopedia'] };
    const tipoTexto = (k) => (TIPO_TXT[k] ? `${TIPO_TXT[k][0]} ${ui(TIPO_TXT[k][1])}` : '');
    function cartaTexto(t, grande) {
      const h = t.hecho;
      const ult = (xs) => (xs && xs.length ? xs[xs.length - 1] : null);
      const nr = ult(h && h.resumen), nc = ult(h && h.comprension);
      return `<article class="idi-ctexto n-${t.nivel} ${grande ? 'grande' : ''} ${h ? 'hecho' : ''}" data-texto="${esc(t.id)}" tabindex="0">
        <div class="idi-carta-fila"><span class="idi-chip-niv">${t.nivel}</span><span class="idi-chip-bloque">${esc(t.campo ? ui(t.campo) : '')}</span>
          <span class="apagado">${tipoTexto(t.tipo)}</span>${t.audio ? `<span title="${ui('Con audio original')}">🎙</span>` : ''}<span class="apagado idi-der-auto">${ui('{0} palabras · {1} min', t.palabras, Math.round(t.palabras / 140))}</span></div>
        <h4>${esc(t.titulo)}</h4>${enL() ? '' : `<p class="idi-ctexto-es">${esc(t.titulo_es || '')}</p>`}
        ${!enL() && (grande || t.resumen_es) ? `<p class="idi-carta-desc">${esc(t.resumen_es || '')}</p>` : ''}
        <div class="idi-ctexto-pie"><span class="apagado">${esc(t.fuente)}</span>
          ${h ? `<span>✓ ${h.veces || 1}×${nr != null ? ` · ${ui('resumen {0}/10', nr)}` : ''}${nc != null ? ` · ${ui('preguntas {0} %', Math.round(nc * 100))}` : ''}</span>` : ''}</div></article>`;
    }

    // ================================================================== preparar y practicar un texto
    function prepararTexto(id) {
      const t = P.bib.textos.find((x) => x.id === id); if (!t) return;
      const conf = (A.st().idiTextoConf = A.st().idiTextoConf || { longitud: 'estandar', preguntas: true, dictado: false, resumen: true });
      const fondo = document.createElement('div'); fondo.className = 'idi-dlg-fondo idi-raiz';
      fondo.innerHTML = `<div class="idi-dlg ancho" role="dialog">
        <h3>${P.modo === 'escucha' ? '🎧' : '📖'} ${esc(t.titulo)}</h3><p class="apagado">${enL() ? '' : `${esc(t.titulo_es || '')} · `}${t.nivel} · ${nPal(t.palabras)} · ${esc(t.fuente)}</p>
        <div class="idi-dlg-fila"><span>${ui('Longitud')}</span><div class="segmentos">${LONG.map(([k, n, d]) => `<button data-long="${k}" class="${conf.longitud === k ? 'activo' : ''}" title="${ui(d)}">${ui(n)}<small> ${ui(d)}</small></button>`).join('')}</div></div>
        <p class="idi-mini apagado">${ui('Se corta siempre por párrafos enteros, desde el principio.')}${t.audio && P.modo === 'escucha' ? ` ${ui('El audio original de VOA solo está con el texto completo.')}` : ''}</p>
        <div class="idi-dlg-fila"><span>${ui('Actividades')}</span><div class="idi-checks">
          <label><input type="checkbox" data-act="resumen" ${conf.resumen ? 'checked' : ''}> ${ui('Resumen escrito')}</label>
          <label><input type="checkbox" data-act="preguntas" ${conf.preguntas ? 'checked' : ''}> ${ui('Preguntas de comprensión')}</label>
          ${P.modo === 'escucha' ? `<label><input type="checkbox" data-act="dictado" ${conf.dictado ? 'checked' : ''}> ${ui('Dictado (5 frases)')}</label>` : ''}</div></div>
        <p class="idi-acciones"><button class="primario" data-empezar>${ui('Empezar')}</button><button data-cancelar>${ui('Cancelar')}</button></p></div>`;
      document.body.appendChild(fondo);
      const cerrar = () => fondo.remove();
      fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(); });
      fondo.querySelectorAll('[data-long]').forEach((b) => b.onclick = () => { conf.longitud = b.dataset.long; fondo.querySelectorAll('[data-long]').forEach((x) => x.classList.toggle('activo', x === b)); });
      fondo.querySelectorAll('[data-act]').forEach((c) => c.onchange = () => { conf[c.dataset.act] = c.checked; });
      fondo.querySelector('[data-cancelar]').onclick = cerrar;
      fondo.querySelector('[data-empezar]').onclick = async () => {
        if (!conf.resumen && !conf.preguntas && !conf.dictado) { A.aviso(ui('Elige al menos una actividad.'), true); return; }
        A.guardar(); cerrar();
        try {
          const { texto } = await pedir('idiPAbrir', { lengua: l(), id, longitud: conf.longitud });
          empezarTexto(texto, { ...conf, dictado: P.modo === 'escucha' && conf.dictado });
        } catch (e) { fallo(e); }
      };
    }

    function empezarTexto(texto, conf) {
      const etapas = [P.modo === 'escucha' ? 'escuchar' : 'leer'];
      if (conf.resumen) etapas.push('resumen');
      if (conf.preguntas && texto.preguntas.length) etapas.push('preguntas');
      if (conf.dictado && texto.dictado.length) etapas.push('dictado');
      etapas.push('final');
      P.T = { texto, conf, modo: P.modo, etapas, e: 0, notas: '', resumen: '', t0: Date.now(), tEtapa: Date.now(), respuestas: {}, resultados: {}, dictado: { i: 0, res: [] }, verTexto: P.modo === 'lectura' };
      Lector.cargar(texto.parrafos);
      A.ir('texto');
    }
    const etapa = () => P.T.etapas[P.T.e];
    const NOMBRE_ETAPA = { leer: 'Lectura', escuchar: 'Escucha', resumen: 'Resumen', preguntas: 'Preguntas', dictado: 'Dictado', final: 'Resultado' };

    function pTexto() {
      const T = P.T; if (!T) return A.ir('inicio');
      const x = T.texto;
      parar();
      vEl().innerHTML = `<div class="idi-p idi-ptexto">
        <div class="idi-p-cab"><a data-salir>← ${ui('Salir')}</a><h2>${T.modo === 'escucha' ? '🎧' : '📖'} ${esc(x.titulo)}</h2>
          <span class="idi-chip-niv n-${x.nivel}">${x.nivel}</span><span class="apagado">${nPal(x.palabras)}${x.entero ? '' : ` · ${ui('{0} de {1} párrafos', x.k, x.total)}`}</span>
          <span class="idi-der-auto apagado">⏱ <span id="idi-t-reloj">${reloj((Date.now() - T.t0) / 1000)}</span></span></div>
        <ol class="idi-etapas">${T.etapas.map((e, i) => `<li class="${i < T.e ? 'hecha' : i === T.e ? 'actual' : ''}">${ui(NOMBRE_ETAPA[e])}</li>`).join('')}</ol>
        <div id="idi-etapa"></div></div>`;
      vEl().querySelector('[data-salir]').onclick = async () => { if (T.e > 0 && etapa() !== 'final' && !(await confirmar(ui('¿Salir? Lo que no hayas corregido se pierde.')))) return; terminarTexto(true); };
      conReloj(() => { const r = vEl().querySelector('#idi-t-reloj'); if (r) r.textContent = reloj((Date.now() - T.t0) / 1000); });
      ({ leer: eLeer, escuchar: eEscuchar, resumen: eResumen, preguntas: ePreguntas, dictado: eDictado, final: eFinal })[etapa()](vEl().querySelector('#idi-etapa'));
    }
    /** Pregunta Sí/No con un diálogo propio (el panel de VS Code no muestra window.confirm) */
    function confirmar(texto) {
      return new Promise((ok) => {
        const fondo = document.createElement('div'); fondo.className = 'idi-dlg-fondo idi-raiz';
        fondo.innerHTML = `<div class="idi-dlg" role="alertdialog"><p>${esc(texto)}</p><p class="idi-acciones"><button class="primario" data-si>${ui('Sí')}</button><button data-no>${ui('No')}</button></p></div>`;
        document.body.appendChild(fondo);
        const fin = (v) => { fondo.remove(); ok(v); };
        fondo.querySelector('[data-si]').onclick = () => fin(true); fondo.querySelector('[data-no]').onclick = () => fin(false);
        fondo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fin(false); });
        fondo.querySelector('[data-no]').focus();
      });
    }
    /** Zona de la etapa en pantalla (null si el usuario está en otra vista, p. ej. una ficha del diccionario) */
    const zonaEtapa = () => vEl().querySelector('#idi-etapa');
    /** Al terminar algo largo (una corrección): pasa a la etapa siguiente si sigue en la misma; si está en otra vista, la deja preparada */
    function avanzarDesde(T, nombre) {
      if (P.T !== T || etapa() !== nombre) return;
      if (zonaEtapa()) siguienteEtapa(); else { T.e += 1; T.tEtapa = Date.now(); }
    }
    function siguienteEtapa() { P.T.e += 1; P.T.tEtapa = Date.now(); pTexto(); window.scrollTo(0, 0); }
    const parrafosHtml = (x, marcar) => x.parrafos.map((p, i) => `<p class="idi-par ${marcar === i ? 'marcado' : ''}" data-par="${i}"><span class="idi-par-n">${i + 1}</span>${esc(p)}</p>`).join('');
    const notasHtml = (T, ayuda) => `<section class="idi-caja idi-notas"><h3>📝 ${ui('Notas')}</h3><textarea id="idi-notas" rows="14" placeholder="${esc(ayuda)}">${esc(T.notas)}</textarea></section>`;
    const enlazarNotas = (z) => { const n = z.querySelector('#idi-notas'); if (n) n.oninput = () => { P.T.notas = n.value; }; };

    function eLeer(z) {
      const T = P.T, x = T.texto;
      z.innerHTML = `<div class="idi-p-dos">
        <section class="idi-caja idi-lectura" lang="${l()}"><div class="idi-acciones"><button data-oir title="${ui('Lee el texto en voz alta')}">🔊 ${ui('Escucharlo')}</button>${selectorVelocidad()}</div>${parrafosHtml(x)}
          <p class="idi-fuente apagado">${ui('Fuente:')} ${x.fuente.url ? `<a data-url="${esc(x.fuente.url)}">${esc(x.fuente.nombre)}</a>` : esc(x.fuente.nombre)} · ${esc(x.fuente.licencia || '')}${x.fuente.autor ? ` · ${esc(x.fuente.autor)}` : ''}</p></section>
        <div>${notasHtml(T, ui('Ideas principales, datos, conectores… Te servirán para el resumen.'))}
          <p class="idi-acciones"><button class="primario" data-seguir>${ui('He terminado de leer')} →</button></p>
          <p class="idi-mini apagado">${ui('Selecciona una palabra para buscarla en el diccionario o añadirla a Mi diccionario.')}</p></div></div>`;
      enlazarNotas(z); enlazarUrls(z);
      z.querySelector('[data-seguir]').onclick = siguienteEtapa;
      const oir = z.querySelector('[data-oir]');
      z.querySelector('[data-vel]').onchange = (e) => Lector.cambiarVelocidad(Number(e.target.value));
      Lector.alCambiar = (fin) => { oir.textContent = Lector.textoBoton(fin, `🔊 ${ui('Escucharlo')}`); z.querySelectorAll('.idi-par').forEach((p) => p.classList.toggle('sonando', Lector.activo && Number(p.dataset.par) === (Lector.frases[Lector.i] || {}).p)); };
      oir.onclick = () => (Lector.activo ? Lector.pausa() : Lector.play());
    }
    const enlazarUrls = (z) => z.querySelectorAll('[data-url]').forEach((a) => a.onclick = (e) => { e.preventDefault(); A.enviar({ tipo: 'abrirUrl', url: a.dataset.url }); });

    function eEscuchar(z) {
      const T = P.T, x = T.texto;
      const conf = confVoz();
      const voces = Lector.voces();
      const neuronales = ((NV.info && NV.info.voces) || []).filter((v) => v.lengua === l());
      z.innerHTML = `<div class="idi-p-dos">
        <section class="idi-caja idi-reproductor">
          <h3>🎧 ${ui('Escucha el texto')}</h3>
          <p class="ayuda">${ui('En el examen te lo leen una vez, hasta 15 minutos. Puedes escucharlo las veces que quieras, pero intenta hacerlo como en el examen.')}</p>
          ${x.audio ? `<div class="segmentos"><button data-fuente="voz" class="${T.audioOriginal ? '' : 'activo'}">${ui('Voz sintética')}</button><button data-fuente="original" class="${T.audioOriginal ? 'activo' : ''}">${ui('Audio original (VOA)')}</button></div>` : ''}
          <div id="idi-rep"></div>
          <p class="idi-acciones"><button class="primario" data-seguir>${ui('He terminado de escuchar')} →</button></p></section>
        <div>${notasHtml(T, ui('Toma notas mientras escuchas: ideas, cifras, nombres, conectores…'))}</div></div>`;
      enlazarNotas(z);
      z.querySelector('[data-seguir]').onclick = () => { Lector.parar(); siguienteEtapa(); };
      z.querySelectorAll('[data-fuente]').forEach((b) => b.onclick = () => { T.audioOriginal = b.dataset.fuente === 'original'; Lector.parar(); eEscuchar(z); });
      const rep = z.querySelector('#idi-rep');
      if (T.audioOriginal && x.audio) {
        rep.innerHTML = `<audio controls preload="none" src="${esc(x.audio)}" style="width:100%"></audio><p class="idi-mini apagado">${ui('Audio de VOA Learning English (dominio público). Necesita conexión a internet.')}</p>`;
        return;
      }
      if (!window.speechSynthesis && !neuronales.length) { rep.innerHTML = `<p class="idi-aviso">${ui('No hay voz sintética disponible: instala las voces neuronales en ⚙ Ajustes › Instalar herramientas.')}</p>`; return; }
      const valorVoz = conf.motor === 'mac' ? `mac:${conf.nombreMac || ''}` : `piper:${conf.voz || 'azar'}`;
      rep.innerHTML = `<div class="idi-rep-mandos"><button data-atras title="${ui('Frase anterior')}">⏮</button><button class="primario grande" data-play>▶ ${ui('Escuchar')}</button></div>
        <div class="idi-rep-barra"><i style="width:0%"></i></div><p class="idi-mini apagado centro" id="idi-rep-pos"></p>
        <div class="idi-form idi-rep-conf">
          <label>${ui('Voz')} <select data-voz>${neuronales.length ? `<optgroup label="${ui('Voces neuronales (Piper)')}"><option value="piper:azar">${ui('Al azar (una distinta en cada texto)')}</option>${neuronales.map((v) => `<option value="piper:${esc(v.id)}">${esc(v.nombre)}</option>`).join('')}</optgroup>` : ''}
            <optgroup label="${ui('Voces del sistema')}">${voces.map((v) => `<option value="mac:${esc(v.name)}">${esc(v.name)}</option>`).join('') || `<option value="mac:">${ui('La del sistema')}</option>`}</optgroup></select></label>
          <label>${ui('Velocidad')} ${selectorVelocidad()}</label></div>
        <p class="idi-mini" id="idi-voz-actual"></p>
        ${neuronales.length ? '' : `<p class="idi-mini apagado">${ui('Voces más naturales: instala las voces neuronales en ⚙ Ajustes › Instalar herramientas.')}</p>`}`;
      const sv = rep.querySelector('[data-voz]'); sv.value = [...sv.options].some((o) => o.value === valorVoz) ? valorVoz : sv.options[0].value;
      const pos = rep.querySelector('#idi-rep-pos'), barra = rep.querySelector('.idi-rep-barra i'), play = rep.querySelector('[data-play]');
      Lector.alCambiar = (fin) => {
        const n = Lector.frases.length; barra.style.width = `${Math.round((100 * Lector.i) / Math.max(1, n))}%`;
        pos.textContent = fin ? ui('Fin del texto.') : ui('Frase {0} de {1} · párrafo {2} de {3}', Math.min(Lector.i + 1, n), n, ((Lector.frases[Lector.i] || {}).p || 0) + 1, x.parrafos.length);
        play.textContent = Lector.textoBoton(fin, `▶ ${ui('Escuchar')}`);
        if (fin) T.escuchas = (T.escuchas || 0) + 1;
        const va = rep.querySelector('#idi-voz-actual');
        if (va) va.innerHTML = `🗣 ${esc(Lector.nombreVoz())}${usarPiper() && confVoz().voz === 'azar' ? ` <a data-otra-voz>${ui('· otra voz')}</a>` : ''}`;
        const ov = rep.querySelector('[data-otra-voz]'); if (ov) ov.onclick = () => Lector.reiniciar(true);
      };
      Lector.notificar();
      play.onclick = () => (Lector.activo ? Lector.pausa() : Lector.play());
      rep.querySelector('[data-atras]').onclick = () => Lector.atras();
      sv.onchange = () => {
        const [motor, ...resto] = sv.value.split(':'); const v = resto.join(':');
        if (motor === 'mac') { conf.motor = 'mac'; conf.nombreMac = v; } else { conf.motor = 'piper'; conf.voz = v || 'azar'; NV.fallo = false; }
        A.guardar(); Lector.reiniciar(true);
      };
      rep.querySelector('[data-vel]').onchange = (e) => Lector.cambiarVelocidad(Number(e.target.value));
      rep.querySelector('.idi-rep-barra').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); Lector.play(Math.floor(((e.clientX - r.left) / r.width) * Lector.frases.length)); };
    }

    function eResumen(z) {
      const T = P.T, x = T.texto;
      const [min, max] = x.extension;
      const verTexto = T.modo === 'lectura' && T.verTexto;
      z.innerHTML = `<div class="idi-p-dos">
        <section class="idi-caja">
          <h3>✍️ ${ui('Tu resumen')} <span class="apagado idi-mini">${ui(l() === 'fr' ? 'en francés' : 'en inglés')} · ${ui('{0}–{1} palabras', min, max)}</span></h3>
          <p class="ayuda">${ui('Con tus palabras, sin opiniones propias, en registro formal. Puedes usar el diccionario (📚, a la derecha), como en el examen.')}</p>
          <textarea id="idi-resumen" rows="16" lang="${l()}" spellcheck="false" ${T.corr ? 'readonly' : ''} placeholder="${l() === 'fr' ? 'Ce texte traite de…' : 'The text deals with…'}">${esc(T.resumen)}</textarea>
          <div class="idi-contador"><span id="idi-cuenta"></span><span class="apagado">⏱ ${ui('resumen: {0}', '<span id="idi-r-reloj"></span>')}</span></div>
          <div id="idi-corr-estado">${T.corr ? `<p class="idi-progreso">${esc(T.corr.msg)}</p>` : ''}</div>
          <p class="idi-acciones"><button class="primario" data-corregir ${T.corr ? 'disabled' : ''}>${ui('Corregir mi resumen')}</button><button data-saltar ${T.corr ? 'disabled' : ''}>${ui('Seguir sin corregir')}</button></p></section>
        <div>${T.modo === 'lectura' ? `<section class="idi-caja"><h3>📖 ${ui('Texto')} <button class="idi-mini" data-ver>${verTexto ? ui('Ocultar') : ui('Mostrar')}</button></h3>
            ${verTexto ? `<div class="idi-lectura compacta" lang="${l()}">${parrafosHtml(x)}</div>` : `<p class="apagado idi-mini">${ui('Oculto: resume de memoria y con tus notas, como en el examen.')}</p>`}</section>` : ''}
          ${notasHtml(T, '')}</div></div>`;
      enlazarNotas(z);
      const ta = z.querySelector('#idi-resumen'), cuenta = z.querySelector('#idi-cuenta');
      const contar = () => { const n = palabras(ta.value); cuenta.textContent = nPal(n); cuenta.className = n < min ? 'corto' : n > max ? 'largo' : 'bien'; T.resumen = ta.value; };
      ta.oninput = contar; contar(); ta.focus();
      const t0 = T.tEtapa; const rr = z.querySelector('#idi-r-reloj');
      const pintarR = () => { rr.textContent = reloj((Date.now() - t0) / 1000); }; pintarR();
      const prev = tic; clearInterval(prev);
      conReloj(() => { pintarR(); const r = vEl().querySelector('#idi-t-reloj'); if (r) r.textContent = reloj((Date.now() - T.t0) / 1000); });
      const v = z.querySelector('[data-ver]'); if (v) v.onclick = () => { T.verTexto = !T.verTexto; eResumen(z); };
      z.querySelector('[data-saltar]').onclick = siguienteEtapa;
      // la corrección sigue aunque se repinte la etapa (mostrar u ocultar el texto, abrir una ficha…): su estado vive en T.corr
      z.querySelector('[data-corregir]').onclick = async () => {
        if (T.corr) return;
        if (palabras(ta.value) < 20) { A.aviso(ui('Escribe al menos unas frases (20 palabras).'), true); return; }
        T.resumen = ta.value; T.corr = { msg: ui('Corrigiendo…') }; eResumen(z);
        const pinta = () => { const est = P.T === T && vEl().querySelector('#idi-corr-estado'); if (est && T.corr) est.innerHTML = `<p class="idi-progreso">${esc(T.corr.msg)}</p>`; };
        try {
          const r = await pedir('idiPCorregir', { lengua: l(), clase: 'resumen', id: x.id, k: x.k, texto: T.resumen, segundos: (Date.now() - T.tEtapa) / 1000, modo: T.modo, notas: T.notas, sinSesion: true },
            (txt) => { if (T.corr) { T.corr.msg = txt; pinta(); } });
          T.corr = null;
          if (P.T !== T) return;   // el usuario salió del texto mientras se corregía
          T.escrito = r.escrito; avanzarDesde(T, 'resumen');
        } catch (e) {
          T.corr = null; if (P.T !== T) return;
          const zz = etapa() === 'resumen' && zonaEtapa(); if (zz) eResumen(zz);
          fallo(e);
        }
      };
    }

    function ePreguntas(z) {
      const T = P.T, x = T.texto;
      const tipoTxt = { vf: 'Verdadero / falso', eleccion: 'Elige', vocabulario: 'Vocabulario', abierta: 'Respuesta breve' };
      z.innerHTML = `<div class="idi-p-dos">
        <section class="idi-caja"><h3>❓ ${ui('Preguntas de comprensión')}</h3>
          ${x.preguntas.map((p, i) => {
            const r = T.resultados[p.id];
            const resp = T.respuestas[p.id] || '';
            let campo = '';
            if (p.tipo === 'vf') campo = `<div class="segmentos">${[['V', 'Verdadero'], ['F', 'Falso'], ['ND', 'No se dice']].map(([k, n]) => `<button data-resp="${k}" class="${resp === k ? 'activo' : ''} ${r ? (r.correcta === k ? 'ok' : resp === k ? 'mal' : '') : ''}" ${r ? 'disabled' : ''}>${ui(n)}</button>`).join('')}</div>`;
            else if (p.tipo === 'eleccion') campo = `<div class="idi-opciones">${(p.opciones || []).map((o) => `<button data-resp="${esc(o)}" class="${resp === o ? 'activo' : ''} ${r ? (r.respuestas.includes(o) ? 'ok' : resp === o ? 'mal' : '') : ''}" ${r ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>`;
            else if (p.tipo === 'abierta') campo = `<textarea rows="3" data-escribe lang="${l()}" ${r ? 'disabled' : ''}>${esc(resp)}</textarea>`;
            else campo = `<input type="text" data-escribe autocomplete="off" spellcheck="false" lang="${l()}" value="${esc(resp)}" ${r ? 'disabled' : ''}>`;
            return `<div class="idi-preg ${r ? (r.ok ? 'ok' : r.parcial ? 'parcial' : r.autoevaluar ? '' : 'mal') : (T.esperando || {})[p.id] ? 'esperando' : ''}" data-preg="${esc(p.id)}">
              <div class="idi-preg-cab"><b>${i + 1}.</b> <span class="idi-ej-tipo">${tipoTxt[p.tipo] ? ui(tipoTxt[p.tipo]) : p.tipo}</span> <span class="apagado idi-mini">${ui('párrafo {0}', p.parrafo + 1)}</span></div>
              ${p.enunciado ? `<p class="idi-enun">${esc(p.enunciado)}</p>` : ''}<p class="idi-preg-txt" lang="${l()}">${esc(p.pregunta)}</p>
              ${campo}
              ${r ? veredicto(p, r) : p.tipo === 'vf' || p.tipo === 'eleccion' ? '' : `<p class="idi-acciones"><button data-comprobar>${ui('Comprobar')}</button></p>`}</div>`;
          }).join('')}
          <p class="idi-acciones"><button class="primario" data-seguir>${T.etapas[T.e + 1] === 'final' ? `${ui('Ver el resultado')} →` : `${ui('Seguir')} →`}</button></p></section>
        <div><section class="idi-caja"><h3>📖 ${ui('Texto')} ${T.modo === 'escucha' && !T.mostrarTexto ? `<button class="idi-mini" data-mostrar>${ui('Mostrar')}</button>` : ''}</h3>
          ${T.modo === 'escucha' && !T.mostrarTexto ? `<p class="apagado idi-mini">${ui('Oculto: contesta con lo que recuerdes y tus notas. Tras corregir cada pregunta verás la frase del texto que la justifica.')}</p>`
    : `<div class="idi-lectura compacta" lang="${l()}">${parrafosHtml(x, T.marcar)}</div>`}</section>${notasHtml(T, '')}</div></div>`;
      enlazarNotas(z);
      const m = z.querySelector('[data-mostrar]'); if (m) m.onclick = () => { T.mostrarTexto = true; ePreguntas(z); };
      z.querySelectorAll('.idi-preg').forEach((el) => {
        const id = el.dataset.preg;
        el.querySelectorAll('[data-resp]').forEach((b) => b.onclick = () => { T.respuestas[id] = b.dataset.resp; comprobarPregunta(id, z); });
        const w = el.querySelector('[data-escribe]');
        if (w) { w.oninput = () => { T.respuestas[id] = w.value; }; if (w.tagName === 'INPUT') w.onkeydown = (e) => { if (e.key === 'Enter') comprobarPregunta(id, z); }; }
        const c = el.querySelector('[data-comprobar]'); if (c) c.onclick = () => comprobarPregunta(id, z);
        el.querySelectorAll('[data-ir-par]').forEach((a) => a.onclick = () => { T.marcar = Number(a.dataset.irPar); T.mostrarTexto = true; ePreguntas(z); const p = vEl().querySelector(`[data-par="${T.marcar}"]`); if (p) p.scrollIntoView({ block: 'center' }); });
        el.querySelectorAll('[data-auto]').forEach((b) => b.onclick = () => { T.resultados[id] = { ...T.resultados[id], ok: b.dataset.auto === 'bien', parcial: b.dataset.auto === 'regular', autoevaluado: true }; ePreguntas(z); });
      });
      z.querySelector('[data-seguir]').onclick = siguienteEtapa;
    }
    async function comprobarPregunta(id, z) {
      const T = P.T; if (T.resultados[id]) return;
      T.esperando = T.esperando || {}; if (T.esperando[id]) return;   // ya se está comprobando: no se manda dos veces
      const resp = T.respuestas[id] || '';
      if (!String(resp).trim()) return;
      T.esperando[id] = true;
      const el = z.querySelector(`[data-preg="${id}"]`); if (el) el.classList.add('esperando');
      // se repinta la zona que haya en pantalla en ese momento (la etapa se ha podido repintar mientras tanto)
      const repintar = () => { const zz = P.T === T && etapa() === 'preguntas' && zonaEtapa(); if (zz) ePreguntas(zz); };
      try {
        const { resultado } = await pedir('idiPResponder', { lengua: l(), id: T.texto.id, pregunta: id, respuesta: resp });
        delete T.esperando[id];
        if (P.T !== T) return;
        T.resultados[id] = resultado; if (resultado.aviso) A.aviso(resultado.aviso, true); repintar();
      } catch (e) { delete T.esperando[id]; fallo(e); repintar(); }
    }
    function veredicto(p, r) {
      if (r.autoevaluar && !r.autoevaluado) {
        return `<div class="idi-ver"><div class="idi-ver-cab">${ui('Compara con la respuesta modelo')}</div><p lang="${l()}"><b>${esc(r.correcta)}</b></p>
          ${r.cita ? `<p class="idi-cita" lang="${l()}">«${esc(r.cita)}» <a data-ir-par="${r.parrafo}">${ui('ver en el texto')}</a></p>` : ''}
          <p class="idi-mini apagado">${ui('Sin el modelo local instalado, valóralo tú:')}</p><div class="segmentos"><button data-auto="bien">${ui('Bien')}</button><button data-auto="regular">${ui('A medias')}</button><button data-auto="mal">${ui('Mal')}</button></div></div>`;
      }
      const ok = r.ok;
      const correcta = p.tipo === 'vf' ? ui({ V: 'Verdadero', F: 'Falso', ND: 'No se dice' }[r.correcta] || r.correcta) : r.correcta;
      return `<div class="idi-ver ${ok ? 'ok' : r.parcial ? 'parcial' : 'mal'}"><div class="idi-ver-cab">${ok ? `✓ ${ui('Correcto')}` : r.parcial ? `≈ ${ui('A medias')}` : r.casi ? `✗ ${ui('Casi: revisa los acentos')}` : `✗ ${ui('No es correcto')}`}</div>
        ${!ok || p.tipo === 'abierta' ? `<div><small>${p.tipo === 'abierta' ? ui('Respuesta modelo') : ui('Respuesta correcta')}</small> <b class="idi-bien" lang="${l()}">${esc(correcta)}</b>${r.respuestas && r.respuestas.length > 1 && p.tipo === 'vocabulario' ? ` <span class="apagado">· ${ui('también {0}', esc(r.respuestas.slice(1).join(' · ')))}</span>` : ''}</div>` : ''}
        ${r.comentario ? `<p>🤖 ${esc(r.comentario)}</p>` : ''}
        ${r.cita ? `<p class="idi-cita" lang="${l()}">«${esc(r.cita)}» <a data-ir-par="${r.parrafo}">${ui('ver en el texto')}</a></p>` : ''}
        ${r.explicacion ? `<p class="apagado">${esc(r.explicacion)}</p>` : ''}</div>`;
    }

    function eDictado(z) {
      const T = P.T, D = T.dictado, frases = T.texto.dictado;
      const f = frases[D.i];
      const hecho = D.res[D.i];
      z.innerHTML = `<section class="idi-caja idi-dictado"><h3>✏️ ${ui('Dictado · frase {0} de {1}', D.i + 1, frases.length)}</h3>
        <p class="ayuda">${ui('Escucha la frase (las veces que quieras) y escríbela tal cual, con puntuación y acentos.')}</p>
        <p class="idi-acciones"><button class="primario" data-oir>🔊 ${ui('Escuchar')}</button><button data-lento>🐢 ${ui('Más despacio')}</button></p>
        <textarea id="idi-dic" rows="3" lang="${l()}" spellcheck="false" ${hecho ? 'disabled' : ''}>${esc(hecho ? hecho.escrito : '')}</textarea>
        ${hecho ? `<div class="idi-dic-res">${hecho.palabras.map((w) => w.tipo === 'ok' ? `<span class="ok">${esc(w.o)}</span>` : w.tipo === 'acento' ? `<span class="acento" title="${ui('Escribiste «{0}»', esc(w.e))}">${esc(w.o)}</span>`
    : w.tipo === 'falta' ? `<span class="falta" title="${ui('Te faltó')}">${esc(w.o)}</span>` : w.tipo === 'sobra' ? `<span class="sobra" title="${ui('Sobra')}">${esc(w.e)}</span>` : `<span class="mal" title="${ui('Escribiste «{0}»', esc(w.e))}">${esc(w.o)}</span>`).join(' ')}</div>
          <p class="apagado idi-mini">${ui('Verde: bien · ámbar: falla un acento · rojo: mal escrita (pasa el ratón para ver lo que pusiste) · tachado: sobra · subrayado: falta.')}</p>` : ''}
        <p class="idi-acciones">${hecho ? `<button class="primario" data-sig>${D.i + 1 < frases.length ? `${ui('Siguiente frase')} →` : `${ui('Terminar el dictado')} →`}</button>` : `<button class="primario" data-comprobar>${ui('Comprobar')}</button>`}</p></section>`;
      const oir = (lento) => { Lector.parar(); Lector.hablar(f.frase, () => {}, lento ? Math.max(0.6, velocidad() - 0.25) : undefined); };
      z.querySelector('[data-oir]').onclick = () => oir(false);
      z.querySelector('[data-lento]').onclick = () => oir(true);
      const ta = z.querySelector('#idi-dic');
      if (!hecho) { ta.focus(); if (!D.oido) { D.oido = true; setTimeout(() => oir(false), 300); } }
      const c = z.querySelector('[data-comprobar]');
      if (c) c.onclick = async () => {
        try { const { resultado } = await pedir('idiPDictado', { original: f.frase, escrito: ta.value }); D.res[D.i] = { escrito: ta.value, ...resultado, ...resultado.resumen }; eDictado(z); } catch (e) { fallo(e); }
      };
      const s = z.querySelector('[data-sig]');
      if (s) s.onclick = () => { D.oido = false; if (D.i + 1 < frases.length) { D.i += 1; eDictado(z); } else siguienteEtapa(); };
    }

    function eFinal(z) {
      const T = P.T, x = T.texto;
      const rs = Object.values(T.resultados);
      const bien = rs.filter((r) => r.ok).length + 0.5 * rs.filter((r) => r.parcial).length;
      const dic = T.dictado.res.filter(Boolean);
      const notaDic = dic.length ? dic.reduce((a, d) => a + d.nota, 0) / dic.length : null;
      if (!T.guardado) {
        T.guardado = true;
        pedir('idiPTerminarTexto', { lengua: l(), id: x.id, modo: T.modo, longitud: T.conf.longitud, segundos: (Date.now() - T.t0) / 1000,
          comprension: rs.length ? { bien, total: rs.length } : null, dictado: notaDic != null ? { nota: notaDic, total: dic.length } : null }).catch(fallo);
      }
      z.innerHTML = `<div class="idi-p-final">
        <section class="idi-caja"><h3>${ui('Resultado')}</h3><div class="idi-res-cifras">
          ${T.escrito ? `<div><b>${T.escrito.nota != null ? `${T.escrito.nota}/10` : '—'}</b><small>${ui('Resumen')}</small></div>` : ''}
          ${rs.length ? `<div><b>${Math.round((100 * bien) / rs.length)} %</b><small>${ui('Preguntas ({0} de {1})', bien, rs.length)}</small></div>` : ''}
          ${notaDic != null ? `<div><b>${Math.round(notaDic * 100)} %</b><small>${ui('Dictado')}</small></div>` : ''}
          <div><b>${reloj((Date.now() - T.t0) / 1000)}</b><small>${ui('Tiempo')}</small></div></div></section>
        ${T.escrito ? `<div id="idi-escrito-res"></div>` : ''}
        <section class="idi-caja"><h3>📖 ${T.modo === 'escucha' ? ui('El texto que escuchaste') : ui('El texto')}</h3><details ${T.modo === 'escucha' ? 'open' : ''}><summary>${ui('Ver el texto')}</summary>
          <div class="idi-lectura compacta" lang="${l()}">${parrafosHtml(x)}</div></details></section>
        ${x.glosario.length ? `<section class="idi-caja"><h3>📚 ${ui('Vocabulario del texto')}</h3><div class="idi-glos">${x.glosario.map((g) => `<span lang="${l()}"><b>${esc(g.palabra)}</b> ${glosaDef(g)}${g.nota ? ` <i class="apagado">${esc(g.nota)}</i>` : ''}</span>`).join('')}</div>
          <p class="idi-mini apagado">${ui('Selecciona una palabra para añadirla a Mi diccionario.')}</p></section>` : ''}
        <section class="idi-caja"><h3>🗣️ ${ui('Para practicar el oral')}</h3><p class="ayuda">${ui('Exponlo en voz alta o responde a las preguntas que haría el tribunal sobre este texto.')}</p>
          <ul class="idi-trib">${x.tribunal.slice(0, 4).map((q) => `<li lang="${l()}">${esc(q.pregunta)} <span class="apagado idi-mini">${esc(q.pista_es || '')}</span></li>`).join('')}</ul>
          <p class="idi-acciones"><button data-oral="exposicion">${ui('Exponer este texto')}</button><button data-oral="lectura">${ui('Leerlo en voz alta')}</button>${T.escrito ? `<button data-oral="resumen">${ui('Leer mi resumen en voz alta')}</button>` : ''}<button data-oral="tribunal">${ui('Preguntas del tribunal')}</button></p></section>
        <p class="idi-acciones centro"><button class="primario" data-fin>${ui('Volver a la biblioteca')}</button></p></div>`;
      if (T.escrito) pintarEscrito(z.querySelector('#idi-escrito-res'), T.escrito);
      z.querySelector('[data-fin]').onclick = () => { terminarTexto(false); };
      z.querySelectorAll('[data-oral]').forEach((b) => b.onclick = () => {
        const clase = b.dataset.oral;
        O.preparado = { clase, textoId: x.id, k: x.k, titulo: x.titulo, parrafos: x.parrafos, escrito: T.escrito ? T.escrito.texto : '', tribunal: x.tribunal };
        terminarTexto(false, 'oral');
      });
    }
    /** Significado de una palabra del glosario: en la lengua del panel, la definición en esa lengua (si la hay) y el castellano en gris.
     *  El <b>palabra</b> va siempre primero en el <span> (lo usa definicionGlosario en idiomas.js). */
    function glosaDef(g) {
      if (!enL()) return esc(g.significado);
      const es = g.significado ? `<span class="idi-es">${esc(g.significado)}</span>` : '';
      return g.definicion_l ? `${esc(g.definicion_l)}${es ? ` ${es}` : ''}` : es;
    }
    function terminarTexto(cancelado, destino) {
      parar(); const T = P.T;
      if (cancelado && T && T.e > 0 && !T.guardado && Object.keys(T.resultados).length) {
        const rs = Object.values(T.resultados);
        pedir('idiPTerminarTexto', { lengua: l(), id: T.texto.id, modo: T.modo, longitud: T.conf.longitud, segundos: (Date.now() - T.t0) / 1000,
          comprension: { bien: rs.filter((r) => r.ok).length, total: rs.length } }).catch(() => {});
      }
      P.T = null;
      if (destino) A.ir(destino); else pBibliotecaIr();
    }
    const pBibliotecaIr = () => { A.ir('biblioteca'); };

    // ================================================================== corrección de un escrito (resumen o tarea)
    function pintarEscrito(z, e, { editable = true } = {}) {
      const v = e.valoracion || {};
      const crit = e.auto || v.criterios || {};
      const marcado = marcarTexto(e);
      const ideas = e.ideas || [];
      const est = e.ideasEstado || {};
      z.innerHTML = `<section class="idi-caja idi-escrito">
        <h3>✍️ ${ui('Corrección')} ${e.nota != null ? `<span class="idi-nota-grande">${e.nota}<small>/10</small></span>` : ''}</h3>
        ${(e.avisos || []).map((a) => `<p class="idi-aviso suave">${esc(a)}${/no está instalado|not installed|n.est pas installé/i.test(a) ? ` <a data-instalar>${ui('Instalar herramientas')}</a>` : ''}</p>`).join('')}
        ${v.comentario ? `<p class="idi-comentario">🤖 ${esc(v.comentario)}</p>` : ''}
        <div class="idi-esc-dos">
          <div><h4>${ui('Tu texto')} <span class="apagado idi-mini">${nPal(e.palabras)}${e.extension ? ` · ${ui('recomendado {0}–{1}', e.extension[0], e.extension[1])}` : ''}</span></h4>
            <div class="idi-esc-texto" lang="${e.lengua}">${marcado}</div>
            <p class="idi-mini apagado">${e.errores ? ui('{0} posibles errores de LanguageTool (subrayados: pasa el ratón).', e.errores.length) : ''}${e.copiado && e.copiado.fragmentos.length ? ` ${ui('En morado, fragmentos copiados del texto ({0} %): en el examen se pide reformular.', Math.round(e.copiado.proporcion * 100))}` : ''}</p></div>
          <div><h4>${ui('Rúbrica')} <span class="apagado idi-mini">${e.auto ? ui('(tu valoración)') : v.criterios ? ui('(modelo local; puedes cambiarla)') : ui('(valórala tú)')}</span></h4>
            <table class="idi-rubrica">${RUBRICA.map(([k, n]) => `<tr><td>${ui(n)}</td><td><select data-crit="${k}">${['—', 0, 1, 2, 3, 4].map((x) => `<option value="${x}" ${crit[k] && Number(crit[k].nota) === x ? 'selected' : ''}>${x === '—' ? '—' : `${x} · ${ui(BANDAS[x])}`}</option>`).join('')}</select>
              ${crit[k] && crit[k].comentario ? `<div class="idi-mini apagado">${esc(crit[k].comentario)}</div>` : ''}</td></tr>`).join('')}</table>
            ${editable ? `<p class="idi-acciones"><button data-guardar-auto>${ui('Guardar mi valoración')}</button></p>` : ''}</div></div>
        ${ideas.length ? `<h4>${ui('Ideas del texto')} <span class="apagado idi-mini">${v.ideas ? ui('(según el modelo local; corrígelo si no estás de acuerdo)') : ui('(marca las que recogiste)')}</span></h4>
          <ul class="idi-ideas">${ideas.map((x, i) => { const s = est[i + 1] || ''; return `<li class="${s}"><select data-idea="${i + 1}">${[['', '', '¿?'], ['recogida', '✓', 'recogida'], ['parcial', '≈', 'a medias'], ['falta', '✗', 'falta']].map(([k, sg, n]) => `<option value="${k}" ${s === k ? 'selected' : ''}>${sg ? `${sg} ${ui(n)}` : n}</option>`).join('')}</select>
            ${x.principal ? `<b title="${ui('Imprescindible')}">★</b>` : ''}<span lang="${e.lengua}">${esc(x.idea)}</span></li>`; }).join('')}</ul>` : ''}
        ${(v.inexactitudes || []).length ? `<h4>⚠️ ${ui('Inexactitudes')}</h4><ul>${v.inexactitudes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${(v.mejoras || []).length ? `<h4>💡 ${ui('Propuestas de mejora')}</h4><ul class="idi-mejoras">${v.mejoras.map((m) => `<li><span class="idi-tuya-mal" lang="${e.lengua}">${esc(m.original)}</span> → <b class="idi-bien" lang="${e.lengua}">${esc(m.propuesta)}</b><div class="apagado idi-mini">${esc(m.motivo)}</div></li>`).join('')}</ul>` : ''}
        ${e.resumenModelo ? `<details><summary>📄 ${ui('Resumen modelo')}</summary><p lang="${e.lengua}" class="idi-modelo">${esc(e.resumenModelo)}</p></details>` : ''}
        ${e.modelo ? `<details><summary>📄 ${ui('Texto modelo')}</summary><p lang="${e.lengua}" class="idi-modelo">${esc(e.modelo)}</p></details>` : ''}
      </section>`;
      const inst = z.querySelector('[data-instalar]'); if (inst) inst.onclick = () => A.ir('ajustes');
      const g = z.querySelector('[data-guardar-auto]');
      if (g) g.onclick = async () => {
        const criterios = {}; let completo = true;
        z.querySelectorAll('[data-crit]').forEach((s) => { if (s.value === '—') completo = false; else criterios[s.dataset.crit] = { nota: Number(s.value), comentario: (crit[s.dataset.crit] || {}).comentario || '' }; });
        const ideasEstado = {}; z.querySelectorAll('[data-idea]').forEach((s) => { if (s.value) ideasEstado[s.dataset.idea] = s.value; });
        try { const r = await pedir('idiPAutoevaluar', { id: e.id, ideasEstado, criterios: completo ? criterios : null }); Object.assign(e, r.escrito); pintarEscrito(z, e); A.aviso(ui('Valoración guardada.')); } catch (x) { fallo(x); }
      };
      z.querySelectorAll('[data-idea]').forEach((s) => s.onchange = () => { s.closest('li').className = s.value; });
    }
    /** Texto del usuario con los errores de LanguageTool subrayados y los fragmentos copiados en morado */
    function marcarTexto(e) {
      const t = e.texto; const marcas = [];
      for (const x of e.errores || []) marcas.push({ a: x.inicio, b: x.inicio + x.largo, cls: x.tipo === 'misspelling' ? 'lt-orto' : 'lt-gram', tit: `${x.mensaje}${x.sugerencias.length ? ` → ${x.sugerencias.join(' / ')}` : ''}` });
      if (e.copiado) for (const fr of e.copiado.fragmentos) { const i = t.indexOf(fr); if (i >= 0) marcas.push({ a: i, b: i + fr.length, cls: 'copiado', tit: ui('Copiado del texto') }); }
      marcas.sort((x, y) => x.a - y.a);
      let out = '', pos = 0;
      for (const m of marcas) { if (m.a < pos) continue; out += esc(t.slice(pos, m.a)) + `<span class="${m.cls}" title="${esc(m.tit)}">${esc(t.slice(m.a, m.b))}</span>`; pos = m.b; }
      return (out + esc(t.slice(pos))).replace(/\n/g, '<br>');
    }

    // ================================================================== expresión escrita
    async function pEscritura() {
      vEl().innerHTML = `<div class="idi-p">${cab(`✍️ ${ui('Expresión escrita')}`)}<div id="idi-esc"><p class="apagado">${ui('Cargando…')}</p></div></div>`;
      enlazarVolver(vEl());
      try {
        const [{ tareas, expresiones }, { lista }] = await Promise.all([pedir('idiPTareas', { lengua: l() }), pedir('idiPEscritos', { lengua: l() })]);
        P.tareas = tareas; P.expresiones = expresiones; P.escritos = lista; pintarEscritura();
      } catch (e) { fallo(e); }
    }
    function pintarEscritura() {
      const z = vEl().querySelector('#idi-esc'); if (!z) return;
      const f = (A.st().idiEscFiltro = A.st().idiEscFiltro || { nivel: '', tipo: '' });
      const xs = P.tareas.filter((t) => (!f.nivel || t.nivel === f.nivel) && (!f.tipo || t.tipo === f.tipo));
      z.innerHTML = `<div class="idi-cuerpo"><div>
          <section class="idi-caja"><h3>${ui('Resumir un texto')}</h3><p class="ayuda">${ui('Los resúmenes se hacen desde la biblioteca: así se corrigen frente a las ideas del texto.')}</p>
            <p class="idi-acciones"><button data-bib="lectura">📖 ${ui('Comprensión lectora')}</button><button data-bib="escucha">🎧 ${ui('Comprensión auditiva')}</button></p></section>
          <section class="idi-caja"><h3>${ui('Mis escritos')}</h3>${P.escritos.length ? `<ul class="idi-hist idi-escritos">${P.escritos.map((e) => `<li data-escrito="${esc(e.id)}"><span>${A.fechaCorta(e.fecha)}</span>
            <span>${esc(e.clase === 'resumen' ? `${ui('Resumen')} · ${e.titulo || ''}` : e.titulo || '')}</span><span>${e.nota != null ? `${e.nota}/10` : '—'}</span></li>`).join('')}</ul>` : `<p class="apagado">${ui('Aún no has corregido ninguno.')}</p>`}</section>
        </div><section>
          <div class="idi-filtros"><select data-f="nivel"><option value="">${ui('Todos los niveles')}</option>${A.NIVELES.map((n) => `<option ${f.nivel === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
            <select data-f="tipo"><option value="">${ui('Todos los tipos')}</option>${Object.entries(TIPOS_TAREA).map(([k, v]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${ui(v)}</option>`).join('')}</select></div>
          <div class="idi-textos">${xs.map((t) => `<article class="idi-ctexto n-${t.nivel}" data-tarea="${esc(t.id)}" tabindex="0">
            <div class="idi-carta-fila"><span class="idi-chip-niv">${t.nivel}</span><span class="idi-chip-bloque">${esc(TIPOS_TAREA[t.tipo] ? ui(TIPOS_TAREA[t.tipo]) : t.tipo)}</span><span class="apagado idi-der-auto">${ui('{0}–{1} palabras', t.palabras[0], t.palabras[1])} · ${esc(ui(t.registro))}</span></div>
            <h4>${esc(tituloTarea(t))}</h4><p class="idi-carta-desc" lang="${l()}">${esc(t.enunciado.slice(0, 220))}${t.enunciado.length > 220 ? '…' : ''}</p></article>`).join('') || `<p class="vacio">${ui('Sin tareas: ejecuta «Sincronizar».')}</p>`}</div></section></div>`;
      z.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { f[s.dataset.f] = s.value; A.guardar(); pintarEscritura(); });
      z.querySelectorAll('[data-bib]').forEach((b) => b.onclick = () => { P.modo = b.dataset.bib; A.ir('biblioteca'); });
      z.querySelectorAll('[data-tarea]').forEach((c) => c.onclick = () => { P.W = { tarea: P.tareas.find((t) => t.id === c.dataset.tarea), texto: '', t0: Date.now() }; A.ir('escribir'); });
      z.querySelectorAll('[data-escrito]').forEach((li) => li.onclick = async () => { try { const { escrito } = await pedir('idiPEscrito', { id: li.dataset.escrito }); P.verEscrito = escrito; A.ir('escrito'); } catch (e) { fallo(e); } });
    }
    /** Título de una tarea: en la lengua del panel si la extensión lo da (los datos ya llegan traducidos en ese modo) */
    const tituloTarea = (t) => (enL() ? t.titulo || t.titulo_es : t.titulo_es) || '';
    function pEscribir() {
      const W = P.W; if (!W) return A.ir('escritura');
      const t = W.tarea;
      vEl().innerHTML = `<div class="idi-p">${cab(`✍️ ${esc(tituloTarea(t))}`, `<span class="idi-chip-niv n-${t.nivel}">${t.nivel}</span><span class="apagado idi-der-auto">⏱ <span id="idi-w-reloj"></span></span>`)}
        <div class="idi-p-dos"><section class="idi-caja">
          <div class="idi-enunciado" lang="${l()}">${esc(t.enunciado)}</div>
          <p class="apagado idi-mini">${TIPOS_TAREA[t.tipo] ? ui(TIPOS_TAREA[t.tipo]) : esc(t.tipo)} · ${ui('registro {0}', esc(ui(t.registro)))} · ${ui('{0}–{1} palabras', t.palabras[0], t.palabras[1])}</p>
          <textarea id="idi-w" rows="18" lang="${l()}" spellcheck="false" ${W.corr ? 'readonly' : ''}>${esc(W.texto)}</textarea>
          <div class="idi-contador"><span id="idi-w-cuenta"></span></div><div id="idi-w-estado">${W.corr ? `<p class="idi-progreso">${esc(W.corr.msg)}</p>` : ''}</div>
          <p class="idi-acciones"><button class="primario" data-corregir ${W.corr ? 'disabled' : ''}>${ui('Corregir')}</button></p></section>
        <div><section class="idi-caja"><h3>${ui('Estructura')}</h3><ol>${(t.estructura || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
          <section class="idi-caja"><h3>${ui('Expresiones útiles')}</h3><div class="idi-glos" lang="${l()}">${(t.expresiones || []).map((x) => `<span>${esc(x)}</span>`).join('')}</div>
          <p class="idi-mini apagado">${ui('Más en el banco de expresiones (abajo).')}</p></section>
          ${bancoExpresiones()}</div></div></div>`;
      enlazarVolver(vEl(), 'escritura');
      const ta = vEl().querySelector('#idi-w'), c = vEl().querySelector('#idi-w-cuenta');
      const contar = () => { const n = palabras(ta.value); W.texto = ta.value; c.textContent = nPal(n); c.className = n < t.palabras[0] ? 'corto' : n > t.palabras[1] ? 'largo' : 'bien'; };
      ta.oninput = contar; contar(); ta.focus();
      const pintaW = () => { const r = vEl().querySelector('#idi-w-reloj'); if (r) r.textContent = reloj((Date.now() - W.t0) / 1000); };
      pintaW(); conReloj(pintaW);
      // como en el resumen: el estado de la corrección vive en W.corr y sobrevive a que se repinte la pantalla
      vEl().querySelector('[data-corregir]').onclick = async () => {
        if (W.corr) return;
        if (palabras(ta.value) < 20) { A.aviso(ui('Escribe al menos unas frases (20 palabras).'), true); return; }
        W.texto = ta.value; W.corr = { msg: ui('Corrigiendo…') }; pEscribir();
        const enPantalla = () => P.W === W && vEl().querySelector('#idi-w');
        try {
          const { escrito } = await pedir('idiPCorregir', { lengua: l(), clase: 'tarea', tareaId: t.id, texto: W.texto, segundos: (Date.now() - W.t0) / 1000 },
            (x) => { if (!W.corr) return; W.corr.msg = x; const est = enPantalla() && vEl().querySelector('#idi-w-estado'); if (est) est.innerHTML = `<p class="idi-progreso">${esc(x)}</p>`; });
          W.corr = null;
          if (P.W !== W) return;
          P.verEscrito = escrito; P.W = null;
          if (enPantalla() || vEl().querySelector('#idi-w')) { parar(); A.ir('escrito'); } else A.aviso(ui('Tu escrito ya está corregido: lo tienes en Expresión escrita › Mis escritos.'));
        } catch (e) { W.corr = null; if (P.W !== W) return; if (enPantalla()) pEscribir(); fallo(e); }
      };
    }
    function bancoExpresiones() {
      if (!P.expresiones || !P.expresiones.length) return '';
      return `<section class="idi-caja"><h3>${ui('Banco de expresiones')}</h3>${P.expresiones.map((f) => `<details><summary>${esc((enL() ? f.titulo || f.titulo_es : f.titulo_es) || '')}</summary>
        <ul class="idi-expr" lang="${l()}">${f.expresiones.map((x) => `<li><b>${esc(x.texto)}</b> <span class="apagado idi-mini">${esc(x.registro ? ui(x.registro) : '')}${x.nota_es ? ` · ${esc(x.nota_es)}` : ''}</span></li>`).join('')}</ul></details>`).join('')}</section>`;
    }
    function pEscrito() {
      const e = P.verEscrito; if (!e) return A.ir('escritura');
      vEl().innerHTML = `<div class="idi-p">${cab(`✍️ ${esc(e.clase === 'resumen' ? `${ui('Resumen')} · ${e.titulo || ''}` : e.titulo || ui('Escrito'))}`, `<span class="apagado">${A.fechaCorta(e.fecha)}</span>`)}
        <div id="idi-esc-res"></div>
        <p class="idi-acciones"><button data-volver-esc>← ${ui('Mis escritos')}</button>${e.clase === 'resumen' ? `<button data-leer>🗣️ ${ui('Leerlo en voz alta')}</button>` : ''}</p></div>`;
      enlazarVolver(vEl());
      pintarEscrito(vEl().querySelector('#idi-esc-res'), e);
      vEl().querySelector('[data-volver-esc]').onclick = () => A.ir('escritura');
      const lr = vEl().querySelector('[data-leer]');
      if (lr) lr.onclick = () => { O.preparado = { clase: 'resumen', textoId: e.textoId, k: e.k, titulo: e.titulo, escrito: e.texto }; A.ir('oral'); };
    }

    // ================================================================== expresión oral (grabar, transcribir, valorar)
    const O = { estado: null, sondeo: null, actual: null, preparado: null, pide: null };
    function alEstadoOral() {
      const z = vEl() && vEl().querySelector('#idi-grab'); if (!z) return;
      pintarGrabador(z);
      if (O.actual && O.actual.id && O.actual.fase === 'transcribiendo' && O.estado && (!O.estado.transcribiendo || O.estado.transcribiendo.id !== O.actual.id) && !(O.estado.cola || []).includes(O.actual.id)) valorarActual();
    }
    async function pOral() {
      const pre = O.preparado;
      try { O.estado = (await pedir('idiPEstadoOral')).estado; } catch (e) { /* sin perfil */ }
      if (O.estado && O.estado.grabando) {   // grabación que sigue viva (p. ej. tras recargar la ventana): se puede parar
        vEl().innerHTML = `<div class="idi-p">${cab(`🗣️ ${ui('Expresión oral')}`)}<section class="idi-caja" id="idi-grab"></section></div>`;
        enlazarVolver(vEl());
        O.pre = O.pre || { clase: O.estado.grabando.clase }; O.actual = { fase: 'grabando', clase: O.estado.grabando.clase };
        clearInterval(O.sondeo); O.sondeo = setInterval(async () => { try { const r = await pedir('idiPEstadoOral'); O.estado = r.estado; pintarGrabador(vEl().querySelector('#idi-grab')); if (!r.estado.grabando) { clearInterval(O.sondeo); O.sondeo = null; } } catch (e) { clearInterval(O.sondeo); } }, 600);
        return pintarGrabador(vEl().querySelector('#idi-grab'));
      }
      vEl().innerHTML = `<div class="idi-p">${cab(`🗣️ ${ui('Expresión oral')}`)}<div id="idi-oral"></div></div>`;
      enlazarVolver(vEl());
      const z = vEl().querySelector('#idi-oral');
      if (pre) { O.preparado = null; return prepararOral(z, pre); }
      let grabs = [];
      try { grabs = (await pedir('idiPGrabaciones', { lengua: l() })).lista; } catch (e) { /* sin perfil */ }
      z.innerHTML = `<div class="idi-cuerpo"><div>
          <section class="idi-caja"><h3>${ui('Practicar')}</h3><div class="idi-oral-modos">
            <button data-om="tribunal"><span class="idi-ico">👩‍⚖️</span><b>${ui('Preguntas del tribunal')}</b><small>${ui('Te las lee la voz del Mac; respondes en voz alta')}</small></button>
            <button data-om="exposicion"><span class="idi-ico">🎤</span><b>${ui('Exponer un texto')}</b><small>${ui('10 min de preparación y exposición, como en el examen')}</small></button>
            <button data-om="lectura"><span class="idi-ico">📢</span><b>${ui('Leer en voz alta')}</b><small>${ui('Compara lo que dices con el texto: palabras saltadas o cambiadas')}</small></button></div>
            <p class="idi-mini apagado">${ui('Se graba con el micrófono del Mac (ffmpeg) y se transcribe sin conexión con whisper (el mismo del cante). El audio se guarda solo en tu carpeta de idiomas.')}</p></section></div>
        <section class="idi-caja"><h3>${ui('Mis grabaciones')}</h3>${grabs.length ? `<ul class="idi-hist">${grabs.map((g) => `<li data-grab="${esc(g.id)}"><span>${A.fechaCorta(g.fecha)}</span><span>${esc(NOMBRE_ORAL[g.clase] ? ui(NOMBRE_ORAL[g.clase]) : g.clase)}</span>
          <span>${g.metricas ? ui('{0} pal/min', g.metricas.ppm) : g.estado === 'error' ? ui('error') : ui('sin corregir')}</span><span class="apagado">${ui('{0} min', Math.round(g.segundos / 6) / 10)}</span></li>`).join('')}</ul>` : `<p class="apagado">${ui('Aún no hay grabaciones.')}</p>`}</section></div>`;
      z.querySelectorAll('[data-om]').forEach((b) => b.onclick = () => elegirTextoOral(z, b.dataset.om));
      z.querySelectorAll('[data-grab]').forEach((li) => li.onclick = async () => {
        const g0 = grabs.find((x) => x.id === li.dataset.grab);
        if (g0 && g0.estado !== 'transcrito') {
          z.innerHTML = `<section class="idi-caja" id="idi-grab"></section>`;
          O.pre = { clase: g0.clase }; O.ref = g0.ref || {}; O.pide = g0.ref && g0.ref.pregunta ? { pregunta: g0.ref.pregunta, ideas: g0.ref.ideas || [] } : null;
          O.actual = { id: g0.id, fase: 'grabado', clase: g0.clase, segundos: g0.segundos };
          return pintarGrabador(z.querySelector('#idi-grab'));
        }
        try { const { grabacion } = await pedir('idiPValorarOral', { id: li.dataset.grab }); O.actual = { id: grabacion.id, fase: 'hecho', clase: grabacion.clase, res: grabacion }; pintarResultadoOral(z, grabacion); } catch (e) { fallo(e); }
      });
    }
    async function elegirTextoOral(z, clase) {
      if (clase === 'tribunal') return prepararOral(z, { clase });
      try {
        const { datos } = await pedir('idiPBiblioteca', { lengua: l() });
        const rec = datos.textos.find((t) => t.id === datos.recomendado) || datos.textos[0];
        z.innerHTML = `<section class="idi-caja"><h3>${ui('{0}: elige el texto', clase === 'lectura' ? `📢 ${ui('Leer en voz alta')}` : `🎤 ${ui('Exponer un texto')}`)}</h3>
          <div class="idi-textos">${[rec, ...datos.textos.filter((t) => t !== rec)].slice(0, 24).map((t) => cartaTexto(t)).join('')}</div></section>`;
        z.querySelectorAll('[data-texto]').forEach((c) => c.onclick = async () => {
          const { texto } = await pedir('idiPAbrir', { lengua: l(), id: c.dataset.texto, longitud: clase === 'lectura' ? 'corto' : 'estandar' });
          prepararOral(z, { clase, textoId: texto.id, k: texto.k, titulo: texto.titulo, parrafos: texto.parrafos, tribunal: texto.tribunal });
        });
      } catch (e) { fallo(e); }
    }
    function prepararOral(z, pre) {
      O.pre = pre; O.actual = null;
      if (pre.clase === 'tribunal') return tribunalOral(z, pre);
      const prep = pre.clase === 'exposicion';
      O.t0prep = Date.now();
      z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja">
          <h3>${ui(NOMBRE_ORAL[pre.clase])}${pre.titulo ? ` · <span lang="${l()}">${esc(pre.titulo)}</span>` : ''}</h3>
          ${pre.clase === 'resumen' ? `<div class="idi-lectura compacta" lang="${l()}"><p>${esc(pre.escrito).replace(/\n/g, '<br>')}</p></div>`
    : `<div class="idi-lectura compacta" lang="${l()}">${(pre.parrafos || []).map((p, i) => `<p class="idi-par"><span class="idi-par-n">${i + 1}</span>${esc(p)}</p>`).join('')}</div>`}</section>
        <div>${prep ? `<section class="idi-caja"><h3>⏳ ${ui('Preparación')} <span class="apagado" id="idi-prep">10:00</span></h3><textarea id="idi-o-notas" rows="10" placeholder="${ui('Guion de tu exposición: introducción, ideas del texto, tu opinión, conclusión.')}"></textarea>
            <p class="idi-mini apagado">${ui('En el examen tienes 10 minutos para preparar el texto y unos 10 para exponerlo. Empieza a grabar cuando quieras.')}</p></section>` : ''}
          <section class="idi-caja" id="idi-grab"></section></div></div>`;
      if (prep) conReloj(() => { const r = vEl().querySelector('#idi-prep'); if (r) { const s = 600 - (Date.now() - O.t0prep) / 1000; r.textContent = s >= 0 ? reloj(s) : `+${reloj(-s)}`; r.classList.toggle('pasado', s < 0); } });
      O.ref = { textoId: pre.textoId, k: pre.k, escrito: pre.escrito };
      pintarGrabador(vEl().querySelector('#idi-grab'));
    }
    function pintarGrabador(z) {
      if (!z) return;
      const e = O.estado || {}; const g = e.grabando;
      const a = O.actual;
      if (a && a.fase === 'hecho') return;
      if (g) {
        const s = (Date.now() - g.inicio) / 1000; const nv = g.nivel == null ? 0 : Math.max(0, Math.min(100, (g.nivel + 60) * 1.8));
        z.innerHTML = `<h3>🔴 ${ui('Grabando')} <span class="idi-reloj-grande">${reloj(s)}</span></h3><div class="idi-nivel"><i style="width:${nv}%"></i></div>
          <p class="apagado idi-mini">${esc(g.micro || '')}</p><p class="idi-acciones"><button class="primario" data-parar>⏹ ${ui('Terminar')}</button><button data-descartar>${ui('Descartar')}</button></p>`;
        z.querySelector('[data-parar]').onclick = () => pararGrabacion(false);
        z.querySelector('[data-descartar]').onclick = () => pararGrabacion(true);
        return;
      }
      if (a && a.fase === 'grabado') {
        z.innerHTML = `<h3>✓ ${ui('Grabado')}${a.segundos ? ` <span class="apagado idi-mini">${reloj(a.segundos)}</span>` : ''}</h3>
          <p class="ayuda">${ui('Al pulsar «Corregir» se transcribe en el Mac (whisper trabaja a tope un rato) y se valora.')}</p>
          <p class="idi-acciones"><button class="primario" data-corregir-oral>${ui('Corregir')}</button><button data-escuchar-oral>▶ ${ui('Escucharla')}</button><button data-otra-vez>${ui('Grabar otra vez')}</button></p><div id="idi-audio"></div>`;
        z.querySelector('[data-corregir-oral]').onclick = async () => { try { const { estado } = await pedir('idiPTranscribir', { ids: [a.id] }); O.estado = estado; a.fase = 'transcribiendo'; pintarGrabador(z); alEstadoOral(); } catch (e) { fallo(e); } };
        z.querySelector('[data-escuchar-oral]').onclick = async () => { const { url } = await pedir('idiPAudio', { id: a.id }); z.querySelector('#idi-audio').innerHTML = url ? `<audio controls autoplay src="${esc(url)}" style="width:100%"></audio>` : `<p class="apagado">${ui('Sin audio.')}</p>`; };
        z.querySelector('[data-otra-vez]').onclick = () => { O.actual = null; pintarGrabador(z); };
        return;
      }
      if (a && a.fase === 'transcribiendo') {
        const t = e.transcribiendo; const pct = t && t.id === a.id ? t.pct : 0;
        z.innerHTML = `<h3>⏳ ${ui('Transcribiendo…')} ${pct ? `${pct} %` : ''}</h3><div class="carga"><span style="width:${pct}%"></span></div><p class="apagado idi-mini">${ui('whisper trabaja en el Mac; suele tardar menos que la grabación.')}</p>`;
        return;
      }
      if (a && a.fase === 'valorando') { z.innerHTML = `<h3>🤖 ${esc(a.msg || ui('Valorando…'))}</h3>`; return; }
      z.innerHTML = `<h3>🎙 ${ui('Grabar')}</h3><p class="idi-acciones"><button class="primario grande" data-grabar>● ${ui('Empezar a grabar')}</button></p>
        <p class="idi-mini apagado">${ui('La primera vez macOS pedirá permiso de micrófono para Visual Studio Code.')}</p>`;
      z.querySelector('[data-grabar]').onclick = empezarGrabacion;
    }
    async function empezarGrabacion() {
      try {
        const { estado } = await pedir('idiPGrabar', { lengua: l(), clase: O.pre.clase, ref: { ...(O.ref || {}), ...(O.pide ? { pregunta: O.pide.pregunta, ideas: O.pide.ideas } : {}) } });
        O.estado = estado; O.actual = { fase: 'grabando', clase: O.pre.clase }; O.inicioGrab = Date.now();
        clearInterval(O.sondeo);
        O.sondeo = setInterval(async () => { try { const r = await pedir('idiPEstadoOral'); O.estado = r.estado; pintarGrabador(vEl().querySelector('#idi-grab')); if (!r.estado.grabando) { clearInterval(O.sondeo); O.sondeo = null; } } catch (e) { clearInterval(O.sondeo); } }, 600);
        pintarGrabador(vEl().querySelector('#idi-grab'));
      } catch (e) { fallo(e); }
    }
    async function pararGrabacion(descartar) {
      clearInterval(O.sondeo); O.sondeo = null;
      try {
        const { id, estado } = await pedir('idiPParar', { descartar });
        O.estado = estado;
        O.actual = id ? { id, fase: 'grabado', clase: (O.pre || {}).clase, segundos: O.inicioGrab ? (Date.now() - O.inicioGrab) / 1000 : 0 } : null;
        pintarGrabador(vEl().querySelector('#idi-grab'));
      } catch (e) { fallo(e); }
    }
    async function valorarActual() {
      const a = O.actual; if (!a || a.fase !== 'transcribiendo') return;
      a.fase = 'valorando'; pintarGrabador(vEl().querySelector('#idi-grab'));
      try {
        const { grabacion } = await pedir('idiPValorarOral', { id: a.id, ref: { ...(O.ref || {}), ...(O.pide ? { pregunta: O.pide.pregunta, ideas: O.pide.ideas } : {}) } }, (msg) => { a.msg = msg; pintarGrabador(vEl().querySelector('#idi-grab')); });
        a.fase = 'hecho'; a.res = grabacion;
        if (O.alTerminar) { const f = O.alTerminar; O.alTerminar = null; f(grabacion); return; }
        const z = vEl().querySelector('#idi-grab'); if (z) pintarResultadoOral(z, grabacion);
      } catch (e) {
        if ((e.message === ui('La grabación aún se está transcribiendo.') || /transcribiendo/.test(e.message))) { a.fase = 'transcribiendo'; return; }
        a.fase = 'error'; fallo(e);
      }
    }
    function pintarResultadoOral(z, g) {
      const v = g.valoracionOral || {}; const m = v.metricas || g.metricas || {};
      const val = v.valoracion || {};
      z.innerHTML = `<h3>📊 ${esc(NOMBRE_ORAL[g.clase] ? ui(NOMBRE_ORAL[g.clase]) : ui('Grabación'))} · ${A.fechaCorta(g.fecha)}</h3>
        <div class="idi-res-cifras"><div><b>${m.ppm || 0}</b><small>${ui('palabras/min ({0})', esc(v.velocidad ? ui(v.velocidad) : ''))}</small></div><div><b>${m.pausasLargas || 0}</b><small>${ui('pausas de más de 2 s')}</small></div>
          <div><b>${m.palabras || 0}</b><small>${ui('palabras en {0}', reloj(m.segundos || 0))}</small></div><div><b>${m.variedad || 0}</b><small>${ui('variedad léxica')}</small></div>
          ${v.lectura ? `<div><b>${Math.round(v.lectura.resumen.nota * 100)} %</b><small>${ui('palabras bien leídas')}</small></div>` : ''}
          ${v.nota != null ? `<div><b>${v.nota}/10</b><small>${ui('rúbrica')}</small></div>` : ''}${val.contenido != null ? `<div><b>${val.contenido}/4 · ${val.lengua}/4</b><small>${ui('contenido · lengua')}</small></div>` : ''}</div>
        ${g.audio ? `<p><button data-audio>▶ ${ui('Escuchar la grabación')}</button></p><div id="idi-audio"></div>` : ''}
        ${v.aviso ? `<p class="idi-aviso suave">${esc(v.aviso)}</p>` : ''}
        ${val.comentario ? `<p class="idi-comentario">🤖 ${esc(val.comentario)}</p>` : ''}
        ${v.lectura && (v.lectura.saltadas.length || v.lectura.cambiadas.length) ? `<p><b>${ui('Saltadas:')}</b> <span lang="${l()}">${esc(v.lectura.saltadas.join(', ') || '—')}</span><br><b>${ui('Cambiadas')}</b> ${ui('(texto → lo que se entendió):')} <span lang="${l()}">${esc(v.lectura.cambiadas.join(' · ') || '—')}</span></p>
          <p class="idi-mini apagado">${ui('La transcripción automática también se equivoca: una palabra «cambiada» puede ser de pronunciación o de whisper.')}</p>` : ''}
        ${(val.mejoras || []).length ? `<h4>💡 ${ui('Propuestas')}</h4><ul class="idi-mejoras">${val.mejoras.map((x) => `<li><span class="idi-tuya-mal" lang="${l()}">${esc(x.original)}</span> → <b class="idi-bien" lang="${l()}">${esc(x.propuesta)}</b><div class="apagado idi-mini">${esc(x.motivo)}</div></li>`).join('')}</ul>` : ''}
        ${val.criterios ? `<table class="idi-rubrica">${RUBRICA.map(([k, n]) => val.criterios[k] ? `<tr><td>${ui(n)}</td><td><b>${val.criterios[k].nota}/4</b> <span class="apagado idi-mini">${esc(val.criterios[k].comentario || '')}</span></td></tr>` : '').join('')}</table>` : ''}
        ${val.repregunta ? `<p class="idi-repregunta">👩‍⚖️ <i lang="${l()}">${esc(val.repregunta)}</i> <button data-repreguntar>${ui('Responder a esta repregunta')}</button></p>` : ''}
        <details><summary>📝 ${ui('Transcripción')}</summary><p lang="${l()}">${esc(g.texto || '')}</p></details>
        <p class="idi-acciones"><button data-otra>${O.pre && O.pre.clase === 'tribunal' && O.trib ? `${ui('Siguiente pregunta')} →` : ui('Otra grabación')}</button></p>`;
      const au = z.querySelector('[data-audio]');
      if (au) au.onclick = async () => { const { url } = await pedir('idiPAudio', { id: g.id }); z.querySelector('#idi-audio').innerHTML = url ? `<audio controls autoplay src="${esc(url)}" style="width:100%"></audio>` : `<p class="apagado">${ui('El audio ya no está.')}</p>`; };
      const rp = z.querySelector('[data-repreguntar]');
      if (rp) rp.onclick = () => { O.pide = { pregunta: val.repregunta, ideas: [] }; O.actual = null; Lector.hablar(val.repregunta); pintarPreguntaTribunal(); };
      z.querySelector('[data-otra]').onclick = () => { O.actual = null; if (O.pre && O.pre.clase === 'tribunal') siguientePregunta(); else pintarGrabador(z); };
    }

    // ---------------------------------------------------------------- tribunal
    async function tribunalOral(z, pre) {
      try {
        const { preguntas } = await pedir('idiPTribunal', { lengua: l(), textoId: pre.textoId, n: pre.n || 5 });
        O.trib = { preguntas, i: 0 };
        z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja" id="idi-trib-preg"></section><section class="idi-caja" id="idi-grab"></section></div>`;
        siguientePregunta(true);
      } catch (e) { fallo(e); }
    }
    function siguientePregunta(primera) {
      const t = O.trib; if (!t) return;
      if (!primera) t.i += 1;
      if (t.i >= t.preguntas.length) { const z = vEl().querySelector('#idi-trib-preg'); if (z) z.innerHTML = `<h3>✓ ${ui('Fin de las preguntas')}</h3><p class="idi-acciones"><button data-mas>${ui('Otra tanda')}</button></p>`; const b = vEl().querySelector('[data-mas]'); if (b) b.onclick = () => prepararOral(vEl().querySelector('#idi-oral'), { clase: 'tribunal' }); return; }
      O.pide = t.preguntas[t.i]; O.actual = null; pintarPreguntaTribunal();
      Lector.hablar(O.pide.pregunta);
    }
    function pintarPreguntaTribunal() {
      const z = vEl().querySelector('#idi-trib-preg'); if (!z) return;
      const q = O.pide, t = O.trib || { i: 0, preguntas: [q] };
      z.innerHTML = `<h3>👩‍⚖️ ${ui('Pregunta {0} de {1}', t.i + 1, t.preguntas.length)} ${q.bloque ? `<span class="apagado idi-mini">${esc(BLOQUE_TRIB[q.bloque] ? ui(BLOQUE_TRIB[q.bloque]) : q.bloque)}</span>` : ''}</h3>
        <p class="idi-acciones"><button data-repetir>🔊 ${ui('Repetir la pregunta')}</button><button data-ver>${ui('Ver la pregunta escrita')}</button><button data-saltar>${ui('Saltar')}</button></p>
        <p class="idi-preg-escrita oculta" lang="${l()}">${esc(q.pregunta)}</p>${q.pista_es ? `<details><summary>${ui('Pista')}</summary><p>${esc(q.pista_es)}</p>${(q.ideas || []).length ? `<ul lang="${l()}">${q.ideas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</details>` : ''}`;
      z.querySelector('[data-repetir]').onclick = () => Lector.hablar(q.pregunta);
      z.querySelector('[data-ver]').onclick = () => z.querySelector('.idi-preg-escrita').classList.remove('oculta');
      z.querySelector('[data-saltar]').onclick = () => siguientePregunta();
      O.ref = { textoId: q.bloque === 'texto' ? (O.pre || {}).textoId : undefined };
      pintarGrabador(vEl().querySelector('#idi-grab'));
    }

    // ================================================================== herramientas locales (en Ajustes)
    async function cajaHerramientas(cont) {
      cont.innerHTML = `<h3>${ui('Herramientas locales')}</h3><p class="apagado">${ui('Comprobando…')}</p>`;
      try {
        const { estado: e } = await pedir('idiPHerramientas');
        const vz = await cargarVoces();
        if (!vz.disponible) e.falta = [...e.falta, ui('voces neuronales')];
        const fila = (ok, nombre, uso) => `<li class="${ok ? 'ok' : 'falta'}">${ok ? '✓' : '✗'} <b>${nombre}</b> <span class="apagado idi-mini">${uso}</span></li>`;
        cont.innerHTML = `<h3>${ui('Herramientas locales')}</h3><ul class="idi-herr">
          ${fila(e.lt, 'LanguageTool', ui('corrector gramatical de los escritos'))}${fila(e.ollama && e.modelo, ui('Modelo local ({0})', esc(e.nombreModelo)), ui('valora resúmenes, escritos y el oral'))}
          ${fila(vz.disponible, `${ui('Voces neuronales (Piper)')}${vz.voces.length ? `: ${vz.voces.length}` : ''}`, ui('leen los textos con voz natural; sin ellas, la del sistema'))}
          ${fila(e.ffmpeg, 'ffmpeg', ui('graba el micrófono'))}${fila(e.whisper, 'whisper', ui('transcribe el oral (mismo modelo que el cante)'))}</ul>
          ${e.falta.length ? `<p class="ayuda">${ui('Falta: {0}. La instalación tarda unos minutos y descarga unos 2,5 GB; se puede repetir sin problema.', esc(e.falta.join(', ')))}</p>
            <p class="idi-acciones"><button class="primario" data-instalar>${ui('Instalar herramientas')}</button></p>` : `<p class="apagado idi-mini">${ui('Todo instalado. LanguageTool y el modelo se arrancan solo cuando hacen falta y se paran a los pocos minutos.')}</p>`}`;
        const b = cont.querySelector('[data-instalar]');
        if (b) b.onclick = async () => { await pedir('idiPInstalar'); A.aviso(ui('Se ha abierto un terminal con la instalación. Cuando termine, vuelve a esta pestaña.')); };
      } catch (x) { cont.innerHTML = `<h3>${ui('Herramientas locales')}</h3><p class="idi-aviso">${esc(x.message)}</p>`; }
    }

    // ================================================================== sesión tipo examen (BOE-A-2025-26902)
    const PASOS_EX = [
      ['escucha', '🎧', 'Escucha', 'Te leen un texto (máx. 15 min). Tomas notas.'],
      ['resumen', '✍️', 'Resumen', 'Resumen en la lengua del texto (90 min, con diccionario).'],
      ['prep', '⏳', 'Preparación', 'Otro texto: 10 minutos para prepararlo.'],
      ['lectura', '📢', 'Lectura', 'Lo lees en voz alta (≈5 min).'],
      ['exposicion', '🎤', 'Exposición', 'Exposición sobre el texto (≈10 min).'],
      ['tuResumen', '📄', 'Tu escrito', 'Lees tu resumen al tribunal.'],
      ['tribunal', '👩‍⚖️', 'Tribunal', 'Preguntas del tribunal.'],
      ['informe', '📊', 'Informe', 'Notas y comentarios de todo.'],
    ];
    async function pExamen() {
      const E = P.E;
      if (!E) return configurarExamen();
      vEl().innerHTML = `<div class="idi-p">${cab(`🎓 ${ui('Examen')} · ${nombreLengua()}`, `<span class="idi-der-auto apagado">⏱ ${ui('paso: {0}', '<span id="idi-ex-reloj"></span>')}</span>`)}
        <ol class="idi-etapas">${PASOS_EX.map(([k, ic, n], i) => `<li class="${i < E.paso ? 'hecha' : i === E.paso ? 'actual' : ''}">${ic} ${ui(n)}</li>`).join('')}</ol><div id="idi-ex"></div></div>`;
      vEl().querySelector('[data-volver]').onclick = async () => { if (!(await confirmar(ui('¿Abandonar el examen? No se guardará.')))) return; parar(); P.E = null; A.ir('inicio'); };
      const z = vEl().querySelector('#idi-ex');
      const [k] = PASOS_EX[E.paso];
      E.tPaso = E.tPaso || Date.now();
      const limite = { escucha: 15 * 60, resumen: E.cortos ? 30 * 60 : 90 * 60, prep: E.cortos ? 5 * 60 : 10 * 60, lectura: 5 * 60, exposicion: E.cortos ? 5 * 60 : 10 * 60 }[k];
      conReloj(() => { const r = vEl().querySelector('#idi-ex-reloj'); if (!r) return; const s = (Date.now() - E.tPaso) / 1000; r.textContent = limite ? `${reloj(s)} / ${reloj(limite)}` : reloj(s); r.classList.toggle('pasado', limite && s > limite); });
      ({ escucha: exEscucha, resumen: exResumen, prep: exPrep, lectura: exGrabar, exposicion: exGrabar, tuResumen: exGrabar, tribunal: exTribunal, informe: exInforme })[k](z, k);
    }
    const exSiguiente = () => { const E = P.E; E.paso += 1; E.tPaso = Date.now(); Lector.parar(); pExamen(); window.scrollTo(0, 0); };
    async function configurarExamen() {
      vEl().innerHTML = `<div class="idi-p">${cab(`🎓 ${ui('Sesión tipo examen')}`)}<div id="idi-exc"><p class="apagado">${ui('Cargando…')}</p></div></div>`;
      enlazarVolver(vEl());
      let datos; try { datos = (await pedir('idiPBiblioteca', { lengua: l() })).datos; } catch (e) { return fallo(e); }
      const nv = A.nivelDecl(l());
      const orden = (a, b) => (a.hecho ? 1 : 0) - (b.hecho ? 1 : 0) || (a.tipo === 'prensa' ? -1 : 1) - (b.tipo === 'prensa' ? -1 : 1);
      let largos = datos.textos.filter((t) => t.palabras >= 700 && A.NIVELES.indexOf(t.nivel) >= A.NIVELES.indexOf(nv)).sort(orden);
      if (largos.length < 3) largos = datos.textos.filter((t) => t.palabras >= 700).sort((a, b) => A.NIVELES.indexOf(b.nivel) - A.NIVELES.indexOf(a.nivel) || orden(a, b));   // p. ej. con nivel C2
      if (!largos.length) largos = datos.textos.slice().sort((a, b) => b.palabras - a.palabras);
      let medios = datos.textos.filter((t) => t.palabras >= 300 && t.palabras <= 900).sort(orden);
      if (medios.length < 2) medios = datos.textos.slice();
      const azar = (xs) => xs[Math.floor(Math.random() * Math.min(xs.length, 6))];
      const t1 = azar(largos) || datos.textos[0], t2 = azar(medios.filter((t) => t !== t1)) || datos.textos[1];
      const z = vEl().querySelector('#idi-exc');
      z.innerHTML = `<section class="idi-caja"><p class="ayuda">${ui('Sigue los pasos del examen de idiomas de la oposición (convocatoria BOE-A-2025-26902): {0} (te leen un texto hasta 15 minutos, tomas notas y escribes un resumen en 90 minutos, con diccionario) y {1} (10 minutos para preparar otro texto, lectura en voz alta, exposición y preguntas del tribunal, que además lee tu escrito).', `<b>${ui('escrito')}</b>`, `<b>${ui('oral')}</b>`)}</p>
        <ul class="idi-ex-pasos">${PASOS_EX.map(([, ic, n, d]) => `<li><b>${ic} ${ui(n)}</b> ${ui(d)}</li>`).join('')}</ul>
        <div class="idi-form"><label>${ui('Texto del escrito')} <select data-t1>${largos.slice(0, 30).map((t) => `<option value="${esc(t.id)}" ${t === t1 ? 'selected' : ''}>${esc(t.titulo)} · ${t.nivel} · ${ui('{0} pal.', t.palabras)}</option>`).join('')}</select></label>
          <label>${ui('Texto del oral')} <select data-t2>${medios.slice(0, 30).map((t) => `<option value="${esc(t.id)}" ${t === t2 ? 'selected' : ''}>${esc(t.titulo)} · ${t.nivel} · ${ui('{0} pal.', t.palabras)}</option>`).join('')}</select></label>
          <label class="idi-chk"><input type="checkbox" data-cortos> ${ui('Versión corta (30 min de resumen, 5 de preparación y 5 de exposición)')}</label></div>
        <p class="idi-mini apagado">${ui('Los tiempos son orientativos: el reloj avisa al pasarse, pero nunca corta. Al final verás un informe con todo; la corrección y las transcripciones se hacen en el Mac.')}</p>
        <p class="idi-acciones"><button class="primario" data-empezar>${ui('Empezar el examen')}</button></p></section>`;
      z.querySelector('[data-empezar]').onclick = async () => {
        try {
          const [a, b] = await Promise.all([pedir('idiPAbrir', { lengua: l(), id: z.querySelector('[data-t1]').value, longitud: 'completo' }), pedir('idiPAbrir', { lengua: l(), id: z.querySelector('[data-t2]').value, longitud: 'completo' })]);
          P.E = { t1: a.texto, t2: b.texto, paso: 0, tPaso: Date.now(), inicio: new Date().toISOString(), t0: Date.now(), notas: '', notas2: '', resumen: '', grab: {}, cortos: z.querySelector('[data-cortos]').checked };
          Lector.cargar(a.texto.parrafos); pExamen();
        } catch (e) { fallo(e); }
      };
    }
    function exEscucha(z) {
      const E = P.E;
      z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja"><h3>🎧 ${ui('Escucha (una sola vez, como en el examen)')}</h3>
          <p class="idi-acciones"><button class="primario grande" data-play>▶ ${ui('Empezar la lectura')}</button></p><div class="idi-rep-barra"><i style="width:0%"></i></div><p class="idi-mini apagado centro" id="idi-rep-pos"></p>
          <p class="idi-acciones"><button data-seguir>${ui('He terminado → Resumen')}</button></p></section>
        <section class="idi-caja"><h3>📝 ${ui('Notas')}</h3><textarea id="idi-ex-notas" rows="18">${esc(E.notas)}</textarea></section></div>`;
      z.querySelector('#idi-ex-notas').oninput = (e) => { E.notas = e.target.value; };
      const barra = z.querySelector('.idi-rep-barra i'), pos = z.querySelector('#idi-rep-pos'), play = z.querySelector('[data-play]');
      Lector.alCambiar = (fin) => { const n = Lector.frases.length; barra.style.width = `${Math.round((100 * Lector.i) / Math.max(1, n))}%`; pos.textContent = fin ? ui('Fin de la lectura.') : ui('Frase {0} de {1}', Math.min(Lector.i + 1, n), n); play.textContent = Lector.activo ? `⏸ ${ui('Pausa')}` : fin ? ui('Lectura terminada') : `▶ ${ui('Seguir')}`; play.disabled = !!fin; };
      play.onclick = () => (Lector.activo ? Lector.pausa() : Lector.play());
      z.querySelector('[data-seguir]').onclick = exSiguiente;
    }
    function exResumen(z) {
      const E = P.E; const [min, max] = E.t1.extension;
      z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja"><h3>✍️ ${ui('Resumen')} <span class="apagado idi-mini">${ui('{0}–{1} palabras', min, max)}</span></h3>
          <textarea id="idi-ex-res" rows="20" lang="${l()}" spellcheck="false">${esc(E.resumen)}</textarea><div class="idi-contador"><span id="idi-cuenta"></span></div>
          <p class="idi-acciones"><button class="primario" data-seguir>${ui('Entregar el resumen')} →</button></p><p class="idi-mini apagado">${ui('Se corrige al final, en el informe. Puedes usar el diccionario (📚).')}</p></section>
        <section class="idi-caja"><h3>📝 ${ui('Tus notas')}</h3><div class="idi-notas-ro">${esc(E.notas).replace(/\n/g, '<br>') || `<span class="apagado">${ui('Sin notas.')}</span>`}</div></section></div>`;
      const ta = z.querySelector('#idi-ex-res'), c = z.querySelector('#idi-cuenta');
      const contar = () => { E.resumen = ta.value; const n = palabras(ta.value); c.textContent = nPal(n); c.className = n < min ? 'corto' : n > max ? 'largo' : 'bien'; };
      ta.oninput = contar; contar(); ta.focus();
      z.querySelector('[data-seguir]').onclick = () => {
        if (palabras(E.resumen) < 20) { A.aviso(ui('Escribe al menos unas frases antes de entregar.'), true); return; }
        E.segResumen = (Date.now() - E.tPaso) / 1000;
        // la corrección del resumen se lanza ya, en segundo plano: estará lista al llegar al informe
        E.corr = pedir('idiPCorregir', { lengua: l(), clase: 'resumen', id: E.t1.id, k: E.t1.k, texto: E.resumen, segundos: E.segResumen, modo: 'examen', notas: E.notas, sinSesion: true }).then((r) => (E.escrito = r.escrito)).catch((e) => { E.errorCorr = e.message; });
        exSiguiente();
      };
    }
    function exPrep(z) {
      const E = P.E;
      z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja"><h3 lang="${l()}">${esc(E.t2.titulo)}</h3><div class="idi-lectura compacta" lang="${l()}">${parrafosHtml(E.t2)}</div></section>
        <section class="idi-caja"><h3>⏳ ${ui('Preparación')}</h3><textarea id="idi-ex-n2" rows="16" placeholder="${ui('Guion: introducción, ideas del texto, tu valoración, conclusión.')}">${esc(E.notas2)}</textarea>
          <p class="idi-acciones"><button class="primario" data-seguir>${ui('Estoy listo → Lectura en voz alta')}</button></p></section></div>`;
      z.querySelector('#idi-ex-n2').oninput = (e) => { E.notas2 = e.target.value; };
      z.querySelector('[data-seguir]').onclick = exSiguiente;
    }
    function exGrabar(z, k) {
      const E = P.E;
      const clase = k === 'tuResumen' ? 'resumen' : k;
      const contenido = k === 'tuResumen' ? `<div class="idi-lectura compacta" lang="${l()}"><p>${esc(E.resumen).replace(/\n/g, '<br>')}</p></div>`
        : k === 'lectura' ? `<div class="idi-lectura compacta" lang="${l()}">${parrafosHtml(E.t2)}</div>` : `<div class="idi-notas-ro">${esc(E.notas2).replace(/\n/g, '<br>') || `<span class="apagado">${ui('Sin guion.')}</span>`}</div>`;
      z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja"><h3>${{ lectura: `📢 ${ui('Lee el texto en voz alta')}`, exposicion: `🎤 ${ui('Exposición: tus notas')}`, tuResumen: `📄 ${ui('Lee tu resumen')}` }[k]}</h3>${contenido}</section>
        <div><section class="idi-caja" id="idi-grab"></section><p class="idi-acciones"><button data-seguir ${E.grab[k] ? '' : 'disabled'}>${ui('Siguiente')} →</button><button data-saltar>${ui('Saltar este paso')}</button></p></div></div>`;
      O.pre = { clase }; O.pide = null; O.actual = E.grab[k] ? { id: E.grab[k], fase: 'hecho' } : null;
      O.ref = { textoId: k === 'tuResumen' ? E.t1.id : E.t2.id, k: k === 'tuResumen' ? E.t1.k : E.t2.k, escrito: k === 'tuResumen' ? E.resumen : undefined };
      // en el examen no se espera a la transcripción: se valora todo en el informe
      const grab = vEl().querySelector('#idi-grab');
      if (E.grab[k]) grab.innerHTML = `<h3>✓ ${ui('Grabado')}</h3><p class="apagado idi-mini">${ui('Se corregirá en el informe, al final del examen.')}</p>`;
      else pintarGrabador(grab);
      const vigilar = setInterval(() => { if (!P.E || PASOS_EX[P.E.paso][0] !== k) { clearInterval(vigilar); return; } if (O.actual && O.actual.id && !E.grab[k]) { E.grab[k] = O.actual.id; O.actual.fase = 'hecho'; grab.innerHTML = `<h3>✓ ${ui('Grabado')}</h3><p class="apagado idi-mini">${ui('Se corregirá en el informe, al final del examen.')}</p>`; const s = z.querySelector('[data-seguir]'); if (s) s.disabled = false; } }, 500);
      z.querySelector('[data-seguir]').onclick = exSiguiente;
      z.querySelector('[data-saltar]').onclick = exSiguiente;
    }
    async function exTribunal(z) {
      const E = P.E;
      if (!E.trib) {
        try { E.trib = { preguntas: (await pedir('idiPTribunal', { lengua: l(), textoId: E.t2.id, n: 4 })).preguntas, i: 0, grab: [] }; } catch (e) { return fallo(e); }
      }
      const t = E.trib;
      if (t.i >= t.preguntas.length) return exSiguiente();
      const q = t.preguntas[t.i];
      z.innerHTML = `<div class="idi-p-dos"><section class="idi-caja"><h3>👩‍⚖️ ${ui('Pregunta {0} de {1}', t.i + 1, t.preguntas.length)}</h3>
          <p class="idi-acciones"><button data-repetir>🔊 ${ui('Repetir')}</button><button data-ver>${ui('Ver escrita')}</button></p><p class="idi-preg-escrita oculta" lang="${l()}">${esc(q.pregunta)}</p></section>
        <div><section class="idi-caja" id="idi-grab"></section><p class="idi-acciones"><button data-seguir disabled>${ui('Siguiente pregunta')} →</button><button data-saltar>${ui('Saltar')}</button></p></div></div>`;
      O.pre = { clase: 'tribunal' }; O.pide = q; O.actual = null; O.ref = { textoId: q.bloque === 'texto' ? E.t2.id : undefined };
      Lector.hablar(q.pregunta);
      z.querySelector('[data-repetir]').onclick = () => Lector.hablar(q.pregunta);
      z.querySelector('[data-ver]').onclick = () => z.querySelector('.idi-preg-escrita').classList.remove('oculta');
      const grab = z.querySelector('#idi-grab'); pintarGrabador(grab);
      const sig = () => { t.i += 1; exTribunal(z); };
      const vigilar = setInterval(() => { if (!P.E || PASOS_EX[P.E.paso][0] !== 'tribunal') { clearInterval(vigilar); return; } if (O.actual && O.actual.id && !t.grab[t.i]) { t.grab[t.i] = { id: O.actual.id, pregunta: q.pregunta, ideas: q.ideas || [] }; O.actual.fase = 'hecho'; grab.innerHTML = `<h3>✓ ${ui('Respuesta grabada')}</h3>`; z.querySelector('[data-seguir]').disabled = false; clearInterval(vigilar); } }, 500);
      z.querySelector('[data-seguir]').onclick = sig; z.querySelector('[data-saltar]').onclick = () => { clearInterval(vigilar); sig(); };
    }
    async function exInforme(z) {
      const E = P.E;
      clearInterval(tic);
      const ids = [E.grab.lectura, E.grab.exposicion, E.grab.tuResumen, ...((E.trib && E.trib.grab) || []).filter(Boolean).map((g) => g.id)].filter(Boolean);
      if (ids.length && !E.corrigiendoOral) {
        z.innerHTML = `<section class="idi-caja"><h3>📊 ${ui('Informe del examen')}</h3><p class="ayuda">${ids.length === 1 ? ui('Tienes 1 grabación. Al pulsar «Corregir» se transcribe en el Mac (whisper trabaja a tope unos minutos) y se valora junto con tu resumen.')
    : ui('Tienes {0} grabaciones. Al pulsar «Corregir» se transcriben en el Mac, una tras otra (whisper trabaja a tope unos minutos), y se valoran junto con tu resumen.', ids.length)}</p><p class="idi-acciones"><button class="primario" data-corregir-ex>${ui('Corregir')}</button></p></section>`;
        z.querySelector('[data-corregir-ex]').onclick = async () => { try { await pedir('idiPTranscribir', { ids }); E.corrigiendoOral = true; exInforme(z); } catch (e) { fallo(e); } };
        return;
      }
      z.innerHTML = `<section class="idi-caja"><h3>📊 ${ui('Informe del examen')}</h3><div id="idi-ex-estado"><p class="idi-progreso">${ui('Esperando la corrección del resumen y las transcripciones…')}</p></div></section><div id="idi-ex-res"></div>`;
      const est = z.querySelector('#idi-ex-estado'), res = z.querySelector('#idi-ex-res');
      if (E.corr) await E.corr;
      const orales = [['lectura', E.grab.lectura, null], ['exposicion', E.grab.exposicion, null], ['tuResumen', E.grab.tuResumen, null],
        ...((E.trib && E.trib.grab) || []).filter(Boolean).map((g) => ['tribunal', g.id, g])];
      const valorados = [];
      for (const [k, id, ref] of orales) {
        if (!id) continue;
        est.innerHTML = `<p class="idi-progreso">${ui('Valorando: {0}… (si aún se está transcribiendo, espera)', esc(ui(NOMBRE_ORAL[k === 'tuResumen' ? 'resumen' : k])))}</p>`;
        let g = null;
        for (let n = 0; n < 240 && !g; n++) {
          try { g = (await pedir('idiPValorarOral', { id, sinSesion: true, ref: ref ? { pregunta: ref.pregunta, ideas: ref.ideas } : k === 'tuResumen' ? { escrito: E.resumen, textoId: E.t1.id } : { textoId: E.t2.id, k: E.t2.k } })).grabacion; }
          catch (e) { if (!(e.message === ui('La grabación aún se está transcribiendo.') || /transcribiendo/.test(e.message))) { valorados.push({ k, error: e.message }); break; } await new Promise((r) => setTimeout(r, 3000)); }
        }
        if (g) valorados.push({ k, g });
      }
      est.innerHTML = '';
      const notaEsc = E.escrito && E.escrito.nota;
      const expo = valorados.find((x) => x.k === 'exposicion' && x.g);
      const notaExpo = expo && expo.g.valoracionOral && expo.g.valoracionOral.nota;
      const tribs = valorados.filter((x) => x.k === 'tribunal' && x.g && x.g.valoracionOral && x.g.valoracionOral.valoracion);
      const notaTrib = tribs.length ? Math.round((tribs.reduce((a, x) => a + (x.g.valoracionOral.valoracion.contenido + x.g.valoracionOral.valoracion.lengua) / 8, 0) / tribs.length) * 100) / 10 : null;
      const partes = [notaEsc, notaExpo, notaTrib].filter((x) => x != null);
      const nota = partes.length ? Math.round((partes.reduce((a, b) => a + b, 0) / partes.length) * 10) / 10 : null;
      res.innerHTML = `<section class="idi-caja"><div class="idi-res-cifras">${nota != null ? `<div><b>${nota}/10</b><small>${ui('Orientativa (mínimo para aprobar: 5)')}</small></div>` : ''}
          ${notaEsc != null ? `<div><b>${notaEsc}/10</b><small>${ui('Resumen')}</small></div>` : ''}${notaExpo != null ? `<div><b>${notaExpo}/10</b><small>${ui('Exposición')}</small></div>` : ''}${notaTrib != null ? `<div><b>${notaTrib}/10</b><small>${ui('Tribunal')}</small></div>` : ''}
          <div><b>${reloj((Date.now() - E.t0) / 1000)}</b><small>${ui('Duración')}</small></div></div>
          <p class="idi-mini apagado">${ui('La nota es una media orientativa de lo que ha podido valorar el modelo local; el tribunal real puntúa cada idioma de 0 a 10.')}</p>
          ${E.errorCorr ? `<p class="idi-aviso">${esc(E.errorCorr)}</p>` : ''}</section>
        <div id="idi-ex-esc"></div>${valorados.map((x, i) => `<section class="idi-caja" data-or="${i}"></section>`).join('')}`;
      if (E.escrito) pintarEscrito(res.querySelector('#idi-ex-esc'), E.escrito);
      valorados.forEach((x, i) => { const s = res.querySelector(`[data-or="${i}"]`); if (x.g) pintarResultadoOral(s, x.g); else s.innerHTML = `<p class="idi-aviso">${esc(x.error)}</p>`; const o = s.querySelector('[data-otra]'); if (o) o.remove(); const rp = s.querySelector('[data-repreguntar]'); if (rp) rp.remove(); });
      if (!E.guardado) {
        E.guardado = true;
        pedir('idiPGuardarExamen', { examen: { lengua: l(), inicio: E.inicio, segundos: (Date.now() - E.t0) / 1000, textoEscrito: E.t1.id, textoOral: E.t2.id, escrito: E.escrito && E.escrito.id,
          grabaciones: valorados.filter((x) => x.g).map((x) => ({ paso: x.k, id: x.g.id })), notas: { resumen: notaEsc, exposicion: notaExpo, tribunal: notaTrib, global: nota }, nota } }).catch(fallo);
      }
      res.insertAdjacentHTML('beforeend', `<p class="idi-acciones centro"><button class="primario" data-fin>${ui('Terminar')}</button></p>`);
      res.querySelector('[data-fin]').onclick = () => { P.E = null; A.ir('inicio'); };
    }

    // ================================================================== vídeo y audio en abierto
    const MEDIOS = {
      en: [['VOA Learning English (YouTube)', 'https://www.youtube.com/@VOALearningEnglish', 'B1–B2 · noticias lentas y explicadas'],
        ['BBC Learning English (YouTube)', 'https://www.youtube.com/@bbclearningenglish', 'B1–C1 · «6 Minute English», noticias'],
        ['BBC News', 'https://www.bbc.com/news', 'C1 · noticias'], ['The Economist (YouTube)', 'https://www.youtube.com/@TheEconomist', 'C1–C2 · economía y actualidad'],
        ['France 24 English', 'https://www.france24.com/en/', 'C1 · noticias internacionales'], ['UK Parliament (YouTube)', 'https://www.youtube.com/@UKParliament', 'C2 · debates']],
      fr: [['RFI · Journal en français facile', 'https://francaisfacile.rfi.fr/fr/', 'B1 · noticias en francés sencillo'],
        ['TV5Monde · Apprendre le français', 'https://apprendre.tv5monde.com/fr', 'A2–C1 · vídeos con ejercicios'],
        ['France 24 (français)', 'https://www.france24.com/fr/', 'C1 · noticias'], ['Arte (YouTube)', 'https://www.youtube.com/@arte', 'C1 · reportajes'],
        ['Le Monde (YouTube)', 'https://www.youtube.com/@LeMonde', 'C1 · explicaciones de actualidad'], ['France Culture', 'https://www.radiofrance.fr/franceculture', 'C1–C2 · radio, debates']],
    };
    const cajaMedios = () => `<section class="idi-caja"><h3>📺 ${ui('Vídeo y audio en abierto')}</h3><p class="ayuda">${ui('Se abren en el navegador (no se descargan).')}</p><ul class="idi-medios">${(MEDIOS[l()] || []).map(([n, u, d]) => `<li><a data-url="${esc(u)}">${esc(n)} ↗</a> <span class="apagado idi-mini">${esc(ui(d))}</span></li>`).join('')}</ul></section>`;

    // ================================================================== clases con profesores (Meet, Teams…): audio, ficheros y transcripción
    const K = { estado: null, sondeo: null, clase: null, micros: null, buscar: '' };
    function alEstadoClase(e) {
      K.estado = e;
      const z = vEl() && vEl().querySelector('#idi-k-audio'); if (z && K.clase) pintarAudioClase(z);
      const t = K.estado && K.estado.transcribiendo;
      if (!t && K.esperaTx && K.clase) { K.esperaTx = false; recargarClase(); }
    }
    async function pClases() {
      vEl().innerHTML = `<div class="idi-p">${cab(`👩‍🏫 ${ui('Clases')}`, `<button class="primario idi-der-auto" data-nueva>+ ${ui('Nueva clase')}</button>`)}
        <p class="ayuda">${ui('Para tus clases con profesores (Meet, Teams…): apuntes, ficheros, el audio de la clase y su transcripción. Todo se guarda solo en este Mac, en tu carpeta de idiomas, con el audio comprimido (unos 14 MB por hora).')}</p><div id="idi-k-lista"><p class="apagado">${ui('Cargando…')}</p></div></div>`;
      enlazarVolver(vEl());
      vEl().querySelector('[data-nueva]').onclick = () => nuevaClase();
      try {
        const { lista } = await pedir('idiPClases', { lengua: l() });
        const z = vEl().querySelector('#idi-k-lista');
        z.innerHTML = lista.length ? `<div class="idi-textos">${lista.map((c) => `<article class="idi-ctexto" data-clase="${esc(c.id)}" tabindex="0">
            <div class="idi-carta-fila"><span class="idi-chip-bloque">${esc(A.fechaCorta(c.fecha))}</span>${c.profesor ? `<span class="apagado">${esc(c.profesor)}</span>` : ''}
              <span class="apagado idi-der-auto">${c.minutos ? `🎙 ${ui('{0} min', c.minutos)}` : ''}${c.transcritos ? ' · 📝' : ''}${c.adjuntos.length ? ` · 📎 ${c.adjuntos.length}` : ''}</span></div>
            <h4>${esc(c.titulo)}</h4>${c.notas ? `<p class="idi-carta-desc">${esc(c.notas)}</p>` : ''}</article>`).join('')}</div>`
          : `<p class="vacio">${ui('Aún no hay clases de este idioma. Pulsa «+ Nueva clase».')}</p>`;
        z.querySelectorAll('[data-clase]').forEach((c) => c.onclick = () => abrirClase(c.dataset.clase));
      } catch (e) { fallo(e); }
    }
    function nuevaClase() {
      const fondo = document.createElement('div'); fondo.className = 'idi-dlg-fondo idi-raiz';
      const hoy = new Date(); const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      fondo.innerHTML = `<div class="idi-dlg" role="dialog"><h3>👩‍🏫 ${ui('Nueva clase')} · ${nombreLengua()}</h3>
        <label>${ui('Tema o título')} <input type="text" data-k="titulo" placeholder="${ui('Por ejemplo: resumen oral sobre la inflación')}"></label>
        <label>${ui('Profesor o profesora')} <input type="text" data-k="profesor" value="${esc(A.st().idiUltimoProfe && A.st().idiUltimoProfe[l()] || '')}"></label>
        <label>${ui('Fecha')} <input type="date" data-k="fecha" value="${iso}"></label>
        <p class="idi-acciones"><button class="primario" data-crear>${ui('Crear')}</button><button data-cancelar>${ui('Cancelar')}</button></p></div>`;
      document.body.appendChild(fondo);
      const cerrar = () => fondo.remove();
      fondo.querySelector('[data-cancelar]').onclick = cerrar;
      fondo.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
      fondo.querySelector('[data-crear]').onclick = async () => {
        const v = {}; fondo.querySelectorAll('[data-k]').forEach((i) => { v[i.dataset.k] = i.value; });
        A.st().idiUltimoProfe = { ...(A.st().idiUltimoProfe || {}), [l()]: v.profesor }; A.guardar();
        try { const { clase } = await pedir('idiPClaseCrear', { lengua: l(), ...v, fecha: v.fecha ? `${v.fecha}T12:00:00` : undefined }); cerrar(); K.clase = clase; A.ir('clase'); } catch (e) { fallo(e); }
      };
      fondo.querySelector('[data-k="titulo"]').focus();
    }
    async function abrirClase(id) { try { const r = await pedir('idiPClase', { id }); K.clase = r.clase; K.estado = r.estado; A.ir('clase'); } catch (e) { fallo(e); } }
    async function recargarClase() { if (!K.clase) return; try { const r = await pedir('idiPClase', { id: K.clase.id }); K.clase = r.clase; K.estado = r.estado; if (vEl().querySelector('#idi-k')) pClase(); } catch (e) { /* */ } }
    function pClase() {
      const c = K.clase; if (!c) return A.ir('clases');
      vEl().innerHTML = `<div class="idi-p" id="idi-k">${cab(`👩‍🏫 ${esc(c.titulo)}`, `<span class="apagado">${esc(A.fechaCorta(c.fecha))}${c.profesor ? ` · ${esc(c.profesor)}` : ''}</span>
          <span class="idi-der-auto"><button data-carpeta title="${ui('Abrir la carpeta de la clase en el Finder')}">📁 ${ui('Carpeta')}</button> <button class="peligro" data-eliminar>${ui('Eliminar')}</button></span>`)}
        <div class="idi-p-dos"><div>
          <section class="idi-caja" id="idi-k-audio"></section>
          <section class="idi-caja"><h3>📝 ${ui('Transcripción')} ${(c.transcripciones || []).length ? `<input type="search" id="idi-k-buscar" placeholder="${ui('Buscar en la transcripción…')}" value="${esc(K.buscar)}" class="idi-k-buscar">` : ''}</h3>
            <div id="idi-k-tx">${transcripcionHtml(c)}</div></section></div>
        <div>
          <section class="idi-caja"><h3>${ui('Datos')}</h3><div class="idi-form">
            <label>${ui('Tema o título')} <input type="text" data-c="titulo" value="${esc(c.titulo)}"></label>
            <label>${ui('Profesor o profesora')} <input type="text" data-c="profesor" value="${esc(c.profesor)}"></label></div>
            <label class="idi-chk"><input type="checkbox" data-c="revisar" ${c.revisar ? 'checked' : ''}> ${ui('Revisar esta clase con Claude (para ajustar el panel)')}</label></section>
          <section class="idi-caja"><h3>🗒 ${ui('Notas')}</h3><textarea id="idi-k-notas" rows="10" placeholder="${ui('Correcciones del profesor, vocabulario, deberes…')}">${esc(c.notas || '')}</textarea>
            <p class="idi-mini apagado" id="idi-k-guardado"></p></section>
          <section class="idi-caja"><h3>📎 ${ui('Ficheros')} <button class="idi-mini" data-anadir>+ ${ui('Añadir')}</button></h3>
            ${(c.adjuntos || []).length ? `<ul class="idi-k-adj">${c.adjuntos.map((a) => `<li><a data-adj="${esc(a.fichero)}">${esc(a.original || a.fichero)}</a>
              <span class="apagado idi-mini">${esc(ui(a.tipo))}${a.tipo === 'texto' && a.original && !/\.(txt|md|vtt|srt|csv)$/i.test(a.original) ? ` ${ui('(convertido)')}` : ''} · ${tam(a.bytes)}</span>
              <button class="idi-x" data-quitar-adj="${esc(a.fichero)}" title="${ui('Quitar')}">✕</button></li>`).join('')}</ul>` : `<p class="apagado idi-mini">${ui('Textos, PDF, documentos de Word (se guardan como texto) o imágenes.')}</p>`}
            <div id="idi-k-ver"></div></section>
        </div></div></div>`;
      enlazarVolver(vEl(), 'clases');
      vEl().querySelector('[data-volver]').textContent = `← ${ui('Clases')}`;
      pintarAudioClase(vEl().querySelector('#idi-k-audio'));
      let tNotas = null;
      const notas = vEl().querySelector('#idi-k-notas');
      notas.oninput = () => { clearTimeout(tNotas); tNotas = setTimeout(async () => { try { await pedir('idiPClaseCambiar', { id: c.id, cambios: { notas: notas.value } }); c.notas = notas.value; const g = vEl().querySelector('#idi-k-guardado'); if (g) g.textContent = ui('Guardado.'); } catch (e) { fallo(e); } }, 700); };
      vEl().querySelectorAll('[data-c]').forEach((i) => i.onchange = async () => { try { K.clase = (await pedir('idiPClaseCambiar', { id: c.id, cambios: { [i.dataset.c]: i.type === 'checkbox' ? i.checked : i.value } })).clase; } catch (e) { fallo(e); } });
      vEl().querySelector('[data-anadir]').onclick = () => importarClase('ficheros');
      vEl().querySelector('[data-carpeta]').onclick = () => pedir('idiPClaseCarpeta', { id: c.id }).catch(fallo);
      vEl().querySelector('[data-eliminar]').onclick = async () => { try { const r = await pedir('idiPClaseEliminar', { id: c.id }); if (r.eliminada) { K.clase = null; A.ir('clases'); } } catch (e) { fallo(e); } };
      vEl().querySelectorAll('[data-quitar-adj]').forEach((b) => b.onclick = async () => { try { K.clase = (await pedir('idiPClaseQuitarAdjunto', { id: c.id, fichero: b.dataset.quitarAdj })).clase; pClase(); } catch (e) { fallo(e); } });
      vEl().querySelectorAll('[data-adj]').forEach((a) => a.onclick = async () => {
        try { const r = await pedir('idiPClaseAdjunto', { id: c.id, fichero: a.dataset.adj }); if (r.texto != null) vEl().querySelector('#idi-k-ver').innerHTML = `<pre class="idi-k-pre">${esc(r.texto)}</pre>`; } catch (e) { fallo(e); }
      });
      const b = vEl().querySelector('#idi-k-buscar');
      if (b) b.oninput = () => { K.buscar = b.value; vEl().querySelector('#idi-k-tx').innerHTML = transcripcionHtml(c); enlazarTx(); };
      enlazarTx();
    }
    const tam = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1e3))} KB`);
    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    function transcripcionHtml(c) {
      const ts = c.transcripciones || [];
      if (!ts.length) return `<p class="apagado idi-mini">${ui('Cuando tengas el audio, pulsa «Transcribir». Se hace en el Mac y tarda más o menos un cuarto de lo que dure la clase.')}</p>`;
      const q = (K.buscar || '').trim().toLowerCase();
      return ts.map((t) => `<h4>${esc(t.audio)} <span class="apagado idi-mini">${({ es: 'castellano', en: 'inglés', fr: 'francés', auto: 'idioma automático' })[t.idioma] ? ui(({ es: 'castellano', en: 'inglés', fr: 'francés', auto: 'idioma automático' })[t.idioma]) : t.idioma}</span></h4>
        <div class="idi-k-segs">${t.segmentos.filter((s) => !q || s.texto.toLowerCase().includes(q)).map((s) => `<p><a class="idi-k-t" data-audio="${esc(t.audio)}" data-t="${s.t}">${mmss(s.t)}</a> ${q ? esc(s.texto).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (x) => `<mark>${x}</mark>`) : esc(s.texto)}</p>`).join('') || `<p class="apagado">${ui('Sin resultados.')}</p>`}</div>`).join('');
    }
    function enlazarTx() {
      vEl().querySelectorAll('.idi-k-t').forEach((a) => a.onclick = () => reproducir(a.dataset.audio, Number(a.dataset.t)));
    }
    async function reproducir(fichero, t) {
      const z = vEl().querySelector(`[data-reproductor="${CSS.escape(fichero)}"]`);
      if (!z) return;
      let au = z.querySelector('audio');
      if (!au) { const { url } = await pedir('idiPClaseAudioUrl', { id: K.clase.id, fichero }); z.innerHTML = `<audio controls preload="metadata" src="${esc(url)}" style="width:100%"></audio>`; au = z.querySelector('audio'); }
      const ir2 = () => { au.currentTime = t || 0; au.play().catch(() => {}); };
      if (au.readyState >= 1) ir2(); else au.addEventListener('loadedmetadata', ir2, { once: true });
      z.scrollIntoView({ block: 'nearest' });
    }
    async function importarClase(que) {
      const z = vEl().querySelector('#idi-k-audio');
      try {
        const r = await pedir('idiPClaseImportar', { id: K.clase.id, que }, (txt) => { const p = z && z.querySelector('.idi-k-prog'); if (p) p.innerHTML = `<p class="idi-progreso">${esc(txt)}</p>`; });
        if (r.cancelado) return;
        K.clase = r.clase; if ((r.resultado || []).length) A.aviso(ui('Añadido: {0}', r.resultado.join(' · ')));
        pClase();
      } catch (e) { fallo(e); }
    }
    function pintarAudioClase(z) {
      const c = K.clase, e = K.estado || {}, g = e.grabando;
      const tx = e.transcribiendo;
      if (g && g.clase === c.id) {
        const s = (Date.now() - g.inicio) / 1000; const nv = g.nivel == null ? 0 : Math.max(0, Math.min(100, (g.nivel + 60) * 1.8));
        z.innerHTML = `<h3>🔴 ${ui('Grabando la clase')} <span class="idi-reloj-grande">${mmss(s)}</span></h3><div class="idi-nivel"><i style="width:${nv}%"></i></div>
          <p class="apagado idi-mini">${esc(g.micro || '')} · ${ui('puedes seguir con Meet o Teams con normalidad')}</p>
          <p class="idi-acciones"><button class="primario" data-parar>⏹ ${ui('Terminar')}</button><button data-descartar>${ui('Descartar')}</button></p><div class="idi-k-prog"></div>`;
        z.querySelector('[data-parar]').onclick = () => pararClase(false);
        z.querySelector('[data-descartar]').onclick = () => pararClase(true);
        if (!K.sondeo) K.sondeo = setInterval(async () => { try { const r = await pedir('idiPClaseEstado'); alEstadoClase(r.estado); if (!r.estado.grabando) { clearInterval(K.sondeo); K.sondeo = null; } } catch (x) { clearInterval(K.sondeo); K.sondeo = null; } }, 700);
        return;
      }
      const auds = c.audios || [];
      const tsx = new Set((c.transcripciones || []).map((t) => t.audio));
      const micros = K.micros || [];
      z.innerHTML = `<h3>🎙 ${ui('Audio de la clase')}</h3>
        ${auds.map((a) => { const enCola = (e.cola || []).some((x) => x.id === c.id && x.fichero === a.fichero); const ahora = tx && tx.id === c.id && tx.fichero === a.fichero;
          return `<div class="idi-k-aud"><div class="idi-k-aud-cab"><b>${esc(a.nombre || a.fichero)}</b><span class="apagado idi-mini">${a.origen === 'grabado' ? ui('grabado en el Mac') : ui('subido')} · ${mmss(a.segundos || 0)} · ${tam(a.bytes)}</span>
            <button class="idi-x" data-quitar-aud="${esc(a.fichero)}" title="${ui('Borrar este audio')}">✕</button></div>
            <div data-reproductor="${esc(a.fichero)}"><button data-oir="${esc(a.fichero)}">▶ ${ui('Escuchar')}</button></div>
            ${ahora ? `<p class="idi-progreso">${ui('Transcribiendo… {0} %', tx.pct || 0)}</p><div class="carga"><span style="width:${tx.pct || 0}%"></span></div>`
    : enCola ? `<p class="idi-progreso">${ui('En cola para transcribir…')}</p>`
    : `<p class="idi-acciones"><select data-idioma="${esc(a.fichero)}" title="${ui('Idioma que más se habla en la clase')}">${[[c.lengua, c.lengua === 'fr' ? 'Francés' : 'Inglés'], ['es', 'Castellano'], ['auto', 'Automático']].map(([k, n]) => `<option value="${k}">${ui(n)}</option>`).join('')}</select>
              <button class="${tsx.has(a.fichero) ? '' : 'primario'}" data-transcribir="${esc(a.fichero)}">${tsx.has(a.fichero) ? ui('Volver a transcribir') : ui('Transcribir')}</button></p>`}</div>`; }).join('')}
        <div class="idi-k-nuevo"><p class="idi-acciones"><button ${auds.length ? '' : 'class="primario"'} data-grabar>● ${ui('Grabar con el Mac')}</button>
          <select data-micro title="${ui('Micrófono')}">${micros.length ? micros.map((m) => `<option ${m.nombre === A.st().idiMicroClase ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('') : `<option value="">${ui('Micrófono por defecto')}</option>`}</select>
          <button data-subir>⬆ ${ui('Subir audio (iPhone…)')}</button></p>
          <details class="idi-mini"><summary>${ui('¿Cómo grabar la clase sin molestar a Meet o Teams?')}</summary>
            <ul><li>${ui('{0} (lo más sencillo): abre {1}, ponlo cerca del Mac y escucha la clase por los {2} (con auriculares el iPhone solo te oye a ti). Al acabar, pásalo al Mac (AirDrop o Compartir › Guardar en Archivos) y pulsa «Subir audio».', `<b>${ui('Con el iPhone')}</b>`, `<i>${ui('Notas de voz')}</i>`, `<b>${ui('altavoces')}</b>`)}</li>
              <li>${ui('{0}: «Grabar con el Mac» usa el micrófono a la vez que Meet o Teams, sin cortarlos. También aquí hay que oír la clase por los altavoces para que se grabe al profesor.', `<b>${ui('Con el Mac')}</b>`)}</li>
              <li>${ui('Si Meet o Teams te dan su propia grabación o transcripción, súbela: el vídeo se queda solo en audio y la transcripción como fichero de texto.')}</li>
              <li>${ui('Avisa a tu profesor de que grabas la clase para estudiar.')}</li></ul></details></div>
        <div class="idi-k-prog"></div>`;
      z.querySelectorAll('[data-oir]').forEach((b) => b.onclick = () => reproducir(b.dataset.oir, 0));
      z.querySelectorAll('[data-quitar-aud]').forEach((b) => b.onclick = async () => { try { const r = await pedir('idiPClaseQuitarAudio', { id: c.id, fichero: b.dataset.quitarAud }); if (r.clase) { K.clase = r.clase; pClase(); } } catch (x) { fallo(x); } });
      z.querySelectorAll('[data-transcribir]').forEach((b) => b.onclick = async () => {
        const idioma = z.querySelector(`[data-idioma="${CSS.escape(b.dataset.transcribir)}"]`).value;
        try { const r = await pedir('idiPClaseTranscribir', { id: c.id, fichero: b.dataset.transcribir, idioma }); K.esperaTx = true; alEstadoClase(r.estado); } catch (x) { fallo(x); }
      });
      z.querySelector('[data-grabar]').onclick = async () => {
        const mic = z.querySelector('[data-micro]').value; A.st().idiMicroClase = mic; A.guardar();
        try { const r = await pedir('idiPClaseGrabar', { id: c.id, micro: mic || undefined }); alEstadoClase(r.estado); } catch (x) { fallo(x); }
      };
      z.querySelector('[data-micro]').onchange = (ev) => { A.st().idiMicroClase = ev.target.value; A.guardar(); };
      z.querySelector('[data-subir]').onclick = () => importarClase('audio');
      if (!K.micros) pedir('idiPClaseMicros').then((r) => { K.micros = r.lista; if (!(K.estado || {}).grabando) { const s = z.querySelector('[data-micro]'); if (s) s.innerHTML = r.lista.map((m) => `<option ${m.nombre === A.st().idiMicroClase ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('') || `<option value="">${ui('Micrófono por defecto')}</option>`; } }).catch(() => {});
    }
    async function pararClase(descartar) {
      clearInterval(K.sondeo); K.sondeo = null;
      const z = vEl().querySelector('#idi-k-audio'); if (z) z.innerHTML = `<p class="idi-progreso">${ui('Guardando y comprimiendo el audio…')}</p>`;
      try { await pedir('idiPClaseParar', { descartar }); await recargarClase(); } catch (e) { fallo(e); }
    }

    // ================================================================== vistas
    function pintar(vista) {
      const f = { biblioteca: pBiblioteca, texto: pTexto, escritura: pEscritura, escribir: pEscribir, escrito: pEscrito, oral: pOral, examen: pExamen, clases: pClases, clase: pClase }[vista];
      if (f) f();
      const z = vEl(); if (z) enlazarUrls(z);
    }
    /** Botón de la pantalla de inicio */
    function empezar(tipo) {
      parar();
      if (tipo === 'lectura' || tipo === 'escucha') { P.modo = tipo; A.ir('biblioteca'); }
      else if (tipo === 'escrito') A.ir('escritura');
      else if (tipo === 'oral') A.ir('oral');
      else if (tipo === 'examen') { P.E = null; A.ir('examen'); }
      else if (tipo === 'clases') A.ir('clases');
    }
    cargarVoces();
    const decir = (texto) => { if (Lector.activo) Lector.pausa(); else Lector.cortarAudio(); Lector.hablar(texto, () => {}); };
    return { decir, pintar, recibir, empezar, cajaHerramientas, cajaMedios, enlazarUrls, vistas: ['biblioteca', 'texto', 'escritura', 'escribir', 'escrito', 'oral', 'examen', 'clases', 'clase'], ocupado: () => !!(P.T || P.E || (O.estado && O.estado.grabando)) };
  }
  window.TCEE_IDI_PR = { crear };
}());
