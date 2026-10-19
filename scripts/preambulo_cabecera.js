#!/usr/bin/env node
// Bloque «Cabecera» del preámbulo de los temas: el título completo del tema arriba de las páginas numeradas (de la Introducción a
// la Conclusión). Reglas: main/GUIA_TEMAS.md, §4.
//
//   node main/scripts/preambulo_cabecera.js estado     → qué temas tienen ya el bloque
//   node main/scripts/preambulo_cabecera.js aplicar    → lo añade justo antes de «Lista de figuras (personal)» (detrás de «Anexos») donde falte
//
// Se ejecuta desde la carpeta TCEE. No aplicar sin el visto bueno del usuario. Si un tema ya tiene un bloque «Cabecera» distinto,
// lo deja y lo dice. El texto de los temas no se toca.
'use strict';
const fs = require('fs');
const path = require('path');
const TEMARIO = process.env.TCEE_TEMARIO || path.join(path.resolve(__dirname, '..', '..'), 'temario');
const MARCA = /^[ \t]*%-+ Lista de figuras \(personal\)/gm;   // con o sin sangría (en 3.A.3, 3.A.23 y 3.A.26 cambia)
const INICIO = '%-------------------------- Cabecera -----------------------%';
const BLOQUE = String.raw`    %-------------------------- Cabecera -----------------------%
    % En las páginas numeradas del tema (de la Introducción a la Conclusión), arriba, el título completo del tema tal como está en
    % \title, sin «Tema X.Y.N --»: título y subtítulo seguidos. En letra pequeña; más pequeña aún si no cabe en dos líneas. Va en el
    % margen superior, así que no cambia las páginas del tema. Se enciende con \pagenumbering{arabic} y se apaga con
    % \pagenumbering{gobble} (bibliografía): índices, bibliografía y anexos quedan sin cabecera. Reglas: main/GUIA_TEMAS.md, §4.
    \usepackage{fancyhdr}
    \geometry{headheight=28pt}% hasta tres líneas de letra pequeña
    \ExplSyntaxOn
    \tl_new:N \g_cab_titulo_tl
    \cs_new_protected:Npn \cab_guardar:n #1
      {
        \tl_gset:Nn \g_cab_titulo_tl {#1}
        \regex_replace_once:nnN { \A \s* Tema \s+ \S+ \s* \-\-? \s* } { } \g_cab_titulo_tl % sin «Tema X.Y.N --»
        \regex_replace_once:nnN { \.? \s* \c{\\} (\[ [^\]]* \])? \s* (\c{large} \s*)? } { .\  } \g_cab_titulo_tl % título. subtítulo
        \regex_replace_once:nnN { [\.\s]* \Z } { } \g_cab_titulo_tl % sin subtítulo: nada detrás
      }
    \cs_new_eq:NN \cabGuardarTitulo \cab_guardar:n
    \cs_new:Npn \cabTitulo { \tl_use:N \g_cab_titulo_tl }
    \ExplSyntaxOff
    \makeatletter
    \let\cab@title\title
    \renewcommand{\title}[1]{\cab@title{#1}\cabGuardarTitulo{#1}}
    \newcommand{\cab@letra}{\footnotesize}
    \AtBeginDocument{% si en letra pequeña ocupa más de dos líneas, una talla menos
      \settowidth{\dimen@}{\footnotesize\itshape\cabTitulo}%
      \ifdim\dimen@>1.9\textwidth \renewcommand{\cab@letra}{\scriptsize}\fi}
    \fancypagestyle{tema}{%
      \fancyhf{}%
      \fancyhead[L]{\parbox[b]{\textwidth}{\raggedright\cab@letra\itshape\color{black!65}\cabTitulo}}%
      \fancyfoot[C]{\thepage}%
      \renewcommand{\headrulewidth}{0.4pt}}
    \apptocmd{\pagenumbering}{\ifnum\pdfstrcmp{#1}{arabic}=0 \pagestyle{tema}\else\pagestyle{plain}\fi}{}{}
    \makeatother

`;
const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
const temas = [];
for (const e of ls(TEMARIO).filter((x) => /^Ejercicio-/.test(x)))
  for (const p of ls(path.join(TEMARIO, e)).filter((x) => /^Parte-/.test(x)))
    for (const t of ls(path.join(TEMARIO, e, p))) { const f = path.join(TEMARIO, e, p, t, 'main.tex'); if (fs.existsSync(f)) temas.push([t, f]); }
const orden = process.argv[2];
const con = [], sin = [], raros = [];
let hechos = 0;
for (const [c, f] of temas) {
  const x = fs.readFileSync(f, 'utf8');
  const doc = x.indexOf('\\begin{document}'), i = x.indexOf(INICIO), ms = [...x.matchAll(MARCA)], k = ms.length ? ms[0].index : -1;
  if (i >= 0 && i < doc) { (x.includes(BLOQUE) ? con : raros).push(c); continue; }
  if (ms.length !== 1 || k > doc) { raros.push(c); continue; }
  sin.push(c);
  if (orden === 'aplicar') { fs.writeFileSync(f, x.slice(0, k) + BLOQUE + x.slice(k)); hechos++; }
}
const lista = (a) => `${a.length}${a.length ? ` (${a.slice(0, 8).join(', ')}${a.length > 8 ? '…' : ''})` : ''}`;
if (orden === 'aplicar') console.log(`Cabecera puesta en ${hechos} temas.${raros.length ? ` Sin tocar: ${lista(raros)}.` : ''}`);
else console.log(`Con la cabecera: ${lista(con)}. Sin ella: ${lista(sin)}. Distinto (no se toca): ${lista(raros)}.`);
