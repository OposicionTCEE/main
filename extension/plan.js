// Planificación semanal automática con retoques (sin dependencias de VS Code, para poder probarla aparte)
// Reglas:
//  - Entran los temas no hechos con tiempo restante > 0.
//  - Los temas que fijas a una semana (actual o futura) van a esa semana; si la semana ya pasó, vuelven al reparto automático.
//  - El resto se ordena de menos a más avanzado (%), y a igualdad por código, y se reparte semana a semana
//    con las horas disponibles que quedan tras los fijados. Un tema que no cabe entero continúa en la(s) semana(s) siguiente(s).
'use strict';

const MS_DIA = 86400000;

/** Lunes (YYYY-MM-DD, hora local) de la semana de una fecha */
function lunesDe(fecha = new Date()) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function sumarSemanas(lunes, n) { const [a, m, d] = lunes.split('-').map(Number); return iso(new Date(a, m - 1, d + 7 * n)); }
const porCodigo = (a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true });

/**
 * temas: [{codigo, minutos, pct, hecho}] · (la semana en curso tiene capacidad proporcional a los días que quedan) · ajustes: {horasSemana, fijados: {codigo: lunes}} · lunesActual: 'YYYY-MM-DD'
 * Devuelve [{lunes, capacidad, total, temas: [{codigo, minutos, fijado, parte: 'entero'|'empieza'|'sigue'|'termina'}]}]
 */
function planificar(temas, ajustes, lunesActual, maxSemanas = 104, hoy = new Date()) {
  const cap = Math.max(1, (ajustes.horasSemana || 15) * 60);
  // la semana en curso solo cuenta los días que quedan (hoy incluido): el domingo queda 1/7 de las horas
  const quedan = 7 - ((hoy.getDay() + 6) % 7);
  const fijados = ajustes.fijados || {};
  const pendientes = temas.filter((t) => !t.hecho && t.minutos > 0.5);
  const semanas = [];
  const semana = (k) => {
    while (semanas.length <= k) {
      semanas.push({ lunes: sumarSemanas(lunesActual, semanas.length), capacidad: semanas.length ? cap : Math.max(60, cap * quedan / 7), total: 0, temas: [] });
    }
    return semanas[k];
  };
  const auto = [];
  for (const t of pendientes) {
    const f = fijados[t.codigo];
    const k = f && f >= lunesActual ? Math.round((new Date(f) - new Date(lunesActual)) / (7 * MS_DIA)) : -1;
    if (k >= 0 && k < maxSemanas) {
      const s = semana(k);
      s.temas.push({ codigo: t.codigo, minutos: t.minutos, fijado: true, parte: 'entero' });
      s.total += t.minutos;
    } else auto.push(t);
  }
  auto.sort((a, b) => a.pct - b.pct || porCodigo(a, b));

  let k = 0;
  for (const t of auto) {
    let resto = t.minutos, primera = true;
    while (resto > 0.5 && k < maxSemanas) {
      const s = semana(k);
      const libre = s.capacidad - s.total;
      if (libre < 15) { k++; continue; }             // menos de 15 min libres: a la semana siguiente
      const pone = Math.min(resto, libre);
      resto -= pone;
      const parte = primera ? (resto > 0.5 ? 'empieza' : 'entero') : (resto > 0.5 ? 'sigue' : 'termina');
      s.temas.push({ codigo: t.codigo, minutos: pone, fijado: false, parte });
      s.total += pone;
      primera = false;
      if (resto > 0.5) k++;
    }
  }
  return semanas.filter((s) => s.temas.length);
}

/** Temas que tocan cada semana (para guardar la foto del plan al empezar la semana y luego ver si se cumplió) */
function foto(semanas, lunes) {
  const s = semanas.find((x) => x.lunes === lunes);
  return s ? [...new Set(s.temas.map((t) => t.codigo))] : [];
}

module.exports = { planificar, lunesDe, sumarSemanas, foto };
