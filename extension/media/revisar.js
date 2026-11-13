// «Revisar»: visor del PDF con pdf.js (lib/pdfjs), en la mitad derecha de la ventana de revisión (revisar.js; main/REVISAR.md).
// El PDF llega de la extensión (bytes de la foto tomada al abrir o al pulsar «Actualizar»): nunca cambia solo.
// Sincronización: avisa a la extensión del punto que se está leyendo (a un cuarto de la altura de la vista, en puntos del PDF desde
// arriba de la página) y obedece «ir» y «marca». Lo que mueve el propio visor por orden de la extensión no se vuelve a avisar
// (si no, el texto y el PDF se perseguirían). Doble clic: lleva el cursor del texto a esa línea.
const vscode = acquireVsCodeApi();
const CFG = JSON.parse(document.getElementById('cfg').textContent);
const $ = (s) => document.querySelector(s);
const hojas = $('#hojas');
const REF = 0.25;               // altura de la vista (fracción) que se toma como punto de lectura
const MARGEN = 10;              // px entre páginas (revisar.css, .hoja)
const estado = Object.assign({ zoom: null }, vscode.getState() || {});   // zoom: null = ajustar al ancho
let pdfjs = null, doc = null, tareaDoc = null, paginas = [], escala = 1, generacion = 0;
let ignorarHasta = 0;           // hasta cuándo no se avisa del desplazamiento (lo ha movido la extensión)
const enviar = (m) => vscode.postMessage(m);

// ------------------------------------------------------------------ pdf.js
let pideTrabajador = null;
async function iniciarPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(CFG.pdfjs);
  // el trabajador de pdf.js tiene que ser del mismo origen que la página: se crea desde su texto (Blob).
  // El texto se pide con fetch y, si no se puede, a la extensión
  let src = null;
  try { const r = await fetch(CFG.trabajador); if (r.ok) src = await r.text(); } catch (e) { /* abajo */ }
  if (!src) src = await new Promise((ok) => { pideTrabajador = ok; enviar({ tipo: 'pideTrabajador' }); });
  pdfjs.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type: 'module' });
  return pdfjs;
}

async function cargar(m) {
  const gen = ++generacion;
  $('#vacio') && ($('#vacio').textContent = 'Cargando el PDF…');
  try {
    await iniciarPdfjs();
    const tarea = pdfjs.getDocument({ data: m.datos, isEvalSupported: false, disableWorkerRendering: true, useSystemFonts: true });
    const nuevo = await tarea.promise;
    if (gen !== generacion) { tarea.destroy(); return; }
    const tam = [];
    for (let i = 1; i <= nuevo.numPages; i++) {
      const p = await nuevo.getPage(i);
      const v = p.getViewport({ scale: 1 });
      tam.push({ n: i, ancho: v.width, alto: v.height, pagina: p });
    }
    if (gen !== generacion) { tarea.destroy(); return; }
    const anterior = tareaDoc; doc = nuevo; tareaDoc = tarea;
    construir(tam);
    if (anterior) anterior.destroy();   // libera el PDF anterior (y su trabajo en el trabajador)
    $('#fecha').textContent = m.fecha ? `PDF del ${m.fecha}` : '';
    $('#fecha').title = 'Este PDF no cambia solo: «Actualizar» trae el último que se haya compilado';
    $('#aviso').textContent = m.aviso || '';
    nuevoPdf(false);
    if (m.posicion) irA(m.posicion.pagina, m.posicion.y); else { ignorarHasta = Date.now() + 300; hojas.scrollTop = 0; }
    actualizarPagina();
    enviar({ tipo: 'cargado', paginas: doc.numPages });
  } catch (e) {
    hojas.innerHTML = `<p id="vacio">No he podido abrir el PDF: ${String(e && e.message || e).replace(/[<&]/g, '')}</p>`;
    enviar({ tipo: 'error', texto: String(e && e.message || e) });
  }
}

// ------------------------------------------------------------------ páginas: maqueta, escala y pintado (solo las que están cerca)
const observador = new IntersectionObserver((es) => {
  for (const e of es) { const pg = paginas[Number(e.target.dataset.n) - 1]; if (pg) pg.cerca = e.isIntersecting; }
  pintarCercanas();
}, { root: hojas, rootMargin: '1200px 0px' });

