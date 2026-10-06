# Pestaña Idiomas (Panel Oposición)

Gadget para preparar el ejercicio de idiomas de la oposición: inglés obligatorio y un segundo idioma (al principio, francés).
Es una **academia continua**, no una copia de la estructura del examen. Cubre **de A1 a C2**: un usuario puede dominar cosas de B2 y no saber algunas de A2.

Mantener este documento y el código a la vez.

## Decisiones (octubre de 2026, con el usuario)

- **Sin «definir el nivel» a mano.** La primera vez se crea un **perfil**: nombre, segundo idioma y nivel orientativo de cada idioma.
  El panel ajusta el nivel con lo que observa y avisa cuando cree que el real es otro.
- **Datos del usuario solo en local**, en `TCEE/idiomas-<nombre>/`, fuera de los repositorios: progreso, errores, escritos y grabaciones.
- **Contenido** en el repositorio público `idiomas` (`TCEE/idiomas`), que se descarga y actualiza con *Sincronizar*.
- **Compromiso flexible**: reglas sueltas y opcionales del tipo «francés, cada día, 30 min», «inglés, 1 vez por semana, sin duración»
  o «francés, cada 2 semanas el martes, 60 min». Siempre está el botón *Empezar sesión ahora*. Nunca bloquea nada.
- **Sesiones a elección**: Gramática, Léxico, Escrito, Oral, Escucha, Al azar, Tipo examen y Repaso.
  En la sesión tipo examen, el usuario **lee en voz alta su propio resumen**.
- **Sin tarjetas sueltas.** Se repasan **fichas enteras** (cada repaso, ejercicios distintos), con el calendario de repaso de ts-fsrs.
  Hay un **cuaderno de errores** (cada error, vinculado a su ficha) y un **banco de expresiones por función**.
- **Todo dentro del panel**, también la escritura, y **sin corrector mientras se escribe**: la corrección llega al enviar.
- **Reutilizar antes que generar.** Se reutiliza todo el material abierto que se pueda, citándolo, y Claude escribe solo los huecos.
  Claude no se usa en cada sesión: el material se prepara de antemano y la corrección abierta la hace un **modelo local**.
  El Mac del usuario tiene 8 GB de RAM: modelo pequeño (≈2–3 GB) con Ollama, y una tarea pesada cada vez.
- **Temas variados**, no solo economía. Cada texto lleva su campo semántico y el panel los rota.
- **Longitud flexible**: corto (≈150 palabras), estándar (≈400, por defecto), largo (≈800+) o a medida, cortando siempre por párrafos.
- **Tareas de escritura variadas** con plantillas (resumen, opinión, carta, correo, réplica, nota…) y una **rúbrica** fija:
  cumplimiento de la tarea, coherencia, registro, corrección y vocabulario.
- **Medios de pago**: solo los enlaces que el usuario ponga en Ajustes. Descarga semanal desde su navegador, con su sesión iniciada;
  se borran al renovarse y nunca salen del Mac. El riesgo frente a las condiciones de uso de cada medio lo asume el usuario.
- **Vídeo**: canales públicos (BBC, France 24, Arte, TV5Monde, VOA), incrustados o abiertos en el navegador; nunca se descargan,
  salvo VOA, que es de dominio público.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Repositorio `idiomas`, este documento, *Sincronizar* lo descarga, tarea «Descargar fuentes de idiomas» | En curso |
| 1 | Perfil, Ajustes, compromisos; índice A1→C2; fichas de gramática y ejercicios con respuesta fija; léxico; sesiones Gramática, Léxico, Repaso y Al azar; mapa de materias, cuaderno de errores, repaso y primer ajuste de nivel | En curso |
| 2 | Biblioteca de textos (nivel, tema, palabras clave), longitud flexible, Escucha (voz del Mac), Escrito (plantillas y rúbrica, LanguageTool y modelo local), instalador de Ollama | Pendiente |
| 3 | Oral (whisper, métricas), tribunal (preguntas con voz), sesión tipo examen, vídeo | Pendiente |
| 4 | Descarga semanal de medios de pago; informe de progreso opcional en «Rehacer informes» | Pendiente |

## Fuentes y licencias

Solo se **copian** al repositorio `idiomas` fuentes con licencia abierta, citando la autoría.
Las webs gratuitas pero con todos los derechos reservados (TV5Monde, BBC Learning English, RFI…) solo se **enlazan**.

| Fuente | Uso | Licencia |
|---|---|---|
| Tex's French Grammar (COERLL, Universidad de Texas) | Explicaciones y ejercicios de gramática francesa A1–B1 | CC BY 3.0 |
| Tatoeba | Frases reales con traducción (y algunos audios) para ejercicios | CC BY 2.0 FR; audios según su autor (solo los libres) |
| EFLLex / FLELex (CENTAL, UCLouvain) | Nivel del Marco Europeo de cada palabra | CC BY-NC-SA 4.0 |
| ipa-dict (open-dict-data) | Pronunciación de cada palabra (AFI) | MIT |
| mlconjug3 | Tablas de conjugación | MIT |
| wordfreq | Frecuencia de las palabras | Datos CC BY-SA 4.0 |
| Core Inventory for General English (British Council–EAQUALS) | Solo como índice de materias (no se copia el texto) | © British Council |
| Inventaire linguistique des contenus clés (Eaquals–CIEP) | Solo como índice de materias (no se copia el texto) | © Eaquals/CIEP |
| VOA Learning English | Textos y audios en inglés (fase 2) | Dominio público |
| Wikipedia, Wikinews, Vikidia, Wikisource | Textos de todos los temas (fase 2) | CC BY-SA / dominio público |

El entorno de Claude no llega a la mayoría de estas webs. Por eso la tarea **Descargar fuentes de idiomas**
(`scripts/idiomas/descargar_fuentes.sh`) las baja en el Mac a `TCEE/.fuentes-idiomas/` (fuera de GitHub).
Claude las recoge desde ahí, fabrica el paquete con los programas de `scripts/idiomas/` y lo sube al repositorio `idiomas`.

## Repositorio `idiomas`

```
idiomas/
  README.md, LICENCIAS.md          atribuciones de cada fuente
  <lengua>/                        fr, en
    materias.json                  índice A1→C2: id estable, bloque, título, nivel, descripción, fuente, ficha
    fichas/<id>.json               explicación, ejemplos y ejercicios propios de la ficha
    ejercicios/<id>.json           banco de ejercicios de respuesta fija, montado por programa
    lexico.json                    palabras por nivel y campo semántico, con pronunciación y ejemplos
    expresiones.json               expresiones por función (introducir, matizar, contraponer, concluir…)
```

Los `id` de materias y ejercicios **no cambian nunca**: el progreso del usuario se guarda con ellos.

## Datos del usuario (`TCEE/idiomas-<nombre>/`)

```
perfil.json        nombre, idiomas, nivel orientativo y estimado por bloque, compromisos, ajustes
sesiones.jsonl     una línea por sesión: fecha, idioma, tipo, minutos, materias, resultados
repaso.json        estado del repaso de cada ficha (ts-fsrs)
errores.json       cuaderno de errores: frase, corrección, ficha, fecha, veces
escritos/, audio/  lo que el usuario escribe y graba (fases 2–3)
```
