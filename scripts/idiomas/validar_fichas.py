#!/usr/bin/env python3
"""Comprueba las fichas del paquete de idiomas (formato en main/IDIOMAS.md, apartado «Formato de las fichas»).
Uso: validar_fichas.py <carpeta idiomas> [lengua]. Sale con error si alguna ficha no cumple."""
import json, os, re, sys, glob

TIPOS = {'hueco', 'eleccion', 'transformar', 'corregir', 'ordenar'}
def norm(s): return re.sub(r'\s+', ' ', s.replace('’', "'").strip().lower())

def validar(f, materias):
    e = []
    try: d = json.load(open(f, encoding='utf-8'))
    except Exception as x: return [f'JSON inválido: {x}']
    for k in ('id', 'titulo', 'titulo_es', 'nivel', 'resumen', 'explicacion', 'ejemplos', 'ejercicios', 'fuente'):
        if k not in d: e.append(f'falta {k}')
    if e: return e
    if d['id'] not in materias: e.append(f'id {d["id"]} no está en materias.json')
    elif materias[d['id']]['nivel'] != d['nivel']: e.append(f'nivel {d["nivel"]} distinto del índice ({materias[d["id"]]["nivel"]})')
    if os.path.basename(f) != d['id'].split('.', 2)[2] + '.json': e.append('el nombre del fichero no coincide con el id')
    for b in d['explicacion']:
        if b.get('tipo') not in ('texto', 'tabla', 'lista'): e.append(f'bloque de explicación desconocido: {b.get("tipo")}')
        if b.get('tipo') == 'tabla' and any(len(r) != len(b['cabecera']) for r in b['filas']): e.append('tabla con filas de distinto ancho')
    if len(d['ejemplos']) < 3: e.append('menos de 3 ejemplos')
    ej = d['ejercicios']
    if len(ej) < 10: e.append(f'solo {len(ej)} ejercicios (mínimo 10)')
    ids = [x.get('id') for x in ej]
    if len(ids) != len(set(ids)): e.append('id de ejercicio repetido')
    for x in ej:
        t = x.get('tipo'); r = x.get('respuestas') or []
        if t not in TIPOS: e.append(f'{x.get("id")}: tipo {t}'); continue
        if not r or not all(isinstance(a, str) and a.strip() for a in r): e.append(f'{x["id"]}: sin respuestas'); continue
        if t == 'hueco' and x.get('frase', '').count('___') != 1: e.append(f'{x["id"]}: el hueco debe ser exactamente un ___')
        if t == 'eleccion':
            ops = x.get('opciones') or []
            if len(ops) < 2 or any(norm(a) not in map(norm, ops) for a in r): e.append(f'{x["id"]}: respuesta fuera de las opciones')
            if x.get('frase', '').count('___') > 1: e.append(f'{x["id"]}: más de un hueco')
        if t == 'ordenar':
            pal = x.get('palabras') or []
            if sorted(norm(' '.join(pal)).split()) != sorted(norm(r[0]).replace('?', ' ?').replace('.', ' .').replace(',', ' ,').replace('!', ' !').split()) and \
               sorted(norm(' '.join(pal)).split()) != sorted(norm(r[0]).split()):
                e.append(f'{x["id"]}: las palabras no forman la respuesta')
        if t == 'corregir' and norm(x.get('frase', '')) in map(norm, r): e.append(f'{x["id"]}: la frase a corregir ya es correcta')
        if not x.get('explicacion'): e.append(f'{x["id"]}: sin explicación')
    return e

if __name__ == '__main__':
    raiz = sys.argv[1]; lenguas = sys.argv[2:] or ['fr', 'en']
    malos = 0; total = 0
    for l in lenguas:
        mat = {m['id']: m for m in json.load(open(os.path.join(raiz, l, 'materias.json'), encoding='utf-8'))['materias']}
        for f in sorted(glob.glob(os.path.join(raiz, l, 'fichas', '*.json'))):
            total += 1
            e = validar(f, mat)
            if e: malos += 1; print(os.path.relpath(f, raiz), '→', '; '.join(e[:6]))
    print(f'{total} fichas, {malos} con problemas')
    sys.exit(1 if malos else 0)
