// supabase/functions/ceria/tools/mecanismo.ts
//
// Herramientas de "mecanismo" — no consultan datos de negocio, sirven
// para que Ceria elija cómo responder: identidad/funcionamiento de la
// sección, reutilizar datos ya obtenidos, o pedir aclaración.

export const TOOLS_MECANISMO = [
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
];

// ── EJECUTORES ────────────────────────────────────────────────────
// Los tres son triviales (no consultan BD) — se quedan como
// funciones síncronas simples, sin necesitar supabase.

export function ejecutarGetIdentidad(): { datos: unknown; filas: number } {
  return { datos: { tipo: "identidad" }, filas: 0 };
}

export function ejecutarGetDatosHistorial(args: Record<string, unknown>): { datos: unknown; filas: number } {
  return { datos: { tipo: "historial", herramienta_origen: args.herramienta_origen }, filas: 0 };
}

export function ejecutarAskUser(args: Record<string, unknown>): { datos: unknown; filas: number } {
  return { datos: { tipo: "ask_user", mensaje: args.mensaje }, filas: 0 };
}
