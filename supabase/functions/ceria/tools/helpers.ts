// supabase/functions/ceria/tools/helpers.ts
//
// Utilidades compartidas entre varios executors de herramientas.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Añade el username del responsable que abrió cada turno
 * (turno.abierto_por). No viene en v_produccion_turno/v_calidad_turno
 * (vistas agregadas sin esa columna) — se resuelve aparte, mismo
 * patrón que el operario de incidencias_produccion. Un turno tiene un
 * único abierto_por, así que aquí sí hay una persona única a la que
 * atribuir la fila (a diferencia de get_produccion_linea/get_calidad_linea,
 * donde una fila puede mezclar varios turnos y responsables).
 */
export async function enriquecerConResponsable<T extends { turno_id: string }>(
  filas: T[],
  supabase: SupabaseClient,
): Promise<(T & { responsable_username: string | null })[]> {
  if (filas.length === 0) return [];
  const turnoIds = [...new Set(filas.map((f) => f.turno_id))];
  const { data: turnos } = await supabase
    .from("turno")
    .select("id, responsable:abierto_por ( username )")
    .in("id", turnoIds);
  const responsablePorTurno = new Map<string, string>();
  for (const t of (turnos ?? []) as any[]) {
    const resp = Array.isArray(t.responsable) ? t.responsable[0] : t.responsable;
    if (resp?.username) responsablePorTurno.set(t.id, resp.username);
  }
  return filas.map((f) => ({
    ...f,
    responsable_username: responsablePorTurno.get(f.turno_id) ?? null,
  }));
}
