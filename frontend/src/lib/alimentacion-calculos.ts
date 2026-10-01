// frontend/src/lib/alimentacion-calculos.ts
// Funciones PURAS (sin React ni Supabase) de la vista Alimentación:
// clasificación de turnos válidos, agrupación por periodo y
// estadística de las nubes. Regla que atraviesa todo: al agrupar
// varios turnos se SUMAN piezas y minutos y se divide AL FINAL —
// nunca se promedian cocientes ya calculados.

import { RANGO_MINUTOS_VALIDOS, type TipoTurno, type TurnoLineaAlimentacion } from "./dashboard-alimentacion";

// ── Fechas (YYYY-MM-DD, sin zonas horarias de por medio) ──────────

const MS_DIA = 86_400_000;
const ORDEN_TURNO: TipoTurno[] = ["M", "T", "N"];

function aUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aUTC(iso) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Lunes de la semana de la fecha dada. */
export function lunesDe(iso: string): string {
  const diaSemana = new Date(aUTC(iso)).getUTCDay(); // 0 = domingo
  return sumarDias(iso, -((diaSemana + 6) % 7));
}

export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

// ── Clasificación de turnos ───────────────────────────────────────

export interface ClasificacionTurnos {
  validos: TurnoLineaAlimentacion[];
  /** Turnos con partes de más de un formato (no se sabe a qué formato atribuir los minutos). */
  excluidosMezcla: number;
  /** Minutos totales fuera de RANGO_MINUTOS_VALIDOS, o sin minutos a plena. */
  excluidosMinutos: number;
}

export function clasificarTurnos(filas: TurnoLineaAlimentacion[]): ClasificacionTurnos {
  const validos: TurnoLineaAlimentacion[] = [];
  let excluidosMezcla = 0;
  let excluidosMinutos = 0;

  for (const f of filas) {
    if (f.formatosDistintos > 1) {
      excluidosMezcla++;
    } else if (
      f.minutosPlena <= 0 ||
      f.minutosTotal < RANGO_MINUTOS_VALIDOS.min ||
      f.minutosTotal > RANGO_MINUTOS_VALIDOS.max ||
      f.piezasMinPlena === null ||
      f.piezasMinTurno === null ||
      f.pctPlena === null
    ) {
      excluidosMinutos++;
    } else {
      validos.push(f);
    }
  }
  return { validos, excluidosMezcla, excluidosMinutos };
}

// ── Agrupación temporal ───────────────────────────────────────────

export type Granularidad = "3dias" | "semana" | "mes" | "trimestre";

export const ETIQUETA_GRANULARIDAD: Record<Granularidad, string> = {
  "3dias": "3 días",
  semana: "Semana",
  mes: "Mes",
  trimestre: "Trimestre",
};

export const AYUDA_GRANULARIDAD: Record<Granularidad, string> = {
  "3dias": "Un punto por turno",
  semana: "Un punto por día",
  mes: "Un punto por semana (4 completas + la actual)",
  trimestre: "Un punto por semana (12 completas + la actual)",
};

export interface BucketInfo {
  clave: string;
  etiqueta: string;
  /** Semana en curso (aún no ha terminado): el punto puede cambiar. */
  incompleta: boolean;
}

export interface PuntoBucket {
  lineaId: string;
  lineaNombre: string;
  bucketClave: string;
  etiqueta: string;
  incompleta: boolean;
  turnosIncluidos: number;
  piezas: number;
  minutosTotal: number;
  minutosPlena: number;
  minutosSaturacion: number;
  minutosNoAlimentada: number;
  piezasMinPlena: number;
  piezasMinTurno: number;
  pctPlena: number;
  pctSaturacion: number;
  pctNoAlimentada: number;
}

export interface SerieTemporal {
  buckets: BucketInfo[];
  puntos: PuntoBucket[];
}

