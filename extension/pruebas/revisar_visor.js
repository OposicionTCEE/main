// Prueba del visor de «Revisar» (media/revisar.js + revisarHtml.js + lib/pdfjs; main/REVISAR.md) en Chromium, como en VS Code:
// la página y los ficheros de la extensión se sirven desde orígenes distintos y con la misma política de seguridad (CSP).
// Comprueba: carga el PDF con pdf.js, pinta páginas, avisa del punto de lectura al desplazarse, obedece «ir» sin volver a avisar,
// doble clic, marca, zoom sin perder el sitio, aviso de PDF nuevo y que no hay violaciones de la CSP.
// Uso: node pruebas/revisar_visor.js [fichero.pdf]   (por defecto compila pruebas/datos/revisar_muestra.tex con pdflatex)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { html } = require('../revisarHtml');

const RAIZ = path.join(__dirname, '..');
let pdf = process.argv[2];
if (!pdf) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visor-'));
  fs.copyFileSync(path.join(__dirname, 'datos', 'revisar_muestra.tex'), path.join(tmp, 'main.tex'));
  try { execFileSync('pdflatex', ['-interaction=nonstopmode', 'main.tex'], { cwd: tmp, stdio: 'ignore' }); } catch (e) { /* errores menores */ }
  pdf = path.join(tmp, 'main.pdf');
  if (!fs.existsSync(pdf)) { console.log('Sin pdflatex: pasa un PDF como argumento'); process.exit(2); }
}

const TIPOS = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };
function servir(manejador) {
  return new Promise((ok) => { const s = http.createServer(manejador).listen(0, '127.0.0.1', () => ok(s)); });
}

