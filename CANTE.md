# Pestaña «Cante» del Panel Oposición

Sirve para **practicar los cantes**: un botón arranca a la vez el cronómetro y la grabación; otro, *Adjuntar audio*, crea el cante a partir de audios ya grabados (apartado 6). La grabación queda guardada y se transcribe cuando el usuario pulsa *Transcribir*.
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

- **Cuándo:** solo al pulsar *Transcribir* en el detalle del cante (al pulsarlo en el historial). No se hace sola al terminar porque el Mac trabaja a tope varios minutos y gasta batería: decisión del usuario (4 de octubre de 2026).
  Va en segundo plano y de una en una (en cola); se puede seguir trabajando o cerrar la pestaña. *Cancelar* la detiene y el cante vuelve a quedar pendiente.
  Al abrir VS Code tampoco se retoman solas las pendientes.
- **Orden de whisper:**

  ```
  whisper-cli -m <modelo> -f <audio> -l es -ojf -pp --prompt <pista>
  ```

  `-ojf` (JSON completo) da el instante de cada token: se juntan en palabras (`palabrasDeTokens`). El fichero se lee también como latin1
  porque whisper escribe los bytes tal cual y una letra con tilde puede quedar partida entre dos tokens; se decodifica cada palabra entera.
  La **pista** es el título del tema y los autores en MAYÚSCULAS que aparecen en su `main.tex` (hasta 25). Ayuda a escribir bien nombres propios y términos.
- **Ficheros cortados:** si el WAV quedó a medias, se relee como audio en bruto.
- **Limpieza:** se quitan las frases que whisper inventa en los silencios (p. ej. «Subtítulos realizados por la comunidad de Amara.org»).
- **Después:** el WAV se comprime a `.m4a` y se borra. Al *volver a transcribir* un cante ya comprimido, el `.m4a` se conserva tal cual.
- [Suposición] En un MacBook Air con chip de Apple, una hora de audio tarda unos 10–15 minutos.

## 4. Dónde se guarda

| Qué | Dónde | Se sincroniza |
|---|---|---|
| Ficha y transcripción | `progreso/cantes/<id>.json` (repositorio PRIVADO) | Sí, con *Sincronizar* |
| Audio | `~/.tcee_carpeta_cantes` si existe; si no, `iCloud/OPO - TCEE/Cantes`; si no, `TCEE/.cantes-audio` | No por GitHub (sí por iCloud si está ahí) |
| Modelo de idioma | `~/.tcee/modelos/ggml-large-v3-turbo.bin` | No |
| Copia para escuchar en el panel (MP3) y forma de onda | Carpeta de datos de la extensión, `cante-escucha/` (solo las 6 últimas copias) | No |

`<id>` = `aaaa-mm-dd_hhmm_<código>`, por ejemplo `2026-10-04_1830_3.A.5`.

Ficha: `{id, codigo, titulo, fecha, duracion (s), objetivo (s), micro, audio, pista, estado, cortada?, modelo, segmentos: [{t (s), texto, palabras?: [[t (s), palabra], …]}], texto, error?, editado? (el usuario corrigió el texto),
origen? ('adjunto'), archivos? (nombres de los audios juntados), tramos? ({exposicion: [ini, fin] | null, descartar: [[ini, fin], …]}, en segundos)}`.
`duracion` es siempre la del audio entero; la duración real del cante sale de los tramos (apartado 6).

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
- **Historial:** fecha, tema, duración real (la de la exposición; ✂ si hay tramos marcados) frente al objetivo y palabras por minuto de la exposición. Al pulsar un cante se ve a la derecha su transcripción, en párrafos de un minuto con su marca de tiempo. Botones:
  - reproductor con forma de onda y marcas de tramos (apartado 6);
  - *Abrir audio fuera* (en la aplicación de audio del Mac);
  - *Copiar texto*;
  - *Transcribir*, si está pendiente o falló; solo aparece al abrir el cante desde el historial;
  - *Eliminar*, que borra la ficha y el audio.

## 6. Audios adjuntos y tramos (decisiones del usuario, 11 de octubre de 2026)

