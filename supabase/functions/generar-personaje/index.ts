// Edge Function: generar-personaje
// Ref. 03-rol-operario.md 5.5/5.11, 07-arquitectura.md 9.3,
//      sesión de diseño 22/08/2026 (chat "gamificación").
//
// Siempre manual: el operario o responsable pulsa un botón, nunca se
// dispara solo al subir de nivel (decisión de sesión). Si ya tiene un
// personaje del nivel anterior, se queda con él hasta que pida uno
// nuevo a mano — este endpoint es exactamente ese "pedir uno nuevo".
//
// Igual que en v1/v2: el operario aporta una imagen de referencia
// (cualquier imagen de su galería, ya subida a Cloudinary por el
// frontend) MÁS un fragmento de texto libre. El prompt final que
// recibe GPT Image 1 se compone de 3 partes, en este orden:
//   1. niveles.prompt_imagen — el "qué" (marco, aura, entorno) del
//      nivel actual del usuario, sembrado en BD.
//   2. PROMPT_ESTILO_Y_SEGURIDAD (más abajo) — fijo en el código,
//      mezcla instrucciones de estilo/consistencia visual entre
//      niveles con instrucciones de seguridad (no reproducir rostros
//      reales ni marcas/IP de la imagen de referencia).
//   3. El texto libre del operario — lo último, para que pueda
//      matizar o añadir detalle sin pisar lo anterior.
//
// Flujo:
//   1. Valida el JWT (igual que ocr-parte) y saca el usuario_id.
//   2. fn_consumir_generacion — atómico, falla si no le quedan
//      generaciones disponibles (RPC ya existente desde antes).
//   3. fn_nivel_actual — nivel según sus puntos totales de vida y su
//      rol (operario/responsable).
//   4. Llama a GPT Image 1 (images/edits) con el prompt compuesto +
//      la imagen de referencia.
//   5. Sube el resultado a Cloudinary.
//   6. fn_guardar_personaje_generado — atómico: desmarca el anterior
//      seleccionado, inserta el nuevo ya seleccionado.
//
// Si algo falla DESPUÉS de consumir la generación (pasos 3-6), se
// devuelve la generación consumida — el usuario no debe perder un
// crédito por un fallo de la API externa que no es culpa suya.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { editarImagenPersonaje } from "../_shared/openai_images.ts";
import { construirPublicIdPersonaje, subirPersonajeACloudinary } from "../_shared/cloudinary.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mezcla estilo/consistencia (que los 9 niveles se sientan una misma
// progresión) con seguridad (la imagen de referencia es CUALQUIER
// imagen que el usuario elija de su galería — nunca se le pide que
// sea una foto de su cara, pero tampoco se puede asumir que no lo
// sea, así que se le pide expresamente al modelo que no reproduzca
// rostros reales, marcas registradas ni personajes con derechos de
// autor que pudieran aparecer en ella).
const PROMPT_ESTILO_Y_SEGURIDAD =
  "Genera una ilustración de personaje de videojuego RPG, formato " +
  "retrato vertical, coherente en estilo con el resto de niveles de " +
  "esta progresión. Usa la imagen de referencia SOLO como inspiración " +
  "de estilo, colores, vestuario o ambientación general " +
  "reproduce el rostro real de la persona, no logotipos, " +
  "marcas registradas. Si personajes con derechos de autor que " +
  "pudieran aparecer en ella. El resultado debe ser una  " +
  " fotografía realista de una persona " +
  "identificable, y debe evitar contenido violento.";

interface RequestBody {
  imagen_referencia_url: string;
  prompt_operario?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Método no permitido, usa POST", 405);
  }

  // ---- 1) Auth: mismo patrón que ocr-parte ----
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return jsonError("Falta la sesión del usuario", 401);
  }
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(jwt);
  if (authError || !authData?.user) {
    return jsonError("Sesión no válida", 401);
  }
  const usuarioId = authData.user.id;

  // ---- Body: imagen de referencia (obligatoria) + texto libre (opcional) ----
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }
  if (!body.imagen_referencia_url) {
    return jsonError("Falta imagen_referencia_url — elige una imagen de tu galería antes de generar", 400);
  }

  // ---- 2) Consumir 1 generación disponible (atómico) ----
  const { data: consumida, error: errorConsumo } = await supabaseAdmin.rpc(
    "fn_consumir_generacion",
    { p_usuario_id: usuarioId },
  );
  if (errorConsumo) {
    return jsonError(`Error comprobando generaciones disponibles: ${errorConsumo.message}`, 500);
  }
  if (!consumida) {
    return jsonError("No te quedan generaciones disponibles — consigues 3 más cada vez que subes de nivel", 403);
  }

  // A partir de aquí, si algo falla, se devuelve la generación
  // consumida antes de responder con el error.
  try {
    // ---- 3) Nivel actual ----
    const { data: nivelId, error: errorNivel } = await supabaseAdmin.rpc(
      "fn_nivel_actual",
      { p_usuario_id: usuarioId },
    );
    if (errorNivel || !nivelId) {
      throw new Error(`No se pudo determinar el nivel actual: ${errorNivel?.message ?? "sin nivel"}`);
    }

    const { data: nivel, error: errorNivelFila } = await supabaseAdmin
      .from("niveles")
      .select("id, nombre, prompt_base, prompt_imagen")
      .eq("id", nivelId)
      .single();
    if (errorNivelFila || !nivel) {
      throw new Error(`No se pudo leer el nivel ${nivelId}: ${errorNivelFila?.message}`);
    }

    // ---- 4) Componer el prompt final y generar la imagen ----
    const promptOperario = (body.prompt_operario ?? "").trim();
    const promptFinal = [nivel.prompt_imagen, PROMPT_ESTILO_Y_SEGURIDAD, promptOperario]
      .filter((parte) => parte && parte.length > 0)
      .join("\n\n");

    const base64 = await editarImagenPersonaje(promptFinal, body.imagen_referencia_url);

    // ---- 5) Subir a Cloudinary ----
    const publicId = construirPublicIdPersonaje(usuarioId);
    const subida = await subirPersonajeACloudinary(base64, publicId);

    // ---- 6) Guardar (atómico: desmarca el anterior, inserta el nuevo) ----
    const { data: personaje, error: errorGuardar } = await supabaseAdmin.rpc(
      "fn_guardar_personaje_generado",
      {
        p_usuario_id: usuarioId,
        p_nivel_id: nivel.id,
        p_imagen_url: subida.url,
        p_historia: nivel.prompt_base,
      },
    );
    if (errorGuardar) {
      throw new Error(`No se pudo guardar el personaje generado: ${errorGuardar.message}`);
    }

    return jsonOk({ personaje, nivel: { id: nivel.id, nombre: nivel.nombre } });
  } catch (err) {
    // Devolver la generación consumida — el fallo es de la API
    // externa (OpenAI/Cloudinary), no del usuario.
    await supabaseAdmin.rpc("fn_otorgar_generaciones_por_nivel", {
      p_usuario_id: usuarioId,
      p_cantidad: 1,
    });
    const mensaje = err instanceof Error ? err.message : String(err);
    return jsonError(`No se pudo generar el personaje (se te ha devuelto la generación): ${mensaje}`, 500);
  }
});