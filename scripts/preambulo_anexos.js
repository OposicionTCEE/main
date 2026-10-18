#!/usr/bin/env node
// Bloque «Anexos» del preámbulo de los temas: anexos con estructura (un \anexo hace de \section; páginas I-1…; índice propio
// debajo de la introducción del anexo). Reglas: main/GUIA_TEMAS.md, §6.
//
//   node main/scripts/preambulo_anexos.js estado     → qué temas tienen ya el bloque nuevo y cuáles el antiguo
//   node main/scripts/preambulo_anexos.js aplicar    → sustituye el bloque antiguo por el nuevo, en su sitio (antes de «Lista de figuras (personal)»)
//
// Se ejecuta desde la carpeta TCEE. No aplicar sin el visto bueno del usuario. Solo toca el bloque si es el antiguo tal cual
// (salvo espacios); si un tema lo tiene cambiado, lo deja y lo dice. El texto de los temas no se toca.
'use strict';
const fs = require('fs');
const path = require('path');
const TEMARIO = process.env.TCEE_TEMARIO || path.join(path.resolve(__dirname, '..', '..'), 'temario');
const INICIO = '%-------------------------- Anexos -----------------------%';
const SIGUIENTE = '%-------------------------- Lista de figuras (personal)';
const ANTIGUO = String.raw`%-------------------------- Anexos -----------------------%
    \makeatletter
    \newcounter{anexo}
    \renewcommand{\theanexo}{\Roman{anexo}}
    \newcommand{\anexo}[1]{%
      \clearpage
      \phantomsection
      \refstepcounter{anexo}%
      \noindent\textbf{Anexo \theanexo.- }#1\par\medskip
      \addcontentsline{stc}{section}{Anexo \theanexo.- #1}%
    }
    \makeatother`;
const NUEVO = String.raw`%-------------------------- Anexos -----------------------%
    % \anexo{Título}: un anexo equivale a un \section (su título sale del mismo tamaño). Dentro se usan \subsection,
    % \subsubsection y \paragraph, nunca \section: se numeran I.1, I.1.1, I.1.1.1 y las páginas del anexo, I-1, I-2…
    % En el índice de contenido inicial solo figura el nombre del anexo. Sus apartados forman el índice del anexo, que sale
    % solo si el anexo los tiene, justo después de la introducción del anexo (antes del primer \subsection).
    % \anexo*{Título}: el mismo anexo, sin ese índice. Reglas: main/GUIA_TEMAS.md, §6.
    \makeatletter
    \newcounter{anexo}
    \renewcommand{\theanexo}{\Roman{anexo}}
    \newif\ifEnAnexo \EnAnexofalse
    \newif\ifanx@pendiente \anx@pendientefalse
    \newcommand{\anexo}{\@ifstar{\anx@empezar\anx@pendientefalse}{\anx@empezar\anx@pendientetrue}}
    \newcommand{\anx@empezar}[2]{%
      \clearpage
      \refstepcounter{anexo}%
      \global\EnAnexotrue
      \setcounter{page}{1}\gdef\thepage{\theanexo-\arabic{page}}%
      \setcounter{section}{\numexpr\value{anexo}-1\relax}\stepcounter{section}% el anexo hace de \section
      \gdef\thesection{\Roman{section}}\gdef\theHsection{anexo.\Roman{section}}%
      \phantomsection
      \protected@xdef\leq@current@section{Anexo \theanexo.- \unexpanded{#2}}\gdef\leq@current@subsection{}% índice de ecuaciones
      \addcontentsline{stc}{section}{Anexo \theanexo.- #2}%
      \addcontentsline{toc}{section}{Anexo \theanexo.- #2}% marcadores del PDF
      {\noindent\normalfont\Large\bfseries Anexo \theanexo.- #2\par}\nobreak\vspace{1.5ex \@plus .2ex}%
      #1\@ifundefined{anx@lista@\theanexo}{\global\anx@pendientefalse}{}%
    }
    % Índice del anexo: cada apartado escribe una línea en el fichero .atc (anexo, nivel, texto, página, enlace); al
    % empezar el documento se leen las de la compilación anterior y se guardan por anexo (dos pasadas, como cualquier índice).
    % En ese índice los apartados suben un nivel, porque el anexo hace de \section.
    \def\anx@entrada#1#2#3#4#5{\@ifundefined{anx@lista@#1}{\global\@namedef{anx@lista@#1}{}}{}%
      \expandafter\g@addto@macro\csname anx@lista@#1\endcsname{\contentsline{#2}{#3}{#4}{#5}}}
    \tcbuselibrary{breakable}
    \def\anx@indice{\ifanx@pendiente\global\anx@pendientefalse
        \begin{tcolorbox}[breakable, colback=white, colframe=black!35, title={Contenido del anexo}, fonttitle=\small\bfseries,
            before upper={\parindent=0pt\parskip=2pt}]
          \small
          % números más anchos que en el índice inicial (I.1, I.1.1, I.1.1.1; páginas I-1)
          \def\@pnumwidth{2.6em}\def\@tocrmarg{3.4em}%
          \def\l@section##1##2{\addpenalty\@secpenalty\addvspace{1.0em \@plus\p@}\setlength\@tempdima{2.6em}%
            \begingroup\parindent\z@\rightskip\@pnumwidth\parfillskip-\@pnumwidth\leavevmode\bfseries
            \advance\leftskip\@tempdima\hskip-\leftskip##1\nobreak\hfil\nobreak\hb@xt@\@pnumwidth{\hss##2\kern-\p@\kern\p@}\par\endgroup}%
          \def\l@subsection{\@dottedtocline{2}{2.6em}{3.2em}}\def\l@subsubsection{\@dottedtocline{3}{5.8em}{4.1em}}%
          \csname anx@lista@\theanexo\endcsname
        \end{tcolorbox}\par\medskip
      \fi}
    \def\anx@escribir#1#2#3{\ifEnAnexo
        \addtocontents{atc}{\protect\anx@entrada{\theanexo}{#2}{\protect\numberline{\csname the#1\endcsname}#3}{\thepage}{\@currentHref}}%
      \else\addcontentsline{stc}{#1}{\protect\numberline{\csname the#1\endcsname}#3}\fi}
    % Encabezados: dentro de un anexo escriben en su índice (y el primero saca antes ese índice); fuera, en el índice de contenido.
    % Se activan al empezar el documento, cuando ya están definidos los del índice propio (\MyTOC, más abajo).
    \def\anx@subsection[#1]#2{\ifEnAnexo\anx@indice\fi\MyTOC@orig@subsection[{#1}]{#2}\anx@escribir{subsection}{section}{#2}}
    \def\anx@subsubsection[#1]#2{\ifEnAnexo\anx@indice\fi\MyTOC@orig@subsubsection[{#1}]{#2}\anx@escribir{subsubsection}{subsection}{#2}}
    \def\anx@paragraph[#1]#2{\ifEnAnexo\anx@indice\fi\MyTOC@orig@paragraph[{#1}]{#2}\anx@escribir{paragraph}{subsubsection}{#2}}
    \AtBeginDocument{\@starttoc{atc}%
      \let\MyTOC@subsection@nostar\anx@subsection
      \let\MyTOC@subsubsection@nostar\anx@subsubsection
      \let\MyTOC@paragraph@nostar\anx@paragraph}
    \makeatother`;
