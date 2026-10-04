// Lectura del índice y del título de un tema (sin dependencias de VS Code, para poder probarlo aparte)
'use strict';

const NIVELES = { section: 1, subsection: 2, subsubsection: 3, paragraph: 4, anexo: 1 };
const RX_TEMA = /[\\/]temario[\\/]Ejercicio-\d[\\/]Parte-[AB][\\/]([34]\.[AB]\.\d+)[\\/]main\.tex$/;

/** Código del tema (3.A.1) a partir de la ruta, o null si no es el main.tex de un tema */
function codigoTema(ruta) {
  const m = RX_TEMA.exec(ruta || '');
  return m ? m[1] : null;
}

/** Quita comentarios LaTeX de una línea (respetando \%) */
function sinComentario(linea) {
  for (let i = 0; i < linea.length; i++) {
    if (linea[i] === '%' && (i === 0 || linea[i - 1] !== '\\')) return linea.slice(0, i);
  }
  return linea;
}

/** Lee el contenido entre llaves equilibradas a partir de la posición de '{'. Devuelve [contenido, fin] */
function entreLlaves(texto, i) {
  let prof = 0;
  for (let j = i; j < texto.length; j++) {
    const c = texto[j];
    if (c === '\\') { j++; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return [texto.slice(i + 1, j), j + 1]; }
  }
  return [texto.slice(i + 1), texto.length];
}

/** Convierte un fragmento LaTeX en texto legible */
function limpiar(t) {
  let s = t;
  for (let k = 0; k < 4; k++) s = s.replace(/\\[a-zA-Z]+\*?\s*(\[[^\]]*\])?\{([^{}]*)\}/g, '$2');
  s = s.replace(/\\(large|Large|LARGE|small|normalsize|bfseries|itshape|centering|hfill|newline|quad|qquad)\b/g, ' ')
       .replace(/\\\\/g, ' ')
       .replace(/\\[a-zA-Z]+\*?/g, ' ')
       .replace(/[{}$]/g, '')
       .replace(/~/g, ' ')
       .replace(/---/g, '—').replace(/--/g, '–')
       .replace(/\s+/g, ' ')
       .trim();
  return s;
}

/** Título del tema: parte anterior a \\, sin el prefijo "Tema X.Y.Z --". Devuelve {corto, completo} */
function tituloTema(texto) {
  const doc = texto.indexOf('\\begin{document}');
  const zona = doc >= 0 ? texto.slice(0, doc + 4000) : texto;
  const lineas = zona.split('\n').map(sinComentario).join('\n');
  const m = /\\title\s*\{/.exec(lineas);
  if (!m) return null;
  const [crudo] = entreLlaves(lineas, m.index + m[0].length - 1);
  const partes = crudo.split(/\\\\(\[[^\]]*\])?/).filter((p) => p !== undefined && !/^\[/.test(p));
  const quitarPrefijo = (s) => s.replace(/^\s*Tema\s+[0-9A-Za-z.]+\s*[-–—:]+\s*/, '');
  const corto = quitarPrefijo(limpiar(partes[0] || ''));
  const resto = partes.slice(1).map(limpiar).filter(Boolean).join(' ');
  return { corto: corto || null, completo: resto || null };
}

/** ¿Hay contenido real en este fragmento? (ignora órdenes de maquetación, etiquetas y espacios) */
function tieneContenido(fragmento) {
  const s = fragmento
    .replace(/\\(label|vspace|hspace|addcontentsline|phantomsection|clearpage|newpage|FloatBarrier|noindent|medskip|bigskip|smallskip|par)\b(\*?(\[[^\]]*\])?(\{[^{}]*\})*)/g, '')
    .replace(/\s+/g, '');
  return s.length > 0;
}

/**
 * Índice del tema: lista de nodos {nivel, numero, titulo, linea, vacio, hijos}
 * Solo lee lo que hay después de \begin{document}. Introducción = 1; anexos A1, A2…
 */
function indiceTema(texto) {
  const lineasOrig = texto.split('\n');
  const inicio = lineasOrig.findIndex((l) => /\\begin\{document\}/.test(sinComentario(l)));
  const desde = inicio >= 0 ? inicio + 1 : 0;
  const lineas = lineasOrig.map((l, i) => (i < desde ? '' : sinComentario(l)));
  const cuerpo = lineas.join('\n');
  // posición (carácter) de comienzo de cada línea, para traducir a número de línea
  const inicioLinea = [];
  let acc = 0;
  for (const l of lineas) { inicioLinea.push(acc); acc += l.length + 1; }
  const lineaDe = (pos) => {
    let lo = 0, hi = inicioLinea.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (inicioLinea[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo;
  };

  const rx = /\\(section|subsection|subsubsection|paragraph|anexo)(\*?)\s*(?=\{)/g;
  const encabezados = [];
  let m;
  while ((m = rx.exec(cuerpo))) {
    const [titulo, fin] = entreLlaves(cuerpo, rx.lastIndex);
    encabezados.push({ tipo: m[1], estrella: m[2] === '*', titulo: limpiar(titulo), pos: m.index, finTitulo: fin });
    rx.lastIndex = fin;
  }
  const finDoc = (() => { const k = cuerpo.search(/\\end\{document\}/); return k >= 0 ? k : cuerpo.length; })();

  // numeración y árbol
  const raiz = { hijos: [], nivel: 0 };
  const pila = [raiz];
  const cont = [0, 0, 0, 0, 0];
  let anexos = 0, enAnexos = false;
  encabezados.forEach((e, k) => {
    const sig = k + 1 < encabezados.length ? encabezados[k + 1].pos : finDoc;
    let nivel = NIVELES[e.tipo];
    let numero = '';
    if (e.tipo === 'anexo') {
      enAnexos = true; anexos++; numero = `A${anexos}`; cont[1] = cont[2] = cont[3] = cont[4] = 0;
    } else if (!e.estrella) {
      if (e.tipo === 'section') { if (enAnexos) enAnexos = false; cont[1]++; cont[2] = cont[3] = cont[4] = 0; }
      else if (e.tipo === 'subsection') { cont[2]++; cont[3] = cont[4] = 0; }
      else if (e.tipo === 'subsubsection') { cont[3]++; cont[4] = 0; }
      else cont[4]++;
      const base = enAnexos ? `A${anexos}` : String(cont[1]);
      numero = [base, cont[2], cont[3], cont[4]].slice(0, nivel).join('.'); // igual que LaTeX (secnumdepth 4)
      if (enAnexos) nivel += 1; // las subsecciones de un anexo cuelgan del anexo
    }
    const nodo = {
      nivel, numero, parrafo: e.tipo === 'paragraph', titulo: e.titulo || '(sin título)', linea: lineaDe(e.pos),
      propioVacio: !tieneContenido(cuerpo.slice(e.finTitulo, sig)), hijos: [],
    };
    while (pila.length > 1 && pila[pila.length - 1].nivel >= nivel) pila.pop();
    pila[pila.length - 1].hijos.push(nodo);
    pila.push(nodo);
  });

  const marcar = (n) => { n.hijos.forEach(marcar); n.vacio = n.propioVacio && n.hijos.every((h) => h.vacio); return n; };
  raiz.hijos.forEach(marcar);
  return raiz.hijos;
}

module.exports = { codigoTema, tituloTema, indiceTema, limpiar, sinComentario };