function construir(tam) {
  observador.disconnect();
  hojas.innerHTML = '';
  paginas = tam.map((t) => {
    const div = document.createElement('div'); div.className = 'hoja'; div.dataset.n = t.n; div.dataset.ancho = t.ancho;   // ancho en puntos (pruebas)
    const canvas = document.createElement('canvas');
    const num = document.createElement('span'); num.className = 'num'; num.textContent = t.n;
    div.append(canvas, num); hojas.appendChild(div);
    return { ...t, div, canvas, pintada: 0, tarea: null, cerca: false };
  });
  calcularEscala(); maquetar();
  paginas.forEach((pg) => observador.observe(pg.div));
}

function calcularEscala() {
  const ancho = Math.max(...paginas.map((p) => p.ancho), 1);
  escala = estado.zoom == null ? Math.max(0.2, (hojas.clientWidth - 2 * MARGEN - 24) / ancho) : estado.zoom;
  $('#zoom').textContent = `${Math.round(escala * 100)} %`;
}

function maquetar() {
  for (const pg of paginas) { pg.div.style.width = `${pg.ancho * escala}px`; pg.div.style.height = `${pg.alto * escala}px`; }
  pintarCercanas();
}

function pintarCercanas() {
  for (const pg of paginas) {
    if (pg.cerca && pg.pintada !== escala) pintar(pg);
    // lejos de la vista se libera la memoria del dibujo (un tema tiene 60 páginas)
    if (!pg.cerca && pg.pintada) { if (pg.tarea) pg.tarea.cancel(); pg.canvas.width = 0; pg.canvas.height = 0; pg.pintada = 0; }
  }
}

function pintar(pg) {
  if (pg.tarea) { if (pg.tareaEscala === escala) return; pg.tarea.cancel(); }
  const e = escala, dpr = window.devicePixelRatio || 1;
  const vp = pg.pagina.getViewport({ scale: e * dpr });
  // se dibuja en un lienzo aparte y se cambia al terminar: así no se ve la página en blanco mientras tanto
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.floor(vp.width); lienzo.height = Math.floor(vp.height);
  pg.tareaEscala = e;
  pg.tarea = pg.pagina.render({ canvas: lienzo, viewport: vp });
  pg.tarea.promise.then(() => {
    if (escala !== e || !pg.cerca) return;
    pg.div.replaceChild(lienzo, pg.canvas); pg.canvas = lienzo; pg.pintada = e;
  }).catch(() => { /* cancelada */ }).finally(() => { if (pg.tareaEscala === e) pg.tarea = null; });
}

// ------------------------------------------------------------------ posiciones
/** Punto de lectura: página y altura (puntos del PDF desde arriba) a un cuarto de la vista */
function puntoLectura() {
  if (!paginas.length) return null;
  const yv = hojas.scrollTop + hojas.clientHeight * REF;
  let pg = paginas[0];
  for (const p of paginas) { if (p.div.offsetTop - MARGEN <= yv) pg = p; else break; }
  const y = (yv - pg.div.offsetTop) / escala;
  return { pagina: pg.n, y: Math.min(Math.max(y, 0), pg.alto) };
}

/** Pone el punto (página, y) a la altura de lectura. Lo que mueve la extensión no se le vuelve a avisar */
function irA(pagina, y, avisar = false) {
  const pg = paginas[Math.min(Math.max(pagina, 1), paginas.length) - 1];
  if (!pg) return;
  if (!avisar) ignorarHasta = Date.now() + 300;
  hojas.scrollTop = Math.max(0, pg.div.offsetTop + y * escala - hojas.clientHeight * REF);
}

function actualizarPagina() {
  const p = puntoLectura();
  $('#pag').textContent = p ? `${p.pagina} / ${paginas.length}` : '– / –';
}

// avisos de desplazamiento: como mucho cada 80 ms, y siempre el último
let tVista = 0, pendiente = null;
hojas.addEventListener('scroll', () => {
  requestAnimationFrame(actualizarPagina);
  if (Date.now() < ignorarHasta) { ignorarHasta = Math.max(ignorarHasta, Date.now() + 120); return; }
  const ahora = Date.now();
  clearTimeout(pendiente);
  if (ahora - tVista >= 80) { tVista = ahora; avisarVista(); } else pendiente = setTimeout(() => { tVista = Date.now(); avisarVista(); }, 80);
}, { passive: true });
function avisarVista() { const p = puntoLectura(); if (p) enviar({ tipo: 'vista', ...p }); }

