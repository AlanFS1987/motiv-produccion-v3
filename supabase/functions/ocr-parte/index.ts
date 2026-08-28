// Edge Function: ocr-parte
// Ref. 11-esquema-supabase.md 13.7, 01-rol-responsable.md 3.2/3.5.
//
// Recibe 1+ fotos de uno de los tres tipos del flujo de captura de
// parte (hoja_partida / caja / pantalla) y devuelve los campos ya
// extraídos, listos para que la app los muestre en la pantalla de
// revisión del responsable (nunca se guardan solos aquí — el
// responsable siempre revisa antes de que se persista nada).
//
// Haiku es el extractor principal (decisión 28/08/2026, tras prueba
// real: cumple mejor el formato/esquema del prompt que GPT-4o-mini),
// GPT como fallback si Haiku falla. Antes era al revés (EN PRUEBA
// 20/08/2026, ver memorias/07-pendientes.md — pendiente ya cerrado).
//
// No escribe en la base de datos — solo llama al modelo y devuelve el
// resultado. La escritura ocurre cuando la app llama después a
// resolver-catalogo (para hoja_partida) o guarda el parte directamente
// (para caja/pantalla, que no crean catálogo).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";
import { extraerConClaude, type ImagenInput } from "../_shared/anthropic.ts";
import { extraerConGPT } from "../_shared/openai.ts";
import {
  PROMPT_CAJA,
  PROMPT_HOJA_PARTIDA,
  PROMPT_PANTALLA,
} from "./prompts.ts";

type FotoTipo = "hoja_partida" | "caja" | "pantalla";

interface RequestBody {
  foto_tipo: FotoTipo;
  imagenes: ImagenInput[];
}

const PROMPTS: Record<FotoTipo, string> = {
  hoja_partida: PROMPT_HOJA_PARTIDA,
  caja: PROMPT_CAJA,
  pantalla: PROMPT_PANTALLA,
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("Método no permitido, usa POST", 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return jsonError("Falta la sesión del usuario", 401);
  }
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Timeout también aquí: si esta llamada a Supabase Auth se cuelga,
  // el código nunca llega a extraerConClaude/extraerConGPT, así que
  // el timeout de anthropic.ts/openai.ts no sirve de nada — visto en
  // real 20/08/2026 (546 / wall clock time limit tras ~150s, con
  // "boot" y "shutdown" en logs pero sin invocación real completada).
  let userData: Awaited<ReturnType<typeof supabaseAuth.auth.getUser>>["data"];
  let userError: Awaited<ReturnType<typeof supabaseAuth.auth.getUser>>["error"];
  try {
    const resultado = await Promise.race([
      supabaseAuth.auth.getUser(jwt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT_AUTH")), 10_000)
      ),
    ]);
    userData = resultado.data;
    userError = resultado.error;
  } catch (err) {
    if (err instanceof Error && err.message === "TIMEOUT_AUTH") {
      console.error("auth.getUser no respondió en 10s — posible causa del colgado real");
      return jsonError("La validación de sesión no respondió a tiempo, inténtalo de nuevo", 504);
    }
    throw err;
  }
  if (userError || !userData?.user) {
    return jsonError("Sesión no válida — vuelve a iniciar sesión", 401);
  }
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  const { foto_tipo, imagenes } = body;

  if (!foto_tipo || !(foto_tipo in PROMPTS)) {
    return jsonError(
      `foto_tipo inválido: "${foto_tipo}". Debe ser hoja_partida, caja o pantalla.`,
      400,
    );
  }

  if (!imagenes || !Array.isArray(imagenes) || imagenes.length === 0) {
    return jsonError("Falta el campo imagenes (array con al menos 1 imagen)", 400);
  }

  if (foto_tipo === "caja" && imagenes.length > 2) {
    return jsonError(
      "La verificación de caja admite máximo 2 fotos (superior + lateral)",
      400,
    );
  }

  const prompt = PROMPTS[foto_tipo];

  // Claude/Haiku primero. Si falla por lo que sea (caída, error de
  // red, JSON inválido...), se reintenta con GPT sin que el
  // responsable note nada — mismo comportamiento, solo cambia
  // extraido_con.
  try {
    const datos = await extraerConClaude(prompt, imagenes);
    return jsonOk({ foto_tipo, datos, extraido_con: "claude" });
  } catch (errClaude) {
    console.error("Error en ocr-parte (Claude, se reintenta con GPT):", errClaude);
    try {
      const datos = await extraerConGPT(prompt, imagenes);
      return jsonOk({ foto_tipo, datos, extraido_con: "gpt" });
    } catch (errGPT) {
      console.error("Error en ocr-parte (GPT, fallback también falló):", errGPT);
      return jsonError(
        errGPT instanceof Error
          ? errGPT.message
          : "Error desconocido procesando el OCR (fallaron Claude y GPT)",
        500,
      );
    }
  }
});