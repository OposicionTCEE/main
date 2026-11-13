// Panel Oposición: conserva la posición de lectura cuando se repinta una pestaña.
// Las pestañas se pintan con innerHTML: al repintar, las cajas con barra de desplazamiento son elementos nuevos y vuelven arriba.
// Este módulo recuerda qué cajas ha movido el usuario (escucha «scroll» en toda la página), las identifica por su ruta
// estable dentro de la pestaña (id o etiqueta y clases, con su posición entre hermanos iguales) y, tras repintar,
// devuelve cada una a donde estaba. Reglas: main/CANTE.md, apartado «Posición de lectura».
//
// Uso (lo llama panel.js; las pestañas que se repintan por su cuenta, también):
//   TCEE_DESPLAZAMIENTO.conservar(contenedor, () => repintar())   // repinta sin mover la lectura
//   const foto = TCEE_DESPLAZAMIENTO.foto(contenedor); …; TCEE_DESPLAZAMIENTO.restaurar(contenedor, foto)
(function () {
  'use strict';
  /** Cajas que el usuario ha desplazado alguna vez (se olvidan solas cuando desaparecen de la página) */
  const movidas = new Set();
  document.addEventListener('scroll', (ev) => { if (ev.target instanceof Element) movidas.add(ev.target); }, { capture: true, passive: true });

  /** Paso de ruta de un elemento: su id si lo tiene; si no, etiqueta + clases + orden entre hermanos con la misma firma */
  function paso(e) {
    if (e.id) return `#${e.id}`;
    const firma = (x) => `${x.tagName.toLowerCase()}.${[...x.classList].sort().join('.')}`;
    const f = firma(e);
    let i = 0;
    for (let h = e.previousElementSibling; h; h = h.previousElementSibling) if (firma(h) === f) i++;
    return `${f}:${i}`;
  }
  /** Ruta del elemento dentro de la raíz (null si no está dentro) */
  function ruta(raiz, e) {
    const pasos = [];
    for (let x = e; x && x !== raiz; x = x.parentElement) {
      pasos.unshift(paso(x));
      if (x.id) break;   // un id basta para encontrarlo después
    }
    return raiz.contains(e) && e !== raiz ? pasos : null;
  }
  /** Busca el elemento de una ruta en la raíz (o null si ya no existe) */
  function buscar(raiz, pasos) {
    let x = raiz;
    for (const p of pasos) {
      if (p.startsWith('#')) { x = raiz.querySelector(`[id="${CSS.escape(p.slice(1))}"]`); if (!x) return null; continue; }
      const [f, n] = p.split(':');
      let i = 0, hallado = null;
      for (const h of x.children) {
        const fh = `${h.tagName.toLowerCase()}.${[...h.classList].sort().join('.')}`;
        if (fh === f) { if (i === Number(n)) { hallado = h; break; } i++; }
      }
      if (!hallado) return null;
      x = hallado;
    }
    return x;
  }

  /** Foto de la posición: la de la página y la de cada caja desplazada dentro de la raíz */
  function foto(raiz) {
    const cajas = [];
    for (const e of [...movidas]) {
      if (!e.isConnected) { movidas.delete(e); continue; }
      if (!e.scrollTop && !e.scrollLeft) continue;
      const r = ruta(raiz, e);
      if (r) cajas.push({ ruta: r, arriba: e.scrollTop, izquierda: e.scrollLeft });
    }
    return { pagina: window.scrollY, cajas };
  }

  /** Devuelve cada caja (y la página) a la posición de la foto */
  function restaurar(raiz, f) {
    if (!f) return;
    for (const c of f.cajas) {
      const e = buscar(raiz, c.ruta);
      if (e) { e.scrollTop = c.arriba; e.scrollLeft = c.izquierda; movidas.add(e); }
    }
    if (Math.abs(window.scrollY - f.pagina) > 1) window.scrollTo(window.scrollX, f.pagina);
  }

  /** Ejecuta el repintado sin mover la lectura */
  function conservar(raiz, repintar) {
    const f = foto(raiz);
    const r = repintar();
    restaurar(raiz, f);
    return r;
  }

  window.TCEE_DESPLAZAMIENTO = { foto, restaurar, conservar };
})();