(async () => {
  // recursos de la extensión, con CORS (como los sirve VS Code a la página)
  const recursos = await servir((req, res) => {
    const ruta = decodeURIComponent(req.url.split('?')[0]);
    const f = ruta === '/__prueba.pdf' ? pdf : path.join(RAIZ, ruta);   // el PDF de la prueba (lo trae la página: en VS Code lo manda la extensión)
    if ((f !== pdf && !f.startsWith(RAIZ)) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(f).pipe(res);
  });
  const origenR = `http://127.0.0.1:${recursos.address().port}`;
  const nonce = 'pruebaNonce123';
  const stub = `<script nonce="${nonce}">window.__enviados=[];window.acquireVsCodeApi=()=>({postMessage:(m)=>window.__enviados.push(m),getState:()=>null,setState:()=>{}});</script>`;
  const pagina = html({ nonce, csp: origenR, url: (rel) => `${origenR}/${rel}` }).replace('<body>', `<body>${stub}`);
  const web = await servir((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(pagina); });

  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 900, height: 900 } });
  const violaciones = [], errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.exposeFunction('__violacion', (t) => violaciones.push(t));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.__violacion(`${e.violatedDirective} ${e.blockedURI}`)));
  await p.goto(`http://127.0.0.1:${web.address().port}/`);

  let fallos = 0;
  const comprobar = (nombre, ok, detalle) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` (${detalle})` : ''}`); if (!ok) fallos++; };
  const enviados = () => p.evaluate(() => window.__enviados);
  const esperarMensaje = async (tipo, ms = 15000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) { const m = (await enviados()).filter((x) => x.tipo === tipo); if (m.length) return m[m.length - 1]; await p.waitForTimeout(100); }
    return null;
  };

  comprobar('la página avisa de que está lista', !!(await esperarMensaje('listo')));
  const cargarPdf = (extra) => p.evaluate(async ([u, x]) => {
    const datos = new Uint8Array(await (await fetch(u)).arrayBuffer());
    window.postMessage({ tipo: 'cargar', datos, ...x }, '*');
  }, [`${origenR}/__prueba.pdf`, extra]);
  const ANCHO = null;   // el visor deja el ancho de cada página en puntos en data-ancho
  const t0 = Date.now();
  await cargarPdf({ fecha: '13/11 18:45', posicion: null });
  const cargado = await esperarMensaje('cargado', 30000);
  comprobar('pdf.js abre el PDF', !!cargado, cargado ? `${cargado.paginas} páginas en ${Date.now() - t0} ms` : JSON.stringify(await esperarMensaje('error', 10)));
  if (!cargado) { console.log(errores.join('\n')); process.exit(1); }
  await p.waitForTimeout(800);
  // un lienzo sin pintar mide 300 px (lo que trae el navegador) o 0 (liberado); pintado, el ancho de la página
  const pintadas = await p.$$eval('.hoja canvas', (cs) => cs.filter((c) => c.width > 400).length);
  const total = await p.$$eval('.hoja', (hs) => hs.length);
  comprobar('pinta las páginas que se ven', pintadas >= 1, `${pintadas} de ${total}`);
  comprobar('no pinta las que quedan lejos (memoria)', total < 10 || pintadas <= 8, `${pintadas} de ${total}`);
  comprobar('la barra dice la fecha del PDF', (await p.textContent('#fecha')).includes('13/11 18:45'));

  // desplazarse: avisa del punto de lectura
  await p.evaluate(() => { window.__enviados.length = 0; document.querySelector('#hojas').scrollTop = 1500; });
  const vista = await esperarMensaje('vista', 2000);
  const esperado = await p.evaluate((A) => {
    const h = document.querySelector('#hojas'), yv = h.scrollTop + h.clientHeight * 0.25;
    const hs = [...document.querySelectorAll('.hoja')]; let pg = hs[0]; for (const x of hs) if (x.offsetTop - 10 <= yv) pg = x;
    return { pagina: Number(pg.dataset.n), y: (yv - pg.offsetTop) / (pg.clientWidth / Number(pg.dataset.ancho)) };
  }, ANCHO);
  comprobar('al desplazarse avisa de página y altura', vista && vista.pagina === esperado.pagina && Math.abs(vista.y - esperado.y) < 2, JSON.stringify(vista));

  // «ir»: se mueve y no lo vuelve a avisar
  await p.evaluate(() => { window.__enviados.length = 0; window.postMessage({ tipo: 'ir', pagina: 3, y: 200 }, '*'); });
  await p.waitForTimeout(500);
  const tras = await p.evaluate((A) => { const h = document.querySelector('#hojas'), pg = document.querySelectorAll('.hoja')[2]; const e = pg.clientWidth / Number(pg.dataset.ancho); return { top: h.scrollTop, quiero: pg.offsetTop + 200 * e - h.clientHeight * 0.25 }; }, ANCHO);
  comprobar('«ir» pone ese punto a la altura de lectura', Math.abs(tras.top - tras.quiero) < 2, JSON.stringify(tras));
  comprobar('«ir» no se vuelve a avisar (no hay persecución)', !(await enviados()).some((m) => m.tipo === 'vista'));
  comprobar('el contador de páginas sigue', (await p.textContent('#pag')).startsWith('3 /'));

  // doble clic
  const caja = await p.$eval('.hoja[data-n="3"]', (d) => { const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 150 }; });
  await p.mouse.dblclick(caja.x, caja.y);
  const dc = await esperarMensaje('dobleClic', 2000);
  comprobar('doble clic: página y punto del PDF', dc && dc.pagina === 3 && dc.x > 250 && dc.x < 360, JSON.stringify(dc));

  // marca
  await p.evaluate(() => window.postMessage({ tipo: 'marca', pagina: 3, arriba: 300, abajo: 340 }, '*'));
  await p.waitForTimeout(150);
  comprobar('marca un sitio del PDF', (await p.$$('.hoja[data-n="3"] .marca')).length === 1);

  // zoom: el punto de lectura no cambia
  const antes = await p.evaluate(() => { const h = document.querySelector('#hojas'); return h.scrollTop; });
  await p.click('[data-a="mas"]'); await p.waitForTimeout(400);
  const despues = await p.evaluate((A) => {
    const h = document.querySelector('#hojas'), yv = h.scrollTop + h.clientHeight * 0.25;
    const hs = [...document.querySelectorAll('.hoja')]; let pg = hs[0]; for (const x of hs) if (x.offsetTop - 10 <= yv) pg = x;
    return { pagina: Number(pg.dataset.n), y: (yv - pg.offsetTop) / (pg.clientWidth / Number(pg.dataset.ancho)), zoom: document.querySelector('#zoom').textContent };
  }, ANCHO);
  comprobar('zoom: se queda en el mismo sitio', despues.pagina === 3 && Math.abs(despues.y - 200) < 3, `${antes} → ${JSON.stringify(despues)}`);

  // PDF nuevo
  await p.evaluate(() => window.postMessage({ tipo: 'nuevo', hay: true }, '*'));
  await p.waitForTimeout(100);
  comprobar('avisa de que hay un PDF nuevo', (await p.textContent('#actualizar')).includes('Hay un PDF nuevo'));
  await p.click('#actualizar');
  comprobar('«Actualizar» se lo pide a la extensión', !!(await esperarMensaje('actualizar', 1000)));

  // volver a cargar en un sitio (como tras «Actualizar»)
  await p.evaluate(() => { window.__enviados.length = 0; });
  await cargarPdf({ fecha: '13/11 19:00', posicion: { pagina: 2, y: 300 } });
  const recargado = await esperarMensaje('cargado', 30000); await p.waitForTimeout(300);
  comprobar('vuelve a cargar (Actualizar)', !!recargado, JSON.stringify((await enviados()).slice(-3)));
  const otra = !recargado ? 999 : await p.evaluate((A) => { const h = document.querySelector('#hojas'), pg = document.querySelectorAll('.hoja')[1]; const e = pg.clientWidth / Number(pg.dataset.ancho); return Math.abs(h.scrollTop - (pg.offsetTop + 300 * e - h.clientHeight * 0.25)); }, ANCHO);
  comprobar('al recargar va al sitio pedido', otra < 2, `${otra}`);

  comprobar('sin violaciones de la política de seguridad', !violaciones.length, violaciones.join(' | '));
  comprobar('sin errores en la consola', !errores.length, errores.slice(0, 3).join(' | '));
  await nav.close(); recursos.close(); web.close();
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
