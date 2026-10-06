#!/usr/bin/env python3
"""Une los ficheros de enriquecimiento (encargo enriquecer.md) con las fichas del paquete de idiomas.
En cada ficha: descripcion_larga_es, contexto {que_es, por_que_importa, cuando_se_usa}; en cada ejercicio: explicacion (la ampliada;
la de una línea pasa a explicacion_breve), traduccion, por_opcion, errores_previstos y glosario. En <l>/titulos.json: descripcion_larga_l.
Es idempotente. Uso: unir_enriq.py <carpeta idiomas> <carpeta enriq>"""
import json, os, sys

paq, enr = sys.argv[1], sys.argv[2]
for l in ('fr', 'en'):
    ft = os.path.join(paq, l, 'titulos.json')
    tit = json.load(open(ft, encoding='utf-8'))
    n = 0
    for nombre in sorted(os.listdir(os.path.join(enr, l))):
        if not nombre.endswith('.json'):
            continue
        e = json.load(open(os.path.join(enr, l, nombre), encoding='utf-8'))
        fp = os.path.join(paq, l, 'fichas', nombre)
        f = json.load(open(fp, encoding='utf-8'))
        assert f['id'] == e['id'], nombre
        f['descripcion_larga_es'] = e['descripcion_larga_es']
        f['contexto'] = e['contexto']
        for ej in f['ejercicios']:
            x = e['ejercicios'][ej['id']]
            if 'explicacion_breve' not in ej:
                ej['explicacion_breve'] = ej.get('explicacion', '')
            ej['explicacion'] = x['explicacion']
            for k in ('traduccion', 'por_opcion', 'errores_previstos', 'glosario'):
                if x.get(k):
                    ej[k] = x[k]
                else:
                    ej.pop(k, None)
        with open(fp, 'w', encoding='utf-8') as s:
            json.dump(f, s, ensure_ascii=False, indent=1)
            s.write('\n')
        if f['id'] in tit['titulos']:
            tit['titulos'][f['id']]['descripcion_larga_l'] = e['descripcion_larga_l']
        n += 1
    with open(ft, 'w', encoding='utf-8') as s:
        json.dump(tit, s, ensure_ascii=False, indent=1)
        s.write('\n')
    print(l, n, 'fichas unidas')