export function generarBuckets(gran: Granularidad, hoy: string): BucketInfo[] {
  if (gran === "3dias") {
    const out: BucketInfo[] = [];
    for (let i = 2; i >= 0; i--) {
      const fecha = sumarDias(hoy, -i);
      for (const tipo of ORDEN_TURNO) {
        out.push({ clave: `${fecha}|${tipo}`, etiqueta: `${fechaCorta(fecha)} ${tipo}`, incompleta: false });
      }
    }
    return out;
  }
  if (gran === "semana") {
    const out: BucketInfo[] = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = sumarDias(hoy, -i);
      out.push({ clave: fecha, etiqueta: fechaCorta(fecha), incompleta: false });
    }
    return out;
  }
  // mes / trimestre: semanas de lunes a domingo
  const semanasAtras = gran === "mes" ? 4 : 12;
  const lunesActual = lunesDe(hoy);
  const out: BucketInfo[] = [];
  for (let k = semanasAtras; k >= 0; k--) {
    const lunes = sumarDias(lunesActual, -7 * k);
    out.push({ clave: lunes, etiqueta: fechaCorta(lunes), incompleta: sumarDias(lunes, 6) > hoy });
  }
  return out;
}

function claveBucket(f: TurnoLineaAlimentacion, gran: Granularidad): string {
  if (gran === "3dias") return `${f.fecha}|${f.tipoTurno}`;
  if (gran === "semana") return f.fecha;
  return lunesDe(f.fecha);
}

interface Acumulador {
  lineaId: string;
  lineaNombre: string;
  turnos: number;
  piezas: number;
  total: number;
  plena: number;
  saturacion: number;
  noAlimentada: number;
}

const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

/**
 * Agrupa los turnos VÁLIDOS en los buckets de la granularidad dada,
 * por línea. Un (línea, bucket) sin turnos válidos simplemente no
 * tiene punto (la gráfica muestra el hueco, no un cero inventado).
 */
export function agregarPorBucket(validos: TurnoLineaAlimentacion[], gran: Granularidad, hoy: string): SerieTemporal {
  const buckets = generarBuckets(gran, hoy);
  const infoBucket = new Map(buckets.map((b) => [b.clave, b]));
  const acumulado = new Map<string, Acumulador>(); // `${lineaId}#${claveBucket}`

  for (const f of validos) {
    const clave = claveBucket(f, gran);
    if (!infoBucket.has(clave)) continue; // fuera de la ventana
    const k = `${f.lineaId}#${clave}`;
    let a = acumulado.get(k);
    if (!a) {
      a = { lineaId: f.lineaId, lineaNombre: f.lineaNombre, turnos: 0, piezas: 0, total: 0, plena: 0, saturacion: 0, noAlimentada: 0 };
      acumulado.set(k, a);
    }
    a.turnos += 1;
    a.piezas += f.piezasTotal;
    a.total += f.minutosTotal;
    a.plena += f.minutosPlena;
    a.saturacion += f.minutosSaturacion;
    a.noAlimentada += f.minutosNoAlimentada;
  }

  const puntos: PuntoBucket[] = [];
  for (const [k, a] of acumulado) {
    if (a.plena <= 0 || a.total <= 0) continue;
    const clave = k.slice(k.indexOf("#") + 1);
    const b = infoBucket.get(clave)!;
    puntos.push({
      lineaId: a.lineaId,
      lineaNombre: a.lineaNombre,
      bucketClave: clave,
      etiqueta: b.etiqueta,
      incompleta: b.incompleta,
      turnosIncluidos: a.turnos,
      piezas: a.piezas,
      minutosTotal: a.total,
      minutosPlena: a.plena,
      minutosSaturacion: a.saturacion,
      minutosNoAlimentada: a.noAlimentada,
      piezasMinPlena: redondear(a.piezas / a.plena),
      piezasMinTurno: redondear(a.piezas / a.total),
      pctPlena: redondear((100 * a.plena) / a.total),
      pctSaturacion: redondear((100 * a.saturacion) / a.total),
      pctNoAlimentada: redondear((100 * a.noAlimentada) / a.total),
    });
  }
  return { buckets, puntos };
}

// ── Estadística de las nubes ──────────────────────────────────────

export interface Regresion {
  pendiente: number;
  ordenada: number;
  r: number;
  n: number;
}

/** Regresión lineal y coeficiente de Pearson. null si hay menos de 3 puntos o x no varía. */
export function regresionLineal(xs: number[], ys: number[]): Regresion | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0 || syy === 0) return null;
  const pendiente = sxy / sxx;
  return { pendiente, ordenada: my - pendiente * mx, r: sxy / Math.sqrt(sxx * syy), n };
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
