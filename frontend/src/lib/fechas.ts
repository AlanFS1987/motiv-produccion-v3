// frontend/src/lib/fechas.ts
//
// Fecha "de hoy" en el navegador, SIEMPRE en hora LOCAL, nunca UTC.
//
// Motivo: `new Date().toISOString()` formatea en UTC. España va 1-2h
// por delante de UTC (invierno +1, verano +2), así que entre
// medianoche y la 1-2 de la madrugada hora de Madrid, esa función
// todavía devuelve la fecha de AYER — un descuido que ya causó un bug
// real y documentado una vez (pantalla-carrusel.ts, "el ciclo
// empezaba el 31 y la pantalla mostraba el 30").
//
// Esta es la ÚNICA fórmula correcta que debe usarse en el frontend
// para "qué fecha es hoy" o "qué fecha es esta", en vez de escribirla
// de memoria en cada archivo nuevo.

/** Fecha (YYYY-MM-DD) de un Date dado, en hora LOCAL del dispositivo. */
export function fechaLocalISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha de hoy (YYYY-MM-DD), hora local del dispositivo. */
export function hoyLocalISO(): string {
  return fechaLocalISO(new Date());
}

/**
 * Suma (o resta, con n negativo) n días a una fecha YYYY-MM-DD,
 * trabajando por COMPONENTES de fecha (no por milisegundos de un
 * Date), para no arrastrar el desfase horario local al cruzar la
 * medianoche. Devuelve también en hora local.
 */
export function sumarDiasLocalISO(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d + dias);
  return fechaLocalISO(fecha);
}