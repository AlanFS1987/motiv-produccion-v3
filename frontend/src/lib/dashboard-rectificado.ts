// frontend/src/lib/dashboard-rectificado.ts
//
// Datos del rol jefe_rectificado (sección de rectificado, anterior a
// clasificación). Lee v_rectificado_turno / v_rectificado_modelo —
// vistas propias, no las del jefe a secas (tiempos en 3 bloques,
// calidad = calibre com/std, no 1ª/comercial/eco/contenedor).

import { supabase } from "./supabase-client";

export interface TurnoRectificado {
  turnoId: string;
  fecha: string;
  tipoTurno: "M" | "T" | "N";
  lineaId: string;
  lineaNombre: string;
  piezasTotal: number;
  m2Total: number;
  minutosTotal: number;
  denominadorRendimiento: number;
  minutosPlenoRendimiento: number;
  minutosParadasPropias: number;
  minutosParadasAjenas: number;
  pctRendimiento: number | null;
  piezasMinuto: number | null;
  piezasDescuadreCom: number;
  pctCalibreCom: number | null;
  pctCalibreStd: number | null;
  m2CalibreCom: number;
  m2CalibreStd: number;
}

export interface FiltroRectificado {
  fechaDesde?: string;
  fechaHasta?: string;
  tipoTurno?: "M" | "T" | "N";
  lineaId?: string;
}

function mapFila(row: any): TurnoRectificado {
  return {
    turnoId: row.turno_id,
    fecha: row.fecha,
    tipoTurno: row.tipo_turno,
    lineaId: row.linea_id,
    lineaNombre: row.linea_nombre,
    piezasTotal: row.piezas_total ?? 0,
    m2Total: row.m2_total ?? 0,
    minutosTotal: row.minutos_total ?? 0,
    denominadorRendimiento: row.denominador_rendimiento ?? 0,
    minutosPlenoRendimiento: row.minutos_pleno_rendimiento ?? 0,
    minutosParadasPropias: row.minutos_paradas_propias ?? 0,
    minutosParadasAjenas: row.minutos_paradas_ajenas ?? 0,
    pctRendimiento: row.pct_rendimiento,
    piezasMinuto: row.piezas_minuto,
    piezasDescuadreCom: row.piezas_descuadre_com ?? 0,
    pctCalibreCom: row.pct_calibre_com,
    pctCalibreStd: row.pct_calibre_std,
    m2CalibreCom: row.m2_calibre_com ?? 0,
    m2CalibreStd: row.m2_calibre_std ?? 0,
  };
}

/** Vista Rápida: últimos N turnos (21 escritorio / 3 móvil, se decide en el componente). */
export async function obtenerSerieRectificadoUltimosTurnos(nTurnos: number): Promise<TurnoRectificado[]> {
  const { data, error } = await supabase
    .from("v_rectificado_turno")
    .select("*")
    .order("fecha", { ascending: false })
    .order("tipo_turno", { ascending: false })
    .limit(nTurnos * 6); // hasta 6 líneas por turno
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFila);
}

/** Vista Detallada: filtros libres (fecha desde/hasta, turno, línea). */
export async function obtenerDetalleRectificado(filtro: FiltroRectificado): Promise<TurnoRectificado[]> {
  let query = supabase.from("v_rectificado_turno").select("*");
  if (filtro.fechaDesde) query = query.gte("fecha", filtro.fechaDesde);
  if (filtro.fechaHasta) query = query.lte("fecha", filtro.fechaHasta);
  if (filtro.tipoTurno) query = query.eq("tipo_turno", filtro.tipoTurno);
  if (filtro.lineaId) query = query.eq("linea_id", filtro.lineaId);
  const { data, error } = await query.order("fecha", { ascending: false }).order("tipo_turno", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFila);
}

export interface ModeloRectificado {
  turnoId: string;
  fecha: string;
  tipoTurno: "M" | "T" | "N";
  lineaId: string;
  lineaNombre: string;
  modeloNombre: string;
  piezasTotal: number;
  m2Total: number;
  piezasDescuadreCom: number;
  pctCalibreCom: number | null;
  pctCalibreStd: number | null;
}

/** Desglose por modelo dentro de la Vista Detallada (mismos filtros). */
export async function obtenerCalidadPorModeloRectificado(filtro: FiltroRectificado): Promise<ModeloRectificado[]> {
  let query = supabase.from("v_rectificado_modelo").select("*");
  if (filtro.fechaDesde) query = query.gte("fecha", filtro.fechaDesde);
  if (filtro.fechaHasta) query = query.lte("fecha", filtro.fechaHasta);
  if (filtro.tipoTurno) query = query.eq("tipo_turno", filtro.tipoTurno);
  if (filtro.lineaId) query = query.eq("linea_id", filtro.lineaId);
  const { data, error } = await query.order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    turnoId: row.turno_id,
    fecha: row.fecha,
    tipoTurno: row.tipo_turno,
    lineaId: row.linea_id,
    lineaNombre: row.linea_nombre,
    modeloNombre: row.modelo_nombre,
    piezasTotal: row.piezas_total ?? 0,
    m2Total: row.m2_total ?? 0,
    piezasDescuadreCom: row.piezas_descuadre_com ?? 0,
    pctCalibreCom: row.pct_calibre_com,
    pctCalibreStd: row.pct_calibre_std,
  }));
}