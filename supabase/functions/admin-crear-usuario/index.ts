// supabase/functions/admin-crear-usuario/index.ts
//
// Crea una cuenta nueva (auth.users + fila en `usuario`) desde el
// panel de administrador. Sustituye el flujo manual "Dashboard →
// Authentication → Add user → INSERT en usuario" (memorias/CLAUDE.md,
// "Cómo se crean usuarios hoy") por un botón real.
//
// Usa el cliente service_role porque auth.admin.createUser() no es
// una operación que el cliente pueda hacer con su propia sesión (no
// existe en supabase-js para el cliente anon/authenticated) — mismo
// motivo que resolver-catalogo o generar-personaje.
//
// Barreras de seguridad (checklist acordada, sesión 27/08/2026):
//  1) Se valida el JWT de quien llama y se comprueba que su rol en
//     `usuario` es 'administrador' — igual que hace `ceria/index.ts`.
//  2) Whitelist estricta de roles asignables: NUNCA se puede crear
//     una cuenta con rol 'administrador' desde aquí, ni 'pantalla' /
//     'jefe_rectificado' (roles especiales sin flujo de alta
//     pensado). Si `rol` no está en la whitelist, se rechaza — no se
//     ignora en silencio.
//  3) Si falla el INSERT en `usuario` después de crear la cuenta de
//     Auth, se hace rollback borrando el usuario de Auth — para no
//     dejar una cuenta "fantasma" sin perfil de aplicación.
//  4) Los errores devueltos al cliente son mensajes propios, nunca el
//     error crudo de Postgres/Auth (evita filtrar detalles internos).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mismo dominio sintético que frontend/src/lib/auth.ts
// (emailSinteticoDeUsername) — duplicado a propósito: esta función
// corre en Deno, el frontend en el bundler de Vite, no comparten
// runtime. Si se cambia el dominio en un sitio, cambiarlo también aquí.
const DOMINIO_SINTETICO = "motivproduccion.local";

function emailSinteticoDeUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${DOMINIO_SINTETICO}`;
}

// Igual que ROLES_CON_LETRA en frontend/src/lib/admin-usuarios.ts —
// duplicado por el mismo motivo de runtime separado.
type RolAsignable = "responsable" | "suplente" | "operario" | "jefe" | "produccion" | "calidad";
const ROLES_ASIGNABLES: RolAsignable[] = ["responsable", "suplente", "operario", "jefe", "produccion", "calidad"];
const ROLES_CON_LETRA: RolAsignable[] = ["responsable", "operario"];

interface RequestBody {
  username?: string;
  password?: string;
  rol?: string;
  letra?: "A" | "B" | "C" | "D" | null;
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
    return jsonError("Solo un administrador puede crear usuarios", 403);
  }

  // --- 2) Validar el cuerpo de la petición ---------------------------
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido", 400);
  }

  const username = body.username?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const rol = body.rol as RolAsignable;

  if (!username || username.length < 3) {
    return jsonError("El nombre de usuario debe tener al menos 3 caracteres", 400);
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return jsonError("El nombre de usuario solo puede tener letras, números, puntos, guiones y guiones bajos", 400);
  }
  if (!password || password.length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres", 400);
  }
  if (!ROLES_ASIGNABLES.includes(rol)) {
    return jsonError("Rol no válido para crear una cuenta desde aquí", 400);
  }

  const tieneLetra = ROLES_CON_LETRA.includes(rol);
  const letra = tieneLetra ? (body.letra ?? null) : null;
  if (tieneLetra && letra && !["A", "B", "C", "D"].includes(letra)) {
    return jsonError("Letra de rotación no válida", 400);
  }

  // --- 3) Crear la cuenta de Auth -------------------------------------
  const email = emailSinteticoDeUsername(username);

  const { data: nuevoAuthUser, error: errorAuth } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no hay email real, así que se confirma directamente
  });

  if (errorAuth || !nuevoAuthUser?.user) {
    // Supabase Auth devuelve un mensaje reconocible cuando el email ya existe
    const yaExiste = errorAuth?.message?.toLowerCase().includes("already");
    return jsonError(
      yaExiste ? `Ya existe una cuenta con el usuario "${username}"` : "No se pudo crear la cuenta",
      yaExiste ? 409 : 500,
    );
  }

  const nuevoId = nuevoAuthUser.user.id;

  // --- 4) Crear el perfil de aplicación --------------------------------
  const { error: errorPerfil } = await supabaseAdmin
    .from("usuario")
    .insert({ id: nuevoId, username, rol, letra });

  if (errorPerfil) {
    // Rollback: no dejar una cuenta de Auth huérfana sin perfil
    await supabaseAdmin.auth.admin.deleteUser(nuevoId);
    return jsonError("No se pudo crear el perfil del usuario — no se ha creado la cuenta", 500);
  }

  return jsonOk({ id: nuevoId, username, rol, letra });
});