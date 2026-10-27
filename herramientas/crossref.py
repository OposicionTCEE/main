# Busca referencias bibliográficas en Crossref (DOI, revista, volumen, número, páginas). Uso: python3 -I main/herramientas/crossref.py "Autor año título" ["otra consulta" ...]. Hace una pausa entre consultas para no superar el límite de Crossref.
import json, sys, time, urllib.parse, urllib.request
for q in sys.argv[1:]:
    url = "https://api.crossref.org/works?rows=2&select=DOI,title,author,issued,container-title,volume,issue,page,type&query.bibliographic=" + urllib.parse.quote(q)
    for intento in range(3):
        try:
            d = json.load(urllib.request.urlopen(url, timeout=25)); break
        except Exception as e:
            time.sleep(6); d = None
    print("##", q)
    if not d: print("   ERROR"); continue
    for i in d["message"]["items"]:
        au = "; ".join(a.get("family","") for a in i.get("author", [])[:4])
        print("  ", i.get("DOI"), "|", (i.get("title") or [""])[0][:95], "|", au, "|", (i.get("container-title") or [""])[0][:40], i.get("volume"), i.get("issue"), i.get("page"), i.get("issued",{}).get("date-parts"))
    time.sleep(2.5)