const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
const temas = [];
for (const e of ls(TEMARIO).filter((x) => /^Ejercicio-/.test(x)))
  for (const p of ls(path.join(TEMARIO, e)).filter((x) => /^Parte-/.test(x)))
    for (const t of ls(path.join(TEMARIO, e, p))) { const f = path.join(TEMARIO, e, p, t, 'main.tex'); if (fs.existsSync(f)) temas.push([t, f]); }
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const orden = process.argv[2];
const nuevos = [], antiguos = [], raros = [];
let hechos = 0;
for (const [c, f] of temas) {
  const x = fs.readFileSync(f, 'utf8');
  const i = x.indexOf(INICIO), j = i < 0 ? -1 : x.indexOf('\\makeatother', i), k = i < 0 ? -1 : x.indexOf(SIGUIENTE, i);
  if (i < 0 || j < 0 || k < 0 || i > x.indexOf('\\begin{document}')) { raros.push(c); continue; }
  const fin = j + '\\makeatother'.length;
  const bloque = x.slice(i, fin);
  if (norm(bloque) === norm(NUEVO.slice(0, NUEVO.indexOf('\\makeatother') + 12))) { nuevos.push(c); continue; }
  if (norm(bloque) !== norm(ANTIGUO) || x.slice(fin, k).trim()) { raros.push(c); continue; }
  antiguos.push(c);
  if (orden === 'aplicar') { fs.writeFileSync(f, x.slice(0, i) + NUEVO + x.slice(fin)); hechos++; }
}
const lista = (a) => `${a.length}${a.length ? ` (${a.slice(0, 8).join(', ')}${a.length > 8 ? '…' : ''})` : ''}`;
if (orden === 'aplicar') console.log(`Bloque nuevo puesto en ${hechos} temas.${raros.length ? ` Sin tocar, por tener el bloque cambiado: ${lista(raros)}.` : ''}`);
else console.log(`Con el bloque nuevo: ${lista(nuevos)}. Con el antiguo: ${lista(antiguos)}. Distinto de los dos (no se toca): ${lista(raros)}.`);