**Adjuntar audio** (junto a *Empezar cante*):
- Se eligen uno o varios ficheros (notas de voz, WhatsApp `.opus`, `.mp3`, `.wav`, vídeos: se usa solo el sonido). Los que no tienen sonido se avisan y no se añaden.
- Se ordenan con ↑ ↓ (al principio, por fecha) y se pueden quitar o añadir más.
- **Fecha del cante:** la del fichero más antiguo (última modificación), editable.
- *Juntar y guardar*: ffmpeg pasa cada uno a mono 16 kHz y los encadena en un único WAV del cante (`concat`). Los originales no se tocan.
  La ficha queda `pendiente` con `origen: 'adjunto'` y `archivos`, y se transcribe con *Transcribir* como cualquier otra.

**Tramos** (en el detalle de cualquier cante cuyo audio esté en este Mac):
- Dos tipos que marca el usuario: **Exposición** (un único tramo seguido) y **Descartar** (los que haga falta).
- **Sin nada marcado, todo es exposición.** Con la exposición marcada, lo que queda fuera es **material complementario** (por ejemplo, las correcciones del preparador).
  Lo descartado no cuenta para nada; si cae dentro de la exposición, resta de la duración real.
- **Duración real** = exposición menos lo descartado. Es la que muestran el historial y el detalle, y con la que se calculan el objetivo y las palabras por minuto.
- Se marca sobre la **forma de onda**: pulsar lleva a ese punto; *Inicio / Fin de la exposición aquí* usan el punto que suena;
  los bordes de la exposición se arrastran; *Descartar desde aquí* y luego *Fin del descarte aquí*. Se guarda solo al cambiar.
- La **línea del momento actual** se arrastra: pulsar en la onda lleva a ese punto y, sin soltar, se mueve.
- **Sobre el texto** (v0.44; selección propia desde la v0.44.1): pulsar una palabra la selecciona; arrastrar amplía hasta la palabra sobre la que se suelta
  (el texto se desplaza solo cerca de los bordes); Mayúsculas + clic amplía desde la anterior; Esc o *Quitar selección* la quitan.
  No se usa la selección del navegador: saltaba por frases porque la barra de arriba cambiaba de alto al seleccionar y movía el texto bajo el ratón
  (por eso la barra tiene ahora una sola línea fija). Luego se pulsa *Exposición = selección* (sustituye la exposición) o *Descartar selección* (añade un descarte).
  El tramo va desde el instante de la primera palabra hasta el de la palabra siguiente a la última; se admiten tramos de una sola palabra (desde 0,05 s; centésimas).
- **✕ al principio de cada bloque marcado** en el texto: en el primer párrafo de la exposición quita la marca de exposición (todo vuelve a ser exposición);
  en un descarte quita ese descarte. El material complementario no tiene ✕: sale de la exposición.
- El panel no repinta el detalle si no ha cambiado nada del cante (se refresca a menudo por otros motivos) ni a mitad de una selección, y conserva el desplazamiento del texto.
  Los cantes transcritos antes de la v0.44 solo tienen el instante de cada frase: se marca la frase entera y se ofrece *Volver a transcribir con precisión por palabra*
  (conserva los tramos; avisa de que se pierden las correcciones del texto).
- Cada palabra lleva su tipo, así que los párrafos de material complementario y los descartados se cortan donde empieza el tramo, aunque sea a mitad de frase.
  *Copiar material complementario* copia ese texto. Pulsar la marca de tiempo de un párrafo lo hace sonar; la palabra que suena se resalta.
- **Corregir la transcripción:** doble clic en una palabra (o en la frase, en los cantes antiguos) abre un cuadro para cambiarla; vacío la borra.
  Si la palabra aparece más veces, se puede cambiar en todas (útil para un autor mal escrito). Se conservan los instantes; la ficha queda `editado: true`.
- **Por qué una copia MP3:** el reproductor de VS Code no lee AAC (`.m4a`). La copia y la forma de onda (pico cada 0,1 s) se guardan en la carpeta de datos de la extensión.
- Las reglas están dos veces, iguales: `normalizarTramos`/`calcularTramos` en `extension/cante.js` y `normalizar`/`calcular` en `extension/media/cante.js`.

## 7. Guardar y Editar (decisiones del usuario, 13 de octubre de 2026)

- **💾 Guardar** (en el detalle; solo con el cante transcrito y sin transcripción en marcha) **bloquea** el cante: se puede escuchar, ir a un punto, leer y copiar,
  pero desaparecen las marcas (botones, ✕, arrastrar bordes), la selección del texto, la corrección con doble clic y *Transcribir / Volver a transcribir*.
  La ficha lleva `guardado` (fecha). El historial lo muestra con 🔒. *Eliminar* sigue disponible, con su confirmación.
