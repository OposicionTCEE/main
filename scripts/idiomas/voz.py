#!/usr/bin/env python3
"""Servidor de voz de la pestaña Idiomas: Piper (voces neuronales libres, sin conexión). Ver main/IDIOMAS.md, «Voces».

Lo arranca la extensión con el Python de ~/.tcee/piper y le habla por la entrada estándar, una petición JSON por línea:
  {"id": "...", "modelo": "/ruta/voz.onnx", "hablante": 3 | null, "velocidad": 1.0, "frases": ["…", "…"], "dir": "/ruta/salida"}
Por cada frase escribe <dir>/<i>.wav (si ya existe, no la repite) y contesta en la salida estándar, una línea JSON por evento:
  {"id": "...", "i": 0}   frase lista      {"id": "...", "fin": true}   petición terminada      {"id": "...", "error": "…"}
Las voces cargadas se guardan en memoria mientras el servidor vive (la extensión lo para a los pocos minutos sin uso).
"""
import json, os, sys, wave

try:
    from piper import PiperVoice
    try:
        from piper import SynthesisConfig
    except ImportError:   # versiones antiguas
        SynthesisConfig = None
except Exception as e:   # sin Piper instalado
    print(json.dumps({'error': f'Piper no está instalado: {e}'}), flush=True)
    sys.exit(1)

voces = {}


def voz(modelo):
    if modelo not in voces:
        voces[modelo] = PiperVoice.load(modelo)
    return voces[modelo]


def sintetizar(v, texto, destino, hablante, velocidad):
    tmp = destino + '.tmp'
    with wave.open(tmp, 'wb') as w:
        if SynthesisConfig is not None:
            conf = SynthesisConfig(speaker_id=hablante, length_scale=1.0 / max(0.5, min(2.0, velocidad or 1.0)))
            v.synthesize_wav(texto, w, syn_config=conf)
        else:
            v.synthesize(texto, w, speaker_id=hablante, length_scale=1.0 / (velocidad or 1.0))
    os.replace(tmp, destino)


print(json.dumps({'listo': True}), flush=True)
for linea in sys.stdin:
    linea = linea.strip()
    if not linea:
        continue
    pid = None
    try:
        p = json.loads(linea)
        pid = p.get('id')
        v = voz(p['modelo'])
        os.makedirs(p['dir'], exist_ok=True)
        for i, frase in enumerate(p.get('frases') or []):
            destino = os.path.join(p['dir'], f'{i}.wav')
            if not os.path.exists(destino):
                sintetizar(v, frase, destino, p.get('hablante'), p.get('velocidad'))
            print(json.dumps({'id': pid, 'i': i}), flush=True)
        print(json.dumps({'id': pid, 'fin': True}), flush=True)
    except Exception as e:
        print(json.dumps({'id': pid, 'error': str(e)[:300]}), flush=True)
