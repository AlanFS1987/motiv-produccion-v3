// frontend/src/lib/dashboard-calidad.ts
//
// Datos del rol `calidad`: últimos 15 lotes (abiertos o cerrados, sin
// filtrar por estado) con calidad completa/oficial, desglose por
// tono al expandir, e incidencias de calidad por lote. No usa
// vistas nuevas — v_calidad_lote ya trae todo lo agregado por lote;
// tonos e incidencias se consultan directo contra parte/
// incidencia_calidad (rol calidad ya tiene SELECT en ambas por RLS
// existente, sin cambios).
//
// "Descarte" en esta sección = solo piezas_contenedor (eco no se usa
// aquí, se ignora del todo, no se combina con contenedor).

import { supabase } from "./supabase-client";

export interface LoteCalidad {
  loteId: string;
  numeroOrden: string;
  loteEstado: string;
  modeloNombre: string;
  marcaNombre: string;
  formatoNombre: string;
  piezasEntradas: number;
  m2Total: number;
  pct1aCompleta: number | null;
  pctComercialCompleta: number | null;
  pctContenedorCompleta: number | null;
  pct1aOficial: number | null;
  pctComercialOficial: number | null;
  primeraProduccion: string;
  ultimaProduccion: string;
}

export type ModoFiltroCalidad = "ninguno" | "fecha" | "orden" | "modelo";

export interface FiltroCalidad {
  modo: ModoFiltroCalidad;
  valor?: string;
}

function mapLote(row: any): LoteCalidad {
  return {
    loteId: row.lote_id,
    numeroOrden: row.numero_orden,
    loteEstado: row.lote_estado,
    modeloNombre: row.modelo_nombre,
    marcaNombre: row.marca_nombre,
    formatoNombre: row.formato_nombre,
    piezasEntradas: row.piezas_entradas ?? 0,
    m2Total: row.m2_total ?? 0,
    pct1aCompleta: row.pct_1a_completa,
    pctComercialCompleta: row.pct_comercial_completa,
    pctContenedorCompleta: row.pct_contenedor_completa,
    pct1aOficial: row.pct_1a_oficial,
    pctComercialOficial: row.pct_comercial_oficial,
    primeraProduccion: row.primera_produccion,
    ultimaProduccion: row.ultima_produccion,
  };
}

/** Últimos 15 lotes; con filtro activo, los 15 más recientes que coincidan. */
export async function obtenerLotesCalidad(filtro: FiltroCalidad): Promise<LoteCalidad[]> {
  let query = supabase.from("v_calidad_lote").select("*");

  if (filtro.modo === "fecha" && filtro.valor) {
    // Aproximación: el lote estuvo activo ese día (primera..ultima
    // producción lo incluyen), no "se tocó exactamente ese día" —
    // v_calidad_lote no tiene fecha por fila. Ver aviso en el chat.
    query = query.lte("primera_produccion", filtro.valor).gte("ultima_produccion", filtro.valor);
  } else if (filtro.modo === "orden" && filtro.valor) {
    query = query.ilike("numero_orden", `%${filtro.valor.trim()}%`);
  } else if (filtro.modo === "modelo" && filtro.valor) {
    query = query.ilike("modelo_nombre", `%${filtro.valor.trim()}%`);
  }

  const { data, error } = await query.order("ultima_produccion", { ascending: false }).limit(15);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLote);
}

