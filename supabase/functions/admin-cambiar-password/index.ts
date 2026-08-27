// supabase/functions/admin-cambiar-password/index.ts
//
// Cambia la contraseña de cualquier cuenta EXCEPTO las que tengan
// rol 'administrador' — decisión de diseño (sesión 27/08/2026): en
// vez de excluir solo "la cuenta del propio admin que llama", se
// excluye a CUALQUIER administrador como objetivo. Es la opción más
// simple de razonar y más segura: ni siquiera un admin puede resetear
// la contraseña de otro admin (ni la suya propia) por esta vía. Si
// alguna vez hace falta lo contrario, revisar aquí primero.
//
// Barreras de seguridad (mismo checklist que admin-crear-usuario):
//  1) JWT de quien llama + comprobación de rol 'administrador'.
//  2) Objetivo validado contra la tabla `usuario` — se rechaza si no
//     existe o si su rol es 'administrador'. Nunca se confía en que
//     "el cliente nunca mandaría el id de un admin".
//  3) Errores propios, nunca el error crudo de Auth/Postgres.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  usuario_id?: string;
  password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Método no permitido, usa POST", 405);

  // --- 1) Verificar sesión y rol de quien llama ---------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonError("Falta la sesión del usuario", 401);

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonError("Sesión no válida — vuelve a iniciar sesión", 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: perfilLlamador } = await supabaseAdmin
    .from("usuario")
    .select("rol")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!perfilLlamador || perfilLlamador.rol !== "administrador") {
    return jsonError("Solo un administrador puede cambiar contraseñas", 403);
  }

  // --- 2) Validar el cuerpo -------------------------------------------
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  const usuarioId = body.usuario_id?.trim() ?? "";
  const password = body.password ?? "";

  if (!usuarioId) return jsonError("Falta el usuario objetivo", 400);
  if (!password || password.length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres", 400);
  }

  // --- 3) Validar el objetivo: existe y no es administrador -----------
  const { data: perfilObjetivo } = await supabaseAdmin
    .from("usuario")
    .select("id, rol, username")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!perfilObjetivo) return jsonError("El usuario indicado no existe", 404);
  if (perfilObjetivo.rol === "administrador") {
    return jsonError("No se puede cambiar la contraseña de una cuenta de administrador desde aquí", 403);
  }

  // --- 4) Cambiar la contraseña ----------------------------------------
  const { error: errorUpdate } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, { password });
  if (errorUpdate) {
    return jsonError("No se pudo cambiar la contraseña", 500);
  }

  return jsonOk({ id: usuarioId, username: perfilObjetivo.username });
});