// Pestaña Idiomas: textos de la interfaz en la lengua elegida en Ajustes (la estudiada o castellano). La clave es el texto en castellano;
// {0}, {1}… son los huecos. Sin traducción, se enseña el castellano. Lo usan la pantalla (window.TCEE_I18N_IDI) y la extensión (require).
// Reglas: main/IDIOMAS.md, «Panel en la lengua estudiada».
(function (g) {
  'use strict';
  const D = { en: {}, fr: {} };
  /** Traduce s a lang (en | fr | es) y rellena los huecos {0}, {1}… con args */
  function tr(lang, s, args) {
    let x = (lang && lang !== 'es' && D[lang] && Object.prototype.hasOwnProperty.call(D[lang], s)) ? D[lang][s] : s;
    (args || []).forEach((a, i) => { x = x.split(`{${i}}`).join(a == null ? '' : String(a)); });
    return x;
  }
  const api = { D, tr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.TCEE_I18N_IDI = api;
}(typeof window !== 'undefined' ? window : this));
