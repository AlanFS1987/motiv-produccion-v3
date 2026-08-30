// frontend/src/lib/lote.ts
//
// Gestión de lotes (01-rol-responsable.md 3.10). Lista los últimos 15
// lotes por fecha de ÚLTIMA ACTIVIDAD (fecha del último `parte`
// capturado contra ese lote, no la fecha de creación del lote), con
// botón Finalizar/Reabrir.
//
// Cómo se obtiene "última actividad" sin una vista/RPC dedicada: se
// consultan los `parte` más recientes (ya vienen ordenados por
// created_at desc) y se toma, para cada lote, la primera aparición
// (la más reciente) — solución deliberadamente simple, igual de
// válida en la escala de esta fábrica que una vista aparte en BD.
//
// El PENDIENTE de cada lote (m² y piezas que faltan por producir) sí
// viene de una vista (v_lote_pendiente) porque es una suma agregada
// de TODOS los partes del lote, no solo del más reciente — "nunca
// sumar filas manualmente en el cliente", mismo criterio que el
// resto de vistas de producción/calidad del proyecto. Se trae en una
// segunda consulta, acotada a los ids de los lotes ya elegidos por
// última actividad (nunca sobre toda la tabla).

import { supabase } from "./supabase-client";

export type EstadoLote = "iniciado" | "finalizado";

export interface LoteGestion {
  id: string;
  numeroOrden: string;
  modeloNombre: string;
  marcaNombre: string;
  estado: EstadoLote;
  /** Fecha del último `parte` capturado contra este lote. */
  ultimaActividad: string;
  /** m² que faltan por producir — null si el lote no tiene objetivo_m2 capturado. */
  m2Pendiente: number | null;
  /** Piezas que faltan por producir — null si el lote no tiene objetivo_m2 capturado. */
  piezasPendiente: number | null;
}

// Normaliza relaciones anidadas de Supabase (a veces llegan como
// array de 1, a veces como objeto) — mismo patrón que el resto del
// proyecto (ver lib/parte.ts, notificar-telegram/index.ts).
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

const MAX_PARTES_CONSULTADOS = 300;
const MAX_LOTES_MOSTRADOS = 15;

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

/**
 * Últimos 15 lotes con actividad, más recientes primero. Se consultan
 * hasta 300 `parte` recientes y se deduplica por lote — de sobra para
 * el volumen real de esta fábrica.
 */
export async function listarUltimosLotes(): Promise<LoteGestion[]> {
  const { data, error } = await supabase
    .from("parte")
    .select(
      `
      lote_id, created_at,
      lote:lote_id (
        id, numero_orden, estado,
        producto:producto_id (
          modelo:modelo_id ( nombre ),
          marca:marca_id ( nombre )
        )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(MAX_PARTES_CONSULTADOS);

  if (error) throw error;

  const porLote = new Map<string, Omit<LoteGestion, "m2Pendiente" | "piezasPendiente">>();

  for (const fila of data ?? []) {
    if (porLote.has(fila.lote_id)) continue; // ya tenemos su actividad más reciente

    const lote = uno<any>(fila.lote);
    if (!lote) continue;
    const producto = uno<any>(lote.producto);
    const modelo = uno<any>(producto?.modelo);
    const marca = uno<any>(producto?.marca);

    porLote.set(fila.lote_id, {
      id: lote.id,
      numeroOrden: lote.numero_orden ?? "",
      modeloNombre: modelo?.nombre ?? "—",
      marcaNombre: marca?.nombre ?? "—",
      estado: lote.estado as EstadoLote,
      ultimaActividad: fila.created_at,
    });

    if (porLote.size >= MAX_LOTES_MOSTRADOS) break;
  }

  const pendientePorLote = await obtenerPendientePorLote(Array.from(porLote.keys()));

  return Array.from(porLote.values()).map((lote) => ({
    ...lote,
    m2Pendiente: pendientePorLote[lote.id]?.m2 ?? null,
    piezasPendiente: pendientePorLote[lote.id]?.piezas ?? null,
  }));
}

/** Marca un lote como finalizado — decisión siempre manual (ver 3.10). */
export async function finalizarLote(loteId: string): Promise<void> {
  const { error } = await supabase.from("lote").update({ estado: "finalizado" }).eq("id", loteId);
  if (error) throw error;
}

/** Reabre un lote finalizado a mano, sin necesidad de un parte nuevo. */
export async function reabrirLote(loteId: string): Promise<void> {
  const { error } = await supabase.from("lote").update({ estado: "iniciado" }).eq("id", loteId);
  if (error) throw error;
}