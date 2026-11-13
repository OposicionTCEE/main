// Prueba del Panel Oposición (media/): la posición de lectura no salta arriba cuando llegan datos nuevos.
// Reproduce el fallo de la pestaña Cante (CANTE.md, apartado «Posición de lectura»): el panel recibe «datos» cada vez que
// se guarda un tema, se cambia de editor o avanza una transcripción, y antes se repintaba entero y la transcripción volvía arriba.
//
// Uso: node pruebas/panel_desplazamiento.js [carpeta media]   (por defecto, la media/ de la extensión)
// Necesita Playwright con Chromium (en la nube de Claude ya está instalado). Sale con código 1 si alguna comprobación falla.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const MEDIA = path.resolve(process.argv[2] || path.join(__dirname, '..', 'media'));

/** Cante de prueba con una transcripción larga (120 frases de 40 palabras) */
function canteDePrueba() {
  const segmentos = [];
  for (let i = 0; i < 120; i++) {
    const palabras = [];
    for (let j = 0; j < 40; j++) palabras.push([i * 30 + j * 0.7, `palabra${i}_${j}`]);
    segmentos.push({ t: i * 30, texto: palabras.map((p) => p[1]).join(' '), palabras });
  }
  return { id: 'c1', codigo: '3.A.1', titulo: 'Tema de prueba', fecha: '2026-11-10T10:00:00Z', duracion: 3600, objetivo: 1800,
    estado: 'transcrito', segmentos, tramos: null, voces: null, origen: 'grabado' };
}

function datosDePrueba(n) {
  const f = canteDePrueba();
  return {
    temas: [{ codigo: '3.A.1', titulo: 'Tema de prueba', parte: 'Ejercicio 3, parte A', minutos: 60, pct: 50 }],
    total: { tiempo: `${n} h`, hechos: 1, n: 145 },
    trabajos: { lista: [], cola: 0 },
    cante: { lista: [{ id: f.id, codigo: f.codigo, fecha: f.fecha, duracion: f.duracion, objetivo: f.objetivo, estado: f.estado, marcado: false, real: f.duracion, palabrasExpo: 4800, audioExiste: false }],
      falta: [], cola: [], transcribiendo: null, identificando: null, voces: {}, grabando: null, abierto: null, semana: [], objetivo: 30, micro: '' },
  };
}

const HTML = (media) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${media}/panel.css"></head><body><div id="app"></div>
<script>
  window.__enviados = [];
  window.acquireVsCodeApi = () => ({
    postMessage: (m) => {
      window.__enviados.push(m);
      if (m.tipo === 'canteVer') setTimeout(() => window.postMessage({ tipo: 'canteDetalle', detalle: window.__detalle }, '*'), 0);
    },
    getState: () => ({ pestana: 'cante', canteVer: 'c1' }),
    setState: () => {},
  });
