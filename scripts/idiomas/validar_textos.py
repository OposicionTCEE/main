#!/usr/bin/env python3
"""Comprueba el material de los textos de la biblioteca (encargos/textos.md y encargos/prensa.md).

  validar_textos.py <texto.json> <material.json>     (material = solo los campos nuevos)
  validar_textos.py <completo.json>                  (artículo original con todo dentro)
Escribe los problemas encontrados; sale con código 1 si hay alguno.
"""
import json, re, sys, unicodedata

CAMPOS = {'economía', 'empresa y trabajo', 'finanzas', 'comercio internacional', 'Europa e instituciones', 'política y sociedad',
          'medio ambiente y energía', 'ciencia y tecnología', 'salud', 'educación', 'cultura y arte', 'historia', 'geografía y viajes',
          'deporte', 'vida cotidiana'}
NIVELES = {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}


def plano(s):
    s = unicodedata.normalize('NFC', str(s)).replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('«', '"').replace('»', '"')
    s = s.replace(' ', ' ').replace(' ', ' ')
    return re.sub(r'\s+', ' ', s).strip().lower()


def validar(t, m):
    err = []
    pars = t['parrafos']; n = len(pars)
    todo = plano(' '.join(pars))
    for k in ('titulo_es', 'resumen_es', 'campo', 'palabras_clave', 'nivel', 'ideas_clave', 'resumen_modelo', 'preguntas', 'tribunal', 'glosario'):
        if k not in m: err.append(f'falta {k}')
    if err: return err
    if m['campo'] not in CAMPOS: err.append(f"campo desconocido: {m['campo']}")
    if m['nivel'] not in NIVELES: err.append(f"nivel: {m['nivel']}")
    cubiertos = set()
    for x in m['ideas_clave']:
        ps = x.get('parrafos') or []
        if not ps or any(not isinstance(p, int) or p < 0 or p >= n for p in ps): err.append(f"idea con párrafos fuera de rango: {x.get('idea', '')[:40]}")
        cubiertos.update(ps)
    falta = sorted(set(range(n)) - cubiertos)
    if falta: err.append(f'párrafos sin idea clave: {falta}')
    if not any(x.get('principal') for x in m['ideas_clave']): err.append('ninguna idea marcada como principal')
    if not (4 <= len(m['ideas_clave']) <= 16): err.append(f"ideas_clave: {len(m['ideas_clave'])}")
    pal = len(m['resumen_modelo'].split())
    if pal < 60 or pal > 340: err.append(f'resumen_modelo: {pal} palabras')
    ids = set()
    tipos = {}
    for p in m['preguntas']:
        pid = p.get('id'); ids.add(pid); tipos[p.get('tipo')] = tipos.get(p.get('tipo'), 0) + 1
        if p.get('tipo') not in ('vf', 'eleccion', 'vocabulario', 'abierta'): err.append(f'{pid}: tipo {p.get("tipo")}')
        if not isinstance(p.get('parrafo'), int) or not 0 <= p['parrafo'] < n: err.append(f'{pid}: párrafo fuera de rango')
        rs = p.get('respuestas') or []
        if not rs: err.append(f'{pid}: sin respuestas')
        if p.get('tipo') == 'vf' and (len(rs) != 1 or rs[0] not in ('V', 'F', 'ND')): err.append(f'{pid}: vf con respuesta {rs}')
        if p.get('tipo') == 'eleccion' and (not p.get('opciones') or rs[0] not in p['opciones']): err.append(f'{pid}: la respuesta no está entre las opciones')
        if p.get('tipo') == 'vocabulario' and not any(plano(r) in todo for r in rs): err.append(f'{pid}: la palabra pedida no aparece en el texto ({rs})')
        cita = p.get('cita') or ''
        if cita and plano(cita).strip('.…" ') not in todo:
            trozos = [c for c in re.split(r'\s*(?:\.\.\.|…)\s*', plano(cita)) if c.strip('.… ')]
            if not all(c.strip('.…" ') in todo for c in trozos): err.append(f'{pid}: la cita no es literal: «{cita[:60]}»')
        if not p.get('explicacion'): err.append(f'{pid}: sin explicación')
    if len(ids) != len(m['preguntas']): err.append('ids de preguntas repetidos')
    if not (10 <= len(m['preguntas']) <= 16): err.append(f"preguntas: {len(m['preguntas'])}")
    if not (6 <= len(m['tribunal']) <= 8): err.append(f"tribunal: {len(m['tribunal'])}")
    for g in m['glosario']:
        if not isinstance(g.get('parrafo'), int) or not 0 <= g['parrafo'] < n: err.append(f"glosario «{g.get('palabra')}»: párrafo fuera de rango")
        elif plano(g.get('palabra', '')) not in plano(pars[g['parrafo']]) and plano(g.get('palabra', '')) not in todo: err.append(f"glosario «{g.get('palabra')}»: no aparece en el texto")
    return err


if __name__ == '__main__':
    if len(sys.argv) == 3:
        t = json.load(open(sys.argv[1], encoding='utf-8')); m = json.load(open(sys.argv[2], encoding='utf-8'))
    else:
        t = m = json.load(open(sys.argv[1], encoding='utf-8'))
    e = validar(t, m)
    for x in e: print('·', x)
    print('OK' if not e else f'{len(e)} problema(s)')
    sys.exit(1 if e else 0)
