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
// Solo accesible para rol 'jefe' o 'administrador' (comprobado aquí,
// además de la RLS de las tablas ceria_* y de las tablas de datos).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { TOOLS, executeTool } from "./tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Modelo: gpt-5-mini (decisión de sesión — la empresa confía en GPT
// sobre otros proveedores). Cambiar aquí si se quiere comparar.
const MODEL = "gpt-5-mini";

function buildSystemPrompt(fechaActual: string): string {
  return `Eres CERIA, asistente de producción para el jefe de planta de MOTIV. Hablas siempre en español.

Hoy es: ${fechaActual}

═══════════════════════════════════════════
REGLA ABSOLUTA — USO OBLIGATORIO DE HERRAMIENTA
═══════════════════════════════════════════
SIEMPRE debes usar una herramienta. Nunca respondas directamente sin
llamar a ninguna. Si no tienes claro cuál usar, usa ask_user. Si
preguntan por ti, usa get_identidad.

═══════════════════════════════════════════
DOS EJES QUE NUNCA SE MEZCLAN
═══════════════════════════════════════════
- PRODUCCIÓN: m², piezas totales, tiempos de máquina, % rendimiento,
  incidencias operativas (paros, fallos). Herramientas: get_produccion_turno,
  get_incidencias_produccion.
- CALIDAD: 1ª/comercial/eco/contenedor, defectos de producto. Herramientas:
  get_calidad_modelo, get_calidad_lote, get_incidencias_calidad.
- get_partes trae ambos bloques del mismo parte, pero SIEMPRE en secciones
  separadas — nunca concluyas que un paro de máquina "causó" un defecto de
  calidad, ni al revés. Son independientes por diseño.

═══════════════════════════════════════════
CALIDAD: DOS MÉTRICAS, MUÉSTRALAS SIEMPRE JUNTAS
═══════════════════════════════════════════
- Completa: cada categoría (1ª/comercial/eco/contenedor) sobre el TOTAL de
  piezas entradas.
- Oficial (métrica empresa): SOLO 1ª y comercial, recalculadas entre sí
  (eco y contenedor se excluyen, como si fueran descarte). Siempre más alta
  que la completa. No las confundas ni elijas una sola — indica cuál es cuál.

═══════════════════════════════════════════
SIN GAMIFICACIÓN
═══════════════════════════════════════════
Nunca menciones puntos, ranking, niveles ni ciclos — el jefe no usa esa
parte de la app. Si preguntan por ranking de operarios, usa ask_user para
aclarar que no tienes esa información aquí.

═══════════════════════════════════════════
FECHAS RELATIVAS
═══════════════════════════════════════════
- "ayer" → día anterior a hoy. "hoy" → hoy. "esta semana" → lunes hasta hoy.
- "semana pasada" → lunes a domingo de la semana anterior.
- "fin de semana" → sábado y domingo MÁS RECIENTES ya transcurridos (nunca
  incluye el lunes).
- "este mes" → día 1 del mes actual hasta hoy. "último mes" → mes natural
  anterior completo.

═══════════════════════════════════════════
TRANSPARENCIA EN DATOS TRUNCADOS
═══════════════════════════════════════════
Si una herramienta devuelve "limitado": true, dilo explícitamente ("he
analizado los X más recientes de un total de Y — si quieres, acota el
rango de fechas para verlos todos"). Nunca des una cifra como si fuera el
total completo cuando no lo es.

═══════════════════════════════════════════
SUMAS
═══════════════════════════════════════════
Todos los totales que ves en los datos YA vienen sumados por la base de
datos. No re-sumes filas tú mismo ni inventes un total que no esté en los
datos recibidos.

═══════════════════════════════════════════
CONTEXTO BÁSICO
═══════════════════════════════════════════
6 líneas de producción. Turnos: M (06-14), T (14-22), N (22-06). Si hay
fotos en incidencias, muéstralas: ![descripción](url). Al inicio de una
respuesta con datos, indica cuántos registros analizaste. Si usas varias
herramientas, separa la respuesta en secciones con encabezado por cada una.

Si el historial contiene bloques [DATOS_DISPONIBLES:herramienta]...[/DATOS_DISPONIBLES],
y la pregunta puede responderse con eso, usa get_datos_historial en vez de
repetir la consulta.`;
}

const MENU_ASK_USER = `No tengo claro qué información necesitas. ¿Cuál de estas opciones se acerca más?

1. 📊 Producción de turnos (m², rendimiento)
2. 👷 Partes por operario o línea
3. 🧱 Calidad de un modelo (histórico)
4. 📦 Calidad de un lote/orden concreto
5. 🛑 Incidencias operativas (paros, fallos)
6. ⚠️ Incidencias de calidad (defectos de producto)`;

async function cargarPrompt(clave: string, supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("ceria_prompts")
    .select("contenido")
    .eq("clave", clave)
    .eq("activo", true)
    .maybeSingle();
  return (data?.contenido as string) ?? "";
}

