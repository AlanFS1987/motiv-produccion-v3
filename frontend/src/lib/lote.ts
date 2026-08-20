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

  const porLote = new Map<string, LoteGestion>();

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

  return Array.from(porLote.values());
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