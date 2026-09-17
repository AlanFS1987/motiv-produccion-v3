// frontend/src/lib/mecanico-incidencias.ts
//
// Incidencias de producción vistas por el mecánico: cola compartida
// entre los 2 mecánicos (17-rol-mecanico-plan.md, sesión 16/09/2026)
// — cualquiera puede responder cualquiera pendiente, sin reparto por
// quién la creó. `estado` ya viene calculado desde la columna
// generada (06-esquema-bd.md), nunca se deriva aquí.

import { supabase } from "./supabase-client";

export interface IncidenciaMecanico {
  id: string;
  descripcion: string;
  fotos: string[] | null;
  createdAt: string;
  fecha: string;
  tipoTurno: "M" | "T" | "N";
  lineaNombre: string | null; // null = incidencia general del turno
  creadoPor: string | null;
  estado: "pendiente" | "contestada";
  respuestaTexto: string | null;
  respuestaFotos: string[] | null;
  respuestaSinIntervencion: boolean;
  respuestaMecanicoUsername: string | null;
  respuestaFecha: string | null;
}

// deno-lint-ignore no-explicit-any
function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export async function listarIncidenciasParaMecanico(): Promise<IncidenciaMecanico[]> {
  const { data, error } = await supabase
    .from("incidencia_produccion")
    .select(
      `id, descripcion, fotos, created_at, estado,
       respuesta_texto, respuesta_fotos, respuesta_sin_intervencion, respuesta_fecha,
       turno:turno_id ( fecha, tipo ),
       linea:linea_id ( nombre ),
       creador:created_by ( username ),
       mecanico:respuesta_mecanico_id ( username )`,
    )
    // "pendiente" > "contestada" alfabéticamente, así que descendente
    // deja las pendientes primero; dentro de cada grupo, más reciente
    // primero.
    .order("estado", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`incidencia_produccion: ${error.message}`);

  return (data ?? []).map((fila: any) => {
    const turno = uno(fila.turno);
    const linea = uno(fila.linea);
    const creador = uno(fila.creador);
    const mecanico = uno(fila.mecanico);
    return {
      id: fila.id,
      descripcion: fila.descripcion,
      fotos: fila.fotos,
      createdAt: fila.created_at,
      fecha: turno?.fecha ?? "",
      tipoTurno: turno?.tipo ?? "M",
      lineaNombre: linea?.nombre ?? null,
      creadoPor: creador?.username ?? null,
      estado: fila.estado,
      respuestaTexto: fila.respuesta_texto,
      respuestaFotos: fila.respuesta_fotos,
      respuestaSinIntervencion: fila.respuesta_sin_intervencion,
      respuestaMecanicoUsername: mecanico?.username ?? null,
      respuestaFecha: fila.respuesta_fecha,
    };
  });
}

export async function responderIncidencia(
  incidenciaId: string,
  texto: string,
  fotos: string[],
  sinIntervencion: boolean,
  mecanicoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("incidencia_produccion")
    .update({
      respuesta_texto: texto,
      respuesta_fotos: fotos.length > 0 ? fotos : null,
      respuesta_sin_intervencion: sinIntervencion,
      respuesta_mecanico_id: mecanicoId,
      respuesta_fecha: new Date().toISOString(),
    })
    .eq("id", incidenciaId);

  // Si la incidencia ya estaba contestada, la política RLS bloquea el
  // UPDATE (0 filas afectadas) y Supabase no lo trata como error — no
  // hace falta comprobarlo aparte, la fila simplemente no cambia.
  if (error) throw new Error(`No se pudo guardar la respuesta: ${error.message}`);
}