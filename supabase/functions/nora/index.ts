// supabase/functions/nora/index.ts
//
// N.O.R.A. — copiloto de averías por voz, independiente de Ceria (ver
// memorias/16-copiloto-averias.md). Todo lo que sea "cómo se comporta
// NORA" (tono, brevedad, cuándo se despide, qué máquinas conoce, qué
// voz usa, sensibilidad al detectar turnos) vive AQUÍ, no en el
// frontend — para cambiarlo basta con editar este archivo y
// `supabase functions deploy nora`, sin tocar ni desplegar la web.
// Solo la tool en sí (su ejecución real contra Supabase) vive en el
// navegador, porque ahí es donde corre el código que la llama.
//
// Dos acciones por el campo "accion" del body:
//   - "token"         → mint de un client_secret efímero de la
//                        Realtime API de OpenAI, MÁS toda la
//                        configuración de comportamiento (prompt,
//                        índice de máquinas, voz, turn detection). El
//                        navegador abre la conexión WebRTC
//                        DIRECTAMENTE contra OpenAI con ese
//                        client_secret — esta función es la única
//                        parada por nuestro servidor en todo el flujo
//                        de voz, justo lo que se buscaba al diseñar
//                        esto (ver discusión en memoria).
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

// Modelo fijo en código — si la calidad razonando el árbol de
// diagnóstico no convence, probar "gpt-realtime-2.1" (el hermano
// grande, más caro) antes de descartar Realtime del todo — cambiar
// solo esta constante.
const MODELO_REALTIME = "gpt-realtime-2.1-mini";

// Voz de salida. Opciones actuales de OpenAI: alloy, ash, ballad,
// coral, echo, sage, shimmer, verse, marin, cedar -- marin y cedar
// son las recomendadas por calidad (pensadas específicamente para
// Realtime). "marin" = clara y profesional; "cedar" = más cercana y
// conversacional. Cambiar aquí para probar la otra.
const VOZ = "marin";

// Índice de máquinas/submáquinas disponible hoy (ver 11-ceria.md,
// "Documentación de máquinas") -- fijo en código. Cuando se
// documenten más máquinas o cambie el desglose, actualizar esta
// lista a mano.
const INDICE_MAQUINAS: Record<string, string[]> = {
  BS08: [
    "Divisor",
    "Escuadrador",
    "Elevador",
    "Sacabandejas",
    "Empujador de bandejas",
    "Mandril",
    "Jaula",
    "Cabezales de impresión",
  ],
};

function construirInstrucciones(): string {
  const indiceTexto = Object.entries(INDICE_MAQUINAS)
    .map(([maquina, submaquinas]) => `${maquina}: ${submaquinas.join(", ")}`)
    .join("\n");

  const partes = [
    "Eres NORA (Navegación, Orientación y Resolución de Averías), copiloto de voz para un mecánico que está delante de la máquina, con las manos ocupadas. Hablas español, con frases cortas -- esto es una conversación de voz, no un informe escrito.",
    `Máquinas y submáquinas disponibles hoy:\n${indiceTexto}`,
    "Cuando el mecánico describa un problema, identifica tú mismo la máquina/submáquina más probable (pregunta UNA cosa corta solo si de verdad no puedes deducirlo) y llama a la herramienta obtener_documentacion con esos datos ANTES de intentar diagnosticar nada -- nunca inventes procedimientos, alarmas o piezas que no estén en lo que te devuelva la herramienta. Puedes llamar a la herramienta varias veces si el problema resulta estar en otra submáquina distinta a la que pensabas al principio, o si hace falta cruzar información de más de una -- no descartes lo ya consultado, sigue teniéndolo en cuenta. Una vez tengas la documentación, guía al mecánico con preguntas cortas, una detrás de otra (estilo socrático), hasta llegar a una causa y una solución concreta.",
    "Sé MUY breve en cada turno -- una o dos frases como mucho, nunca un párrafo largo ni una lista de pasos leída de corrido. Da un solo paso o una sola pregunta cada vez, espera la respuesta del mecánico, y continúa desde ahí. Si la solución tiene varios pasos, dilos de uno en uno, confirmando que ha hecho cada uno antes de pasar al siguiente -- nunca los enumeres todos de golpe.",
    'En cuanto el mecánico diga que el problema ya está resuelto (o algo equivalente: "ya funciona", "ya está", "solucionado"...), no sigas la conversación ni ofrezcas nada más -- despídete en una frase corta y pídele explícitamente que cuelgue él mismo (tú no puedes colgar la llamada, solo él tiene el botón). Por ejemplo: "Perfecto, me alegro. Puedes colgar cuando quieras." Nunca preguntes "¿algo más en lo que pueda ayudarte?" en ese momento -- la despedida cierra la conversación, no la reabre.',
  ];

  return partes.join("\n\n");
}

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
          instructions: construirInstrucciones(),
          audio: {
            input: {
              // semantic_vad: intenta entender si la frase "suena
              // terminada" en vez de solo medir silencio -- mejor que
              // el clásico server_vad en una nave con ruido de fondo,
              // donde el silencio puro es un mal indicador.
              turn_detection: {
                type: "semantic_vad",
                // El mecánico puede cortar a NORA a mitad de frase si
                // ya sabe la respuesta.
                interrupt_response: true,
                // Responde sola en cuanto detecta que el turno
                // terminó, sin que el frontend tenga que pedirlo.
                create_response: true,
              },
              // Necesario para poder guardar más adelante "qué dijo
              // el mecánico" en un historial (ver logging pendiente).
              transcription: { model: "gpt-4o-mini-transcribe" },
            },
            output: { voice: VOZ },
          },
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

  return jsonOk({
    client_secret: clientSecret,
    modelo: MODELO_REALTIME,
    instrucciones: construirInstrucciones(),
    voz: VOZ,
  });
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