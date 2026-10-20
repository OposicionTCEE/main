#!/usr/bin/env python3
"""Mide las páginas de TEXTO del cuerpo de un tema: sin figuras ni notas al pie.

Sirve cuando el usuario fija un tope de páginas de texto (por ejemplo, 19-20 en el 3.B.3, 20/10/2026), porque la
compilación normal cuenta también figuras y notas. Crea una copia de main.tex en una carpeta temporal con \\footnote,
\\imagenfit e \\imagenfithorizontal anulados, la compila dos veces y escribe:
  - la página en que empieza cada bloque y apartado (del índice .stc);
  - las páginas de texto de cada bloque, contando la última página por la fracción de líneas que ocupa
    (si está disponible `swift`, con pdf_lineas_por_pagina.swift de esta misma carpeta).
Si el tema tiene material pendiente en una nota magenta que empieza por «MATERIAL PENDIENTE», le pone un \\clearpage
delante para que no se mezcle con el texto ya redactado.

Uso, desde la carpeta TCEE:  python3 main/herramientas/medir_paginas_texto.py temario/Ejercicio-3/Parte-B/3.B.3
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
LINEAS_PAGINA_LLENA = 50  # líneas de una página de texto llena en la plantilla de los temas (cabecera incluida)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    tema = os.path.abspath(sys.argv[1])
    s = open(os.path.join(tema, "main.tex"), encoding="utf-8").read()
    s = s.replace("\\begin{document}", "\\begin{document}\n\\renewcommand{\\footnote}[1]{}"
                  "\\renewcommand{\\imagenfit}[4][]{}\\renewcommand{\\imagenfithorizontal}[3]{}", 1)
    s = s.replace("\\textcolor{magenta}{MATERIAL PENDIENTE", "\\clearpage\\textcolor{magenta}{MATERIAL PENDIENTE", 1)
    s = s.replace("\\graphicspath{{Img/}}", "\\graphicspath{{" + os.path.join(tema, "Img") + "/}}")
    tmp = tempfile.mkdtemp(prefix="medida_")
    open(os.path.join(tmp, "medida.tex"), "w", encoding="utf-8").write(s)
    for _ in range(2):
        subprocess.run(["/Library/TeX/texbin/pdflatex", "-interaction=nonstopmode", "medida.tex"], cwd=tmp,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    stc = open(os.path.join(tmp, "medida.stc"), encoding="utf-8", errors="ignore").read()
    entradas = re.findall(r"\\contentsline \{(section|subsection)\}\{\\numberline \{([0-9.]+)\}(.*?)\}\{(\d+)\}", stc)
    for nivel, num, titulo, pag in entradas:
        print(f"{pag:>4}  {'' if nivel == 'section' else '  '}{num:6s} {titulo[:80]}")
    pdf = os.path.join(tmp, "medida.pdf")
    print("\nPDF de medida:", pdf)

    # Páginas de texto por bloque (de cada \section a la siguiente; sin Introducción ni Conclusión).
    if not shutil.which("swift"):
        return
    salida = subprocess.run(["swift", os.path.join(AQUI, "pdf_lineas_por_pagina.swift"), pdf],
                            capture_output=True, text=True).stdout
    lineas = {}
    for fila in salida.splitlines():
        partes = fila.split("\t")
        if len(partes) >= 3 and partes[1].isdigit():
            lineas[int(partes[1])] = int(partes[2])
    secciones = [(t, int(p)) for n, _, t, p in entradas if n == "section"]
    print("\nPáginas de texto por bloque (la última, por su fracción de líneas):")
    total = 0.0
    for (titulo, ini), (_, sig) in zip(secciones, secciones[1:]):
        if re.match(r"(Introducci|Conclusi)", titulo):
            continue
        ultima = sig - 1
        fraccion = min(1.0, lineas.get(ultima, LINEAS_PAGINA_LLENA) / LINEAS_PAGINA_LLENA)
        paginas = (ultima - ini) + fraccion
        total += paginas
        print(f"  {paginas:5.1f}  {titulo[:70]}")
    print(f"  {total:5.1f}  TOTAL del cuerpo")


if __name__ == "__main__":
    main()
