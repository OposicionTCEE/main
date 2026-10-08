#!/usr/bin/env python3
"""Diccionarios del panel en la lengua estudiada (main/IDIOMAS.md, «Panel en la lengua estudiada · diccionarios»).

  definiciones.py ampliar-en  <idiomas> <en-es-kaikki.json>
      Añade a en/diccionario.json las palabras inglesas que faltaban, con sus equivalentes españoles sacados del diccionario de español
      del Wiktionary en inglés (kaikki.org-dictionary-Spanish.jsonl, invertido en el navegador: {inglés: [[español, categoría], …]}).
  definiciones.py en <idiomas> <english-wordnet-2024.xml.gz>
      Escribe en/definiciones.json: definiciones en inglés (Open English WordNet, CC BY 4.0) de las palabras del diccionario y del
      vocabulario de los textos y las fichas.
  definiciones.py fr <idiomas> <fr-definiciones-crudas.json>
      Escribe fr/definiciones.json con las definiciones en francés del Wiktionnaire (fr-extract de kaikki.org, filtrado en el navegador).
  definiciones.py glosarios <idiomas>
      Añade «definicion_l» (primera definición en la lengua estudiada) a cada entrada de vocabulario de las copias <l>/lengua/textos y
      <l>/lengua/fichas, buscando también la forma base (wielded → wield).

Formato de <l>/definiciones.json: {"fuente", "licencia", "definiciones": {"palabra": [["categoría", "definición"], …]}} (hasta 4 por palabra).
"""
import glob
import gzip
import json
import os
import re
import sys
import xml.etree.ElementTree as ET


