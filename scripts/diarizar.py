#!/usr/bin/env python3
"""Identifica quién habla en cada momento de un audio (sin conexión), para el Panel TCEE (main/CANTE.md, apartado «Voces»).

Uso: python diarizar.py --wav <audio mono 16 kHz, PCM 16 bits> --seg <segmentación.onnx> --emb <voz.onnx> [--n 2] [--hilos 4]
  --n: número de voces; 0 o menos = automático (según --umbral).
Escribe líneas JSON: {"pct": 37} mientras trabaja y, al final, {"tramos": [[inicio, fin, hablante], …]} (segundos; hablantes 0, 1, 2… en orden de aparición).

Usa sherpa-onnx (Apache 2.0) con la segmentación de pyannote 3.0 (MIT) y el modelo de voz CAM++ de 3D-Speaker (Apache 2.0).
"""
import argparse
import json
import sys
import wave

import numpy as np
import sherpa_onnx


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--wav', required=True)
    a.add_argument('--seg', required=True)
    a.add_argument('--emb', required=True)
    a.add_argument('--n', type=int, default=0)
    a.add_argument('--umbral', type=float, default=0.5)
    a.add_argument('--hilos', type=int, default=4)
    o = a.parse_args()

    cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(model=o.seg), num_threads=o.hilos),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=o.emb, num_threads=o.hilos),
        clustering=sherpa_onnx.FastClusteringConfig(num_clusters=o.n if o.n > 0 else -1, threshold=o.umbral),
        min_duration_on=0.3, min_duration_off=0.5)
    if not cfg.validate():
        print(json.dumps({'error': 'configuración no válida (¿faltan los modelos?)'}), flush=True)
        sys.exit(1)
    sd = sherpa_onnx.OfflineSpeakerDiarization(cfg)

    w = wave.open(o.wav)
    if w.getframerate() != sd.sample_rate or w.getnchannels() != 1 or w.getsampwidth() != 2:
        print(json.dumps({'error': f'el audio debe ser mono, 16 bits y {sd.sample_rate} Hz'}), flush=True)
        sys.exit(1)
    audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0

    ultimo = [-1]

    def progreso(hechos, total):
        pct = int(100 * hechos / max(1, total))
        if pct != ultimo[0]:
            ultimo[0] = pct
            print(json.dumps({'pct': pct}), flush=True)
        return 0

    r = sd.process(audio, callback=progreso).sort_by_start_time()
    # hablantes renumerados por orden de aparición y tramos seguidos del mismo hablante unidos (huecos de menos de 1 s)
    orden, tramos = {}, []
    for s in r:
        h = orden.setdefault(s.speaker, len(orden))
        if tramos and tramos[-1][2] == h and s.start - tramos[-1][1] < 1.0:
            tramos[-1][1] = round(s.end, 2)
        else:
            tramos.append([round(s.start, 2), round(s.end, 2), h])
    print(json.dumps({'tramos': tramos}), flush=True)


if __name__ == '__main__':
    main()