async function crearConversacion(userId: string, primerMensaje: string, supabase: SupabaseClient): Promise<string> {
  const titulo = primerMensaje.length <= 60 ? primerMensaje : primerMensaje.slice(0, 57) + "...";
  const { data, error } = await supabase
    .from("ceria_conversaciones")
    .insert({ user_id: userId, titulo })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear la conversación: ${error?.message}`);
  return data.id as string;
}

async function guardarMensaje(
  conversacionId: string,
  role: "user" | "assistant",
  contenido: string,
  toolUsada: string | null,
  supabase: SupabaseClient,
  datos: unknown = null,
): Promise<void> {
  const { error } = await supabase
    .from("ceria_mensajes")
    .insert({ conversacion_id: conversacionId, role, contenido, tool_usada: toolUsada, datos });
  if (error) console.error(`[ceria] error guardando mensaje (${role}):`, error);
}

async function cargarHistorial(
  conversacionId: string,
  supabase: SupabaseClient,
): Promise<{ role: string; content: string }[]> {
  const { data, error } = await supabase
    .from("ceria_mensajes")
    .select("role, contenido, tool_usada, datos")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error || !data) return [];
  return data.map((m) => {
    if (m.role === "assistant" && m.datos) {
      return {
        role: m.role,
        content: `${m.contenido}\n\n[DATOS_DISPONIBLES:${m.tool_usada}]\n${JSON.stringify(m.datos)}\n[/DATOS_DISPONIBLES]`,
      };
    }
    return { role: m.role, content: m.contenido as string };
  });
}

// deno-lint-ignore no-explicit-any
async function llamarOpenAI(body: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, ...body }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `OpenAI (${res.status}): ${errText}` };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "OpenAI no respondió a tiempo (timeout de 30s)" };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
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
  if (!perfil || !["jefe", "administrador"].includes(perfil.rol as string)) {
    return jsonError("Ceria solo está disponible para el jefe de planta", 403);
  }

  let body: { pregunta?: string; conversacion_id?: string | null; fecha_referencia?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }
  const { pregunta, conversacion_id: conversacionIdEntrada = null, fecha_referencia = null } = body;
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
    await Promise.all([
      guardarMensaje(conversacionId, "user", pregunta, null, supabase),
      guardarMensaje(conversacionId, "assistant", respuesta, "ask_user", supabase),
    ]);
    return jsonOk({ respuesta, tool_usada: "ask_user", conversacion_id: conversacionId });
  }

  // ══════════════════════════════ FASE 2 — ejecutar herramientas ══
  const resultados = await Promise.all(
    // deno-lint-ignore no-explicit-any
    message1.tool_calls.map(async (tc: any) => {
      const nombre = tc.function.name as string;
      const args = JSON.parse(tc.function.arguments || "{}");
      let resultado;
      try {
        resultado = await executeTool(nombre, args, supabase);
      } catch (err) {
        resultado = { datos: { error: err instanceof Error ? err.message : String(err) }, filas: 0 };
      }
      const prompt = await cargarPrompt(nombre, supabase);
      return { tool_call_id: tc.id as string, nombre, args, prompt, ...resultado };
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
      max_completion_tokens: 500,
    });
    const respuesta = resId.ok
      ? (resId.data.choices?.[0]?.message?.content ?? "Sin respuesta.")
      : "No pude responder ahora mismo.";
    await Promise.all([
      guardarMensaje(conversacionId, "user", pregunta, null, supabase),
      guardarMensaje(conversacionId, "assistant", respuesta, "get_identidad", supabase),
    ]);
    return jsonOk({ respuesta, tool_usada: "get_identidad", conversacion_id: conversacionId });
  }

  // ══════════════════════════════ FASE 3 — redactar respuesta ═════
  const toolMessages = resultados.map((r) => ({
    role: "tool",
    tool_call_id: r.tool_call_id,
    content: JSON.stringify({
      datos: r.datos,
      filas: r.filas,
      filas_totales: r.filas_totales,
      limitado: r.limitado,
    }),
  }));

  const filasInfo = resultados.map((r) => ({
    herramienta: r.nombre,
    filas: r.filas,
    filas_totales: r.filas_totales,
    limitado: r.limitado ?? false,
  }));

  const promptsUsados = [...new Set(resultados.map((r) => r.prompt).filter(Boolean))];
  const systemFase3Parts = [buildSystemPrompt(fechaActual), ...promptsUsados];
  if (resultados.length > 1) {
    systemFase3Parts.push(
      `Has usado ${resultados.length} herramientas: ${resultados.map((r) => r.nombre).join(" y ")}. ` +
        `Separa tu respuesta en secciones claramente diferenciadas, una por herramienta, con encabezado.`,
    );
  }

  const fase3 = await llamarOpenAI({
    messages: [
      { role: "system", content: systemFase3Parts.join("\n\n═══\n\n") },
      ...historialLimpio,
      { role: "user", content: pregunta },
      { role: "assistant", content: null, tool_calls: message1.tool_calls },
      ...toolMessages,
    ],
    // Aquí sí conviene algo de razonamiento (comparar cifras, elegir
    // qué destacar), pero con presupuesto suficiente para que no se
    // coma la respuesta igual que en fase 1.
    max_completion_tokens: 3000,
    reasoning_effort: "low",
  });

  if (!fase3.ok) return jsonError(`Ceria (fase3): ${fase3.error}`, 502);
  const respuesta = fase3.data.choices?.[0]?.message?.content ?? "Sin respuesta.";
  const toolUsadaStr = resultados.map((r) => r.nombre).join(", ");

  const datosCrudos = resultados.reduce((acc: Record<string, unknown>, r) => {
    acc[r.nombre] = r.datos;
    return acc;
  }, {});

  await Promise.all([
    guardarMensaje(conversacionId, "user", pregunta, null, supabase),
    guardarMensaje(conversacionId, "assistant", respuesta, toolUsadaStr, supabase, datosCrudos),
  ]);

  return jsonOk({ respuesta, tool_usada: toolUsadaStr, filas_info: filasInfo, conversacion_id: conversacionId });
});