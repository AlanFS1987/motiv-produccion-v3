// frontend/src/lib/lote.ts
//
// Gestión de lotes (01-rol-responsable.md 3.10). Lista TODOS los lotes
// 'iniciado' leyendo de v_lote_gestion (pendiente, % del objetivo,
// última actividad y parte abierto ya calculados en BD — nada de sumar
// filas en el cliente), más recientes primero. El cierre normal es
// automático (trigger trg_parte_z_cerrar_lote_completo al completarse
// el último parte con el objetivo cumplido); aquí queda el Finalizar
// manual para órdenes que se produjeron por debajo de lo programado.
// La reapertura es automática al entrar un parte nuevo (BD).

import { supabase } from "./supabase-client";
import { mapearFilaGestion, type FilaLoteGestion, type LoteGestion } from "./lote-logica";

export type { EstadoLote, LoteGestion } from "./lote-logica";

/**
 * Trae m2_pendiente/piezas_pendiente de v_lote_pendiente para un
 * conjunto acotado de lotes. Exportada porque lib/relevo.ts la
 * reutiliza tal cual para mostrar el pendiente del lote que deja
 * abierto el turno anterior — mismo dato, mismo criterio de acotar
 * siempre por ids conocidos, nunca consultar la vista entera.
 */
export async function obtenerPendientePorLote(loteIds: string[]): Promise<Record<string, { m2: number | null; piezas: number | null }>> {
  if (loteIds.length === 0) return {};

  const { data, error } = await supabase
    .from("v_lote_pendiente")
    .select("lote_id, m2_pendiente, piezas_pendiente")
    .in("lote_id", loteIds);
  if (error) throw error;

  const resultado: Record<string, { m2: number | null; piezas: number | null }> = {};
  for (const fila of data ?? []) {
    resultado[fila.lote_id] = { m2: fila.m2_pendiente, piezas: fila.piezas_pendiente };
  }
  return resultado;
}

/** Todos los lotes iniciados, actividad más reciente primero (los que no tienen ningún parte, al final). */
export async function listarLotesAbiertos(): Promise<LoteGestion[]> {
  const { data, error } = await supabase
    .from("v_lote_gestion")
    .select(
      "lote_id, numero_orden, estado, modelo, marca, formato, m2_pendiente, piezas_pendiente, pct_objetivo, ultima_actividad, tiene_parte_abierto",
    )
    .eq("estado", "iniciado")
    .order("ultima_actividad", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as FilaLoteGestion[]).map(mapearFilaGestion);
}

/** Marca un lote como finalizado a mano (el cierre automático cubre el caso normal). */
export async function finalizarLote(loteId: string): Promise<void> {
  const { error } = await supabase.from("lote").update({ estado: "finalizado" }).eq("id", loteId);
  if (error) throw error;
}
