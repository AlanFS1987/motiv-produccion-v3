// frontend/src/lib/horno-formato.ts
// Datos de los hornos por formato y clasificado por turno (balance horno vs
// clasificación, memorias/21-alimentacion.md).
//   - horno_formato: lectura por RLS; escritura SOLO por la RPC
//     guardar_horno_formato (administrador).
//   - v_balance_horno_turno_formato: piezas y m² clasificados por turno y
//     formato entre TODAS las líneas.
// Los cálculos (nivel necesario por línea, balance acumulado) están en
// balance-horno-calculos.ts.

import { supabase } from "./supabase-client";
import { uno } from "./supabase-relaciones";
import type { TipoTurno } from "./dashboard-alimentacion";

export interface HornoFormato {
  formatoId: string;
  formato: string;
  /** Superficie de una pieza en m² (formato.area_m2). */
  areaM2: number;
  /** YYYY-MM-DD; la fila vale desde esa fecha hasta la siguiente fila del mismo formato. */
  vigenteDesde: string;
  /** m² por día de CADA horno. */
  metrosDiaHorno: number;
  hornos: number;
  lineas: number;
}

export interface ClasificadoTurnoFormato {
  turnoId: string;
  fecha: string;
  tipoTurno: TipoTurno;
  formato: string;
  lineasConProduccion: number;
  piezasTotal: number;
  m2Clasificados: number;
}

const TAM_PAGINA = 1000;

export async function listarHornoFormato(): Promise<HornoFormato[]> {
  const { data, error } = await supabase
    .from("horno_formato")
    .select("formato_id, vigente_desde, metros_dia_horno, hornos, lineas, formato:formato_id ( nombre, area_m2 )")
    .order("vigente_desde", { ascending: true });
  if (error) throw new Error(`horno_formato: ${error.message}`);
  return (data ?? []).flatMap((r: any) => {
    const f = uno<{ nombre: string; area_m2: number | string }>(r.formato);
    if (!f) return [];
    return [
      {
        formatoId: r.formato_id as string,
        formato: f.nombre,
        areaM2: Number(f.area_m2),
        vigenteDesde: r.vigente_desde as string,
        metrosDiaHorno: Number(r.metros_dia_horno),
        hornos: Number(r.hornos),
        lineas: Number(r.lineas),
      },
    ];
  });
}

export async function guardarHornoFormato(p: {
  formatoId: string;
  vigenteDesde: string;
  metrosDiaHorno: number;
  hornos: number;
  lineas: number;
}): Promise<void> {
  const { error } = await supabase.rpc("guardar_horno_formato", {
    p_formato_id: p.formatoId,
    p_vigente_desde: p.vigenteDesde,
    p_metros: p.metrosDiaHorno,
    p_hornos: p.hornos,
    p_lineas: p.lineas,
  });
  if (error) throw new Error(error.message);
}

/**
 * Clasificado (todas las líneas) de TODOS los formatos de la planta desde `fechaDesde`: la
 * inferencia de qué formato cuece cada horno necesita verlos todos a la vez. Pagina de 1000 en 1000.
 */
export async function obtenerClasificadoPlanta(fechaDesde: string): Promise<ClasificadoTurnoFormato[]> {
  const filas: ClasificadoTurnoFormato[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await supabase
      .from("v_balance_horno_turno_formato")
      .select("*")
      .gte("fecha", fechaDesde)
      .order("fecha", { ascending: true })
      .order("tipo_turno", { ascending: true })
      .order("formato", { ascending: true })
      .range(desde, desde + TAM_PAGINA - 1);
    if (error) throw new Error(`v_balance_horno_turno_formato: ${error.message}`);
    const pagina = (data ?? []).map(
      (r: any): ClasificadoTurnoFormato => ({
        turnoId: r.turno_id,
        fecha: r.fecha,
        tipoTurno: r.tipo_turno,
        formato: r.formato,
        lineasConProduccion: Number(r.lineas_con_produccion ?? 0),
        piezasTotal: Number(r.piezas_total ?? 0),
        m2Clasificados: Number(r.m2_clasificados ?? 0),
      }),
    );
    filas.push(...pagina);
    if (pagina.length < TAM_PAGINA) break;
  }
  return filas;
}
