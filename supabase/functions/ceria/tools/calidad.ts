// supabase/functions/ceria/tools/calidad.ts
//
// EJE CALIDAD: 1ª/comercial/eco/contenedor, siempre con las dos
// métricas (completa y oficial). Nunca mezcla tiempos ni rendimiento
// — eso es producción, ver produccion.ts.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { LIMITS } from "./limits.ts";
import { enriquecerConResponsable } from "./helpers.ts";

export const TOOLS_CALIDAD = [
  {
    type: "function",
    function: {
      name: "get_calidad_turno",
      description:
        "EJE CALIDAD. Resumen de calidad (1ª/comercial/eco/contenedor, completa y oficial, " +
        "más m²) agregado por turno, en un rango de fechas — mismas claves fecha+turno que " +
        "get_produccion_turno, para el resumen diario. CUÁNDO USARLA: \"¿cómo fue la " +
        "calidad de ayer?\", \"calidad de esta semana\", \"solo el turno de noche\". Para " +
        "el resumen completo del día, úsala JUNTO con get_produccion_turno. NUNCA incluye " +
        "tiempos de máquina ni % de rendimiento — eso es producción pura.",
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
      name: "get_calidad_modelo",
      description:
        "EJE CALIDAD. Calidad histórica agregada por modelo/producto (1ª, comercial, eco, " +
        "contenedor) — incluye SIEMPRE dos métricas: 'completa' (sobre el total real) y " +
        "'oficial' (solo 1ª+comercial entre sí, la métrica de empresa). CUÁNDO USARLA: " +
        "\"¿cuánto BALI ROCK se ha producido y con qué calidad?\". Histórico completo por " +
        "defecto (sin filtro de fecha). Si das fecha_desde/fecha_hasta, filtra con " +
        "precisión por esas fechas (turno.fecha real de cada parte) — ÚSALO SIEMPRE que la " +
        "pregunta mencione un periodo, en vez de get_partes + sumar tú mismo. NUNCA incluye " +
        "tiempos ni rendimiento — eso es producción, ver get_produccion_turno.",
      parameters: {
        type: "object",
        properties: {
          nombre_modelo: { type: "string", description: "Búsqueda parcial por nombre del modelo (opcional)" },
          formato: { type: "string", description: "ej. '600x1200' (opcional)" },
          fecha_desde: {
            type: "string",
            description: "YYYY-MM-DD (opcional). Si se omite, agrega TODO el histórico, sin filtrar.",
          },
          fecha_hasta: {
            type: "string",
            description: "YYYY-MM-DD (opcional). Si se omite y hay fecha_desde, se asume un solo día.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calidad_lote",
      description:
        "EJE CALIDAD. Calidad agregada por lote/orden. Dos modos: (1) CONSULTA CONCRETA: " +
        "con numero_orden, calidad de esa orden en particular. (2) RANKING: sin numero_orden, " +
        "devuelve varios lotes ordenados por calidad oficial (mejor o peor) — usar para " +
        "\"¿cuál es el mejor/peor lote?\", \"compara la calidad entre lotes\". " +
        "Mismas dos métricas que get_calidad_modelo (completa y oficial) en ambos modos. " +
        "Si das fecha_desde/fecha_hasta, filtra con precisión por esas fechas (usa " +
        "turno.fecha real de cada parte) — ÚSALO SIEMPRE que la pregunta mencione un día, " +
        "semana o rango concreto, en vez de pedir get_partes y sumar tú mismo: eso es " +
        "propenso a error con varios partes por lote, esta herramienta ya suma en SQL.",
      parameters: {
        type: "object",
        properties: {
          numero_orden: {
            type: "string",
            description: "Número de orden exacto o parcial. Omitir para modo ranking (varios lotes).",
          },
          orden_calidad: {
            type: "string",
            enum: ["mejor_primero", "peor_primero"],
            description: "Solo en modo ranking: cómo ordenar por pct_1a_oficial (opcional, default mejor_primero)",
          },
          fecha_desde: {
            type: "string",
            description: "YYYY-MM-DD (opcional). Si se omite, agrega TODO el histórico del lote, sin filtrar.",
          },
          fecha_hasta: {
            type: "string",
            description: "YYYY-MM-DD (opcional). Si se omite y hay fecha_desde, se asume un solo día.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calidad_linea",
      description:
        "EJE CALIDAD. Resumen de calidad de UNA línea (o todas) agregado sobre TODO un " +
        "rango de fechas — una sola fila por línea. Mismo caso de uso que " +
        "get_produccion_linea: para comparar dos periodos, llamar dos veces con rangos " +
        "distintos. NUNCA uses get_partes para esto — esta herramienta ya suma en SQL. " +
        "Incluye SIEMPRE las dos métricas (completa y oficial). NUNCA incluye tiempos ni " +
        "rendimiento — ver get_produccion_linea.",
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
];

// ── EJECUTORES ────────────────────────────────────────────────────

export async function ejecutarGetCalidadTurno(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number }> {
  const limit = LIMITS.get_calidad_turno;
  let q = supabase
    .from("v_calidad_turno")
    .select("*")
    .gte("fecha", args.fecha_desde as string)
    .lte("fecha", args.fecha_hasta as string)
    .order("fecha", { ascending: false })
    .limit(limit);
  if (args.turno) q = q.eq("tipo_turno", args.turno as string);
  const { data, error } = await q;
  if (error) throw new Error(`get_calidad_turno: ${error.message}`);
  const datos = await enriquecerConResponsable((data ?? []) as any[], supabase);
  return { datos, filas: datos.length };
}

export async function ejecutarGetCalidadModelo(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales?: number; limitado?: boolean }> {
  const limit = LIMITS.get_calidad_modelo;

  if (args.fecha_desde) {
    const { data, error } = await supabase.rpc("calidad_modelo_por_fecha", {
      p_fecha_desde: args.fecha_desde,
      p_fecha_hasta: args.fecha_hasta ?? args.fecha_desde,
      p_nombre_modelo: args.nombre_modelo ?? null,
      p_formato: args.formato ?? null,
    });
    if (error) throw new Error(`get_calidad_modelo (con fecha): ${error.message}`);
    const filas = (data ?? []).slice(0, limit);
    return {
      datos: filas,
      filas: filas.length,
      filas_totales: data?.length ?? 0,
      limitado: (data?.length ?? 0) > limit,
    };
  }

  let q = supabase
    .from("v_calidad_modelo")
    .select("*")
    .order("piezas_entradas", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (args.nombre_modelo) q = q.ilike("modelo_nombre", `%${args.nombre_modelo}%`);
  if (args.formato) q = q.eq("formato_nombre", args.formato as string);
  const { data, error } = await q;
  if (error) throw new Error(`get_calidad_modelo: ${error.message}`);
  return { datos: data, filas: data?.length ?? 0 };
}

export async function ejecutarGetCalidadLote(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales?: number; limitado?: boolean }> {
  const limit = LIMITS.get_calidad_lote;

  // Con fecha: usa la función SQL nueva, que filtra con precisión
  // por turno.fecha (no la aproximación de v_calidad_lote). Cubre
  // los dos modos (consulta concreta y ranking) en un solo camino,
  // porque p_numero_orden acepta null.
  if (args.fecha_desde) {
    const { data, error } = await supabase.rpc("calidad_lote_por_fecha", {
      p_fecha_desde: args.fecha_desde,
      p_fecha_hasta: args.fecha_hasta ?? args.fecha_desde,
      p_numero_orden: args.numero_orden ?? null,
      p_orden_calidad: args.orden_calidad ?? "mejor_primero",
    });
    if (error) throw new Error(`get_calidad_lote (con fecha): ${error.message}`);
    const filas = (data ?? []).slice(0, limit);
    return {
      datos: filas,
      filas: filas.length,
      filas_totales: data?.length ?? 0,
      limitado: (data?.length ?? 0) > limit,
    };
  }

  // Sin fecha: histórico completo, como siempre.
  if (args.numero_orden) {
    const { data, error } = await supabase
      .from("v_calidad_lote")
      .select("*")
      .ilike("numero_orden", `%${args.numero_orden}%`)
      .limit(limit);
    if (error) throw new Error(`get_calidad_lote: ${error.message}`);
    return { datos: data, filas: data?.length ?? 0 };
  }

  // Modo ranking: sin numero_orden, se listan varios lotes
  // ordenados por calidad oficial — para "¿cuál es el mejor/peor
  // lote?". El orden lo decide SQL (ORDER BY), nunca el modelo.
  const ascendente = args.orden_calidad === "peor_primero";
  const { data, error } = await supabase
    .from("v_calidad_lote")
    .select("*")
    .order("pct_1a_oficial", { ascending: ascendente, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`get_calidad_lote (ranking): ${error.message}`);
  return { datos: data, filas: data?.length ?? 0 };
}

export async function ejecutarGetCalidadLinea(
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number }> {
  const limit = LIMITS.get_calidad_linea;
  const { data, error } = await supabase.rpc("calidad_linea_por_fecha", {
    p_fecha_desde: args.fecha_desde,
    p_fecha_hasta: args.fecha_hasta ?? args.fecha_desde,
    p_linea_nombre: args.linea_nombre ?? null,
  });
  if (error) throw new Error(`get_calidad_linea: ${error.message}`);
  const filas = (data ?? []).slice(0, limit);
  return { datos: filas, filas: filas.length };
}
