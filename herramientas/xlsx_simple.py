"""Escribe un libro .xlsx sin dependencias (en el Mac no hay openpyxl y Homebrew no deja instalarlo con pip).

Uso desde un script de un tema:
    sys.path.insert(0, "/Users/marceloortega/TCEE/main/herramientas")
    from xlsx_simple import escribir_xlsx
    escribir_xlsx("Code/datos_3B23.xlsx", [("Léeme", filas), ("Indicadores", filas), ...])
Cada hoja es una lista de filas; la primera es la cabecera (en negrita, fija y con filtro). Los valores pueden ser
texto, números o None (celda vacía). Los nombres de hoja tienen como máximo 31 caracteres y no llevan []:*?/\\.
"""
import math
import numbers
import zipfile
from xml.sax.saxutils import escape

_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"


def _columna(n):
    letras = ""
    while n:
        n, r = divmod(n - 1, 26)
        letras = chr(65 + r) + letras
    return letras


def _celda(ref, valor, estilo):
    s = ' s="1"' if estilo else ""
    if valor is None:
        return ""
    if isinstance(valor, bool):
        valor = str(valor)
    if isinstance(valor, numbers.Integral):  # también los enteros de numpy
        return f'<c r="{ref}"{s}><v>{int(valor)}</v></c>'
    if isinstance(valor, numbers.Real):
        x = float(valor)
        return "" if math.isnan(x) or math.isinf(x) else f'<c r="{ref}"{s}><v>{x!r}</v></c>'
    texto = escape(str(valor))
    return f'<c r="{ref}" t="inlineStr"{s}><is><t xml:space="preserve">{texto}</t></is></c>'


def _hoja(filas):
    ancho = max((len(f) for f in filas), default=1)
    anchos = [min(60, max([len(str(f[j])) for f in filas[:200] if j < len(f) and f[j] is not None] + [6]) + 2)
              for j in range(ancho)]
    cols = "".join(f'<col min="{j}" max="{j}" width="{w}" customWidth="1"/>' for j, w in enumerate(anchos, 1))
    xml = [f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="{_NS}" xmlns:r="{_NS_R}">',
           '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft"'
           f' state="frozen"/></sheetView></sheetViews><cols>{cols}</cols><sheetData>']
    for i, fila in enumerate(filas, 1):
        celdas = "".join(_celda(f"{_columna(j)}{i}", v, i == 1) for j, v in enumerate(fila, 1))
        xml.append(f'<row r="{i}">{celdas}</row>')
    xml.append("</sheetData>")
    if len(filas) > 1 and ancho > 1:
        xml.append(f'<autoFilter ref="A1:{_columna(ancho)}{len(filas)}"/>')
    xml.append("</worksheet>")
    return "".join(xml), ancho


def escribir_xlsx(ruta, hojas):
    nombres = [n for n, _ in hojas]
    if len(set(nombres)) != len(nombres) or any(len(n) > 31 or any(ch in n for ch in "[]:*?/\\") for n in nombres):
        raise ValueError("nombres de hoja repetidos, largos o con caracteres no válidos")
    tipos = "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/'
                    f'vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(hojas) + 1))
    filtros, cuerpo_hojas, rels = [], [], []
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        for i, (nombre, filas) in enumerate(hojas, 1):
            xml, ancho = _hoja(filas)
            z.writestr(f"xl/worksheets/sheet{i}.xml", xml)
            cuerpo_hojas.append(f'<sheet name="{escape(nombre)}" sheetId="{i}" r:id="rId{i}"/>')
            rels.append(f'<Relationship Id="rId{i}" Type="{_NS_R}/worksheet" Target="worksheets/sheet{i}.xml"/>')
            if len(filas) > 1 and ancho > 1:
                hoja = nombre.replace("'", "''")
                filtros.append(f'<definedName name="_xlnm._FilterDatabase" localSheetId="{i - 1}" hidden="1">'
                               f"'{escape(hoja)}'!$A$1:${_columna(ancho)}${len(filas)}</definedName>")
        n = len(hojas)
        rels.append(f'<Relationship Id="rId{n + 1}" Type="{_NS_R}/styles" Target="styles.xml"/>')
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats'
                   '.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats'
                   '-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override Part'
                   'Name="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                   '.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-office'
                   f'document.spreadsheetml.styles+xml"/>{tipos}</Types>')
        z.writestr("_rels/.rels",
                   f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{_PKG}"><Relationship'
                   f' Id="rId1" Type="{_NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        nombres_def = f"<definedNames>{''.join(filtros)}</definedNames>" if filtros else ""
        z.writestr("xl/workbook.xml",
                   f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="{_NS}" xmlns:r="{_NS_R}">'
                   f"<sheets>{''.join(cuerpo_hojas)}</sheets>{nombres_def}</workbook>")
        z.writestr("xl/_rels/workbook.xml.rels",
                   f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{_PKG}">'
                   f"{''.join(rels)}</Relationships>")
        z.writestr("xl/styles.xml",
                   f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="{_NS}">'
                   '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/>'
                   '<name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill>'
                   '<fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/>'
                   '<top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0"'
                   ' fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0"'
                   ' borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"'
                   ' applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0"'
                   ' builtinId="0"/></cellStyles></styleSheet>')
