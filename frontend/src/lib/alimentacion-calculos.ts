// frontend/src/lib/alimentacion-calculos.ts
// Funciones PURAS (sin React ni Supabase) de la vista Alimentación:
// clasificación de turnos sobre la base de TIEMPO ALIMENTABLE y
// agrupación por tramos de velocidad conseguida. Regla que atraviesa
// todo: al agrupar varios turnos se SUMAN piezas y minutos y se divide
// AL FINAL — nunca se promedian cocientes ya calculados.
//
// Tiempo alimentable = minutos_total − minutos_banco − minutos_maquina:
// el tiempo en que la velocidad de alimentación puede influir. Banco y
// máquina (cambios de modelo, esperas de material, averías) no dependen
// de ella, así que se dejan fuera (memorias/21-alimentacion.md).

import type { TurnoLineaAlimentacion } from "./dashboard-alimentacion";

// ── Fechas ────────────────────────────────────────────────────────

const MS_DIA = 86_400_000;

function aUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aUTC(iso) + dias * MS_DIA).toISOString().slice(0, 10);
}

export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

// ── Reglas de turnos (único sitio donde viven) ────────────────────

export const REGLAS_TURNOS = {
  /** Por encima de estos minutos totales el turno es "excedido" (estadística sin resetear). */
  maxMinutosTotal: 500,
  /** "Solo turnos comparables": casi completos y con poco tiempo no productivo. */
  comparable: { minTotal: 460, maxTotal: 490, maxBancoMasMaquina: 30 },
  /** Por debajo de este tiempo alimentable, el equivalente a 480 min se extrapola demasiado: se dibuja pálido. */
  minAlimentableFiable: 300,
  /** Los equivalentes se expresan en piezas por un turno de estos minutos alimentables. */
  minutosTurnoEquivalente: 480,
} as const;

export interface TurnoAlimentable {
  turno: TurnoLineaAlimentacion;
  /** total − banco − máquina. */
  tiempoAlimentable: number;
  /** piezas ÷ minutos a plena = velocidad conseguida. */
  velocidad: number;
  /** 100 × plena ÷ alimentable. */
  pctPlenaAlimentable: number;
  /** piezas × 480 ÷ alimentable: lo que saldría en 480 min alimentables a ese ritmo. */
  piezasTurnoAlimentable: number;
}

export interface ClasificacionAlimentable {
  turnos: TurnoAlimentable[];
  excluidosMezcla: number;
  excluidosExcedidos: number;
  /** Solo con "turnos comparables": fuera de 460–490 min o con más de 30 min de banco+máquina. */
  excluidosNoComparables: number;
  /** Sin minutos a plena o sin tiempo alimentable. */
  excluidosSinDatos: number;
}

function esComparable(f: TurnoLineaAlimentacion): boolean {
  const c = REGLAS_TURNOS.comparable;
  return f.minutosTotal >= c.minTotal && f.minutosTotal <= c.maxTotal && f.minutosBanco + f.minutosMaquina <= c.maxBancoMasMaquina;
}

export function clasificarAlimentables(filas: TurnoLineaAlimentacion[], soloComparables: boolean): ClasificacionAlimentable {
  const turnos: TurnoAlimentable[] = [];
  let excluidosMezcla = 0;
  let excluidosExcedidos = 0;
  let excluidosNoComparables = 0;
  let excluidosSinDatos = 0;

  for (const f of filas) {
    const alimentable = f.minutosTotal - f.minutosBanco - f.minutosMaquina;
    if (f.formatosDistintos > 1) excluidosMezcla++;
    else if (f.minutosTotal > REGLAS_TURNOS.maxMinutosTotal) excluidosExcedidos++;
    else if (alimentable <= 0 || f.minutosPlena <= 0 || f.piezasMinPlena === null) excluidosSinDatos++;
    else if (soloComparables && !esComparable(f)) excluidosNoComparables++;
    else {
      turnos.push({
        turno: f,
        tiempoAlimentable: alimentable,
        velocidad: f.piezasMinPlena,
        pctPlenaAlimentable: (100 * f.minutosPlena) / alimentable,
        piezasTurnoAlimentable: (REGLAS_TURNOS.minutosTurnoEquivalente * f.piezasTotal) / alimentable,
      });
    }
  }
  return { turnos, excluidosMezcla, excluidosExcedidos, excluidosNoComparables, excluidosSinDatos };
}

// ── Tramos de velocidad conseguida ────────────────────────────────

/** Límites de los tramos de velocidad conseguida (piezas/min). */
export const LIMITES_TRAMOS_VELOCIDAD = [12, 12.5, 13, 13.5, 14, 14.5];

export interface TramoVelocidad {
  etiqueta: string;
  /** Centro del tramo, para dibujarlo (los extremos abiertos usan su límite ± 0,25). */
  centro: number;
  turnos: number;
  pctPlena: number;
  piezasTurno: number;
}

const fmt = (n: number) => n.toLocaleString("es-ES");
const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

/**
 * Agrupa los turnos por tramo de velocidad conseguida y calcula cada
 * tramo SUMANDO piezas y minutos (nunca promediando cocientes). Los
 * tramos sin turnos no aparecen.
 */
export function agruparPorTramoVelocidad(turnos: TurnoAlimentable[]): TramoVelocidad[] {
  const l = LIMITES_TRAMOS_VELOCIDAD;
  const n = l.length + 1;
  const acum = Array.from({ length: n }, () => ({ turnos: 0, piezas: 0, alimentable: 0, plena: 0 }));
  for (const t of turnos) {
    let i = 0;
    while (i < l.length && t.velocidad >= l[i]) i++;
    const a = acum[i];
    a.turnos += 1;
    a.piezas += t.turno.piezasTotal;
    a.alimentable += t.tiempoAlimentable;
    a.plena += t.turno.minutosPlena;
  }
  const out: TramoVelocidad[] = [];
  acum.forEach((a, i) => {
    if (a.turnos === 0 || a.alimentable <= 0) return;
    const etiqueta = i === 0 ? `menos de ${fmt(l[0])}` : i === l.length ? `${fmt(l[i - 1])} o más` : `${fmt(l[i - 1])} – ${fmt(l[i])}`;
    const centro = i === 0 ? l[0] - 0.25 : i === l.length ? l[i - 1] + 0.25 : (l[i - 1] + l[i]) / 2;
    out.push({
      etiqueta,
      centro,
      turnos: a.turnos,
      pctPlena: redondear((100 * a.plena) / a.alimentable, 1),
      piezasTurno: Math.round((REGLAS_TURNOS.minutosTurnoEquivalente * a.piezas) / a.alimentable),
    });
  });
  return out;
}

// ── Colores por línea (los de la gráfica de trabajo: 2 azul, 4 rojo, 5 verde) ──

const COLORES_LINEA: Record<string, string> = {
  "Línea 1": "#8b5cf6",
  "Línea 2": "#1f77b4",
  "Línea 3": "#f59e0b",
  "Línea 4": "#d62728",
  "Línea 5": "#2ca02c",
  "Línea 6": "#0891b2",
};

export function colorDeLinea(nombre: string): string {
  return COLORES_LINEA[nombre] ?? "#64748b";
}
