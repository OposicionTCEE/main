// Notas al pie (\footnote{…}) que se pueden contraer y expandir en el editor. Reglas: main/NOTAS.md
// VS Code solo contrae líneas enteras: se contraen las líneas del CONTENIDO de la nota, así que la nota tiene que estar
// escrita en varias líneas (\footnote{% ⏎ contenido ⏎ }). scripts/notas_pie.js pasa las notas antiguas a esa forma.
'use strict';

/** Posición del } que cierra la { de la posición i (llaves equilibradas; ignora \{ \} y los comentarios %) */
function cierre(t, i) {
  let p = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === '\\') { j++; continue; }
    if (c === '%') { const n = t.indexOf('\n', j); if (n < 0) return -1; j = n; continue; }
    if (c === '{') p++; else if (c === '}' && --p === 0) return j;
  }
  return -1;
}

/** Notas al pie del cuerpo del documento: {inicio, llave, fin} (desplazamientos de «\footnote», «{» y «}»). Las anidadas en otra nota no cuentan */
function notas(texto) {
  const doc = texto.indexOf('\\begin{document}');
  const rx = /\\footnote\s*(?:\[[^\]]*\])?\s*\{/g; rx.lastIndex = doc < 0 ? 0 : doc;
  const v = []; let m;
  while ((m = rx.exec(texto))) {
    // en un comentario no cuenta
    const ini = texto.lastIndexOf('\n', m.index) + 1;
    if (/(^|[^\\])%/.test(texto.slice(ini, m.index))) continue;
    const llave = m.index + m[0].length - 1, fin = cierre(texto, llave);
    if (fin < 0) continue;
    v.push({ inicio: m.index, llave, fin });
    rx.lastIndex = fin;
  }
  return v;
}

/** Número de línea (desde 0) de cada desplazamiento, con una tabla de inicios de línea */
function lineador(texto) {
  const ini = [0];
  for (let i = 0; i < texto.length; i++) if (texto[i] === '\n') ini.push(i + 1);
  return (off) => { let a = 0, b = ini.length - 1; while (a < b) { const c = (a + b + 1) >> 1; if (ini[c] <= off) a = c; else b = c - 1; } return a; };
}

/**
 * Tramos de líneas que se pueden contraer: {inicio, fin} (líneas desde 0). Se queda visible la línea del \footnote
 * y, si el } va solo al principio de su línea, también esa (con lo que siga detrás). Si el } va al final de una línea
 * sin nada detrás, esa línea también se contrae. Las notas de una sola línea no se pueden contraer.
 */
function tramos(texto) {
  const linea = lineador(texto), v = [];
  for (const n of notas(texto)) {
    const a = linea(n.inicio), lc = linea(n.fin);
    if (lc === a) continue;
    const iniLc = texto.lastIndexOf('\n', n.fin) + 1, finLc = texto.indexOf('\n', n.fin);
    const antes = texto.slice(iniLc, n.fin), despues = texto.slice(n.fin + 1, finLc < 0 ? texto.length : finLc);
    let b;
    if (!antes.trim()) b = lc - 1;                       // } solo al principio de la línea: se deja visible
    else if (/^\s*(%.*)?$/.test(despues)) b = lc;        // } al final, sin nada detrás: se contrae con el resto
    else b = lc - 1;                                     // hay texto detrás del }: esa línea se deja visible
    if (b > a) v.push({ inicio: a, fin: b });
  }
  return v;
}

/**
 * Texto con las notas largas reescritas en varias líneas para poder contraerlas:
 *   texto.\footnote{Contenido largo…} resto   →   texto.\footnote{% ⏎ <sangría>    Contenido largo…% ⏎ <sangría>} resto
 * Los % hacen que LaTeX no vea los saltos de línea añadidos: el PDF sale igual.
 * Devuelve {texto, cambios: [{linea, añadidas}]} (línea original desde 0 tras la que se añaden líneas), para recolocar referencias a líneas.
 */
function reescribir(texto, minimo = 80) {
  const linea = lineador(texto);
  const cambios = []; let out = '', ult = 0;
  for (const n of notas(texto)) {
    const contenido = texto.slice(n.llave + 1, n.fin);
    if (contenido.replace(/\s+/g, ' ').trim().length < minimo) continue;
    // ya está en forma de bloque: { seguido solo de % o fin de línea, y } solo al principio de su línea
    const primera = texto.slice(n.llave + 1, (texto.indexOf('\n', n.llave) + 1 || texto.length + 1) - 1);
    const iniLc = texto.lastIndexOf('\n', n.fin) + 1;
    const yaAbre = /^\s*%?\s*$/.test(primera), yaCierra = !texto.slice(iniLc, n.fin).trim();
    if (yaAbre && yaCierra) continue;
    const c = contenido.replace(/^[ \t]*%?[ \t]*\n/, '').replace(/^[ \t]+/, '').replace(/\s+$/, '');
    // casos raros que no se tocan: termina en \ (un «\ » perdería el espacio) o en un comentario sin cerrar
    if (/\\$/.test(c)) continue;
    if (/^\s*%?[ \t]*\n[ \t]*\n/.test(contenido)) continue;   // empieza con una línea en blanco (cambio de párrafo): no se toca
    const lineaIni = texto.slice(texto.lastIndexOf('\n', n.inicio) + 1, n.inicio);
    const sangria = (lineaIni.match(/^[ \t]*/) || [''])[0];
    const ultimaLinea = c.slice(c.lastIndexOf('\n') + 1);
    const terminaEnComentario = /(^|[^\\])%/.test(ultimaLinea);
    // una línea en blanco al final de la nota es un cambio de párrafo (deja un poco de espacio en el PDF): se conserva
    const cola = (contenido.match(/\s*$/) || [''])[0];
    const parrafoFinal = /\n[ \t]*\n/.test(cola);
    const nuevo = `{%\n${sangria}    ${c}${parrafoFinal ? '\n\n' : terminaEnComentario ? '\n' + sangria + '    %\n' : '%\n'}${sangria}}`;
    out += texto.slice(ult, n.llave) + nuevo; ult = n.fin + 1;
    const viejas = (texto.slice(n.llave, n.fin + 1).match(/\n/g) || []).length, nuevas = (nuevo.match(/\n/g) || []).length;
    if (nuevas !== viejas) cambios.push({ linea: linea(n.fin), anadidas: nuevas - viejas, desde: linea(n.llave) });
  }
  out += texto.slice(ult);
  return { texto: out, cambios };
}

/** Nueva línea (desde 1) de una línea antigua (desde 1) tras reescribir */
function recolocar(lineaAntigua, cambios) {
  let d = 0;
  for (const c of cambios) if (c.linea < lineaAntigua - 1) d += c.anadidas; else if (c.desde < lineaAntigua - 1) d += Math.max(0, Math.min(c.anadidas, lineaAntigua - 1 - c.desde));
  return lineaAntigua + d;
}

module.exports = { notas, tramos, reescribir, recolocar, cierre };
