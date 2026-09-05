// supabase/functions/ceria/tools.ts
//
// Herramientas de CERIA v3 — adaptadas del diseño de v2 (mismo
// patrón de 3 fases) al esquema real de v3. Dos ejes que NUNCA se
// mezclan (decisión de sesión): PRODUCCIÓN (m², tiempos, incidencias
// de producción) y CALIDAD (1ª/comercial/eco/contenedor, incidencias
// de calidad). Electromecánica (get_averias/get_ajustes) descartada
// por ahora. Gamificación fuera: el jefe no la usa.
//
// Todas las sumas las hace Postgres (vistas v_produccion_turno,
// v_calidad_modelo, v_calidad_lote) — nunca se le pide al modelo que
// sume filas él mismo.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ── LÍMITES de filas para consultas de DETALLE (no agregadas) ────
// Las agregadas (get_produccion_turno, get_calidad_modelo,
// get_calidad_lote) devuelven una fila por grupo, no crecen con el
// volumen de partes — no necesitan este límite.
export const LIMITS: Record<string, number> = {
  get_partes: 300,
  get_incidencias_produccion: 300,
  get_incidencias_calidad: 300,
  get_produccion_turno: 90, // ~90 turnos = 30 días × 3 turnos, tope razonable
  get_calidad_turno: 90,
  get_calidad_modelo: 50,
  get_calidad_lote: 50,
  get_produccion_linea: 10, // como mucho 6 líneas, tope razonable
  get_calidad_linea: 10,
};

// ── SCHEMA de herramientas para la API de OpenAI (function calling) ─
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_identidad",
      description:
        "Responde preguntas sobre CERIA (quién es, qué puede hacer) Y preguntas sobre el " +
        "PROCESO/FUNCIONAMIENTO de la sección (qué hace la Qualitron, el calibre, la " +
        "empaquetadora, el paletizador, categorías de calidad, flujo de una pieza, turnos " +
        "y personal). CUÁNDO USARLA: \"¿quién eres?\", \"¿qué puedes hacer?\", cualquier " +
        "pregunta personal sobre el asistente, o cualquier pregunta sobre cómo funciona la " +
        "sección/máquinas que NO requiera consultar datos concretos (piezas, tiempos, %).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Pide aclaración cuando la pregunta es ambigua y no está claro qué herramienta " +
        "usar. SOLO cuando genuinamente no se pueda determinar la intención — no la uses " +
        "si la intención es clara aunque la pregunta sea breve.",
      parameters: {
        type: "object",
        properties: {
          mensaje: {
            type: "string",
            description: "Pregunta clara al usuario explicando qué necesitas saber",
          },
        },
        required: ["mensaje"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_datos_historial",
      description:
        "Reutiliza datos ya consultados en esta misma conversación en vez de repetir " +
        "la query. CUÁNDO USARLA: preguntas de seguimiento (\"¿y la línea 4?\", " +
        "\"profundiza en eso\") cuando el historial ya trae [DATOS_DISPONIBLES] " +
        "suficientes. NO usarla si se piden fechas distintas o datos más recientes.",
      parameters: {
        type: "object",
        properties: {
          herramienta_origen: {
            type: "string",
            description: "Nombre de la herramienta cuyos datos se van a reutilizar",
          },
        },
        required: ["herramienta_origen"],
      },
    },
  },
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
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<{ datos: unknown; filas: number; filas_totales?: number; limitado?: boolean }> {
  console.log(`[ceria tool] ${toolName}`, JSON.stringify(args));

  switch (toolName) {
    case "get_identidad":
      return { datos: { tipo: "identidad" }, filas: 0 };

    case "get_datos_historial":
      return { datos: { tipo: "historial", herramienta_origen: args.herramienta_origen }, filas: 0 };

    case "ask_user":
      return { datos: { tipo: "ask_user", mensaje: args.mensaje }, filas: 0 };

    case "get_produccion_turno": {
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
      return { datos: data, filas: data?.length ?? 0 };
    }

    case "get_calidad_turno": {
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
      return { datos: data, filas: data?.length ?? 0 };
    }
    
        case "get_produccion_linea": {
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

    case "get_calidad_linea": {
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

    case "get_partes": {
      const limit = LIMITS.get_partes;

      const selectCols = `
        id, tono, piezas_1a, piezas_comercial, piezas_eco, piezas_contenedor, piezas_entradas,
        minutos_total, minutos_plena, minutos_no_alimentada, minutos_saturacion, minutos_banco, minutos_maquina,
        completado, created_at,
        turno:turno_id!inner ( fecha, tipo ),
        linea:linea_id ( nombre ),
        operario:operario_id ( username ),
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

    case "get_calidad_modelo": {
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

    case "get_calidad_lote": {
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

    case "get_incidencias_produccion": {
      const limit = LIMITS.get_incidencias_produccion;
      let base = supabase
        .from("incidencia_produccion")
        .select(
          `id, descripcion, fotos, created_at,
           turno:turno_id!inner ( fecha, tipo ),
           linea:linea_id ( nombre )`,
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
      const filas = data?.length ?? 0;
      const filasTotales = count ?? filas;
      return { datos: data, filas, filas_totales: filasTotales, limitado: filasTotales > filas };
    }

    case "get_incidencias_calidad": {
      const limit = LIMITS.get_incidencias_calidad;
      const { data, error, count } = await supabase
        .from("incidencia_calidad")
        .select(
          `id, descripcion, fotos, created_at,
           parte:parte_id (
             linea:linea_id ( nombre ),
             turno:turno_id ( fecha, tipo ),
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
      return { datos: data, filas, filas_totales: filasTotales, limitado: filasTotales > filas };
    }

    default:
      throw new Error(`Herramienta desconocida: ${toolName}`);
  }
}