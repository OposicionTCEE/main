# Contexto del proyecto (para seguir trabajando en Claude Code)

Resumen de lo construido hasta el 4 de octubre de 2026 y de lo que queda pendiente.
Claude Code lee `CLAUDE.md` en cada sesión. Este documento completa ese fichero con la historia y las decisiones tomadas.

## Cómo trabajar desde Claude Code (en el Mac)

- Abre VS Code con el espacio de trabajo `TCEE` y abre Claude Code en esa ventana.
  El fichero `TCEE/CLAUDE.md` remite a `main/CLAUDE.md`, que contiene las convenciones, el estilo de respuesta y las piezas del panel.
- En local, Claude Code edita directamente los ficheros del Mac. No hace falta abrir PR: basta con **Sincronizar** al terminar.
  Antes de tocar varios temas a la vez, debe enseñar qué va a cambiar y esperar el visto bueno (regla de `CLAUDE.md`).
- **Panel TCEE**: después de cambiar algo en `main/extension/`:
  1. Volver a empaquetar con `npx @vscode/vsce package --skip-license --allow-missing-repository -o tcee-panel.vsix`, dentro de `main/extension/`.
     Hace falta Node.js en el Mac: si `node -v` no responde, instalarlo desde nodejs.org (paquete para macOS).
  2. Ejecutar la tarea **Instalar o actualizar el panel TCEE**.
  3. **Desarrollador: Recargar ventana**.

  Las pruebas se hacen con scripts de Node que cargan los módulos puros: `parser.js`, `progreso.js`, `inferencia.js`, `afinidad.js`, `calendario.js`, `desarrollos.js`.

## Repositorios (organización OposicionTCEE)

| Repositorio | Visibilidad | Contenido |
|---|---|---|
| `main` | público | Entorno: scripts, panel, análisis, documentación |
| `temario` | público | Los temas (`Ejercicio-X/Parte-Y/X.Y.N/main.tex` + `Img/`) |
| `progreso` | **privado** | Tiempos y temas hechos (`equipos/`), plan semanal y calendarios (`calendarios/`) |

Nada de `progreso` se copia nunca a `main` ni a `temario`.

## Qué hay construido

- **Entorno** (`GUIA_INSTALACION.md`):
  - VS Code, MacTeX, compilación sin conexión (`scripts/compilar.sh`), con el PDF en la carpeta del tema y en iCloud;
  - sincronización de los tres repositorios (`scripts/sincronizar_todo.sh`);
  - historial y cómo deshacer cambios (`HISTORIAL.md`).
- **Panel TCEE** (extensión propia, barra lateral derecha):
  - **Acciones**: Compilar, Sincronizar, Nueva nota, Panel Oposición (se abre en una ventana aparte) y Rehacer informes (estado de `armonizacion.json` y encargo copiado para Claude Code). En la cabecera, *Tiempo restante (%)* y el botón ✓ *Hecho*.
  - **Índice** del tema con todos los niveles, *paragraph* incluidos, y ○ en los epígrafes vacíos.
  - **Nueva nota**: deduce el tema de destino y escribe la nota en `\modificaciones`.
  - **Tiempo restante y progreso**: reglas en `PROGRESO.md`.
- **Panel Oposición** (pestaña):
  - **Calendario de vueltas** (reglas y razonamiento en `CALENDARIO.md`):
    - generación temática, correlativa o aleatoria, eligiendo por qué tema empezar;
    - reparto de los temas entre los días de estudio;
    - librar días y mover el cante;
    - recolocar un tema, traer un tema, ampliar o reorganizar el calendario;
    - eliminar calendarios.
  - **Temas**: tabla de todos los temas con tiempo restante y casilla de hecho.
  - **Relaciones** (reglas en `RELACIONES.md`): mapa de temas unidos por modelos (resalta el tema abierto y sus asociados) y panel con
    los modelos que comparte el tema abierto, fichas resumidas de los otros temas para comparar (ecuaciones con KaTeX) y,
    sin tema abierto, la lista de modelos que conviene armonizar.
  - **Cante** (reglas en `CANTE.md`): cronómetro y grabación con un botón; al terminar se transcribe en el Mac (whisper.cpp)
    y, al pulsar *Transcribir* (no se hace sola, por la batería), la transcripción queda en `progreso/cantes/`. Historial con duración, palabras por minuto y texto por minutos.
  - El **plan semanal** se eliminó en la v0.11 a petición del usuario (el calendario lo sustituye).
