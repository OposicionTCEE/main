# Guía de instalación y uso del entorno TCEE (Mac)

Esta guía está pensada para hacerse una sola vez, con calma, en unos 60–90 minutos (la mayor parte es esperar descargas).
Al terminar tendrás en tu Mac:

- **VS Code**: el editor donde escribes los temas, con el PDF al lado (como Overleaf).
- **MacTeX**: el programa que convierte el `.tex` en PDF. Funciona **sin internet**.
- **Git**: guarda el historial y sincroniza con GitHub cuando tienes conexión.
- **Claude Code**: Claude dentro del editor, con acceso a tus temas.

> Cómo leer esta guía: lo que aparece `en este formato` se escribe o se copia tal cual.
> «Terminal» es una aplicación de tu Mac: pulsa `⌘ + espacio`, escribe *Terminal* y pulsa Intro.
> Para pegar un comando en Terminal: `⌘ + V` y después Intro.

---

## Paso 0 · Antes de empezar (importante)

1. **Deja de editar en Overleaf** desde este momento. Si tienes cambios en Overleaf que no estén en GitHub, súbelos primero desde Overleaf (*Menú › GitHub › Push Overleaf changes to GitHub*) en cada proyecto que hayas tocado.
2. **No canceles Overleaf todavía.** Hazlo cuando lleves unos días trabajando con este entorno sin problemas.
3. Seis temas no generan PDF por errores graves en el texto (no por el programa); puedes seguir editándolos igual: 3.A.9, 3.B.13, 3.B.18, 3.B.43, 4.B.15 y 4.B.25. El detalle está en [ESTADO_COMPILACION.md](ESTADO_COMPILACION.md). Claude puede corregirlos cuando quieras.

---

## Paso 1 · Instalar MacTeX (el compilador de LaTeX)

1. Entra en <https://www.tug.org/mactex/> y descarga **MacTeX.pkg** (unos 6 GB; tarda).
2. Abre el archivo descargado y sigue el instalador (Continuar › Instalar). Te pedirá la contraseña del Mac.
3. Cuando termine, **reinicia el Mac** (así todos los programas encuentran el compilador).

## Paso 2 · Comprobar Git

1. Abre **Terminal** y pega:
   ```
   git --version
   ```
2. Si aparece algo como `git version 2.x`, ya está.
   Si aparece una ventana ofreciendo instalar las *herramientas de línea de comandos*, pulsa **Instalar**, espera a que termine y repite el comando.
3. Dile a Git quién eres (sale en el historial de cambios). Cambia el nombre y pon **el correo de tu cuenta de GitHub**:
   ```
   git config --global user.name "Tu Nombre"
   git config --global user.email "tu-correo-de-github@ejemplo.com"
   ```

## Paso 3 · Instalar VS Code

> **Si ya tienes VS Code instalado, salta este paso.**

1. Descarga VS Code de <https://code.visualstudio.com/> (botón *Download for Mac*).
2. Abre el `.zip` descargado y arrastra **Visual Studio Code** a la carpeta **Aplicaciones**.
3. Ábrelo una vez desde Aplicaciones para que macOS lo autorice.

## Paso 4 · Descargar todos los temas

En **Terminal**, pega estas líneas (una a una, o todas juntas):

```
mkdir -p ~/TCEE
cd ~/TCEE
git clone https://github.com/OposicionTCEE/main.git
bash main/scripts/descargar_temario.sh
```

Crea la carpeta **TCEE** en tu carpeta personal y descarga dentro `main` (herramientas) y `temario` (los 110 temas, en carpetas por ejercicio y parte). Al final dirá *Todo listo*.
Puedes repetir el último comando cuando quieras: solo descarga lo que falte.

**Acceso desde tu carpeta de la oposición**: en Finder, ve a tu carpeta personal, haz clic derecho sobre **TCEE** › *Crear alias* y arrastra el alias a *iCloud Drive › OPO - TCEE*. No muevas la carpeta TCEE dentro de iCloud: iCloud y Git se pisan y pueden dañar los temas.

## Paso 5 · Abrir el espacio de trabajo

