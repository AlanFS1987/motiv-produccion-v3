// frontend/src/lib/dashboard-incidencias.ts
// Incidencias para el dashboard del jefe. Dos listas SEPARADAS,
// nunca combinadas ni ordenadas juntas — misma regla que en Ceria y
// el resto del dashboard: producción (paros, fallos de máquina) y
// calidad (defectos de producto) son ejes independientes.

import { supabase } from "./supabase-client";

export interface IncidenciaProduccionItem {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  created_at: string;
  fecha: string;
  tipo_turno: "M" | "T" | "N";
  linea_nombre: string | null; // null = incidencia general del turno
  creado_por: string | null;
}

export interface IncidenciaCalidadItem {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  created_at: string;
  fecha: string;
  tipo_turno: "M" | "T" | "N";
  linea_nombre: string;
  modelo_nombre: string;
  formato_nombre: string;
  numero_orden: string;
  creado_por: string | null;
}

// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export async function obtenerIncidenciasProduccion(
  fechaDesde: string,
  fechaHasta: string,
  lineaNombre?: string,
): Promise<IncidenciaProduccionItem[]> {
  let query = supabase
    .from("incidencia_produccion")
    .select(
      `id, descripcion, fotos, created_at,
       turno:turno_id ( fecha, tipo ),
       linea:linea_id ( nombre ),
       creador:created_by ( username )`,
    )
    .gte("turno.fecha", fechaDesde)
    .lte("turno.fecha", fechaHasta)
    .order("created_at", { ascending: false });

  if (lineaNombre) {
    const { data: lineaRow } = await supabase
      .from("linea")
      .select("id")
      .ilike("nombre", `%${lineaNombre}%`)
      .limit(1)
      .maybeSingle();
    if (lineaRow) query = query.eq("linea_id", lineaRow.id as string);
  }

  const { data, error } = await query;
  if (error) throw new Error(`incidencia_produccion: ${error.message}`);

  return ((data ?? []) as any[])
    .map((row) => {
      const turno = uno<{ fecha: string; tipo: "M" | "T" | "N" }>(row.turno);
      const linea = uno<{ nombre: string }>(row.linea);
      const creador = uno<{ username: string }>(row.creador);
      if (!turno) return null;
      return {
        id: row.id,
        descripcion: row.descripcion,
        fotos: row.fotos ?? null,
        created_at: row.created_at,
        fecha: turno.fecha,
        tipo_turno: turno.tipo,
        linea_nombre: linea?.nombre ?? null,
        creado_por: creador?.username ?? null,
      };
    })
    .filter((x): x is IncidenciaProduccionItem => x !== null);
}

export async function obtenerIncidenciasCalidad(
  fechaDesde: string,
  fechaHasta: string,
): Promise<IncidenciaCalidadItem[]> {
  const { data, error } = await supabase
    .from("incidencia_calidad")
    .select(
      `id, descripcion, fotos, created_at,
       creador:created_by ( username ),
       parte:parte_id (
         linea:linea_id ( nombre ),
         turno:turno_id ( fecha, tipo ),
         lote:lote_id (
           numero_orden,
           producto:producto_id (
             modelo:modelo_id ( nombre ),
             formato:formato_id ( nombre )
           )
         )
       )`,
    )
    .gte("created_at", `${fechaDesde}T00:00:00`)
    .lte("created_at", `${fechaHasta}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`incidencia_calidad: ${error.message}`);

  return ((data ?? []) as any[])
    .map((row) => {
      const creador = uno<{ username: string }>(row.creador);
      const parte = uno<any>(row.parte);
      const linea = uno<{ nombre: string }>(parte?.linea);
      const turno = uno<{ fecha: string; tipo: "M" | "T" | "N" }>(parte?.turno);
      const lote = uno<any>(parte?.lote);
      const producto = uno<any>(lote?.producto);
      const modelo = uno<{ nombre: string }>(producto?.modelo);
      const formato = uno<{ nombre: string }>(producto?.formato);
      if (!turno) return null;
      return {
        id: row.id,
        descripcion: row.descripcion,
        fotos: row.fotos ?? null,
        created_at: row.created_at,
        fecha: turno.fecha,
        tipo_turno: turno.tipo,
        linea_nombre: linea?.nombre ?? "—",
        modelo_nombre: modelo?.nombre ?? "—",
        formato_nombre: formato?.nombre ?? "—",
        numero_orden: lote?.numero_orden ?? "—",
        creado_por: creador?.username ?? null,
      };
    })
    .filter((x): x is IncidenciaCalidadItem => x !== null);
}