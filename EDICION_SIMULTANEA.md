# Edición simultánea de un tema (usuario y Claude a la vez)

El usuario y Claude pueden trabajar a la vez en partes distintas del mismo tema sin pisarse. Lo resuelve el panel TCEE al guardar.

## Por qué hace falta

VS Code guarda **el fichero entero**, no solo lo que se ha cambiado, y antes de escribir comprueba si el fichero cambió en el disco
desde que lo cargó. Si Claude ha editado el tema mientras el usuario tenía cambios sin guardar (con el autoguardado, casi siempre
que se está escribiendo), VS Code no sabe combinarlos: preguntaría «Comparar / Sobrescribir», y sobrescribir borraría lo de Claude.

## Cómo funciona

1. El panel recuerda, para cada `.tex` abierto, la versión del disco de la que parte el editor (la **base**). Solo la toma del disco y
   solo cuando el editor coincide con él: al abrir el tema, al guardarlo, cuando VS Code lo recarga porque cambió fuera y no había nada
   pendiente, y al combinar. Nunca da por buena una versión que no esté en el disco.
2. Justo antes de cada guardado (`onWillSaveTextDocument`), si el disco ya no coincide con la base, combina las tres
   (base, editor y disco) por líneas, como `git merge-file`: lo que solo cambió un lado se toma de ese lado (`extension/fusion.js`).
   Dos cambios en líneas distintas se combinan aunque estén pegados (el usuario en una línea y Claude en la siguiente).
   Los cambios del disco entran en el texto del editor como ediciones pequeñas, así que el cursor y las notas contraídas no se mueven.
   Desde ese momento la base es el disco que se acaba de combinar: si VS Code repite el guardado, no se combina dos veces.
3. Si los dos cambiaron las mismas líneas de forma distinta (o los dos añadieron algo en el mismo punto), se queda el del usuario y,
   justo debajo, el del disco **comentado** (no sale en el PDF), entre `% >>> PANEL TCEE: VERSIÓN DEL DISCO [id]` y
   `% <<< PANEL TCEE: FIN DE LA VERSIÓN DEL DISCO [id]`. Al terminar de guardar aparece un aviso: **Quedarme con la mía** (quita el
   bloque), **Usar la del disco** (pone la del disco en lugar de la del usuario) o **Ver** (lleva al bloque, que se puede resolver
   después a mano). Nunca se escribe un bloque dentro de otro: si el trozo ya tiene uno, se deja el del usuario.
4. VS Code guarda el texto ya combinado sin preguntar, porque en `TCEE.code-workspace` está `"files.saveConflictResolution":
   "overwriteFileOnDisk"` para LaTeX. Solo para LaTeX: en los demás ficheros sigue preguntando.

Nada se pierde en ningún caso: además, el hook de autoría guarda en git cada cambio de Claude en cuanto lo hace (`AUTORIA.md`).

## Si algo va mal

- **Registro**: menú *Ver › Salida* y, en la lista de la derecha, **Panel TCEE: fusión**. Anota cada vez que el disco había cambiado al
  guardar (cuántos cambios del disco y tuyos se combinaron y si hubo conflicto), cada recarga de VS Code y cada elección en un aviso.
  Con un guardado normal no anota nada. Si ves algo raro, copia esas líneas para Claude.
- **Apagarla**: ajuste `tcee.fusionAlGuardar` (*Configuración*, buscar «fusión al guardar»). Al apagarlo, el panel cambia también
  `files.saveConflictResolution` a `askUser` en `TCEE.code-workspace`, para que VS Code vuelva a preguntar «Comparar / Sobrescribir» en
  lugar de sobrescribir lo de Claude; al encenderlo, lo devuelve a `overwriteFileOnDisk`. Ese cambio sale después en «Sincronizar».

## Lo que falló en la versión 0.48 (corregido en la 0.49)

La base se actualizaba en cada cambio del editor que llegaba con `document.isDirty === false`, dando por hecho que entonces el editor
coincidía con el disco. Pero VS Code entrega el **primer cambio después de guardar** con ese dato desfasado (`false`, aunque la tecla ya
esté escrita: microsoft/vscode#27231). La base recibía así texto que solo tenía el usuario; al guardar, la diferencia entre esa base y
el disco parecía un borrado hecho en el disco, y se «combinaba» deshaciendo lo que el usuario acababa de escribir, o creando un bloque
de conflicto nuevo en cada autoguardado. Ahora ese evento solo cuenta si el texto del editor es idéntico al del disco (se comprueba
leyéndolo). La prueba `node main/scripts/prueba_fusion.js` (desde la carpeta TCEE) simula ese comportamiento de VS Code: la 0.48
no la pasa y la 0.49 sí. Claude la ejecuta antes de publicar cualquier cambio en `fusion.js` o en `activarFusion`.

**Límites conocidos**: VS Code avisa de que, excepcionalmente (por ejemplo, al cerrarse con cambios sin guardar), puede guardar sin
avisar antes a las extensiones; en ese caso no habría fusión, pero el cambio de Claude seguiría en git. Y si VS Code se cerró con
cambios sin guardar y Claude cambió el tema antes de volver a abrirlo, el panel no sabe de qué versión partían esos cambios: al
guardar ganan los del usuario (lo de Claude sigue en git).
