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
let doc = null;
function documento() {
  if (!doc) doc = mathjax.document('', {
    InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'boldsymbol', 'cancel', 'color', 'mathtools', 'noundefined', 'textmacros'],
      formatError: (jax, err) => { throw err; } }),
    OutputJax: new SVG({ fontCache: 'local' }),
  });
  return doc;
}
/** TeX → cadena SVG. Lanza un error si la fórmula no se puede interpretar */
function svg(tex, display = true) {
  const d = documento();
  const nodo = d.convert(tex, { display });
  d.clear && d.clear();
  return adaptor.innerHTML(nodo);
}
module.exports = { svg };