</script>
<script src="file://${media}/cante.js"></script>
<script src="file://${media}/temas.js"></script>
${fs.existsSync(path.join(media, 'desplazamiento.js')) ? `<script src="file://${media}/desplazamiento.js"></script>` : ''}
<script src="file://${media}/panel.js"></script></body></html>`;

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1400, height: 900 } });
  const fichero = path.join(require('os').tmpdir(), `prueba_panel_${process.pid}.html`);
  fs.writeFileSync(fichero, HTML(MEDIA));
  await pagina.goto(`file://${fichero}`);
  await pagina.evaluate((d) => { window.__detalle = d; }, canteDePrueba());
  const enviarDatos = (n) => pagina.evaluate((d) => window.postMessage({ tipo: 'datos', datos: d }, '*'), datosDePrueba(n));
  await enviarDatos(1);
  await pagina.waitForSelector('#c-texto .w');
  const caja = '.cante-dcha';
  const pos = () => pagina.$eval(caja, (e) => e.scrollTop);
  let fallos = 0;
  const comprobar = (nombre, ok, detalle) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` (${detalle})` : ''}`); if (!ok) fallos++; };

  // 1) leer bajando y que lleguen datos iguales (p. ej., un agente guarda otro tema)
  await pagina.$eval(caja, (e) => { e.scrollTop = 2500; });
  const antes = await pos();
  await enviarDatos(1); await pagina.waitForTimeout(100);
  comprobar('datos sin cambios: la transcripción no se mueve', Math.abs((await pos()) - antes) < 2, `${antes} → ${await pos()}`);

  // 2) datos que sí cambian la cabecera (el tiempo restante)
  await enviarDatos(2); await pagina.waitForTimeout(100);
  comprobar('cambia la cabecera: la transcripción no se mueve', Math.abs((await pos()) - antes) < 2, `${antes} → ${await pos()}`);

  // 3) datos que cambian el historial (avanza la cola de transcripción): la pestaña se repinta y conserva la posición
  await pagina.evaluate((d) => { d.cante.cola = ['c9']; window.postMessage({ tipo: 'datos', datos: d }, '*'); }, datosDePrueba(2));
  await pagina.waitForTimeout(100);
  comprobar('se repinta la pestaña: la transcripción no se mueve', Math.abs((await pos()) - antes) < 2, `${antes} → ${await pos()}`);

  // 4) ir a otra pestaña y volver: la transcripción vuelve donde se dejó
  await pagina.click('[data-pest="temas"]'); await pagina.waitForTimeout(100);
  comprobar('pestaña Temas pintada', await pagina.$('.cante') === null);
  await pagina.click('[data-pest="cante"]'); await pagina.waitForSelector('#c-texto .w'); await pagina.waitForTimeout(100);
  comprobar('volver a Cante: la transcripción sigue donde estaba', Math.abs((await pos()) - antes) < 2, `${antes} → ${await pos()}`);

  // 5) ventana estrecha (se desplaza la página entera, no la caja): llegan datos y la página no vuelve arriba
  await pagina.setViewportSize({ width: 900, height: 700 }); await pagina.waitForTimeout(100);
  await pagina.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await pagina.waitForTimeout(100);
  const yAntes = await pagina.evaluate(() => window.scrollY);
  await pagina.evaluate((d) => { d.cante.cola = ['c8']; window.postMessage({ tipo: 'datos', datos: d }, '*'); }, datosDePrueba(3));
  await pagina.waitForTimeout(100);
  const yDespues = await pagina.evaluate(() => window.scrollY);
  comprobar('ventana estrecha: la página no se mueve', yAntes > 300 && Math.abs(yDespues - yAntes) < 2, `${yAntes} → ${yDespues}`);

  // 6) la cabecera se actualiza sin rehacerse (los botones de pestaña son los mismos elementos)
  const marca = await pagina.evaluate(() => { const b = document.querySelector('[data-pest="cante"]'); b.__marca = 1; return true; });
  await enviarDatos(4); await pagina.waitForTimeout(50);
  comprobar('la cabecera se actualiza en su sitio', marca && await pagina.evaluate(() => document.querySelector('[data-pest="cante"]').__marca === 1
    && document.querySelector('.resumen strong').textContent.includes('4 h')));

  // 7) trabajos en marcha (CANTE.md §10): aparecen en la cabecera, sin mover la lectura ni cambiar el alto de la cabecera
  await pagina.setViewportSize({ width: 1400, height: 900 }); await pagina.waitForTimeout(100);
  await pagina.$eval(caja, (e) => { e.scrollTop = 2500; });
  const alto = () => pagina.$eval('header', (h) => h.getBoundingClientRect().height);
  const altoAntes = await alto();
  await pagina.evaluate(() => window.postMessage({ tipo: 'trabajos', trabajos: { lista: [{ tipo: 'transcribir', que: 'clase «Leçon 3»', pct: 34 }], cola: 1 } }, '*'));
  await pagina.waitForTimeout(100);
  const chips = await pagina.$$eval('.trabajos .trabajo', (xs) => xs.map((x) => x.textContent));
  comprobar('trabajos: se ve en la cabecera', chips.length === 2 && chips[0].includes('Transcribiendo: clase «Leçon 3» · 34 %') && chips[1] === '+1 en cola', chips.join(' | '));
  comprobar('trabajos: la transcripción no se mueve', Math.abs((await pos()) - 2500) < 2, `${await pos()}`);
  comprobar('trabajos: la cabecera no cambia de alto', Math.abs((await alto()) - altoAntes) < 1, `${altoAntes} → ${await alto()}`);
  await enviarDatos(5); await pagina.waitForTimeout(100);   // datos sin trabajos (ya terminó): desaparece
  comprobar('trabajos: al terminar desaparece', (await pagina.$$('.trabajos .trabajo')).length === 0);

  await navegador.close();
  fs.unlinkSync(fichero);
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
