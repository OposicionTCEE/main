# Edición simultánea de un tema (usuario y Claude a la vez)

El usuario y Claude pueden trabajar a la vez en partes distintas del mismo tema sin pisarse. Lo resuelve el panel TCEE al guardar.

## Por qué hace falta

VS Code guarda **el fichero entero**, no solo lo que se ha cambiado, y antes de escribir comprueba si el fichero cambió en el disco
desde que lo cargó. Si Claude ha editado el tema mientras el usuario tenía cambios sin guardar (con el autoguardado, casi siempre
que se está escribiendo), VS Code no sabe combinarlos: preguntaría «Comparar / Sobrescribir», y sobrescribir borraría lo de Claude.

## Cómo funciona

1. El panel recuerda, para cada `.tex` abierto, la versión del disco de la que parte el editor (al abrirlo, al guardarlo y cuando VS
   Code lo recarga porque cambió fuera y no había nada pendiente).
2. Justo antes de cada guardado (`onWillSaveTextDocument`), si el disco ya no coincide con esa versión, combina las tres
   (partida, editor y disco) por líneas, como `git merge-file`: lo que solo cambió un lado se toma de ese lado (`extension/fusion.js`).
   Los cambios del disco entran en el texto del editor como ediciones pequeñas, así que el cursor y las notas contraídas no se mueven.
3. Si los dos tocaron el mismo trozo de forma distinta, se queda el del usuario y, justo debajo, el del disco **comentado** (no sale
   en el PDF), entre `% >>> PANEL TCEE: VERSIÓN DEL DISCO [id]` y `% <<< PANEL TCEE: FIN DE LA VERSIÓN DEL DISCO [id]`. Al terminar
   de guardar aparece un aviso: **Quedarme con la mía** (quita el bloque), **Usar la del disco** (pone la del disco en lugar de la del
   usuario) o **Ver** (lleva al bloque, que se puede resolver después a mano).
4. VS Code guarda el texto ya combinado sin preguntar, porque en `TCEE.code-workspace` está `"files.saveConflictResolution":
   "overwriteFileOnDisk"` para LaTeX. Solo para LaTeX: en los demás ficheros sigue preguntando.

Nada se pierde en ningún caso: además, el hook de autoría guarda en git cada cambio de Claude en cuanto lo hace (`AUTORIA.md`).

**Límite conocido**: VS Code avisa de que, excepcionalmente (por ejemplo, al cerrarse con cambios sin guardar), puede guardar sin
avisar antes a las extensiones. En ese caso no habría fusión, pero el cambio de Claude seguiría en git.
