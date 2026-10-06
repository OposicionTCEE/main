#!/usr/bin/env python3
"""Base de verbos franceses del entrenador de conjugación (pestaña Idiomas) a partir de Verbiste (Pierre Sarrazin, GPL-2.0+),
tal como la distribuye el paquete mlconjug3 (pip download mlconjug3). Frecuencia de cada verbo: apariciones de sus formas en las
frases francesas de Tatoeba (CC BY 2.0 FR).

Salida <idiomas>/fr/verbos.json:
 {fuente, licencia, tiempos: {clave: nombre}, plantillas: {plantilla: {clave: [terminaciones por persona | null]}},
  verbos: [[infinitivo, raíz, plantilla, grupo (1|2|3), frecuencia, h aspirada (0|1)]]}
Uso: verbos.py <verbs-fr.json> <conjugation-fr.json> <verbs-fr.xml> <pares.tsv de Tatoeba> <carpeta idiomas>
"""
import json, os, re, sys
from collections import Counter

verbs_f, conj_f, xml_f, pares_f, salida = sys.argv[1:6]
V = json.load(open(verbs_f, encoding='utf-8'))
C = json.load(open(conj_f, encoding='utf-8'))
aspirada = set(re.findall(r'<i>([^<]+)</i>\s*<t>[^<]*</t>\s*<aspirate-h/>', open(xml_f, encoding='utf-8').read()))

CLAVES = [('pres', 'Indicatif', 'Présent'), ('imp', 'Indicatif', 'Imparfait'), ('ps', 'Indicatif', 'Passé Simple'), ('fut', 'Indicatif', 'Futur'),
          ('cond', 'Conditionnel', 'Présent'), ('subj', 'Subjonctif', 'Présent'), ('subjimp', 'Subjonctif', 'Imparfait'),
          ('impe', 'Imperatif', 'Imperatif Présent'), ('pp', 'Participe', 'Participe Passé'), ('ppres', 'Participe', 'Participe Présent')]
plantillas = {}
for tpl, d in C.items():
    p = {}
    for k, modo, t in CLAVES:
        x = (d.get(modo) or {}).get(t)
        if x is None:
            p[k] = None
        elif isinstance(x, str):
            p[k] = [x]
        else:
            n = 4 if k == 'pp' else 3 if k == 'impe' else 6
            fila = [None] * n
            for i, f in x:
                if i < n:
                    fila[i] = f if isinstance(f, str) else (f[0] if f else None)
            p[k] = fila
    plantillas[tpl] = p
# correcciones conocidas de Verbiste
if ':pouvoir' in plantillas or 'p:ouvoir' in plantillas:
    for k in plantillas:
        if k.endswith('ouvoir') and plantillas[k]['pp'] and plantillas[k]['pp'][0] == 'u' and k.startswith('p:'):
            plantillas[k]['pp'] = ['u', None, None, None]   # pu, invariable

def grupo(inf, tpl):
    if inf == 'aller':
        return 3
    if inf.endswith('er'):
        return 1
    if tpl in ('fin:ir', 'ha:ïr') or (inf.endswith('ir') and (plantillas.get(tpl, {}).get('pres') or [None] * 4)[3:4] and str((plantillas[tpl]['pres'] or [''] * 4)[3]).endswith('issons')):
        return 2
    return 3

# frecuencia en Tatoeba
formas = {}
for inf, v in V.items():
    p = plantillas.get(v['template']); r = v['root']
    if not p:
        continue
    fs = {inf}
    for k in ('pres', 'imp', 'ps', 'fut', 'cond', 'subj', 'pp', 'ppres'):
        for t in p[k] or []:
            if t:
                fs.add((r + t).lower())
    for f in fs:
        formas.setdefault(f, set()).add(inf)
AMBIGUAS = set('monde mondes tu lui mari maris livre livres nuit nuits sens été plus son sons sera vers montre montres porte portes place places marche pense ferme fermes juste face cours cour bois fois mois pas fils lit lits vis'.split())
cuenta = Counter()
for ln in open(pares_f, encoding='utf-8'):
    c = ln.rstrip('\n').split('\t')
    if len(c) < 3 or c[0] != 'fra':
        continue
    for w in re.findall(r"[a-zàâäçéèêëîïôöùûüÿœæ-]+", c[2].lower().replace('’', "'").replace("'", ' ')):
        dueños = formas.get(w, ())
        if len(dueños) == 1 and w not in AMBIGUAS and len(w) > 2:   # solo formas de un único verbo y que no sean otra palabra frecuente
            cuenta[next(iter(dueños))] += 1

verbos = [[inf, v['root'], v['template'], grupo(inf, v['template']), cuenta.get(inf, 0), 1 if inf in aspirada else 0]
          for inf, v in sorted(V.items()) if v['template'] in plantillas]
os.makedirs(os.path.join(salida, 'fr'), exist_ok=True)
with open(os.path.join(salida, 'fr', 'verbos.json'), 'w', encoding='utf-8') as f:
    json.dump({'fuente': 'Verbiste (Pierre Sarrazin, 2003-2016), vía mlconjug3; frecuencias: frases francesas de Tatoeba',
               'licencia': 'GPL-2.0-or-later (datos de Verbiste); frecuencias CC BY 2.0 FR (Tatoeba)',
               'plantillas': plantillas, 'verbos': verbos}, f, ensure_ascii=False, separators=(',', ':'))
g = Counter(v[3] for v in verbos)
print(len(verbos), 'verbos', dict(g), len(plantillas), 'plantillas; más frecuentes:', [v[0] for v in sorted(verbos, key=lambda v: -v[4])[:25]])