1. En VS Code: menú **File › Open Workspace from File…** (en español: *Archivo › Abrir área de trabajo desde archivo…*).
2. Ve a tu carpeta personal › **TCEE › main** y elige **TCEE.code-workspace**.
3. Abajo a la derecha aparecerá un aviso de **extensiones recomendadas**: pulsa **Instalar**. Son tres:
   - *LaTeX Workshop* (compilar y ver el PDF),
   - *Claude Code* (Claude dentro del editor),
   - *Spanish Language Pack* (menús en español; pedirá reiniciar VS Code).

   Si el aviso no sale: icono de **Extensiones** en la barra de la izquierda (cuatro cuadrados), escribe `@recommended` e instala las tres.

A partir de ahora, abre siempre VS Code así (o desde *Archivo › Abrir reciente*).

## Paso 6 · Conectar VS Code con GitHub

1. Abajo a la izquierda, pulsa el icono de **persona (Cuentas)** › *Iniciar sesión con GitHub*.
2. Se abrirá el navegador: autoriza a VS Code con tu cuenta de GitHub.

La primera vez que sincronices (paso 8) puede volver a pedirte autorización: acéptala.

## Paso 7 · Escribir y compilar un tema

1. En la barra izquierda, icono de **Explorador** (dos hojas). Abre, por ejemplo, `temario › Ejercicio-3 › Parte-A › 3.A.43 › main.tex`.
2. **Compilar**: `⌘ + ⌥ + B` (o el icono **TeX** de la barra izquierda › *Build LaTeX project*). La primera vez tarda en torno a un minuto.
3. **Ver el PDF**: `⌘ + ⌥ + V`. Se abre en una pestaña; arrástrala a la derecha para tenerla al lado del texto.
4. **Saltar del PDF al texto**: doble clic sobre el PDF. **Del texto al PDF**: `⌘ + ⌥ + J`.
5. Los cambios **se guardan solos**, compile o no el documento. Guardar y compilar son cosas independientes.

**Dónde queda el PDF**: dentro de la carpeta del tema (`3.A.43 › 3.A.43.pdf`), junto a `main.tex` y la carpeta `Img` de las figuras. Las imágenes nuevas guárdalas siempre en `Img`.

**El PDF también va a iCloud** (para leerlo en el iPad): cada vez que un tema compila, se copia a *iCloud Drive › OPO - TCEE › PDF temas* con el nombre del tema (p. ej. `Tema-3.A.43.pdf`). Los PDF **no** se suben a GitHub.
Para tener todos los PDF de golpe: **Terminal › Ejecutar tarea…** › **Compilar todos los temas (PDF a iCloud)** (tarda entre 10 y 30 minutos).

**Qué pasa cuando la compilación falla** (igual que en Overleaf):
- Con errores menores (un carácter raro, un `$` suelto…), el PDF se genera igualmente.
- Con un error grave (una llave o una nota al pie sin cerrar), no se puede generar un PDF nuevo: **se mantiene el último PDF que compiló bien** y aparece un aviso. Tu texto está guardado y se sincronizará con GitHub igual.

Los avisos de error de compilación no saltan en pantalla (hay muchos antiguos en los temas). Para verlos: menú **Ver › Problemas**.

### Atajos de escritura

Escribe el atajo y pulsa **Tab**; con Tab saltas de un hueco al siguiente.

| Atajo | Inserta |
|---|---|
| `eqb` | Bloque `\eqblock` con `aligned` y pie (**nombra el modelo en el pie**) |
| `img` | Figura `\imagenfit{archivo}{título}{fuente}` |
| `rec` | Recuadro `specialblock` |
| `lnum` / `la` | Listas numerada / simple |
| `vertema` | Remisión `([Ver Tema …])` |
| `ojo` | Nota **(OJO: …)** |
| `anexo` · `pclave` | Anexo · Puntos clave |

## Paso 8 · Sincronizar con GitHub

Un solo botón sube tus cambios y trae los que haya en GitHub, para todos los temas a la vez:

1. Menú de arriba **Terminal › Ejecutar tarea…** (o `⌘ + ⇧ + P` › **Tareas: Ejecutar tarea**).
   No uses los comandos que empiezan por *Git:* (sincronizan un solo repositorio y pueden fallar).