- **Análisis**: `analisis/Modelos_temario_TCEE.xlsx`, `analisis/Desarrollos_modelos_TCEE.xlsx`, `analisis/desarrollos.json`
  y `analisis/armonizacion.json` (34 informes de armonización escritos por Claude; se actualizan con `scripts/armonizacion.js`).
- **Programa del 3er ejercicio**: `config/programa_3.json`. Cada tema tiene título, resumen, etiqueta breve y ámbitos.

## Decisiones tomadas con el usuario (no reabrir sin motivo nuevo)

- **«Hecho»** significa listo para pasar a estudiar sobre esquema, no memorizado.
- El **tiempo restante** se muestra como un único número y un porcentaje, sin desglosar los indicadores.
  Introducción, Conclusión y Preguntas Test no cuentan.
- El **calendario** se genera con código y reglas fijas (ámbitos y pesos aprendidos del calendario de la preparadora), no con un agente.
  - El 3er y el 4º ejercicio no se mezclan nunca.
  - La semana termina el día de cante. Hay un día libre semanal, el sábado.
  - Los temas de una semana pasada se dan por **trabajados**: no se marca nada.
- El **cante con la preparadora** (un tema por semana) será una **acción aparte**, aún por definir.

## Pendiente

1. **Cante**: la pestaña de práctica está hecha (v0.13, sin probar aún en el Mac del usuario). Ideas siguientes en `CANTE.md`, apartado 6;
   registrar el cante con la preparadora sigue por definir.
2. **4º ejercicio**:
   - falta su programa (crear `config/programa_4.json` siguiendo `CALENDARIO.md`, apartado 12);
   - el 4 de octubre de 2026 el usuario añadió 4.A.1 a 4.A.30 y 4.B.1, 4.B.2 y 4.B.4 a 4.B.6 como esqueletos (145 carpetas en total);
     **4.A.11 es una copia exacta de 4.A.1** (mismo título «Fuentes Estadísticas españolas»): preguntar al usuario;
   - cuando tengan desarrollos, rehacer `analisis/desarrollos.json` para que entren en Relaciones.
3. **Posibles errores en los desarrollos de modelos** (`analisis/armonizacion.json`): 76 confirmados por verificación independiente
   y 1 dudoso, en 38 temas. Se ven en la pestaña Relaciones con enlace a la línea. No corregir ningún tema sin enseñar antes el cambio
   al usuario y esperar su visto bueno; tras corregir, actualizar los informes (`RELACIONES.md`, apartado 4).
4. **Limpieza de Markdown y OCR pegados**: hay unas 986 etiquetas `[Seguro]/[Probable]/[Suposición]` en 14 temas, `**` en 9, `�` en 35 y `#` sueltos en 20. Hay que enseñar los cambios al usuario antes de aplicarlos.
5. **Temas que no generan PDF**: 3.A.9, 3.B.13, 3.B.18, 3.B.43, 4.B.15 y 4.B.25 (ver `ESTADO_COMPILACION.md`).
6. **Imágenes referenciadas que faltan** (probablemente solo estaban en Overleaf):
   - 3.A.11: Esquema_TiempoProduccion.png
   - 3.A.24: FlowANDstock.png
   - 3.A.29: ACFyPACF.png, Equilibrio_MF.png, JuegosRepetidos_Dilema.png, ProcesoEstacionario.png
   - 3.A.30: CuentaFinanciera.png
   - 3.A.35: MGS_CI.png
   - 3.B.6: IndicePrecios_DIXIT_STIGLITZ.png
   - 3.B.26: Fig6.png
7. Revisar con el usuario las semanas más débiles de la propuesta de la 2ª vuelta (`progreso/calendarios/propuesta-2a-vuelta-3.json`), por ejemplo las semanas 5 y 18.
8. La carpeta `~/TCEE/_antiguos` del Mac se puede borrar cuando el usuario quiera.