// doble clic en el PDF: el cursor del texto va a esa línea
hojas.addEventListener('dblclick', (ev) => {
  const div = ev.target.closest('.hoja');
  if (!div) return;
  const r = div.getBoundingClientRect();
  enviar({ tipo: 'dobleClic', pagina: Number(div.dataset.n), x: (ev.clientX - r.left) / escala, y: (ev.clientY - r.top) / escala });
  ev.preventDefault();
});

/** Señala un sitio del PDF (al pulsar en el texto) y, si no se ve, lo trae a la vista */
function marcar({ pagina, arriba, abajo }) {
  const pg = paginas[pagina - 1];
  if (!pg) return;
  const m = document.createElement('div'); m.className = 'marca';
  m.style.top = `${Math.max(0, arriba * escala - 3)}px`; m.style.height = `${Math.max(6, (abajo - arriba) * escala + 6)}px`;
  pg.div.appendChild(m); setTimeout(() => m.remove(), 1700);
  const y0 = pg.div.offsetTop + arriba * escala, y1 = pg.div.offsetTop + abajo * escala;
  if (y0 < hojas.scrollTop || y1 > hojas.scrollTop + hojas.clientHeight) irA(pagina, arriba);
}

// ------------------------------------------------------------------ zoom y barra
function cambiarZoom(z) {
  const p = puntoLectura();
  estado.zoom = z; vscode.setState(estado);
  calcularEscala(); maquetar();
  if (p) irA(p.pagina, p.y);
}
new ResizeObserver(() => { if (estado.zoom == null && paginas.length) cambiarZoom(null); }).observe(hojas);

function nuevoPdf(hay, texto) {
  const b = $('#actualizar');
  b.classList.toggle('nuevo', !!hay);
  b.textContent = hay ? 'Hay un PDF nuevo · Actualizar' : 'Actualizar';
  b.title = texto || (hay ? 'Se ha compilado de nuevo: pulsa para ver el PDF nuevo (sigue en el mismo sitio)' : 'Trae el último PDF compilado (o compila antes, si el tema ha cambiado)');
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a, p = puntoLectura();
  if (a === 'anterior' && p) irA(p.pagina - 1, 0, true);
  if (a === 'siguiente' && p) irA(p.pagina + 1, 0, true);
  if (a === 'menos') cambiarZoom(Math.max(0.3, Math.round((escala - 0.1) * 10) / 10));
  if (a === 'mas') cambiarZoom(Math.min(4, Math.round((escala + 0.1) * 10) / 10));
  if (a === 'ancho') cambiarZoom(null);
  if (a === 'sentido') enviar({ tipo: 'sentido' });
  if (a === 'actualizar') enviar({ tipo: 'actualizar' });
});
document.addEventListener('keydown', (ev) => {
  if (ev.target.closest('input, select, textarea')) return;
  if ((ev.key === '+' || ev.key === '=') && !ev.metaKey) { cambiarZoom(Math.min(4, Math.round((escala + 0.1) * 10) / 10)); ev.preventDefault(); }
  if (ev.key === '-' && !ev.metaKey) { cambiarZoom(Math.max(0.3, Math.round((escala - 0.1) * 10) / 10)); ev.preventDefault(); }
});

// ------------------------------------------------------------------ mensajes de la extensión
window.addEventListener('message', (e) => {
  const m = e.data;
  if (m.tipo === 'cargar') cargar(m);
  if (m.tipo === 'ir' && paginas.length) irA(m.pagina, m.y);
  if (m.tipo === 'marca' && paginas.length) marcar(m);
  if (m.tipo === 'nuevo') nuevoPdf(m.hay, m.texto);
  if (m.tipo === 'sentido') { $('#sentido').textContent = m.titulo; $('#sentido').title = m.ayuda || ''; }
  if (m.tipo === 'aviso') $('#aviso').textContent = m.texto || '';
  if (m.tipo === 'trabajador' && pideTrabajador) { pideTrabajador(m.texto); pideTrabajador = null; }
});
enviar({ tipo: 'listo' });
