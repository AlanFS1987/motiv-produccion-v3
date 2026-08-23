// Edge Function: generar-personaje
// Reescrita 23/08/2026 — generaciones ligadas a CADA NIVEL, no un
// contador plano del nivel actual en vivo. El operario elige PARA
// QUÉ NIVEL de los que ya alcanzó quiere generar (nivel_id en el
// body), y tanto la imagen como la historia usan las stats
// CONGELADAS de personaje_stats_nivel de ESE nivel — no fn_nivel_actual
// ni v_stats_vida en vivo. Esto también corrige una inconsistencia de
// la versión anterior: antes la imagen ya era de un nivel fijo pero
// la historia se generaba con stats en vivo, pudiendo no cuadrar.
//
// Flujo:
//   1. Valida el JWT y saca el usuario_id.
//   2. fn_consumir_generacion_nivel(nivel_id) — atómico, falla si no
//      alcanzó ese nivel o ya gastó sus 3 generaciones ahí.
//   3. Lee niveles (nombre, orden, prompt_base, prompt_imagen) del
//      nivel_id pedido, y personaje_stats_nivel (stats congeladas de
//      CUANDO alcanzó ese nivel) del mismo usuario_id+nivel_id.
//   4. Genera la imagen (GPT Image 2) con el prompt de ESE nivel.
//   5. Sube a Cloudinary.
//   6. Genera la historia (DeepSeek) con las stats CONGELADAS.
//   7. Guarda (fn_guardar_personaje_generado) con nivel_id = el pedido.
//
// Si algo falla en los pasos 3-7, se devuelve la generación con
// fn_devolver_generacion_nivel(nivel_id) — el operario no pierde el
// crédito por un fallo de una API externa. Un fallo SOLO de DeepSeek
// (paso 6) no cuenta como fallo: generarHistoriaOperario nunca lanza,
// se sigue el flujo con historia=null.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { editarImagenPersonaje } from "../_shared/openai_images.ts";
import { construirPublicIdPersonaje, subirPersonajeACloudinary } from "../_shared/cloudinary.ts";
import { generarHistoriaOperario } from "../_shared/deepseek_historia.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PROMPT_ESTILO_Y_SEGURIDAD =
  "Genera una ilustración de personaje de videojuego RPG con acabado fotorrealista, en formato retrato vertical. " +
  "Utiliza la imagen de referencia como fuente principal para la identidad visual de la persona. Preserva fielmente sus rasgos faciales, proporciones del rostro, estructura facial y apariencia general, evitando alterar o sustituir su identidad. " +
  "Mantén una estética coherente con el resto de niveles de esta progresión. Utiliza la imagen de referencia también como inspiración para la paleta de colores, vestuario, iluminación, ambientación y lenguaje visual general, adaptándolos al concepto de personaje RPG sin copiar elementos de marca. " +
  "El resultado debe parecer una fotografía fotorrealista de la persona transformada en un personaje de videojuego RPG, manteniendo una apariencia natural, adulta y reconocible. " +
  "Evita logotipos, marcas registradas, nombres comerciales, textos identificables y elementos de propiedad intelectual que puedan aparecer en la imagen de referencia; sustitúyelos por diseños originales equivalentes. " +
  "No incluyas contenido sexual explícito, desnudez, violencia gráfica, gore ni elementos que impliquen daño físico explícito. " +
  "Prioriza: identidad facial fiel y reconocible, fotorealismo, coherencia visual con la progresión de niveles, composición vertical y acabado profesional de personaje RPG.";

interface RequestBody {
  nivel_id: string;
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

