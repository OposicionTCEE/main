#!/usr/bin/env python3
"""Diccionario bilingüe del paquete de idiomas (francés↔castellano e inglés↔castellano) a partir de Wiktionary (wiktextract, kaikki.org).

Entradas: es-extract.jsonl.gz (Wiktionary en español) y, opcional, fr-extract.jsonl.gz (Wiktionary en francés).
- Palabras francesas e inglesas definidas en español (es.wiktionary): definiciones; las cortas cuentan también como traducción.
- Palabras españolas con traducciones al francés o al inglés (es.wiktionary): se invierten.
- Palabras francesas con traducciones al español (fr.wiktionary): traducciones y pronunciación.
Salida: <idiomas>/<fr|en>/diccionario.json = {lengua, fuente, licencia, entradas: [[palabra, categoría, AFI, [traducciones], [definiciones]]]}
- Opcional: palabras francesas de una lista (p. ej. el vocabulario de FLELex) que siguen sin entrada: definiciones en francés
  de fr.wiktionary, marcadas «(fr)», para no dejar fuera palabras frecuentes que Wiktionary no traduce al español.
Uso: diccionario.py <es-extract.jsonl.gz> [<fr-extract.jsonl.gz>] [--mono-fr <entradas fr.jsonl.gz> --lista <palabras.txt>] <carpeta idiomas>
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
    mono = lista = None
    if '--mono-fr' in args:
        i = args.index('--mono-fr'); mono = args[i + 1]; del args[i:i + 2]
    if '--lista' in args:
        i = args.index('--lista'); lista = {w.strip().lower() for w in open(args[i + 1], encoding='utf-8') if w.strip()}; del args[i:i + 2]
    salida = args[-1]; es_x = args[0]; fr_x = args[1] if len(args) > 2 else None
    D = {l: defaultdict(lambda: {'cat': '', 'ipa': '', 'trad': [], 'inv': [], 'glosas': []}) for l in ('fr', 'en')}
    def add(l, palabra, cat, trad=(), glosas=(), ipa='', invertida=False):
        # traducciones «invertidas» (de una entrada española que da esta palabra como traducción): menos fiables, van detrás
        if l == 'en' and invertida:
            palabra = re.sub(r'^to\s+', '', limpio(palabra))
        palabra = limpio(palabra)
        if not palabra or palabra.lower() in ('to', 'the', 'a') or len(palabra) > 60 or len(palabra.split()) > 5:
            return
        e = D[l][palabra]
        if cat and cat not in e['cat'].split(', ') and len(e['cat']) < 40:
            e['cat'] = f"{e['cat']}, {cat}" if e['cat'] else cat
        if ipa and not e['ipa']:
            e['ipa'] = ipa
        lista = e['inv'] if invertida else e['trad']
        for t in trad:
            t = re.sub(r'[.;]+$', '', limpio(t))
            if t and t.lower() not in [x.lower() for x in lista] and len(lista) < 10:
                lista.append(t)
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
                    add(tl, t['word'], cat, [w], invertida=True)
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
    if mono:
        n = 0
        for x in lineas(mono):
            w = limpio(x.get('word'))
            if x.get('lang_code') != 'fr' or (lista and w.lower() not in lista):
                continue
            e = D['fr'].get(w)
            if e and (e['trad'] or e['glosas'] or e['inv']):
                continue
            gl = [limpio(' '.join(s.get('glosses', []))) for s in x.get('senses', []) if s.get('glosses') and not s.get('form_of')]
            gl = [f'(fr) {g}' for g in gl if g][:3]
            if not gl:
                continue
            ipa = next((s.get('ipa') for s in x.get('sounds', []) if s.get('ipa')), '')
            add('fr', w, CAT.get(x.get('pos', ''), ''), [], gl, ipa); n += 1
        print('definiciones solo en francés:', n)
    for l in ('fr', 'en'):
        ent = []
        for p, e in D[l].items():
            vistos = {x.lower() for x in e['trad']}
            trad = e['trad'] + [x for x in e['inv'] if x.lower() not in vistos][:4 if e['trad'] or e['glosas'] else 6]
            if trad or e['glosas']:
                ent.append([p, ', '.join(e['cat'].split(', ')[:2]), e['ipa'], trad[:10], e['glosas']])
        ent.sort(key=lambda e: (e[0].lower(), e[1]))
        os.makedirs(os.path.join(salida, l), exist_ok=True)
        with open(os.path.join(salida, l, 'diccionario.json'), 'w', encoding='utf-8') as f:
            json.dump({'lengua': l, 'fuente': 'Wiktionary (es.wiktionary' + (' y fr.wiktionary' if fr_x and l == 'fr' else '') + '), extraído con wiktextract (kaikki.org)',
                       'licencia': 'CC BY-SA 4.0 y GFDL (autores de Wiktionary)', 'entradas': ent}, f, ensure_ascii=False, separators=(',', ':'))
        print(l, len(ent), 'entradas')

if __name__ == '__main__':
    main()
