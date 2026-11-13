// Prueba de synctex.js (main/REVISAR.md) contra la orden «synctex» de TeX Live, que es la referencia.
// Compila pruebas/datos/revisar_muestra.tex con pdflatex -synctex=1 en una carpeta temporal y compara:
//  - de línea a PDF: página y altura del primer sitio de cada línea (synctex view);
//  - de PDF a línea: la línea en una rejilla de puntos de cada página (synctex edit).
// No tiene que coincidir siempre: SyncTeX da varios sitios por línea y la referencia elige con otras reglas; basta con que
// coincida (o se quede a ±2 líneas, un renglón) en la gran mayoría de los casos (mínimo 85 %; en el 3.B.20, 96 % y 93 %).
// Uso: node pruebas/synctex.js [otro.tex]   (necesita pdflatex y synctex; en la nube de Claude están). Sale con 1 si falla algo.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { leer } = require('../synctex');

const origen = path.resolve(process.argv[2] || path.join(__dirname, 'datos', 'revisar_muestra.tex'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synctex-'));
const tex = path.join(tmp, 'main.tex');
fs.copyFileSync(origen, tex);
const imgs = path.join(path.dirname(origen), 'Img');
if (fs.existsSync(imgs)) fs.cpSync(imgs, path.join(tmp, 'Img'), { recursive: true });
try { execFileSync('pdflatex', ['-synctex=1', '-interaction=nonstopmode', 'main.tex'], { cwd: tmp, stdio: 'ignore' }); } catch (e) { /* errores menores: sigue si hay PDF */ }
try { execFileSync('pdflatex', ['-synctex=1', '-interaction=nonstopmode', 'main.tex'], { cwd: tmp, stdio: 'ignore' }); } catch (e) { /* */ }
if (!fs.existsSync(path.join(tmp, 'main.synctex.gz'))) { console.log('Sin pdflatex o sin SyncTeX: no se puede probar aquí'); process.exit(2); }

const idx = leer(fs.readFileSync(path.join(tmp, 'main.synctex.gz')), 'main.tex');
const campo = (txt, k) => { const m = new RegExp(`^${k}:(.*)$`, 'm').exec(txt); return m ? m[1] : null; };
let fallos = 0, total = 0;
const comprobar = (nombre, ok, detalle) => { total++; if (!ok) { fallos++; console.log(`FALLO ${nombre}${detalle ? ` (${detalle})` : ''}`); } };

// ---- de línea a PDF (sin las líneas vacías o de cierre: SyncTeX les da el final del párrafo de encima y «Revisar» no las usa)
const fuente = fs.readFileSync(tex, 'utf8').split('\n');
const nLineas = fuente.length;
const vacia = (l) => /^\s*(%.*)?$|^\s*(\}|\\end\{[^}]*\}|\\(clear|new)page)\s*$/.test(l || '');
let conSitio = 0, bienSitio = 0;
for (let l = 1; l <= nLineas; l++) {
  if (vacia(fuente[l - 1])) continue;
  let out = '';
  try { out = execFileSync('synctex', ['view', '-i', `${l}:0:${tex}`, '-o', path.join(tmp, 'main.pdf')], { encoding: 'utf8' }); } catch (e) { continue; }
  const pag = campo(out, 'Page');
  if (!pag) continue;
  // la referencia da varias cajas; nos vale cualquier altura entre la primera y la última de esa página (el arranque de la línea)
  const ys = [...out.matchAll(/^Page:(\d+)\nx:[\d.]+\ny:([\d.]+)/gm)].filter((m) => m[1] === pag).map((m) => Number(m[2]));
  const p = idx.posicion(l);
  if (!p || p.linea !== l) continue;   // la referencia busca «cerca»; aquí solo se comparan las líneas con sitio propio
  conSitio++;
  // vale si cae en la misma página y a menos de 15 puntos (un renglón) del primer sitio de la referencia
  if (p.pagina === Number(pag) && Math.abs(p.y - Math.min(...ys)) < 15) bienSitio++;
  else if (process.env.DETALLE) console.log(`  línea ${l}: ${p.pagina}/${p.y.toFixed(0)}; referencia ${pag}/${Math.min(...ys).toFixed(0)}`);
}
const pctSitio = conSitio ? Math.round((100 * bienSitio) / conSitio) : 0;
comprobar(`de línea a PDF: ${bienSitio} de ${conSitio} líneas en su sitio (${pctSitio} %)`, pctSitio >= 85);

// ---- de PDF a línea
let puntos = 0, iguales = 0, cerca = 0;
for (const pag of idx.paginas()) {
  for (let y = 80; y < 760; y += 37) {
    for (const x of [150, 300, 450]) {
      let out = '';
      try { out = execFileSync('synctex', ['edit', '-o', `${pag}:${x}:${y}:${path.join(tmp, 'main.pdf')}`], { encoding: 'utf8' }); } catch (e) { continue; }
      const ref = Number(campo(out, 'Line'));
      const input = campo(out, 'Input') || '';
      if (!ref || !/main\.tex$/.test(input)) continue;
      const l = idx.linea(pag, y, x);
      puntos++;
      if (l === ref) iguales++;
      else if (l != null && Math.abs(l - ref) <= 2) cerca++;
      else if (process.env.DETALLE) console.log(`  distinto: página ${pag}, (${x}, ${y}) → ${l}; referencia ${ref}`);
    }
  }
}
const pct = puntos ? Math.round((100 * (iguales + cerca)) / puntos) : 0;
comprobar(`de PDF a línea: ${iguales} iguales y ${cerca} a ±2 líneas de ${puntos} puntos (${pct} %)`, pct >= 85);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`De PDF a línea: ${pct} %. De línea a PDF: ${pctSitio} %. ${fallos ? 'FALLA' : 'Todo correcto'} (mínimo: 85 %; DETALLE=1 enseña las diferencias)`);
process.exit(fallos ? 1 : 0);