2. Elige **Sincronizar todos los temas con GitHub**.
3. Al final verás un resumen: qué se ha subido, qué se ha actualizado y si hay algún problema.

**Sin conexión**: trabaja con normalidad. Si lanzas la sincronización sin internet, te dirá que no ha hecho nada y tus cambios siguen en el Mac. Sincroniza cuando vuelvas a tener conexión.

**Si te avisa de un conflicto** (el mismo texto se cambió en GitHub y en tu Mac): no se toca nada. Pídele a Claude *«resuelve el conflicto de sincronización»* y te enseñará las dos versiones para que elijas.

### Rutina recomendada
1. Al empezar (con conexión): **Sincronizar**.
2. Trabajar.
3. Al terminar: **Sincronizar**.

## Paso 9 · Usar a Claude dentro del editor

1. Pulsa el icono de **Claude** (arriba a la derecha del editor o en la barra lateral) y entra con tu cuenta de Claude.
2. Pídele cosas en lenguaje normal, por ejemplo:
   - *«¿En qué otros temas se desarrolla el modelo que estoy escribiendo?»*
   - *«Hazme un esquema del epígrafe 2.1 de este tema.»*
   - *«Compara cómo está presentado el modelo de Solow aquí y en 3.A.44.»*
   - *«Corrige los errores de compilación de 3.B.13.»*
3. Claude lee las instrucciones de `main/CLAUDE.md` en cada sesión (convenciones de los temas y tu estilo de interacción).

Claude necesita internet; editar y compilar, no.

---

## Problemas frecuentes

| Qué pasa | Qué hacer |
|---|---|
| Al compilar: *latexmk no encontrado* | MacTeX no está instalado o no se reinició el Mac tras instalarlo (paso 1). |
| Git dice *Please tell me who you are* | Falta el paso 2.3. |
| La sincronización dice *No se pudo sincronizar* | Inicia sesión en GitHub (paso 6) y vuelve a sincronizar. |
| Un tema no genera PDF | Mira [ESTADO_COMPILACION.md](ESTADO_COMPILACION.md) o pídele a Claude que lo revise. |
| No veo los atajos (`eqb`…) | Ejecuta la tarea **Descargar el temario (si falta)** (los reinstala) y reabre VS Code. |

## Paso 10 · Panel TCEE

El panel propio de la oposición: icono **TCEE** en la barra izquierda, con dos ventanas.

**Instalarlo o actualizarlo** (una vez, y cada vez que Claude te diga que hay versión nueva):
1. **Terminal › Ejecutar tarea… › Instalar o actualizar el panel TCEE**.
2. Cuando ponga *Listo*: `⌘ + ⇧ + P`, escribe `Recargar ventana` y elige **Desarrollador: Recargar ventana**.

**Si no aparece el icono TCEE** (instalación a mano, no necesita la tarea):
1. Icono de **Extensiones** (cuatro cuadrados) › botón **«…»** arriba del todo › **Instalar desde VSIX…**
2. Elige `TCEE › main › extension › tcee-panel.vsix` › **Instalar**.
3. `⌘ + ⇧ + P` › **Desarrollador: Recargar ventana**.
4. Si sigue sin verse: clic derecho en la barra de iconos de la izquierda y comprueba que **TCEE** está marcado.

**Qué hace**
- **Arriba, Acciones**: *Compilar tema* (el que se ve en el índice) y *Sincronizar con GitHub*.
- **Abajo, Índice**: el título de la ventana es el título del tema; debajo, en pequeño, el subtítulo.
  Numeración desde Introducción = 1 hasta la Conclusión, y después los anexos (A1, A2…).
  Pulsa un epígrafe para saltar a él. Los epígrafes sin contenido llevan ○ y la palabra *vacío*.
- **Qué índice se muestra**: el del tema donde está el cursor. Si pasas al PDF o a otra pestaña, se queda el último tema.
  Con el botón 📌 (arriba a la derecha del índice) lo fijas a ese tema aunque escribas en otro; vuelve a pulsarlo para soltarlo.

Las pestañas de los temas se llaman por su código (**3.A.19**) en lugar de *main.tex*.
