// frontend/src/lib/dashboard-alimentacion.ts
// Datos para la vista "Alimentación" (rendimiento vs velocidad).
// Lee v_alimentacion_turno_linea (una fila por turno+línea, con
// minutos REALES — sin el suelo de 480 del % de rendimiento oficial).
// Eje de PRODUCCIÓN, sin calidad. Los cálculos de agregación (día,
// semana) están en alimentacion-calculos.ts.

import { supabase } from "./supabase-client";

export type TipoTurno = "M" | "T" | "N";

export interface TurnoLineaAlimentacion {
  turnoId: string;
  fecha: string; // YYYY-MM-DD
  tipoTurno: TipoTurno;
  lineaId: string;
  lineaNombre: string;
  /** Formatos distintos de los partes de ese turno+línea (normalmente uno). */
  formatos: string[];
  formatosDistintos: number;
  partes: number;
  piezasTotal: number;
  minutosTotal: number;
  minutosPlena: number;
  minutosNoAlimentada: number;
  minutosSaturacion: number;
  minutosBanco: number;
  minutosMaquina: number;
  /** piezas ÷ minutos a plena (null si no hubo minutos a plena). */
  piezasMinPlena: number | null;
  /** piezas ÷ minutos totales reales del turno (sin suelo de 480). */
  piezasMinTurno: number | null;
  /** 100 × minutos a plena ÷ minutos totales. NO es el % de rendimiento oficial. */
  pctPlena: number | null;
}

/**
 * Referencias que se dibujan como líneas horizontales (piezas/min).
 * Valores tomados de la gráfica de trabajo (01/10/2026) — revisar y
 * ajustar aquí si cambian; es el único sitio donde viven.
 */
export const REFERENCIAS_PIEZAS_MIN = {
  hornoNecesario: 12.15,
  limiteGriffon: 11.9,
  consignaPropuesta: 13,
} as const;

/**
 * Un turno+línea solo entra en las gráficas si sus minutos totales
 * están en este rango. Por encima suele ser una estadística de
 * apiladores sin resetear (08-dashboard-jefe.md); por debajo, línea
 * casi parada. PROVISIONAL: umbrales por confirmar con producción.
 */
export const RANGO_MINUTOS_VALIDOS = { min: 360, max: 540 } as const;

/** Días que se traen como mínimo: cubre el trimestre (13 semanas) completo. */
export const DIAS_MINIMOS_CARGA = 91;

const TAM_PAGINA = 1000; // límite por defecto de filas por petición en PostgREST

function mapFila(row: any): TurnoLineaAlimentacion {
  return {
    turnoId: row.turno_id,
    fecha: row.fecha,
    tipoTurno: row.tipo_turno,
    lineaId: row.linea_id,
    lineaNombre: row.linea_nombre,
    formatos: (row.formatos as string[] | null) ?? [],
    formatosDistintos: Number(row.formatos_distintos ?? 0),
    partes: Number(row.partes_analizados ?? 0),
    piezasTotal: Number(row.piezas_total ?? 0),
    minutosTotal: Number(row.minutos_total ?? 0),
    minutosPlena: Number(row.minutos_plena ?? 0),
    minutosNoAlimentada: Number(row.minutos_no_alimentada ?? 0),
    minutosSaturacion: Number(row.minutos_saturacion ?? 0),
    minutosBanco: Number(row.minutos_banco ?? 0),
    minutosMaquina: Number(row.minutos_maquina ?? 0),
    piezasMinPlena: row.piezas_min_plena === null ? null : Number(row.piezas_min_plena),
    piezasMinTurno: row.piezas_min_turno === null ? null : Number(row.piezas_min_turno),
    pctPlena: row.pct_plena === null ? null : Number(row.pct_plena),
  };
}

/** Catálogo cerrado de formatos (7 filas), para el selector. */
export async function obtenerFormatosAlimentacion(): Promise<string[]> {
  const { data, error } = await supabase.from("formato").select("nombre").order("nombre", { ascending: true });
  if (error) throw new Error(`formato: ${error.message}`);
  return (data ?? []).map((f: any) => f.nombre as string);
}

/**
 * Turnos+línea en los que aparece el formato dado, desde `fechaDesde`
 * (YYYY-MM-DD) hasta hoy. Incluye los turnos mixtos (varios formatos):
 * la pantalla los descarta y los cuenta aparte, por eso no se
 * filtran aquí. Pagina de 1000 en 1000 porque PostgREST corta ahí.
 */
export async function obtenerTurnosAlimentacion(formato: string, fechaDesde: string): Promise<TurnoLineaAlimentacion[]> {
  const filas: TurnoLineaAlimentacion[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await supabase
      .from("v_alimentacion_turno_linea")
      .select("*")
      .contains("formatos", [formato])
      .gte("fecha", fechaDesde)
      .order("fecha", { ascending: true })
      .order("tipo_turno", { ascending: true })
      .order("linea_id", { ascending: true })
      .range(desde, desde + TAM_PAGINA - 1);
    if (error) throw new Error(`v_alimentacion_turno_linea: ${error.message}`);
    const pagina = (data ?? []).map(mapFila);
    filas.push(...pagina);
    if (pagina.length < TAM_PAGINA) break;
  }
  return filas;
}
