#!/usr/bin/env python3
"""Diccionario bilingüe del paquete de idiomas (francés↔castellano e inglés↔castellano) a partir de Wiktionary (wiktextract, kaikki.org).

Entradas: es-extract.jsonl.gz (Wiktionary en español) y, opcional, fr-extract.jsonl.gz (Wiktionary en francés).
- Palabras francesas e inglesas definidas en español (es.wiktionary): definiciones; las cortas cuentan también como traducción.
- Palabras españolas con traducciones al francés o al inglés (es.wiktionary): se invierten.
- Palabras francesas con traducciones al español (fr.wiktionary): traducciones y pronunciación.
Salida: <idiomas>/<fr|en>/diccionario.json = {lengua, fuente, licencia, entradas: [[palabra, categoría, AFI, [traducciones], [definiciones]]]}
Uso: diccionario.py <es-extract.jsonl.gz> [<fr-extract.jsonl.gz>] <carpeta idiomas>
"""
import gzip, json, os, re, sys
from collections import defaultdict

CAT = {'noun': 'sustantivo', 'verb': 'verbo', 'adj': 'adjetivo', 'adv': 'adverbio', 'phrase': 'expresión', 'prep': 'preposición',
       'pron': 'pronombre', 'conj': 'conjunción', 'intj': 'interjección', 'det': 'determinante', 'article': 'artículo', 'num': 'numeral',
       'name': 'nombre propio', 'proverb': 'refrán', 'prep_phrase': 'locución', 'adv_phrase': 'locución adverbial', 'idiom': 'locución'}
FORMA = re.compile(r'^(forma|plural|femenino|masculino|primera|segunda|tercera|participio|gerundio|inflexión|conjugación|pretérito|presente|futuro|imperativo|condicional)\b', re.I)

def lineas(ruta):
    with gzip.open(ruta, 'rt', encoding='utf-8') as f:
        for ln in f:
            try:
                yield json.loads(ln)
            except ValueError:
                continue

def limpio(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()

def main():
    args = sys.argv[1:]
    salida = args[-1]; es_x = args[0]; fr_x = args[1] if len(args) > 2 else None
    D = {l: defaultdict(lambda: {'cat': '', 'ipa': '', 'trad': [], 'glosas': []}) for l in ('fr', 'en')}
    def add(l, palabra, cat, trad=(), glosas=(), ipa=''):
        palabra = limpio(palabra)
        if not palabra or len(palabra) > 60 or len(palabra.split()) > 5:
            return
        e = D[l][(palabra, cat)]
        e['cat'] = cat
        if ipa and not e['ipa']:
            e['ipa'] = ipa
        for t in trad:
            t = limpio(t)
            if t and t not in e['trad'] and len(e['trad']) < 10:
                e['trad'].append(t)
        for g in glosas:
            g = limpio(g)[:220]
            if g and g not in e['glosas'] and len(e['glosas']) < 5:
                e['glosas'].append(g)
    n = 0
    for x in lineas(es_x):
        n += 1
        lc = x.get('lang_code'); w = x.get('word'); cat = (x.get('pos_title') or '').lower() or CAT.get(x.get('pos', ''), '')
        if lc in ('fr', 'en'):
            if 'flexiva' in (x.get('pos_title') or '').lower():
                continue   # formas flexionadas (plurales, conjugaciones): no son entradas de diccionario
            gl = [limpio(' '.join(s.get('glosses', []))) for s in x.get('senses', [])
                  if s.get('glosses') and not s.get('form_of') and 'form-of' not in (s.get('tags') or [])]
            gl = [g for g in gl if g and not FORMA.match(g)]
            if not gl:
                continue
            cortas = [re.sub(r'[.;]+$', '', g) for g in gl if len(g.split()) <= 4]
            ipa = next((s.get('ipa') for s in x.get('sounds', []) if s.get('ipa')), '')
            add(lc, w, cat, cortas, gl, ipa)
        elif lc == 'es':
            for t in x.get('translations', []) + [t for s in x.get('senses', []) for t in s.get('translations', [])]:
                tl = t.get('lang_code') or t.get('code')
                if tl in ('fr', 'en') and t.get('word'):
                    add(tl, t['word'], cat, [w])
    print('es-extract:', n, 'líneas')
    if fr_x:
        n = 0
        for x in lineas(fr_x):
            n += 1
            if x.get('lang_code') != 'fr':
                continue
            cat = CAT.get(x.get('pos', ''), '')
            trs = [t['word'] for t in x.get('translations', []) + [t for s in x.get('senses', []) for t in s.get('translations', [])]
                   if (t.get('lang_code') or t.get('code')) == 'es' and t.get('word')]
            if not trs:
                continue
            ipa = next((s.get('ipa') for s in x.get('sounds', []) if s.get('ipa')), '')
            add('fr', x.get('word'), cat, trs, [], ipa)
        print('fr-extract:', n, 'líneas')
    for l in ('fr', 'en'):
        ent = [[p, e['cat'], e['ipa'], e['trad'], e['glosas']] for (p, _), e in D[l].items() if e['trad'] or e['glosas']]
        ent.sort(key=lambda e: (e[0].lower(), e[1]))
        os.makedirs(os.path.join(salida, l), exist_ok=True)
        with open(os.path.join(salida, l, 'diccionario.json'), 'w', encoding='utf-8') as f:
            json.dump({'lengua': l, 'fuente': 'Wiktionary (es.wiktionary' + (' y fr.wiktionary' if fr_x and l == 'fr' else '') + '), extraído con wiktextract (kaikki.org)',
                       'licencia': 'CC BY-SA 4.0 y GFDL (autores de Wiktionary)', 'entradas': ent}, f, ensure_ascii=False, separators=(',', ':'))
        print(l, len(ent), 'entradas')

if __name__ == '__main__':
    main()
