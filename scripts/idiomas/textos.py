#!/usr/bin/env python3
"""Biblioteca de textos del paquete de idiomas (fase 2). Ver main/IDIOMAS.md, «Biblioteca de textos».

  textos.py preparar <carpeta idiomas> <fuentes.json>...   limpia los textos descargados (Wikipedia, Wikinews, Vikidia, VOA),
        los corta por párrafos, calcula su nivel léxico y escribe <l>/textos/<id>.json (sin preguntas) y encargos/textos_<l>.json
  textos.py nivel <carpeta idiomas> <l> <fichero.txt>       nivel léxico de un texto suelto (para los artículos escritos por Claude)
  textos.py unir <carpeta idiomas> <material/> [<prensa/>]   une el material de los agentes y rehace el índice
  textos.py indice <carpeta idiomas>                         rehace <l>/textos.json (índice) con lo que haya en <l>/textos/

El nivel léxico se calcula con FLELex (francés) y EFLLex (inglés), CC BY-NC-SA 4.0, en TCEE/.fuentes-idiomas/cefrlex/
(o en la variable CEFRLEX): para cada nivel, la parte de las palabras del texto que ya aparecen en los materiales de ese nivel;
el nivel sale de la parte cubierta por el vocabulario de B1, con umbrales por lengua calibrados con textos de nivel
conocido; las frases muy largas suben un nivel y las muy cortas lo bajan.
"""
import json, os, re, sys, unicodedata, hashlib

NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
MAX_PALABRAS = 1700        # unos 12–14 minutos de lectura en voz alta: el examen lee hasta 15 minutos
MIN_PARRAFO = 25           # palabras: los párrafos más cortos se unen al siguiente o se descartan (listas, pies)
SECCIONES_FUERA = re.compile(r'^(see also|references|notes|external links|further reading|bibliography|sources?|citations|footnotes|'
                             r'voir aussi|notes et références|références|liens externes|articles connexes|bibliographie|annexes|'
                             r'source|sources|lien externe|galerie|gallery|related news|related articles|sister links|'
                             r'à lire aussi|sur le même sujet|pour aller plus loin)$', re.I)
LICENCIAS = {
    'wikipedia': 'CC BY-SA 4.0', 'vikidia': 'CC BY-SA 3.0', 'wikinews': 'CC BY 2.5', 'voa': 'Dominio público (VOA, gobierno de EE. UU.)',
}


def slug(s):
    s = unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:48]


def lengua_de(fuente):
    if fuente.startswith('fr.'): return 'fr'
    return 'en'


def tipo_de(fuente):
    if 'wikinews' in fuente: return 'noticia'
    if 'voa' in fuente: return 'divulgacion'
    if 'vikidia' in fuente or 'simple.' in fuente: return 'divulgacion'
    return 'enciclopedia'


def nombre_fuente(fuente):
    return {'en.wikipedia.org': 'Wikipedia (inglés)', 'simple.wikipedia.org': 'Simple English Wikipedia', 'fr.wikipedia.org': 'Wikipédia (francés)',
            'fr.vikidia.org': 'Vikidia', 'en.wikinews.org': 'Wikinews (inglés)', 'fr.wikinews.org': 'Wikinews (francés)',
            'learningenglish.voanews.com': 'VOA Learning English'}.get(fuente, fuente)


def licencia_de(fuente):
    for k, v in LICENCIAS.items():
        if k in fuente: return v
    return ''


# ---------------------------------------------------------------- limpieza y corte por párrafos
def secciones_wiki(texto):
    """[(titulo_seccion, [parrafos])] a partir del texto plano de la API (== Título ==)."""
    out, actual, pars, fuera = [], '', [], False
    for linea in texto.split('\n'):
        m = re.match(r'^(=+)\s*(.*?)\s*=+$', linea.strip())
        if m:
            if pars and not fuera: out.append((actual, pars))
            nivel = len(m.group(1))
            if nivel <= 2: fuera = bool(SECCIONES_FUERA.match(m.group(2)))
            elif SECCIONES_FUERA.match(m.group(2)): fuera = True
            actual, pars = m.group(2), []
            continue
        linea = linea.strip()
        if linea: pars.append(linea)
    if pars and not fuera: out.append((actual, pars))
    return out


def limpiar(p):
    p = re.sub(r'\s*\[\d+\]', '', p)
    p = re.sub(r'\s+', ' ', p).strip()
    p = p.replace(' ,', ',').replace(' .', '.')
    return p


def parrafo_valido(p):
    n = len(p.split())
    if n < MIN_PARRAFO: return False
    if not re.search(r'[.!?»"”)]$', p): return False          # listas y pies sin punto final
    if re.match(r'^(publié le|published|\(?wikinews\)?|this article|cet article)', p, re.I) and n < 40: return False
    return True


