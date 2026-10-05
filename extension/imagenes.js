// Vista previa de imágenes en los .tex al pasar el ratón (\imagenfit{Fig1.png}{…}{…}, \includegraphics{…}).
// La ventanita de VS Code no admite más de ~100.000 caracteres y la imagen va incrustada en ese texto,
// así que se reduce primero con «sips» (viene con macOS). Reglas: main/FORMULAS.md, apartado «Imágenes».
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFile } = require('child_process');

const EXT = ['.png', '.jpg', '.jpeg', '.pdf'];
const LIMITE = 90000;   // caracteres en base64 que caben con holgura en la ventanita

/**
 * Referencia a una imagen en la línea de la posición: {orden, nombre, inicio, fin} o null.
 * Vale \includegraphics[…]{x}, cualquier orden de imagen del preámbulo (\imagenfit…) y cualquier {fichero.png}.
 */
function localizar(texto, off) {
  const ini = texto.lastIndexOf('\n', off - 1) + 1, f = texto.indexOf('\n', off), fin = f < 0 ? texto.length : f;
  const linea = texto.slice(ini, fin);
  if (/^\s*%/.test(linea)) return null;
  const rx = /(?:\\([A-Za-z]+)\s*(?:\[[^\]]*\])?\s*)?\{([^{}#\\%$]+?)\}/g; let m;
  const hallados = [];
  while ((m = rx.exec(linea))) {
    const orden = m[1] || '', nombre = m[2].trim();
    const pareceImagen = /\.(png|jpe?g|pdf)$/i.test(nombre) || /graphics|^ima?ge?n|^fig/i.test(orden);
    if (['href', 'url', 'hyperlink', 'cite'].includes(orden) || nombre.includes('://')) continue;
    if (pareceImagen && !/\s{2}/.test(nombre) && nombre.length < 150) hallados.push({ orden, nombre, inicio: ini + m.index, fin: ini + m.index + m[0].length });
  }
  if (!hallados.length) return null;
  // la más cercana al cursor; la ventanita abarca toda la línea (también el pie y la fuente)
  const r = hallados.find((h) => off >= h.inicio && off <= h.fin) || hallados[0];
  return { ...r, inicioLinea: ini, finLinea: fin };
}

/** ¿Está definida la orden en el preámbulo (o es de LaTeX)? Sirve para avisar de erratas como \imagenit */
function ordenDefinida(texto, orden) {
  if (!orden || ['includegraphics', 'pgfimage'].includes(orden)) return true;
  const fin = texto.indexOf('\\begin{document}');
  const pre = fin > 0 ? texto.slice(0, fin) : texto;
  return new RegExp(`\\\\(?:(?:re|provide)?newcommand\\*?|(?:New|Renew|Provide|Declare)DocumentCommand)\\s*\\{?\\s*\\\\${orden}(?![A-Za-z])|\\\\def\\s*\\\\${orden}(?![A-Za-z])`).test(pre);
}

/** Órdenes de imagen definidas en el preámbulo (para sugerir la buena cuando hay una errata) */
function ordenesDeImagen(texto) {
  const fin = texto.indexOf('\\begin{document}');
  const pre = fin > 0 ? texto.slice(0, fin) : '';
  const v = new Set(); const rx = /\\(?:newcommand\*?|(?:New|Renew)DocumentCommand)\s*\{?\s*\\([A-Za-z]+)/g; let m;
  while ((m = rx.exec(pre))) if (/^ima?ge?n|^fig/i.test(m[1])) v.add(m[1]);
  return [...v];
}

/** Distancia de edición (para sugerir el nombre parecido) */
function distancia(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Fichero de la imagen: {fichero} o {error} explicando qué falla. Busca en Img/ y en la carpeta del tema, sin distinguir mayúsculas (como el Mac) */
function resolver(dirTema, nombre) {
  const carpetas = [path.join(dirTema, 'Img'), dirTema].filter((d) => fs.existsSync(d));
  const tieneExt = EXT.includes(path.extname(nombre).toLowerCase());
  const candidatos = tieneExt ? [nombre] : EXT.map((e) => nombre + e);
  for (const d of carpetas) {
    let lista; try { lista = fs.readdirSync(d); } catch (e) { continue; }
    const sub = path.dirname(nombre) === '.' ? '' : path.dirname(nombre);
    for (const c of candidatos) {
      const directo = path.join(d, c);
      if (fs.existsSync(directo) && fs.statSync(directo).isFile()) return { fichero: directo };
      if (!sub) { const igual = lista.find((x) => x.toLowerCase() === c.toLowerCase()); if (igual) return { fichero: path.join(d, igual) }; }
    }
  }
  // no está: se busca lo más parecido para que el error diga qué hacer
  const todas = carpetas.flatMap((d) => { try { return fs.readdirSync(d).filter((x) => EXT.includes(path.extname(x).toLowerCase())); } catch (e) { return []; } });
  const base = path.basename(nombre, path.extname(nombre)).toLowerCase();
  const otraExt = todas.find((x) => path.basename(x, path.extname(x)).toLowerCase() === base);
  if (otraExt) return { error: `No existe «${nombre}», pero sí «${otraExt}»: cambia la extensión en el .tex. Con este nombre la imagen tampoco sale en el PDF.` };
  // ¿está en la carpeta Img de otro tema? (pasa al copiar epígrafes de un tema a otro)
  const enOtro = buscarEnOtrosTemas(dirTema, path.basename(nombre));
  if (enOtro) return { error: `No existe «${nombre}» en la carpeta Img de este tema, pero sí en la del tema ${enOtro}: cópiala a la carpeta Img de este tema. Mientras tanto la imagen no sale en el PDF.` };
  const parecidas = todas.map((x) => [x, distancia(x, path.basename(nombre))]).sort((a, b) => a[1] - b[1]).filter((x) => x[1] <= Math.max(3, base.length / 3)).slice(0, 3).map((x) => `«${x[0]}»`);
  return {
    error: `No existe «${nombre}» en la carpeta Img del tema. Con este nombre la imagen tampoco sale en el PDF.`
      + (parecidas.length ? ` ¿Querías decir ${parecidas.join(', ')}?` : todas.length ? '' : ' La carpeta Img está vacía o no existe.'),
  };
}

/** Tema (p. ej. «3.A.29») en cuya carpeta Img está el fichero, o null. Estructura: temario/Ejercicio-N/Parte-X/<tema>/Img */
function buscarEnOtrosTemas(dirTema, fichero) {
  const raiz = path.resolve(dirTema, '..', '..', '..'), buscado = fichero.toLowerCase();
  const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
  for (const ej of ls(raiz).filter((x) => /^Ejercicio-/.test(x)))
    for (const pa of ls(path.join(raiz, ej)).filter((x) => /^Parte-/.test(x)))
      for (const t of ls(path.join(raiz, ej, pa))) {
        const d = path.join(raiz, ej, pa, t);
        if (d !== path.resolve(dirTema) && ls(path.join(d, 'Img')).some((x) => x.toLowerCase() === buscado)) return t;
      }
  return null;
}

const sips =(args) => new Promise((ok, mal) => execFile('/usr/bin/sips', args, { timeout: 15000 }, (e, so) => (e ? mal(e) : ok(String(so)))));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/**
 * Imagen lista para la ventanita: {uri, ancho} (data: que cabe en el límite) o {fichero} si no se ha podido reducir.
 * dirCache: carpeta donde guardar las versiones reducidas (se reutilizan mientras no cambie la imagen).
 */
async function miniatura(fichero, dirCache) {
  const st = fs.statSync(fichero), ext = path.extname(fichero).toLowerCase();
  const directa = () => `data:${MIME[ext]};base64,${fs.readFileSync(fichero).toString('base64')}`;
  if (ext !== '.pdf' && st.size * 4 / 3 < LIMITE) return { uri: directa() };
  if (!fs.existsSync('/usr/bin/sips')) return { fichero };   // fuera del Mac: sin reducir
  fs.mkdirSync(dirCache, { recursive: true });
  const huella = crypto.createHash('sha1').update(`${fichero}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 16);
  const hecho = fs.readdirSync(dirCache).find((x) => x.startsWith(huella));
  if (hecho) { const b = fs.readFileSync(path.join(dirCache, hecho)); return { uri: `data:${MIME[path.extname(hecho)]};base64,${b.toString('base64')}` }; }
  // con transparencia se queda en PNG (al pasar a JPEG el fondo transparente sale negro); sin ella, JPEG, que ocupa mucho menos
  let alfa = true;
  try { alfa = /hasAlpha:\s*yes/.test(await sips(['-g', 'hasAlpha', fichero])); } catch (e) { /* se supone que sí */ }
  const tmp = path.join(dirCache, `${huella}.tmp${alfa ? '.png' : '.jpg'}`);
  for (const lado of [700, 520, 380, 260]) {
    const args = ['-Z', String(lado), '-s', 'format', alfa ? 'png' : 'jpeg'];
    if (!alfa) args.push('-s', 'formatOptions', '75');
    try { await sips([...args, fichero, '--out', tmp]); } catch (e) { break; }
    const b = fs.readFileSync(tmp);
    if (b.length * 4 / 3 < LIMITE) {
      const final = path.join(dirCache, `${huella}${alfa ? '.png' : '.jpg'}`);
      fs.renameSync(tmp, final);
      limpiar(dirCache);
      return { uri: `data:${alfa ? 'image/png' : 'image/jpeg'};base64,${b.toString('base64')}` };
    }
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* no existía */ }
  return { fichero };
}

/** Como mucho 400 miniaturas guardadas: se borran las más antiguas */
function limpiar(d) {
  try {
    const v = fs.readdirSync(d).map((x) => [x, fs.statSync(path.join(d, x)).mtimeMs]).sort((a, b) => a[1] - b[1]);
    if (v.length > 400) v.slice(0, v.length - 300).forEach(([x]) => fs.unlinkSync(path.join(d, x)));
  } catch (e) { /* limpieza opcional */ }
}

module.exports = { localizar, ordenDefinida, ordenesDeImagen, resolver, miniatura, distancia };