/** Sugerencias de autocompletado de modelo — busca en cualquier posición del nombre. */
export async function buscarModelosAutocomplete(texto: string): Promise<{ id: string; nombre: string }[]> {
  const limpio = texto.trim();
  if (limpio.length < 2) return [];
  const { data, error } = await supabase
    .from("modelo")
    .select("id, nombre")
    .ilike("nombre", `%${limpio}%`)
    .order("nombre")
    .limit(8);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Conteo de incidencias de calidad para una lista de lotes, en 2 consultas (sin N+1). */
export async function obtenerConteoIncidenciasPorLotes(loteIds: string[]): Promise<Record<string, number>> {
  if (loteIds.length === 0) return {};
  const { data: partes, error: errPartes } = await supabase
    .from("parte")
    .select("id, lote_id")
    .in("lote_id", loteIds);
  if (errPartes) throw new Error(errPartes.message);

  const parteIdALote = new Map((partes ?? []).map((p: any) => [p.id, p.lote_id]));
  const parteIds = Array.from(parteIdALote.keys());
  if (parteIds.length === 0) return {};

  const { data: incidencias, error: errInc } = await supabase
    .from("incidencia_calidad")
    .select("parte_id")
    .in("parte_id", parteIds);
  if (errInc) throw new Error(errInc.message);

  const conteo: Record<string, number> = {};
  for (const inc of incidencias ?? []) {
    const loteId = parteIdALote.get(inc.parte_id);
    if (!loteId) continue;
    conteo[loteId] = (conteo[loteId] ?? 0) + 1;
  }
  return conteo;
}

export interface IncidenciaLote {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  createdAt: string;
}

/** Todas las incidencias de calidad de un lote (se listan todas, no solo la última). */
export async function obtenerIncidenciasPorLote(loteId: string): Promise<IncidenciaLote[]> {
  const { data: partes, error: errPartes } = await supabase.from("parte").select("id").eq("lote_id", loteId);
  if (errPartes) throw new Error(errPartes.message);
  const parteIds = (partes ?? []).map((p: any) => p.id);
  if (parteIds.length === 0) return [];

  const { data, error } = await supabase
    .from("incidencia_calidad")
    .select("id, descripcion, fotos, created_at")
    .in("parte_id", parteIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    descripcion: row.descripcion,
    fotos: row.fotos,
    createdAt: row.created_at,
  }));
}

export interface TonoCalidad {
  tono: string;
  piezasEntradas: number;
  m2Total: number;
  pct1aCompleta: number | null;
  pctComercialCompleta: number | null;
  pctContenedorCompleta: number | null;
  pct1aOficial: number | null;
  pctComercialOficial: number | null;
}

/** Desglose por tono dentro de un lote — 3 consultas simples (lote→producto→formato), sin asumir nombres de embed de PostgREST. */
export async function obtenerTonosPorLote(loteId: string): Promise<TonoCalidad[]> {
  const { data: lote, error: errLote } = await supabase
    .from("lote")
    .select("producto_id")
    .eq("id", loteId)
    .single();
  if (errLote) throw new Error(errLote.message);

  const { data: producto, error: errProd } = await supabase
    .from("producto")
    .select("formato_id")
    .eq("id", lote.producto_id)
    .single();
  if (errProd) throw new Error(errProd.message);

  const { data: formato, error: errFormato } = await supabase
    .from("formato")
    .select("area_m2")
    .eq("id", producto.formato_id)
    .single();
  if (errFormato) throw new Error(errFormato.message);

  const areaM2 = formato?.area_m2 ?? 0;

  const { data: partes, error: errPartes } = await supabase
    .from("parte")
    .select("tono, piezas_entradas, piezas_1a, piezas_comercial, piezas_contenedor")
    .eq("lote_id", loteId)
    .eq("vigente", true)
    .eq("completado", true);
  if (errPartes) throw new Error(errPartes.message);

  const porTono = new Map<string, { entradas: number; a1: number; com: number; cont: number }>();
  for (const p of partes ?? []) {
    const clave = p.tono ?? "—";
    const acc = porTono.get(clave) ?? { entradas: 0, a1: 0, com: 0, cont: 0 };
    acc.entradas += p.piezas_entradas ?? 0;
    acc.a1 += p.piezas_1a ?? 0;
    acc.com += p.piezas_comercial ?? 0;
    acc.cont += p.piezas_contenedor ?? 0;
    porTono.set(clave, acc);
  }

  return Array.from(porTono.entries())
    .map(([tono, v]) => {
      const denomOficial = v.a1 + v.com;
      return {
        tono,
        piezasEntradas: v.entradas,
        m2Total: Math.round(v.entradas * areaM2 * 100) / 100,
        pct1aCompleta: v.entradas > 0 ? Math.round((v.a1 / v.entradas) * 10000) / 100 : null,
        pctComercialCompleta: v.entradas > 0 ? Math.round((v.com / v.entradas) * 10000) / 100 : null,
        pctContenedorCompleta: v.entradas > 0 ? Math.round((v.cont / v.entradas) * 10000) / 100 : null,
        pct1aOficial: denomOficial > 0 ? Math.round((v.a1 / denomOficial) * 10000) / 100 : null,
        pctComercialOficial: denomOficial > 0 ? Math.round((v.com / denomOficial) * 10000) / 100 : null,
      };
    })
    .sort((a, b) => a.tono.localeCompare(b.tono));
}