// supabase/functions/nora/index.ts
//
// N.O.R.A. — copiloto de averías por voz, independiente de Ceria (ver
// memorias/16-copiloto-averias.md). Primer experimento: solo dos
// acciones, sin logging todavía, sin selector de submáquina en el
// prompt completo (eso vive en el frontend, ver lib/nora.ts) — sirve
// para validar si Realtime + tool calling contra
// ceria_documentacion_maquina funciona con la latencia que buscamos,
// antes de construir el resto (esquema de conversaciones, pantalla
// definitiva, acumular varias submáquinas en una misma sesión, etc.)
//
// Dos acciones por el campo "accion" del body:
//   - "token"         → mint de un client_secret efímero de la
//                        Realtime API de OpenAI. El navegador abre la
//                        conexión WebRTC DIRECTAMENTE contra OpenAI
//                        con ese client_secret — esta función es la
//                        única parada por nuestro servidor en todo el
//                        flujo de voz, justo lo que se buscaba al
//                        diseñar esto (ver discusión en memoria).
//   - "documentacion"  → la tool que el modelo llama durante la
//                        conversación: trae las filas de
//                        ceria_documentacion_maquina para la
//                        maquina/submaquina que identifique.
//
// Acceso: chat_acceso (tipo_chat='nora'), mismo patrón que Ceria
// (20260907180000_chat_acceso_por_rol.sql) — comprobado aquí además
// de que exista sesión válida. El admin gestiona qué roles tienen
// acceso desde ChatAccesoScreen.tsx, sin tocar código ni desplegar
// nada (ver migración 20260912120000_chat_acceso_nora.sql para la
// semilla inicial de jefe+administrador).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compartida con ceria/ocr-parte — no hace falta un secret nuevo.
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Modelo fijo en código durante el experimento — "mini" por coste y
// velocidad. Si la calidad razonando el árbol de diagnóstico no
// convence, probar "gpt-realtime" (más caro) antes de descartar
// Realtime del todo — cambiar solo esta constante.
const MODELO_REALTIME = "gpt-realtime-mini";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Método no permitido, usa POST", 405);
  if (!OPENAI_API_KEY) return jsonError("Falta OPENAI_API_KEY en la Edge Function", 500);

  // --- Auth + acceso (idéntico a ceria/index.ts) ---------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonError("Falta la sesión del usuario", 401);

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonError("Sesión no válida — vuelve a iniciar sesión", 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: perfil } = await supabase.from("usuario").select("rol").eq("id", userData.user.id).maybeSingle();
  if (!perfil) return jsonError("NORA no está disponible para esta cuenta", 403);

  const { data: acceso } = await supabase
    .from("chat_acceso")
    .select("puede_ver")
    .eq("tipo_chat", "nora")
    .eq("rol", perfil.rol)
    .maybeSingle();
  if (!acceso?.puede_ver) return jsonError("NORA no está disponible para tu rol", 403);

  // --- Body -----------------------------------------------------------
  let body: { accion?: string; maquina?: string; submaquina?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  if (body.accion === "token") {
    return await mintToken();
  }

  if (body.accion === "documentacion") {
    return await obtenerDocumentacion(supabase, body.maquina, body.submaquina ?? null);
  }

  return jsonError(`accion inválida: "${body.accion}". Usa "token" o "documentacion".`, 400);
});

// ══════════════════════════════ accion: token ═══════════════════════
async function mintToken(): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODELO_REALTIME,
        },
        // TTL corto — solo lo justo para que el navegador abra la
        // conexión WebRTC nada más recibirlo. Según la documentación
        // de OpenAI, la sesión de voz en sí puede seguir después de
        // que el client_secret expire, una vez ya se ha usado para
        // arrancarla.
        expires_after: { anchor: "created_at", seconds: 60 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return jsonError("OpenAI no respondió a tiempo generando el token de sesión", 504);
    }
    return jsonError(`Error de red llamando a OpenAI: ${err instanceof Error ? err.message : String(err)}`, 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const texto = await res.text();
    return jsonError(`OpenAI rechazó la creación del token (${res.status}): ${texto}`, 502);
  }

  const data = await res.json();
  // La forma exacta de la respuesta (client_secret en la raíz o
  // anidado) es un detalle de la API que puede cambiar entre
  // versiones — se comprueban ambas rutas para no depender de una
  // sola. Si ninguna existe, es un fallo real que conviene ver en los
  // logs de la función.
  const clientSecret = data?.value ?? data?.client_secret?.value;
  if (!clientSecret) {
    console.error("Respuesta de OpenAI sin client_secret reconocible:", JSON.stringify(data));
    return jsonError("La respuesta de OpenAI no traía un client_secret reconocible", 502);
  }

  return jsonOk({ client_secret: clientSecret, modelo: MODELO_REALTIME });
}

// ══════════════════════════ accion: documentacion ═══════════════════
async function obtenerDocumentacion(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  maquina: string | undefined,
  submaquina: string | null,
): Promise<Response> {
  if (!maquina) return jsonError("Falta el campo 'maquina'", 400);

  let query = supabase
    .from("ceria_documentacion_maquina")
    .select("tipo, nombre, contenido")
    .eq("maquina", maquina)
    .eq("activo", true)
    .order("tipo", { ascending: true })
    .order("nombre", { ascending: true });

  query = submaquina === null ? query.is("submaquina", null) : query.eq("submaquina", submaquina);

  const { data, error } = await query;
  if (error) return jsonError(`Error consultando documentación: ${error.message}`, 500);

  if (!data || data.length === 0) {
    return jsonOk({
      contenido: `No hay documentación capturada todavía para ${maquina}${submaquina ? " / " + submaquina : ""}.`,
      filas: 0,
    });
  }

  // Texto plano, agrupado por tipo — el modelo ya sabe leer prosa, no
  // hace falta mandarle JSON. Un encabezado por tipo ayuda a que no
  // confunda "proceso" con "diagnostico" al razonar sobre esto.
  const porTipo = new Map<string, { nombre: string; contenido: string }[]>();
  for (const fila of data) {
    const lista = porTipo.get(fila.tipo) ?? [];
    lista.push({ nombre: fila.nombre, contenido: fila.contenido });
    porTipo.set(fila.tipo, lista);
  }

  const bloques: string[] = [];
  for (const [tipo, filas] of porTipo) {
    bloques.push(`## ${tipo.toUpperCase()}`);
    for (const f of filas) {
      bloques.push(`### ${f.nombre}\n${f.contenido}`);
    }
  }

  return jsonOk({ contenido: bloques.join("\n\n"), filas: data.length });
}
