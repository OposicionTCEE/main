# Historial de cambios: cómo funciona y cómo deshacer

Cada vez que sincronizas, Git guarda una **foto** de todos los temas que has cambiado (un *commit*), con la fecha
y los temas tocados, por ejemplo: `Cambios del 2026-10-03 18:40 (3.A.19 4.B.11)`.
Esas fotos no se borran nunca: puedes volver a cualquier versión anterior de cualquier tema.

> Regla de oro: **una foto solo existe si has sincronizado.** Lo que escribes entre dos sincronizaciones está
> en tu Mac, pero todavía no en el historial. Sincroniza al empezar y al terminar cada sesión.

---

## 1. Ver el historial

### En VS Code (lo más cómodo)
1. Abre el `main.tex` del tema.
2. En la barra izquierda, **Explorador** › abajo del todo, sección **Línea de tiempo** (*Timeline*).
3. Aparece una lista con cada versión guardada de ese archivo (fecha y mensaje).
4. Haz clic en una: VS Code abre una comparación, a la izquierda la versión antigua y a la derecha la actual,
   con lo añadido en verde y lo quitado en rojo.

### En GitHub (desde cualquier dispositivo, también el iPad)
1. Entra en <https://github.com/OposicionTCEE/temario> y navega hasta la carpeta del tema.
2. Abre `main.tex` y pulsa **History** (arriba a la derecha).
3. Cada línea es una versión; al pulsarla ves qué cambió.

### Lo anterior a la unificación (antes del 03/10/2026)
El repositorio `temario` conserva el historial completo de los antiguos repositorios `Tema-X.Y.Z`.
Esos repositorios siguen existiendo en GitHub como copia de seguridad, archivados (solo lectura).

---

## 2. Deshacer cambios

Hay tres situaciones. **Si tienes dudas, pídeselo a Claude**: «recupera la versión de 3.A.19 del martes»,
«deshaz los cambios que hice hoy en 4.B.11». Claude te enseñará qué va a cambiar antes de hacerlo.

### a) Aún no has sincronizado y quieres tirar lo que has escrito
- En VS Code: icono de **Control de código fuente** (barra izquierda, el de las ramas) › en la lista de
  cambios, clic derecho sobre el archivo › **Descartar cambios**.
- Vuelve a la última versión sincronizada. **Lo descartado no se puede recuperar.**

### b) Recuperar un fragmento de una versión antigua
1. Abre la versión antigua desde la **Línea de tiempo** (apartado 1).
2. Copia el fragmento que quieras de la columna izquierda y pégalo en tu archivo actual.
3. Sincroniza. El resto del tema no cambia.

Es la forma más segura y la recomendada para el día a día.

### c) Devolver un tema entero a una versión anterior
Pídeselo a Claude, indicando el tema y la fecha. Lo que hace por debajo:
```
git log -- Ejercicio-3/Parte-A/3.A.19            # lista de versiones del tema
git restore --source=<versión> -- Ejercicio-3/Parte-A/3.A.19   # trae esa versión
```
Después se sincroniza como un cambio más, así que **también esto se puede deshacer**: la versión que
sustituyes sigue guardada en el historial.

---

## 3. Lo que nunca debe hacerse
- Borrar o renombrar carpetas de temas desde Finder con VS Code abierto: hazlo desde VS Code o pídeselo a Claude.
- Usar comandos de Git que «reescriben» el historial (`reset --hard`, `push --force`): pueden borrar fotos.
  Los scripts del entorno no los usan nunca.
- Editar el mismo tema a la vez en dos sitios (por ejemplo, en el Mac y en la web de GitHub) sin sincronizar entre medias:
  provoca un conflicto (no se pierde nada, pero hay que elegir qué versión se queda).

## 4. Glosario mínimo
| Palabra | Qué significa aquí |
|---|---|
| Repositorio | Carpeta cuyo historial controla Git (`main` y `temario`) |
| Commit | Una foto del estado de los archivos, con fecha y descripción |
| Sincronizar | Guardar foto + traer lo de GitHub + subir lo tuyo (tarea *Sincronizar todos los temas con GitHub*) |
| Conflicto | El mismo fragmento cambió en dos sitios; hay que elegir cuál se queda |
| Archivado | Repositorio de GitHub en solo lectura: se puede consultar, no modificar |
