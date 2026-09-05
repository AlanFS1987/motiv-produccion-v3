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
import { resolverModeloFase3, llamarFase3 } from "./modelos.ts";

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
  get_produccion_linea, get_incidencias_produccion.
- CALIDAD: 1ª/comercial/eco/contenedor, defectos de producto. Herramientas:
  get_calidad_modelo, get_calidad_lote, get_calidad_turno, get_calidad_linea,
  get_incidencias_calidad.
- get_partes trae ambos bloques del mismo parte. Puedes y DEBES mostrarlos
  juntos en la misma tabla o frase cuando ayude a entender el dato — una
  cantidad sin su calidad al lado, o al revés, es un dato pobre. Lo único
  PROHIBIDO es la causalidad: nunca digas que un paro de máquina "explicó"
  o "causó" una calidad baja de ese mismo parte, ni al revés. Son
  independientes en cuanto a CAUSA, no en cuanto a poder mostrarse juntos.
- ANTES de elegir get_partes, comprueba si existe una herramienta agregada
  que ya cubra la pregunta (get_produccion_turno/get_produccion_linea,
  get_calidad_modelo/get_calidad_lote/get_calidad_turno/get_calidad_linea).
  get_partes es SOLO para inspección puntual de filas sueltas — nunca para
  totales, agregados, ni para comparar dos periodos, líneas o modelos.

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
NUNCA DIGAS "SIN DATOS" SI HAY FILAS
═══════════════════════════════════════════
Antes de concluir que "no hay datos" o "sin resultados" para un periodo,
COMPRUEBA si esa llamada concreta trajo filas (filas > 0). Si una de
varias llamadas trajo datos reales y otra no, repórtalo con precisión:
el periodo sin filas no tiene datos, pero el periodo CON filas debe
mostrarse con sus valores reales — nunca agrupes ambos bajo un único
"sin resultados en ninguno de los periodos" cuando alguno sí los tiene.
Los datos que recibes vienen en una LISTA — cada elemento trae
"argumentos" (fecha_desde, fecha_hasta, linea_nombre, etc.) y "datos".
Si una misma herramienta aparece varias veces en la lista, usa
"argumentos" de cada una para saber a qué periodo/filtro corresponde,
nunca asumas que son la misma llamada repetida.

═══════════════════════════════════════════
SUMAS
═══════════════════════════════════════════
Todos los totales que ves en los datos YA vienen sumados por la base de
datos. No re-sumes filas tú mismo ni inventes un total que no esté en los
datos recibidos.

═══════════════════════════════════════════
FORMATO DE RESPUESTA — SIEMPRE TEXTO NATURAL
═══════════════════════════════════════════
Tu respuesta final es SIEMPRE texto natural en español, para que la lea
una persona. NUNCA devuelvas JSON, código ni estructuras de datos crudas
como respuesta — eso es un fallo grave, aunque internamente estés
decidiendo qué preguntar o qué herramienta usar. Si necesitas presentar
datos estructurados, usa una lista o texto plano, nunca un objeto {}.

═══════════════════════════════════════════
NO ABUSES DE LAS PREGUNTAS DE ACLARACIÓN
═══════════════════════════════════════════
Si la petición ya tiene información suficiente para dar una respuesta
razonable — aunque no sea exactamente como la habría pedido el jefe—,
respóndela directamente con una interpretación sensata por defecto, e
indica brevemente qué asumiste. Por defecto, cuando pidan "por lotes" o
"agrupado": agrupa por número de orden, suma piezas, y muestra SIEMPRE
las dos métricas de calidad (completa y oficial) juntas. Pregunta SOLO
cuando la petición sea genuinamente ambigua y cualquier respuesta que
des sin preguntar sería inútil o claramente equivocada — nunca para
matices de formato que puedes decidir tú mismo con un criterio razonable.
Ejemplo real: si piden "dame por lote la cantidad y calidad, todo junto",
agrupa por lote directamente y responde con la tabla de una vez — NO
preguntes "¿agrupado o por partes?", esa petición ya especificó "por
lote", no hay nada que aclarar.

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
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
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
      return { ok: false, error: "OpenAI no respondió a tiempo (timeout de 60s)" };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}
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
  if (!perfil || !["jefe", "administrador"].includes(perfil.rol as string)) {
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
  const modeloSeleccionado = resolverModeloFase3(modelo_fase3);
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
      max_completion_tokens: 3500,
      reasoning_effort: "low",
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

  await Promise.all([
    guardarMensaje(conversacionId, "user", pregunta, null, supabase),
    guardarMensaje(conversacionId, "assistant", respuesta, toolUsadaStr, supabase, datosCrudos),
  ]);

  return jsonOk({
    respuesta,
    tool_usada: toolUsadaStr,
    filas_info: filasInfo,
    conversacion_id: conversacionId,
    modelo_fase3_usado: modeloSeleccionado.etiqueta,
  });
});