def cortar(secciones, max_palabras=MAX_PALABRAS):
    """Párrafos (con su sección) hasta max_palabras, siempre por párrafos enteros."""
    out, total = [], 0
    for sec, pars in secciones:
        for p in pars:
            p = limpiar(p)
            if not parrafo_valido(p): continue
            n = len(p.split())
            if total and total + n > max_palabras: return out
            out.append({'s': sec, 't': p}); total += n
    return out


# ---------------------------------------------------------------- nivel léxico (CEFRLex)
VACIAS = {
    'fr': set('le la les l un une des de du d et ou à au aux en dans par pour sur avec sans sous ce cet cette ces se s sa son ses leur leurs '
              'il elle ils elles on nous vous je tu me te lui y ne pas plus que qui quoi dont où est sont a ont été être avoir qu c n j m t'.split()),
    'en': set('the a an of and or to in on at by for with from as is are was were be been being it its this that these those he she they '
              'we you i his her their our your not no but if than then so do does did has have had will would can could may might shall should'.split()),
}


def cargar_cefrlex(l, carpeta):
    """{palabra: indice de nivel (0=A1)} con el primer nivel en que la palabra aparece en los materiales."""
    if l == 'fr':
        f = os.path.join(carpeta, 'FLELex_TreeTagger_Beacco.tsv')
        niv = {}
        for i, linea in enumerate(open(f, encoding='utf-8')):
            if i == 0: continue
            c = linea.rstrip('\n').split('\t')
            if len(c) < 9: continue
            freqs = [float(x or 0) for x in c[2:8]]
            primero = next((k for k, v in enumerate(freqs) if v > 0), 5)
            w = c[0].lower()
            niv[w] = min(niv.get(w, 9), primero)
        return niv
    f = os.path.join(carpeta, 'EFLLex.tsv')
    niv = {}
    for i, linea in enumerate(open(f, encoding='utf-8')):
        if i == 0: continue
        c = linea.rstrip('\n').split('\t')
        if len(c) < 7: continue
        freqs = [float(x or 0) for x in c[2:7]]       # a1..c1 (EFLLex no tiene C2)
        primero = next((k for k, v in enumerate(freqs) if v > 0), 5)
        w = c[0].lower()
        niv[w] = min(niv.get(w, 9), primero)
    return niv


def formas_verbales_fr(dir_idiomas):
    """forma conjugada → infinitivo, con la base de verbos (Verbiste)."""
    f = os.path.join(dir_idiomas, 'fr', 'verbos.json')
    if not os.path.exists(f): return {}
    d = json.load(open(f, encoding='utf-8'))
    m = {}
    for v, raiz, plantilla, *_ in d['verbos']:
        for formas in d['plantillas'].get(plantilla, {}).values():
            for fin in formas or []:
                if fin is None: continue
                for x in str(fin).split(','):
                    m.setdefault((raiz + x.strip()).lower(), v)
    return m


def candidatos(w, l, verbales):
    yield w
    if l == 'fr':
        if w in verbales: yield verbales[w]
        for suf, rep in (('aux', 'al'), ('x', ''), ('s', ''), ('es', ''), ('e', ''), ('ement', ''), ('ement', 'e')):
            if w.endswith(suf) and len(w) > len(suf) + 2: yield w[:-len(suf)] + rep
    else:
        for suf, rep in (('ies', 'y'), ('ied', 'y'), ('es', ''), ('s', ''), ('ed', ''), ('ed', 'e'), ('ing', ''), ('ing', 'e'), ('ly', ''), ('er', ''), ('est', '')):
            if w.endswith(suf) and len(w) > len(suf) + 2: yield w[:-len(suf)] + rep


UMBRALES = {'en': [(1, 0.88), (2, 0.84), (3, 0.78), (4, 0.70)], 'fr': [(1, 0.94), (2, 0.90), (3, 0.86), (4, 0.80)]}


