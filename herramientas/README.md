# Herramientas

Utilidades de trabajo de Claude para los temas que no forman parte de ningún tema concreto (petición del usuario,
20/10/2026). No las usa el panel ni la compilación normal.

| Fichero | Para qué sirve | Cómo se usa (desde la carpeta TCEE) |
|---|---|---|
| `medir_paginas_texto.py` | Mide las páginas de **texto** de cada bloque del cuerpo, sin figuras ni notas al pie, para los temas con un tope de páginas de texto. | `python3 main/herramientas/medir_paginas_texto.py temario/Ejercicio-3/Parte-B/3.B.3` |
| `pdf_lineas_por_pagina.swift` | Dice, para cada página de un PDF, su número impreso y cuántas líneas tiene (para saber cuánto ocupa la última página de un bloque). En el Mac no hay `pdftotext`. | `swift main/herramientas/pdf_lineas_por_pagina.swift ruta/al.pdf` |
| `pdf_paginas_a_png.swift` | Dibuja páginas de un PDF como imágenes PNG, para revisar cómo quedan figuras y páginas. En el Mac no hay `pdftoppm`. | `swift main/herramientas/pdf_paginas_a_png.swift ruta/al.pdf carpeta_salida 1.3 8 9 10` (escala y números de página del PDF) |
| `pdf_texto.swift` | Extrae el texto completo de un PDF (por ejemplo, un artículo descargado) para poder buscar en él. | `swift main/herramientas/pdf_texto.swift ruta/al.pdf > salida.txt` |
| `crossref.py` | Comprueba referencias bibliográficas en Crossref: devuelve DOI, revista, volumen, número, páginas y año de los dos primeros resultados de cada consulta. Así no se inventa ningún DOI (`GUIA_TEMAS.md` §5). | `python3 -I main/herramientas/crossref.py "Solow 1956 A contribution to the theory of economic growth" "otra consulta"` |
