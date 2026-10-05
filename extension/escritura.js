// Ayudas de escritura en los .tex: negrita/cursiva/resaltado que «salen» del grupo, mayúsculas sin romper órdenes,
// $ automático y paleta de \textcolor. Reglas: main/ESCRITURA.md
'use strict';
const fs = require('fs');
const path = require('path');

/** ¿El carácter de la posición i está escapado con \ ? (número impar de barras delante) */
function escapado(t, i) { let n = 0; while (i - 1 - n >= 0 && t[i - 1 - n] === '\\') n++; return n % 2 === 1; }

/** Posición del } que cierra la { de la posición i, o -1 */
function cierre(t, i) {
  let p = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === '\\') { j++; continue; }
    if (c === '{') p++; else if (c === '}' && --p === 0) return j;
  }
  return -1;
}

/**
 * Grupo \macro{…} (o cualquiera de las macros de la lista) que contiene el tramo [ini, fin] dentro de su contenido.
 * Devuelve {orden, inicio, abre, cierra} (inicio = la «\», abre = «{», cierra = «}») del más cercano, o null.
 */
function grupoQueRodea(t, ini, fin, macros) {
  const nombres = Array.isArray(macros) ? macros : [macros];
  let prof = 0;
  for (let j = ini - 1; j >= 0; j--) {
    const c = t[j];
    if ((c !== '{' && c !== '}') || escapado(t, j)) continue;
    if (c === '}') { prof++; continue; }
    if (prof > 0) { prof--; continue; }
    // { sin cerrar antes de ini: ¿de qué orden es?
    const antes = t.slice(Math.max(0, j - 40), j).match(/\\([A-Za-z]+)\s*$/);
    const cierra = cierre(t, j);
    if (cierra < 0 || cierra < fin) continue;
    if (antes && nombres.includes(antes[1])) return { orden: antes[1], inicio: j - antes[0].length, abre: j, cierra };
    if (/\n\s*\n/.test(t.slice(j, ini))) return null;   // no se busca más allá de un cambio de párrafo
  }
  return null;
}

/** ¿Llaves equilibradas? (para no partir un grupo por la mitad) */
function equilibrado(s) {
  let p = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '{') p++; else if (s[i] === '}' && --p < 0) return false;
  }
  return p === 0;
}

// órdenes cuyo primer argumento no es texto (referencias, colores, ficheros, entornos…): no se pasa a mayúsculas
const ARG_NO_TEXTO = new Set(['ref', 'eqref', 'label', 'cite', 'citep', 'citet', 'pageref', 'url', 'href', 'textcolor', 'color', 'colorbox',
  'begin', 'end', 'includegraphics', 'imagenfit', 'input', 'include', 'hspace', 'vspace', 'setlength', 'rule', 'sethlcolor', 'hyperref']);

/** Pasa a mayúsculas el texto, sin tocar las órdenes, sus argumentos no textuales, las fórmulas ni los comentarios */
function mayusculas(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\\') {
      const m = s.slice(i).match(/^\\([A-Za-z]+\*?|.)/);
      if (!m) { out += c; i++; continue; }
      // \( … \) y \[ … \]: fórmula, tal cual
      if (m[1] === '(' || m[1] === '[') {
        const ce = m[1] === '(' ? '\\)' : '\\]', j = s.indexOf(ce, i + 2);
        const f = j < 0 ? s.length : j + 2; out += s.slice(i, f); i = f; continue;
      }
      out += m[0]; i += m[0].length;
      if (ARG_NO_TEXTO.has(m[1].replace('*', ''))) {
        // opcional [..] y primer argumento {..}, tal cual
        const r = s.slice(i).match(/^\s*(\[[^\]]*\])?\s*/); out += r[0]; i += r[0].length;
        if (s[i] === '{') { const k = cierre(s, i); const f = k < 0 ? s.length : k + 1; out += s.slice(i, f); i = f; }
      }
      continue;
    }
    if (c === '$') {
      const doble = s[i + 1] === '$', ab = doble ? '$$' : '$';
      let j = i + ab.length;
      while (j < s.length && !(s.startsWith(ab, j) && !escapado(s, j))) j++;
      const f = Math.min(s.length, j + ab.length); out += s.slice(i, f); i = f; continue;
    }
    if (c === '%') { const j = s.indexOf('\n', i); const f = j < 0 ? s.length : j; out += s.slice(i, f); i = f; continue; }
    out += c.toLocaleUpperCase('es'); i++;
  }
  return out;
}

/**
 * Qué hacer al pulsar $ (sin selección): 'saltar' (ya hay un $ delante: se pasa por encima), 'uno' (se escribe solo uno:
 * hay texto pegado o es \$) o 'par' ($|$ con el cursor en medio).
 */
function dolar(antes, despues) {
  if (antes === '\\') return 'uno';
  if (despues === '$' && antes && !/\s/.test(antes)) return 'saltar';
  const pegadoAntes = antes && !/[\s({\[~]/.test(antes);
  const pegadoDespues = despues && !/[\s)}\].,;:!?]/.test(despues);
  return pegadoAntes || pegadoDespues ? 'uno' : 'par';
}

/** Paleta de colores con significado (config/colores.json) */
function paleta(raiz) {
  try { return JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'colores.json'), 'utf8')).colores || []; } catch (e) { return []; }
}

// colores que xcolor conoce sin opciones (los de \textcolor{…} que compilan en este temario)
const XCOLOR = {
  red: '#ff0000', green: '#00ff00', blue: '#0000ff', cyan: '#00ffff', magenta: '#ff00ff', yellow: '#ffff00', black: '#000000', white: '#ffffff',
  gray: '#808080', darkgray: '#404040', lightgray: '#bfbfbf', brown: '#bf8040', lime: '#bfff00', olive: '#808000', orange: '#ff8000',
  pink: '#ffbfbf', purple: '#bf0040', teal: '#008080', violet: '#800080',
};

module.exports = { grupoQueRodea, equilibrado, mayusculas, dolar, paleta, XCOLOR, cierre, escapado };
