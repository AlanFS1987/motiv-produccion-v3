// supabase/functions/ceria/index.ts
// CERIA v3 — asistente del jefe de planta.
//
// Mismo patrón de 3 fases que v2 (elegir herramienta → ejecutar →
// redactar respuesta), pero:
//   - GPT-5-mini en vez de DeepSeek (decisión: la empresa confía en GPT).
//   - Adaptado al esquema real de v3 (turno/parte/lote/producto/usuario).
//   - Sin gamificación (el jefe no quiere ver puntos/ranking).
//   - Sin electromecánica (get_averias/get_ajustes descartadas por ahora).
//   - Producción y calidad son ejes SEPARADOS que nunca se mezclan.
//   - Toda suma la hace Postgres (vistas v_produccion_turno,
//     v_calidad_modelo, v_calidad_lote) — nunca el modelo.
//   - Consultas de detalle avisan si el resultado quedó truncado
//     (filas_totales > filas devueltas).
//
// Accesible según chat_acceso (tipo_chat='ceria') — editable por el
// admin desde la app (sesión 07/09/2026), comprobado aquí además de
// la RLS de las tablas ceria_* y de las tablas de datos.
//
// Refactor 10/09/2026: index.ts y tools.ts habían crecido demasiado
// (10 herramientas + orquestación de 3 fases + gestión de
// conversaciones/logs en un solo archivo cada uno). Se dividió en
// módulos dentro de esta misma carpeta de función (Deno empaqueta
// todo el directorio junto, así que esto es seguro) — puro refactor
// de organización, sin cambio de comportamiento:
//   - prompts.ts        → buildSystemPrompt, MENU_ASK_USER, cargarPrompt
//   - conversaciones.ts  → crearConversacion, guardarMensaje, cargarHistorial
//   - openai-fase1.ts    → llamarOpenAI (Fase 1, fija en gpt-5-mini)
//   - tools/             → TOOLS + executeTool, divididos por eje
//     (mecanismo/producción/calidad/incidencias)
//   - modelos.ts         → catálogo y despacho de Fase 3 (sin cambios)

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { TOOLS, executeTool } from "./tools/index.ts";
import { resolverModeloFase3, llamarFase3 } from "./modelos.ts";
import { buildSystemPrompt, MENU_ASK_USER, cargarPrompt } from "./prompts.ts";
import { crearConversacion, guardarMensaje, cargarHistorial } from "./conversaciones.ts";
import { OPENAI_API_KEY, llamarOpenAI } from "./openai-fase1.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Red de seguridad: pese a la instrucción del prompt de nunca
 * devolver JSON crudo, el modelo lo ha hecho en la práctica (visto
 * en real 04-05/09/2026, dos veces). En vez de seguir puliendo solo
 * el prompt, esto garantiza que el jefe nunca vea un objeto {} tal
 * cual — si el texto parece JSON, extrae el campo más probable con
 * el mensaje real.
 */