def leer(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def escribir(p, d, compacto=False):
    with open(p, 'w', encoding='utf-8') as f:
        if compacto:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        else:
            json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def palabras_vocabulario(raiz, l):
    """Palabras del vocabulario de textos y fichas (originales)"""
    s = set()
    for f in glob.glob(f'{raiz}/{l}/textos/*.json'):
        for g in leer(f).get('glosario', []):
            s.add(g['palabra'].lower())
    for f in glob.glob(f'{raiz}/{l}/fichas/*.json'):
        for e in leer(f).get('ejercicios', []):
            for g in e.get('glosario') or []:
                s.add(g['palabra'].lower())
    return s


# --- formas base (las mismas reglas que extension/idiomasPanel.js, formasBase) -------------------------------------------------------
IRREG_EN = {'children': 'child', 'men': 'man', 'women': 'woman', 'people': 'person', 'feet': 'foot', 'teeth': 'tooth', 'mice': 'mouse',
            'was': 'be', 'were': 'be', 'been': 'be', 'is': 'be', 'are': 'be', 'had': 'have', 'has': 'have', 'did': 'do', 'done': 'do',
            'made': 'make', 'said': 'say', 'took': 'take', 'taken': 'take', 'gave': 'give', 'given': 'give', 'came': 'come', 'got': 'get',
            'saw': 'see', 'seen': 'see', 'knew': 'know', 'known': 'know', 'thought': 'think', 'brought': 'bring', 'bought': 'buy',
            'sought': 'seek', 'held': 'hold', 'kept': 'keep', 'left': 'leave', 'lost': 'lose', 'meant': 'mean', 'paid': 'pay', 'sold': 'sell',
            'sent': 'send', 'spent': 'spend', 'told': 'tell', 'found': 'find', 'felt': 'feel', 'led': 'lead', 'rose': 'rise', 'risen': 'rise',
            'fell': 'fall', 'fallen': 'fall', 'grew': 'grow', 'grown': 'grow', 'drew': 'draw', 'drawn': 'draw', 'wrote': 'write',
            'written': 'write', 'began': 'begin', 'begun': 'begin', 'ran': 'run', 'struck': 'strike', 'stood': 'stand', 'won': 'win',
            'chose': 'choose', 'chosen': 'choose', 'spoke': 'speak', 'spoken': 'speak', 'broke': 'break', 'broken': 'break', 'dealt': 'deal',
            'built': 'build', 'bore': 'bear', 'borne': 'bear', 'withdrew': 'withdraw', 'withdrawn': 'withdraw', 'undertook': 'undertake',
            'undertaken': 'undertake', 'overcame': 'overcome', 'forgot': 'forget', 'forgotten': 'forget'}


def formas_base(l, w):
    c = []

    def add(x):
        if x and x != w and len(x) > 1 and x not in c:
            c.append(x)
    if l == 'en':
        add(IRREG_EN.get(w))
        if w.endswith('ies'): add(w[:-3] + 'y')
        if w.endswith('ied'): add(w[:-3] + 'y')
        if w.endswith('ves'): add(w[:-3] + 'f'); add(w[:-3] + 'fe')
        if re.search(r'(s|x|z|ch|sh|o)es$', w): add(w[:-2])
        if w.endswith('s') and not w.endswith('ss'): add(w[:-1])
        for suf in ('ed', 'ing', 'er', 'est'):
            if not w.endswith(suf) or len(w) <= len(suf) + 2:
                continue
            r = w[:-len(suf)]
            add(r); add(r + 'e')
            if len(r) > 2 and r[-1] == r[-2] and r[-1] in 'bcdfghjklmnpqrstvwxz': add(r[:-1])
            if r.endswith('i'): add(r[:-1] + 'y')
        if w.endswith('ly'): add(w[:-2])
    else:
        if w.endswith('aux'): add(w[:-3] + 'al'); add(w[:-3] + 'ail')
        if w.endswith('eaux'): add(w[:-1])
        if w[-1:] in 'sx': add(w[:-1])
        for suf, por in (('ées', 'er'), ('és', 'er'), ('ée', 'er'), ('é', 'er'), ('ies', 'ir'), ('is', 'ir'), ('ie', 'ir'), ('euses', 'eux'),
                         ('euse', 'eux'), ('ives', 'if'), ('ive', 'if'), ('elles', 'el'), ('elle', 'el'), ('ennes', 'en'), ('enne', 'en'),
                         ('es', ''), ('e', '')):
            if w.endswith(suf): add(w[:-len(suf)] + por)
    return c


def ampliar_en(raiz, inv_p):
    p = f'{raiz}/en/diccionario.json'
    d = leer(p)
    claves = {x[0].lower() for x in d['entradas']}
    inv = leer(inv_p)
    nuevas = 0
    for w, xs in sorted(inv.items()):
        if w in claves or not xs:
            continue
        cat = xs[0][1] or ''
        d['entradas'].append([w, cat, '', [x[0] for x in xs[:5]], []])
        nuevas += 1
    d['entradas'].sort(key=lambda x: x[0].lower())
    d['fuente'] = (d.get('fuente', '') + ' + equivalentes del diccionario de español del Wiktionary en inglés (kaikki.org-dictionary-Spanish), '
                   'invertidos para las palabras inglesas que faltaban').strip(' +')
    escribir(p, d, compacto=True)
    print(f'{nuevas} palabras inglesas nuevas; total {len(d["entradas"])}')


def wordnet(src):
    pos = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
    entradas, defs = [], {}
    for _, el in ET.iterparse(gzip.open(src), events=('end',)):
        if el.tag == 'LexicalEntry':
            lem = el.find('Lemma')
            entradas.append((lem.get('writtenForm'), lem.get('partOfSpeech'), [s.get('synset') for s in el.findall('Sense')]))
            el.clear()
        elif el.tag == 'Synset':
            dd = el.find('Definition')
            if dd is not None and dd.text:
                defs[el.get('id')] = dd.text.strip()
            el.clear()
    res = {}
    for w, p, ss in entradas:
        xs = res.setdefault(w.lower(), [])
        for s in ss:
            if s in defs and len(xs) < 4:
                t = defs[s]
                if len(t) > 160:
                    t = t[:157].rsplit(' ', 1)[0] + '…'
                if not any(y[1] == t for y in xs):
                    xs.append([pos.get(p, p), t])
    return {k: v for k, v in res.items() if v}


def necesarias(raiz, l):
    s = {x[0].lower() for x in leer(f'{raiz}/{l}/diccionario.json')['entradas']} | palabras_vocabulario(raiz, l)
    return s | {b for w in s for b in formas_base(l, w)}


def defs_en(raiz, src):
    wn = wordnet(src)
    nec = necesarias(raiz, 'en')
    res = {k: v for k, v in wn.items() if k in nec}
    escribir(f'{raiz}/en/definiciones.json', {'fuente': 'Open English WordNet 2024 (https://en-word.net)', 'licencia': 'CC BY 4.0',
                                              'definiciones': res}, compacto=True)
    print(f'{len(res)} palabras con definición inglesa')


def defs_fr(raiz, crudas):
    d = leer(crudas)
    escribir(f'{raiz}/fr/definiciones.json', {'fuente': 'Wiktionnaire (fr.wiktionary), extraído con wiktextract (kaikki.org, fr-extract)',
                                              'licencia': 'CC BY-SA 4.0 y GFDL (autores del Wiktionnaire)', 'definiciones': d}, compacto=True)
    print(f'{len(d)} palabras con definición francesa')


def glosarios(raiz):
    for l in ('en', 'fr'):
        D = leer(f'{raiz}/{l}/definiciones.json')['definiciones']

        def buscar(w):
            w = w.lower().strip()
            # formas verbales inglesas (-ed, -ing): mejor las acepciones de verbo de la forma base («levied» → levy, verbo)
            if l == 'en' and re.search(r'(ed|ing)$', w):
                for k in formas_base(l, w):
                    vs = [x for x in D.get(k, []) if x[0] == 'verb']
                    if vs:
                        return ' · '.join(x[1] for x in vs[:2])
            for k in [w] + formas_base(l, w):
                if k in D:   # hasta dos acepciones (la primera del Wiktionnaire suele ser la literal)
                    t = ' · '.join(x[1] for x in D[k][:2])
                    return t if len(t) <= 220 else D[k][0][1]
            return ''
        n = tot = 0
        for f in glob.glob(f'{raiz}/{l}/lengua/textos/*.json') + glob.glob(f'{raiz}/{l}/lengua/fichas/*.json'):
            t = leer(f)
            gls = list(t.get('glosario', []))
            for e in t.get('ejercicios', []):
                gls += e.get('glosario') or []
            for g in gls:
                tot += 1
                dl = buscar(g['palabra'])
                if dl:
                    g['definicion_l'] = dl
                    n += 1
                else:
                    g.pop('definicion_l', None)
            escribir(f, t)
        print(f'{l}: {n} de {tot} entradas de vocabulario con definición')


if __name__ == '__main__':
    o = sys.argv[1] if len(sys.argv) > 1 else ''
    if o == 'ampliar-en':
        ampliar_en(sys.argv[2], sys.argv[3])
    elif o == 'en':
        defs_en(sys.argv[2], sys.argv[3])
    elif o == 'fr':
        defs_fr(sys.argv[2], sys.argv[3])
    elif o == 'glosarios':
        glosarios(sys.argv[2])
    else:
        sys.exit(__doc__)