  // ---- 1) Auth ----
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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }
  if (!body.nivel_id) {
    return jsonError("Falta nivel_id — elige para qué nivel quieres generar", 400);
  }
  if (!body.imagen_referencia_url) {
    return jsonError("Falta imagen_referencia_url — elige una imagen de tu galería antes de generar", 400);
  }

  // ---- 2) Consumir 1 generación de ESE nivel (atómico) ----
  const { data: consumida, error: errorConsumo } = await supabaseAdmin.rpc(
    "fn_consumir_generacion_nivel",
    { p_usuario_id: usuarioId, p_nivel_id: body.nivel_id },
  );
  if (errorConsumo) {
    return jsonError(`Error comprobando generaciones disponibles: ${errorConsumo.message}`, 500);
  }
  if (!consumida) {
    return jsonError("No tienes generaciones disponibles para ese nivel (o no lo has alcanzado)", 403);
  }

  // A partir de aquí, si algo falla, se devuelve la generación de ESE nivel.
  try {
    // ---- 3a) Nivel pedido (no el actual en vivo) ----
    const { data: nivel, error: errorNivelFila } = await supabaseAdmin
      .from("niveles")
      .select("id, nombre, orden, prompt_base, prompt_imagen")
      .eq("id", body.nivel_id)
      .single();
    if (errorNivelFila || !nivel) {
      throw new Error(`No se pudo leer el nivel ${body.nivel_id}: ${errorNivelFila?.message}`);
    }

    // ---- 3b) Stats CONGELADAS de cuando este usuario alcanzó ese
    // nivel (no v_stats_vida en vivo) + username.
    const [{ data: statsFila, error: errorStats }, { data: usuarioFila, error: errorUsuario }] = await Promise.all([
      supabaseAdmin
        .from("personaje_stats_nivel")
        .select("fuerza, resistencia, velocidad, vida")
        .eq("usuario_id", usuarioId)
        .eq("nivel_id", body.nivel_id)
        .single(),
      supabaseAdmin.from("usuario").select("username").eq("id", usuarioId).single(),
    ]);
    if (errorStats || !statsFila) {
      throw new Error(`No hay stats congeladas para este usuario en ese nivel: ${errorStats?.message ?? "sin fila"}`);
    }
    if (errorUsuario || !usuarioFila) {
      throw new Error(`No se pudo leer el usuario: ${errorUsuario?.message}`);
    }

    // ---- 4) Componer el prompt de la IMAGEN y generarla ----
    const promptOperario = (body.prompt_operario ?? "").trim();
    const promptImagenFinal = [nivel.prompt_imagen, PROMPT_ESTILO_Y_SEGURIDAD, promptOperario]
      .filter((parte) => parte && parte.length > 0)
      .join("\n\n");

    const base64 = await editarImagenPersonaje(promptImagenFinal, body.imagen_referencia_url);

    // ---- 5) Subir a Cloudinary ----
    const publicId = construirPublicIdPersonaje(usuarioId);
    const subida = await subirPersonajeACloudinary(base64, publicId);

    // ---- 6) Historia (DeepSeek) — con las stats CONGELADAS de este
    // nivel, coherente con la imagen. Nunca lanza, puede ser null.
    const historia = await generarHistoriaOperario({
      nombreOperario: usuarioFila.username,
      nivelNombre: nivel.nombre,
      nivelOrden: nivel.orden,
      nivelPromptBase: nivel.prompt_base,
      nivelPromptImagen: nivel.prompt_imagen,
      fuerza: statsFila.fuerza,
      resistencia: statsFila.resistencia,
      velocidad: statsFila.velocidad,
      vida: statsFila.vida,
      textoOperario: promptOperario,
    });

    // ---- 7) Guardar (atómico: desmarca el anterior, inserta el nuevo) ----
    const { data: personaje, error: errorGuardar } = await supabaseAdmin.rpc(
      "fn_guardar_personaje_generado",
      {
        p_usuario_id: usuarioId,
        p_nivel_id: nivel.id,
        p_imagen_url: subida.url,
        p_historia: historia,
      },
    );
    if (errorGuardar) {
      throw new Error(`No se pudo guardar el personaje generado: ${errorGuardar.message}`);
    }

    return jsonOk({
      personaje,
      nivel: { id: nivel.id, nombre: nivel.nombre },
      historia_pendiente: historia === null,
    });
  } catch (err) {
    // Devolver la generación de ESTE nivel — el fallo es de una API
    // externa, no del usuario.
    await supabaseAdmin.rpc("fn_devolver_generacion_nivel", { p_usuario_id: usuarioId, p_nivel_id: body.nivel_id });
    const mensaje = err instanceof Error ? err.message : String(err);
    return jsonError(`No se pudo generar el personaje (se te ha devuelto la generación): ${mensaje}`, 500);
  }
});