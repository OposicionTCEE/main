# Pestaña «Cante» del Panel Oposición

Sirve para **practicar los cantes**: un botón arranca a la vez el cronómetro y la grabación. Al terminar, la grabación queda guardada y se transcribe cuando el usuario pulsa *Transcribir*.
Mientras hablas no se muestra el texto: es una decisión del usuario.

Código:
- `extension/cante.js`: grabación, transcripción y fichas (lado de la extensión).
- `extension/media/cante.js`: vista.
- `scripts/instalar_cante.sh`: instalación (tarea *Instalar herramientas de cante*).

Mantener este documento y el código a la vez.

## 1. Decisiones tomadas con el usuario (4 de octubre de 2026)

- **Transcripción en el Mac**, sin conexión y sin coste: `whisper.cpp` con el modelo `large-v3-turbo` (unos 1,6 GB en `~/.tcee/modelos`). El audio no sale del ordenador.
- **Importa el contenido, no las muletillas.** Whisper tiende a quitar «eh», repeticiones y titubeos, y se acepta: la transcripción sirve para revisar qué se dijo y qué faltó, no para contar muletillas.
- **Audio guardado solo en el Mac**, en la carpeta de cantes, y comprimido (unos 20 MB por hora). En GitHub va solo el texto.
- **Cronómetro hacia arriba con marca del tiempo objetivo.** La barra se llena hasta el objetivo; al pasarlo, el reloj se pone en rojo y muestra «+mm:ss sobre el objetivo». El objetivo por defecto es el último que se usó (al principio, 30 minutos).

## 2. Por qué la grabación la hace un programa aparte

[Probable] Las páginas internas de VS Code (webviews), donde vive el Panel Oposición, no pueden usar el micrófono. Por eso la extensión arranca `ffmpeg` como programa aparte:

```
ffmpeg -f avfoundation -i :<micrófono> -af ebur128=framelog=info -ac 1 -ar 16000 -c:a pcm_s16le -flush_packets 1 <id>.wav
```

- **Formato:** mono a 16 kHz, el que necesita whisper. `-flush_packets 1` escribe el audio en disco según llega; sin él, ffmpeg lo retiene y un corte lo perdería.
- **Medidor de nivel:** el filtro `ebur128` escribe el nivel en un registro (`<id>.log`) que la extensión lee cada medio segundo.
  Si no llega sonido durante unos 8 segundos, se avisa: suele ser el permiso de micrófono.
- Al pulsar *Terminar* se abre el detalle del cante recién grabado, con su botón *Transcribir*.
- **ffmpeg corre independiente de VS Code.** La grabación sigue aunque se cierre la pestaña o se recargue la ventana. `grabando.json`, en la carpeta de audio, guarda el estado.
- **Terminar** manda a ffmpeg la señal de parada ordenada (SIGINT), que cierra bien el fichero.
- **Cortes:** si el Mac se apaga o ffmpeg muere, la próxima vez que se abra el panel la grabación se da por cortada. Lo grabado queda pendiente de transcribir y la ficha se marca `cortada`.
  Para distinguirlo de una grabación viva se mira también que el fichero haya crecido en los últimos 15 segundos, porque el número de proceso puede reutilizarse.
- **Tope:** una grabación no pasa de 4 horas.
- **Elección de micrófono:** el que se eligió la última vez. Si no, el integrado del Mac. Nunca, por defecto, el del iPhone ni micrófonos virtuales.

## 3. Transcripción

- **Cuándo:** solo al pulsar *Transcribir* (en la fila del historial o en el detalle del cante). No se hace sola al terminar porque el Mac trabaja a tope varios minutos y gasta batería: decisión del usuario (4 de octubre de 2026).
  Va en segundo plano y de una en una (en cola); se puede seguir trabajando o cerrar la pestaña. *Cancelar* la detiene y el cante vuelve a quedar pendiente.
  Al abrir VS Code tampoco se retoman solas las pendientes.
- **Orden de whisper:**

  ```
  whisper-cli -m <modelo> -f <audio> -l es -oj -pp --prompt <pista>
  ```

  La **pista** es el título del tema y los autores en MAYÚSCULAS que aparecen en su `main.tex` (hasta 25). Ayuda a escribir bien nombres propios y términos.
- **Ficheros cortados:** si el WAV quedó a medias, se relee como audio en bruto.
- **Limpieza:** se quitan las frases que whisper inventa en los silencios (p. ej. «Subtítulos realizados por la comunidad de Amara.org»).
- **Después:** el WAV se comprime a `.m4a` y se borra.
- [Suposición] En un MacBook Air con chip de Apple, una hora de audio tarda unos 10–15 minutos.

## 4. Dónde se guarda

| Qué | Dónde | Se sincroniza |
|---|---|---|
| Ficha y transcripción | `progreso/cantes/<id>.json` (repositorio PRIVADO) | Sí, con *Sincronizar* |
| Audio | `~/.tcee_carpeta_cantes` si existe; si no, `iCloud/OPO - TCEE/Cantes`; si no, `TCEE/.cantes-audio` | No por GitHub (sí por iCloud si está ahí) |
| Modelo de idioma | `~/.tcee/modelos/ggml-large-v3-turbo.bin` | No |

`<id>` = `aaaa-mm-dd_hhmm_<código>`, por ejemplo `2026-10-04_1830_3.A.5`.

Ficha: `{id, codigo, titulo, fecha, duracion (s), objetivo (s), micro, audio, pista, estado, cortada?, modelo, segmentos: [{t (s), texto}], texto, error?}`.

Estados: `pendiente` (por transcribir), `transcrito`, `error`.

## 5. Qué muestra la pestaña

- **Si faltan herramientas**, un aviso con el botón *Instalar herramientas de cante*.
- **Nuevo cante:**
  - tema, en este orden: el abierto, los de la semana en curso del calendario y todos los demás;
  - tiempo objetivo;
  - micrófono;
  - botón *Empezar cante*.
- **Grabando:**
  - reloj grande;
  - barra hasta el objetivo;
  - medidor del micrófono;
  - botones *Terminar* y *Descartar*. Descartar borra el audio, tras confirmarlo.
- **Historial:** fecha, tema, duración frente al objetivo y palabras por minuto. Al pulsar un cante se ve a la derecha su transcripción, en párrafos de un minuto con su marca de tiempo. Botones:
  - *Escuchar audio*;
  - *Copiar texto*;
  - *Transcribir*, si está pendiente o falló (también en la fila del historial);
  - *Eliminar*, que borra la ficha y el audio.

## 6. Ideas para más adelante (no hechas)

- Comparar la transcripción con el `main.tex` del tema: epígrafes no mencionados, orden y tiempo por epígrafe.
- Evolución de la duración y del ritmo por tema y por vuelta.
- Registrar el cante con la preparadora (acción pendiente en `CONTEXTO.md`).
