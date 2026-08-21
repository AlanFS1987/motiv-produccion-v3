// frontend/src/lib/dashboard-jefe.ts
// Datos para Vista Rápida del jefe. Dos ejes SEPARADOS (producción y
// calidad) que solo se cruzan por fecha+turno para pintarlos juntos —
// nunca se mezclan columnas ni se implica causalidad entre ellos
// (misma regla que en Ceria).
//
// Todas las sumas ya las hace Postgres en las vistas
// (v_produccion_turno, v_calidad_turno) — aquí solo se re-agregan
// esas filas ya resueltas para sacar los 5 KPIs del periodo, usando
// SIEMPRE numerador/denominador crudos para el % de rendimiento
// (nunca promediando los % ya redondeados de cada turno).

import { supabase } from "./supabase-client";

export type TipoTurno = "M" | "T" | "N";

export interface TurnoProduccion {
  turno_id: string;
  fecha: string;
  tipo_turno: TipoTurno;
  cerrado: boolean;
  lineas_activas: number;
  piezas_total: number;
  m2_total: number;
  minutos_total: number;
  minutos_plena: number;
  minutos_no_alimentada: number;
  minutos_saturacion: number;
  minutos_banco: number;
  minutos_maquina: number;
  pct_rendimiento: number | null;
  rendimiento_numerador: number;
  rendimiento_denominador: number;
}

export interface TurnoCalidad {
  turno_id: string;
  fecha: string;
  tipo_turno: TipoTurno;
  piezas_entradas: number;
  piezas_1a: number;
  piezas_comercial: number;
  pct_1a_completa: number | null;
  pct_1a_oficial: number | null;
}

export interface TurnoCombinado {
  fecha: string;
  tipo_turno: TipoTurno;
  produccion: TurnoProduccion | null;
  calidad: TurnoCalidad | null;
}

export interface KpisPeriodo {
  pct_rendimiento: number | null;
  m2_total: number;
  piezas_total: number;
  pct_1a_completa: number | null;
  pct_1a_oficial: number | null;
}

function fechaISOHaceNDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Trae producción y calidad de los últimos `dias` (incluyendo hoy),
 * combinadas por fecha+tipo_turno en una sola lista, lista para la
 * gráfica (21 turnos si dias=7). No implica que un dato "explique" el
 * otro solo por estar en la misma fila — siguen siendo dos consultas
 * y dos ejes independientes, solo alineados visualmente por periodo.
 */
export async function obtenerSerieUltimosDias(dias = 7): Promise<TurnoCombinado[]> {
  const desde = fechaISOHaceNDias(dias - 1); // incluye hoy => dias-1 hacia atrás

  const [{ data: produccion, error: errorProd }, { data: calidad, error: errorCal }] = await Promise.all([
    supabase.from("v_produccion_turno").select("*").gte("fecha", desde).order("fecha", { ascending: true }),
    supabase.from("v_calidad_turno").select("*").gte("fecha", desde).order("fecha", { ascending: true }),
  ]);

  if (errorProd) throw new Error(`v_produccion_turno: ${errorProd.message}`);
  if (errorCal) throw new Error(`v_calidad_turno: ${errorCal.message}`);

  const mapaCalidad = new Map<string, TurnoCalidad>();
  for (const c of (calidad ?? []) as TurnoCalidad[]) {
    mapaCalidad.set(`${c.fecha}_${c.tipo_turno}`, c);
  }

  const combinados: TurnoCombinado[] = ((produccion ?? []) as TurnoProduccion[]).map((p) => ({
    fecha: p.fecha,
    tipo_turno: p.tipo_turno,
    produccion: p,
    calidad: mapaCalidad.get(`${p.fecha}_${p.tipo_turno}`) ?? null,
  }));

  // Turnos con calidad pero sin fila de producción (no debería pasar,
  // ambas vienen de los mismos partes, pero por si acaso no se pierde
  // el dato silenciosamente)
  const clavesYaIncluidas = new Set(combinados.map((c) => `${c.fecha}_${c.tipo_turno}`));
  for (const c of (calidad ?? []) as TurnoCalidad[]) {
    const clave = `${c.fecha}_${c.tipo_turno}`;
    if (!clavesYaIncluidas.has(clave)) {
      combinados.push({ fecha: c.fecha, tipo_turno: c.tipo_turno, produccion: null, calidad: c });
    }
  }

  combinados.sort((a, b) => (a.fecha + a.tipo_turno).localeCompare(b.fecha + b.tipo_turno));
  return combinados;
}

/**
 * Los 5 KPIs del periodo, agregados correctamente (SUM/SUM para el
 * %, nunca promedio de porcentajes ya redondeados por turno).
 */
export function calcularKpis(turnos: TurnoCombinado[]): KpisPeriodo {
  let numRend = 0;
  let denRend = 0;
  let m2 = 0;
  let piezas = 0;
  let piezas1a = 0;
  let piezasComercial = 0;
  let piezasEntradas = 0;

  for (const t of turnos) {
    if (t.produccion) {
      numRend += t.produccion.rendimiento_numerador ?? 0;
      denRend += t.produccion.rendimiento_denominador ?? 0;
      m2 += t.produccion.m2_total ?? 0;
      piezas += t.produccion.piezas_total ?? 0;
    }
    if (t.calidad) {
      piezas1a += t.calidad.piezas_1a ?? 0;
      piezasComercial += t.calidad.piezas_comercial ?? 0;
      piezasEntradas += t.calidad.piezas_entradas ?? 0;
    }
  }

  return {
    pct_rendimiento: denRend > 0 ? Math.round((numRend / denRend) * 10000) / 100 : null,
    m2_total: Math.round(m2 * 10) / 10,
    piezas_total: piezas,
    pct_1a_completa: piezasEntradas > 0 ? Math.round((piezas1a / piezasEntradas) * 10000) / 100 : null,
    pct_1a_oficial:
      piezas1a + piezasComercial > 0 ? Math.round((piezas1a / (piezas1a + piezasComercial)) * 10000) / 100 : null,
  };
}