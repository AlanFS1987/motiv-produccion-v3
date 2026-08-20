// Incidencias de calidad y producción. Ref. 01-rol-responsable.md
// 3.4 (calidad) y 3.7 (producción, solo el punto de entrada "en la
// tarjeta de línea" por ahora — los otros dos puntos quedan
// pendientes de sesión futura).

import { supabase } from "./supabase-client";

export async function crearIncidenciaCalidad(
  parteId: string,
  descripcion: string,
  fotos: string[],
  createdBy: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("incidencia_calidad")
    .insert({
      parte_id: parteId,
      descripcion,
      fotos: fotos.length > 0 ? fotos : null,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function crearIncidenciaProduccion(
  turnoId: string,
  lineaId: string | null,
  descripcion: string,
  fotos: string[],
  createdBy: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("incidencia_produccion")
    .insert({
      turno_id: turnoId,
      linea_id: lineaId,
      descripcion,
      fotos: fotos.length > 0 ? fotos : null,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}
export interface IncidenciaCalidad {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  createdAt: string;
}

export async function listarIncidenciasCalidad(parteId: string): Promise<IncidenciaCalidad[]> {
  const { data, error } = await supabase
    .from("incidencia_calidad")
    .select("id, descripcion, fotos, created_at")
    .eq("parte_id", parteId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((fila) => ({
    id: fila.id,
    descripcion: fila.descripcion,
    fotos: fila.fotos,
    createdAt: fila.created_at,
  }));
}

export interface IncidenciaProduccion {
  id: string;
  lineaId: string | null;
  descripcion: string;
  fotos: string[] | null;
  createdAt: string;
}

function mapearIncidenciaProduccion(fila: any): IncidenciaProduccion {
  return {
    id: fila.id,
    lineaId: fila.linea_id,
    descripcion: fila.descripcion,
    fotos: fila.fotos,
    createdAt: fila.created_at,
  };
}

export async function listarIncidenciasProduccionLinea(turnoId: string, lineaId: string): Promise<IncidenciaProduccion[]> {
  const { data, error } = await supabase
    .from("incidencia_produccion")
    .select("id, linea_id, descripcion, fotos, created_at")
    .eq("turno_id", turnoId)
    .eq("linea_id", lineaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapearIncidenciaProduccion);
}

export async function listarIncidenciasProduccionGenerales(turnoId: string): Promise<IncidenciaProduccion[]> {
  const { data, error } = await supabase
    .from("incidencia_produccion")
    .select("id, linea_id, descripcion, fotos, created_at")
    .eq("turno_id", turnoId)
    .is("linea_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapearIncidenciaProduccion);
}
/** Cuántas incidencias de producción tiene cada línea de este turno — para el botón colapsable. */
export async function contarIncidenciasProduccionPorLinea(turnoId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("incidencia_produccion")
    .select("linea_id")
    .eq("turno_id", turnoId)
    .not("linea_id", "is", null);

  if (error) throw error;

  const resultado: Record<string, number> = {};
  for (const fila of data ?? []) {
    if (fila.linea_id) {
      resultado[fila.linea_id] = (resultado[fila.linea_id] ?? 0) + 1;
    }
  }
  return resultado;
}