// Paquete mínimo de MathJax (TeX → SVG) para la vista previa de fórmulas del Panel TCEE. Generado con esbuild (ver FORMULAS.md).
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
require('mathjax-full/js/input/tex/base/BaseConfiguration.js');
require('mathjax-full/js/input/tex/ams/AmsConfiguration.js');
require('mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js');
require('mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js');
require('mathjax-full/js/input/tex/cancel/CancelConfiguration.js');
require('mathjax-full/js/input/tex/color/ColorConfiguration.js');
require('mathjax-full/js/input/tex/mathtools/MathtoolsConfiguration.js');
require('mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js');
require('mathjax-full/js/input/tex/textmacros/TextMacrosConfiguration.js');
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const docs = {};
// estricto: sin «noundefined», para que una orden desconocida dé error (sirve para encontrar la causa de otros errores)
function documento(estricto) {
  const k = estricto ? 'e' : 'n';
  if (!docs[k]) docs[k] = mathjax.document('', {
    InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'boldsymbol', 'cancel', 'color', 'mathtools', 'textmacros'].concat(estricto ? [] : ['noundefined']),
      formatError: (jax, err) => { throw err; } }),
    OutputJax: new SVG({ fontCache: 'local' }),
  });
  return docs[k];
}
/** TeX → cadena SVG. Lanza un error si la fórmula no se puede interpretar */
function svg(tex, display = true, estricto = false) {
  const d = documento(estricto);
  const nodo = d.convert(tex, { display });
  d.clear && d.clear();
  return adaptor.innerHTML(nodo);
}
module.exports = { svg };