- Al guardar, los **ficheros originales** de un cante adjuntado (los que se eligieron con *Adjuntar audio*; su ruta va en `originales` de la ficha)
  **van a la Papelera del Mac** tras una confirmación que los enumera. Se conserva siempre la copia comprimida del cante. Luego se borra `originales`.
  Los cantes grabados con el panel no tienen original aparte. Los adjuntados antes de la v0.45 no guardaban la ruta: solo se bloquean.
- **Editar** desbloquea (los originales ya no vuelven, ni hacen falta).
- La extensión también rechaza guardar tramos o texto de un cante guardado (`guardarTramos`, `guardarSegmentos`).

## 8. Identificar voces (decisiones del usuario, 13 de octubre de 2026)

- **Para qué:** distinguir quién habla en cada momento (tú, la preparadora…). Sirve en los cantes y en las clases de Idiomas.
- **Por qué otro programa:** whisper no lo hace en castellano (su `tinydiarize` es solo inglés y `--diarize` exige una voz por canal estéreo).
  Se usa **sherpa-onnx** (Apache 2.0) sin conexión, con la segmentación de **pyannote 3.0** (MIT) y el modelo de voz **CAM++** de 3D-Speaker (Apache 2.0).
- **Instalación:** `scripts/instalar_voces.sh`, llamado por *Instalar herramientas de cante* y por *Instalar herramientas* de Idiomas: entorno de Python propio
  en `~/.tcee/voces-id` (el Python del Mac; si falla, el 3.12 de Homebrew) y modelos en `~/.tcee/modelos/voces/` (`segmentacion.onnx`, `voz.onnx`; unos 35 MB).
- **Cómo:** botón *👥 Identificar voces* en el detalle de un cante transcrito (y en cada audio transcrito de una clase), con el número de voces
  (automático, 2, 3 o 4; si se sabe, mejor). `extension/voces.js` pasa el audio a mono 16 kHz y lanza `scripts/diarizar.py`, que devuelve tramos
  `[[inicio, fin, hablante], …]` (hablantes numerados por orden de aparición; se unen los tramos seguidos del mismo hablante con huecos de menos de 1 s).
  Una identificación cada vez; la transcripción espera a que termine (las dos cargan mucho el Mac). En un Mac con chip de Apple [Probable] tarda unos pocos minutos por hora de audio.
- **Dónde se guarda:** ficha del cante, `voces: {tramos, n, nombres: {0: 'Hablante 1', …}, fecha}`; en una clase, `voces: {<audio>: {…}}` en `clase.json`.
- **Qué se ve:** leyenda con un color por voz, su nombre (se edita ahí: «Yo», «Preparadora») y su tiempo total; en el texto, una etiqueta con el nombre
  al empezar cada intervención (los párrafos se cortan al cambiar de voz). Cada palabra (o frase, en las clases) toma la voz del tramo en que cae;
  si cae en un hueco, la del tramo más cercano (`hablanteEn`, igual en `voces.js`, `media/cante.js` y `media/idiomasPracticas.js`).
- **Corregir a mano** (v0.46.1): pulsar la etiqueta de color de una intervención abre la lista de voces (y *Otra voz*, por si juntó dos personas):
  cambia **solo esa intervención** (las palabras seguidas de la misma voz). Con palabras seleccionadas, *Asignar a voz ▾* cambia **solo esas palabras**
  (la intervención se parte si hace falta). Cambiar el nombre en la leyenda es lo único que afecta a toda la conversación (no cambia quién dijo qué).
  `asignarVoz` parte los tramos que se solapan y une los seguidos de la misma voz; la ficha queda con `voces.corregido: true`. En las clases, igual, por frase.
- **Límites:** va bien con dos voces claras; falla más con grabaciones a distancia, voces que se pisan o parecidas. No hay botón para marcar la exposición
  a partir de las voces (decisión del usuario: por si se equivoca).
- Lo guardado (🔒) no se puede volver a identificar ni renombrar hasta pulsar *Editar*.

## 9. Ideas para más adelante (no hechas)

- Comparar la transcripción con el `main.tex` del tema: epígrafes no mencionados, orden y tiempo por epígrafe.
- Evolución de la duración y del ritmo por tema y por vuelta.
- Registrar el cante con la preparadora (acción pendiente en `CONTEXTO.md`).
