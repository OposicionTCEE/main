# Estado de compilación de los temas

Prueba realizada el 02/10/2026 compilando los 107 temas que había entonces (4.B.3, 4.B.18 y 4.B.22, incorporados el 03/10, no están incluidos) con la misma receta que usará VS Code (`latexmk -pdf -f`, que genera el PDF aunque haya errores, igual que Overleaf).

> [Probable] En tu Mac (MacTeX 2026) el recuento puede variar algo: la prueba se hizo con TeX Live 2023. Los 6 fallos graves son errores del texto, no del programa, y fallarán igual.

## No generan PDF (6) — hay que corregirlos antes de dejar Overleaf

| Tema | Causa |
|---|---|
| 3.A.9 | Línea ~640: llave sin cerrar dentro de \underset; además caracteres  (viñeta pegada desde Word). |
| 3.B.13 | Nota al pie (\footnote) sin cerrar: el fichero termina dentro de ella. |
| 3.B.18 | Línea 573: llave `}` sobrante. |
| 3.B.43 | Nota al pie (\footnote) sin cerrar: el fichero termina dentro de ella. |
| 4.B.15 | Texto pegado en formato Markdown (`##` títulos, `**negritas**`, etiquetas [Seguro]/[Probable]) a partir de la línea ~1130; caracteres corruptos (U+FFFD) en la línea 542 y llaves descompensadas hacia las líneas 690–703. |
| 4.B.25 | Línea 558 y siguientes: texto pegado en formato Markdown (`### Introducción`, etc.); el `#` rompe LaTeX y arrastra una nota al pie sin cerrar. |

## Generan PDF pero con avisos de error

La mayoría son caracteres que pdfLaTeX no reconoce (▲, viñetas pegadas desde Word, símbolos raros), `#` o `$` sueltos y llaves descompensadas. El PDF sale, pero ese fragmento puede verse mal.

| Tema | Nº de errores |
|---|---|
| 3.A.1 | 7 |
| 3.A.2 | 35 |
| 3.A.3 | 2 |
| 3.A.4 | 5 |
| 3.A.5 | 3 |
| 3.A.7 | 2 |
| 3.A.8 | 239 |
| 3.A.10 | 18 |
| 3.A.11 | 15 |
| 3.A.12 | 4 |
| 3.A.13 | 16 |
| 3.A.15 | 3 |
| 3.A.16 | 19 |
| 3.A.17 | 1 |
| 3.A.18 | 33 |
| 3.A.19 | 28 |
| 3.A.20 | 22 |
| 3.A.21 | 45 |
| 3.A.22 | 17 |
| 3.A.23 | 238 |
| 3.A.24 | 1 |
| 3.A.25 | 3 |
| 3.A.26 | 1 |
| 3.A.28 | 9 |
| 3.A.29 | 13 |
| 3.A.30 | 4 |
| 3.A.31 | 3 |
| 3.A.32 | 4 |
| 3.A.33 | 6 |
| 3.A.34 | 3 |
| 3.A.35 | 1 |
| 3.A.37 | 10 |
| 3.A.38 | 6 |
| 3.A.39 | 12 |
| 3.A.41 | 7 |
| 3.A.42 | 48 |
| 3.A.43 | 6 |
| 3.A.44 | 17 |
| 3.A.45 | 2 |
| 3.B.2 | 4 |
| 3.B.3 | 16 |
| 3.B.5 | 7 |
| 3.B.6 | 6 |
| 3.B.7 | 10 |
| 3.B.8 | 4 |
| 3.B.9 | 7 |
| 3.B.10 | 6 |
| 3.B.12 | 4 |
| 3.B.14 | 15 |
| 3.B.15 | 14 |
| 3.B.16 | 7 |
| 3.B.17 | 2 |
| 3.B.19 | 7 |
| 3.B.20 | 22 |
| 3.B.21 | 3 |
| 3.B.22 | 2 |
| 3.B.23 | 37 |
| 3.B.24 | 16 |
| 3.B.25 | 1 |
| 3.B.26 | 14 |
| 3.B.27 | 226 |
| 3.B.28 | 2 |
| 3.B.29 | 7 |
| 3.B.30 | 6 |
| 3.B.31 | 13 |
| 3.B.32 | 7 |
| 3.B.33 | 8 |
| 3.B.34 | 3 |
| 3.B.35 | 34 |
| 3.B.36 | 18 |
| 3.B.37 | 62 |
| 3.B.38 | 1 |
| 3.B.40 | 10 |
| 3.B.42 | 25 |
| 3.B.44 | 13 |
| 4.B.7 | 28 |
| 4.B.8 | 206 |
| 4.B.9 | 240 |
| 4.B.10 | 119 |
| 4.B.11 | 88 |
| 4.B.12 | 44 |
| 4.B.13 | 50 |
| 4.B.14 | 221 |
| 4.B.16 | 3 |
| 4.B.17 | 94 |
| 4.B.19 | 29 |
| 4.B.20 | 107 |
| 4.B.21 | 34 |
| 4.B.23 | 156 |
| 4.B.24 | 262 |

## Sin ningún error (11)

3.A.6, 3.A.27, 3.A.36, 3.A.40, 3.B.1, 3.B.4, 3.B.11, 3.B.39, 3.B.41, 3.B.45, 4.B.26
