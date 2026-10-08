#!/usr/bin/env python3
"""Versión «en la lengua estudiada» del paquete de idiomas (main/IDIOMAS.md, «Panel en la lengua estudiada»).

Cada fichero de datos con explicaciones en castellano (fichas, textos, tareas, tribunal, expresiones…) tiene una copia con la misma estructura
en <l>/lengua/<misma ruta>, donde el castellano está traducido a la lengua estudiada. Lo que ya está en esa lengua (frases, respuestas,
opciones, párrafos…) y las traducciones al castellano que el panel enseña en gris o con el botón «ES» (traduccion, significado) no cambian.

  lengua.py extraer  <base.json> <l>                   → lista JSON de {"ruta", "texto", "es"} con las cadenas que se pueden traducir
  lengua.py aplicar  <base.json> <mapa.json> <salida>  → copia con las traducciones del mapa {"ruta": "traducción"}
  lengua.py validar  <base.json> <copia.json> <l>      → errores (y avisos) de estructura, campos protegidos y castellano sin traducir

La «ruta» es la lista de claves e índices unida por «/» (p. ej. «explicacion/1/filas/0/1», «ejercicios/3/por_opcion/an»).
"""
import json
import re
import sys

# claves cuyo valor está en la lengua estudiada, o es un dato, o es la traducción al castellano que se conserva: no se extraen ni cambian
PROTEGIDAS = {
    'id', 'tipo', 'formato', 'nivel', 'nivel_oficial', 'nivel_lexico', 'lengua', 'frase', 'respuestas', 'respuesta', 'opciones', 'palabra',
    'significado', 'traduccion', 'url', 'audio', 'parrafos', 'secciones', 'mal', 'bien', 'verbo', 'palabras', 'origen', 'cita', 'pregunta',
    'titulo', 'titulo_l', 'descripcion_l', 'descripcion_larga_l', 'oficial', 'resumen_modelo', 'ideas_clave', 'ideas', 'repreguntas',
    'palabras_clave', 'licencia', 'autor', 'autores', 'nombre', 'fecha', 'parrafo', 'modelo', 'k', 'total', 'cobertura', 'entero', 'piezas',
}
SOLO_ES = set('el los las del y por para con es se lo al su sus como más pero sin sobre este esta estos estas esto muy ya cuando también '
              'hay está están puede pueden una uno unos unas porque aunque cuál qué dónde cómo frase texto verbo palabra significa '
              'ejemplo ejemplos usa uso decir dice quiere elige completa escribe ordena corrige transforma respuesta correcta incorrecta '
              'explicar explica lenguaje cosas mismo misma entre desde hasta hacia otra otro otras otros cada todo toda solo nunca siempre '
              'tiene tienen hace ser estar mejor peor igual después antes ahora aquí donde mientras sino ni ante tras pasado futuro '
              'presente forma formas regla persona personas tiempo'.split())


# palabras que también existen en francés (no cuentan como castellano en los textos franceses)
TAMBIEN_FR = {'se', 'es', 'y', 'ni', 'entre', 'son', 'si', 'pour', 'ante', 'presente', 'forme', 'formes', 'personne', 'personnes', 'texte', 'verbe'}


def palabras(s):
    return re.findall(r"[a-záéíóúñüàâçèêëîïôûœ']+", s.lower())


def es_castellano(s, l):
    """¿Parece castellano? (heurística: marcadores propios del castellano, ñ ¿ ¡, -ción, y á í ó ú en textos que no son castellano)"""
    if not isinstance(s, str) or not s.strip():
        return False
    if re.search(r'[ñ¿¡áíóú]|ci[oó]n(es)?\b', s.lower()):   # á í ó ú no se usan en inglés ni en francés
        return True
    ws = palabras(s)
    if not ws:
        return False
    marcas = sum(w in SOLO_ES and not (l == 'fr' and w in TAMBIEN_FR) for w in ws)
    return marcas >= 1 and (len(ws) <= 4 or marcas / len(ws) >= 0.12)