function sanearRespuestaJSON(texto: string): string {
  const limpio = texto.trim();
  if (!limpio.startsWith("{") && !limpio.startsWith("[")) return texto;
  try {
    // deno-lint-ignore no-explicit-any
    const obj: any = JSON.parse(limpio);
    const candidato = obj.question ?? obj.mensaje ?? obj.respuesta ?? obj.message ?? obj.texto;
    if (typeof candidato === "string" && candidato.trim()) return candidato;
  } catch {
    // No era JSON válido de verdad — se deja el texto tal cual.
  }
  return texto;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Método no permitido, usa POST", 405);
  if (!OPENAI_API_KEY) return jsonError("Falta OPENAI_API_KEY en la Edge Function", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonError("Falta la sesión del usuario", 401);

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonError("Sesión no válida — vuelve a iniciar sesión", 401);
  const user_id = userData.user.id;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Solo jefe/administrador pueden usar Ceria — comprobación explícita
  // aquí además de la RLS de ceria_conversaciones/ceria_mensajes.
  const { data: perfil } = await supabase.from("usuario").select("rol").eq("id", user_id).maybeSingle();
  if (!perfil) {
    return jsonError("Ceria solo está disponible para el jefe de planta", 403);
  }

  // Antes: array fijo ["jefe", "administrador"] escrito a mano aquí
  // mismo. Ahora consulta chat_acceso (20260907180000_chat_acceso_
  // por_rol.sql) — el admin puede dar o quitar acceso a Ceria por rol
  // desde la app, sin tocar código ni desplegar nada.
  const { data: acceso } = await supabase
    .from("chat_acceso")
    .select("puede_ver")
    .eq("tipo_chat", "ceria")
    .eq("rol", perfil.rol)
    .maybeSingle();
  if (!acceso?.puede_ver) {
    return jsonError("Ceria solo está disponible para el jefe de planta", 403);
  }

  let body: {
    pregunta?: string;
    conversacion_id?: string | null;
    fecha_referencia?: string | null;
    modelo_fase3?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }
  const {
    pregunta,
    conversacion_id: conversacionIdEntrada = null,
    fecha_referencia = null,
    modelo_fase3 = null,
  } = body;
  const modeloSeleccionado = await resolverModeloFase3(supabase, modelo_fase3);
  if (!pregunta) return jsonError("Falta el campo 'pregunta'", 400);

  let conversacionId = conversacionIdEntrada;
  if (!conversacionId) {
    conversacionId = await crearConversacion(user_id, pregunta, supabase);
  }

  const historialLimpio = await cargarHistorial(conversacionId, supabase);
  // fecha_referencia: SOLO para pruebas — permite simular "qué día es
  // hoy" (útil mientras la fábrica está parada y los únicos datos
  // reales son de fechas concretas de prueba). En uso normal se omite
  // y se usa la fecha real del servidor.
  const fechaBase = fecha_referencia ? new Date(`${fecha_referencia}T12:00:00`) : new Date();
  const fechaActual = fechaBase.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Madrid",
  });

  // ══════════════════════════════ FASE 1 — elegir herramienta ═════
  const fase1 = await llamarOpenAI({
    messages: [
      { role: "system", content: buildSystemPrompt(fechaActual) },
      ...historialLimpio,
      { role: "user", content: pregunta },
    ],
    tools: TOOLS,
    tool_choice: "required",
    // gpt-5-mini gasta tokens de razonamiento ANTES de responder,
    // invisibles pero contados contra este límite. Elegir una
    // herramienta es una tarea simple — reasoning_effort "low" evita
    // que gaste de más pensando, y 1200 (en vez de 500) deja margen
    // igualmente por si la pregunta es más compleja de clasificar.
    // Sin esto se vio en real: tool_calls vacío pese a "required",
    // porque el presupuesto se agotó razonando.
    max_completion_tokens: 1200,
    reasoning_effort: "low",
  });

  if (!fase1.ok) return jsonError(`Ceria (fase1): ${fase1.error}`, 502);
  const message1 = fase1.data.choices?.[0]?.message;
  if (!message1?.tool_calls?.length) {
    return jsonError("Ceria no eligió ninguna herramienta. Reformula la pregunta.", 500);
  }

  // ── Caso especial: ask_user ───────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const askUserCall = message1.tool_calls.find((tc: any) => tc.function?.name === "ask_user");
  if (askUserCall) {
    const args = JSON.parse(askUserCall.function.arguments || "{}");
    const respuesta = args.mensaje || MENU_ASK_USER;
    await guardarMensaje(conversacionId, "user", pregunta, null, supabase);
    await guardarMensaje(conversacionId, "assistant", respuesta, "ask_user", supabase);
    return jsonOk({ respuesta, tool_usada: "ask_user", conversacion_id: conversacionId });
  }

  // ══════════════════════════════ FASE 2 — ejecutar herramientas ══
  const resultados = await Promise.all(
    // deno-lint-ignore no-explicit-any
    message1.tool_calls.map(async (tc: any) => {
      const nombre = tc.function.name as string;
      const args = JSON.parse(tc.function.arguments || "{}");
      const t0 = performance.now();
      let resultado;
      try {
        resultado = await executeTool(nombre, args, supabase);
      } catch (err) {
        const errorTool = err instanceof Error ? err.message : String(err);
        resultado = { datos: { error: errorTool }, filas: 0 };
      }
      const duracion_ms = Math.round(performance.now() - t0);
      const errorTool = (resultado as any)?.datos?.error && Object.keys((resultado as any).datos).length === 1
        ? (resultado as any).datos.error
        : null;

      supabase
        .from("ceria_tool_logs")
        .insert({
          conversacion_id: conversacionId,
          user_id,
          herramienta: nombre,
          args,
          filas: (resultado as any).filas ?? null,
          filas_totales: (resultado as any).filas_totales ?? null,
          limitado: (resultado as any).limitado ?? false,
          duracion_ms,
          error: errorTool,
        })
        // deno-lint-ignore no-explicit-any
        .then(({ error: logErr }: { error: any }) => {
          if (logErr) console.error("Error guardando log de Ceria:", logErr.message);
        });

      const prompt = await cargarPrompt(nombre, supabase);
      return { tool_call_id: tc.id as string, nombre, args, prompt, ...resultado, duracion_ms };
    }),
  );

  // ── Caso especial: get_identidad (respuesta directa con su prompt) ─
  if (resultados.length === 1 && resultados[0].nombre === "get_identidad") {
    const promptIdentidad =
      resultados[0].prompt ||
      "Eres CERIA, el asistente de producción del jefe de planta de MOTIV. Preséntate brevemente.";
    const resId = await llamarOpenAI({
      messages: [
        { role: "system", content: promptIdentidad },
        ...historialLimpio,
        { role: "user", content: pregunta },
      ],
      max_completion_tokens: 6500,
      reasoning_effort: "low",
    });
    const respuesta = resId.ok
      ? (resId.data.choices?.[0]?.message?.content ?? "Sin respuesta.")
      : "No pude responder ahora mismo.";
    await guardarMensaje(conversacionId, "user", pregunta, null, supabase);
    await guardarMensaje(conversacionId, "assistant", respuesta, "get_identidad", supabase);

    // Antes: no se construía filas_info en esta rama → el desplegable
    // "Ver qué hizo Ceria" del frontend no pintaba nada (solo se
    // muestra si filas_info llega y no está vacío), aunque la llamada
    // ya se había registrado en ceria_tool_logs durante Fase 2.
    const filasInfo = [{
      herramienta: resultados[0].nombre,
      filas: resultados[0].filas,
      filas_totales: resultados[0].filas_totales,
      limitado: resultados[0].limitado ?? false,
      duracion_ms: resultados[0].duracion_ms,
    }];

    return jsonOk({
      respuesta,
      tool_usada: "get_identidad",
      filas_info: filasInfo,
      conversacion_id: conversacionId,
    });
  }

  // ══════════════════════════════ FASE 3 — redactar respuesta ═════
  // Mensajes SIEMPRE genéricos (role: "user"|"assistant", content:
  // string) — sin tool_calls ni mensajes "tool" de OpenAI, para que
  // cualquier proveedor (OpenAI, Anthropic, DeepSeek) pueda leerlos
  // igual. Los datos crudos de las herramientas viajan como un bloque
  // de texto al final de la pregunta, mismo patrón que ya usábamos
  // para [DATOS_DISPONIBLES] en el historial.
  // NUNCA un objeto keyed por nombre de herramienta: si la misma
  // herramienta se llama más de una vez en el mismo turno (p. ej.
  // comparar dos rangos de fechas con get_produccion_linea), una key
  // por nombre sobreescribe la llamada anterior y Fase 3 solo ve la
  // última — bug real (05/09/2026): al comparar línea 3 entre dos
  // semanas, los 3 modelos probados dijeron "sin datos en ningún
  // periodo" porque el resultado con datos reales se perdía aquí,
  // antes de que ningún modelo lo viera. Un array conserva TODAS las
  // llamadas, cada una con sus argumentos, para que Fase 3 sepa a
  // qué rango/filtro corresponde cada resultado.
  const datosCrudos = resultados.map((r) => ({
    herramienta: r.nombre,
    argumentos: r.args,
    datos: r.datos,
  }));

  const filasInfo = resultados.map((r) => ({
    herramienta: r.nombre,
    filas: r.filas,
    filas_totales: r.filas_totales,
    limitado: r.limitado ?? false,
    duracion_ms: r.duracion_ms,
  }));

  const promptsUsados = [...new Set(resultados.map((r) => r.prompt).filter(Boolean))];
  const systemFase3Parts = [buildSystemPrompt(fechaActual), ...promptsUsados];
  if (resultados.length > 1) {
    systemFase3Parts.push(
      `Has usado ${resultados.length} herramientas: ${resultados.map((r) => r.nombre).join(" y ")}. ` +
        `Separa tu respuesta en secciones claramente diferenciadas, una por herramienta, con encabezado.`,
    );
  }

  const mensajesFase3 = [
    ...historialLimpio.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    {
      role: "user" as const,
      content: `${pregunta}\n\n[DATOS_OBTENIDOS]\n${JSON.stringify(datosCrudos)}\n[/DATOS_OBTENIDOS]`,
    },
  ];

  const fase3 = await llamarFase3(
    modeloSeleccionado,
    systemFase3Parts.join("\n\n═══\n\n"),
    mensajesFase3,
  );

  if (!fase3.ok) return jsonError(`Ceria (fase3, ${modeloSeleccionado.etiqueta}): ${fase3.error}`, 502);
  const respuesta = sanearRespuestaJSON(fase3.texto);
  const toolUsadaStr = resultados.map((r) => r.nombre).join(", ");

  await guardarMensaje(conversacionId, "user", pregunta, null, supabase);
  await guardarMensaje(conversacionId, "assistant", respuesta, toolUsadaStr, supabase, datosCrudos);

  return jsonOk({
    respuesta,
    tool_usada: toolUsadaStr,
    filas_info: filasInfo,
    conversacion_id: conversacionId,
    modelo_fase3_usado: modeloSeleccionado.etiqueta,
  });
});
