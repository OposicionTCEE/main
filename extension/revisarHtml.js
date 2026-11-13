// Página del visor de «Revisar» (main/REVISAR.md). Aparte de revisar.js y sin VS Code para poder probarla tal cual en un
// navegador, con la misma política de seguridad (pruebas/revisar_visor.js).
//  - nonce: el de los <script>; csp: el origen de los recursos de la extensión (webview.cspSource);
//  - url(rel): dirección de un fichero de la extensión para la página (asWebviewUri), p. ej. url('media/revisar.js').
// pdf.js crea su trabajador desde un Blob (worker-src blob:) y lee su texto con fetch (connect-src).
'use strict';

function html({ nonce, csp, url }) {
  const cfg = JSON.stringify({ pdfjs: url('lib/pdfjs/pdf.min.mjs'), trabajador: url('lib/pdfjs/pdf.worker.min.mjs') }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} blob: data:; style-src ${csp} 'unsafe-inline'; font-src ${csp} data: blob:; script-src 'nonce-${nonce}' ${csp}; worker-src blob:; connect-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${url('media/revisar.css')}"></head>
<body>
<div id="barra" role="toolbar" aria-label="PDF">
  <button data-a="anterior" title="Página anterior">◀</button><span id="pag" aria-live="polite">– / –</span><button data-a="siguiente" title="Página siguiente">▶</button>
  <span class="sep"></span>
  <button data-a="menos" title="Alejar (tecla −)">−</button><span id="zoom">100 %</span><button data-a="mas" title="Acercar (tecla +)">+</button>
  <button data-a="ancho" title="Ajustar al ancho">↔</button>
  <span class="sep"></span>
  <button data-a="sentido" id="sentido" title="">PDF → texto</button>
  <button data-a="seguimiento" id="seguimiento" title="">Sigue: al parar</button>
  <button data-a="atenuar" id="atenuar" aria-pressed="true" title="Oscurecer el lado donde no está el ratón (pulsa para quitarlo o ponerlo)">◐</button>
  <span class="hueco"></span>
  <span id="fecha" class="apagado"></span>
  <button data-a="actualizar" id="actualizar">Actualizar</button>
</div>
<div id="aviso" role="status"></div>
<div id="hojas" tabindex="0"><p id="vacio">Cargando el PDF…</p></div>
<script type="application/json" id="cfg">${cfg}</script>
<script type="module" nonce="${nonce}" src="${url('media/revisar.js')}"></script>
</body></html>`;
}

module.exports = { html };
