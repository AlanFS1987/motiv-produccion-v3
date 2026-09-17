// frontend/src/lib/mecanico-engrase.ts
//
// Checklist de engrase (17-rol-mecanico-plan.md, bloque 4): misma
// lista de puntos para todas las líneas, marcado parcial permitido,
// sin disparador automático — solo registra cuándo se hizo cada vez.

import { supabase } from "./supabase-client";

export interface EngrasePunto {
  id: string;
  nombre: string;
  orden: number;
}

export interface EngraseParteItem {
  id: string;
  lineaNombre: string;
  fecha: string;
  mecanicoUsername: string;
  puntosMarcados: string[];
}

// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/** Lista editable solo por el admin — aquí solo se lee, en el orden fijado. */
export async function listarPuntosEngrase(): Promise<EngrasePunto[]> {
  const { data, error } = await supabase
    .from("engrase_punto")
    .select("id, nombre, orden")
    .eq("activo", true)
    .order("orden");

  if (error) throw new Error(`engrase_punto: ${error.message}`);
  return data as EngrasePunto[];
}

export async function crearParteEngrase(lineaId: string, mecanicoId: string, puntosMarcadosIds: string[]): Promise<void> {
  const { data: parte, error: errorParte } = await supabase
    .from("engrase_parte")
    .insert({ linea_id: lineaId, mecanico_id: mecanicoId })
    .select("id")
    .single();

  if (errorParte) throw new Error(`No se pudo crear el parte de engrase: ${errorParte.message}`);

  // Marcado parcial: solo se insertan filas de los puntos hechos, el
  // resto simplemente no aparece en este parte (06-esquema-bd.md).
  if (puntosMarcadosIds.length > 0) {
    const filas = puntosMarcadosIds.map((puntoId) => ({ parte_id: parte.id, punto_id: puntoId }));
    const { error: errorPuntos } = await supabase.from("engrase_parte_punto").insert(filas);
    if (errorPuntos) throw new Error(`Parte creado, pero no se pudieron guardar los puntos: ${errorPuntos.message}`);
  }
}

export async function listarHistorialEngrase(lineaId?: string): Promise<EngraseParteItem[]> {
  let query = supabase
    .from("engrase_parte")
    .select(
      `id, fecha,
       linea:linea_id ( nombre ),
       mecanico:mecanico_id ( username ),
       engrase_parte_punto ( punto:punto_id ( nombre ) )`,
    )
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (lineaId) query = query.eq("linea_id", lineaId);

  const { data, error } = await query;
  if (error) throw new Error(`engrase_parte: ${error.message}`);

  return (data ?? []).map((fila: any) => {
    const linea = uno(fila.linea);
    const mecanico = uno(fila.mecanico);
    const puntos = (fila.engrase_parte_punto ?? [])
      .map((p: any) => uno(p.punto)?.nombre)
      .filter((n: string | undefined): n is string => Boolean(n));
    return {
      id: fila.id,
      lineaNombre: linea?.nombre ?? "—",
      fecha: fila.fecha,
      mecanicoUsername: mecanico?.username ?? "—",
      puntosMarcados: puntos,
    };
  });
}