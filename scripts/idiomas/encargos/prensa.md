# Encargo: artículos de análisis originales para la biblioteca de Idiomas (fase 2)

Los textos del examen de idiomas de la oposición TCEE suelen ser artículos de prensa económica y de actualidad de nivel B2–C1
(estilo de un artículo de análisis o una tribuna de opinión de un diario o semanario serio). No hay textos así con licencia abierta,
así que los escribes tú: son **originales** y se publican en el repositorio con licencia CC0, como «Texto original escrito para el panel».

Recibes una lista de encargos `{id, lengua, tema, enfoque, nivel, palabras}`. Para cada uno escribe `<salida>/<id>.json` con:

```json
{
 "id": "en.t.prensa-…", "lengua": "en", "titulo": "…", "tipo": "prensa",
 "fuente": {"nombre": "Texto original (Claude)", "url": "", "licencia": "CC0", "autor": "Claude (Anthropic)", "fecha": "2026-10",
            "nota": "Escrito para el panel de idiomas. Los datos son aproximados y no deben citarse como fuente."},
 "audio": null,
 "parrafos": ["…", "…"],
 "secciones": ["", ""]
}
```
y, en el mismo fichero, **todos** los campos del encargo `encargos/textos.md` (titulo_es, resumen_es, campo, palabras_clave, nivel, nivel_motivo,
ideas_clave, resumen_modelo, preguntas, tribunal, glosario), siguiendo sus reglas.

## Cómo escribir el artículo
- Extensión: la del encargo (±10 %), en 8–14 párrafos de 60–150 palabras. Titular y, si encaja, una entradilla como primer párrafo.
- Registro: prensa de calidad; argumentación con datos generales, contraste de posturas, conectores variados, alguna metáfora periodística.
  Nivel del encargo: C1 = vocabulario rico y frases complejas; B2 = más directo pero no simplificado.
- **Nada de citas inventadas atribuidas a personas reales** ni de cifras precisas presentadas como reales: usa órdenes de magnitud conocidos
  («cerca del 3 %», «más de la mitad») o fuentes genéricas («según la mayoría de los estudios»). Puedes citar a «un economista», «una directiva»…
- No imites a un medio concreto ni uses su nombre o su firma.
- Variedad: que no empiecen todos igual; mezcla análisis, crónica, opinión y reportaje.
- En francés: ortografía tradicional y tipografía francesa (espacio antes de : ; ? ! y comillas « »). En inglés: ortografía británica.
- Sin Markdown dentro de los textos.
