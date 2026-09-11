// supabase/functions/ceria/tools/incidencias.ts
//
// Incidencias operativas (producción) e incidencias de calidad —
// dos ejes separados, nunca relacionados entre sí (ver prompts.ts,
// "DOS EJES QUE NUNCA SE MEZCLAN").

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { LIMITS } from "./limits.ts";

export const TOOLS_INCIDENCIAS = [
  {
    type: "function",
    function: {
      name: "get_incidencias_produccion",
      description:
        "EJE PRODUCCIÓN. Incidencias operativas: paros, fallos de máquina, falta de " +
        "material — cuelgan de turno+línea, NUNCA de un modelo o defecto de producto. " +
        "CUÁNDO USARLA: \"¿qué incidencias hubo el viernes noche?\". " +
        "NO usarla para defectos de calidad — ver get_incidencias_calidad.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "YYYY-MM-DD (requerido)" },
          fecha_hasta: { type: "string", description: "YYYY-MM-DD (requerido)" },
          linea_nombre: { type: "string", description: "Nombre de línea (opcional)" },
        },
        required: ["fecha_desde", "fecha_hasta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_incidencias_calidad",
      description:
        "EJE CALIDAD. Defectos de producto (grumos, grietas, etc.) — cuelgan de un parte " +
        "concreto, NUNCA de una parada de máquina. CUÁNDO USARLA: \"¿qué defectos hubo " +
        "esta semana?\". NO usarla para paros operativos — ver get_incidencias_produccion.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "YYYY-MM-DD (requerido)" },
          fecha_hasta: { type: "string", description: "YYYY-MM-DD (requerido)" },
        },
        required: ["fecha_desde", "fecha_hasta"],
      },
    },
  },
];

// ── EJECUTORES ────────────────────────────────────────────────────

export async function ejecutarGetIncidenciasProduccion(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales: number; limitado: boolean }> {
  const limit = LIMITS.get_incidencias_produccion;
  let base = supabase
    .from("incidencia_produccion")
    .select(
      `id, turno_id, linea_id, descripcion, fotos, created_at,
      turno:turno_id!inner ( fecha, tipo ),
      linea:linea_id ( nombre ),
      creador:created_by ( username )`,
      { count: "exact" },
    )
    .gte("turno.fecha", args.fecha_desde as string)
    .lte("turno.fecha", args.fecha_hasta as string)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.linea_nombre) {
    const { data: lineaRow } = await supabase
      .from("linea")
      .select("id")
      .ilike("nombre", `%${args.linea_nombre}%`)
      .limit(1)
      .maybeSingle();
    if (lineaRow) base = base.eq("linea_id", lineaRow.id as string);
  }

  const { data, error, count } = await base;
  if (error) throw new Error(`get_incidencias_produccion: ${error.message}`);

  const filasArray = (data ?? []) as any[];
  const filas = filasArray.length;
  const filasTotales = count ?? filas;

  // Operario de línea+turno: no hay FK directa, se resuelve aparte.
  // Solo aplica a incidencias con línea (las generales no tienen operario).
  const conLinea = filasArray.filter((f) => f.linea_id);
  const operarioPorClave = new Map<string, string>();
  if (conLinea.length > 0) {
    const turnoIds = [...new Set(conLinea.map((f) => f.turno_id))];
    const { data: asignaciones } = await supabase
      .from("asignacion_operario_linea")
      .select("turno_id, linea_id, operario:operario_id ( username )")
      .in("turno_id", turnoIds);
    for (const a of asignaciones ?? []) {
      const op = Array.isArray(a.operario) ? a.operario[0] : a.operario;
      if (op?.username) operarioPorClave.set(`${a.turno_id}_${a.linea_id}`, op.username);
    }
  }

  const datos = filasArray.map((f) => ({
    ...f,
    operario_username: f.linea_id ? operarioPorClave.get(`${f.turno_id}_${f.linea_id}`) ?? null : null,
  }));

  return { datos, filas, filas_totales: filasTotales, limitado: filasTotales > filas };
}

export async function ejecutarGetIncidenciasCalidad(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales: number; limitado: boolean }> {
  const limit = LIMITS.get_incidencias_calidad;
  const { data, error, count } = await supabase
    .from("incidencia_calidad")
    .select(
      `id, descripcion, fotos, created_at,
       creador:created_by ( username ),
       parte:parte_id (
         linea:linea_id ( nombre ),
         turno:turno_id ( fecha, tipo ),
         operario:operario_id ( username ),
         lote:lote_id (
           numero_orden,
           producto:producto_id ( modelo:modelo_id ( nombre ) )
         )
       )`,
      { count: "exact" },
    )
    .gte("created_at", `${args.fecha_desde as string}T00:00:00`)
    .lte("created_at", `${args.fecha_hasta as string}T23:59:59`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`get_incidencias_calidad: ${error.message}`);
  const filas = data?.length ?? 0;
  const filasTotales = count ?? filas;
  return { datos, filas, filas_totales: filasTotales, limitado: filasTotales > filas };
}