def recorrer(o, ruta=()):
    """(ruta, texto) de cada cadena que no cuelga de una clave protegida"""
    if isinstance(o, dict):
        for k, v in o.items():
            if k in PROTEGIDAS:
                continue
            if k == 'expresiones' and isinstance(v, list) and all(isinstance(x, str) for x in v):
                continue   # expresiones útiles de las tareas: ya están en la lengua estudiada
            yield from recorrer(v, ruta + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from recorrer(v, ruta + (str(i),))
    elif isinstance(o, str):
        yield '/'.join(ruta), o


def obtener(o, ruta):
    for p in ruta.split('/'):
        o = o[int(p)] if isinstance(o, list) else o[p]
    return o


def poner(o, ruta, valor):
    ps = ruta.split('/')
    for p in ps[:-1]:
        o = o[int(p)] if isinstance(o, list) else o[p]
    if isinstance(o, list):
        o[int(ps[-1])] = valor
    else:
        o[ps[-1]] = valor


def extraer(base, l):
    d = json.load(open(base, encoding='utf-8'))
    return [{'ruta': r, 'texto': t, 'es': es_castellano(t, l)} for r, t in recorrer(d) if t.strip()]


def aplicar(base, mapa, salida):
    d = json.load(open(base, encoding='utf-8'))
    m = json.load(open(mapa, encoding='utf-8'))
    validas = {r for r, _ in recorrer(d)}
    malas = [r for r in m if r not in validas]
    if malas:
        sys.exit(f'Rutas que no existen o están protegidas: {malas[:10]}')
    for r, v in m.items():
        if not isinstance(v, str):
            sys.exit(f'Traducción que no es texto en {r}')
        poner(d, r, v)
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def estructura(a, b, ruta=''):
    if type(a) is not type(b):
        yield f'{ruta}: tipo distinto'
    elif isinstance(a, dict):
        if set(a) - {'definicion_l'} != set(b) - {'definicion_l'}:   # definicion_l la añade definiciones.py (vocabulario)
            yield f'{ruta}: claves distintas {sorted(set(a) ^ set(b))[:6]}'
        for k in a:
            if k in b:
                yield from estructura(a[k], b[k], f'{ruta}/{k}')
    elif isinstance(a, list):
        if len(a) != len(b):
            yield f'{ruta}: {len(a)} elementos frente a {len(b)}'
        for i, (x, y) in enumerate(zip(a, b)):
            yield from estructura(x, y, f'{ruta}/{i}')


def protegidas(a, b, ruta=''):
    """Lo que cuelga de una clave protegida tiene que ser idéntico"""
    if isinstance(a, dict) and isinstance(b, dict):
        for k in a:
            if k not in b:
                continue
            if k in PROTEGIDAS or (k == 'expresiones' and isinstance(a[k], list) and all(isinstance(x, str) for x in a[k])):
                if a[k] != b[k]:
                    yield f'{ruta}/{k}: campo protegido modificado'
            else:
                yield from protegidas(a[k], b[k], f'{ruta}/{k}')
    elif isinstance(a, list) and isinstance(b, list):
        for i, (x, y) in enumerate(zip(a, b)):
            yield from protegidas(x, y, f'{ruta}/{i}')


def validar(base, copia, l):
    a = json.load(open(base, encoding='utf-8'))
    b = json.load(open(copia, encoding='utf-8'))
    errores = list(estructura(a, b)) + list(protegidas(a, b))
    avisos = []
    for r, t in recorrer(a):
        nuevo = obtener(b, r)
        if es_castellano(t, l):
            if nuevo == t:
                (errores if len(palabras(t)) >= 4 else avisos).append(f'{r}: sin traducir: {t[:70]}')
            elif es_castellano(nuevo, l) and len(palabras(nuevo)) >= 4:
                avisos.append(f'{r}: ¿sigue en castellano?: {nuevo[:70]}')
    return errores, avisos


if __name__ == '__main__':
    orden = sys.argv[1] if len(sys.argv) > 1 else ''
    if orden == 'extraer':
        print(json.dumps(extraer(sys.argv[2], sys.argv[3]), ensure_ascii=False, indent=0))
    elif orden == 'aplicar':
        aplicar(sys.argv[2], sys.argv[3], sys.argv[4])
    elif orden == 'validar':
        e, w = validar(sys.argv[2], sys.argv[3], sys.argv[4])
        for x in w:
            print('aviso:', x)
        for x in e:
            print('ERROR:', x)
        print(f'{len(e)} errores, {len(w)} avisos')
        sys.exit(1 if e else 0)
    else:
        sys.exit(__doc__)
