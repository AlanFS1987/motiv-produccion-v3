// supabase/functions/ceria/tools/produccion.ts
//
// EJE PRODUCCIÓN: m², piezas, tiempos de máquina, % rendimiento,
// partes individuales. Nunca mezcla datos de calidad — ver calidad.ts.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { LIMITS } from "./limits.ts";
import { enriquecerConResponsable } from "./helpers.ts";

export const TOOLS_PRODUCCION = [
  {
    type: "function",
    function: {
      name: "get_produccion_turno",
      description:
        "EJE PRODUCCIÓN. Resumen agregado (m², piezas, tiempos de máquina, % rendimiento) " +
        "por turno, en un rango de fechas. CUÁNDO USARLA: \"¿qué tal fue el lunes?\", " +
        "\"¿cómo va esta semana?\", \"compara el rendimiento de las líneas\". " +
        "NUNCA incluye datos de calidad (1ª/comercial/etc) — para eso usar " +
        "get_calidad_modelo, get_calidad_lote o get_calidad_turno.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "YYYY-MM-DD (requerido)" },
          fecha_hasta: { type: "string", description: "YYYY-MM-DD (requerido)" },
          turno: { type: "string", enum: ["M", "T", "N"], description: "Filtrar por tipo de turno (opcional)" },
        },
        required: ["fecha_desde", "fecha_hasta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_produccion_linea",
      description:
        "EJE PRODUCCIÓN. Resumen de UNA línea (o todas) agregado sobre TODO un rango de " +
        "fechas — una sola fila por línea con el rango entero ya sumado (no evolución por " +
        "turno). CUÁNDO USARLA: \"¿cómo fue la línea 3 esta semana?\", y sobre todo para " +
        "COMPARAR dos periodos de la misma línea (\"línea 3 esta semana vs la pasada\") — " +
        "en ese caso llama a esta herramienta DOS VECES, una por cada rango, y compara tú " +
        "los resultados. NUNCA uses get_partes para esto — esta herramienta ya suma en " +
        "SQL, get_partes te obligaría a sumar tú mismo con riesgo de error. NUNCA " +
        "incluye calidad — ver get_calidad_linea.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "YYYY-MM-DD (requerido)" },
          fecha_hasta: { type: "string", description: "YYYY-MM-DD (requerido)" },
          linea_nombre: { type: "string", description: "Nombre de línea, ej. 'Línea 3' (opcional, si se omite trae las 6)" },
        },
        required: ["fecha_desde", "fecha_hasta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partes",
      description:
        "Detalle de partes individuales por operario, línea o lote — trae PRODUCCIÓN y " +
        "CALIDAD del mismo parte, pero siempre en dos bloques separados (nunca mezclar " +
        "conclusiones entre ellos). CUÁNDO USARLA: \"¿qué hizo Fulano el martes?\", " +
        "inspección puntual de partes sueltos. NUNCA la uses para totales, agregados o " +
        "para COMPARAR periodos/líneas/modelos — para eso ya existen herramientas que " +
        "suman en SQL: get_produccion_turno/get_produccion_linea (producción), " +
        "get_calidad_modelo/get_calidad_lote/get_calidad_turno/get_calidad_linea " +
        "(calidad). Si dudas entre get_partes y una de esas, usa siempre la agregada " +
        "primero. Puede venir limitado a las filas más recientes — si `limitado=true` " +
        "en la respuesta, avisa siempre al usuario.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "YYYY-MM-DD (requerido)" },
          fecha_hasta: { type: "string", description: "YYYY-MM-DD (requerido)" },
          operario_username: { type: "string", description: "Username del operario (opcional)" },
          linea_nombre: { type: "string", description: "Nombre de línea, ej. 'Línea 3' (opcional)" },
        },
        required: ["fecha_desde", "fecha_hasta"],
      },
    },
  },
];

// ── EJECUTORES ────────────────────────────────────────────────────

export async function ejecutarGetProduccionTurno(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number }> {
  const limit = LIMITS.get_produccion_turno;
  let q = supabase
    .from("v_produccion_turno")
    .select("*")
    .gte("fecha", args.fecha_desde as string)
    .lte("fecha", args.fecha_hasta as string)
    .order("fecha", { ascending: false })
    .limit(limit);
  if (args.turno) q = q.eq("tipo_turno", args.turno as string);
  const { data, error } = await q;
  if (error) throw new Error(`get_produccion_turno: ${error.message}`);
  const datos = await enriquecerConResponsable((data ?? []) as any[], supabase);
  return { datos, filas: datos.length };
}

export async function ejecutarGetProduccionLinea(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number }> {
  const limit = LIMITS.get_produccion_linea;
  const { data, error } = await supabase.rpc("produccion_linea_por_fecha", {
    p_fecha_desde: args.fecha_desde,
    p_fecha_hasta: args.fecha_hasta ?? args.fecha_desde,
    p_linea_nombre: args.linea_nombre ?? null,
  });
  if (error) throw new Error(`get_produccion_linea: ${error.message}`);
  const filas = (data ?? []).slice(0, limit);
  return { datos: filas, filas: filas.length };
}

export async function ejecutarGetPartes(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales: number; limitado: boolean }> {
  const limit = LIMITS.get_partes;

  const selectCols = `
    id, tono, piezas_1a, piezas_comercial, piezas_eco, piezas_contenedor, piezas_entradas,
    minutos_total, minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
    completado, created_at,
    turno:turno_id!inner ( fecha, tipo ),
    linea:linea_id ( nombre ),
    operario:operario_id ( username ),
    responsable:responsable_id ( username ),
    lote:lote_id (
      numero_orden,
      producto:producto_id (
        modelo:modelo_id ( nombre ),
        formato:formato_id ( nombre, area_m2 )
      )
    )
  `;

  let base = supabase
    .from("parte")
    .select(selectCols, { count: "exact" })
    .eq("vigente", true)
    .eq("completado", true)
    .gte("turno.fecha", args.fecha_desde as string)
    .lte("turno.fecha", args.fecha_hasta as string)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Filtros por nombre — se resuelven en dos pasos porque
  // PostgREST no filtra fácilmente por columnas de tablas
  // relacionadas anidadas a 2 niveles dentro de un mismo select.
  if (args.linea_nombre) {
    const { data: lineaRow } = await supabase
      .from("linea")
      .select("id")
      .ilike("nombre", `%${args.linea_nombre}%`)
      .limit(1)
      .maybeSingle();
    if (lineaRow) base = base.eq("linea_id", lineaRow.id as string);
  }
  if (args.operario_username) {
    const { data: opRow } = await supabase
      .from("usuario")
      .select("id")
      .ilike("username", `%${args.operario_username}%`)
      .limit(1)
      .maybeSingle();
    if (opRow) base = base.eq("operario_id", opRow.id as string);
  }

  const { data, error, count } = await base;
  if (error) throw new Error(`get_partes: ${error.message}`);

  const filas = data?.length ?? 0;
  const filasTotales = count ?? filas;
  return {
    datos: data,
    filas,
    filas_totales: filasTotales,
    limitado: filasTotales > filas,
  };
}