def nivel_lexico(texto, l, niv, verbales):
    toks = re.findall(r"[A-Za-zÀ-ÿœŒæÆ'’-]+", texto)
    frases = [f for f in re.split(r'(?<=[.!?])\s+', texto) if f.strip()]
    contadas, por_nivel = 0, [0] * 6
    for i, t in enumerate(toks):
        t = t.replace('’', "'")
        if "'" in t: t = t.split("'")[-1]
        w = t.lower()
        if not w or w in VACIAS[l] or len(w) < 2: continue
        if t[0].isupper() and i > 0 and toks[i - 1][-1:] not in '.!?': continue   # nombres propios
        n = None
        for c in candidatos(w, l, verbales):
            if c in niv: n = niv[c]; break
        contadas += 1
        por_nivel[min(n if n is not None else 5, 5)] += 1
    if not contadas: return {'nivel': 'B1', 'cobertura': {}, 'frase_media': 0}
    acum, cob = 0, {}
    for k in range(6):
        acum += por_nivel[k]; cob[NIVELES[k]] = round(acum / contadas, 3)
    # Umbrales calibrados con textos de nivel conocido (VOA Learning English ≈ B1–B2, Vikidia ≈ A2–B1, Wikipedia ≈ C1–C2) sobre la parte
    # del vocabulario que ya aparece en materiales de B1; las listas de cada lengua no son comparables, por eso hay umbrales por lengua.
    umbrales = UMBRALES[l]
    s = cob['B1']
    base = next((k for k, u in umbrales if s >= u), 5)
    media = round(sum(len(f.split()) for f in frases) / max(1, len(frases)), 1)
    if media > 26 and base < 5: base += 1
    if media < 12 and base > 1: base -= 1
    return {'nivel': NIVELES[base], 'cobertura': cob, 'frase_media': media}


# ---------------------------------------------------------------- órdenes
def preparar(dir_idiomas, ficheros):
    cefr = os.environ.get('CEFRLEX', os.path.join(os.path.dirname(dir_idiomas), '.fuentes-idiomas', 'cefrlex'))
    niv = {l: cargar_cefrlex(l, cefr) for l in ('fr', 'en')}
    verbales = formas_verbales_fr(dir_idiomas)
    encargos = {'fr': [], 'en': []}
    vistos = set()
    # VOA: el primer mp3 de la página puede ser de otro programa (barra lateral): solo vale si no se repite en otras páginas
    # y su fecha (en la ruta) es de las 3 semanas anteriores al artículo
    usos = {}
    for fi in ficheros:
        for t in json.load(open(fi, encoding='utf-8'))['textos']:
            if t.get('mp3'): usos[t['mp3']] = usos.get(t['mp3'], 0) + 1
    def audio_valido(t):
        u = t.get('mp3'); f = (t.get('fecha') or '')[:10]
        m = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', u or '')
        if not u or usos.get(u, 0) > 1 or not m or not f: return None
        import datetime as dt
        da = dt.date(*map(int, m.groups())); dp = dt.date.fromisoformat(f)
        return u if 0 <= (dp - da).days <= 21 else None
    for fi in ficheros:
        d = json.load(open(fi, encoding='utf-8'))
        for t in d['textos']:
            fuente = t['fuente']; l = lengua_de(fuente)
            if 'parrafos' in t:   # VOA: ya viene por párrafos
                secs = [('', [p for p in t['parrafos'] if not re.match(r"^(i'm |i’m |words in this story|_+|now it's your turn|what do you think|quiz)", p, re.I)])]
                # VOA: se corta en «Words in This Story» (glosario de la propia VOA) y en el pie del autor
                pars = []
                for p in secs[0][1]:
                    if re.match(r'^(words in this story|_{3,})', p, re.I): break
                    pars.append(p)
                secs = [('', pars)]
            else:
                secs = secciones_wiki(t['texto'])
            pars = cortar(secs)
            n = sum(len(p['t'].split()) for p in pars)
            if n < 180: continue
            ident = f"{l}.t.{slug(fuente.split('.')[0] if 'wiki' in fuente else 'voa')}-{slug(t['titulo'])}"
            if 'simple.' in fuente: ident = f"{l}.t.simple-{slug(t['titulo'])}"
            if 'vikidia' in fuente: ident = f"{l}.t.vikidia-{slug(t['titulo'])}"
            if 'wikinews' in fuente: ident = f"{l}.t.news-{slug(t['titulo'])}"
            if ident in vistos: continue
            vistos.add(ident)
            nl = nivel_lexico(' '.join(p['t'] for p in pars), l, niv[l], verbales)
            doc = {
                'id': ident, 'lengua': l, 'titulo': t['titulo'], 'tipo': tipo_de(fuente),
                'fuente': {'nombre': nombre_fuente(fuente), 'url': t.get('url', ''), 'licencia': licencia_de(fuente),
                           'autor': t.get('autor') or ('Colaboradores de ' + nombre_fuente(fuente) if 'wiki' in fuente else ''),
                           'fecha': t.get('fecha') or '', 'revision': t.get('revid') or None,
                           'nota': 'Texto recortado por párrafos; sin cambios en las frases.'},
                'audio': audio_valido(t),
                'palabras': n, 'nivel_lexico': nl,
                'parrafos': [p['t'] for p in pars], 'secciones': [p['s'] for p in pars],
            }
            os.makedirs(os.path.join(dir_idiomas, l, 'textos'), exist_ok=True)
            json.dump(doc, open(os.path.join(dir_idiomas, l, 'textos', ident.split('.', 2)[2] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            encargos[l].append({'id': ident, 'titulo': doc['titulo'], 'palabras': n, 'nivel_lexico': nl['nivel'], 'tipo': doc['tipo']})
    for l, xs in encargos.items():
        print(l, len(xs), 'textos;', {k: sum(1 for x in xs if x['nivel_lexico'] == k) for k in NIVELES})
    return encargos


def indice(dir_idiomas):
    for l in ('fr', 'en'):
        d = os.path.join(dir_idiomas, l, 'textos')
        if not os.path.isdir(d): continue
        xs = []
        for f in sorted(os.listdir(d)):
            if not f.endswith('.json'): continue
            t = json.load(open(os.path.join(d, f), encoding='utf-8'))
            if not t.get('preguntas'): continue          # sin material todavía: no se ofrece
            xs.append({k: t.get(k) for k in ('id', 'titulo', 'titulo_es', 'tipo', 'nivel', 'campo', 'palabras_clave', 'palabras', 'audio', 'resumen_es')}
                      | {'fuente': t['fuente']['nombre'], 'parrafos': len(t['parrafos']), 'preguntas': len(t['preguntas'])})
        h = hashlib.sha1(json.dumps(xs, sort_keys=True).encode()).hexdigest()[:10]
        json.dump({'version': h, 'textos': xs}, open(os.path.join(dir_idiomas, l, 'textos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(l, len(xs), 'textos en el índice')


def unir(dir_idiomas, dir_material, dir_prensa=None):
    """Une el material escrito por los agentes (encargos/textos.md) a cada texto; los textos sin material se apartan a sin_material/.
    Los artículos originales (encargos/prensa.md) ya traen todo: se copian con su nivel léxico."""
    cefr = os.environ.get('CEFRLEX', os.path.join(os.path.dirname(dir_idiomas), '.fuentes-idiomas', 'cefrlex'))
    nuevos = ('titulo_es', 'resumen_es', 'campo', 'palabras_clave', 'nivel', 'nivel_motivo', 'ideas_clave', 'resumen_modelo', 'preguntas', 'tribunal', 'glosario')
    n = 0
    for l in ('fr', 'en'):
        d = os.path.join(dir_idiomas, l, 'textos')
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            t = json.load(open(os.path.join(d, f), encoding='utf-8'))
            m = os.path.join(dir_material, t['id'] + '.json')
            if os.path.exists(m):
                mat = json.load(open(m, encoding='utf-8'))
                for k in nuevos:
                    if k in mat: t[k] = mat[k]
                json.dump(t, open(os.path.join(d, f), 'w', encoding='utf-8'), ensure_ascii=False, indent=1); n += 1
            elif not t.get('preguntas'):
                os.makedirs(os.path.join(dir_material, '..', 'sin_material'), exist_ok=True)
                os.rename(os.path.join(d, f), os.path.join(dir_material, '..', 'sin_material', f.replace('.json', f'.{l}.json')))
    if dir_prensa:
        niv = {l: cargar_cefrlex(l, cefr) for l in ('fr', 'en')}; verbales = formas_verbales_fr(dir_idiomas)
        for f in sorted(os.listdir(dir_prensa)):
            t = json.load(open(os.path.join(dir_prensa, f), encoding='utf-8'))
            l = t['lengua']
            t['palabras'] = sum(len(p.split()) for p in t['parrafos'])
            t['nivel_lexico'] = nivel_lexico(' '.join(t['parrafos']), l, niv[l], verbales)
            t.setdefault('secciones', [''] * len(t['parrafos']))
            json.dump(t, open(os.path.join(dir_idiomas, l, 'textos', t['id'].split('.', 2)[2] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1); n += 1
    print(n, 'textos con material')


if __name__ == '__main__':
    orden = sys.argv[1]
    if orden == 'preparar':
        enc = preparar(sys.argv[2], sys.argv[3:])
        json.dump(enc, open('encargos_textos.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    elif orden == 'nivel':
        cefr = os.environ.get('CEFRLEX', os.path.join(os.path.dirname(sys.argv[2]), '.fuentes-idiomas', 'cefrlex'))
        l = sys.argv[3]
        print(json.dumps(nivel_lexico(open(sys.argv[4], encoding='utf-8').read(), l, cargar_cefrlex(l, cefr), formas_verbales_fr(sys.argv[2]) if l == 'fr' else {}), ensure_ascii=False))
    elif orden == 'unir':
        unir(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
        indice(sys.argv[2])
    elif orden == 'indice':
        indice(sys.argv[2])
